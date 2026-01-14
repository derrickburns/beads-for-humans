import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { IssueType } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request }) => {
	const { title, type, model } = (await request.json()) as {
		title: string;
		type: IssueType;
		model?: string;
	};

	if (!title || title.length < 3) {
		return json({ description: '' });
	}

	const typeContext: Record<IssueType, string> = {
		task: 'a task that needs to be completed',
		bug: 'a bug that needs to be fixed',
		feature: 'a new feature to be implemented'
	};

	const prompt = `Generate a brief, practical description for this issue in an issue tracker.

Title: "${title}"
Type: ${typeContext[type] || 'an issue'}

Write 2-3 sentences that:
1. Clarify what needs to be done
2. Add context that would help someone understand the scope
3. Optionally mention acceptance criteria or key considerations

Keep it concise and actionable. Don't repeat the title. Don't use bullet points or markdown formatting.
Respond with ONLY the description text, nothing else.`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 300,
			model
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ description: '' });
		}

		return json({ description: result.content.trim() });
	} catch (error) {
		console.error('Error calling AI API:', error);
		return json({ description: '' });
	}
};
