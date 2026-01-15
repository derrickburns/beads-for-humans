<script lang="ts">
	import { browser } from '$app/environment';
	import { issueStore } from '$lib/stores/issues.svelte';

	interface Tip {
		id: string;
		message: string;
		action?: { label: string; href?: string; onclick?: () => void };
		priority: number; // Lower = higher priority
	}

	// Track dismissed tips in localStorage
	const DISMISSED_KEY = 'dismissed-tips';

	function getDismissedTips(): Set<string> {
		if (!browser) return new Set();
		try {
			const stored = localStorage.getItem(DISMISSED_KEY);
			return stored ? new Set(JSON.parse(stored)) : new Set();
		} catch {
			return new Set();
		}
	}

	function dismissTip(tipId: string) {
		if (!browser) return;
		const dismissed = getDismissedTips();
		dismissed.add(tipId);
		localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
		dismissedTips = dismissed;
	}

	let dismissedTips = $state(getDismissedTips());

	// Compute the current tip based on app state
	let currentTip = $derived.by(() => {
		const tips: Tip[] = [];
		const issues = issueStore.issues;
		const openIssues = issues.filter(i => i.status !== 'closed');
		const blockedIssues = issueStore.blocked;
		const readyIssues = issueStore.ready;

		// First task created - suggest adding dependencies
		if (openIssues.length === 1 && openIssues[0].dependencies.length === 0) {
			tips.push({
				id: 'first-task-deps',
				message: "Great start! Does this task need anything else done first? Click it to add dependencies.",
				priority: 1
			});
		}

		// 3+ tasks without many dependencies - suggest AI help
		const issuesWithDeps = openIssues.filter(i => i.dependencies.length > 0);
		if (openIssues.length >= 3 && issuesWithDeps.length < 2) {
			tips.push({
				id: 'ai-organize',
				message: "You have several tasks now. Want AI to help figure out what order to do them?",
				action: { label: "Open Task Order", href: "javascript:void(0)" },
				priority: 2
			});
		}

		// Graph getting complex (many issues)
		if (openIssues.length >= 8) {
			tips.push({
				id: 'complex-graph',
				message: "Your plan is getting detailed! The List view might be easier to scan.",
				priority: 3
			});
		}

		// Ready issues available - use dependency-weighted priority
		if (readyIssues.length > 0) {
			const nextTask = issueStore.getNextTask();
			if (nextTask) {
				const title = nextTask.issue.title.slice(0, 40) + (nextTask.issue.title.length > 40 ? '...' : '');
				const reason = nextTask.reasons.length > 0 ? nextTask.reasons[0] : 'Ready to start';
				tips.push({
					id: 'best-next-task',
					message: `Best next task: "${title}" — ${reason}`,
					action: { label: "View Task", href: `/issue/${nextTask.issue.id}` },
					priority: 1
				});
			}
		}

		// Everything blocked
		if (openIssues.length > 0 && readyIssues.length === 0 && blockedIssues.length === openIssues.length) {
			tips.push({
				id: 'all-blocked',
				message: "All your tasks are waiting on something. Check if any blockers can be started.",
				priority: 1
			});
		}

		// No tasks yet
		if (issues.length === 0) {
			tips.push({
				id: 'no-tasks',
				message: "Ready to plan a project? Let AI help you break it down into clear steps, or just add tasks manually.",
				action: { label: "Plan a Project", href: "/plan" },
				priority: 0
			});
		}

		// Filter out dismissed tips and return highest priority
		const activeTips = tips.filter(t => !dismissedTips.has(t.id));
		if (activeTips.length === 0) return null;

		return activeTips.sort((a, b) => a.priority - b.priority)[0];
	});
</script>

{#if currentTip}
	<div class="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg px-4 py-3 flex items-start gap-3">
		<div class="text-purple-600 mt-0.5">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>
		</div>
		<div class="flex-1 min-w-0">
			<p class="text-sm text-gray-700">{currentTip.message}</p>
			{#if currentTip.action}
				{#if currentTip.action.href}
					<a
						href={currentTip.action.href}
						class="inline-block mt-1 text-sm font-medium text-purple-600 hover:text-purple-700"
					>
						{currentTip.action.label} →
					</a>
				{:else if currentTip.action.onclick}
					<button
						onclick={currentTip.action.onclick}
						class="mt-1 text-sm font-medium text-purple-600 hover:text-purple-700"
					>
						{currentTip.action.label} →
					</button>
				{/if}
			{/if}
		</div>
		<button
			onclick={() => dismissTip(currentTip!.id)}
			class="text-gray-400 hover:text-gray-600 p-1"
			aria-label="Dismiss tip"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>
{/if}
