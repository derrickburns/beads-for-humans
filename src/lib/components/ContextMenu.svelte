<script lang="ts">
	import { goto } from '$app/navigation';
	import { issueStore } from '$lib/stores/issues.svelte';
	import type { Issue, IssueStatus } from '$lib/types/issue';

	interface Props {
		issue: Issue;
		x: number;
		y: number;
		onClose: () => void;
	}

	let { issue, x, y, onClose }: Props = $props();

	// Adjust position to stay within viewport
	let menuRef = $state<HTMLDivElement | null>(null);
	let adjustedX = $state(x);
	let adjustedY = $state(y);

	$effect(() => {
		if (menuRef) {
			const rect = menuRef.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Adjust X if menu would go off right edge
			if (x + rect.width > viewportWidth - 10) {
				adjustedX = viewportWidth - rect.width - 10;
			}

			// Adjust Y if menu would go off bottom edge
			if (y + rect.height > viewportHeight - 10) {
				adjustedY = viewportHeight - rect.height - 10;
			}
		}
	});

	function handleAction(action: () => void) {
		action();
		onClose();
	}

	function viewDetails() {
		goto(`/issue/${issue.id}`);
	}

	function editIssue() {
		goto(`/issue/${issue.id}?edit=true`);
	}

	function setStatus(status: IssueStatus) {
		issueStore.updateStatus(issue.id, status);
	}

	function deleteIssue() {
		if (confirm(`Delete "${issue.title}"?`)) {
			issueStore.delete(issue.id);
		}
	}

	function viewInGraph() {
		goto(`/?focus=${issue.id}`);
	}

	const statusActions: { status: IssueStatus; label: string; icon: string; color: string }[] = [
		{ status: 'open', label: 'Mark Open', icon: '○', color: 'text-green-600' },
		{ status: 'in_progress', label: 'Start Working', icon: '◐', color: 'text-blue-600' },
		{ status: 'closed', label: 'Mark Done', icon: '●', color: 'text-gray-600' }
	];

	// Filter out current status
	let availableStatusActions = $derived(
		statusActions.filter(a => a.status !== issue.status)
	);

	// Check if issue has blockers
	let hasBlockers = $derived(issueStore.getBlockers(issue.id).length > 0);
	let isBlocking = $derived(issueStore.getBlocking(issue.id).length > 0);
</script>

<svelte:window on:click={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} />

<div
	bind:this={menuRef}
	class="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] overflow-hidden"
	style="left: {adjustedX}px; top: {adjustedY}px;"
	role="menu"
	onclick={(e) => e.stopPropagation()}
	oncontextmenu={(e) => e.preventDefault()}
>
	<!-- Issue title header -->
	<div class="px-3 py-2 border-b border-gray-100">
		<p class="text-sm font-medium text-gray-900 truncate max-w-[200px]">{issue.title}</p>
		<p class="text-xs text-gray-500">P{issue.priority} · {issue.type}</p>
	</div>

	<!-- Primary actions -->
	<div class="py-1">
		<button
			onclick={() => handleAction(viewDetails)}
			class="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
		>
			<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
			</svg>
			View Details
		</button>

		<button
			onclick={() => handleAction(editIssue)}
			class="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
		>
			<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
			</svg>
			Edit
		</button>
	</div>

	<!-- Status changes -->
	<div class="py-1 border-t border-gray-100">
		{#each availableStatusActions as action}
			<button
				onclick={() => handleAction(() => setStatus(action.status))}
				class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 {action.color}"
			>
				<span class="w-4 text-center">{action.icon}</span>
				{action.label}
			</button>
		{/each}
	</div>

	<!-- Dependency info -->
	{#if hasBlockers || isBlocking}
		<div class="py-1 border-t border-gray-100">
			{#if hasBlockers}
				<div class="px-3 py-1.5 text-xs text-amber-600 flex items-center gap-1">
					<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					{issueStore.getBlockers(issue.id).length} blocker{issueStore.getBlockers(issue.id).length > 1 ? 's' : ''}
				</div>
			{/if}
			{#if isBlocking}
				<div class="px-3 py-1.5 text-xs text-blue-600 flex items-center gap-1">
					<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
					</svg>
					Blocking {issueStore.getBlocking(issue.id).length} issue{issueStore.getBlocking(issue.id).length > 1 ? 's' : ''}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Danger zone -->
	<div class="py-1 border-t border-gray-100">
		<button
			onclick={() => handleAction(deleteIssue)}
			class="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
			</svg>
			Delete
		</button>
	</div>
</div>
