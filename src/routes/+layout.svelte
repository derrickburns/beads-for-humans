<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import AISettings from '$lib/components/AISettings.svelte';
	import OnboardingOverlay from '$lib/components/OnboardingOverlay.svelte';
	import ProjectPicker from '$lib/components/ProjectPicker.svelte';
	import { onboardingStore } from '$lib/stores/onboarding.svelte';
	import { projectStore } from '$lib/stores/projects.svelte';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { domainMetadata } from '$lib/schemas';
	import { browser } from '$app/environment';

	let { children } = $props();
	let showShortcuts = $state(false);

	// Load project on mount if there's a saved current project
	// Only load if the issueStore isn't already tracking this project
	$effect(() => {
		if (browser && projectStore.currentProjectId && issueStore.currentProjectId !== projectStore.currentProjectId) {
			issueStore.loadProject(projectStore.currentProjectId);
		}
	});

	// Function to close current project and return to picker
	function closeProject() {
		projectStore.close();
		issueStore.clearProject();
	}

	function handleKeydown(e: KeyboardEvent) {
		// Ignore if user is typing in an input
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
			return;
		}

		switch (e.key) {
			case 'n':
				e.preventDefault();
				goto('/issue/new');
				break;
			case 'h':
				e.preventDefault();
				goto('/');
				break;
			case '?':
				e.preventDefault();
				showShortcuts = !showShortcuts;
				break;
			case 'Escape':
				showShortcuts = false;
				break;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Chief of Staff</title>
</svelte:head>

{#if projectStore.current}
	<div class="min-h-screen">
		<header class="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
			<div class="max-w-6xl mx-auto px-6 py-4">
				<nav class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<button
							onclick={closeProject}
							class="text-gray-400 hover:text-gray-600 transition-colors"
							title="Back to projects"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<div class="flex items-center gap-2">
							{#if projectStore.current.domain && domainMetadata[projectStore.current.domain]}
								<span class="text-xl">{domainMetadata[projectStore.current.domain].icon}</span>
							{/if}
							<a href="/" class="text-xl font-semibold text-gray-900 hover:text-gray-600 transition-colors">
								{projectStore.current.name}
							</a>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<AISettings />
						{#if onboardingStore.completed}
							<button
								onclick={() => onboardingStore.restart()}
								class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hidden sm:flex items-center gap-1"
								title="Restart tutorial"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Help
							</button>
						{/if}
						<button
							onclick={() => (showShortcuts = true)}
							class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hidden sm:block"
						>
							<kbd class="px-1.5 py-0.5 text-xs bg-gray-100 rounded">?</kbd> Shortcuts
						</button>
						<a
							href="/plan"
							data-onboarding="plan-button"
							class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors hidden sm:flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
							</svg>
							Plan Project
						</a>
						<a
							href="/issue/new"
							class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
						>
							New Issue
						</a>
					</div>
				</nav>
			</div>
		</header>

		<main class="max-w-6xl mx-auto px-6 py-8">
			{@render children()}
		</main>
	</div>
{:else}
	<ProjectPicker />
{/if}

<!-- Onboarding Tutorial -->
<OnboardingOverlay />

<!-- Keyboard Shortcuts Modal -->
{#if showShortcuts}
	<div class="fixed inset-0 z-50">
		<button
			type="button"
			class="absolute inset-0 bg-black/50 w-full h-full cursor-default"
			onclick={() => (showShortcuts = false)}
			aria-label="Close modal"
		></button>
		<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
			<div class="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl pointer-events-auto">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Keyboard Shortcuts</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">New issue</span>
						<kbd class="px-2 py-1 text-sm bg-gray-100 rounded font-mono">n</kbd>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Go home</span>
						<kbd class="px-2 py-1 text-sm bg-gray-100 rounded font-mono">h</kbd>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Show shortcuts</span>
						<kbd class="px-2 py-1 text-sm bg-gray-100 rounded font-mono">?</kbd>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Close dialog</span>
						<kbd class="px-2 py-1 text-sm bg-gray-100 rounded font-mono">Esc</kbd>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (showShortcuts = false)}
					class="mt-6 w-full px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
