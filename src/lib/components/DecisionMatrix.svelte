<script lang="ts">
	import { aiSettings } from '$lib/stores/aiSettings.svelte';

	interface Criterion {
		id: string;
		name: string;
		description: string;
		weight: number;
		category: string;
	}

	interface Option {
		id: string;
		name: string;
		scores: Record<string, number>; // criterionId -> score (1-5)
		notes: Record<string, string>; // criterionId -> notes
	}

	// Props
	let { onClose }: { onClose?: () => void } = $props();

	// State
	let step = $state<'input' | 'criteria' | 'options' | 'results'>('input');
	let decision = $state('');
	let context = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let reasoning = $state('');

	let criteria = $state<Criterion[]>([]);
	let options = $state<Option[]>([]);

	let newOptionName = $state('');
	let newCriterionName = $state('');

	// Generate unique ID
	function generateId() {
		return crypto.randomUUID().slice(0, 8);
	}

	// Get AI criteria suggestions
	async function suggestCriteria() {
		if (!decision.trim()) return;

		loading = true;
		error = null;

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/suggest-criteria', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					decision: decision.trim(),
					context: context.trim() || undefined,
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				criteria = data.criteria.map((c: Omit<Criterion, 'id'>) => ({
					...c,
					id: generateId()
				}));
				reasoning = data.reasoning;
				step = 'criteria';
			}
		} catch (e) {
			error = 'Failed to get criteria suggestions';
		} finally {
			loading = false;
		}
	}

	// Add a criterion manually
	function addCriterion() {
		if (!newCriterionName.trim()) return;
		criteria = [
			...criteria,
			{
				id: generateId(),
				name: newCriterionName.trim(),
				description: '',
				weight: 3,
				category: 'practical'
			}
		];
		newCriterionName = '';
	}

	// Remove a criterion
	function removeCriterion(id: string) {
		criteria = criteria.filter((c) => c.id !== id);
		// Also remove scores for this criterion from options
		options = options.map((o) => {
			const { [id]: _, ...scores } = o.scores;
			const { [id]: __, ...notes } = o.notes;
			return { ...o, scores, notes };
		});
	}

	// Update criterion weight
	function updateWeight(id: string, weight: number) {
		criteria = criteria.map((c) => (c.id === id ? { ...c, weight } : c));
	}

	// Add an option
	function addOption() {
		if (!newOptionName.trim()) return;
		options = [
			...options,
			{
				id: generateId(),
				name: newOptionName.trim(),
				scores: {},
				notes: {}
			}
		];
		newOptionName = '';
	}

	// Remove an option
	function removeOption(id: string) {
		options = options.filter((o) => o.id !== id);
	}

	// Update score for an option
	function updateScore(optionId: string, criterionId: string, score: number) {
		options = options.map((o) =>
			o.id === optionId
				? { ...o, scores: { ...o.scores, [criterionId]: score } }
				: o
		);
	}

	// Calculate weighted score for an option
	function calculateScore(option: Option): number {
		let totalWeight = 0;
		let weightedSum = 0;

		for (const criterion of criteria) {
			const score = option.scores[criterion.id] || 0;
			if (score > 0) {
				weightedSum += score * criterion.weight;
				totalWeight += criterion.weight * 5; // Max possible weighted score
			}
		}

		return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
	}

	// Get ranked options
	let rankedOptions = $derived(
		[...options]
			.map((o) => ({ ...o, totalScore: calculateScore(o) }))
			.sort((a, b) => b.totalScore - a.totalScore)
	);

	// Check if we have enough data for results
	let canShowResults = $derived(
		options.length >= 2 &&
		options.every((o) =>
			criteria.every((c) => (o.scores[c.id] || 0) > 0)
		)
	);

	const categoryColors: Record<string, string> = {
		practical: 'bg-gray-100 text-gray-700',
		financial: 'bg-green-100 text-green-700',
		quality: 'bg-blue-100 text-blue-700',
		risk: 'bg-red-100 text-red-700',
		personal: 'bg-purple-100 text-purple-700',
		timing: 'bg-amber-100 text-amber-700'
	};

	const weightLabels = ['Not set', 'Low', 'Medium-Low', 'Medium', 'Medium-High', 'Critical'];
</script>

