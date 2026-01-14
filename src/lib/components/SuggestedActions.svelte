<script lang="ts">
	import type { Issue, SuggestedAction } from '$lib/types/issue';
	import { TYPE_LABELS, PRIORITY_LABELS } from '$lib/types/issue';
	import { issueStore } from '$lib/stores/issues.svelte';

	let {
		issue,
		onCreated
	}: {
		issue: Issue;
		onCreated?: (newIssue: Issue) => void;
	} = $props();

	let suggestions = $state<SuggestedAction[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let dismissed = $state<Set<string>>(new Set());

	const relationshipLabels: Record<string, string> = {
		dependency: 'should be done before',
		blocks: 'should be done after',
		related: 'is related to'
	};

	const relationshipColors: Record<string, string> = {
		dependency: 'bg-amber-50 border-amber-200 text-amber-800',
		blocks: 'bg-purple-50 border-purple-200 text-purple-800',
		related: 'bg-blue-50 border-blue-200 text-blue-800'
	};

	async function loadSuggestions() {
		loading = true;
		error = null;

		try {
			const response = await fetch('/api/suggest-actions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issue,
					existingIssues: issueStore.issues
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get suggestions');
			}

			const data = await response.json();
			suggestions = data.suggestions || [];
		} catch (e) {
			error = 'Failed to load suggestions';
			suggestions = [];
		} finally {
			loading = false;
		}
	}

	function acceptSuggestion(suggestion: SuggestedAction) {
		// Create the new issue
		const newIssue = issueStore.create({
			title: suggestion.title,
			description: suggestion.description,
			type: suggestion.type,
			priority: suggestion.priority,
			dependencies:
				suggestion.relationship.type === 'dependency' ? [suggestion.relationship.targetId] : []
		});

		// If this issue blocks the new one, add dependency to current issue
		if (suggestion.relationship.type === 'blocks' && newIssue) {
			issueStore.addDependency(suggestion.relationship.targetId, newIssue.id);
		}

		// Remove from suggestions
		dismissed = new Set([...dismissed, suggestion.title]);

		if (onCreated && newIssue) {
			onCreated(newIssue);
		}
	}

	function dismissSuggestion(suggestion: SuggestedAction) {
		dismissed = new Set([...dismissed, suggestion.title]);
	}

	let activeSuggestions = $derived(suggestions.filter((s) => !dismissed.has(s.title)));
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-gray-700">Suggested Actions</h3>
		<button
			onclick={loadSuggestions}
			disabled={loading}
			class="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
		>
			{#if loading}
				<span class="flex items-center gap-2">
					<span class="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"
					></span>
					Thinking...
				</span>
			{:else if suggestions.length > 0}
				Refresh
			{:else}
				Get AI Suggestions
			{/if}
		</button>
	</div>

	{#if error}
		<p class="text-sm text-red-600">{error}</p>
	{/if}

	{#if activeSuggestions.length > 0}
		<div class="space-y-3">
			{#each activeSuggestions as suggestion}
				<div class="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 mb-1">
								<span
									class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
								>
									{TYPE_LABELS[suggestion.type]}
								</span>
								<span
									class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
								>
									P{suggestion.priority}
								</span>
							</div>

							<h4 class="font-medium text-gray-900">{suggestion.title}</h4>

							{#if suggestion.description}
								<p class="text-sm text-gray-600 mt-1">{suggestion.description}</p>
							{/if}

							<div
								class="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs border {relationshipColors[
									suggestion.relationship.type
								]}"
							>
								<span class="font-medium">
									{relationshipLabels[suggestion.relationship.type]}
								</span>
								<span>this issue</span>
							</div>

							<p class="text-xs text-gray-500 mt-1 italic">
								{suggestion.relationship.reason}
							</p>
						</div>

						<div class="flex flex-col gap-2">
							<button
								onclick={() => acceptSuggestion(suggestion)}
								class="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
							>
								Create
							</button>
							<button
								onclick={() => dismissSuggestion(suggestion)}
								class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
							>
								Dismiss
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if !loading && suggestions.length === 0}
		<p class="text-sm text-gray-500 text-center py-4">
			Click "Get AI Suggestions" to see related actions you might want to create.
		</p>
	{/if}
</div>
