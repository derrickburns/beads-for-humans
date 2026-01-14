<script lang="ts">
	import type { RelationshipSuggestion, Issue } from '$lib/types/issue';
	import { issueStore } from '$lib/stores/issues.svelte';

	let {
		suggestions,
		currentIssueId,
		onAccept,
		onDismiss
	}: {
		suggestions: RelationshipSuggestion[];
		currentIssueId: string;
		onAccept: (suggestion: RelationshipSuggestion) => void;
		onDismiss: (suggestion: RelationshipSuggestion) => void;
	} = $props();

	function getIssue(id: string): Issue | undefined {
		return issueStore.getById(id);
	}

	const typeLabels: Record<string, string> = {
		dependency: 'depends on',
		blocks: 'blocks',
		related: 'related to'
	};

	const typeColors: Record<string, string> = {
		dependency: 'bg-amber-50 border-amber-200',
		blocks: 'bg-purple-50 border-purple-200',
		related: 'bg-blue-50 border-blue-200'
	};
</script>

{#if suggestions.length > 0}
	<div class="space-y-3">
		<div class="flex items-center gap-2">
			<div class="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
			<span class="text-sm font-medium text-gray-700">AI Suggestions</span>
		</div>

		{#each suggestions as suggestion}
			{@const targetIssue = getIssue(suggestion.targetId)}
			{#if targetIssue}
				<div
					class="p-4 rounded-lg border {typeColors[suggestion.type]} transition-all duration-200"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<div class="text-sm text-gray-600 mb-1">
								This issue <span class="font-medium">{typeLabels[suggestion.type]}</span>
							</div>
							<div class="font-medium text-gray-900 truncate">{targetIssue.title}</div>
							<div class="text-sm text-gray-500 mt-1">{suggestion.reason}</div>
							<div class="text-xs text-gray-400 mt-1">
								{Math.round(suggestion.confidence * 100)}% confident
							</div>
						</div>

						<div class="flex items-center gap-2 flex-shrink-0">
							<button
								onclick={() => onAccept(suggestion)}
								class="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
							>
								Accept
							</button>
							<button
								onclick={() => onDismiss(suggestion)}
								class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
							>
								Dismiss
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}