<div class="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
	<!-- Header -->
	<div class="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold">Decision Matrix</h2>
				<p class="text-sm text-white/80">Compare options objectively with weighted criteria</p>
			</div>
			{#if onClose}
				<button onclick={onClose} class="p-2 hover:bg-white/20 rounded-lg transition-colors">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>

		<!-- Progress Steps -->
		<div class="flex items-center gap-2 mt-4">
			{#each ['input', 'criteria', 'options', 'results'] as s, i}
				{@const isCurrent = step === s}
				{@const isPast = ['input', 'criteria', 'options', 'results'].indexOf(step) > i}
				<div class="flex items-center gap-2">
					<div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {
						isCurrent ? 'bg-white text-indigo-600' :
						isPast ? 'bg-white/30 text-white' : 'bg-white/10 text-white/50'
					}">
						{i + 1}
					</div>
					{#if i < 3}
						<div class="w-8 h-0.5 {isPast ? 'bg-white/30' : 'bg-white/10'}"></div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Content -->
	<div class="p-6">
		{#if step === 'input'}
			<!-- Step 1: Define the decision -->
			<div class="space-y-6">
				<div>
					<label for="decision" class="block text-sm font-medium text-gray-700 mb-2">
						What decision do you need to make?
					</label>
					<input
						id="decision"
						type="text"
						bind:value={decision}
						placeholder="e.g., Which contractor should I hire for my kitchen remodel?"
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					/>
				</div>

				<div>
					<label for="context" class="block text-sm font-medium text-gray-700 mb-2">
						Any additional context? <span class="text-gray-400">(optional)</span>
					</label>
					<textarea
						id="context"
						bind:value={context}
						placeholder="e.g., Budget is around $30k, need it done by summer, have 3 contractors in mind"
						rows="3"
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
					></textarea>
				</div>

				{#if error}
					<p class="text-sm text-red-600">{error}</p>
				{/if}

				<button
					onclick={suggestCriteria}
					disabled={!decision.trim() || loading || !aiSettings.isConfigured}
					class="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
				>
					{#if loading}
						<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
						Analyzing decision...
					{:else}
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
						</svg>
						Get AI Criteria Suggestions
					{/if}
				</button>

				{#if !aiSettings.isConfigured}
					<p class="text-sm text-amber-600 text-center">
						Set up AI in the top menu to get criteria suggestions.
					</p>
				{/if}
			</div>

		{:else if step === 'criteria'}
			<!-- Step 2: Review and adjust criteria -->
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-medium text-gray-900 mb-1">Evaluation Criteria</h3>
					{#if reasoning}
						<p class="text-sm text-gray-600">{reasoning}</p>
					{/if}
				</div>

				<div class="space-y-3">
					{#each criteria as criterion (criterion.id)}
						<div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-1">
										<span class="font-medium text-gray-900">{criterion.name}</span>
										<span class="px-2 py-0.5 text-xs rounded-full {categoryColors[criterion.category]}">
											{criterion.category}
										</span>
									</div>
									<p class="text-sm text-gray-600">{criterion.description}</p>
								</div>
								<button
									onclick={() => removeCriterion(criterion.id)}
									class="p-1 text-gray-400 hover:text-red-500 transition-colors"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
							<div class="mt-3">
								<label class="block text-xs text-gray-500 mb-1">
									Importance: {weightLabels[criterion.weight]}
								</label>
								<input
									type="range"
									min="1"
									max="5"
									value={criterion.weight}
									oninput={(e) => updateWeight(criterion.id, parseInt(e.currentTarget.value))}
									class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
								/>
							</div>
						</div>
					{/each}
				</div>

				<!-- Add custom criterion -->
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={newCriterionName}
						placeholder="Add custom criterion..."
						class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						onkeydown={(e) => e.key === 'Enter' && addCriterion()}
					/>
					<button
						onclick={addCriterion}
						disabled={!newCriterionName.trim()}
						class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
					>
						Add
					</button>
				</div>

				<div class="flex justify-between pt-4">
					<button
						onclick={() => step = 'input'}
						class="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
					>
						Back
					</button>
					<button
						onclick={() => step = 'options'}
						disabled={criteria.length === 0}
						class="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
					>
						Next: Add Options
					</button>
				</div>
			</div>

		{:else if step === 'options'}
			<!-- Step 3: Score options -->
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-medium text-gray-900 mb-1">Score Your Options</h3>
					<p class="text-sm text-gray-600">Rate each option against each criterion (1-5 stars)</p>
				</div>

				<!-- Add option -->
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={newOptionName}
						placeholder="Add an option (e.g., 'Contractor A', 'Option 1')..."
						class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						onkeydown={(e) => e.key === 'Enter' && addOption()}
					/>
					<button
						onclick={addOption}
						disabled={!newOptionName.trim()}
						class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
					>
						Add Option
					</button>
				</div>

				<!-- Options scoring table -->
				{#if options.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full border-collapse">
							<thead>
								<tr class="border-b border-gray-200">
									<th class="text-left py-3 px-4 font-medium text-gray-900 w-40">Criterion</th>
									{#each options as option (option.id)}
										<th class="text-center py-3 px-4 min-w-32">
											<div class="flex items-center justify-center gap-2">
												<span class="font-medium text-gray-900">{option.name}</span>
												<button
													onclick={() => removeOption(option.id)}
													class="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
												>
													<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											</div>
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each criteria as criterion (criterion.id)}
									<tr class="border-b border-gray-100">
										<td class="py-3 px-4">
											<span class="font-medium text-gray-700">{criterion.name}</span>
											<span class="text-xs text-gray-400 ml-1">(x{criterion.weight})</span>
										</td>
										{#each options as option (option.id)}
											<td class="py-3 px-4">
												<div class="flex justify-center gap-1">
													{#each [1, 2, 3, 4, 5] as score}
														<button
															onclick={() => updateScore(option.id, criterion.id, score)}
															class="w-8 h-8 rounded-full transition-colors {
																(option.scores[criterion.id] || 0) >= score
																	? 'bg-indigo-500 text-white'
																	: 'bg-gray-100 text-gray-400 hover:bg-gray-200'
															}"
														>
															{score}
														</button>
													{/each}
												</div>
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="text-center py-8 text-gray-500">
						Add at least 2 options to compare
					</div>
				{/if}

				<div class="flex justify-between pt-4">
					<button
						onclick={() => step = 'criteria'}
						class="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
					>
						Back
					</button>
					<button
						onclick={() => step = 'results'}
						disabled={!canShowResults}
						class="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
					>
						Show Results
					</button>
				</div>
			</div>

		{:else if step === 'results'}
			<!-- Step 4: Results -->
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-medium text-gray-900 mb-1">Decision Analysis</h3>
					<p class="text-sm text-gray-600">Based on your weighted criteria scores</p>
				</div>

				<!-- Ranked results -->
				<div class="space-y-4">
					{#each rankedOptions as option, i (option.id)}
						{@const isWinner = i === 0}
						<div class="p-4 rounded-lg border-2 {isWinner ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}">
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center gap-3">
									<span class="w-8 h-8 rounded-full flex items-center justify-center font-bold {
										isWinner ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
									}">
										{i + 1}
									</span>
									<span class="font-semibold text-lg {isWinner ? 'text-green-900' : 'text-gray-900'}">
										{option.name}
									</span>
								</div>
								<span class="text-2xl font-bold {isWinner ? 'text-green-600' : 'text-gray-600'}">
									{Math.round(option.totalScore)}%
								</span>
							</div>

							<!-- Score breakdown -->
							<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
								{#each criteria as criterion (criterion.id)}
									{@const score = option.scores[criterion.id] || 0}
									<div class="flex items-center gap-2 text-sm">
										<span class="text-gray-500">{criterion.name}:</span>
										<div class="flex">
											{#each [1, 2, 3, 4, 5] as s}
												<svg class="w-4 h-4 {score >= s ? 'text-amber-400' : 'text-gray-200'}" fill="currentColor" viewBox="0 0 20 20">
													<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
												</svg>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<!-- Summary -->
				{#if rankedOptions.length >= 2}
					{@const winner = rankedOptions[0]}
					{@const runnerUp = rankedOptions[1]}
					{@const margin = Math.round(winner.totalScore - runnerUp.totalScore)}
					<div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
						<h4 class="font-medium text-indigo-900 mb-2">Summary</h4>
						<p class="text-sm text-indigo-800">
							{#if margin > 20}
								<strong>{winner.name}</strong> is the clear winner, scoring {margin} points higher than the next option.
							{:else if margin > 5}
								<strong>{winner.name}</strong> has the edge, but <strong>{runnerUp.name}</strong> is a close second ({margin} points behind).
							{:else}
								It's nearly a tie between <strong>{winner.name}</strong> and <strong>{runnerUp.name}</strong>. Consider which criteria matter most to you personally.
							{/if}
						</p>
					</div>
				{/if}

				<div class="flex justify-between pt-4">
					<button
						onclick={() => step = 'options'}
						class="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
					>
						Back to Scoring
					</button>
					<button
						onclick={() => {
							step = 'input';
							decision = '';
							context = '';
							criteria = [];
							options = [];
						}}
						class="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
					>
						Start New Decision
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
