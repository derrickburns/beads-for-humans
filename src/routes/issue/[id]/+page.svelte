<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { issueStore } from '$lib/stores/issues';
	import { PRIORITY_LABELS, TYPE_LABELS, STATUS_LABELS } from '$lib/types/issue';
	import type { IssueStatus } from '$lib/types/issue';
	import IssueForm from '$lib/components/IssueForm.svelte';

	let id = $derived($page.params.id);
	let issue = $derived(issueStore.getById(id));
	let blockers = $derived(issue ? issueStore.getBlockers(issue.id) : []);
	let blocking = $derived(issue ? issueStore.getBlocking(issue.id) : []);

	let editing = $state(false);
	let showDeleteConfirm = $state(false);

	const statusColors: Record<string, string> = {
		open: 'bg-green-100 text-green-800',
		in_progress: 'bg-blue-100 text-blue-800',
		closed: 'bg-gray-100 text-gray-600'
	};

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
						<h1 class="text-2xl font-semibold text-gray-900">{issue.title}</h1>
					</div>

					<div class="flex items-center gap-2">
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
				<!-- Description -->
				{#if issue.description}
					<div>
						<h3 class="text-sm font-medium text-gray-500 mb-2">Description</h3>
						<p class="text-gray-900 whitespace-pre-wrap">{issue.description}</p>
					</div>
				{/if}

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

				<!-- Blockers -->
				{#if blockers.length > 0}
					<div>
						<h3 class="text-sm font-medium text-gray-500 mb-2">
							Blocked by ({blockers.length})
						</h3>
						<div class="space-y-2">
							{#each blockers as blocker}
								<a
									href="/issue/{blocker.id}"
									class="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
								>
									<div
										class="w-2 h-2 rounded-full {blocker.status === 'in_progress'
											? 'bg-blue-500'
											: 'bg-green-500'}"
									></div>
									<span class="font-medium text-gray-900">{blocker.title}</span>
									<span class="text-xs text-gray-500">
										{STATUS_LABELS[blocker.status]}
									</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Blocking -->
				{#if blocking.length > 0}
					<div>
						<h3 class="text-sm font-medium text-gray-500 mb-2">
							Blocking ({blocking.length})
						</h3>
						<div class="space-y-2">
							{#each blocking as blocked}
								<a
									href="/issue/{blocked.id}"
									class="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-amber-500"></div>
									<span class="font-medium text-gray-900">{blocked.title}</span>
									<span class="text-xs text-gray-500">Waiting</span>
								</a>
							{/each}
						</div>
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
