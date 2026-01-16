<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';
	import type { Issue, IssueType, IssuePriority, DialogMessage as StoredDialogMessage } from '$lib/types/issue';

	interface Props {
		issue: Issue;
		onClose?: () => void;
	}

	let { issue, onClose }: Props = $props();

	interface DialogMessage {
		role: 'user' | 'assistant';
		content: string;
		actions?: SuggestedAction[];
		urlsReferenced?: string[];
		actionsApplied?: string[];
	}

	interface SuggestedAction {
		type: 'update_task' | 'create_subtask' | 'mark_complete' | 'add_dependency' | 'add_concern' | 'ask_question';
		description: string;
		applied?: boolean;
		data?: {
			title?: string;
			description?: string;
			type?: IssueType;
			priority?: IssuePriority;
			status?: string;
			concernType?: string;
			question?: string;
		};
	}

	// Load existing dialog history from the store - the AI's long-term memory
	function loadExistingHistory(): DialogMessage[] {
		const stored = issueStore.getDialogHistory(issue.id);
		return stored.map(m => ({
			role: m.role,
			content: m.content,
			urlsReferenced: m.urlsReferenced,
			actionsApplied: m.actionsApplied
		}));
	}

	let messages = $state<DialogMessage[]>(loadExistingHistory());
	let inputValue = $state('');
	let isLoading = $state(false);
	let messagesContainer = $state<HTMLDivElement | null>(null);

	// Quick starters based on task type
	const quickStarters = $derived(getQuickStarters(issue));

	function getQuickStarters(task: Issue): string[] {
		const starters: string[] = [];

		// Generic starters
		starters.push("Let me tell you what I have...");
		starters.push("Here's a link with details...");

		// Type-specific starters
		if (task.type === 'task') {
			starters.push("I've already done part of this");
			starters.push("This is more complex than I thought");
		} else if (task.type === 'question') {
			starters.push("I think the answer is...");
			starters.push("I need more context to decide");
		} else if (task.type === 'assumption') {
			starters.push("I've validated this");
			starters.push("This assumption may be wrong");
		}

		return starters;
	}

	// Extract URLs from text
	function extractUrls(text: string): string[] {
		const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
		return text.match(urlRegex) || [];
	}

	// Fetch content from a URL
	async function fetchUrlContent(url: string): Promise<{ url: string; content: string; error?: string }> {
		try {
			const response = await fetch('/api/fetch-url', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url })
			});
			const data = await response.json();
			return { url, content: data.content || '', error: data.error };
		} catch {
			return { url, content: '', error: 'Failed to fetch URL' };
		}
	}

	async function sendMessage(content: string) {
		if (!content.trim() || isLoading || !aiSettings.isConfigured) return;

		// Check for URLs and fetch their content
		const urls = extractUrls(content);
		let urlContents: Array<{ url: string; content: string }> = [];

		const userMessage: DialogMessage = {
			role: 'user',
			content: content.trim(),
			urlsReferenced: urls.length > 0 ? urls : undefined
		};
		messages = [...messages, userMessage];
		inputValue = '';
		isLoading = true;

		// Persist user message to store immediately - this is the AI's long-term memory
		issueStore.addDialogMessage(issue.id, {
			role: 'user',
			content: content.trim(),
			urlsReferenced: urls.length > 0 ? urls : undefined
		});

		// Scroll to bottom
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 50);

		if (urls.length > 0) {
			// Fetch URL content
			const fetchResults = await Promise.all(urls.slice(0, 3).map(fetchUrlContent));
			urlContents = fetchResults.filter(r => r.content && !r.error);
		}

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();

			// Build rich context for the AI
			const ancestors = issueStore.getAncestors(issue.id);
			const parent = issueStore.getParent(issue.id);
			const siblings = parent ? issueStore.getChildren(parent.id).filter(s => s.id !== issue.id) : [];
			const children = issueStore.getChildren(issue.id);
			const blockers = issueStore.getBlockers(issue.id);
			const blocking = issueStore.getBlocking(issue.id);
			const constraints = issueStore.getEffectiveConstraints(issue.id);
			const rootGoal = ancestors.length > 0 ? ancestors[ancestors.length - 1] : (issue.type === 'goal' ? issue : null);

			// Get dialog history from related issues - AI never forgets prior discussions
			const relatedDialogs = issueStore.getRelatedDialogContext(issue.id);

			const richContext = {
				// Hierarchy
				ancestors: ancestors.map(a => ({ id: a.id, title: a.title, type: a.type, status: a.status })),
				parent: parent ? { id: parent.id, title: parent.title, type: parent.type, decompositionType: parent.decompositionType } : null,
				siblings: siblings.map(s => ({ id: s.id, title: s.title, type: s.type, status: s.status })),
				children: children.map(c => ({ id: c.id, title: c.title, type: c.type, status: c.status })),

				// Dependencies
				blockedBy: blockers.map(b => ({ id: b.id, title: b.title, status: b.status })),
				blocks: blocking.map(b => ({ id: b.id, title: b.title, status: b.status })),

				// Constraints & Scope
				constraints: constraints.map(c => ({ type: c.type, description: c.description, value: c.value, unit: c.unit })),
				scopeBoundary: rootGoal?.scopeBoundary || null,
				successCriteria: issue.successCriteria || [],

				// Concerns already surfaced
				existingConcerns: (issue.concerns || []).map(c => ({ type: c.type, title: c.title, status: c.status })),

				// Project context (limited to relevant issues)
				projectIssues: issueStore.issues
					.filter(i => i.id !== issue.id)
					.slice(0, 15)
					.map(i => ({ id: i.id, title: i.title, type: i.type, status: i.status })),

				// Related dialog history - the AI's memory of discussions on related tasks
				relatedDialogs
			};

			const response = await fetch('/api/task-dialog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					task: issue,
					message: content.trim(),
					history: messages.filter(m => !m.actions).map(m => ({ role: m.role, content: m.content })),
					context: richContext,
					urlContents: urlContents.length > 0 ? urlContents : undefined,
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.error) {
				const errorMessage: DialogMessage = {
					role: 'assistant',
					content: `Sorry, I encountered an error: ${data.error}`
				};
				messages = [...messages, errorMessage];
				// Still persist error responses so we know what happened
				issueStore.addDialogMessage(issue.id, {
					role: 'assistant',
					content: errorMessage.content
				});
			} else {
				const assistantMessage: DialogMessage = {
					role: 'assistant',
					content: data.response,
					actions: data.actions
				};
				messages = [...messages, assistantMessage];
				// Persist assistant response - part of the permanent record
				issueStore.addDialogMessage(issue.id, {
					role: 'assistant',
					content: data.response
				});
			}
		} catch (error) {
			const errorMessage: DialogMessage = {
				role: 'assistant',
				content: 'Sorry, something went wrong. Please try again.'
			};
			messages = [...messages, errorMessage];
			issueStore.addDialogMessage(issue.id, {
				role: 'assistant',
				content: errorMessage.content
			});
		} finally {
			isLoading = false;
			// Scroll to bottom
			setTimeout(() => {
				if (messagesContainer) {
					messagesContainer.scrollTop = messagesContainer.scrollHeight;
				}
			}, 50);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage(inputValue);
		}
	}

	function applyAction(messageIndex: number, actionIndex: number) {
		const message = messages[messageIndex];
		if (!message?.actions) return;

		const action = message.actions[actionIndex];
		if (action.applied) return;

		switch (action.type) {
			case 'update_task':
				if (action.data?.title || action.data?.description) {
					issueStore.update(issue.id, {
						...(action.data.title && { title: action.data.title }),
						...(action.data.description && { description: action.data.description })
					});
				}
				break;

			case 'create_subtask':
				if (action.data?.title) {
					issueStore.createChild(issue.id, {
						title: action.data.title,
						description: action.data.description || '',
						type: action.data.type || 'task',
						priority: action.data.priority || issue.priority
					});
				}
				break;

			case 'mark_complete':
				issueStore.updateStatus(issue.id, 'closed');
				break;

			case 'add_concern':
				if (action.data?.title) {
					issueStore.addConcern(issue.id, {
						type: (action.data.concernType as 'assumption' | 'risk' | 'gap') || 'assumption',
						title: action.data.title,
						description: action.data.description || '',
						impact: 2,
						probability: 2,
						urgency: 2,
						tier: 3,
						relatedIssueIds: [],
						suggestedActions: [],
						userAware: true
					});
				}
				break;

			case 'ask_question':
				// Just highlight - the question is in the chat
				break;
		}

		// Mark as applied in local state
		messages = messages.map((m, i) => {
			if (i === messageIndex && m.actions) {
				return {
					...m,
					actions: m.actions.map((a, j) =>
						j === actionIndex ? { ...a, applied: true } : a
					)
				};
			}
			return m;
		});

		// Record the action in the persistent dialog history
		// This ensures the AI knows what actions were taken and never re-suggests them
		const actionDescription = `[Action Applied] ${action.type}: ${action.description}`;
		issueStore.addDialogMessage(issue.id, {
			role: 'assistant',
			content: actionDescription,
			actionsApplied: [action.description]
		});
	}

	const actionIcons: Record<string, string> = {
		update_task: '✏️',
		create_subtask: '➕',
		mark_complete: '✅',
		add_dependency: '🔗',
		add_concern: '⚠️',
		ask_question: '❓'
	};

	const actionLabels: Record<string, string> = {
		update_task: 'Update Task',
		create_subtask: 'Create Subtask',
		mark_complete: 'Mark Complete',
		add_dependency: 'Add Dependency',
		add_concern: 'Add Concern',
		ask_question: 'Question'
	};
