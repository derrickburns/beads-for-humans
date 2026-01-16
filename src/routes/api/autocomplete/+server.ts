import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request }) => {
	const { text, context, model, apiKey } = await request.json() as {
		text: string;
		context?: string;
		model?: string;
		apiKey?: string;
	};

	if (!text?.trim()) {
		return json({ suggestion: '' });
	}

	const prompt = `You are an autocomplete assistant. Complete the user's text naturally and concisely.

${context ? `Context: ${context}\n\n` : ''}User is typing: "${text}"

Continue their thought with a SHORT completion (1-2 sentences max). Only output the completion text, nothing else. If you can't think of a good completion, output nothing.`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 100,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			return json({ suggestion: '' });
		}

		// Clean up the suggestion - remove quotes, trim
		let suggestion = result.content.trim();
		// Remove leading quotes if present
		if (suggestion.startsWith('"') || suggestion.startsWith("'")) {
			suggestion = suggestion.slice(1);
		}
		if (suggestion.endsWith('"') || suggestion.endsWith("'")) {
			suggestion = suggestion.slice(0, -1);
		}

		return json({ suggestion });
	} catch (error) {
		console.error('Autocomplete error:', error);
		return json({ suggestion: '' });
	}
};
