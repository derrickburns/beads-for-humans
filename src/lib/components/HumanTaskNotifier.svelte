<script lang="ts">
	import { browser } from '$app/environment';
	import { issueStore } from '$lib/stores/issues.svelte';

	// Track which task IDs we've already notified about
	const NOTIFIED_KEY = 'human-tasks-notified';

	function getNotifiedTasks(): Set<string> {
		if (!browser) return new Set();
		try {
			const stored = localStorage.getItem(NOTIFIED_KEY);
			return stored ? new Set(JSON.parse(stored)) : new Set();
		} catch {
			return new Set();
		}
	}

	function markNotified(taskId: string) {
		if (!browser) return;
		const notified = getNotifiedTasks();
		notified.add(taskId);
		localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]));
		notifiedTasks = notified;
	}

	function clearNotified(taskId: string) {
		if (!browser) return;
		const notified = getNotifiedTasks();
		notified.delete(taskId);
		localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]));
		notifiedTasks = notified;
	}

	let notifiedTasks = $state(getNotifiedTasks());
	let notificationPermission = $state<NotificationPermission>(
		browser ? Notification.permission : 'default'
	);
	let dismissed = $state(false);

	// Get ready human tasks that haven't been notified
	let readyHumanTasks = $derived(issueStore.readyHumanTasks);
	let unnotifiedTasks = $derived(
		readyHumanTasks.filter((t) => !notifiedTasks.has(t.id))
	);

	// Get prioritized task info if available
	let nextHumanTask = $derived.by(() => {
		const prioritized = issueStore.getPrioritizedReady();
		const humanPrioritized = prioritized.filter(
			(p) => p.issue.executionType === 'human' && !notifiedTasks.has(p.issue.id)
		);
		return humanPrioritized[0] || null;
	});

	// Request notification permission
	async function requestPermission() {
		if (!browser || !('Notification' in window)) return;
		const permission = await Notification.requestPermission();
		notificationPermission = permission;
	}

	// Send browser notification for new human tasks
	$effect(() => {
		if (!browser || notificationPermission !== 'granted') return;
		if (unnotifiedTasks.length === 0) return;

		// Only notify for the first unnotified task
		const task = unnotifiedTasks[0];
		if (!task) return;

		const notification = new Notification('Task needs your attention', {
			body: task.title,
			icon: '/favicon.png',
			tag: task.id // Prevent duplicate notifications for same task
		});

		notification.onclick = () => {
			window.focus();
			window.location.href = `/issue/${task.id}`;
		};

		markNotified(task.id);
	});

	function dismissBanner() {
		// Mark all current tasks as notified when dismissing
		for (const task of unnotifiedTasks) {
			markNotified(task.id);
		}
		dismissed = true;
	}

	function viewTask(taskId: string) {
		markNotified(taskId);
		window.location.href = `/issue/${taskId}`;
	}
</script>

{#if readyHumanTasks.length > 0 && !dismissed}
	<div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-lg px-4 py-3 shadow-sm">
		<div class="flex items-start gap-3">
			<!-- Icon with pulse animation -->
			<div class="relative flex-shrink-0">
				<div class="text-amber-600">
					<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
					</svg>
				</div>
				{#if unnotifiedTasks.length > 0}
					<span class="absolute -top-1 -right-1 flex h-3 w-3">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
					</span>
				{/if}
			</div>

			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2 mb-1">
					<h3 class="text-sm font-semibold text-amber-900">
						{readyHumanTasks.length === 1 ? 'Task needs you' : `${readyHumanTasks.length} tasks need you`}
					</h3>
					{#if notificationPermission === 'default'}
						<button
							onclick={requestPermission}
							class="text-xs text-amber-700 hover:text-amber-800 underline"
						>
							Enable notifications
						</button>
					{/if}
				</div>

				{#if nextHumanTask}
					<p class="text-sm text-amber-800 mb-2">
						<span class="font-medium">Best to do now:</span> {nextHumanTask.issue.title}
						{#if nextHumanTask.reasons.length > 0}
							<span class="text-amber-600">— {nextHumanTask.reasons[0]}</span>
						{/if}
					</p>
					<div class="flex items-center gap-2">
						<button
							onclick={() => viewTask(nextHumanTask!.issue.id)}
							class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
						>
							View Task
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						</button>
						{#if readyHumanTasks.length > 1}
							<a
								href="/?filter=human"
								class="text-sm text-amber-700 hover:text-amber-800"
							>
								See all {readyHumanTasks.length}
							</a>
						{/if}
					</div>
				{:else if readyHumanTasks.length > 0}
					<ul class="text-sm text-amber-800 space-y-1">
						{#each readyHumanTasks.slice(0, 3) as task}
							<li class="flex items-center gap-2">
								<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
								<a
									href="/issue/{task.id}"
									onclick={() => markNotified(task.id)}
									class="hover:underline truncate"
								>
									{task.title}
								</a>
							</li>
						{/each}
						{#if readyHumanTasks.length > 3}
							<li class="text-amber-600 text-xs">
								+{readyHumanTasks.length - 3} more
							</li>
						{/if}
					</ul>
				{/if}
			</div>

			<button
				onclick={dismissBanner}
				class="text-amber-500 hover:text-amber-700 p-1 flex-shrink-0"
				aria-label="Dismiss"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
{/if}
