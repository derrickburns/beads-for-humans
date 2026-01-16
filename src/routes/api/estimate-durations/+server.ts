import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';
import type { Issue } from '$lib/types/issue';

interface DurationEstimate {
	issueId: string;
	minDays: number;
	maxDays: number;
	expectedDays: number;
	confidence: number;
	reasoning: string;
	factors: string[];
}

interface EstimateResult {
	estimates: DurationEstimate[];
	criticalPath: string[];
	totalMinDays: number;
	totalMaxDays: number;
	totalExpectedDays: number;
}

export const POST: RequestHandler = async ({ request }) => {
	const { issues, userContext, model, apiKey } = await request.json();

	if (!issues || !Array.isArray(issues)) {
		return json({ error: 'Issues array is required' }, { status: 400 });
	}

	const systemPrompt = `You are an expert project manager who estimates task durations accurately.

Given a list of tasks for a personal project, estimate how long each will take in calendar days.

Consider:
1. Task complexity and type (research, decision-making, physical work, waiting periods)
2. Industry averages for similar tasks (e.g., home inspections typically take 1-3 days to schedule and complete)
3. Dependencies that may cause waiting time
4. Real-world factors like vendor availability, business hours, weekends

For each task, provide:
- minDays: Best case scenario (everything goes smoothly)
- maxDays: Worst case scenario (reasonable delays)
- expectedDays: Most likely duration
- confidence: 0-1 how confident you are in this estimate
- reasoning: Brief explanation
- factors: Key factors affecting duration

Also identify the critical path - the sequence of tasks that determines minimum project duration.

Respond in JSON format:
{
  "estimates": [
    {
      "issueId": "task-id",
      "minDays": 1,
      "maxDays": 5,
      "expectedDays": 3,
      "confidence": 0.8,
      "reasoning": "Home inspections typically...",
      "factors": ["Inspector availability", "Property size"]
    }
  ],
  "criticalPath": ["task-id-1", "task-id-2"],
  "totalMinDays": 30,
  "totalMaxDays": 90,
  "totalExpectedDays": 60
}`;

	const taskDescriptions = issues.map((issue: Issue) => ({
		id: issue.id,
		title: issue.title,
		description: issue.description,
		type: issue.type,
		executionType: issue.executionType,
		status: issue.status,
		dependencies: issue.dependencies || [],
		blockedBy: issue.dependencies?.map((depId: string) => {
			const dep = issues.find((i: Issue) => i.id === depId);
			return dep ? dep.title : depId;
		})
	}));

	const userPrompt = `Estimate durations for these project tasks:

${JSON.stringify(taskDescriptions, null, 2)}

${userContext ? `User context: ${userContext}` : ''}

Provide realistic duration estimates in calendar days. Consider weekends and typical delays.`;

	try {
		const response = await chatCompletion({
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			maxTokens: 4096,
			model,
			apiKey
		});

		const content = response.content || '';

		// Parse JSON from response
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' }, { status: 500 });
		}

		const result: EstimateResult = JSON.parse(jsonMatch[0]);
		return json(result);
	} catch (error) {
		console.error('Duration estimation error:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to estimate durations'
		}, { status: 500 });
	}
};
