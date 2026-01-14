<script lang="ts">
	import type { Issue, IssuePriority, IssueType, IssueStatus, RelationshipSuggestion } from '$lib/types/issue';
	import { PRIORITY_LABELS, TYPE_LABELS, STATUS_LABELS } from '$lib/types/issue';
	import { issueStore } from '$lib/stores/issues';
	import { suggestRelationships } from '$lib/ai/relationships';
	import RelationshipSuggestionComponent from './RelationshipSuggestion.svelte';
	import { goto } from '$app/navigation';

	let {
		issue = undefined,
		onSave = undefined
	}: {
		issue?: Issue;
		onSave?: (issue: Issue) => void;
	} = $props();

	let title = $state(issue?.title ?? '');
	let description = $state(issue?.description ?? '');
	let priority = $state<IssuePriority>(issue?.priority ?? 2);
	let type = $state<IssueType>(issue?.type ?? 'task');
	let status = $state<IssueStatus>(issue?.status ?? 'open');
	let dependencies = $state<string[]>(issue?.dependencies ?? []);

	// AI suggestions state
	let suggestions = $state<RelationshipSuggestion[]>([]);
	let loadingSuggestions = $state(false);
	let dismissedSuggestions = $state<Set<string>>(new Set());
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	let availableDependencies = $derived(
		issueStore.issues.filter((i) => i.id !== issue?.id && i.status !== 'closed')
	);

	// Filter out dismissed and already-applied suggestions
	let activeSuggestions = $derived(
		suggestions.filter(
			(s) =>
				!dismissedSuggestions.has(s.targetId) &&
				!dependencies.includes(s.targetId)
		)
	);

	// Fetch AI suggestions when title/description changes
	$effect(() => {
		const currentTitle = title;
		const currentDescription = description;

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Only fetch if there's meaningful content and existing issues to relate to
		if (currentTitle.length >= 5 && availableDependencies.length > 0) {
			debounceTimer = setTimeout(async () => {
				loadingSuggestions = true;
				try {
					const newSuggestions = await suggestRelationships(
						{ title: currentTitle, description: currentDescription },
						availableDependencies
					);
					suggestions = newSuggestions;
				} catch {
					suggestions = [];
				} finally {
					loadingSuggestions = false;
				}
			}, 1000); // 1 second debounce
		} else {
			suggestions = [];
		}

		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
		};
	});

	function handleSubmit(e: Event) {
		e.preventDefault();

		if (!title.trim()) return;

		let savedIssue: Issue | undefined;

		if (issue) {
			savedIssue = issueStore.update(issue.id, {
				title: title.trim(),
				description: description.trim(),
				priority,
				type,
				status,
				dependencies
			});
		} else {
			savedIssue = issueStore.create({
				title: title.trim(),
				description: description.trim(),
				priority,
				type,
				dependencies
			});
		}

		if (savedIssue) {
			if (onSave) {
				onSave(savedIssue);
			} else {
				goto(`/issue/${savedIssue.id}`);
			}
		}
	}

	function toggleDependency(depId: string) {
		if (dependencies.includes(depId)) {
			dependencies = dependencies.filter((id) => id !== depId);
		} else {
			dependencies = [...dependencies, depId];
		}
	}

	function handleAcceptSuggestion(suggestion: RelationshipSuggestion) {
		if (suggestion.type === 'dependency') {
			// This issue depends on the target
			if (!dependencies.includes(suggestion.targetId)) {
				dependencies = [...dependencies, suggestion.targetId];
			}
		}
		// For 'blocks' type, we'd need to update the target issue (not implemented in this simple version)
		// For 'related', we could track it separately (not implemented yet)
	}

	function handleDismissSuggestion(suggestion: RelationshipSuggestion) {
		dismissedSuggestions = new Set([...dismissedSuggestions, suggestion.targetId]);
	}
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- Title -->
	<div>
		<label for="title" class="block text-sm font-medium text-gray-700 mb-1"> Title </label>
		<input
			id="title"
			type="text"
			bind:value={title}
			placeholder="What needs to be done?"
			class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 placeholder-gray-400"
			required
		/>
	</div>

	<!-- Description -->
	<div>
		<label for="description" class="block text-sm font-medium text-gray-700 mb-1">
			Description
		</label>
		<textarea
			id="description"
			bind:value={description}
			placeholder="Add more details..."
			rows="4"
			class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 placeholder-gray-400 resize-none"
		></textarea>
	</div>

	<!-- AI Suggestions -->
	{#if loadingSuggestions}
		<div class="flex items-center gap-2 text-sm text-gray-500">
			<div class="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
			<span>Analyzing for relationships...</span>
		</div>
	{:else if activeSuggestions.length > 0}
		<RelationshipSuggestionComponent
			suggestions={activeSuggestions}
			currentIssueId={issue?.id ?? ''}
			onAccept={handleAcceptSuggestion}
			onDismiss={handleDismissSuggestion}
		/>
	{/if}

	<!-- Type & Priority -->
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="type" class="block text-sm font-medium text-gray-700 mb-1"> Type </label>
			<select
				id="type"
				bind:value={type}
				class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900"
			>
				{#each Object.entries(TYPE_LABELS) as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="priority" class="block text-sm font-medium text-gray-700 mb-1"> Priority </label>
			<select
				id="priority"
				bind:value={priority}
				class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900"
			>
				{#each Object.entries(PRIORITY_LABELS) as [value, label]}
					<option value={Number(value)}>{label}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Status (only for editing) -->
	{#if issue}
		<div>
			<label for="status" class="block text-sm font-medium text-gray-700 mb-1"> Status </label>
			<select
				id="status"
				bind:value={status}
				class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900"
			>
				{#each Object.entries(STATUS_LABELS) as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Dependencies -->
	{#if availableDependencies.length > 0}
		<div>
			<span class="block text-sm font-medium text-gray-700 mb-2">Dependencies</span>
			<p class="text-sm text-gray-500 mb-3">
				Select issues that must be completed before this one.
			</p>
			<div class="space-y-2 max-h-48 overflow-y-auto">
				{#each availableDependencies as dep}
					<label
						class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors {dependencies.includes(
							dep.id
						)
							? 'bg-blue-50 border-blue-300'
							: 'bg-white border-gray-200 hover:border-gray-300'}"
					>
						<input
							type="checkbox"
							checked={dependencies.includes(dep.id)}
							onchange={() => toggleDependency(dep.id)}
							class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
						/>
						<div class="flex-1 min-w-0">
							<div class="font-medium text-gray-900 truncate">{dep.title}</div>
							<div class="text-xs text-gray-500">P{dep.priority} · {TYPE_LABELS[dep.type]}</div>
						</div>
					</label>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Submit -->
	<div class="flex items-center gap-3 pt-4">
		<button
			type="submit"
			class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
		>
			{issue ? 'Save Changes' : 'Create Issue'}
		</button>
		<a href={issue ? `/issue/${issue.id}` : '/'} class="px-6 py-3 text-gray-600 hover:text-gray-900">
			Cancel
		</a>
	</div>
</form>
