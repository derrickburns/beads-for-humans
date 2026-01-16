<script lang="ts">
	import { goto } from '$app/navigation';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { PROJECT_TEMPLATES, TEMPLATE_CATEGORIES, type ProjectTemplate } from '$lib/data/projectTemplates';

	// State
	let selectedCategory = $state<string>('all');
	let selectedTemplate = $state<ProjectTemplate | null>(null);
	let creating = $state(false);

	// Filter templates by category
	let filteredTemplates = $derived(
		selectedCategory === 'all'
			? PROJECT_TEMPLATES
			: PROJECT_TEMPLATES.filter(t => t.category === selectedCategory)
	);

	function selectTemplate(template: ProjectTemplate) {
		selectedTemplate = template;
	}

	function closePreview() {
		selectedTemplate = null;
	}

	async function applyTemplate(template: ProjectTemplate) {
		creating = true;

		try {
			// Create a mapping from task index to real issue ID
			const idMap = new Map<number, string>();

			// Create issues in order (dependencies first)
			for (let i = 0; i < template.tasks.length; i++) {
				const task = template.tasks[i];

				// Map dependencies from indices to real IDs
				const dependencies = (task.dependsOnIndex || [])
					.filter(idx => idMap.has(idx))
					.map(idx => idMap.get(idx)!);

				const issue = issueStore.create({
					title: task.title,
					description: task.description,
					type: task.type,
					priority: task.priority,
					executionType: task.executionType,
					validationRequired: task.validationRequired,
					executionReason: task.expertNeeded ? `Expert needed: ${task.expertNeeded}` : undefined,
					dependencies
				});

				if (issue) {
					idMap.set(i, issue.id);
				}
			}

			// Navigate to main page
			goto(`/?created=${template.tasks.length}`);
		} finally {
			creating = false;
		}
	}

	const categoryIcons: Record<string, string> = {
		'Real Estate': '🏠',
		'Home Improvement': '🔨',
		'Life Events': '🎉',
		'Financial': '💰',
		'Education': '📚'
	};
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="text-center">
		<h2 class="text-2xl font-bold text-gray-900">Project Templates</h2>
		<p class="text-gray-600 mt-1">
			Start faster with pre-built plans for common life projects
		</p>
	</div>

	<!-- Category Filter -->
	<div class="flex flex-wrap justify-center gap-2">
		<button
			onclick={() => selectedCategory = 'all'}
			class="px-4 py-2 text-sm font-medium rounded-full transition-colors {
				selectedCategory === 'all'
					? 'bg-blue-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
			}"
		>
			All Templates
		</button>
		{#each TEMPLATE_CATEGORIES as category}
			<button
				onclick={() => selectedCategory = category}
				class="px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-1 {
					selectedCategory === category
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
				}"
			>
				<span>{categoryIcons[category] || '📋'}</span>
				<span>{category}</span>
			</button>
		{/each}
	</div>

	<!-- Template Grid -->
	<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each filteredTemplates as template (template.id)}
			<button
				onclick={() => selectTemplate(template)}
				class="p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all text-left group"
			>
				<div class="flex items-start justify-between mb-3">
					<span class="text-4xl">{template.icon}</span>
					<span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
						{template.tasks.length} tasks
					</span>
				</div>
				<h3 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
					{template.name}
				</h3>
				<p class="text-sm text-gray-600 mt-1">{template.description}</p>
				<div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
					<span>{template.category}</span>
					<span>·</span>
					<span>{template.estimatedDuration}</span>
				</div>
			</button>
		{/each}
	</div>

	<!-- Template Preview Modal -->
	{#if selectedTemplate}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				class="absolute inset-0 bg-black/50 cursor-default"
				onclick={closePreview}
				aria-label="Close"
			></button>
			<div class="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
				<!-- Header -->
				<div class="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<span class="text-3xl">{selectedTemplate.icon}</span>
							<div>
								<h3 class="text-xl font-semibold">{selectedTemplate.name}</h3>
								<p class="text-sm text-white/80">{selectedTemplate.description}</p>
							</div>
						</div>
						<button
							onclick={closePreview}
							class="p-2 hover:bg-white/20 rounded-lg transition-colors"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="flex items-center gap-4 mt-3 text-sm text-white/70">
						<span>{selectedTemplate.category}</span>
						<span>·</span>
						<span>{selectedTemplate.tasks.length} tasks</span>
						<span>·</span>
						<span>{selectedTemplate.estimatedDuration}</span>
					</div>
				</div>

				<!-- Content -->
				<div class="p-6 overflow-y-auto max-h-[60vh]">
					<!-- Tasks -->
					<div class="space-y-4">
						<h4 class="font-medium text-gray-900">What's Included</h4>
						<div class="space-y-2">
							{#each selectedTemplate.tasks as task, i}
								<div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
									<span class="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 text-xs font-bold rounded-full flex items-center justify-center">
										{i + 1}
									</span>
									<div class="flex-1 min-w-0">
										<p class="font-medium text-gray-900">{task.title}</p>
										{#if task.validationRequired}
											<span class="inline-flex items-center gap-1 text-xs text-amber-700 mt-1">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
												</svg>
												Requires expert validation
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Tips -->
					{#if selectedTemplate.tips.length > 0}
						<div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
							<h4 class="font-medium text-blue-900 mb-2">Pro Tips</h4>
							<ul class="space-y-2">
								{#each selectedTemplate.tips as tip}
									<li class="text-sm text-blue-800 flex items-start gap-2">
										<svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
										</svg>
										{tip}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				<!-- Actions -->
				<div class="sticky bottom-0 px-6 py-4 bg-gray-50 border-t border-gray-200">
					<div class="flex items-center justify-between">
						<button
							onclick={closePreview}
							class="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={() => selectedTemplate && applyTemplate(selectedTemplate)}
							disabled={creating}
							class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
						>
							{#if creating}
								<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
								Creating...
							{:else}
								Use This Template
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
