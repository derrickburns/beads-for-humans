<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import type { Issue } from '$lib/types/issue';
	import HelpTooltip from './HelpTooltip.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}
	let { isOpen, onClose }: Props = $props();

	interface DependencyResult {
		issueId: string;
		dependsOn: string[];
		reasoning: string;
	}

	interface RebuildResult {
		dependencies: DependencyResult[];
		summary: string;
		cyclesDetected: string[][];
		changesCount: number;
	}

	// State
	let analyzing = $state(false);
	let error = $state<string | null>(null);
	let rebuildResult = $state<RebuildResult | null>(null);
	let searchQuery = $state('');
	let expandedIssueId = $state<string | null>(null);
	let showAdvanced = $state(false);

	// Get issue by ID helper
	function getIssue(id: string): Issue | undefined {
		return issueStore.getById(id);
	}

	// Filtered open issues
	let openIssues = $derived.by(() => {
		let issues = issueStore.issues.filter(i => i.status !== 'closed');
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			issues = issues.filter(i =>
				i.title.toLowerCase().includes(q) ||
				i.id.toLowerCase().includes(q)
			);
		}
		return issues.sort((a, b) => a.priority - b.priority);
	});

	// Get status color
	function getStatusColor(issue: Issue): string {
		if (issue.status === 'closed') return 'bg-gray-400';
		const isBlocked = issue.dependencies.some(depId => {
			const dep = issueStore.getById(depId);
			return dep && dep.status !== 'closed';
		});
		if (isBlocked) return 'bg-amber-500';
		if (issue.status === 'in_progress') return 'bg-blue-500';
		return 'bg-green-500';
	}

	// Get proposed changes for an issue (if AI has analyzed)
	function getProposedChanges(issue: Issue): { added: string[]; removed: string[] } | null {
		if (!rebuildResult) return null;
		const result = rebuildResult.dependencies.find(d => d.issueId === issue.id);
		if (!result) return null;

		const currentDeps = new Set(issue.dependencies);
		const newDeps = new Set(result.dependsOn);

		const added = result.dependsOn.filter(d => !currentDeps.has(d));
		const removed = issue.dependencies.filter(d => !newDeps.has(d));

		if (added.length === 0 && removed.length === 0) return null;
		return { added, removed };
	}

	// Analyze with AI
	async function analyzeWithAI() {
		analyzing = true;
		error = null;
		rebuildResult = null;

		try {
			const response = await fetch('/api/rebuild-dependencies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issues: issueStore.issues
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to analyze dependencies');
			}

			rebuildResult = await response.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to analyze dependencies';
		} finally {
			analyzing = false;
		}
	}

	// Apply all AI changes
	function applyAllChanges() {
		if (!rebuildResult) return;

		for (const dep of rebuildResult.dependencies) {
			const issue = issueStore.getById(dep.issueId);
			if (issue) {
				issueStore.update(dep.issueId, { dependencies: dep.dependsOn });
			}
		}
		rebuildResult = null;
	}

	// Apply single issue's AI changes
	function applyIssueChanges(issueId: string) {
		if (!rebuildResult) return;

		const result = rebuildResult.dependencies.find(d => d.issueId === issueId);
		if (result) {
			issueStore.update(issueId, { dependencies: result.dependsOn });
		}
	}

	// Dismiss AI suggestion for an issue
	function dismissIssueChanges(issueId: string) {
		if (!rebuildResult) return;

		rebuildResult = {
			...rebuildResult,
			dependencies: rebuildResult.dependencies.filter(d => d.issueId !== issueId)
		};
	}

	// Manual dependency management
	function addDependency(issueId: string, depId: string) {
		const issue = issueStore.getById(issueId);
		if (issue) {
			const newDeps = [...issue.dependencies, depId];
			issueStore.update(issueId, { dependencies: newDeps });
		}
	}

	function removeDependency(issueId: string, depId: string) {
		const issue = issueStore.getById(issueId);
		if (issue) {
			const newDeps = issue.dependencies.filter(id => id !== depId);
			issueStore.update(issueId, { dependencies: newDeps });
		}
	}

	// Get available dependencies for an issue
	function getAvailableDeps(issue: Issue): Issue[] {
		return issueStore.issues
			.filter(i => i.status !== 'closed')
			.filter(i => i.id !== issue.id)
			.filter(i => !issue.dependencies.includes(i.id))
			.filter(i => !issueStore.wouldCreateCycle(issue.id, i.id));
	}

	// Close and reset
	function handleClose() {
		rebuildResult = null;
		searchQuery = '';
		expandedIssueId = null;
		error = null;
		onClose();
	}

	// Count total proposed changes
	let totalChanges = $derived.by(() => {
		if (!rebuildResult) return 0;
		let count = 0;
		for (const issue of openIssues) {
			const changes = getProposedChanges(issue);
			if (changes) {
				count += changes.added.length + changes.removed.length;
			}
		}
		return count;
	});
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
		<!-- Backdrop -->
		<button
			type="button"
			class="absolute inset-0 bg-gray-900/50 w-full h-full cursor-default"
			onclick={handleClose}
			aria-label="Close modal"
		></button>

		<!-- Panel -->
		<div class="fixed inset-4 md:inset-8 lg:inset-12 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
				<div class="flex items-center gap-3">
					<h2 class="text-xl font-semibold text-gray-900">Task Order</h2>
					<HelpTooltip text="Task order determines what must be done before each task can start. Use AI to suggest order or edit manually." position="right" />
				</div>
				<div class="flex items-center gap-3">
					<!-- AI Rebuild Button -->
					<button
						onclick={analyzeWithAI}
						disabled={analyzing}
						class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
					>
						{#if analyzing}
							<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Analyzing...
						{:else}
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							AI Suggest Order
						{/if}
					</button>

					<button
						onclick={handleClose}
						class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
						aria-label="Close"
					>
						<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Error Banner -->
			{#if error}
				<div class="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center gap-3">
					<svg class="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="text-sm text-red-800">{error}</span>
					<button onclick={() => error = null} class="ml-auto p-1 hover:bg-red-100 rounded" aria-label="Dismiss error">
						<svg class="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/if}

			<!-- AI Summary Banner (when proposals exist) -->
			{#if rebuildResult && totalChanges > 0}
				<div class="px-6 py-3 bg-purple-50 border-b border-purple-200 flex items-center justify-between gap-4">
					<div class="flex items-center gap-3">
						<svg class="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
						<span class="text-sm text-purple-800">
							<strong>{totalChanges}</strong> changes suggested. Review below or apply all at once.
						</span>
					</div>
					<div class="flex items-center gap-2">
						<button
							onclick={applyAllChanges}
							class="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
						>
							Apply All
						</button>
						<button
							onclick={() => rebuildResult = null}
							class="px-3 py-1.5 text-purple-700 text-sm font-medium hover:bg-purple-100 rounded-lg transition-colors"
						>
							Dismiss
						</button>
					</div>
				</div>
			{/if}

			<!-- Search -->
			<div class="px-6 py-3 border-b border-gray-100">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search tasks..."
					class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<!-- Content: Issue List with Inline Dependencies -->
			<div class="flex-1 overflow-y-auto">
				<div class="divide-y divide-gray-100">
					{#each openIssues as issue (issue.id)}
						{@const proposedChanges = getProposedChanges(issue)}
						{@const isExpanded = expandedIssueId === issue.id}
						{@const available = getAvailableDeps(issue)}

						<div class="p-4 hover:bg-gray-50 transition-colors {proposedChanges ? 'bg-purple-50/50' : ''}">
							<!-- Issue Header Row -->
							<div class="flex items-start gap-3">
								<div class="w-3 h-3 rounded-full {getStatusColor(issue)} mt-1.5 flex-shrink-0"></div>

								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<p class="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
										<span class="text-xs text-gray-400">P{issue.priority}</span>
									</div>

									<!-- Current Dependencies (with inline remove) -->
									{#if issue.dependencies.length > 0 || proposedChanges}
										<div class="flex flex-wrap gap-1.5 mt-2">
											{#each issue.dependencies as depId}
												{@const dep = getIssue(depId)}
												{@const isBeingRemoved = proposedChanges?.removed.includes(depId)}
												{#if dep}
													<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full {isBeingRemoved ? 'bg-red-100 text-red-700 line-through' : 'bg-gray-100 text-gray-700'}">
														{dep.title.length > 20 ? dep.title.slice(0, 20) + '...' : dep.title}
														<button
															onclick={() => removeDependency(issue.id, depId)}
															class="p-0.5 hover:bg-gray-200 rounded-full"
															aria-label="Remove dependency"
														>
															<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
															</svg>
														</button>
													</span>
												{/if}
											{/each}

											<!-- AI Proposed Additions -->
											{#if proposedChanges}
												{#each proposedChanges.added as addedId}
													{@const addedIssue = getIssue(addedId)}
													{#if addedIssue}
														<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full border border-dashed border-green-400">
															<span class="font-medium">+</span>
															{addedIssue.title.length > 20 ? addedIssue.title.slice(0, 20) + '...' : addedIssue.title}
														</span>
													{/if}
												{/each}
											{/if}
										</div>
									{:else}
										<p class="text-xs text-gray-400 mt-1">No prerequisites</p>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-1 flex-shrink-0">
									{#if proposedChanges}
										<button
											onclick={() => applyIssueChanges(issue.id)}
											class="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
											title="Accept AI suggestion"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
										</button>
										<button
											onclick={() => dismissIssueChanges(issue.id)}
											class="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
											title="Dismiss suggestion"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									{/if}

									{#if available.length > 0}
										<button
											onclick={() => expandedIssueId = isExpanded ? null : issue.id}
											class="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors {isExpanded ? 'bg-blue-100' : ''}"
											title="Add prerequisite"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
											</svg>
										</button>
									{/if}
								</div>
							</div>

							<!-- Expanded: Add Prerequisite -->
							{#if isExpanded}
								<div class="mt-3 ml-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
									<p class="text-xs font-medium text-blue-800 mb-2">Add prerequisite:</p>
									<div class="max-h-32 overflow-y-auto space-y-1">
										{#each available as avail}
											<button
												onclick={() => { addDependency(issue.id, avail.id); expandedIssueId = null; }}
												class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-blue-100 rounded transition-colors"
											>
												<div class="w-2 h-2 rounded-full {getStatusColor(avail)}"></div>
												<span class="flex-1 truncate">{avail.title}</span>
												<svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
												</svg>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}

					{#if openIssues.length === 0}
						<div class="p-8 text-center text-gray-500">
							{#if searchQuery}
								No tasks match your search.
							{:else}
								No open tasks to manage.
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer with Stats -->
			<div class="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
				<div class="flex items-center gap-6 text-sm text-gray-500">
					<span><strong class="text-gray-900">{openIssues.length}</strong> open tasks</span>
					<span><strong class="text-green-600">{issueStore.ready.length}</strong> can start</span>
					<span><strong class="text-amber-600">{issueStore.blocked.length}</strong> waiting</span>
				</div>

				<!-- Advanced Options Toggle -->
				<button
					onclick={() => showAdvanced = !showAdvanced}
					class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
				>
					Advanced
					<svg class="w-4 h-4 transition-transform {showAdvanced ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			</div>

			<!-- Advanced Options (Progressive Disclosure) -->
			{#if showAdvanced}
				<div class="px-6 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
					<h4 class="text-sm font-medium text-gray-700">Advanced Options</h4>
					<div class="grid grid-cols-2 gap-4">
						<div class="text-sm">
							<p class="text-gray-600">Total prerequisites: <strong>{issueStore.issues.reduce((acc, i) => acc + i.dependencies.length, 0)}</strong></p>
						</div>
						<div class="text-sm">
							<p class="text-gray-600">Closed tasks: <strong>{issueStore.issues.filter(i => i.status === 'closed').length}</strong></p>
						</div>
					</div>
					<p class="text-xs text-gray-400">
						Tip: Click the + button on any task to add a prerequisite. AI suggestions appear with green badges when you click "AI Suggest Order".
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
