<script lang="ts">
	import DependencyGraph from '$lib/components/DependencyGraph.svelte';
</script>

<svelte:head>
	<title>Dependency Graph</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-gray-900">Dependency Graph</h1>
			<p class="text-gray-500 mt-1">Visualize what's blocking what</p>
		</div>
		<a
			href="/"
			class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
		>
			List View
		</a>
	</div>

	<DependencyGraph />
</div>
