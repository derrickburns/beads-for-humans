<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';
	import { EXECUTION_TYPE_LABELS } from '$lib/types/issue';
	import type { Issue } from '$lib/types/issue';

	let benchmarking = $state<Set<string>>(new Set());
	let isOpen = $state(true);

	// Issues with execution types that can be benchmarked
	let benchmarkableIssues = $derived(
		issueStore.issues.filter(
			(i) => i.executionType && i.status !== 'closed'
		)
	);

	// Issues with reclassification suggestions
	let suggestions = $derived(issueStore.benchmarkSuggestions);

	async function benchmarkIssue(issue: Issue) {
		if (!issue.executionType) return;

		benchmarking = new Set([...benchmarking, issue.id]);

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/benchmark-task', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: issue.title,
					description: issue.description,
					currentExecutionType: issue.executionType,
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.result) {
				issueStore.updateBenchmark(issue.id, data.result);
			}
		} catch (error) {
			console.error('Benchmark error:', error);
		} finally {
			benchmarking = new Set([...benchmarking].filter((id) => id !== issue.id));
		}
	}

	async function benchmarkAll() {
		for (const issue of benchmarkableIssues) {
			if (!benchmarking.has(issue.id)) {
				await benchmarkIssue(issue);
			}
		}
	}

	function applyBenchmark(issueId: string) {
		issueStore.applyBenchmark(issueId);
	}

	function dismissBenchmark(issueId: string) {
		issueStore.clearBenchmark(issueId);
	}

	const executionColors: Record<string, string> = {
		automated: 'bg-emerald-100 text-emerald-700 border-emerald-200',
		human: 'bg-rose-100 text-rose-700 border-rose-200',
		ai_assisted: 'bg-sky-100 text-sky-700 border-sky-200',
		human_assisted: 'bg-violet-100 text-violet-700 border-violet-200'
	};
</script>

{#if benchmarkableIssues.length > 0 || suggestions.length > 0}
	<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
		<button
			type="button"
			onclick={() => isOpen = !isOpen}
			class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
		>
			<div class="flex items-center gap-2">
				<svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
				<span class="font-medium text-gray-900">AI Capability Benchmark</span>
				{#if suggestions.length > 0}
					<span class="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
						{suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
					</span>
				{/if}
			</div>
			<svg
				class="w-4 h-4 text-gray-500 transition-transform {isOpen ? 'rotate-180' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if isOpen}
			<div class="px-4 pb-4 space-y-4">
				<p class="text-sm text-gray-600">
					Re-evaluate your tasks against current AI capabilities. As AI improves, some tasks may be upgraded.
				</p>

				<!-- Suggestions Section -->
				{#if suggestions.length > 0}
					<div class="space-y-3">
						<h4 class="text-sm font-medium text-gray-700">Reclassification Suggestions</h4>
						{#each suggestions as issue}
							{#if issue.lastBenchmark}
								<div class="p-3 bg-purple-50 border border-purple-200 rounded-lg">
									<div class="flex items-start justify-between gap-3">
										<div class="flex-1 min-w-0">
											<p class="font-medium text-gray-900 truncate">{issue.title}</p>
											<div class="flex items-center gap-2 mt-2 flex-wrap">
												<span class="px-2 py-0.5 text-xs font-medium rounded border {executionColors[issue.lastBenchmark.currentType]}">
													{EXECUTION_TYPE_LABELS[issue.lastBenchmark.currentType]}
												</span>
												<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
												</svg>
												<span class="px-2 py-0.5 text-xs font-medium rounded border {executionColors[issue.lastBenchmark.suggestedType]}">
													{EXECUTION_TYPE_LABELS[issue.lastBenchmark.suggestedType]}
												</span>
											</div>
											<p class="text-xs text-gray-600 mt-2">{issue.lastBenchmark.reasoning}</p>
											<p class="text-xs text-gray-400 mt-1">
												{Math.round(issue.lastBenchmark.confidence * 100)}% confident
											</p>
										</div>
										<div class="flex flex-col gap-2">
											<button
												onclick={() => applyBenchmark(issue.id)}
												class="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors"
											>
												Apply
											</button>
											<button
												onclick={() => dismissBenchmark(issue.id)}
												class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
											>
												Dismiss
											</button>
										</div>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				<!-- Benchmark All Button -->
				{#if aiSettings.isConfigured}
					<div class="pt-2 border-t border-gray-100">
						<button
							onclick={benchmarkAll}
							disabled={benchmarking.size > 0}
							class="w-full py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
						>
							{#if benchmarking.size > 0}
								<span class="w-4 h-4 border-2 border-purple-400/30 border-t-purple-600 rounded-full animate-spin"></span>
								Benchmarking {benchmarking.size} task{benchmarking.size === 1 ? '' : 's'}...
							{:else}
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								Re-evaluate All Tasks ({benchmarkableIssues.length})
							{/if}
						</button>
					</div>
				{:else}
					<p class="text-sm text-amber-600">
						Set up AI to enable benchmarking.
					</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}
