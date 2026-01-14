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

	interface SyncResult {
		projectName: string;
		projectPath: string;
		externalIssues: {
			total: number;
			open: number;
			closed: number;
		};
		matches: SyncMatch[];
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
										<h3 class="font-medium text-gray-900">Matches Found ({syncResult.matches.length})</h3>
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
											class="w-full py-2.5 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
										>
											Mark {syncResult.matches.length} Issue{syncResult.matches.length !== 1 ? 's' : ''} as Complete
										</button>
									</div>
								{:else}
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
