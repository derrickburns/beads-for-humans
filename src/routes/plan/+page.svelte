<script lang="ts">
	import { goto } from '$app/navigation';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { PRIORITY_LABELS, TYPE_LABELS } from '$lib/types/issue';
	import type { IssueType, IssuePriority } from '$lib/types/issue';

	interface Message {
		role: 'user' | 'assistant';
		content: string;
		suggestion?: TaskSuggestion;
		relatedIssues?: RelatedIssue[];
		followUpQuestions?: string[];
		created?: boolean; // Was this suggestion accepted and created?
	}

	interface TaskSuggestion {
		title: string;
		description: string;
		type: IssueType;
		priority: IssuePriority;
		dependsOn: string[];
		confidence: number;
	}

	interface RelatedIssue {
		id: string;
		title: string;
		similarity: string;
	}

	let messages = $state<Message[]>([]);
	let inputText = $state('');
	let loading = $state(false);
	let createdInSession = $state<string[]>([]);

	// Start with a welcome message
	$effect(() => {
		if (messages.length === 0) {
			messages = [{
				role: 'assistant',
				content: 'Hi! I\'m your planning assistant. Tell me what you\'re working on, and I\'ll help you break it down into clear, actionable tasks.\n\nDescribe your project, goal, or the work you need to plan.',
				followUpQuestions: ['I need to build a new feature', 'I have a bug to fix', 'I want to plan a project']
			}];
		}
	});

	async function sendMessage(text: string) {
		if (!text.trim() || loading) return;

		// Add user message
		messages = [...messages, { role: 'user', content: text }];
		inputText = '';
		loading = true;

		try {
			const response = await fetch('/api/plan-assistant', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: messages.map(m => ({ role: m.role, content: m.content })),
					existingIssues: issueStore.issues,
					createdInSession
				})
			});

			const data = await response.json();

			if (data.error) {
				messages = [...messages, {
					role: 'assistant',
					content: `Sorry, I encountered an error: ${data.error}`,
					followUpQuestions: ['Try again', 'Start over']
				}];
			} else if (data.response) {
				const resp = data.response;
				messages = [...messages, {
					role: 'assistant',
					content: resp.message,
					suggestion: resp.suggestion,
					relatedIssues: resp.relatedIssues,
					followUpQuestions: resp.followUpQuestions
				}];
			}
		} catch (e) {
			messages = [...messages, {
				role: 'assistant',
				content: 'Sorry, something went wrong. Please try again.',
				followUpQuestions: ['Try again']
			}];
		} finally {
			loading = false;
			// Scroll to bottom
			setTimeout(() => {
				const container = document.getElementById('chat-container');
				if (container) container.scrollTop = container.scrollHeight;
			}, 100);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage(inputText);
		}
	}

	function acceptSuggestion(messageIndex: number) {
		const msg = messages[messageIndex];
		if (!msg.suggestion) return;

		// Create the issue
		const created = issueStore.create({
			title: msg.suggestion.title,
			description: msg.suggestion.description,
			type: msg.suggestion.type,
			priority: msg.suggestion.priority,
			dependencies: msg.suggestion.dependsOn
		});

		if (created) {
			// Mark as created
			messages = messages.map((m, i) =>
				i === messageIndex ? { ...m, created: true } : m
			);
			createdInSession = [...createdInSession, msg.suggestion.title];

			// Send confirmation
			sendMessage('Done, I accepted that task. What\'s next?');
		}
	}

	function skipSuggestion() {
		sendMessage('Skip this one, suggest something else.');
	}

	function modifySuggestion(messageIndex: number) {
		const msg = messages[messageIndex];
		if (!msg.suggestion) return;
		inputText = `I want to modify this: "${msg.suggestion.title}" - `;
	}

	const priorityColors: Record<number, string> = {
		0: 'bg-red-100 text-red-800 border-red-200',
		1: 'bg-orange-100 text-orange-800 border-orange-200',
		2: 'bg-yellow-100 text-yellow-800 border-yellow-200',
		3: 'bg-blue-100 text-blue-800 border-blue-200',
		4: 'bg-gray-100 text-gray-600 border-gray-200'
	};
</script>

<svelte:head>
	<title>Planning Assistant</title>
</svelte:head>

