import { env } from '$env/dynamic/private';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface ChatCompletionOptions {
	messages: ChatMessage[];
	maxTokens?: number;
	model?: string;
}

export interface ChatCompletionResult {
	content: string | null;
	error?: string;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default model if none specified
const DEFAULT_MODEL = 'openai/gpt-4o';

export async function chatCompletion(
	options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
	const apiKey = env.OPENROUTER_API_KEY;

	if (!apiKey) {
		return {
			content: null,
			error: 'AI features not configured - set OPENROUTER_API_KEY in .env'
		};
	}

	const model = options.model || DEFAULT_MODEL;
	const maxTokens = options.maxTokens || 1024;

	try {
		const response = await fetch(OPENROUTER_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
				'HTTP-Referer': env.SITE_URL || 'http://localhost:5173',
				'X-Title': 'Issues Tracker'
			},
			body: JSON.stringify({
				model,
				max_tokens: maxTokens,
				messages: options.messages.map((m) => ({
					role: m.role,
					content: m.content
				}))
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('OpenRouter API error:', errorText);
			return { content: null, error: errorText };
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content || null;
		return { content };
	} catch (error) {
		console.error('Error calling OpenRouter API:', error);
		return { content: null, error: String(error) };
	}
}

export function isAIConfigured(): boolean {
	return !!env.OPENROUTER_API_KEY;
}
