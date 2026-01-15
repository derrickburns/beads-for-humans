import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';

interface Criterion {
	name: string;
	description: string;
	weight: number; // 1-5 importance
	category: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { decision, context, model, apiKey } = (await request.json()) as {
		decision: string;
		context?: string;
		model?: string;
		apiKey?: string;
	};

	if (!decision || decision.trim().length < 5) {
		return json({ error: 'Please provide more detail about your decision' });
	}

	const prompt = `You are helping someone make an important decision. They need to compare options against specific criteria.

DECISION: "${decision}"
${context ? `CONTEXT: ${context}` : ''}

Generate 5-8 relevant criteria to evaluate options for this decision. For each criterion:
1. Give it a clear, concise name
2. Explain what it measures and why it matters
3. Assign an importance weight (1-5, where 5 is most important)
4. Categorize it (practical, financial, quality, risk, personal, timing)

Consider:
- What would an expert in this area evaluate?
- What criteria do people often forget but regret later?
- What are the non-obvious factors that matter?
- Balance objective (measurable) and subjective (feels) criteria

Respond with ONLY valid JSON:
{
  "criteria": [
    {
      "name": "Short name",
      "description": "What this criterion measures and why it's important",
      "weight": 1-5,
      "category": "practical|financial|quality|risk|personal|timing"
    }
  ],
  "reasoning": "Brief explanation of why these criteria are important for this decision"
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 1500,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to suggest criteria' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' });
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate and normalize criteria
		const criteria: Criterion[] = (parsed.criteria || []).map((c: Criterion) => ({
			name: c.name || 'Unnamed Criterion',
			description: c.description || '',
			weight: Math.max(1, Math.min(5, c.weight || 3)),
			category: ['practical', 'financial', 'quality', 'risk', 'personal', 'timing'].includes(c.category)
				? c.category
				: 'practical'
		}));

		return json({
			criteria,
			reasoning: parsed.reasoning || 'Criteria selected based on decision type'
		});
	} catch (error) {
		console.error('Error suggesting criteria:', error);
		return json({ error: 'Failed to suggest criteria' });
	}
};
