import { browser } from '$app/environment';
import type {
	GraphChatMessage,
	GraphAction,
	GraphChatContext,
	GraphChatResponse,
	UnblockSuggestion
} from '$lib/types/graphChat';
import type { Issue } from '$lib/types/issue';
import { issueStore } from './issues.svelte';

function generateId(): string {
	return crypto.randomUUID();
}

class GraphChatStore {
	messages = $state<GraphChatMessage[]>([]);
	isLoading = $state(false);
	lastUnblockSuggestion = $state<UnblockSuggestion | null>(null);

	// Clear all messages
	clearChat() {
		this.messages = [];
		this.lastUnblockSuggestion = null;
	}

	// Add a user message
	addUserMessage(content: string): GraphChatMessage {
		const message: GraphChatMessage = {
			id: generateId(),
			role: 'user',
			content,
			timestamp: new Date().toISOString()
		};
		this.messages = [...this.messages, message];
		return message;
	}

	// Add an assistant message
	addAssistantMessage(
		content: string,
		suggestedActions?: GraphAction[],
		executedActions?: GraphAction[]
	): GraphChatMessage {
		const message: GraphChatMessage = {
			id: generateId(),
			role: 'assistant',
			content,
			timestamp: new Date().toISOString(),
			suggestedActions,
			executedActions
		};
		this.messages = [...this.messages, message];
		return message;
	}

	// Send message to AI and get response
	async sendMessage(content: string, focusedIssueId: string | null): Promise<void> {
		if (this.isLoading) return;

		this.addUserMessage(content);
		this.isLoading = true;

		try {
			const context: GraphChatContext = {
				focusedIssueId,
				conversationHistory: this.messages.slice(-10).map((m) => ({
					role: m.role,
					content: m.content
				}))
			};

			const response = await fetch('/api/graph-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: content,
					context,
					issues: issueStore.issues
				})
			});

			if (response.ok) {
				const data: GraphChatResponse = await response.json();
				this.addAssistantMessage(data.message, data.suggestedActions);
				if (data.unblockSuggestion) {
					this.lastUnblockSuggestion = data.unblockSuggestion;
				}
			} else {
				this.addAssistantMessage(
					"I'm having trouble processing that request. Please try again."
				);
			}
		} catch (error) {
			console.error('Graph chat error:', error);
			this.addAssistantMessage(
				"Something went wrong. Please check your connection and try again."
			);
		} finally {
			this.isLoading = false;
		}
	}

	// Execute a suggested action
	executeAction(action: GraphAction): { success: boolean; error?: string } {
		try {
			switch (action.type) {
				case 'create_issue':
					if (action.data?.title) {
						issueStore.create({
							title: action.data.title,
							description: action.data.description || '',
							priority: action.data.priority ?? 2,
							type: action.data.issueType ?? 'task'
						});
					}
					break;

				case 'update_status':
					if (action.issueId && action.data?.status) {
						issueStore.updateStatus(
							action.issueId,
							action.data.status as 'open' | 'in_progress' | 'closed'
						);
					}
					break;

				case 'add_dependency':
					if (action.issueId && action.targetId) {
						const result = issueStore.addDependency(action.issueId, action.targetId);
						if (result.error) {
							return { success: false, error: result.error };
						}
					}
					break;

				case 'remove_dependency':
					if (action.issueId && action.targetId) {
						issueStore.removeDependency(action.issueId, action.targetId);
					}
					break;

				case 'assign_ai':
					if (action.issueId && action.data?.modelId && action.data?.modelName) {
						issueStore.assignAI(
							action.issueId,
							action.data.modelId,
							action.data.modelName
						);
					}
					break;

				case 'unassign_ai':
					if (action.issueId) {
						issueStore.unassignAI(action.issueId);
					}
					break;

				case 'flag_human':
					if (action.issueId) {
						issueStore.flagNeedsHuman(
							action.issueId,
							'user_flagged',
							action.data?.reason || 'Flagged via chat'
						);
					}
					break;

				case 'clear_human_flag':
					if (action.issueId) {
						issueStore.clearNeedsHuman(action.issueId);
					}
					break;

				default:
					return { success: false, error: 'Unknown action type' };
			}

			return { success: true };
		} catch (error) {
			console.error('Action execution error:', error);
			return { success: false, error: String(error) };
		}
	}

	// Mark an action as executed in a message
	markActionExecuted(messageId: string, action: GraphAction) {
		this.messages = this.messages.map((m) => {
			if (m.id === messageId) {
				return {
					...m,
					suggestedActions: m.suggestedActions?.filter(
						(a) => a.description !== action.description
					),
					executedActions: [...(m.executedActions || []), action]
				};
			}
			return m;
		});
	}
}

export const graphChatStore = new GraphChatStore();
