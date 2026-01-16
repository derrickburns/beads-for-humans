import { env } from '$env/dynamic/private';

// Content block for vision API (text or image)
export interface TextContent {
	type: 'text';
	text: string;
}

export interface ImageContent {
	type: 'image_url';
	image_url: {
		url: string;  // data:image/jpeg;base64,... format
	};
}

export type ContentBlock = TextContent | ImageContent;

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string | ContentBlock[];  // Support both text and content arrays for vision
}

export interface ChatCompletionOptions {
	messages: ChatMessage[];
	maxTokens?: number;
	model?: string;
	apiKey?: string; // Client-provided API key (optional)
	extendedThinking?: boolean; // Enable extended thinking for Claude models
	thinkingBudget?: number; // Max tokens for thinking (default 10000)
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
	// Use client-provided API key if available, otherwise fall back to server env
	const apiKey = options.apiKey || env.OPENROUTER_API_KEY;

	if (!apiKey) {
		return {
			content: null,
			error: 'AI not configured. Add your OpenRouter API key in Settings.'
		};
	}

	const model = options.model || DEFAULT_MODEL;
	const maxTokens = options.maxTokens || 1024;

	// Check if model supports extended thinking (Claude models)
	const supportsExtendedThinking = model.includes('claude') &&
		(model.includes('sonnet') || model.includes('opus'));

	// Build request body - preserve content structure for vision support
	const requestBody: Record<string, unknown> = {
		model,
		max_tokens: maxTokens,
		messages: options.messages.map((m) => ({
			role: m.role,
			content: m.content  // Can be string or ContentBlock[] for vision
		}))
	};

	// Add extended thinking for supported models when requested
	if (options.extendedThinking && supportsExtendedThinking) {
		requestBody.thinking = {
			type: 'enabled',
			budget_tokens: options.thinkingBudget || 10000
		};
		// Increase max_tokens to accommodate thinking + response
		requestBody.max_tokens = Math.max(maxTokens, 16000);
	}

	try {
		const response = await fetch(OPENROUTER_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
				'HTTP-Referer': env.SITE_URL || 'http://localhost:5173',
				'X-Title': 'Middle Manager'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('OpenRouter API error:', errorText);
			// Provide helpful error messages
			if (response.status === 401) {
				return { content: null, error: 'Invalid API key. Please check your OpenRouter API key.' };
			}
			if (response.status === 429) {
				return { content: null, error: 'Rate limit exceeded. Please try again in a moment.' };
			}
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

export interface StreamingOptions extends ChatCompletionOptions {
	onToken?: (token: string) => void;
	onThinking?: (thinking: string) => void;
}

export async function* chatCompletionStream(
	options: StreamingOptions
): AsyncGenerator<{ type: 'thinking' | 'content' | 'done' | 'error'; data: string }> {
	const apiKey = options.apiKey || env.OPENROUTER_API_KEY;

	if (!apiKey) {
		yield { type: 'error', data: 'AI not configured. Add your OpenRouter API key in Settings.' };
		return;
	}

	const model = options.model || DEFAULT_MODEL;
	const maxTokens = options.maxTokens || 1024;

	const supportsExtendedThinking = model.includes('claude') &&
		(model.includes('sonnet') || model.includes('opus'));

	// Build request body - preserve content structure for vision support
	const requestBody: Record<string, unknown> = {
		model,
		max_tokens: maxTokens,
		stream: true,
		messages: options.messages.map((m) => ({
			role: m.role,
			content: m.content  // Can be string or ContentBlock[] for vision
		}))
	};

	if (options.extendedThinking && supportsExtendedThinking) {
		requestBody.thinking = {
			type: 'enabled',
			budget_tokens: options.thinkingBudget || 10000
		};
		requestBody.max_tokens = Math.max(maxTokens, 16000);
	}

	try {
		const response = await fetch(OPENROUTER_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
				'HTTP-Referer': env.SITE_URL || 'http://localhost:5173',
				'X-Title': 'Middle Manager'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorText = await response.text();
			if (response.status === 401) {
				yield { type: 'error', data: 'Invalid API key. Please check your OpenRouter API key.' };
			} else if (response.status === 429) {
				yield { type: 'error', data: 'Rate limit exceeded. Please try again in a moment.' };
			} else {
				yield { type: 'error', data: errorText };
			}
			return;
		}

		const reader = response.body?.getReader();
		if (!reader) {
			yield { type: 'error', data: 'No response body' };
			return;
		}

		const decoder = new TextDecoder();
		let buffer = '';
		let fullContent = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const data = line.slice(6);
					if (data === '[DONE]') {
						yield { type: 'done', data: fullContent };
						return;
					}

					try {
						const parsed = JSON.parse(data);
						const delta = parsed.choices?.[0]?.delta;

						if (delta?.content) {
							fullContent += delta.content;
							yield { type: 'content', data: delta.content };
						}

						// Handle thinking blocks if present (Claude extended thinking)
						if (delta?.thinking) {
							yield { type: 'thinking', data: delta.thinking };
						}
					} catch {
						// Ignore parse errors for incomplete JSON
					}
				}
			}
		}

		yield { type: 'done', data: fullContent };
	} catch (error) {
		yield { type: 'error', data: String(error) };
	}
}

/**
 * Helper to build content blocks with text and images
 * @param text The text message
 * @param images Array of base64 images with mimeType
 * @returns Content that can be used in ChatMessage
 */
export function buildVisionContent(
	text: string,
	images: Array<{ data: string; mimeType: string }>
): ContentBlock[] {
	const content: ContentBlock[] = [{ type: 'text', text }];

	for (const img of images) {
		content.push({
			type: 'image_url',
			image_url: {
				url: `data:${img.mimeType};base64,${img.data}`
			}
		});
	}

	return content;
}
