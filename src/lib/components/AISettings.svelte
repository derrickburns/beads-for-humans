<script lang="ts">
	import { aiSettings, AVAILABLE_MODELS } from '$lib/stores/aiSettings.svelte';

	let isOpen = $state(false);

	// Group models by provider for better UX
	const modelsByProvider = $derived(() => {
		const groups: Record<string, typeof AVAILABLE_MODELS> = {};
		for (const model of AVAILABLE_MODELS) {
			if (!groups[model.provider]) {
				groups[model.provider] = [];
			}
			groups[model.provider].push(model);
		}
		return groups;
	});

	function handleModelChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		aiSettings.setModel(target.value);
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
	>
		<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
		</svg>
		<span class="hidden sm:inline truncate max-w-[120px]">{aiSettings.currentModel.name}</span>
	</button>

	{#if isOpen}
		<button type="button" class="fixed inset-0 z-40 w-full h-full cursor-default bg-transparent" onclick={() => (isOpen = false)} aria-label="Close menu"></button>
		<div class="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-semibold text-gray-900">AI Model</h3>
				<span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">via OpenRouter</span>
			</div>

			<div class="space-y-3">
				<select
					value={aiSettings.model}
					onchange={handleModelChange}
					class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					{#each Object.entries(modelsByProvider()) as [provider, models]}
						<optgroup label={provider}>
							{#each models as model}
								<option value={model.id}>{model.name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>

				<p class="text-xs text-gray-500">
					Selected: <span class="font-medium">{aiSettings.currentModel.provider}</span> / {aiSettings.currentModel.name}
				</p>

				<div class="pt-2 border-t border-gray-100">
					<p class="text-xs text-gray-400">
						Requires OPENROUTER_API_KEY in .env
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
