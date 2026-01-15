<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';
	import type { Issue, IssueType, IssuePriority } from '$lib/types/issue';
	import { TYPE_LABELS } from '$lib/types/issue';

	interface FollowUpSuggestion {
		title: string;
		description: string;
		type: IssueType;
		priority: IssuePriority;
		relationship: 'prerequisite' | 'follow-up' | 'parallel' | 'verification';
		reason: string;
	}

	interface Props {
		issue: Issue;
		onDismiss: () => void;
	}

	let { issue, onDismiss }: Props = $props();

	let loading = $state(true);
	let suggestions = $state<FollowUpSuggestion[]>([]);
	let createdIds = $state<Set<string>>(new Set());
	let dismissed = $state<Set<number>>(new Set());

	// Fetch suggestions on mount
	$effect(() => {
		fetchSuggestions();
	});

	async function fetchSuggestions() {
		if (!aiSettings.isConfigured) {
			loading = false;
			return;
		}

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/suggest-follow-ups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issue,
					existingIssues: issueStore.issues,
					model,
					apiKey
				})
			});

			const data = await response.json();
			suggestions = data.suggestions || [];
		} catch {
			suggestions = [];
		} finally {
			loading = false;
		}
	}

	function createSuggestion(suggestion: FollowUpSuggestion, index: number) {
		const newIssue = issueStore.create({
			title: suggestion.title,
			description: suggestion.description,
			type: suggestion.type,
			priority: suggestion.priority,
			// If it's a prerequisite, the original issue should depend on it
			// If it's a follow-up, it should depend on the original issue
			dependencies: suggestion.relationship === 'follow-up' ? [issue.id] : []
		});

		if (newIssue) {
			createdIds = new Set([...createdIds, newIssue.id]);

			// If prerequisite, add as dependency to original issue
			if (suggestion.relationship === 'prerequisite') {
				issueStore.addDependency(issue.id, newIssue.id);
			}
		}
	}

	function dismissSuggestion(index: number) {
		dismissed = new Set([...dismissed, index]);
	}

	let activeSuggestions = $derived(
		suggestions.filter((_, i) => !dismissed.has(i) && !createdIds.has(suggestions[i]?.title))
	);

	const relationshipLabels: Record<string, string> = {
		prerequisite: 'Do first',
		'follow-up': 'Do after',
		parallel: 'Do alongside',
		verification: 'Verify'
	};

	const relationshipColors: Record<string, string> = {
		prerequisite: 'bg-amber-100 text-amber-700',
		'follow-up': 'bg-blue-100 text-blue-700',
		parallel: 'bg-green-100 text-green-700',
		verification: 'bg-purple-100 text-purple-700'
	};

	const typeColors: Record<IssueType, string> = {
		task: 'bg-gray-100 text-gray-700',
		bug: 'bg-red-100 text-red-700',
		feature: 'bg-purple-100 text-purple-700'
	};
</script>

<div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-5">
	<div class="flex items-start justify-between mb-4">
		<div>
			<h3 class="font-semibold text-gray-900 flex items-center gap-2">
				<svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
				What else might you need?
			</h3>
			<p class="text-sm text-gray-600 mt-1">
				AI-suggested tasks related to "{issue.title}"
			</p>
		</div>
		<button
			onclick={onDismiss}
			class="p-1 text-gray-400 hover:text-gray-600 rounded"
			aria-label="Dismiss suggestions"
		>
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-8">
			<div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
			<span class="ml-3 text-sm text-gray-600">Analyzing for related tasks...</span>
		</div>
	{:else if !aiSettings.isConfigured}
		<p class="text-sm text-gray-500 py-4 text-center">
			Set up AI in the top menu to get task suggestions.
		</p>
	{:else if activeSuggestions.length === 0}
		<p class="text-sm text-gray-500 py-4 text-center">
			{suggestions.length > 0 ? 'All suggestions created or dismissed!' : 'No additional tasks suggested.'}
		</p>
	{:else}
		<div class="space-y-3">
			{#each suggestions as suggestion, index}
				{#if !dismissed.has(index)}
					<div class="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1 flex-wrap">
									<span class="px-2 py-0.5 text-xs font-medium rounded-full {relationshipColors[suggestion.relationship]}">
										{relationshipLabels[suggestion.relationship]}
									</span>
									<span class="px-2 py-0.5 text-xs font-medium rounded-full {typeColors[suggestion.type]}">
										{TYPE_LABELS[suggestion.type]}
									</span>
									<span class="text-xs text-gray-500">P{suggestion.priority}</span>
								</div>
								<h4 class="font-medium text-gray-900">{suggestion.title}</h4>
								{#if suggestion.description}
									<p class="text-sm text-gray-600 mt-1">{suggestion.description}</p>
								{/if}
								{#if suggestion.reason}
									<p class="text-xs text-gray-500 mt-2 italic">"{suggestion.reason}"</p>
								{/if}
							</div>
							<div class="flex items-center gap-2 flex-shrink-0">
								<button
									onclick={() => dismissSuggestion(index)}
									class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
									aria-label="Dismiss"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
								<button
									onclick={() => createSuggestion(suggestion, index)}
									class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
									</svg>
									Create
								</button>
							</div>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if createdIds.size > 0}
		<div class="mt-4 pt-4 border-t border-blue-200">
			<p class="text-sm text-green-700 flex items-center gap-2">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				{createdIds.size} task{createdIds.size > 1 ? 's' : ''} created
			</p>
		</div>
	{/if}
</div>
