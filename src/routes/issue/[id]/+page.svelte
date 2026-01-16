<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { PRIORITY_LABELS, TYPE_LABELS, STATUS_LABELS } from '$lib/types/issue';
	import type { IssueStatus } from '$lib/types/issue';
	import IssueForm from '$lib/components/IssueForm.svelte';
	import TaskDialog from '$lib/components/TaskDialog.svelte';
	import DependencyGraph from '$lib/components/DependencyGraph.svelte';

	let id = $derived($page.params.id ?? '');
	let issue = $derived(id ? issueStore.getById(id) ?? null : null);

	// All issues in the current project for the graph
	let projectIssues = $derived(issueStore.issues);

	// UI state
	let editing = $state(false);
	let showDeleteConfirm = $state(false);

	// Status change
	function handleStatusChange(newStatus: IssueStatus) {
		if (issue) {
			issueStore.updateStatus(issue.id, newStatus);
		}
	}

	// Delete
	function handleDelete() {
		if (issue) {
			issueStore.delete(issue.id);
			goto('/');
		}
	}

	// Handle node selection from graph - navigate to that issue
	function handleNodeSelect(issueId: string) {
		if (issueId !== id) {
			goto(`/issue/${issueId}`);
		}
	}

	const statusColors: Record<string, string> = {
		open: 'bg-green-100 text-green-800',
		in_progress: 'bg-blue-100 text-blue-800',
		closed: 'bg-gray-100 text-gray-600',
		failed: 'bg-red-100 text-red-800'
	};

	const priorityColors: Record<number, string> = {
		0: 'bg-red-100 text-red-800',
		1: 'bg-orange-100 text-orange-800',
		2: 'bg-yellow-100 text-yellow-800',
		3: 'bg-blue-100 text-blue-800',
		4: 'bg-gray-100 text-gray-600'
	};
</script>

<svelte:head>
	<title>{issue?.title ?? 'Issue'}</title>
</svelte:head>

{#if !issue}
	<div class="flex items-center justify-center h-screen">
		<div class="text-center">
			<h2 class="text-xl font-medium text-gray-900 mb-2">Issue not found</h2>
			<p class="text-gray-500 mb-4">This issue may have been deleted.</p>
			<a
				href="/"
				class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
			>
				Back to Issues
			</a>
		</div>
	</div>
{:else if editing}
	<!-- Full-screen edit mode -->
	<div class="max-w-2xl mx-auto p-6">
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
	<!-- Split View: Graph on left, TaskDialog on right -->
	<div class="flex h-screen overflow-hidden">
		<!-- Left: Dependency Graph -->
		<div class="flex-1 min-w-0 border-r border-gray-200 bg-gray-50">
			<DependencyGraph
				currentIssueId={issue.id}
				onNodeSelect={handleNodeSelect}
			/>
		</div>

		<!-- Right: Task Panel -->
		<div class="w-[450px] min-w-[350px] flex flex-col bg-white">
			<!-- Compact Header -->
			<div class="flex-shrink-0 border-b border-gray-200 p-4">
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<span class="text-xs font-medium px-2 py-1 rounded-full {statusColors[issue.status]}">
							{STATUS_LABELS[issue.status]}
						</span>
						<span class="text-xs font-medium px-2 py-1 rounded-full {priorityColors[issue.priority]}">
							{PRIORITY_LABELS[issue.priority]}
						</span>
					</div>
					<div class="flex items-center gap-1">
						<button
							onclick={() => (editing = true)}
							class="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
							title="Edit details"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
						</button>
						<button
							onclick={() => (showDeleteConfirm = true)}
							class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
							title="Delete"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
						<a
							href="/"
							class="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
							title="Back to list"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</a>
					</div>
				</div>
				<h1 class="font-semibold text-gray-900 truncate" title={issue.title}>
					{issue.title}
				</h1>
				{#if issue.description}
					<p class="text-sm text-gray-500 mt-1 line-clamp-2">{issue.description}</p>
				{/if}

				<!-- Quick Status Buttons -->
				<div class="flex items-center gap-1 mt-3">
					{#each Object.entries(STATUS_LABELS) as [value, label]}
						<button
							onclick={() => handleStatusChange(value as IssueStatus)}
							class="px-2 py-1 text-xs font-medium rounded transition-colors {issue.status === value
								? 'bg-blue-600 text-white'
								: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<!-- TaskDialog (embedded, fills remaining space) -->
			<div class="flex-1 min-h-0 overflow-hidden">
				<TaskDialog {issue} embedded={true} />
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl p-6 max-w-sm w-full">
			<h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Issue?</h3>
			<p class="text-gray-600 mb-4">
				This will permanently delete "{issue?.title}". This action cannot be undone.
			</p>
			<div class="flex gap-3 justify-end">
				<button
					onclick={() => (showDeleteConfirm = false)}
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
				>
					Cancel
				</button>
				<button
					onclick={handleDelete}
					class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
