import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { IssueType } from '$lib/types/issue';
import { env } from '$env/dynamic/private';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;

	if (!apiKey) {
		return json({ description: '' });
	}

	const { title, type } = (await request.json()) as {
		title: string;
		type: IssueType;
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
		const response = await fetch(ANTHROPIC_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 300,
				messages: [{ role: 'user', content: prompt }]
			})
		});

		if (!response.ok) {
			console.error('Anthropic API error:', await response.text());
			return json({ description: '' });
		}

		const data = await response.json();
		const description = data.content?.[0]?.text?.trim() || '';

		return json({ description });
	} catch (error) {
		console.error('Error calling Anthropic API:', error);
		return json({ description: '' });
	}
};
