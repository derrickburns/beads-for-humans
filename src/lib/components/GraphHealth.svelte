<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';

	let health = $derived(issueStore.getGraphHealth());
	let showDetails = $state(false);

	function fixInvalid() {
		const removed = issueStore.removeInvalidDependencies();
		if (removed > 0) {
			// Trigger reactivity
			health = issueStore.getGraphHealth();
		}
	}

	function fixRedundant() {
		const removed = issueStore.removeRedundantDependencies();
		if (removed > 0) {
			// Trigger reactivity
			health = issueStore.getGraphHealth();
		}
	}

	function fixAll() {
		issueStore.removeInvalidDependencies();
		issueStore.removeRedundantDependencies();
		health = issueStore.getGraphHealth();
	}
</script>

{#if !health.isHealthy}
	<div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
		<div class="flex items-start justify-between">
			<div class="flex items-start gap-3">
				<svg class="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<div>
					<h3 class="font-medium text-amber-800">Dependency Graph Issues</h3>
					<p class="text-sm text-amber-700 mt-1">
						{#if health.cycles.length > 0}
							<span class="font-medium">{health.cycles.length} cycle{health.cycles.length > 1 ? 's' : ''}</span>
						{/if}
						{#if health.invalidDeps.length > 0}
							{#if health.cycles.length > 0}, {/if}
							<span class="font-medium">{health.invalidDeps.length} invalid reference{health.invalidDeps.length > 1 ? 's' : ''}</span>
						{/if}
						{#if health.redundantDeps.length > 0}
							{#if health.cycles.length > 0 || health.invalidDeps.length > 0}, {/if}
							<span class="font-medium">{health.redundantDeps.length} redundant dependenc{health.redundantDeps.length > 1 ? 'ies' : 'y'}</span>
						{/if}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => showDetails = !showDetails}
					class="text-sm text-amber-700 hover:text-amber-900"
				>
					{showDetails ? 'Hide' : 'Details'}
				</button>
				{#if health.invalidDeps.length > 0 || health.redundantDeps.length > 0}
					<button
						type="button"
						onclick={fixAll}
						class="px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
					>
						Fix All
					</button>
				{/if}
			</div>
		</div>

		{#if showDetails}
			<div class="mt-4 space-y-4 border-t border-amber-200 pt-4">
				{#if health.cycles.length > 0}
					<div>
						<h4 class="text-sm font-medium text-red-800 mb-2">Circular Dependencies</h4>
						{#each health.cycles as cycle}
							<div class="text-sm text-red-700 bg-red-50 p-2 rounded mb-2">
								{cycle.titles.join(' → ')}
							</div>
						{/each}
						<p class="text-xs text-red-600">Cycles must be fixed manually by editing dependencies.</p>
					</div>
				{/if}

				{#if health.invalidDeps.length > 0}
					<div>
						<div class="flex items-center justify-between mb-2">
							<h4 class="text-sm font-medium text-amber-800">Invalid References</h4>
							<button
								type="button"
								onclick={fixInvalid}
								class="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
							>
								Remove All
							</button>
						</div>
						{#each health.invalidDeps as inv}
							<div class="text-sm text-amber-700 bg-amber-100/50 p-2 rounded mb-1">
								<a href="/issue/{inv.issueId}" class="font-medium hover:underline">{inv.issueTitle}</a>
								→ <span class="text-amber-500 line-through">{inv.invalidDepId.slice(0, 8)}...</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if health.redundantDeps.length > 0}
					<div>
						<div class="flex items-center justify-between mb-2">
							<h4 class="text-sm font-medium text-amber-800">Redundant Dependencies</h4>
							<button
								type="button"
								onclick={fixRedundant}
								class="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
							>
								Remove All
							</button>
						</div>
						{#each health.redundantDeps as red}
							<div class="text-sm text-amber-700 bg-amber-100/50 p-2 rounded mb-1">
								<a href="/issue/{red.issueId}" class="font-medium hover:underline">{red.issueTitle}</a>
								→ <span class="line-through">{red.redundantDepTitle}</span>
								<span class="text-amber-500 text-xs ml-1">(already via {red.throughTitle})</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
