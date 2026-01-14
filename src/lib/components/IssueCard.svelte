<script lang="ts">
	import type { Issue } from '$lib/types/issue';
	import { PRIORITY_LABELS, TYPE_LABELS } from '$lib/types/issue';
	import { issueStore } from '$lib/stores/issues';

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

	let blockers = $derived(issueStore.getBlockers(issue.id));
	let isBlocked = $derived(blockers.length > 0);
</script>

<a
	href="/issue/{issue.id}"
	class="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition-all duration-200 {isBlocked ? 'opacity-60' : ''}"
>
	<div class="flex items-start gap-3">
		<div class="flex-shrink-0 mt-1">
			<div class="w-2.5 h-2.5 rounded-full {statusColors[issue.status]}"></div>
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 mb-1">
				<span class="text-xs font-medium px-2 py-0.5 rounded-full border {typeColors[issue.type]}">
					{TYPE_LABELS[issue.type]}
				</span>
				<span class="text-xs font-medium px-2 py-0.5 rounded-full {priorityColors[issue.priority]}">
					P{issue.priority}
				</span>
				{#if isBlocked}
					<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
						Blocked
					</span>
				{/if}
			</div>

			<h3 class="font-medium text-gray-900 truncate">{issue.title}</h3>

			{#if issue.description}
				<p class="text-sm text-gray-500 mt-1 line-clamp-2">{issue.description}</p>
			{/if}

			{#if issue.dependencies.length > 0}
				<div class="mt-2 text-xs text-gray-400">
					{issue.dependencies.length} dependenc{issue.dependencies.length === 1 ? 'y' : 'ies'}
				</div>
			{/if}
		</div>
	</div>
</a>
