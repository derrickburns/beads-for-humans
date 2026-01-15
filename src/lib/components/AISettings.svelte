<script lang="ts">
	import { aiSettings, AVAILABLE_MODELS } from '$lib/stores/aiSettings.svelte';
	import { toFriendlyError, type FriendlyError } from '$lib/utils/errors';

	let isOpen = $state(false);
	let showSetup = $state(false);
	let apiKeyInput = $state('');
	let testingKey = $state(false);
	let testError = $state<FriendlyError | null>(null);
	let testSuccess = $state(false);

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

	function openSetup() {
		showSetup = true;
		apiKeyInput = '';
		testError = null;
		testSuccess = false;
	}

	function closeSetup() {
		showSetup = false;
		apiKeyInput = '';
		testError = null;
		testSuccess = false;
	}

	async function testAndSaveKey() {
		if (!apiKeyInput.trim()) {
			testError = { message: 'Please enter an API key', canRetry: false };
			return;
		}

		testingKey = true;
		testError = null;
		testSuccess = false;

		try {
			// Test the key with a simple request
			const response = await fetch('/api/generate-description', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: 'Test task',
					type: 'task',
					apiKey: apiKeyInput.trim()
				})
			});

			const data = await response.json();

			if (data.error) {
				testError = toFriendlyError(data.error);
			} else {
				// Key works! Save it
				aiSettings.setApiKey(apiKeyInput.trim());
				testSuccess = true;
				setTimeout(() => {
					closeSetup();
				}, 1500);
			}
		} catch (e) {
			testError = toFriendlyError(e);
		} finally {
			testingKey = false;
		}
	}

	function removeKey() {
		aiSettings.clearApiKey();
	}

	// Status indicator color
	const statusColor = $derived(() => {
		switch (aiSettings.status) {
			case 'configured': return 'bg-green-500';
			case 'client-key': return 'bg-blue-500';
			default: return 'bg-amber-500';
		}
	});

	const statusText = $derived(() => {
		switch (aiSettings.status) {
			case 'configured': return 'AI Ready';
			case 'client-key': return 'Your Key';
			default: return 'Setup Required';
		}
	});
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
	>
		<div class="relative">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
			</svg>
			<div class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full {statusColor()}"></div>
		</div>
		<span class="hidden sm:inline truncate max-w-[120px]">
			{#if aiSettings.status === 'not-configured'}
				Setup AI
			{:else}
				{aiSettings.currentModel.name}
			{/if}
		</span>
	</button>

	{#if isOpen}
		<button type="button" class="fixed inset-0 z-40 w-full h-full cursor-default bg-transparent" onclick={() => (isOpen = false)} aria-label="Close menu"></button>
		<div class="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
			<!-- Status Header -->
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<div class="w-2.5 h-2.5 rounded-full {statusColor()}"></div>
					<span class="text-sm font-medium text-gray-900">{statusText()}</span>
				</div>
				{#if aiSettings.status === 'not-configured'}
					<button
						onclick={openSetup}
						class="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
					>
						Setup
					</button>
				{:else if aiSettings.status === 'client-key'}
					<button
						onclick={removeKey}
						class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
					>
						Remove Key
					</button>
				{/if}
			</div>

			{#if aiSettings.status === 'not-configured'}
				<!-- Not configured message -->
				<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
					<p class="text-sm text-amber-800">
						AI features need an API key to work. Click "Setup" to get started in 60 seconds.
					</p>
				</div>
			{:else}
				<!-- Model selection -->
				<div class="space-y-3">
					<div>
						<label for="model-select" class="block text-xs font-medium text-gray-500 mb-1">AI Model</label>
						<select
							id="model-select"
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
					</div>

					<p class="text-xs text-gray-500">
						{aiSettings.currentModel.provider} · {aiSettings.currentModel.name}
					</p>

					{#if aiSettings.status === 'client-key'}
						<p class="text-xs text-blue-600">
							Using your personal API key
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Setup Modal -->
	{#if showSetup}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				class="absolute inset-0 bg-black/50 w-full h-full cursor-default"
				onclick={closeSetup}
				aria-label="Close setup"
			></button>
			<div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
				<!-- Header -->
				<div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
					<h3 class="text-lg font-semibold">Setup AI in 60 Seconds</h3>
					<p class="text-sm text-white/80 mt-1">Get your free API key from OpenRouter</p>
				</div>

				<!-- Steps -->
				<div class="p-6 space-y-6">
					<!-- Step 1 -->
					<div class="flex gap-4">
						<div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
							1
						</div>
						<div>
							<p class="font-medium text-gray-900">Create a free OpenRouter account</p>
							<a
								href="https://openrouter.ai/keys"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-1"
							>
								openrouter.ai/keys
								<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
							</a>
						</div>
					</div>

					<!-- Step 2 -->
					<div class="flex gap-4">
						<div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
							2
						</div>
						<div>
							<p class="font-medium text-gray-900">Click "Create Key" and copy it</p>
							<p class="text-sm text-gray-500 mt-1">Free tier includes credits for testing</p>
						</div>
					</div>

					<!-- Step 3 -->
					<div class="flex gap-4">
						<div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
							3
						</div>
						<div class="flex-1">
							<p class="font-medium text-gray-900 mb-2">Paste your API key here</p>
							<input
								type="password"
								bind:value={apiKeyInput}
								placeholder="sk-or-v1-..."
								class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								autocomplete="off"
							/>
						</div>
					</div>

					<!-- Error/Success Messages -->
					{#if testError}
						<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
							<p class="font-medium">{testError.message}</p>
							{#if testError.suggestion}
								<p class="text-red-600 mt-1">{testError.suggestion}</p>
							{/if}
							{#if testError.canRetry}
								<button
									onclick={testAndSaveKey}
									class="mt-2 text-red-700 underline hover:no-underline text-xs"
								>
									Try again
								</button>
							{/if}
						</div>
					{/if}

					{#if testSuccess}
						<div class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							API key saved! AI features are now ready.
						</div>
					{/if}

					<!-- Actions -->
					<div class="flex items-center justify-between pt-2">
						<button
							onclick={closeSetup}
							class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
						>
							Cancel
						</button>
						<button
							onclick={testAndSaveKey}
							disabled={testingKey || !apiKeyInput.trim()}
							class="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
						>
							{#if testingKey}
								<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
								Testing...
							{:else}
								Save & Test
							{/if}
						</button>
					</div>
				</div>

				<!-- Footer -->
				<div class="px-6 py-3 bg-gray-50 border-t border-gray-100">
					<p class="text-xs text-gray-500 text-center">
						Your API key is stored in your browser only. We never see or store it.
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
