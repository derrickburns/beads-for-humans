<script lang="ts">
	import type { Issue, IssuePriority, IssueType, IssueStatus, ExecutionType, RelationshipSuggestion } from '$lib/types/issue';
	import { PRIORITY_LABELS, PRIORITY_DESCRIPTIONS, TYPE_LABELS, STATUS_LABELS, EXECUTION_TYPE_LABELS, EXECUTION_TYPE_DESCRIPTIONS } from '$lib/types/issue';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { suggestRelationships } from '$lib/ai/relationships';
	import RelationshipSuggestionComponent from './RelationshipSuggestion.svelte';
	import HelpTooltip from './HelpTooltip.svelte';
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
	let executionType = $state<ExecutionType | undefined>(issue?.executionType);
	let validationRequired = $state(issue?.validationRequired ?? false);

	// AI suggestions state
	let suggestions = $state<RelationshipSuggestion[]>([]);
	let loadingSuggestions = $state(false);
	let dismissedSuggestions = $state<Set<string>>(new Set());
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// AI description generation state
	let generatingDescription = $state(false);

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
				dependencies,
				executionType,
				validationRequired
			});
		} else {
			savedIssue = issueStore.create({
				title: title.trim(),
				description: description.trim(),
				priority,
				type,
				dependencies,
				executionType,
				validationRequired
			});
		}

		if (savedIssue) {
			if (onSave) {
				onSave(savedIssue);
			} else {
				// Add ?new=true for new issues to trigger follow-up suggestions
				const url = issue ? `/issue/${savedIssue.id}` : `/issue/${savedIssue.id}?new=true`;
				goto(url);
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

	async function generateDescription() {
		if (title.length < 3) return;

		generatingDescription = true;
		try {
			const response = await fetch('/api/generate-description', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, type })
			});

			if (response.ok) {
				const data = await response.json();
				if (data.description) {
					description = data.description;
				}
			}
		} catch (e) {
			console.error('Failed to generate description:', e);
		} finally {
			generatingDescription = false;
		}
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
		<div class="flex items-center justify-between mb-1">
			<label for="description" class="block text-sm font-medium text-gray-700">
				Description
			</label>
			{#if title.length >= 3 && !description}
				<button
					type="button"
					onclick={generateDescription}
					disabled={generatingDescription}
					class="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
				>
					{#if generatingDescription}
						<span class="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></span>
						Generating...
					{:else}
						<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
						Generate with AI
					{/if}
				</button>
			{/if}
		</div>
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
			<label for="priority" class="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
				Priority
				<HelpTooltip text="P0: Drop everything, blocking/damaging now
P1: Do this week, important
P2: Normal priority, no rush
P3: Nice to have
P4: Maybe someday" position="right" />
			</label>
			<select
				id="priority"
				bind:value={priority}
				class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900"
			>
				{#each Object.entries(PRIORITY_LABELS) as [value, label]}
					<option value={Number(value)} title={PRIORITY_DESCRIPTIONS[Number(value) as IssuePriority]}>{label}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Who Does This Task -->
	<div>
		<span class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
			Who Does This?
			<HelpTooltip text="As AI gets smarter, tasks can be re-evaluated. Start with what makes sense today." position="right" />
		</span>
		<p class="text-sm text-gray-500 mb-3">
			Identify whether you need to do this yourself, or if AI can help.
		</p>
		<div class="grid grid-cols-2 gap-3">
			{#each Object.entries(EXECUTION_TYPE_LABELS) as [value, label]}
				<label
					class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {executionType === value
						? 'bg-blue-50 border-blue-300'
						: 'bg-white border-gray-200 hover:border-gray-300'}"
				>
					<input
						type="radio"
						name="executionType"
						{value}
						checked={executionType === value}
						onchange={() => { executionType = value as ExecutionType; }}
						class="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
					/>
					<div class="flex-1">
						<div class="font-medium text-gray-900 text-sm">{label}</div>
						<div class="text-xs text-gray-500 mt-0.5">{EXECUTION_TYPE_DESCRIPTIONS[value as ExecutionType]}</div>
					</div>
				</label>
			{/each}
		</div>

		<!-- Validation checkbox -->
		{#if executionType && executionType !== 'human'}
			<label class="flex items-center gap-3 mt-3 p-3 rounded-lg border cursor-pointer transition-colors {validationRequired ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200 hover:border-gray-300'}">
				<input
					type="checkbox"
					bind:checked={validationRequired}
					class="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
				/>
				<div>
					<div class="font-medium text-gray-900 text-sm">Requires your verification</div>
					<div class="text-xs text-gray-500">You need to review and approve when this is done</div>
				</div>
			</label>
		{/if}
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

	<!-- Must Complete First -->
	{#if availableDependencies.length > 0}
		<div>
			<span class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
				Must Complete First
				<HelpTooltip text="Also called 'blockers'. This task can't start until these are done." position="right" />
			</span>
			<p class="text-sm text-gray-500 mb-3">
				Select tasks that need to be done before this one can start.
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
