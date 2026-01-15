<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import type { Issue } from '$lib/types/issue';

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
	let mode = $state<'overview' | 'preview' | 'manual'>('overview');
	let analyzing = $state(false);
	let applying = $state(false);
	let error = $state<string | null>(null);
	let rebuildResult = $state<RebuildResult | null>(null);
	let selectedIssueId = $state<string | null>(null);
	let searchQuery = $state('');

	// Get issue by ID helper
	function getIssue(id: string): Issue | undefined {
		return issueStore.getById(id);
	}

	// Filtered issues for manual mode
	let filteredIssues = $derived.by(() => {
		let issues = issueStore.issues.filter(i => i.status !== 'closed');
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			issues = issues.filter(i =>
				i.title.toLowerCase().includes(q) ||
				i.id.toLowerCase().includes(q)
			);
		}
		return issues.sort((a, b) => a.title.localeCompare(b.title));
	});

	// Selected issue for manual mode
	let selectedIssue = $derived(selectedIssueId ? issueStore.getById(selectedIssueId) : null);

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

	// Analyze and rebuild dependencies with AI
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
			mode = 'preview';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to analyze dependencies';
		} finally {
			analyzing = false;
		}
	}

	// Apply the rebuilt dependencies
	async function applyChanges() {
		if (!rebuildResult) return;
		applying = true;

		try {
			for (const dep of rebuildResult.dependencies) {
				const issue = issueStore.getById(dep.issueId);
				if (issue) {
					issueStore.update(dep.issueId, { dependencies: dep.dependsOn });
				}
			}
			mode = 'overview';
			rebuildResult = null;
		} catch (e) {
			error = 'Failed to apply changes';
		} finally {
			applying = false;
		}
	}

	// Manual mode functions
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

	// Close and reset
	function handleClose() {
		mode = 'overview';
		rebuildResult = null;
		selectedIssueId = null;
		searchQuery = '';
		error = null;
		onClose();
	}

	// Get available issues to add as dependencies
	function getAvailableDeps(issue: Issue): Issue[] {
		return issueStore.issues
			.filter(i => i.status !== 'closed')
			.filter(i => i.id !== issue.id)
			.filter(i => !issue.dependencies.includes(i.id))
			.filter(i => !issueStore.wouldCreateCycle(issue.id, i.id));
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-gray-900/50" onclick={handleClose}></div>

		<!-- Panel -->
		<div class="fixed inset-4 md:inset-8 lg:inset-12 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
				<div>
					<h2 class="text-xl font-semibold text-gray-900">Task Order Manager</h2>
					<p class="text-sm text-gray-500 mt-0.5">
						{#if mode === 'overview'}
							Rebuild task order with AI or edit manually
						{:else if mode === 'preview'}
							Review AI-proposed task order changes
						{:else}
							Manually edit what needs to be done first
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					{#if mode !== 'overview'}
						<button
							onclick={() => { mode = 'overview'; rebuildResult = null; selectedIssueId = null; }}
							class="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
						>
							Back
						</button>
					{/if}
					<button
						onclick={handleClose}
						class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
					<svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="text-sm text-red-800">{error}</span>
					<button onclick={() => error = null} class="ml-auto p-1 hover:bg-red-100 rounded">
						<svg class="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/if}

			<!-- Content -->
			<div class="flex-1 overflow-y-auto">
				{#if mode === 'overview'}
					<!-- Overview Mode -->
					<div class="p-6 space-y-6">
						<!-- AI Rebuild Section -->
						<div class="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
							<div class="flex items-start gap-4">
								<div class="p-3 bg-purple-100 rounded-xl">
									<svg class="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
									</svg>
								</div>
								<div class="flex-1">
									<h3 class="text-lg font-semibold text-gray-900">Rebuild Task Order with AI</h3>
									<p class="text-sm text-gray-600 mt-1">
										AI will analyze all your tasks and their descriptions to determine the correct order.
										It will ensure no circular waiting exists and only set requirements where there's a clear reason.
									</p>
									<div class="mt-4">
										<button
											onclick={analyzeWithAI}
											disabled={analyzing}
											class="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
										>
											{#if analyzing}
												<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
												Analyzing Issues...
											{:else}
												<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
												</svg>
												Rebuild Task Order
											{/if}
										</button>
									</div>
								</div>
							</div>
						</div>

						<!-- Current Status -->
						<div class="grid grid-cols-4 gap-4">
							<div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
								<div class="text-3xl font-bold text-gray-900">{issueStore.issues.filter(i => i.status !== 'closed').length}</div>
								<div class="text-sm text-gray-500 mt-1">Open Issues</div>
							</div>
							<div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
								<div class="text-3xl font-bold text-gray-900">{issueStore.issues.reduce((acc, i) => acc + i.dependencies.length, 0)}</div>
								<div class="text-sm text-gray-500 mt-1">Prerequisites</div>
							</div>
							<div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
								<div class="text-3xl font-bold text-green-600">{issueStore.ready.length}</div>
								<div class="text-sm text-gray-500 mt-1">Can Start</div>
							</div>
							<div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
								<div class="text-3xl font-bold text-amber-600">{issueStore.blocked.length}</div>
								<div class="text-sm text-gray-500 mt-1">Waiting</div>
							</div>
						</div>

						<!-- Manual Edit Option -->
						<div class="border border-gray-200 rounded-lg p-4">
							<div class="flex items-center justify-between">
								<div>
									<h4 class="font-medium text-gray-900">Manual Editing</h4>
									<p class="text-sm text-gray-500 mt-0.5">Inspect and manually adjust task order</p>
								</div>
								<button
									onclick={() => mode = 'manual'}
									class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
								>
									Edit Manually
								</button>
							</div>
						</div>

						<!-- Current Task Order -->
						<div>
							<h4 class="font-medium text-gray-900 mb-3">Current Task Order</h4>
							<div class="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
								{#each issueStore.issues.filter(i => i.status !== 'closed') as issue}
									<div class="p-3 flex items-start gap-3">
										<div class="w-3 h-3 rounded-full {getStatusColor(issue)} mt-1.5"></div>
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
											{#if issue.dependencies.length > 0}
												<div class="flex flex-wrap gap-1 mt-1">
													{#each issue.dependencies as depId}
														{@const dep = getIssue(depId)}
														{#if dep}
															<span class="inline-flex items-center px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
																{dep.title.length > 25 ? dep.title.slice(0, 25) + '...' : dep.title}
															</span>
														{/if}
													{/each}
												</div>
											{:else}
												<p class="text-xs text-gray-400 mt-1">No dependencies</p>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

				{:else if mode === 'preview' && rebuildResult}
					<!-- Preview Mode -->
					<div class="p-6 space-y-6">
						<!-- Summary -->
						<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
							<h4 class="font-medium text-blue-900">AI Analysis Complete</h4>
							<p class="text-sm text-blue-800 mt-1">{rebuildResult.summary}</p>
							<p class="text-sm text-blue-700 mt-2">
								<strong>{rebuildResult.changesCount}</strong> changes proposed
							</p>
						</div>

						{#if rebuildResult.cyclesDetected.length > 0}
							<div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
								<h4 class="font-medium text-amber-900">Circular Waiting Prevented</h4>
								<p class="text-sm text-amber-800 mt-1">
									The AI suggested some task orders that would create circular waiting. These have been automatically removed.
								</p>
							</div>
						{/if}

						<!-- Proposed Changes -->
						<div>
							<h4 class="font-medium text-gray-900 mb-3">Proposed Task Order</h4>
							<div class="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
								{#each rebuildResult.dependencies as dep}
									{@const issue = getIssue(dep.issueId)}
									{#if issue}
										{@const currentDeps = new Set(issue.dependencies)}
										{@const newDeps = new Set(dep.dependsOn)}
										{@const added = dep.dependsOn.filter(d => !currentDeps.has(d))}
										{@const removed = issue.dependencies.filter(d => !newDeps.has(d))}
										{@const hasChanges = added.length > 0 || removed.length > 0}
										<div class="p-4 {hasChanges ? 'bg-yellow-50' : ''}">
											<div class="flex items-start gap-3">
												<div class="w-3 h-3 rounded-full {getStatusColor(issue)} mt-1.5"></div>
												<div class="flex-1">
													<p class="text-sm font-medium text-gray-900">{issue.title}</p>
													<p class="text-xs text-gray-500 mt-1 italic">{dep.reasoning}</p>

													{#if hasChanges}
														<div class="mt-2 space-y-1">
															{#each added as addedId}
																{@const addedIssue = getIssue(addedId)}
																{#if addedIssue}
																	<div class="flex items-center gap-2 text-xs">
																		<span class="px-1.5 py-0.5 bg-green-100 text-green-800 rounded font-medium">+ ADD</span>
																		<span class="text-gray-700">{addedIssue.title}</span>
																	</div>
																{/if}
															{/each}
															{#each removed as removedId}
																{@const removedIssue = getIssue(removedId)}
																{#if removedIssue}
																	<div class="flex items-center gap-2 text-xs">
																		<span class="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-medium">- REMOVE</span>
																		<span class="text-gray-700 line-through">{removedIssue.title}</span>
																	</div>
																{/if}
															{/each}
														</div>
													{:else}
														<p class="text-xs text-gray-400 mt-1">No changes</p>
													{/if}
												</div>
											</div>
										</div>
									{/if}
								{/each}
							</div>
						</div>

						<!-- Action Buttons -->
						<div class="flex items-center gap-4">
							<button
								onclick={applyChanges}
								disabled={applying}
								class="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
							>
								{#if applying}
									<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
									Applying...
								{:else}
									<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									Apply All Changes
								{/if}
							</button>
							<button
								onclick={() => { mode = 'overview'; rebuildResult = null; }}
								class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>

				{:else if mode === 'manual'}
					<!-- Manual Edit Mode -->
					<div class="flex h-full">
						<!-- Left: Issue List -->
						<div class="w-1/3 border-r border-gray-200 flex flex-col">
							<div class="p-4 border-b border-gray-100">
								<input
									type="text"
									bind:value={searchQuery}
									placeholder="Search issues..."
									class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							<div class="flex-1 overflow-y-auto">
								{#each filteredIssues as issue}
									<button
										onclick={() => selectedIssueId = issue.id}
										class="w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors {selectedIssueId === issue.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}"
									>
										<div class="flex items-start gap-3">
											<div class="w-3 h-3 rounded-full {getStatusColor(issue)} mt-1"></div>
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
												<p class="text-xs text-gray-500">{issue.dependencies.length} deps</p>
											</div>
										</div>
									</button>
								{/each}
							</div>
						</div>

						<!-- Right: Edit Panel -->
						<div class="flex-1 overflow-y-auto p-4">
							{#if selectedIssue}
								<div class="space-y-6">
									<div>
										<h3 class="font-semibold text-gray-900">{selectedIssue.title}</h3>
										{#if selectedIssue.description}
											<p class="text-sm text-gray-600 mt-1">{selectedIssue.description}</p>
										{/if}
									</div>

									<!-- Must Complete First -->
									<div>
										<h4 class="text-sm font-medium text-gray-700 mb-2">Must Complete First</h4>
										{#if selectedIssue.dependencies.length > 0}
											<div class="space-y-2">
												{#each selectedIssue.dependencies as depId}
													{@const dep = getIssue(depId)}
													{#if dep}
														<div class="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded">
															<span class="text-sm flex-1">{dep.title}</span>
															<button
																onclick={() => removeDependency(selectedIssue.id, depId)}
																class="p-1 text-red-600 hover:bg-red-100 rounded"
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

									<!-- Add Prerequisite -->
									<div>
										<h4 class="text-sm font-medium text-gray-700 mb-2">Add Prerequisite</h4>
										{@const available = getAvailableDeps(selectedIssue)}
										{#if available.length > 0}
											<div class="max-h-48 overflow-y-auto border border-gray-200 rounded">
												{#each available as issue}
													<button
														onclick={() => addDependency(selectedIssue.id, issue.id)}
														class="w-full flex items-center gap-2 p-2 text-left hover:bg-green-50 border-b border-gray-100 last:border-b-0"
													>
														<span class="text-sm flex-1">{issue.title}</span>
														<svg class="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
														</svg>
													</button>
												{/each}
											</div>
										{:else}
											<p class="text-sm text-gray-400">No available issues to add</p>
										{/if}
									</div>
								</div>
							{:else}
								<div class="flex items-center justify-center h-full text-gray-500">
									<p>Select a task to edit what needs to be done first</p>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
				<button
					onclick={handleClose}
					class="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
