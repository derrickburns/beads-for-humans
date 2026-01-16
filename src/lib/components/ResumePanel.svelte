<script lang="ts">
	import { sessionState } from '$lib/stores/sessionState.svelte';
	import { issueStore } from '$lib/stores/issues.svelte';
	import type { Issue } from '$lib/types/issue';

	interface Props {
		onSelectTask?: (taskId: string) => void;
		onDismiss?: () => void;
	}

	let { onSelectTask, onDismiss }: Props = $props();

	// Get the last task if it still exists
	const lastTask = $derived(
		sessionState.lastTaskId ? issueStore.getById(sessionState.lastTaskId) : null
	);

	// Get prioritized work queue - what needs human attention
	const prioritizedWork = $derived(getPrioritizedWork());

	function getPrioritizedWork(): Array<{
		issue: Issue;
		reason: string;
		urgency: 'high' | 'medium' | 'low';
	}> {
		const work: Array<{
			issue: Issue;
			reason: string;
			urgency: 'high' | 'medium' | 'low';
		}> = [];

		// 1. Tasks flagged as needing human attention
		const needsHuman = issueStore.issues.filter(i => i.needsHuman && i.status !== 'closed');
		for (const issue of needsHuman) {
			work.push({
				issue,
				reason: issue.needsHuman?.reason || 'Needs your input',
				urgency: 'high'
			});
		}

		// 2. Tasks that are in_progress and have pending questions
		const pendingQuestionTaskIds = new Set(sessionState.pendingQuestions.map(q => q.taskId));
		for (const taskId of pendingQuestionTaskIds) {
			const issue = issueStore.getById(taskId);
			if (issue && issue.status !== 'closed' && !needsHuman.includes(issue)) {
				const questions = sessionState.getPendingQuestionsForTask(taskId);
				work.push({
					issue,
					reason: `Waiting for: ${questions[0]?.question || 'your response'}`,
					urgency: 'high'
				});
			}
		}

		// 3. High priority open tasks (P0, P1)
		const highPriority = issueStore.issues.filter(
			i => i.status === 'open' && i.priority <= 1 && !work.some(w => w.issue.id === i.id)
		);
		for (const issue of highPriority) {
			work.push({
				issue,
				reason: `Priority ${issue.priority} - ready to start`,
				urgency: issue.priority === 0 ? 'high' : 'medium'
			});
		}

		// 4. Tasks that are in_progress but stale (no recent dialog)
		const inProgress = issueStore.issues.filter(
			i => i.status === 'in_progress' && !work.some(w => w.issue.id === i.id)
		);
		for (const issue of inProgress) {
			const lastMessage = issue.dialogHistory?.[issue.dialogHistory.length - 1];
			const isStale = !lastMessage ||
				(Date.now() - new Date(lastMessage.timestamp).getTime() > 24 * 60 * 60 * 1000);

			if (isStale) {
				work.push({
					issue,
					reason: 'In progress - needs continuation',
					urgency: 'medium'
				});
			}
		}

		// Sort by urgency, then priority
		return work.sort((a, b) => {
			const urgencyOrder = { high: 0, medium: 1, low: 2 };
			if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
				return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
			}
			return a.issue.priority - b.issue.priority;
		}).slice(0, 5); // Top 5
	}

	// Generate AI greeting based on context
	const greeting = $derived(generateGreeting());

	function generateGreeting(): string {
		const timeSince = sessionState.getTimeSinceLastInteraction();
		const lastDisplay = sessionState.getLastInteractionDisplay();

		if (!timeSince) {
			return "Let's get started. I'll help you organize and track what needs to be done.";
		}

		const hours = timeSince / (1000 * 60 * 60);

		if (hours < 1) {
			return "Back already? Let's continue where we left off.";
		} else if (hours < 24) {
			return `Welcome back! You were last here ${lastDisplay}.`;
		} else if (hours < 72) {
			return `Good to see you again! It's been ${lastDisplay}. Let me catch you up.`;
		} else {
			return `Welcome back! It's been ${lastDisplay}. Here's what needs your attention.`;
		}
	}

	// Get context about what user was doing
	const lastContext = $derived(getLastContext());

	function getLastContext(): string | null {
		if (!lastTask) return null;

		const lastMessage = lastTask.dialogHistory?.[lastTask.dialogHistory.length - 1];
		if (!lastMessage) {
			return `You were looking at "${lastTask.title}" but hadn't started the conversation yet.`;
		}

		if (lastMessage.role === 'assistant') {
			// AI was waiting for response
			const preview = lastMessage.content.length > 150
				? lastMessage.content.substring(0, 150) + '...'
				: lastMessage.content;
			return `On "${lastTask.title}", I had asked: "${preview}"`;
		} else {
			// User had just said something
			const preview = lastMessage.content.length > 100
				? lastMessage.content.substring(0, 100) + '...'
				: lastMessage.content;
			return `On "${lastTask.title}", you said: "${preview}"`;
		}
	}

	function handleSelectTask(taskId: string) {
		onSelectTask?.(taskId);
	}

	const urgencyColors = {
		high: 'bg-red-50 border-red-200 text-red-800',
		medium: 'bg-amber-50 border-amber-200 text-amber-800',
		low: 'bg-blue-50 border-blue-200 text-blue-800'
	};

	const urgencyBadge = {
		high: 'bg-red-100 text-red-700',
		medium: 'bg-amber-100 text-amber-700',
		low: 'bg-blue-100 text-blue-700'
	};
