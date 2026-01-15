<script lang="ts">
	import type { Issue, ExecutionType, IssuePriority } from '$lib/types/issue';
	import { PRIORITY_LABELS, PRIORITY_DESCRIPTIONS, TYPE_LABELS, EXECUTION_TYPE_LABELS, STATUS_LABELS, STATUS_DESCRIPTIONS } from '$lib/types/issue';
	import { issueStore } from '$lib/stores/issues.svelte';

	let { issue }: { issue: Issue } = $props();

	const priorityColors: Record<number, string> = {
		0: 'bg-red-100 text-red-800',
		1: 'bg-orange-100 text-orange-800',
		2: 'bg-yellow-100 text-yellow-800',
		3: 'bg-blue-100 text-blue-800',
		4: 'bg-gray-100 text-gray-600'
	};

	const typeColors: Record<string, string> = {
		bug: 'bg-red-50 text-red-700 border-red-200',
		feature: 'bg-purple-50 text-purple-700 border-purple-200',
		task: 'bg-gray-50 text-gray-700 border-gray-200'
	};

	const statusColors: Record<string, string> = {
		open: 'bg-green-500',
		in_progress: 'bg-blue-500',
		closed: 'bg-gray-400'
	};

	// Execution type styling - who does this task?
	const executionColors: Record<ExecutionType, string> = {
		automated: 'bg-emerald-100 text-emerald-800 border-emerald-200',
		human: 'bg-rose-100 text-rose-800 border-rose-200',
		ai_assisted: 'bg-sky-100 text-sky-800 border-sky-200',
		human_assisted: 'bg-violet-100 text-violet-800 border-violet-200'
	};

	// Short labels for the badge
	const executionShortLabels: Record<ExecutionType, string> = {
		automated: 'AI',
		human: 'You',
		ai_assisted: 'AI+You',
		human_assisted: 'You+AI'
	};

	let blockers = $derived(issueStore.getBlockers(issue.id));
	let isBlocked = $derived(blockers.length > 0);
</script>

<a
	href="/issue/{issue.id}"
	class="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition-all duration-200 {isBlocked ? 'opacity-60' : ''}"
>
	<div class="flex items-start gap-3">
		<div class="flex-shrink-0 mt-1" title="{STATUS_LABELS[issue.status]}: {STATUS_DESCRIPTIONS[issue.status]}">
			<div class="w-2.5 h-2.5 rounded-full {statusColors[issue.status]}"></div>
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 mb-1 flex-wrap">
				<span class="text-xs font-medium px-2 py-0.5 rounded-full border {typeColors[issue.type]}">
					{TYPE_LABELS[issue.type]}
				</span>
				<span
					class="text-xs font-medium px-2 py-0.5 rounded-full {priorityColors[issue.priority]}"
					title={PRIORITY_DESCRIPTIONS[issue.priority as IssuePriority]}
				>
					P{issue.priority}
				</span>
				{#if issue.executionType}
					<span
						class="text-xs font-medium px-2 py-0.5 rounded-full border {executionColors[issue.executionType]}"
						title={EXECUTION_TYPE_LABELS[issue.executionType]}
					>
						{executionShortLabels[issue.executionType]}
					</span>
				{/if}
				{#if issue.validationRequired}
					<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="You need to verify this when done">
						✓ Verify
					</span>
				{/if}
				{#if isBlocked}
					<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
						Waiting
					</span>
				{/if}
			</div>

			<h3 class="font-medium text-gray-900 truncate">{issue.title}</h3>

			{#if issue.description}
				<p class="text-sm text-gray-500 mt-1 line-clamp-2">{issue.description}</p>
			{/if}

			{#if issue.dependencies.length > 0}
				<div class="mt-2 text-xs text-gray-400">
					waiting on {issue.dependencies.length} task{issue.dependencies.length === 1 ? '' : 's'}
				</div>
			{/if}
		</div>
	</div>
</a>
