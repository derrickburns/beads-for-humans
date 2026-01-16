<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { PRIORITY_LABELS, TYPE_LABELS, STATUS_LABELS } from '$lib/types/issue';
	import type { IssueStatus, RelationshipSuggestion } from '$lib/types/issue';
	import IssueForm from '$lib/components/IssueForm.svelte';
	import SuggestedActions from '$lib/components/SuggestedActions.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import FollowUpSuggestions from '$lib/components/FollowUpSuggestions.svelte';
	import PlanningAssistant from '$lib/components/PlanningAssistant.svelte';
	import TaskDialog from '$lib/components/TaskDialog.svelte';

	let id = $derived($page.params.id ?? '');
	let issue = $derived(id ? issueStore.getById(id) ?? null : null);

	// Check if this is a newly created issue (from ?new=true param)
	let isNewIssue = $derived($page.url.searchParams.get('new') === 'true');
	let showFollowUpSuggestions = $state(true);

	// Check if should start in edit mode (from ?edit=true param)
	let startInEditMode = $derived($page.url.searchParams.get('edit') === 'true');

	// Clean up URL params
	$effect(() => {
		if (browser && (isNewIssue || startInEditMode)) {
			const url = new URL(window.location.href);
			url.searchParams.delete('new');
			url.searchParams.delete('edit');
			window.history.replaceState({}, '', url.toString());
		}
	});

	// Start in edit mode if requested
	$effect(() => {
		if (startInEditMode && issue) {
			editing = true;
		}
	});

	function dismissFollowUpSuggestions() {
		showFollowUpSuggestions = false;
	}
	let blockers = $derived(issue ? issueStore.getBlockers(issue.id) : []);
	let blocking = $derived(issue ? issueStore.getBlocking(issue.id) : []);

	let editing = $state(false);
	let showDeleteConfirm = $state(false);
	let showTaskDialog = $state(false);

	// Inline editing state
	let editingTitle = $state(false);
	let editingDescription = $state(false);
	let editTitleValue = $state('');
	let editDescriptionValue = $state('');

	function startEditingTitle() {
		if (!issue) return;
		editTitleValue = issue.title;
		editingTitle = true;
	}

	function saveTitle() {
		if (!issue || !editTitleValue.trim()) {
			editingTitle = false;
			return;
		}
		issueStore.update(issue.id, { title: editTitleValue.trim() });
		editingTitle = false;
	}

	function startEditingDescription() {
		if (!issue) return;
		editDescriptionValue = issue.description || '';
		editingDescription = true;
	}

	function saveDescription() {
		if (!issue) {
			editingDescription = false;
			return;
		}
		issueStore.update(issue.id, { description: editDescriptionValue.trim() || undefined });
		editingDescription = false;
	}

	function handleTitleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveTitle();
		} else if (e.key === 'Escape') {
			editingTitle = false;
		}
	}

	function handleDescriptionKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			editingDescription = false;
		}
		// Allow Enter for newlines in description
	}
	let showAddDependency = $state(false);
	let showAddBlocking = $state(false);
	let showCreateRelated = $state(false);
	let newRelatedTitle = $state('');
	let newRelatedType = $state<'dependency' | 'blocks'>('blocks');
	let dependencyError = $state<string | null>(null);
	let cycleBreakOptions = $state<Array<{from: string; to: string; fromTitle: string; toTitle: string}>>([]);
	let pendingDependencyAction = $state<{type: 'add' | 'block' | 'reverse'; targetId: string} | null>(null);

	// Toast notification state
	let toast = $state<{ message: string; action?: { label: string; href: string } } | null>(null);

	// AI dependency suggestions state
	let depSuggestions = $state<RelationshipSuggestion[]>([]);
	let loadingDepSuggestions = $state(false);
	let dismissedDepSuggestions = $state<Set<string>>(new Set());

	// Available issues for manual dependency selection (not self, not already a dependency)
	let availableForDependency = $derived(
		issueStore.issues.filter(
			(i) => i.id !== issue?.id && !issue?.dependencies.includes(i.id) && i.status !== 'closed'
		)
	);

	// Available issues that this issue could block (not self, doesn't already depend on this)
	let availableForBlocking = $derived(
		issueStore.issues.filter(
			(i) => i.id !== issue?.id && !i.dependencies.includes(issue?.id ?? '') && i.status !== 'closed'
		)
	);

	// Active dependency suggestions (not dismissed, not already added)
	let activeDepSuggestions = $derived(
		depSuggestions.filter(
			(s) =>
				!dismissedDepSuggestions.has(s.targetId) &&
				!issue?.dependencies.includes(s.targetId) &&
				s.type === 'dependency'
		)
	);

	async function loadDepSuggestions() {
		if (!issue) return;
		loadingDepSuggestions = true;
		try {
			const response = await fetch('/api/suggest-relationships', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issue: { title: issue.title, description: issue.description },
					existingIssues: issueStore.issues.filter((i) => i.id !== issue.id)
				})
			});
			if (response.ok) {
				const data = await response.json();
				depSuggestions = data.suggestions || [];
			}
		} catch {
			depSuggestions = [];
		} finally {
			loadingDepSuggestions = false;
		}
	}

	function acceptDepSuggestion(suggestion: RelationshipSuggestion) {
		if (issue) {
			const result = issueStore.addDependency(issue.id, suggestion.targetId);
			if (result.error) {
				dependencyError = result.error;
				setTimeout(clearError, 3000);
			} else {
				// Show success toast with View in Graph link
				const targetIssue = issueStore.getById(suggestion.targetId);
				toast = {
					message: `Dependency added: ${targetIssue?.title.slice(0, 30) || 'issue'}`,
					action: { label: 'View in Graph', href: `/?focus=${issue.id}` }
				};
			}
		}
	}

	function dismissDepSuggestion(suggestion: RelationshipSuggestion) {
		dismissedDepSuggestions = new Set([...dismissedDepSuggestions, suggestion.targetId]);
	}

	function clearError() {
		dependencyError = null;
		cycleBreakOptions = [];
		pendingDependencyAction = null;
	}

	function handleCycleBreak(breakEdge: {from: string; to: string}) {
		if (!issue || !pendingDependencyAction) return;

		if (pendingDependencyAction.type === 'add') {
			issueStore.addDependencyBreakingCycle(issue.id, pendingDependencyAction.targetId, breakEdge);
			showAddDependency = false;
		} else if (pendingDependencyAction.type === 'block') {
			issueStore.addDependencyBreakingCycle(pendingDependencyAction.targetId, issue.id, breakEdge);
			showAddBlocking = false;
		} else if (pendingDependencyAction.type === 'reverse') {
			// For reverse, first remove original, then add with cycle break
			// The original was already removed by reverseDependency, so just add
			issueStore.addDependencyBreakingCycle(pendingDependencyAction.targetId, issue.id, breakEdge);
		}

		clearError();
	}

	function addManualDependency(depId: string) {
		if (issue) {
			const result = issueStore.addDependency(issue.id, depId);
			if (result.error) {
				dependencyError = result.error;
				if (result.cycleBreakOptions && result.cycleBreakOptions.length > 0) {
					cycleBreakOptions = result.cycleBreakOptions;
					pendingDependencyAction = { type: 'add', targetId: depId };
				} else {
					setTimeout(clearError, 3000);
				}
			} else {
				showAddDependency = false;
			}
		}
	}

	function addAsBlockerTo(targetId: string) {
		if (issue) {
			// Add this issue as a dependency of the target (target depends on this)
			const result = issueStore.addDependency(targetId, issue.id);
			if (result.error) {
				dependencyError = result.error;
				if (result.cycleBreakOptions && result.cycleBreakOptions.length > 0) {
					cycleBreakOptions = result.cycleBreakOptions;
					pendingDependencyAction = { type: 'block', targetId };
				} else {
					setTimeout(clearError, 3000);
				}
			} else {
				showAddBlocking = false;
			}
		}
	}

	function removeDependency(depId: string) {
		if (issue) {
			issueStore.removeDependency(issue.id, depId);
		}
	}

	function removeBlocking(targetId: string) {
		// Remove this issue from target's dependencies
		issueStore.removeDependency(targetId, issue?.id ?? '');
	}

	function reverseDependency(depId: string) {
		if (issue) {
			const result = issueStore.reverseDependency(issue.id, depId);
			if (result.error) {
				dependencyError = result.error;
				setTimeout(clearError, 3000);
			}
		}
	}

	function reverseBlocking(targetId: string) {
		// Currently: target depends on this
		// After: this depends on target
		if (issue) {
			const result = issueStore.reverseDependency(targetId, issue.id);
			if (result.error) {
				dependencyError = result.error;
				setTimeout(clearError, 3000);
			}
		}
	}

	function createRelatedIssue() {
		if (!issue || !newRelatedTitle.trim()) return;

		if (newRelatedType === 'blocks') {
			// Create issue that depends on this one
			const newIssue = issueStore.create({
				title: newRelatedTitle.trim(),
				description: '',
				priority: issue.priority,
				type: 'task',
				dependencies: [issue.id]
			});
			if (newIssue) {
				goto(`/issue/${newIssue.id}`);
			}
		} else {
			// Create issue that this one depends on
			const newIssue = issueStore.create({
				title: newRelatedTitle.trim(),
				description: '',
				priority: issue.priority,
				type: 'task',
				dependencies: []
			});
			if (newIssue) {
				const result = issueStore.addDependency(issue.id, newIssue.id);
				if (result.error) {
					dependencyError = result.error;
					setTimeout(clearError, 3000);
				} else {
					goto(`/issue/${newIssue.id}`);
				}
			}
		}

		newRelatedTitle = '';
		showCreateRelated = false;
	}

	const statusColors: Record<string, string> = {
		open: 'bg-green-100 text-green-800',
		in_progress: 'bg-blue-100 text-blue-800',
		closed: 'bg-gray-100 text-gray-600',
		failed: 'bg-red-100 text-red-800'
	};

	// Check if this is a goal/container issue that can use the planning assistant
	let isGoalType = $derived(issue?.type === 'goal' || issueStore.isContainer(issue?.id ?? ''));

	const priorityColors: Record<number, string> = {
		0: 'bg-red-100 text-red-800',
		1: 'bg-orange-100 text-orange-800',
		2: 'bg-yellow-100 text-yellow-800',
		3: 'bg-blue-100 text-blue-800',
		4: 'bg-gray-100 text-gray-600'
	};

	function handleStatusChange(newStatus: IssueStatus) {
		if (issue) {
			issueStore.updateStatus(issue.id, newStatus);
		}
	}

	function handleDelete() {
		if (issue) {
			issueStore.delete(issue.id);
			goto('/');
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>{issue?.title ?? 'Issue'}</title>
</svelte:head>

{#if !issue}
	<div class="text-center py-16">
		<h2 class="text-xl font-medium text-gray-900 mb-2">Issue not found</h2>
		<p class="text-gray-500 mb-4">This issue may have been deleted.</p>
		<a
			href="/"
			class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
		>
			Back to Issues
		</a>
	</div>
{:else if editing}
	<div class="max-w-2xl">
		<div class="mb-8">
			<button
				onclick={() => (editing = false)}
				class="text-sm text-gray-500 hover:text-gray-700 mb-2"
			>
				&larr; Cancel editing
			</button>
			<h1 class="text-2xl font-semibold text-gray-900">Edit Issue</h1>
		</div>

		<div class="bg-white rounded-xl border border-gray-200 p-6">
			<IssueForm {issue} onSave={() => (editing = false)} />
		</div>
	</div>
{:else}
	<div class="max-w-3xl">
		<div class="mb-6">
			<a href="/" class="text-sm text-gray-500 hover:text-gray-700">&larr; Back</a>
		</div>

		<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
			<!-- Header -->
			<div class="p-6 border-b border-gray-100">
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-2">
							<span class="text-xs font-medium px-2 py-1 rounded-full {statusColors[issue.status]}">
								{STATUS_LABELS[issue.status]}
							</span>
							<span class="text-xs font-medium px-2 py-1 rounded-full {priorityColors[issue.priority]}">
								{PRIORITY_LABELS[issue.priority]}
							</span>
							<span class="text-xs text-gray-500">
								{TYPE_LABELS[issue.type]}
							</span>
						</div>
						{#if editingTitle}
							<input
								type="text"
								bind:value={editTitleValue}
								onkeydown={handleTitleKeydown}
								onblur={saveTitle}
								class="text-2xl font-semibold text-gray-900 w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
								autofocus
							/>
						{:else}
							<h1
								class="text-2xl font-semibold text-gray-900 hover:text-blue-600 cursor-text"
								onclick={startEditingTitle}
								title="Click to edit title"
							>
								{issue.title}
							</h1>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						<button
							onclick={() => (showTaskDialog = true)}
							class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm flex items-center gap-1.5"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
							Talk About This
						</button>
						<a
							href="/?focus={issue.id}"
							class="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							View in Graph
						</a>
						<button
							onclick={() => (editing = true)}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
						>
							Edit
						</button>
						<button
							onclick={() => (showDeleteConfirm = true)}
							class="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
						>
							Delete
						</button>
					</div>
				</div>
			</div>

			<!-- Content -->
			<div class="p-6 space-y-6">
				<!-- Error Banner with Cycle Break Options -->
				{#if dependencyError}
					<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
						<div class="flex items-start gap-2 text-red-800">
							<svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<div class="flex-1">
								<span class="text-sm font-medium">{dependencyError}</span>
								{#if cycleBreakOptions.length > 0}
									<p class="text-xs text-red-600 mt-1">To proceed, remove one of these dependencies:</p>
									<div class="mt-2 space-y-1">
										{#each cycleBreakOptions as option}
											<button
												onclick={() => handleCycleBreak(option)}
												class="w-full text-left px-3 py-2 text-sm bg-white border border-red-200 rounded hover:bg-red-100 transition-colors"
											>
												<span class="text-gray-600">Remove:</span>
												<span class="font-medium text-gray-900"> "{option.fromTitle}"</span>
												<span class="text-gray-500"> depends on </span>
												<span class="font-medium text-gray-900">"{option.toTitle}"</span>
											</button>
										{/each}
									</div>
								{/if}
							</div>
							<button onclick={clearError} class="p-1 hover:bg-red-100 rounded flex-shrink-0">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				{/if}

				<!-- Follow-up Suggestions (shown for newly created issues) -->
				{#if isNewIssue && showFollowUpSuggestions}
					<FollowUpSuggestions {issue} onDismiss={dismissFollowUpSuggestions} />
				{/if}

				<!-- Getting Started Guidance (for tasks without dialog history) -->
				{#if issue.status === 'open' && (!issue.dialogHistory || issue.dialogHistory.length === 0) && !isNewIssue}
					<div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
						<div class="flex items-start gap-3">
							<div class="p-2 bg-blue-100 rounded-lg">
								<svg class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<div class="flex-1">
								<h3 class="font-semibold text-gray-900 mb-1">What would you like to do?</h3>
								<p class="text-sm text-gray-600 mb-4">Here are your options for this task:</p>
								<div class="grid gap-2 sm:grid-cols-2">
									<button
										onclick={() => (showTaskDialog = true)}
										class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
									>
										<div class="p-2 bg-blue-100 rounded-lg">
											<svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
											</svg>
										</div>
										<div>
											<div class="font-medium text-gray-900">Talk to AI</div>
											<div class="text-xs text-gray-500">Get help, provide info, or ask questions</div>
										</div>
									</button>
									<button
										onclick={() => handleStatusChange('in_progress')}
										class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-left"
									>
										<div class="p-2 bg-green-100 rounded-lg">
											<svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
										</div>
										<div>
											<div class="font-medium text-gray-900">Start Working</div>
											<div class="text-xs text-gray-500">Mark as in progress</div>
										</div>
									</button>
									<button
										onclick={() => handleStatusChange('closed')}
										class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
									>
										<div class="p-2 bg-purple-100 rounded-lg">
											<svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
										</div>
										<div>
											<div class="font-medium text-gray-900">Already Done</div>
											<div class="text-xs text-gray-500">Mark as complete</div>
										</div>
									</button>
									<a
										href="/"
										class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left"
									>
										<div class="p-2 bg-gray-100 rounded-lg">
											<svg class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
											</svg>
										</div>
										<div>
											<div class="font-medium text-gray-900">View All Tasks</div>
											<div class="text-xs text-gray-500">Return to task list</div>
										</div>
									</a>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Description -->
				<div>
					<h3 class="text-sm font-medium text-gray-500 mb-2">Description</h3>
					{#if editingDescription}
						<textarea
							bind:value={editDescriptionValue}
							onkeydown={handleDescriptionKeydown}
							onblur={saveDescription}
							rows="4"
							class="w-full px-3 py-2 text-gray-900 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
							placeholder="Add a description..."
							autofocus
						></textarea>
						<div class="mt-2 flex gap-2">
							<button
								onclick={saveDescription}
								class="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
							>
								Save
							</button>
							<button
								onclick={() => (editingDescription = false)}
								class="px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
							>
								Cancel
							</button>
						</div>
					{:else if issue.description}
						<p
							class="text-gray-900 whitespace-pre-wrap hover:bg-gray-50 cursor-text p-2 -m-2 rounded"
							onclick={startEditingDescription}
							title="Click to edit description"
						>
							{issue.description}
						</p>
					{:else}
						<button
							onclick={startEditingDescription}
							class="text-gray-400 hover:text-gray-600 text-sm italic"
						>
							Click to add description...
						</button>
					{/if}
				</div>

				<!-- Quick Status Change -->
				<div>
					<h3 class="text-sm font-medium text-gray-500 mb-2">Status</h3>
					<div class="flex items-center gap-2">
						{#each Object.entries(STATUS_LABELS) as [value, label]}
							<button
								onclick={() => handleStatusChange(value as IssueStatus)}
								class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors {issue.status ===
								value
									? 'bg-blue-600 text-white'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
							>
								{label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Must Complete First Section -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<div class="flex items-center gap-2">
							<h3 class="text-sm font-medium text-gray-500">
								Must Complete First ({issue.dependencies.length})
							</h3>
							{#if blockers.length > 0}
								<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
									{blockers.length} not done
								</span>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							{#if availableForDependency.length > 0}
								<button
									onclick={() => (showAddDependency = !showAddDependency)}
									class="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
								>
									<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
									</svg>
									Add
								</button>
							{/if}
							<button
								onclick={loadDepSuggestions}
								disabled={loadingDepSuggestions}
								class="text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50 flex items-center gap-1"
							>
								{#if loadingDepSuggestions}
									<span class="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></span>
									Analyzing...
								{:else}
									<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
									</svg>
									AI Suggest
								{/if}
							</button>
						</div>
					</div>

					<!-- Manual Add Dropdown -->
					{#if showAddDependency && availableForDependency.length > 0}
						<div class="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
							<p class="text-xs text-gray-500 mb-2">Select a task that must be done first:</p>
							<div class="space-y-1 max-h-40 overflow-y-auto">
								{#each availableForDependency as dep}
									<button
										onclick={() => addManualDependency(dep.id)}
										class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors flex items-center justify-between"
									>
										<span class="truncate">{dep.title}</span>
										<span class="text-xs text-gray-400 ml-2">P{dep.priority}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- AI Suggestions -->
					{#if activeDepSuggestions.length > 0}
						<div class="mb-3 space-y-2">
							{#each activeDepSuggestions as suggestion}
								{@const targetIssue = issueStore.getById(suggestion.targetId)}
								{#if targetIssue}
									<div class="p-3 bg-purple-50 border border-purple-200 rounded-lg">
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium text-gray-900 truncate">{targetIssue.title}</p>
												<p class="text-xs text-purple-600 mt-1">{suggestion.reason}</p>
												<span class="text-xs text-gray-400">Confidence: {Math.round(suggestion.confidence * 100)}%</span>
											</div>
											<div class="flex items-center gap-1">
												<button
													onclick={() => acceptDepSuggestion(suggestion)}
													class="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
												>
													Accept
												</button>
												<button
													onclick={() => dismissDepSuggestion(suggestion)}
													class="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
												>
													Ignore
												</button>
											</div>
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}

					<!-- Current Dependencies -->
					{#if issue.dependencies.length > 0}
						<div class="space-y-2">
							{#each issue.dependencies as depId}
								{@const dep = issueStore.getById(depId)}
								{#if dep}
									<div class="flex items-center gap-3 p-3 rounded-lg {dep.status === 'closed'
										? 'bg-gray-50 border border-gray-200'
										: 'bg-red-50 border border-red-200'}">
										<div
											class="w-2 h-2 rounded-full {dep.status === 'closed'
												? 'bg-green-500'
												: dep.status === 'in_progress'
													? 'bg-blue-500'
													: 'bg-red-500'}"
										></div>
										<a href="/issue/{dep.id}" class="flex-1 font-medium text-gray-900 hover:text-blue-600 truncate">
											{dep.title}
										</a>
										<span class="text-xs {dep.status === 'closed' ? 'text-green-600' : 'text-red-600'} font-medium">
											{dep.status === 'closed' ? 'Done' : 'Not done'}
										</span>
										<button
											onclick={() => reverseDependency(dep.id)}
											class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
											title="Reverse direction"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
											</svg>
										</button>
										<button
											onclick={() => removeDependency(dep.id)}
											class="p-1 text-gray-400 hover:text-red-600 transition-colors"
											title="Remove prerequisite"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<p class="text-sm text-gray-400">Nothing needs to be done first</p>
					{/if}
				</div>

				<!-- Required By (tasks waiting on this one) -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<h3 class="text-sm font-medium text-gray-500">
							Required By ({blocking.length})
						</h3>
						{#if availableForBlocking.length > 0}
							<button
								onclick={() => (showAddBlocking = !showAddBlocking)}
								class="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
							>
								<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								Add
							</button>
						{/if}
					</div>

					<!-- Manual Add Blocking Dropdown -->
					{#if showAddBlocking && availableForBlocking.length > 0}
						<div class="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
							<p class="text-xs text-gray-500 mb-2">Select an issue that should wait for this one:</p>
							<div class="space-y-1 max-h-40 overflow-y-auto">
								{#each availableForBlocking as target}
									<button
										onclick={() => addAsBlockerTo(target.id)}
										class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors flex items-center justify-between"
									>
										<span class="truncate">{target.title}</span>
										<span class="text-xs text-gray-400 ml-2">P{target.priority}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if blocking.length > 0}
						<div class="space-y-2">
							{#each blocking as blocked}
								<div class="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
									<div class="w-2 h-2 rounded-full bg-purple-500"></div>
									<a href="/issue/{blocked.id}" class="flex-1 font-medium text-gray-900 hover:text-blue-600 truncate">
										{blocked.title}
									</a>
									<span class="text-xs text-gray-500">Waiting on this</span>
									<button
										onclick={() => reverseBlocking(blocked.id)}
										class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
										title="Reverse direction"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
										</svg>
									</button>
									<button
										onclick={() => removeBlocking(blocked.id)}
										class="p-1 text-gray-400 hover:text-red-600 transition-colors"
										title="Remove requirement"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-gray-400">No tasks waiting on this</p>
					{/if}
				</div>

				<!-- Create Related Issue -->
				<div class="pt-4 border-t border-gray-100">
					<div class="flex items-center justify-between mb-2">
						<h3 class="text-sm font-medium text-gray-500">Create Related Issue</h3>
						<button
							onclick={() => (showCreateRelated = !showCreateRelated)}
							class="text-xs font-medium text-green-600 hover:text-green-700 flex items-center gap-1"
						>
							<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
							New Issue
						</button>
					</div>

					{#if showCreateRelated}
						<div class="p-3 bg-green-50 border border-green-200 rounded-lg space-y-3">
							<input
								type="text"
								bind:value={newRelatedTitle}
								placeholder="New issue title..."
								class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
							<div class="flex items-center gap-4">
								<label class="flex items-center gap-2 text-sm">
									<input
										type="radio"
										bind:group={newRelatedType}
										value="blocks"
										class="text-green-600"
									/>
									<span>This blocks new issue</span>
								</label>
								<label class="flex items-center gap-2 text-sm">
									<input
										type="radio"
										bind:group={newRelatedType}
										value="dependency"
										class="text-green-600"
									/>
									<span>New issue blocks this</span>
								</label>
							</div>
							<div class="flex items-center gap-2">
								<button
									onclick={createRelatedIssue}
									disabled={!newRelatedTitle.trim()}
									class="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
								>
									Create & Open
								</button>
								<button
									onclick={() => { showCreateRelated = false; newRelatedTitle = ''; }}
									class="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
								>
									Cancel
								</button>
							</div>
						</div>
					{:else}
						<p class="text-sm text-gray-400">Quickly create issues discovered while working on this one</p>
					{/if}
				</div>

				<!-- AI Suggested Actions -->
				{#if issue.status !== 'closed'}
					<div class="pt-4 border-t border-gray-100">
						<SuggestedActions {issue} />
					</div>
				{/if}

				<!-- Planning Assistant for Goal-type Issues -->
				{#if isGoalType}
					<div class="pt-6 border-t border-gray-100">
						<PlanningAssistant goalId={issue.id} />
					</div>
				{/if}

				<!-- Metadata -->
				<div class="pt-4 border-t border-gray-100 text-sm text-gray-500">
					<p>Created {formatDate(issue.createdAt)}</p>
					{#if issue.updatedAt !== issue.createdAt}
						<p>Updated {formatDate(issue.updatedAt)}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirm}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
				<h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Issue?</h3>
				<p class="text-gray-600 mb-6">
					This will permanently delete "{issue.title}" and remove it from all dependencies.
				</p>
				<div class="flex items-center gap-3">
					<button
						onclick={handleDelete}
						class="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
					>
						Delete
					</button>
					<button
						onclick={() => (showDeleteConfirm = false)}
						class="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

<!-- Task Dialog Modal -->
{#if showTaskDialog && issue}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="w-full max-w-lg h-[600px] max-h-[80vh]">
			<TaskDialog {issue} onClose={() => (showTaskDialog = false)} />
		</div>
	</div>
{/if}

<!-- Toast notification -->
{#if toast}
	<Toast
		message={toast.message}
		action={toast.action}
		onClose={() => (toast = null)}
	/>
{/if}
