<script lang="ts">
	import ProjectTimeline from '$lib/components/ProjectTimeline.svelte';
</script>

<svelte:head>
	<title>Project Timeline - Chief of Staff</title>
</svelte:head>

<div class="max-w-6xl mx-auto">
	<div class="mb-6">
		<a href="/" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Tasks
		</a>
	</div>

	<ProjectTimeline />
</div>
