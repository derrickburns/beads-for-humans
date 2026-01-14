import type { IssuePriority, IssueType } from './issue';

// Actions that can be performed on the graph through chat
export type GraphActionType =
	| 'create_issue'
	| 'update_status'
	| 'add_dependency'
	| 'remove_dependency'
	| 'assign_ai'
	| 'unassign_ai'
	| 'flag_human'
	| 'clear_human_flag';

export interface GraphAction {
	type: GraphActionType;
	issueId?: string;
	targetId?: string;
	data?: {
		title?: string;
		description?: string;
		priority?: IssuePriority;
		issueType?: IssueType;
		status?: string;
		modelId?: string;
		modelName?: string;
		reason?: string;
	};
	description: string; // Human-readable description of this action
}

// Chat message in the graph assistant
export interface GraphChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
	suggestedActions?: GraphAction[];
	executedActions?: GraphAction[];
}

// Suggestion for unblocking a blocked issue
export interface UnblockSuggestion {
	blockerId: string;
	blockerTitle: string;
	importance: number; // 0-1, calculated from downstream impact
	suggestion: string;
	quickActions: GraphAction[];
}

// Context passed to the graph chat API
export interface GraphChatContext {
	focusedIssueId: string | null;
	conversationHistory: { role: 'user' | 'assistant'; content: string }[];
}

// Response from the graph chat API
export interface GraphChatResponse {
	message: string;
	suggestedActions: GraphAction[];
	unblockSuggestion?: UnblockSuggestion;
}

// Common AI model identifiers and display names
export const AI_MODELS: Record<string, string> = {
	'anthropic/claude-sonnet-4': 'Claude Sonnet 4',
	'anthropic/claude-opus-4': 'Claude Opus 4',
	'openai/gpt-4o': 'GPT-4o',
	'openai/gpt-4o-mini': 'GPT-4o Mini',
	'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash'
};

// Get abbreviated model name for badges (2 chars)
export function getModelAbbrev(modelId: string): string {
	if (modelId.includes('claude')) return 'CL';
	if (modelId.includes('gpt')) return 'GP';
	if (modelId.includes('gemini')) return 'GE';
	return 'AI';
}

// Get provider color for model badges
export function getModelColor(modelId: string): { bg: string; text: string } {
	if (modelId.includes('anthropic') || modelId.includes('claude')) {
		return { bg: '#d97706', text: 'white' }; // Amber/orange for Anthropic
	}
	if (modelId.includes('openai') || modelId.includes('gpt')) {
		return { bg: '#059669', text: 'white' }; // Green for OpenAI
	}
	if (modelId.includes('google') || modelId.includes('gemini')) {
		return { bg: '#3b82f6', text: 'white' }; // Blue for Google
	}
	return { bg: '#6b7280', text: 'white' }; // Gray default
}
