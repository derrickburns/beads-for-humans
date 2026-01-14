<script lang="ts">
	import IssueForm from '$lib/components/IssueForm.svelte';
</script>

<svelte:head>
	<title>New Issue</title>
</svelte:head>

<div class="max-w-2xl">
	<div class="mb-8">
		<a href="/" class="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">&larr; Back</a>
		<h1 class="text-2xl font-semibold text-gray-900">New Issue</h1>
	</div>

	<div class="bg-white rounded-xl border border-gray-200 p-6">
		<IssueForm />
	</div>
</div>
