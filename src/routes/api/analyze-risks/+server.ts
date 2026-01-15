import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';
import type { Issue } from '$lib/types/issue';

interface Risk {
	id: string;
	title: string;
	description: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	probability: 'likely' | 'possible' | 'unlikely';
	category: string;
	mitigation: string;
	earlyWarnings: string[];
	relatedTasks: string[]; // Task titles this risk relates to
	impact: string; // What happens if this risk materializes
}

export const POST: RequestHandler = async ({ request }) => {
	const { issues, projectContext, model, apiKey } = (await request.json()) as {
		issues: Issue[];
		projectContext?: string;
		model?: string;
		apiKey?: string;
	};

	if (!issues || issues.length === 0) {
		return json({ error: 'No issues provided for risk analysis' });
	}

	// Build a summary of the project tasks
	const taskSummary = issues
		.filter(i => i.status !== 'closed')
		.map(i => `- ${i.title}: ${i.description || 'No description'}`)
		.join('\n');

	const prompt = `You are a risk management expert analyzing a project plan to identify potential risks BEFORE they become problems.

PROJECT TASKS:
${taskSummary}

${projectContext ? `ADDITIONAL CONTEXT: ${projectContext}` : ''}

Analyze this project and identify 5-10 significant risks. For each risk:
1. Consider what could go wrong based on the task types
2. Think about common problems people encounter with similar projects
3. Identify risks specific to this project's scope and complexity
4. Provide actionable mitigation strategies
5. List early warning signs so problems can be caught early

RISK CATEGORIES:
- schedule: Timeline delays, dependency chains, external delays
- financial: Cost overruns, hidden costs, market changes
- quality: Poor workmanship, scope creep, requirement gaps
- external: Third-party dependencies, regulatory issues, market factors
- resource: Skill gaps, availability issues, communication problems
- technical: Technology limitations, integration issues, complexity
- personal: Decision fatigue, emotional factors, stakeholder conflicts

SEVERITY LEVELS:
- critical: Project failure or major loss if this occurs
- high: Significant impact, will require major recovery effort
- medium: Noticeable impact, manageable with some effort
- low: Minor inconvenience, easily handled

PROBABILITY:
- likely: More than 50% chance of occurring
- possible: Between 20-50% chance
- unlikely: Less than 20% but still worth watching

Respond with ONLY valid JSON:
{
  "risks": [
    {
      "id": "risk-1",
      "title": "Short, clear risk title",
      "description": "What could go wrong and why",
      "severity": "critical|high|medium|low",
      "probability": "likely|possible|unlikely",
      "category": "schedule|financial|quality|external|resource|technical|personal",
      "mitigation": "Specific action to prevent or reduce this risk",
      "earlyWarnings": ["Sign 1 to watch for", "Sign 2 to watch for"],
      "relatedTasks": ["Task title 1", "Task title 2"],
      "impact": "What happens if this risk materializes"
    }
  ],
  "summary": "Overall risk assessment - one paragraph about the project's risk profile"
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 3000,
			model,
			apiKey,
			extendedThinking: true,
			thinkingBudget: 5000
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to analyze risks' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' });
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate and normalize risks
		const validSeverities = ['critical', 'high', 'medium', 'low'];
		const validProbabilities = ['likely', 'possible', 'unlikely'];
		const validCategories = ['schedule', 'financial', 'quality', 'external', 'resource', 'technical', 'personal'];

		const risks: Risk[] = (parsed.risks || []).map((r: Risk, i: number) => ({
			id: r.id || `risk-${i + 1}`,
			title: r.title || 'Unnamed Risk',
			description: r.description || '',
			severity: validSeverities.includes(r.severity) ? r.severity : 'medium',
			probability: validProbabilities.includes(r.probability) ? r.probability : 'possible',
			category: validCategories.includes(r.category) ? r.category : 'external',
			mitigation: r.mitigation || 'Monitor and respond as needed',
			earlyWarnings: Array.isArray(r.earlyWarnings) ? r.earlyWarnings : [],
			relatedTasks: Array.isArray(r.relatedTasks) ? r.relatedTasks : [],
			impact: r.impact || 'May cause delays or additional costs'
		}));

		return json({
			risks,
			summary: parsed.summary || 'Risk analysis complete',
			analyzedAt: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error analyzing risks:', error);
		return json({ error: 'Failed to analyze risks' });
	}
};