</script>

<div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 shadow-sm">
	<!-- AI Greeting -->
	<div class="flex items-start gap-4 mb-6">
		<div class="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
			<svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
			</svg>
		</div>
		<div>
			<p class="text-lg font-medium text-gray-900">{greeting}</p>
			{#if lastContext}
				<p class="text-sm text-gray-600 mt-1">{lastContext}</p>
			{/if}
		</div>
	</div>

	<!-- Continue Last Task Button -->
	{#if lastTask && lastTask.status !== 'closed'}
		<button
			onclick={() => handleSelectTask(lastTask.id)}
			class="w-full mb-4 p-4 bg-white rounded-lg border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
		>
			<div class="flex items-center justify-between">
				<div>
					<span class="text-xs font-medium text-blue-600 uppercase tracking-wide">Continue where you left off</span>
					<p class="font-medium text-gray-900 mt-1">{lastTask.title}</p>
				</div>
				<svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</div>
		</button>
	{/if}

	<!-- Pending Questions -->
	{#if sessionState.hasPendingQuestions}
		<div class="mb-4">
			<h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
				<svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				I'm waiting for answers to:
			</h3>
			<div class="space-y-2">
				{#each sessionState.pendingQuestions.slice(0, 3) as pq}
					<button
						onclick={() => handleSelectTask(pq.taskId)}
						class="w-full p-3 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors text-left"
					>
						<p class="text-sm font-medium text-amber-800">{pq.question}</p>
						<p class="text-xs text-amber-600 mt-1">On: {pq.taskTitle}</p>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Prioritized Work Queue -->
	{#if prioritizedWork.length > 0}
		<div>
			<h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
				<svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
				What needs attention
			</h3>
			<div class="space-y-2">
				{#each prioritizedWork as item}
					<button
						onclick={() => handleSelectTask(item.issue.id)}
						class="w-full p-3 rounded-lg border transition-colors text-left {urgencyColors[item.urgency]} hover:opacity-90"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="flex-1 min-w-0">
								<p class="font-medium truncate">{item.issue.title}</p>
								<p class="text-xs mt-0.5 opacity-80">{item.reason}</p>
							</div>
							<span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0 {urgencyBadge[item.urgency]}">
								P{item.issue.priority}
							</span>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="text-center py-4 text-gray-500">
			<p class="text-sm">No urgent items right now. Great job staying on top of things!</p>
		</div>
	{/if}

	<!-- Dismiss -->
	{#if onDismiss}
		<button
			onclick={onDismiss}
			class="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
		>
			Show full dashboard
		</button>
	{/if}
</div>
