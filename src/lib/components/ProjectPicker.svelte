<script lang="ts">
	import { projectStore, type Project } from '$lib/stores/projects.svelte';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { domainMetadata } from '$lib/schemas';
	import type { DomainType } from '$lib/types/facts';

	// State for creating new project
	let showNewForm = $state(false);
	let newProjectName = $state('');
	let newProjectDescription = $state('');
	let newProjectDomain = $state<DomainType | ''>('');
	let nameManuallyEdited = $state(false);
	let deleteConfirm = $state<string | null>(null);

	// State for inline editing
	let editingProjectId = $state<string | null>(null);
	let editingName = $state('');

	// Available domain types
	const domains = Object.entries(domainMetadata).filter(
		([key]) => key !== 'custom'
	) as [DomainType, { name: string; description: string; icon: string }][];

	// Auto-generate project name from description
	function generateNameFromDescription(desc: string): string {
		if (!desc.trim()) return '';
		// Take first sentence or first 40 chars
		const firstSentence = desc.split(/[.!?]/)[0].trim();
		if (firstSentence.length <= 40) return firstSentence;
		return firstSentence.substring(0, 40).trim() + '...';
	}

	// Update name when description changes (if not manually edited)
	$effect(() => {
		if (newProjectDescription && !nameManuallyEdited) {
			newProjectName = generateNameFromDescription(newProjectDescription);
		}
	});

	function handleNameInput() {
		nameManuallyEdited = true;
	}

	function handleFormKeydown(e: KeyboardEvent) {
		// Prevent any keyboard shortcuts from triggering while in the form
		e.stopImmediatePropagation();
		// Prevent Enter from submitting
		if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
			e.preventDefault();
		}
	}

	function createProject() {
		const name = newProjectName.trim() || generateNameFromDescription(newProjectDescription) || 'Untitled Project';

		const project = projectStore.create({
			name,
			description: newProjectDescription.trim() || undefined,
			domain: newProjectDomain || undefined
		});

		// Open the new project
		openProject(project);

		// Reset form
		showNewForm = false;
		newProjectName = '';
		newProjectDescription = '';
		newProjectDomain = '';
		nameManuallyEdited = false;
	}

	function openProject(project: Project) {
		projectStore.open(project.id);
		issueStore.loadProject(project.id);
	}

	function deleteProject(projectId: string) {
		projectStore.delete(projectId);
		deleteConfirm = null;
	}

	function startEditingName(project: Project, e: MouseEvent) {
		e.stopPropagation();
		editingProjectId = project.id;
		editingName = project.name;
	}

	function saveProjectName() {
		if (editingProjectId && editingName.trim()) {
			projectStore.update(editingProjectId, { name: editingName.trim() });
		}
		editingProjectId = null;
		editingName = '';
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveProjectName();
		} else if (e.key === 'Escape') {
			editingProjectId = null;
			editingName = '';
		}
	}

	function formatDate(isoDate: string): string {
		const date = new Date(isoDate);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	// Check for and migrate legacy data on mount
	$effect(() => {
		if (!projectStore.hasProjects) {
			const migrated = projectStore.migrateFromLegacy();
			if (migrated) {
				issueStore.loadProject(migrated.id);
			}
		}
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
	<div class="max-w-4xl mx-auto px-4 py-12">
		<!-- Header -->
		<div class="text-center mb-12">
			<h1 class="text-4xl font-bold text-gray-900 mb-3">Beads</h1>
			<p class="text-lg text-gray-600">Plan your life, one step at a time</p>
		</div>

		<!-- New Project Button / Form -->
		{#if showNewForm}
			<form
				onsubmit={(e) => e.preventDefault()}
				onkeydown={handleFormKeydown}
				class="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200"
			>
				<h2 class="text-xl font-semibold text-gray-900 mb-4">New Project</h2>

				<div class="space-y-4">
					<!-- Description first -->
					<div>
						<label for="project-desc" class="block text-sm font-medium text-gray-700 mb-1">
							What do you want to accomplish?
						</label>
						<textarea
							id="project-desc"
							bind:value={newProjectDescription}
							placeholder="Describe your goal... (a name will be generated automatically)"
							rows="3"
							class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							autofocus
						></textarea>
					</div>

					<!-- Project name (auto-generated, editable) -->
					<div>
						<label for="project-name" class="block text-sm font-medium text-gray-700 mb-1">
							Project Name
							{#if !nameManuallyEdited && newProjectDescription}
								<span class="text-gray-400 font-normal">(auto-generated, click to edit)</span>
							{/if}
						</label>
						<input
							id="project-name"
							type="text"
							bind:value={newProjectName}
							oninput={handleNameInput}
							placeholder="Project name"
							class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!nameManuallyEdited && newProjectDescription ? 'bg-gray-50' : ''}"
						/>
					</div>

					<!-- Domain selection -->
					<div>
						<label for="project-domain" class="block text-sm font-medium text-gray-700 mb-1">
							Planning Domain <span class="text-gray-400 font-normal">(optional)</span>
						</label>
						<select
							id="project-domain"
							bind:value={newProjectDomain}
							class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						>
							<option value="">Select for AI assistance...</option>
							{#each domains as [key, meta]}
								<option value={key}>{meta.icon} {meta.name}</option>
							{/each}
						</select>
						{#if newProjectDomain}
							<p class="mt-1 text-sm text-gray-500">
								{domainMetadata[newProjectDomain].description}
							</p>
						{/if}
					</div>
				</div>

				<div class="flex gap-3 mt-6">
					<button
						type="button"
						onclick={createProject}
						disabled={!newProjectDescription.trim() && !newProjectName.trim()}
						class="flex-1 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						Create Project
					</button>
					<button
						type="button"
						onclick={() => { showNewForm = false; newProjectName = ''; newProjectDescription = ''; newProjectDomain = ''; nameManuallyEdited = false; }}
						class="py-2.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
					>
						Cancel
					</button>
				</div>
			</form>
		{:else}
			<button
				onclick={() => (showNewForm = true)}
				class="w-full py-4 px-6 bg-blue-600 text-white font-medium rounded-2xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 mb-8"
			>
				<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Start New Project
			</button>
		{/if}

		<!-- Recent Projects -->
		{#if projectStore.hasProjects}
			<div class="mb-4">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">Continue Project</h2>

				<div class="grid gap-4">
					{#each projectStore.recentProjects as project (project.id)}
						<div
							class="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all overflow-hidden"
						>
							{#if editingProjectId === project.id}
								<!-- When editing, use a div instead of button to avoid space key issues -->
								<div class="w-full p-5 text-left">
									<div class="flex items-start justify-between">
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 mb-1">
												{#if project.domain && domainMetadata[project.domain]}
													<span class="text-2xl">{domainMetadata[project.domain].icon}</span>
												{/if}
												<input
													type="text"
													bind:value={editingName}
													onkeydown={handleEditKeydown}
													onblur={saveProjectName}
													class="text-lg font-semibold text-gray-900 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
													autofocus
												/>
											</div>
											{#if project.description}
												<p class="text-sm text-gray-500 line-clamp-2 mb-2">
													{project.description}
												</p>
											{/if}
											<div class="flex items-center gap-4 text-sm text-gray-500">
												<span>{project.issueCount} tasks</span>
												<span class="text-green-600">{project.completedCount} completed</span>
												<span>Last opened {formatDate(project.lastOpenedAt)}</span>
											</div>
										</div>
										<svg class="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
										</svg>
									</div>
								</div>
							{:else}
								<!-- When not editing, use button for click handling -->
								<button
									onclick={() => openProject(project)}
									class="w-full p-5 text-left"
								>
									<div class="flex items-start justify-between">
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 mb-1">
												{#if project.domain && domainMetadata[project.domain]}
													<span class="text-2xl">{domainMetadata[project.domain].icon}</span>
												{/if}
												<h3
													class="text-lg font-semibold text-gray-900 truncate hover:text-blue-600 cursor-text"
													onclick={(e) => startEditingName(project, e)}
													title="Click to edit name"
												>
													{project.name}
												</h3>
											</div>
											{#if project.description}
												<p class="text-sm text-gray-500 line-clamp-2 mb-2">
													{project.description}
												</p>
											{/if}
											<div class="flex items-center gap-4 text-sm text-gray-500">
												<span>{project.issueCount} tasks</span>
												<span class="text-green-600">{project.completedCount} completed</span>
												<span>Last opened {formatDate(project.lastOpenedAt)}</span>
											</div>
										</div>
										<svg class="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
										</svg>
									</div>
								</button>
							{/if}

							<!-- Delete button -->
							<div class="border-t border-gray-100 px-5 py-2 bg-gray-50 flex justify-end">
								{#if deleteConfirm === project.id}
									<div class="flex items-center gap-2">
										<span class="text-sm text-gray-600">Delete this project?</span>
										<button
											onclick={() => deleteProject(project.id)}
											class="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
										>
											Delete
										</button>
										<button
											onclick={() => deleteConfirm = null}
											class="px-3 py-1 text-sm font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
										>
											Cancel
										</button>
									</div>
								{:else}
									<button
										onclick={(e) => { e.stopPropagation(); deleteConfirm = project.id; }}
										class="text-sm text-gray-400 hover:text-red-600 transition-colors"
									>
										Delete
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else if !showNewForm}
			<!-- Empty state -->
			<div class="text-center py-12">
				<div class="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
					<svg class="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
					</svg>
				</div>
				<h3 class="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
				<p class="text-gray-500 mb-6 max-w-md mx-auto">
					Start a new project to begin planning. Describe what you want to accomplish and we'll help you break it down.
				</p>
			</div>
		{/if}

		<!-- Domain quick starts -->
		{#if !showNewForm && !projectStore.hasProjects}
			<div class="mt-8">
				<h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Quick Start by Domain</h3>
				<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
					{#each domains.slice(0, 6) as [key, meta]}
						<button
							onclick={() => {
								newProjectDomain = key;
								showNewForm = true;
							}}
							class="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
						>
							<span class="text-2xl mb-2 block">{meta.icon}</span>
							<span class="text-sm font-medium text-gray-900">{meta.name}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
