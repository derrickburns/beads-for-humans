<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';

	interface ProjectInfo {
		name: string;
		path: string;
		hasBeads: boolean;
		hasClaude: boolean;
		issueCount?: number;
		openIssues?: number;
		closedIssues?: number;
		lastModified: string;
	}

	interface SyncMatch {
		localIssueId: string;
		localTitle: string;
		externalIssueId: string;
		externalTitle: string;
		externalStatus: string;
		confidence: number;
		shouldClose: boolean;
		reason?: string;
	}

	interface PartialMatch {
		localIssueId: string;
		localTitle: string;
		completedPortion: string;
		remainingWork: string;
		matchedExternalIssues: Array<{
			id: string;
			title: string;
			status: string;
		}>;
		confidence: number;
		suggestedSplit: {
			completedTitle: string;
			remainingTitle: string;
		};
	}

	interface SyncResult {
		projectName: string;
		projectPath: string;
		externalIssues: {
			total: number;
			open: number;
			closed: number;
		};
		matches: SyncMatch[];
		partialMatches: PartialMatch[];
		summary: string;
	}

	// State
	let isOpen = $state(false);
	let projects = $state<ProjectInfo[]>([]);
	let loading = $state(false);
	let selectedProject = $state<ProjectInfo | null>(null);
	let syncResult = $state<SyncResult | null>(null);
	let syncing = $state(false);
	let error = $state<string | null>(null);
	let expandedPartials = $state<Set<string>>(new Set());
	let refactoringIssue = $state<string | null>(null);

	// Load projects when panel opens
	async function loadProjects() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/projects/list');
			if (response.ok) {
				const data = await response.json();
				projects = data.projects;
			} else {
				error = 'Failed to load projects';
			}
		} catch (e) {
			error = 'Failed to connect to server';
		} finally {
			loading = false;
		}
	}

	// Sync with selected project
	async function syncProject(project: ProjectInfo) {
		selectedProject = project;
		syncing = true;
		syncResult = null;
		error = null;

		try {
			const response = await fetch('/api/projects/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectPath: project.path,
					localIssues: issueStore.issues
				})
			});

			if (response.ok) {
				syncResult = await response.json();
			} else {
				const data = await response.json();
				error = data.error || 'Failed to sync project';
			}
		} catch (e) {
			error = 'Failed to connect to server';
		} finally {
			syncing = false;
		}
	}

	// Apply sync matches (close matching issues)
	function applyMatches() {
		if (!syncResult?.matches) return;

		for (const match of syncResult.matches) {
			if (match.shouldClose) {
				issueStore.updateStatus(match.localIssueId, 'closed');
			}
		}

		// Clear sync result after applying
		syncResult = null;
		selectedProject = null;
	}

	// Toggle expanded state of a partial match
	function togglePartialExpanded(issueId: string) {
		const newSet = new Set(expandedPartials);
		if (newSet.has(issueId)) {
			newSet.delete(issueId);
		} else {
			newSet.add(issueId);
		}
		expandedPartials = newSet;
	}

	// Apply refactoring to a partial match
	async function applyRefactor(match: PartialMatch) {
		refactoringIssue = match.localIssueId;

		try {
			// Get the original issue
			const originalIssue = issueStore.issues.find((i) => i.id === match.localIssueId);
			if (!originalIssue) {
				error = 'Original issue not found';
				return;
			}

			// Create a new issue for the remaining work
			const newIssue = issueStore.create({
				title: match.suggestedSplit.remainingTitle,
				description: `${match.remainingWork}\n\n---\n*Refactored from: ${originalIssue.title}*\n*Completed portion: ${match.completedPortion}*`,
				priority: originalIssue.priority,
				type: originalIssue.type,
				dependencies: [...originalIssue.dependencies]
			});

			// Update the original issue title to reflect completed work and close it
			issueStore.update(match.localIssueId, {
				title: match.suggestedSplit.completedTitle,
				description: `${match.completedPortion}\n\n---\n*Remaining work moved to: ${newIssue?.title || 'new issue'}*`
			});
			issueStore.updateStatus(match.localIssueId, 'closed');

			// Remove this partial match from the list
			if (syncResult) {
				syncResult = {
					...syncResult,
					partialMatches: syncResult.partialMatches.filter(
						(p) => p.localIssueId !== match.localIssueId
					)
				};
			}
		} catch (e) {
			error = 'Failed to refactor issue';
		} finally {
			refactoringIssue = null;
		}
	}

	// Skip a partial match (don't refactor)
	function skipPartialMatch(issueId: string) {
		if (syncResult) {
			syncResult = {
				...syncResult,
				partialMatches: syncResult.partialMatches.filter(
					(p) => p.localIssueId !== issueId
				)
			};
		}
	}

	// Toggle panel
	function toggle() {
		isOpen = !isOpen;
		if (isOpen && projects.length === 0) {
			loadProjects();
		}
	}

	// Format relative time
	function formatRelativeTime(isoDate: string): string {
		const date = new Date(isoDate);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	}
