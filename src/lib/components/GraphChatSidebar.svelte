<script lang="ts">
	import { graphChatStore } from '$lib/stores/graphChat.svelte';
	import { issueStore } from '$lib/stores/issues.svelte';
	import type { GraphAction } from '$lib/types/graphChat';

	interface Props {
		focusedIssueId: string | null;
		isOpen: boolean;
		onClose: () => void;
	}

	let { focusedIssueId, isOpen, onClose }: Props = $props();

	let inputText = $state('');
	let messagesContainer: HTMLDivElement | null = $state(null);

	// Auto-scroll to bottom when messages change
	$effect(() => {
		if (messagesContainer && graphChatStore.messages.length > 0) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	});

	// Get focused issue details
	let focusedIssue = $derived(focusedIssueId ? issueStore.getById(focusedIssueId) : null);

	// Get most important blocker for focused issue
	let importantBlocker = $derived(
		focusedIssueId ? issueStore.getMostImportantBlocker(focusedIssueId) : null
	);

	async function handleSend() {
		const text = inputText.trim();
		if (!text || graphChatStore.isLoading) return;

		inputText = '';
		await graphChatStore.sendMessage(text, focusedIssueId);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function executeAction(messageId: string, action: GraphAction) {
		const result = graphChatStore.executeAction(action);
		if (result.success) {
			graphChatStore.markActionExecuted(messageId, action);
		}
	}

	function getActionIcon(type: GraphAction['type']): string {
		switch (type) {
			case 'create_issue': return 'M12 4v16m8-8H4';
			case 'update_status': return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
			case 'add_dependency': return 'M13 7l5 5m0 0l-5 5m5-5H6';
			case 'remove_dependency': return 'M6 18L18 6M6 6l12 12';
			case 'assign_ai': return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
			case 'flag_human': return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
			default: return 'M13 10V3L4 14h7v7l9-11h-7z';
		}
	}

	// Quick prompts for common actions
	const quickPrompts = [
		{ label: 'What next?', prompt: 'What should I work on to unblock the most tasks?' },
		{ label: 'Analyze plan', prompt: 'Analyze my task order and suggest improvements' },
		{ label: 'Top priority', prompt: 'What is the highest priority task I should work on?' }
	];
</script>

{#if isOpen}
	<aside
		class="w-[400px] border-l border-gray-200 bg-gray-50 flex flex-col h-full shadow-lg"
		role="complementary"
		aria-label="Graph Assistant Chat"
	>
		<!-- Header -->
		<div class="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
			<div>
				<h3 class="font-semibold text-gray-900 flex items-center gap-2">
					<svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
					</svg>
					Graph Assistant
				</h3>
				{#if focusedIssue}
					<p class="text-sm text-gray-500 mt-0.5 truncate">
						Focused: {focusedIssue.title}
					</p>
				{/if}
			</div>
			<button
				onclick={onClose}
				class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
				aria-label="Close chat"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Do This First Card (if applicable) -->
		{#if importantBlocker && focusedIssue?.status !== 'closed'}
			<div class="p-4 bg-amber-50 border-b border-amber-200">
				<div class="flex items-start gap-3">
					<div class="p-2 bg-amber-100 rounded-lg">
						<svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-sm font-medium text-amber-900">Do This First</p>
						<p class="text-sm text-amber-800 truncate mt-0.5">{importantBlocker.blocker.title}</p>
						<div class="flex items-center gap-2 mt-2">
							<div class="text-xs text-amber-600">
								Impact: {Math.round(importantBlocker.importance * 100)}%
							</div>
							<button
								onclick={() => {
									inputText = `Help me resolve "${importantBlocker.blocker.title}"`;
									handleSend();
								}}
								class="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
							>
								Get help
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Messages -->
		<div
			bind:this={messagesContainer}
			class="flex-1 overflow-y-auto p-4 space-y-4"
		>
			{#if graphChatStore.messages.length === 0}
				<div class="text-center py-8">
					<div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
						<svg class="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
					</div>
					<p class="text-sm text-gray-600 mb-4">
						Ask me to help with your planning
					</p>
					<div class="flex flex-wrap justify-center gap-2">
						{#each quickPrompts as qp}
							<button
								onclick={() => { inputText = qp.prompt; handleSend(); }}
								class="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-full hover:bg-purple-200 transition-colors"
							>
								{qp.label}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				{#each graphChatStore.messages as message (message.id)}
					<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[85%] rounded-2xl px-4 py-2.5 {message.role === 'user'
								? 'bg-blue-600 text-white'
								: 'bg-white border border-gray-200 text-gray-900 shadow-sm'}"
						>
							<p class="text-sm whitespace-pre-wrap">{message.content}</p>

							<!-- Suggested Actions -->
							{#if message.suggestedActions && message.suggestedActions.length > 0}
								<div class="mt-3 space-y-2">
									{#each message.suggestedActions as action}
										<button
											onclick={() => executeAction(message.id, action)}
											class="w-full flex items-center gap-2 p-2 text-left text-sm bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
										>
											<svg class="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getActionIcon(action.type)} />
											</svg>
											<span class="text-purple-900 flex-1">{action.description}</span>
											<svg class="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
											</svg>
										</button>
									{/each}
								</div>
							{/if}

							<!-- Executed Actions -->
							{#if message.executedActions && message.executedActions.length > 0}
								<div class="mt-3 space-y-1">
									{#each message.executedActions as action}
										<div class="flex items-center gap-2 text-xs text-green-600">
											<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											<span class="line-through opacity-70">{action.description}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}

				<!-- Loading indicator -->
				{#if graphChatStore.isLoading}
					<div class="flex justify-start">
						<div class="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm">
							<div class="flex items-center gap-1">
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Input -->
		<div class="p-4 bg-white border-t border-gray-200">
			<!-- Quick prompts row (shown when no messages) -->
			{#if graphChatStore.messages.length > 0}
				<div class="flex flex-wrap gap-1 mb-3">
					{#each quickPrompts as qp}
						<button
							onclick={() => { inputText = qp.prompt; }}
							class="px-2 py-1 text-xs text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
						>
							{qp.label}
						</button>
					{/each}
				</div>
			{/if}

			<div class="flex items-end gap-2">
				<textarea
					bind:value={inputText}
					onkeydown={handleKeyDown}
					placeholder="Ask about your tasks..."
					rows="1"
					class="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
					disabled={graphChatStore.isLoading}
				></textarea>
				<button
					onclick={handleSend}
					disabled={!inputText.trim() || graphChatStore.isLoading}
					class="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					aria-label="Send message"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
				</button>
			</div>
		</div>
	</aside>
{/if}
