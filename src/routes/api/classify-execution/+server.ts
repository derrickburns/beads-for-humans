import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ExecutionType } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface ExecutionClassification {
	executionType: ExecutionType;
	aiConfidence: number;
	validationRequired: boolean;
	executionReason: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { title, description, model, apiKey } = (await request.json()) as {
		title: string;
		description?: string;
		model?: string;
		apiKey?: string;
	};

	if (!title || title.trim().length < 3) {
		return json({ error: 'Please provide a task title' });
	}

	const prompt = `You are classifying who should do a task: AI, human, or a combination. Analyze this task and determine the best execution approach.

TASK TITLE: "${title}"
${description ? `TASK DESCRIPTION: "${description}"` : ''}

EXECUTION TYPES:
- "automated": AI can complete this entirely without human involvement
  Examples: Research and summarize, draft emails, generate code, analyze data, create documentation

- "human": Only a human can do this - physical actions, legal requirements, or decisions only the user can make
  Examples: Sign documents, make phone calls, visit locations, make financial decisions, physical tasks

- "ai_assisted": AI does most of the work but human should verify the result
  Examples: Write important communications, create business documents, generate code for production, financial analysis

- "human_assisted": Human does the core work but AI can help with research, suggestions, or guidance
  Examples: Job interviews, negotiations, creative decisions, relationship matters, medical decisions

VALIDATION INDICATORS:
- Set validationRequired=true when: the output affects others, involves money, legal implications, or is irreversible
- Set validationRequired=false when: low stakes, internal notes, or easily reversible

CONFIDENCE SCORING (0.0 to 1.0):
- 0.9-1.0: Very clear indicators (e.g., "sign contract" = human, "summarize article" = automated)
- 0.7-0.9: Strong indicators but some ambiguity
- 0.5-0.7: Could go either way, user should verify
- Below 0.5: Very unclear, defaulting to safest option

Respond with ONLY valid JSON:
{
  "executionType": "automated|human|ai_assisted|human_assisted",
  "aiConfidence": 0.0-1.0,
  "validationRequired": true/false,
  "executionReason": "One sentence explaining why this classification"
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 300,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to classify task. Please try again.' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' });
		}

		const classification = JSON.parse(jsonMatch[0]) as ExecutionClassification;

		// Validate and normalize the response
		const validTypes: ExecutionType[] = ['automated', 'human', 'ai_assisted', 'human_assisted'];
		const executionType: ExecutionType = validTypes.includes(classification.executionType)
			? classification.executionType
			: 'human_assisted';

		const aiConfidence =
			typeof classification.aiConfidence === 'number'
				? Math.max(0, Math.min(1, classification.aiConfidence))
				: 0.5;

		const validationRequired =
			typeof classification.validationRequired === 'boolean'
				? classification.validationRequired
				: true;

		return json({
			executionType,
			aiConfidence,
			validationRequired,
			executionReason: classification.executionReason || 'Classification based on task content'
		});
	} catch (error) {
		console.error('Error classifying execution:', error);
		return json({ error: 'Failed to classify task. Please try again.' });
	}
};
