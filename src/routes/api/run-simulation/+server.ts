import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';
import type {
	UncertainParameter,
	SimulationConfig,
	SimulationResult,
	Scenario,
	ModelingApproach,
	DistributionType
} from '$lib/types/issue';

interface SimulationRequest {
	config: SimulationConfig;
	parameters: UncertainParameter[];
	context: {
		goalDescription: string;
		timeHorizon?: number;
		initialValue?: number;
		targetValue?: number;
		withdrawalRate?: number;
		inflationAdjusted?: boolean;
	};
	model?: string;
	apiKey?: string;
}

// Simple random number generators for distributions
function normalRandom(mean: number, stdDev: number): number {
	// Box-Muller transform
	const u1 = Math.random();
	const u2 = Math.random();
	const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	return mean + stdDev * z;
}

function logNormalRandom(mean: number, stdDev: number): number {
	// Log-normal from underlying normal
	const normalMean = Math.log(mean * mean / Math.sqrt(stdDev * stdDev + mean * mean));
	const normalStdDev = Math.sqrt(Math.log(1 + (stdDev * stdDev) / (mean * mean)));
	return Math.exp(normalRandom(normalMean, normalStdDev));
}

function studentTRandom(mean: number, stdDev: number, df: number): number {
	// Approximate Student's t using normal scaled by chi-squared
	// For simplicity, use normal with slightly fatter tails
	const normal = normalRandom(0, 1);
	const chi2 = Array.from({ length: df }, () => Math.pow(normalRandom(0, 1), 2)).reduce((a, b) => a + b, 0);
	const t = normal / Math.sqrt(chi2 / df);
	return mean + stdDev * t;
}