</script>

<div class="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
	<!-- Header -->
	<div class="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
			</svg>
			<div>
				<h3 class="font-semibold text-gray-900 text-sm">Talk about this task</h3>
				<p class="text-xs text-gray-500 truncate max-w-[250px]">{issue.title}</p>
			</div>
		</div>
		{#if onClose}
			<button
				onclick={onClose}
				class="p-1 text-gray-400 hover:text-gray-600 rounded"
				aria-label="Close dialog"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- Messages -->
	<div
		bind:this={messagesContainer}
		class="flex-1 overflow-y-auto p-4 space-y-4"
	>
		{#if messages.length === 0}
			<!-- Empty state with quick starters -->
			<div class="text-center py-8">
				<div class="text-gray-400 mb-4">
					<svg class="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
					</svg>
				</div>
				<p class="text-sm text-gray-500 mb-4">
					Tell me about your situation and I'll help figure out what to do next.
				</p>
				<div class="flex flex-wrap gap-2 justify-center">
					{#each quickStarters as starter}
						<button
							onclick={() => sendMessage(starter)}
							class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
						>
							{starter}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			{#each messages as message, messageIndex}
				<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div class="max-w-[85%] {message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-2xl px-4 py-2">
						<p class="text-sm whitespace-pre-wrap">{message.content}</p>

						<!-- Suggested Actions -->
						{#if message.actions && message.actions.length > 0}
							<div class="mt-3 pt-3 border-t {message.role === 'user' ? 'border-blue-500' : 'border-gray-200'} space-y-2">
								{#each message.actions as action, actionIndex}
									{#if action.type !== 'ask_question'}
										<button
											onclick={() => applyAction(messageIndex, actionIndex)}
											disabled={action.applied}
											class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors
												{action.applied
													? 'bg-green-100 text-green-700 cursor-default'
													: message.role === 'user'
														? 'bg-blue-500 text-white hover:bg-blue-400'
														: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
												}"
										>
											<span>{action.applied ? '✓' : actionIcons[action.type]}</span>
											<span class="flex-1 text-left">
												{action.applied ? 'Applied: ' : ''}{action.description}
											</span>
										</button>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/each}

			{#if isLoading}
				<div class="flex justify-start">
					<div class="bg-gray-100 rounded-2xl px-4 py-3">
						<div class="flex items-center gap-1">
							<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
							<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
							<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Input -->
	<div class="p-4 border-t border-gray-100">
		{#if !aiSettings.isConfigured}
			<p class="text-sm text-amber-600 text-center">
				Configure AI in the top menu to use task dialog.
			</p>
		{:else}
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={inputValue}
					onkeydown={handleKeydown}
					placeholder="Share what you know or ask for help..."
					disabled={isLoading}
					class="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-50"
				/>
				<button
					onclick={() => sendMessage(inputValue)}
					disabled={!inputValue.trim() || isLoading}
					class="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					aria-label="Send message"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
				</button>
			</div>
		{/if}
	</div>
</div>