<div class="max-w-3xl mx-auto flex flex-col h-[calc(100vh-12rem)]">
	<div class="mb-4">
		<a href="/" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Issues
		</a>
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Planning Assistant</h1>
				<p class="text-gray-500 text-sm">Interactive task planning with AI guidance</p>
			</div>
			{#if createdInSession.length > 0}
				<span class="text-sm text-green-600 font-medium">
					{createdInSession.length} task{createdInSession.length === 1 ? '' : 's'} created
				</span>
			{/if}
		</div>
	</div>

	<!-- Chat Container -->
	<div
		id="chat-container"
		class="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-4 space-y-4"
	>
		{#each messages as msg, i}
			<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
				<div class="max-w-[85%] {msg.role === 'user'
					? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3'
					: 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-3'}">

					<!-- Message content -->
					<p class="whitespace-pre-wrap">{msg.content}</p>

					<!-- Task Suggestion Card -->
					{#if msg.suggestion && msg.role === 'assistant'}
						<div class="mt-3 p-4 bg-white rounded-xl border {msg.created ? 'border-green-300 bg-green-50' : 'border-gray-200'} shadow-sm">
							{#if msg.created}
								<div class="flex items-center gap-2 text-green-600 mb-2">
									<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									<span class="text-sm font-medium">Created!</span>
								</div>
							{/if}
							<div class="flex items-center gap-2 mb-2">
								<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
									{TYPE_LABELS[msg.suggestion.type]}
								</span>
								<span class="text-xs font-medium px-2 py-0.5 rounded-full {priorityColors[msg.suggestion.priority]}">
									{PRIORITY_LABELS[msg.suggestion.priority]}
								</span>
								<span class="text-xs text-gray-400">
									{Math.round(msg.suggestion.confidence * 100)}% confident
								</span>
							</div>
							<h4 class="font-semibold text-gray-900">{msg.suggestion.title}</h4>
							{#if msg.suggestion.description}
								<p class="text-sm text-gray-600 mt-1">{msg.suggestion.description}</p>
							{/if}
							{#if msg.suggestion.dependsOn.length > 0}
								<div class="mt-2 flex items-center gap-2 flex-wrap">
									<span class="text-xs text-gray-500">Depends on:</span>
									{#each msg.suggestion.dependsOn as depId}
										{@const dep = issueStore.getById(depId)}
										{#if dep}
											<span class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
												{dep.title}
											</span>
										{/if}
									{/each}
								</div>
							{/if}

							{#if !msg.created}
								<div class="mt-3 flex items-center gap-2">
									<button
										onclick={() => acceptSuggestion(i)}
										class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
									>
										Accept
									</button>
									<button
										onclick={() => modifySuggestion(i)}
										class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
									>
										Modify
									</button>
									<button
										onclick={skipSuggestion}
										class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
									>
										Skip
									</button>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Related Issues -->
					{#if msg.relatedIssues && msg.relatedIssues.length > 0}
						<div class="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
							<p class="text-xs font-medium text-blue-800 mb-2">Related existing issues:</p>
							<div class="space-y-1">
								{#each msg.relatedIssues as related}
									<a
										href="/issue/{related.id}"
										class="block text-sm text-blue-600 hover:text-blue-800"
									>
										• {related.title}
										<span class="text-blue-400">- {related.similarity}</span>
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Quick Response Buttons -->
					{#if msg.followUpQuestions && msg.followUpQuestions.length > 0 && i === messages.length - 1 && msg.role === 'assistant'}
						<div class="mt-3 flex flex-wrap gap-2">
							{#each msg.followUpQuestions as question}
								<button
									onclick={() => sendMessage(question)}
									disabled={loading}
									class="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
								>
									{question}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/each}

		{#if loading}
			<div class="flex justify-start">
				<div class="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
					<div class="flex items-center gap-2 text-gray-500">
						<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
						<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
						<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input Area -->
	<div class="mt-4 bg-white rounded-xl border border-gray-200 p-3">
		<div class="flex items-end gap-3">
			<textarea
				bind:value={inputText}
				onkeydown={handleKeydown}
				placeholder="Describe what you need to do..."
				rows="2"
				disabled={loading}
				class="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none disabled:opacity-50"
			></textarea>
			<button
				onclick={() => sendMessage(inputText)}
				disabled={loading || !inputText.trim()}
				class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{#if loading}
					<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
				{:else}
					Send
				{/if}
			</button>
		</div>
		<p class="text-xs text-gray-400 mt-2">Press Enter to send, Shift+Enter for new line</p>
	</div>
</div>
