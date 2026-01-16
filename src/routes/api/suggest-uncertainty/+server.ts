import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';
import type {
	Issue,
	UncertainParameter,
	ModelingApproach,
	DistributionType,
	UncertaintyType,
	Scenario,
	SimulationConfig
} from '$lib/types/issue';

interface UncertaintySuggestion {
	approach: ModelingApproach;
	rationale: string;
	parameters: UncertainParameter[];
	scenarios?: Scenario[];
	simulationConfig: SimulationConfig;
	explanation: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { issue, projectContext, model, apiKey } = (await request.json()) as {
		issue: Issue;
		projectContext?: string;
		model?: string;
		apiKey?: string;
	};

	if (!issue) {
		return json({ error: 'Issue is required' });
	}

	const prompt = `You are an expert in uncertainty modeling and risk analysis. Analyze this task/goal and suggest how to model any uncertainty involved.

TASK/GOAL:
Title: ${issue.title}
Description: ${issue.description || 'No description'}
Type: ${issue.type}
${issue.successCriteria?.length ? `Success Criteria:\n${issue.successCriteria.map(c => `- ${c}`).join('\n')}` : ''}

${projectContext ? `PROJECT CONTEXT: ${projectContext}` : ''}

Your job:
1. Identify if this task involves outcomes that cannot be known with certainty
2. If so, suggest the best modeling approach
3. Propose specific uncertain parameters with appropriate distributions
4. Recommend a simulation configuration

UNCERTAINTY TYPES:
- market_returns: Investment performance, stock prices
- inflation: Cost of living changes over time
- longevity: How long someone will live
- healthcare_costs: Medical expenses
- income: Employment, earnings
- interest_rates: Borrowing/savings rates
- property_values: Real estate appreciation
- exchange_rates: Currency fluctuations
- project_duration: How long work takes
- project_cost: How much work costs
- custom: User-defined uncertainty

MODELING APPROACHES:
- monte_carlo: Best for many uncertain parameters, need probability distributions. Use for financial planning, complex projects.
- scenario_analysis: Best when discrete named futures are meaningful. Use for strategic planning, business decisions.
- sensitivity: Best to identify which parameter matters most. Use for understanding drivers.
- historical_sim: Best when historical data is available and relevant. Use for market-based projections.
- stress_test: Best for testing extreme but plausible events. Use for risk management.
- bayesian: Best when you'll update beliefs as new data arrives. Use for evolving estimates.
- robust_optimization: Best for optimizing under uncertainty. Use for portfolio allocation.
- real_options: Best when flexibility has value. Use for staged investments.

DISTRIBUTION TYPES:
- normal: Symmetric, thin tails. Good for averages of many factors.
- log_normal: Always positive, right-skewed. Good for prices, wealth, durations.
- student_t: Fat tails. Good for market returns (captures crashes).
- pareto: Power law, extreme events. Good for catastrophic losses.
- triangular: Min/mode/max estimate. Good when you have three-point estimates.
- uniform: Equal probability in range. Good when you know bounds but nothing else.
- empirical: From historical data. Good when you have good data.
- mixture: Regime switching. Good for markets with bull/bear regimes.

DOMAIN KNOWLEDGE FOR DEFAULTS:
- US stocks: mean 7% real return, 18% stdDev, Student's t (df=5)
- US bonds: mean 2% real return, 6% stdDev, normal
- Inflation: mean 3%, stdDev 1.5%, log-normal
- Project durations: often 1.5-3x estimates, log-normal
- Longevity at 65: triangular(15, 22, 35) years remaining

Respond with ONLY valid JSON:
{
  "hasUncertainty": true/false,
  "uncertaintyExplanation": "Why this task does/doesn't involve uncertainty",
  "suggestion": {
    "approach": "monte_carlo|scenario_analysis|sensitivity|etc",
    "rationale": "Why this approach is best for this problem",
    "parameters": [
      {
        "id": "param-1",
        "name": "Human-readable name",
        "uncertaintyType": "market_returns|inflation|etc",
        "description": "What this parameter represents",
        "distribution": "normal|log_normal|student_t|etc",
        "parameters": {
          "mean": 0.07,
          "stdDev": 0.18,
          "degreesOfFreedom": 5
        },
        "baseCase": 0.07,
        "lowCase": 0.03,
        "highCase": 0.12,
        "source": "historical|expert|user|ai_suggested",
        "confidence": 0.8,
        "rationale": "Why these values"
      }
    ],
    "scenarios": [
      {
        "id": "scenario-1",
        "name": "Bull Market",
        "description": "Sustained period of above-average returns",
        "probability": 0.3,
        "parameterOverrides": {"market_returns": 0.12}
      }
    ],
    "simulationConfig": {
      "approach": "monte_carlo",
      "iterations": 10000,
      "timeHorizon": 30,
      "confidenceLevel": 0.95
    },
    "explanation": "Plain English explanation of what the simulation will show"
  }
}

If there's no meaningful uncertainty, set hasUncertainty to false and explain why.`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 2500,
			model,
			apiKey,
			extendedThinking: true,
			thinkingBudget: 5000
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to analyze uncertainty' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' });
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate and normalize the response
		if (!parsed.hasUncertainty) {
			return json({
				hasUncertainty: false,
				explanation: parsed.uncertaintyExplanation || 'This task does not involve significant uncertainty.',
				suggestion: null
			});
		}

		// Ensure parameters have required fields
		const normalizedParams: UncertainParameter[] = (parsed.suggestion?.parameters || []).map(
			(p: Partial<UncertainParameter>, i: number) => ({
				id: p.id || `param-${i + 1}`,
				name: p.name || 'Unnamed parameter',
				uncertaintyType: p.uncertaintyType || 'custom',
				description: p.description,
				distribution: p.distribution || 'normal',
				parameters: p.parameters || { mean: 0, stdDev: 1 },
				baseCase: p.baseCase,
				lowCase: p.lowCase,
				highCase: p.highCase,
				source: p.source || 'ai_suggested',
				confidence: p.confidence,
				rationale: p.rationale
			})
		);

		// Ensure scenarios have required fields
		const normalizedScenarios: Scenario[] = (parsed.suggestion?.scenarios || []).map(
			(s: Partial<Scenario>, i: number) => ({
				id: s.id || `scenario-${i + 1}`,
				name: s.name || `Scenario ${i + 1}`,
				description: s.description || '',
				probability: s.probability,
				parameterOverrides: s.parameterOverrides || {}
			})
		);

		const suggestion: UncertaintySuggestion = {
			approach: parsed.suggestion?.approach || 'monte_carlo',
			rationale: parsed.suggestion?.rationale || '',
			parameters: normalizedParams,
			scenarios: normalizedScenarios.length > 0 ? normalizedScenarios : undefined,
			simulationConfig: parsed.suggestion?.simulationConfig || {
				approach: parsed.suggestion?.approach || 'monte_carlo',
				iterations: 10000,
				timeHorizon: 10,
				confidenceLevel: 0.95
			},
			explanation: parsed.suggestion?.explanation || ''
		};

		return json({
			hasUncertainty: true,
			explanation: parsed.uncertaintyExplanation,
			suggestion,
			suggestedAt: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error analyzing uncertainty:', error);
		return json({ error: 'Failed to analyze uncertainty' });
	}
};
