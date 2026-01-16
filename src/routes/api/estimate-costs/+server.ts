import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';
import type { Issue, BudgetEstimate, BudgetAlternative } from '$lib/types/issue';

interface CostEstimateResponse {
	estimates: {
		issueId: string;
		estimate: BudgetEstimate;
	}[];
	totalMinCost: number;
	totalMaxCost: number;
	totalExpectedCost: number;
	currency: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { issues, location, currency = 'USD', model, apiKey } = await request.json();

	if (!issues || !Array.isArray(issues)) {
		return json({ error: 'Issues array is required' }, { status: 400 });
	}

	const systemPrompt = `You are an expert cost estimator who provides accurate cost ranges for personal projects and tasks.

Given a list of tasks for a personal project, estimate how much each will cost.

Consider:
1. Regional cost variations (if location provided)
2. Professional service costs (contractors, lawyers, inspectors, etc.)
3. Materials and supplies
4. Permit fees and government costs
5. Hidden costs that people often forget

For each task, provide:
- minCost: Best case (DIY where possible, off-season pricing)
- maxCost: Worst case (premium services, complications)
- expectedCost: Most likely cost
- confidence: 0-1 how confident you are
- reasoning: Brief explanation
- factors: Key cost drivers
- alternatives: Ways to save money (with tradeoffs)

Respond in JSON format:
{
  "estimates": [
    {
      "issueId": "task-id",
      "estimate": {
        "minCost": 500,
        "maxCost": 2000,
        "expectedCost": 1200,
        "currency": "USD",
        "confidence": 0.7,
        "reasoning": "Home inspections typically cost...",
        "factors": ["Property size", "Inspector experience", "Location"],
        "alternatives": [
          {
            "description": "Use inspector from buyer's list",
            "savings": 200,
            "tradeoff": "May miss some issues"
          }
        ]
      }
    }
  ],
  "totalMinCost": 5000,
  "totalMaxCost": 20000,
  "totalExpectedCost": 12000,
  "currency": "USD"
}

Important:
- All costs should be in ${currency}
- ${location ? `Consider pricing typical for ${location}` : 'Use US national averages if no location specified'}
- Some tasks may have $0 cost (like making a phone call)
- Be realistic about professional service costs`;

	const taskDescriptions = issues.map((issue: Issue) => ({
		id: issue.id,
		title: issue.title,
		description: issue.description,
		type: issue.type,
		executionType: issue.executionType
	}));

	const userPrompt = `Estimate costs for these project tasks:

${JSON.stringify(taskDescriptions, null, 2)}

Location: ${location || 'Not specified (use US averages)'}
Currency: ${currency}

Provide realistic cost estimates. Include alternatives for saving money where applicable.`;

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

		const result: CostEstimateResponse = JSON.parse(jsonMatch[0]);

		// Add timestamp to each estimate
		const now = new Date().toISOString();
		for (const est of result.estimates) {
			est.estimate.estimatedAt = now;
			if (location) {
				est.estimate.location = location;
			}
		}

		return json(result);
	} catch (error) {
		console.error('Cost estimation error:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to estimate costs'
		}, { status: 500 });
	}
};
