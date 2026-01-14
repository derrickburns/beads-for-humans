<script lang="ts">
	import IssueForm from '$lib/components/IssueForm.svelte';
</script>

<svelte:head>
	<title>New Issue</title>
</svelte:head>

<div class="max-w-2xl">
	<div class="mb-8">
		<a
			href="/"
			class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Issues
		</a>
		<h1 class="text-2xl font-semibold text-gray-900">New Issue</h1>
	</div>

	<div class="bg-white rounded-xl border border-gray-200 p-6">
		<IssueForm />
	</div>
</div>
