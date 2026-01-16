<script lang="ts">
	import { projectStore, type Project, getProjectPriority, type ProjectPriority } from '$lib/stores/projects.svelte';
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

	// Priority display config
	const priorityConfig: Record<ProjectPriority, { label: string; icon: string; color: string; bgColor: string }> = {
		on_fire: { label: 'Needs attention', icon: '🔥', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
		in_motion: { label: 'In progress', icon: '🏃', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
		ready: { label: 'Ready to start', icon: '✅', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
		dormant: { label: 'On hold', icon: '💤', color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200' }
	};

	// Auto-generate project name from description
	function generateNameFromDescription(desc: string): string {
		if (!desc.trim()) return '';
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
		e.stopImmediatePropagation();
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

		openProject(project);

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

	// Get status summary for a project
	function getStatusSummary(project: Project): string {
		const parts: string[] = [];
		if (project.blockedCount > 0) parts.push(`${project.blockedCount} blocked`);
		if (project.inProgressCount > 0) parts.push(`${project.inProgressCount} active`);
		if (project.readyCount > 0) parts.push(`${project.readyCount} ready`);
		if (parts.length === 0) {
			if (project.completedCount > 0) return `${project.completedCount} completed`;
			return 'No tasks';
		}
		return parts.join(' · ');
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

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
	<div class="max-w-3xl mx-auto px-4 py-12">
		<!-- Header -->
		<div class="text-center mb-10">
			<h1 class="text-3xl font-bold text-slate-900 mb-2">Chief of Staff</h1>
			<p class="text-slate-600">What needs your attention?</p>
		</div>

		<!-- Projects by Priority -->
		{#if projectStore.hasProjects}
			<div class="space-y-3 mb-8">
				{#each projectStore.prioritizedProjects as project (project.id)}
					{@const priority = getProjectPriority(project)}
					{@const config = priorityConfig[priority]}
					<div
						class="rounded-xl border-2 transition-all overflow-hidden {config.bgColor} hover:shadow-md"
					>
						{#if editingProjectId === project.id}
							<div class="p-4">
								<div class="flex items-center gap-3">
									<span class="text-xl">{config.icon}</span>
									<input
										type="text"
										bind:value={editingName}
										onkeydown={handleEditKeydown}
										onblur={saveProjectName}
										class="flex-1 text-lg font-semibold text-slate-900 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
										autofocus
									/>
								</div>
							</div>
						{:else}
							<button
								onclick={() => openProject(project)}
								class="w-full p-4 text-left"
							>
								<div class="flex items-center gap-3">
									<!-- Priority indicator -->
									<span class="text-xl flex-shrink-0">{config.icon}</span>

									<!-- Project info -->
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											{#if project.domain && domainMetadata[project.domain]}
												<span class="text-lg">{domainMetadata[project.domain].icon}</span>
											{/if}
											<h3
												class="text-lg font-semibold text-slate-900 truncate hover:text-blue-600 cursor-text"
												onclick={(e) => startEditingName(project, e)}
												title="Click to edit name"
											>
												{project.name}
											</h3>
										</div>
										<div class="flex items-center gap-3 mt-1">
											<span class="text-sm {config.color} font-medium">
												{getStatusSummary(project)}
											</span>
											<span class="text-xs text-slate-400">
												{formatDate(project.lastOpenedAt)}
											</span>
										</div>
									</div>

									<!-- Arrow -->
									<svg class="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</button>

							<!-- Delete option (collapsed by default) -->
							{#if deleteConfirm === project.id}
								<div class="border-t border-slate-200 px-4 py-2 bg-white/50 flex items-center justify-end gap-2">
									<span class="text-sm text-slate-600">Delete this project?</span>
									<button
										onclick={() => deleteProject(project.id)}
										class="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
									>
										Delete
									</button>
									<button
										onclick={() => deleteConfirm = null}
										class="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-200 rounded hover:bg-slate-300 transition-colors"
									>
										Cancel
									</button>
								</div>
							{:else}
								<div class="border-t border-slate-200/50 px-4 py-1.5 flex justify-end">
									<button
										onclick={(e) => { e.stopPropagation(); deleteConfirm = project.id; }}
										class="text-xs text-slate-400 hover:text-red-600 transition-colors"
									>
										Delete
									</button>
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- New Project -->
		{#if showNewForm}
			<form
				onsubmit={(e) => e.preventDefault()}
				onkeydown={handleFormKeydown}
				class="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
			>
				<h2 class="text-xl font-semibold text-slate-900 mb-4">New Project</h2>

				<div class="space-y-4">
					<div>
						<label for="project-desc" class="block text-sm font-medium text-slate-700 mb-1">
							What do you want to accomplish?
						</label>
						<textarea
							id="project-desc"
							bind:value={newProjectDescription}
							placeholder="Describe your goal..."
							rows="3"
							class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							autofocus
						></textarea>
					</div>

					<div>
						<label for="project-name" class="block text-sm font-medium text-slate-700 mb-1">
							Project Name
							{#if !nameManuallyEdited && newProjectDescription}
								<span class="text-slate-400 font-normal">(auto-generated)</span>
							{/if}
						</label>
						<input
							id="project-name"
							type="text"
							bind:value={newProjectName}
							oninput={handleNameInput}
							placeholder="Project name"
							class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!nameManuallyEdited && newProjectDescription ? 'bg-slate-50' : ''}"
						/>
					</div>

					<div>
						<label for="project-domain" class="block text-sm font-medium text-slate-700 mb-1">
							Domain <span class="text-slate-400 font-normal">(optional - helps AI assist you)</span>
						</label>
						<select
							id="project-domain"
							bind:value={newProjectDomain}
							class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						>
							<option value="">Select domain...</option>
							{#each domains as [key, meta]}
								<option value={key}>{meta.icon} {meta.name}</option>
							{/each}
						</select>
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
						class="py-2.5 px-4 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
					>
						Cancel
					</button>
				</div>
			</form>
		{:else}
			<button
				onclick={() => (showNewForm = true)}
				class="w-full py-3 px-6 bg-white text-slate-700 font-medium rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New Project
			</button>
		{/if}

		<!-- Empty state -->
		{#if !projectStore.hasProjects && !showNewForm}
			<div class="text-center py-12 mt-8">
				<div class="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
					<svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
					</svg>
				</div>
				<h3 class="text-lg font-medium text-slate-900 mb-2">No projects yet</h3>
				<p class="text-slate-500 mb-6 max-w-sm mx-auto">
					Create your first project and I'll help you break it down and make progress.
				</p>
			</div>
		{/if}

		<!-- Quick start domains (only shown when empty) -->
		{#if !showNewForm && !projectStore.hasProjects}
			<div class="mt-8">
				<h3 class="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Quick Start</h3>
				<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
					{#each domains.slice(0, 6) as [key, meta]}
						<button
							onclick={() => {
								newProjectDomain = key;
								showNewForm = true;
							}}
							class="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
						>
							<span class="text-xl">{meta.icon}</span>
							<span class="text-sm font-medium text-slate-700 ml-2">{meta.name}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