</script>

<!-- Toggle Button -->
<button
	onclick={toggle}
	class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
	title="Link to external project"
>
	<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
	</svg>
	<span>Projects</span>
</button>

<!-- Project Panel (Modal/Dropdown) -->
{#if isOpen}
	<div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="project-selector-title" role="dialog" aria-modal="true">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-gray-500 bg-opacity-25" onclick={() => (isOpen = false)}></div>

		<!-- Panel -->
		<div class="fixed inset-y-0 right-0 flex max-w-full pl-10">
			<div class="w-screen max-w-md">
				<div class="flex h-full flex-col bg-white shadow-xl">
					<!-- Header -->
					<div class="px-6 py-4 border-b border-gray-200">
						<div class="flex items-center justify-between">
							<h2 id="project-selector-title" class="text-lg font-semibold text-gray-900">
								Project Context
							</h2>
							<button
								onclick={() => (isOpen = false)}
								class="p-2 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100"
							>
								<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
						<p class="mt-1 text-sm text-gray-500">
							Select a project to sync completed issues
						</p>
					</div>

					<!-- Content -->
					<div class="flex-1 overflow-y-auto px-6 py-4">
						{#if error}
							<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
								{error}
							</div>
						{/if}

						{#if loading}
							<div class="flex items-center justify-center py-8">
								<div class="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
							</div>
						{:else if syncResult}
							<!-- Sync Results -->
							<div class="space-y-4">
								<div class="flex items-center gap-2 text-gray-700">
									<button
										onclick={() => { syncResult = null; selectedProject = null; }}
										class="p-1 hover:bg-gray-100 rounded"
									>
										<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
										</svg>
									</button>
									<span class="font-medium">{syncResult.projectName}</span>
								</div>

								<div class="p-3 bg-gray-50 rounded-lg text-sm">
									<div class="flex justify-between text-gray-600">
										<span>External Issues:</span>
										<span class="font-medium">{syncResult.externalIssues.total}</span>
									</div>
									<div class="flex justify-between text-gray-600 mt-1">
										<span>Closed:</span>
										<span class="font-medium text-green-600">{syncResult.externalIssues.closed}</span>
									</div>
									<div class="flex justify-between text-gray-600 mt-1">
										<span>Open:</span>
										<span class="font-medium text-amber-600">{syncResult.externalIssues.open}</span>
									</div>
								</div>

								<p class="text-sm text-gray-600">{syncResult.summary}</p>

								{#if syncResult.matches.length > 0}
									<div class="space-y-3">
										<h3 class="font-medium text-gray-900 flex items-center gap-2">
											<svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											Complete Matches ({syncResult.matches.length})
										</h3>
										{#each syncResult.matches as match}
											<div class="p-3 bg-green-50 border border-green-200 rounded-lg">
												<div class="flex items-start justify-between">
													<div class="flex-1 min-w-0">
														<p class="text-sm font-medium text-gray-900 truncate">
															{match.localTitle}
														</p>
														<p class="text-xs text-green-700 mt-0.5">
															→ Matches: "{match.externalTitle}"
														</p>
														{#if match.reason}
															<p class="text-xs text-gray-500 mt-1">{match.reason}</p>
														{/if}
													</div>
													<span class="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
														{Math.round(match.confidence * 100)}%
													</span>
												</div>
											</div>
										{/each}

										<button
											onclick={applyMatches}
											class="w-full py-2.5 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
										>
											<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											Mark {syncResult.matches.length} Issue{syncResult.matches.length !== 1 ? 's' : ''} as Complete
										</button>
									</div>
								{/if}

								<!-- Partial Matches - Refactoring Suggestions -->
								{#if syncResult.partialMatches && syncResult.partialMatches.length > 0}
									<div class="space-y-3 mt-4">
										<h3 class="font-medium text-gray-900 flex items-center gap-2">
											<svg class="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
											Partial Progress ({syncResult.partialMatches.length})
										</h3>
										<p class="text-xs text-gray-500">
											Some work has been done on these issues. Consider refactoring to track completed vs remaining work separately.
										</p>

										{#each syncResult.partialMatches as partial}
											<div class="border border-amber-200 rounded-lg overflow-hidden bg-white shadow-sm">
												<!-- Header - Always Visible -->
												<button
													onclick={() => togglePartialExpanded(partial.localIssueId)}
													class="w-full p-3 flex items-start justify-between text-left hover:bg-amber-50/50 transition-colors"
												>
													<div class="flex-1 min-w-0">
														<p class="text-sm font-medium text-gray-900">
															{partial.localTitle}
														</p>
														<div class="flex items-center gap-2 mt-1">
															<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
																{Math.round(partial.confidence * 100)}% match
															</span>
															<span class="text-xs text-gray-500">
																{partial.matchedExternalIssues.length} related issue{partial.matchedExternalIssues.length !== 1 ? 's' : ''}
															</span>
														</div>
													</div>
													<svg
														class="w-5 h-5 text-gray-400 transition-transform {expandedPartials.has(partial.localIssueId) ? 'rotate-180' : ''}"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
													</svg>
												</button>

												<!-- Expanded Details -->
												{#if expandedPartials.has(partial.localIssueId)}
													<div class="border-t border-amber-100 bg-amber-50/30">
														<!-- What's Done vs What Remains -->
														<div class="p-3 space-y-3">
															<div class="flex gap-3">
																<div class="flex-1">
																	<div class="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1">
																		<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
																		</svg>
																		Completed
																	</div>
																	<p class="text-xs text-gray-600 bg-green-50 p-2 rounded border border-green-100">
																		{partial.completedPortion}
																	</p>
																</div>
																<div class="flex-1">
																	<div class="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
																		<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
																		</svg>
																		Remaining
																	</div>
																	<p class="text-xs text-gray-600 bg-amber-50 p-2 rounded border border-amber-100">
																		{partial.remainingWork}
																	</p>
																</div>
															</div>

															<!-- Related External Issues -->
															<div>
																<p class="text-xs font-medium text-gray-500 mb-1.5">Related Issues from Project:</p>
																<div class="flex flex-wrap gap-1.5">
																	{#each partial.matchedExternalIssues as ext}
																		<span class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-full">
																			{#if ext.status === 'closed'}
																				<svg class="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
																				</svg>
																			{:else}
																				<svg class="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
																				</svg>
																			{/if}
																			<span class="truncate max-w-[150px]">{ext.title}</span>
																		</span>
																	{/each}
																</div>
															</div>

															<!-- Suggested Split Preview -->
															<div class="pt-2 border-t border-amber-100">
																<p class="text-xs font-medium text-gray-700 mb-2">Suggested Refactor:</p>
																<div class="space-y-2">
																	<div class="flex items-start gap-2 text-xs">
																		<span class="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-green-100 text-green-700 rounded-full text-[10px] font-bold">1</span>
																		<div>
																			<span class="text-gray-500">Close as:</span>
																			<span class="font-medium text-gray-900 ml-1">"{partial.suggestedSplit.completedTitle}"</span>
																		</div>
																	</div>
																	<div class="flex items-start gap-2 text-xs">
																		<span class="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">2</span>
																		<div>
																			<span class="text-gray-500">Create new:</span>
																			<span class="font-medium text-gray-900 ml-1">"{partial.suggestedSplit.remainingTitle}"</span>
																		</div>
																	</div>
																</div>
															</div>
														</div>

														<!-- Action Buttons -->
														<div class="flex gap-2 p-3 bg-amber-50/50 border-t border-amber-100">
															<button
																onclick={() => applyRefactor(partial)}
																disabled={refactoringIssue === partial.localIssueId}
																class="flex-1 py-2 px-3 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
															>
																{#if refactoringIssue === partial.localIssueId}
																	<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
																	Refactoring...
																{:else}
																	<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
																	</svg>
																	Refactor Issue
																{/if}
															</button>
															<button
																onclick={() => skipPartialMatch(partial.localIssueId)}
																disabled={refactoringIssue === partial.localIssueId}
																class="py-2 px-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
															>
																Skip
															</button>
														</div>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}

								<!-- Empty State -->
								{#if syncResult.matches.length === 0 && (!syncResult.partialMatches || syncResult.partialMatches.length === 0)}
									<div class="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
										<svg class="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<p class="text-sm">No matching issues to sync</p>
									</div>
								{/if}
							</div>
						{:else}
							<!-- Project List -->
							<div class="space-y-2">
								{#each projects as project}
									<button
										onclick={() => syncProject(project)}
										disabled={syncing || !project.hasBeads}
										class="w-full p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<div class="flex items-start justify-between">
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2">
													<span class="font-medium text-gray-900">{project.name}</span>
													{#if project.hasBeads}
														<span class="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
															beads
														</span>
													{/if}
													{#if project.hasClaude}
														<span class="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
															claude
														</span>
													{/if}
												</div>
												{#if project.hasBeads && project.issueCount !== undefined}
													<p class="text-sm text-gray-500 mt-1">
														{project.closedIssues} closed · {project.openIssues} open
													</p>
												{:else if !project.hasBeads}
													<p class="text-sm text-gray-400 mt-1">No beads tracking</p>
												{/if}
											</div>
											<span class="text-xs text-gray-400">
												{formatRelativeTime(project.lastModified)}
											</span>
										</div>
									</button>
								{/each}

								{#if projects.length === 0 && !loading}
									<div class="text-center py-8 text-gray-500">
										<p>No projects found</p>
									</div>
								{/if}
							</div>
						{/if}

						{#if syncing}
							<div class="flex flex-col items-center justify-center py-8">
								<div class="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin mb-3"></div>
								<p class="text-sm text-gray-600">Analyzing project...</p>
							</div>
						{/if}
					</div>

					<!-- Footer -->
					<div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
						<button
							onclick={loadProjects}
							disabled={loading}
							class="w-full py-2 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
						>
							Refresh Projects
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
