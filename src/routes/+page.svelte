<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import IssueCard from '$lib/components/IssueCard.svelte';
	import type { IssueStatus } from '$lib/types/issue';

	let filter = $state<'all' | 'ready' | 'blocked'>('all');
	let statusFilter = $state<IssueStatus | 'all'>('all');

	let filteredIssues = $derived.by(() => {
		let issues = issueStore.issues;

		// Filter by ready/blocked
		if (filter === 'ready') {
			issues = issueStore.ready;
		} else if (filter === 'blocked') {
			issues = issueStore.blocked;
		}

		// Filter by status
		if (statusFilter !== 'all') {
			issues = issues.filter((i) => i.status === statusFilter);
		}

		// Sort by priority (lower = higher priority), then by created date
		return issues.sort((a, b) => {
			if (a.status === 'closed' && b.status !== 'closed') return 1;
			if (a.status !== 'closed' && b.status === 'closed') return -1;
			if (a.priority !== b.priority) return a.priority - b.priority;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	});

	let counts = $derived({
		all: issueStore.issues.filter((i) => i.status !== 'closed').length,
		ready: issueStore.ready.length,
		blocked: issueStore.blocked.length,
		open: issueStore.byStatus.open.length,
		in_progress: issueStore.byStatus.in_progress.length,
		closed: issueStore.byStatus.closed.length
	});
</script>

<div class="space-y-6">
	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
			<button
				onclick={() => (filter = 'all')}
				class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter === 'all'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-600 hover:text-gray-900'}"
			>
				All ({counts.all})
			</button>
			<button
				onclick={() => (filter = 'ready')}
				class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter === 'ready'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-600 hover:text-gray-900'}"
			>
				Ready ({counts.ready})
			</button>
			<button
				onclick={() => (filter = 'blocked')}
				class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter === 'blocked'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-600 hover:text-gray-900'}"
			>
				Blocked ({counts.blocked})
			</button>
		</div>

		<div class="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
			<button
				onclick={() => (statusFilter = 'all')}
				class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {statusFilter === 'all'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-600 hover:text-gray-900'}"
			>
				Any Status
			</button>
			<button
				onclick={() => (statusFilter = 'open')}
				class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {statusFilter === 'open'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-600 hover:text-gray-900'}"
			>
				Open ({counts.open})
			</button>
			<button
				onclick={() => (statusFilter = 'in_progress')}
				class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {statusFilter ===
				'in_progress'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-600 hover:text-gray-900'}"
			>
				In Progress ({counts.in_progress})
			</button>
			<button
				onclick={() => (statusFilter = 'closed')}
				class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {statusFilter ===
				'closed'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-600 hover:text-gray-900'}"
			>
				Closed ({counts.closed})
			</button>
		</div>
	</div>

	<!-- Issue List -->
	{#if filteredIssues.length === 0}
		<div class="text-center py-16">
			<div class="text-gray-400 mb-4">
				<svg class="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-medium text-gray-900 mb-1">No issues found</h3>
			<p class="text-gray-500 mb-4">
				{#if issueStore.issues.length === 0}
					Get started by creating your first issue.
				{:else}
					Try adjusting your filters.
				{/if}
			</p>
			{#if issueStore.issues.length === 0}
				<a
					href="/issue/new"
					class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
				>
					Create Issue
				</a>
			{/if}
		</div>
	{:else}
		<div class="grid gap-3">
			{#each filteredIssues as issue (issue.id)}
				<IssueCard {issue} />
			{/each}
		</div>
	{/if}
</div>
