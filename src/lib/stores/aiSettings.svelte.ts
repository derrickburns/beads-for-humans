import { browser } from '$app/environment';

export interface AIModel {
	id: string;
	name: string;
	provider: string; // Display name of the provider
}

// Preset types for simplified selection
export type PresetType = 'quick' | 'balanced' | 'thorough';

export interface Preset {
	type: PresetType;
	name: string;
	description: string;
	modelId: string;
}

// User-friendly presets
export const PRESETS: Preset[] = [
	{
		type: 'quick',
		name: 'Quick',
		description: 'Fast responses, lower cost. Best for simple tasks.',
		modelId: 'anthropic/claude-3.5-haiku'
	},
	{
		type: 'balanced',
		name: 'Balanced',
		description: 'Good balance of speed and quality. Recommended.',
		modelId: 'openai/gpt-4o'
	},
	{
		type: 'thorough',
		name: 'Thorough',
		description: 'Highest quality, takes longer. Best for complex tasks.',
		modelId: 'anthropic/claude-sonnet-4'
	}
];

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
	apiKey?: string; // Optional client-side API key
}

export type AIStatus = 'configured' | 'client-key' | 'not-configured';

const STORAGE_KEY = 'ai-settings';
const API_KEY_STORAGE_KEY = 'openrouter-api-key';

const DEFAULT_SETTINGS: AISettings = {
	model: 'openai/gpt-4o'
};

function loadSettings(): AISettings {
	if (!browser) return DEFAULT_SETTINGS;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || undefined;

		if (stored) {
			const parsed = JSON.parse(stored);
			// Validate the stored model exists
			if (parsed.model && AVAILABLE_MODELS.some((m) => m.id === parsed.model)) {
				return { ...parsed, apiKey };
			}
		}
		return { ...DEFAULT_SETTINGS, apiKey };
	} catch {
		// Ignore parse errors
	}
	return DEFAULT_SETTINGS;
}

function saveSettings(settings: AISettings): void {
	if (!browser) return;
	// Save model settings (without API key - that's stored separately)
	const { apiKey: _, ...rest } = settings;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
}

function saveApiKey(apiKey: string | undefined): void {
	if (!browser) return;
	if (apiKey) {
		localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
	} else {
		localStorage.removeItem(API_KEY_STORAGE_KEY);
	}
}

function createAISettingsStore() {
	let settings = $state<AISettings>(loadSettings());
	let serverConfigured = $state<boolean | null>(null); // null = unknown

	// Check if server has API key configured
	async function checkServerConfig() {
		if (!browser) return;
		try {
			const response = await fetch('/api/ai-status');
			if (response.ok) {
				const data = await response.json();
				serverConfigured = data.configured;
			}
		} catch {
			serverConfigured = false;
		}
	}

	// Initialize server check
	if (browser) {
		checkServerConfig();
	}

	return {
		get model() {
			return settings.model;
		},
		get currentModel() {
			return AVAILABLE_MODELS.find((m) => m.id === settings.model) || AVAILABLE_MODELS[0];
		},
		get apiKey() {
			return settings.apiKey;
		},
		get hasApiKey() {
			return !!settings.apiKey;
		},
		get serverConfigured() {
			return serverConfigured;
		},
		get status(): AIStatus {
			if (serverConfigured) return 'configured';
			if (settings.apiKey) return 'client-key';
			return 'not-configured';
		},
		get isConfigured() {
			return serverConfigured || !!settings.apiKey;
		},
		get currentPreset(): PresetType | null {
			const preset = PRESETS.find((p) => p.modelId === settings.model);
			return preset?.type ?? null;
		},

		setPreset(presetType: PresetType) {
			const preset = PRESETS.find((p) => p.type === presetType);
			if (preset) {
				settings.model = preset.modelId;
				saveSettings(settings);
			}
		},

		setModel(modelId: string) {
			const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
			if (model) {
				settings.model = modelId;
				saveSettings(settings);
			}
		},

		setApiKey(apiKey: string | undefined) {
			settings.apiKey = apiKey?.trim() || undefined;
			saveApiKey(settings.apiKey);
		},

		clearApiKey() {
			settings.apiKey = undefined;
			saveApiKey(undefined);
		},

		// Get settings for API requests (includes API key if set)
		getRequestSettings(): { model: string; apiKey?: string } {
			return {
				model: settings.model,
				apiKey: settings.apiKey
			};
		},

		// Refresh server configuration status
		refreshServerStatus: checkServerConfig
	};
}

export const aiSettings = createAISettingsStore();
