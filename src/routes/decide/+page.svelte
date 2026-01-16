<script lang="ts">
	import { goto } from '$app/navigation';
	import DecisionMatrix from '$lib/components/DecisionMatrix.svelte';
</script>

<svelte:head>
	<title>Decision Matrix - Chief of Staff</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<div class="mb-6">
		<a href="/" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Tasks
		</a>
	</div>

	<DecisionMatrix onClose={() => goto('/')} />
</div>