function triangularRandom(min: number, max: number, mode: number): number {
	const u = Math.random();
	const f = (mode - min) / (max - min);
	if (u < f) {
		return min + Math.sqrt(u * (max - min) * (mode - min));
	}
	return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function uniformRandom(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function sampleFromDistribution(param: UncertainParameter): number {
	const p = param.parameters;

	switch (param.distribution) {
		case 'normal':
			return normalRandom(p.mean || 0, p.stdDev || 1);

		case 'log_normal':
			return logNormalRandom(p.mean || 1, p.stdDev || 0.2);

		case 'student_t':
			return studentTRandom(p.mean || 0, p.stdDev || 1, p.degreesOfFreedom || 5);

		case 'triangular':
			return triangularRandom(p.min || 0, p.max || 1, p.mode || 0.5);

		case 'uniform':
			return uniformRandom(p.min || 0, p.max || 1);

		case 'empirical':
			// Sample from historical data if available
			if (p.historicalData && p.historicalData.length > 0) {
				return p.historicalData[Math.floor(Math.random() * p.historicalData.length)];
			}
			return p.mean || 0;

		case 'mixture':
			// Regime switching - pick a regime based on probability, then sample from it
			if (p.regimes && p.regimes.length > 0) {
				const roll = Math.random();
				let cumProb = 0;
				for (const regime of p.regimes) {
					cumProb += regime.probability;
					if (roll < cumProb) {
						// Sample from this regime
						const regimeParam: UncertainParameter = {
							...param,
							distribution: regime.distribution,
							parameters: regime.parameters
						};
						return sampleFromDistribution(regimeParam);
					}
				}
			}
			return p.mean || 0;

		case 'pareto':
			// Pareto distribution for fat tails
			const alpha = p.alpha || 2;
			const xm = p.min || 1;
			return xm / Math.pow(Math.random(), 1 / alpha);

		default:
			return p.mean || 0;
	}
}

function runMonteCarloSimulation(
	config: SimulationConfig,
	parameters: UncertainParameter[],
	context: SimulationRequest['context']
): Partial<SimulationResult> {
	const iterations = config.iterations || 1000;
	const timeHorizon = config.timeHorizon || context.timeHorizon || 10;
	const initialValue = context.initialValue || 1000000;
	const withdrawalRate = context.withdrawalRate || 0.04;
	const inflationAdjusted = context.inflationAdjusted !== false;

	const outcomes: number[] = [];
	let ruinCount = 0;

	for (let i = 0; i < iterations; i++) {
		let portfolioValue = initialValue;
		let annualWithdrawal = initialValue * withdrawalRate;

		for (let year = 0; year < timeHorizon; year++) {
			// Sample returns and inflation for this year
			let totalReturn = 0;
			let inflationRate = 0.03; // default

			for (const param of parameters) {
				const sample = sampleFromDistribution(param);
				if (param.uncertaintyType === 'market_returns') {
					totalReturn += sample;
				} else if (param.uncertaintyType === 'inflation') {
					inflationRate = sample;
				}
			}

			// If no market return parameter, use a default
			if (!parameters.some(p => p.uncertaintyType === 'market_returns')) {
				totalReturn = normalRandom(0.07, 0.15);
			}

			// Apply returns
			portfolioValue *= (1 + totalReturn);

			// Subtract withdrawal (inflation-adjusted if needed)
			if (inflationAdjusted) {
				annualWithdrawal *= (1 + inflationRate);
			}
			portfolioValue -= annualWithdrawal;

			// Check for ruin
			if (portfolioValue <= 0) {
				portfolioValue = 0;
				ruinCount++;
				break;
			}
		}

		outcomes.push(portfolioValue);
	}

	// Calculate percentiles
	const sorted = [...outcomes].sort((a, b) => a - b);
	const percentiles: Record<number, number> = {
		5: sorted[Math.floor(iterations * 0.05)],
		10: sorted[Math.floor(iterations * 0.10)],
		25: sorted[Math.floor(iterations * 0.25)],
		50: sorted[Math.floor(iterations * 0.50)],
		75: sorted[Math.floor(iterations * 0.75)],
		90: sorted[Math.floor(iterations * 0.90)],
		95: sorted[Math.floor(iterations * 0.95)]
	};

	const mean = outcomes.reduce((a, b) => a + b, 0) / iterations;
	const variance = outcomes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / iterations;
	const stdDev = Math.sqrt(variance);

	return {
		outcomes,
		percentiles,
		mean,
		stdDev,
		probabilityOfRuin: ruinCount / iterations
	};
}

function runScenarioAnalysis(
	config: SimulationConfig,
	parameters: UncertainParameter[],
	context: SimulationRequest['context']
): Partial<SimulationResult> {
	const scenarios = config.scenarios || [];
	const timeHorizon = config.timeHorizon || context.timeHorizon || 10;
	const initialValue = context.initialValue || 1000000;
	const withdrawalRate = context.withdrawalRate || 0.04;

	const scenarioOutcomes: Record<string, number> = {};

	for (const scenario of scenarios) {
		let portfolioValue = initialValue;
		let annualWithdrawal = initialValue * withdrawalRate;

		for (let year = 0; year < timeHorizon; year++) {
			// Use scenario overrides for parameters
			let totalReturn = scenario.parameterOverrides['market_returns'] || 0.07;
			const inflationRate = scenario.parameterOverrides['inflation'] || 0.03;

			portfolioValue *= (1 + totalReturn);
			annualWithdrawal *= (1 + inflationRate);
			portfolioValue -= annualWithdrawal;

			if (portfolioValue <= 0) {
				portfolioValue = 0;
				break;
			}
		}

		scenarioOutcomes[scenario.name] = portfolioValue;
	}

	return { scenarioOutcomes };
}

function runSensitivityAnalysis(
	config: SimulationConfig,
	parameters: UncertainParameter[],
	context: SimulationRequest['context']
): Partial<SimulationResult> {
	const paramToVary = config.parameterToVary;
	const sweepRange = config.sweepRange || { min: 0.02, max: 0.12, steps: 11 };
	const timeHorizon = config.timeHorizon || context.timeHorizon || 10;
	const initialValue = context.initialValue || 1000000;
	const withdrawalRate = context.withdrawalRate || 0.04;

	const sensitivityCurve: Array<{ paramValue: number; outcome: number }> = [];
	const step = (sweepRange.max - sweepRange.min) / (sweepRange.steps - 1);

	for (let i = 0; i < sweepRange.steps; i++) {
		const paramValue = sweepRange.min + i * step;
		let portfolioValue = initialValue;
		let annualWithdrawal = initialValue * withdrawalRate;

		for (let year = 0; year < timeHorizon; year++) {
			// Use the varied parameter value as return
			portfolioValue *= (1 + paramValue);
			annualWithdrawal *= 1.03; // assume 3% inflation
			portfolioValue -= annualWithdrawal;

			if (portfolioValue <= 0) {
				portfolioValue = 0;
				break;
			}
		}

		sensitivityCurve.push({ paramValue, outcome: portfolioValue });
	}

	return { sensitivityCurve };
}

export const POST: RequestHandler = async ({ request }) => {
	const { config, parameters, context, model, apiKey } = (await request.json()) as SimulationRequest;

	if (!config || !config.approach) {
		return json({ error: 'Simulation config with approach is required' });
	}

	const startTime = Date.now();
	let simulationData: Partial<SimulationResult> = {};

	try {
		// Run the appropriate simulation type
		switch (config.approach) {
			case 'monte_carlo':
				simulationData = runMonteCarloSimulation(config, parameters || [], context);
				break;
			case 'scenario_analysis':
				simulationData = runScenarioAnalysis(config, parameters || [], context);
				break;
			case 'sensitivity':
				simulationData = runSensitivityAnalysis(config, parameters || [], context);
				break;
			case 'stress_test':
				// Create extreme scenarios automatically
				const stressScenarios: Scenario[] = [
					{
						id: 'market-crash',
						name: 'Market Crash (2008-style)',
						description: 'Severe market downturn similar to 2008 financial crisis',
						parameterOverrides: { market_returns: -0.37, inflation: 0.01 }
					},
					{
						id: 'stagflation',
						name: 'Stagflation',
						description: 'Low growth with high inflation (1970s-style)',
						parameterOverrides: { market_returns: 0.02, inflation: 0.08 }
					},
					{
						id: 'lost-decade',
						name: 'Lost Decade',
						description: 'Extended period of zero real returns',
						parameterOverrides: { market_returns: 0.03, inflation: 0.03 }
					}
				];
				simulationData = runScenarioAnalysis(
					{ ...config, scenarios: stressScenarios },
					parameters || [],
					context
				);
				break;
			default:
				return json({ error: `Unsupported simulation approach: ${config.approach}` });
		}

		// Generate AI summary and recommendations
		const summaryPrompt = `You are a financial planning expert. Analyze these simulation results and provide a plain-English summary with actionable recommendations.

SIMULATION TYPE: ${config.approach}
CONTEXT: ${context.goalDescription}
TIME HORIZON: ${config.timeHorizon || context.timeHorizon || 10} years
INITIAL VALUE: $${(context.initialValue || 1000000).toLocaleString()}
WITHDRAWAL RATE: ${((context.withdrawalRate || 0.04) * 100).toFixed(1)}%

RESULTS:
${JSON.stringify(simulationData, null, 2)}

Provide:
1. A 2-3 sentence plain-English summary of what these results mean
2. 3-5 specific, actionable recommendations based on the results
3. Key risks or concerns highlighted by the simulation

Respond with ONLY valid JSON:
{
  "summary": "Plain English explanation of results",
  "recommendations": ["Recommendation 1", "Recommendation 2", ...],
  "keyRisks": ["Risk 1", "Risk 2", ...]
}`;

		const aiResult = await chatCompletion({
			messages: [{ role: 'user', content: summaryPrompt }],
			maxTokens: 1500,
			model,
			apiKey
		});

		let summary = 'Simulation complete.';
		let recommendations: string[] = [];

		if (aiResult.content) {
			try {
				const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					const parsed = JSON.parse(jsonMatch[0]);
					summary = parsed.summary || summary;
					recommendations = parsed.recommendations || [];
				}
			} catch {
				// Use raw content as summary if JSON parsing fails
				summary = aiResult.content.substring(0, 500);
			}
		}

		const result: SimulationResult = {
			id: `sim-${Date.now()}`,
			config,
			runAt: new Date().toISOString(),
			...simulationData,
			summary,
			recommendations
		};

		return json({
			result,
			executionTimeMs: Date.now() - startTime
		});

	} catch (error) {
		console.error('Error running simulation:', error);
		return json({ error: 'Failed to run simulation' });
	}
};
