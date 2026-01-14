import { browser } from '$app/environment';

export interface AIModel {
	id: string;
	name: string;
	provider: string; // Display name of the provider
}

// Popular models available on OpenRouter
export const AVAILABLE_MODELS: AIModel[] = [
	// Anthropic
	{ id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'Anthropic' },
	{ id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
	{ id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku (Fast)', provider: 'Anthropic' },
	// OpenAI
	{ id: 'openai/gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI' },
	{ id: 'openai/gpt-5-mini', name: 'GPT-5 Mini (Fast)', provider: 'OpenAI' },
	{ id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
	// Google
	{ id: 'google/gemini-3-pro', name: 'Gemini 3 Pro', provider: 'Google' },
	{ id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast)', provider: 'Google' },
	// Meta
	{ id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta' },
	// Mistral
	{ id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'Mistral' },
	// DeepSeek
	{ id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek' }
];

export interface AISettings {
	model: string;
}

const STORAGE_KEY = 'ai-settings';

const DEFAULT_SETTINGS: AISettings = {
	model: 'openai/gpt-4o'
};

function loadSettings(): AISettings {
	if (!browser) return DEFAULT_SETTINGS;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Validate the stored model exists
			if (parsed.model && AVAILABLE_MODELS.some((m) => m.id === parsed.model)) {
				return parsed;
			}
		}
	} catch {
		// Ignore parse errors
	}
	return DEFAULT_SETTINGS;
}

function saveSettings(settings: AISettings): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function createAISettingsStore() {
	let settings = $state<AISettings>(loadSettings());

	return {
		get model() {
			return settings.model;
		},
		get currentModel() {
			return AVAILABLE_MODELS.find((m) => m.id === settings.model) || AVAILABLE_MODELS[0];
		},

		setModel(modelId: string) {
			const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
			if (model) {
				settings.model = modelId;
				saveSettings(settings);
			}
		},

		// Get settings for API requests
		getRequestSettings(): { model: string } {
			return {
				model: settings.model
			};
		}
	};
}

export const aiSettings = createAISettingsStore();
