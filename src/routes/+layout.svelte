<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import AISettings from '$lib/components/AISettings.svelte';

	let { children } = $props();
	let showShortcuts = $state(false);

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
	<title>Issues</title>
</svelte:head>

<div class="min-h-screen">
	<header class="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
		<div class="max-w-6xl mx-auto px-6 py-4">
			<nav class="flex items-center justify-between">
				<a href="/" class="text-xl font-semibold text-gray-900 hover:text-gray-600 transition-colors">
					Issues
				</a>
				<div class="flex items-center gap-3">
					<AISettings />
					<button
						onclick={() => (showShortcuts = true)}
						class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hidden sm:block"
					>
						<kbd class="px-1.5 py-0.5 text-xs bg-gray-100 rounded">?</kbd> Shortcuts
					</button>
					<a
						href="/plan"
						class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors hidden sm:flex items-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
						</svg>
						Plan with AI
					</a>
					<a
						href="/import"
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors hidden sm:block"
					>
						Bulk Import
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
