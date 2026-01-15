<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';
	import type { Issue, BudgetEstimate, BudgetAlternative } from '$lib/types/issue';

	// State
	let loading = $state(false);
	let error = $state<string | null>(null);
	let location = $state('');
	let currency = $state('USD');
	let selectedIssue = $state<Issue | null>(null);
	let recordingCost = $state(false);
	let newCostAmount = $state<number>(0);
	let newCostNotes = $state('');

	// Open issues without budget estimates
	let openIssues = $derived(
		issueStore.issues.filter(i => i.status !== 'closed')
	);

	// Issues with estimates
	let issuesWithEstimates = $derived(issueStore.withBudgetEstimates);

	// Budget totals
	let totalBudget = $derived(issueStore.totalBudget);
	let totalActual = $derived(issueStore.totalActualCost);
	let variance = $derived(issueStore.getBudgetVariance());
	let overBudgetIssues = $derived(issueStore.overBudget);

	// Format currency
	function formatCurrency(amount: number, curr: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: curr,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}

	async function generateEstimates() {
		if (openIssues.length === 0) return;

		loading = true;
		error = null;

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/estimate-costs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issues: openIssues,
					location: location || undefined,
					currency,
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
				return;
			}

			// Apply estimates to issues
			for (const est of data.estimates) {
				issueStore.updateBudgetEstimate(est.issueId, est.estimate);
			}
		} catch (e) {
			error = 'Failed to generate cost estimates';
		} finally {
			loading = false;
		}
	}

	function openCostRecorder(issue: Issue) {
		selectedIssue = issue;
		newCostAmount = issue.actualCost?.amount || issue.budgetEstimate?.expectedCost || 0;
		newCostNotes = issue.actualCost?.notes || '';
		recordingCost = true;
	}

	function closeCostRecorder() {
		selectedIssue = null;
		recordingCost = false;
		newCostAmount = 0;
		newCostNotes = '';
	}

	function recordCost() {
		if (!selectedIssue) return;
		issueStore.recordActualCost(selectedIssue.id, newCostAmount, currency, newCostNotes || undefined);
		closeCostRecorder();
	}

	function clearCost(issueId: string) {
		issueStore.clearActualCost(issueId);
	}

	// Get status color based on budget vs actual
	function getBudgetStatusColor(issue: Issue): string {
		if (!issue.actualCost || !issue.budgetEstimate) return 'bg-gray-100';
		const ratio = issue.actualCost.amount / issue.budgetEstimate.expectedCost;
		if (ratio <= 0.8) return 'bg-green-100 border-green-300';
		if (ratio <= 1.0) return 'bg-yellow-100 border-yellow-300';
		if (ratio <= 1.2) return 'bg-orange-100 border-orange-300';
		return 'bg-red-100 border-red-300';
	}
</script>

<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
	<!-- Header -->
	<div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-gray-900">Budget Tracker</h2>
				<p class="text-sm text-gray-600">Track and estimate project costs</p>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="p-6">
		{#if openIssues.length === 0}
			<div class="text-center py-12 text-gray-500">
				<svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p>No tasks to estimate</p>
				<p class="text-sm mt-1">Add tasks to see cost estimates</p>
			</div>
		{:else if issuesWithEstimates.length === 0}
			<!-- Generate estimates form -->
			<div class="max-w-xl mx-auto">
				<div class="grid grid-cols-2 gap-4 mb-6">
					<div>
						<label for="location" class="block text-sm font-medium text-gray-700 mb-2">
							Location (optional)
						</label>
						<input
							id="location"
							type="text"
							bind:value={location}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							placeholder="e.g., San Francisco, CA"
						/>
					</div>
					<div>
						<label for="currency" class="block text-sm font-medium text-gray-700 mb-2">
							Currency
						</label>
						<select
							id="currency"
							bind:value={currency}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						>
							<option value="USD">USD ($)</option>
							<option value="EUR">EUR (\u20AC)</option>
							<option value="GBP">GBP (\u00A3)</option>
							<option value="CAD">CAD (C$)</option>
							<option value="AUD">AUD (A$)</option>
						</select>
					</div>
				</div>

				<button
					onclick={generateEstimates}
					disabled={loading || !aiSettings.isConfigured}
					class="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
				>
					{#if loading}
						<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
						Estimating costs...
					{:else}
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Generate Cost Estimates
					{/if}
				</button>

				{#if !aiSettings.isConfigured}
					<p class="text-sm text-amber-600 mt-3 text-center">
						Configure AI settings to generate cost estimates
					</p>
				{/if}
			</div>
		{:else}
			{#if error}
				<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
					{error}
				</div>
			{/if}

			<!-- Budget Summary -->
			<div class="grid grid-cols-4 gap-4 mb-6">
				<div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
					<p class="text-sm text-blue-700">Estimated Budget</p>
					<p class="text-2xl font-bold text-blue-900">{formatCurrency(totalBudget.expected, totalBudget.currency)}</p>
					<p class="text-xs text-blue-600">Range: {formatCurrency(totalBudget.min)} - {formatCurrency(totalBudget.max)}</p>
				</div>
				<div class="p-4 bg-green-50 rounded-lg border border-green-200">
					<p class="text-sm text-green-700">Actual Spent</p>
					<p class="text-2xl font-bold text-green-900">{formatCurrency(totalActual.amount, totalActual.currency)}</p>
					<p class="text-xs text-green-600">Recorded costs</p>
				</div>
				<div class="p-4 rounded-lg border {variance.variance > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}">
					<p class="text-sm {variance.variance > 0 ? 'text-red-700' : 'text-emerald-700'}">Variance</p>
					<p class="text-2xl font-bold {variance.variance > 0 ? 'text-red-900' : 'text-emerald-900'}">
						{variance.variance >= 0 ? '+' : ''}{formatCurrency(variance.variance, totalBudget.currency)}
					</p>
					<p class="text-xs {variance.variance > 0 ? 'text-red-600' : 'text-emerald-600'}">
						{variance.percentOver >= 0 ? '+' : ''}{variance.percentOver.toFixed(1)}% vs expected
					</p>
				</div>
				<div class="p-4 bg-amber-50 rounded-lg border border-amber-200">
					<p class="text-sm text-amber-700">Over Budget</p>
					<p class="text-2xl font-bold text-amber-900">{overBudgetIssues.length}</p>
					<p class="text-xs text-amber-600">tasks exceeded estimate</p>
				</div>
			</div>

			<!-- Cost Recording Modal -->
			{#if recordingCost && selectedIssue}
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						class="absolute inset-0 bg-black/50 cursor-default"
						onclick={closeCostRecorder}
						aria-label="Close"
					></button>
					<div class="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
						<h3 class="text-lg font-semibold text-gray-900 mb-4">Record Actual Cost</h3>
						<p class="text-sm text-gray-600 mb-4">{selectedIssue.title}</p>

						{#if selectedIssue.budgetEstimate}
							<div class="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
								<p class="text-gray-600">Estimated: {formatCurrency(selectedIssue.budgetEstimate.expectedCost, selectedIssue.budgetEstimate.currency)}</p>
								<p class="text-gray-500 text-xs">Range: {formatCurrency(selectedIssue.budgetEstimate.minCost)} - {formatCurrency(selectedIssue.budgetEstimate.maxCost)}</p>
							</div>
						{/if}

						<div class="mb-4">
							<label for="amount" class="block text-sm font-medium text-gray-700 mb-2">
								Actual Amount ({currency})
							</label>
							<input
								id="amount"
								type="number"
								bind:value={newCostAmount}
								min="0"
								step="1"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>

						<div class="mb-6">
							<label for="notes" class="block text-sm font-medium text-gray-700 mb-2">
								Notes (optional)
							</label>
							<textarea
								id="notes"
								bind:value={newCostNotes}
								rows="2"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								placeholder="e.g., Paid via credit card, includes tip"
							></textarea>
						</div>

						<div class="flex justify-end gap-3">
							<button
								onclick={closeCostRecorder}
								class="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
							>
								Cancel
							</button>
							<button
								onclick={recordCost}
								class="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
							>
								Record Cost
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Task List with Costs -->
			<div class="space-y-3">
				{#each issuesWithEstimates as issue (issue.id)}
					<div class="p-4 border rounded-lg {getBudgetStatusColor(issue)} transition-colors">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<a
									href="/issue/{issue.id}"
									class="font-medium text-gray-900 hover:text-blue-600"
								>
									{issue.title}
								</a>
								{#if issue.budgetEstimate}
									<div class="text-sm text-gray-600 mt-1">
										<span class="font-medium">Estimated:</span>
										{formatCurrency(issue.budgetEstimate.expectedCost, issue.budgetEstimate.currency)}
										<span class="text-gray-400">
											({formatCurrency(issue.budgetEstimate.minCost)} - {formatCurrency(issue.budgetEstimate.maxCost)})
										</span>
									</div>
									{#if issue.budgetEstimate.reasoning}
										<p class="text-xs text-gray-500 mt-1">{issue.budgetEstimate.reasoning}</p>
									{/if}
									{#if issue.budgetEstimate.alternatives && issue.budgetEstimate.alternatives.length > 0}
										<details class="mt-2">
											<summary class="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
												{issue.budgetEstimate.alternatives.length} cost-saving alternative{issue.budgetEstimate.alternatives.length > 1 ? 's' : ''}
											</summary>
											<div class="mt-2 space-y-1">
												{#each issue.budgetEstimate.alternatives as alt}
													<div class="text-xs p-2 bg-white/50 rounded border border-gray-200">
														<p class="font-medium text-gray-700">{alt.description}</p>
														<p class="text-green-600">Save {formatCurrency(alt.savings)}</p>
														<p class="text-gray-500">Tradeoff: {alt.tradeoff}</p>
													</div>
												{/each}
											</div>
										</details>
									{/if}
								{/if}
							</div>
							<div class="ml-4 text-right">
								{#if issue.actualCost}
									<div class="text-lg font-bold {issue.actualCost.amount > (issue.budgetEstimate?.maxCost || Infinity) ? 'text-red-600' : 'text-green-600'}">
										{formatCurrency(issue.actualCost.amount, issue.actualCost.currency)}
									</div>
									<p class="text-xs text-gray-500">Actual</p>
									{#if issue.actualCost.notes}
										<p class="text-xs text-gray-400 mt-1">{issue.actualCost.notes}</p>
									{/if}
									<button
										onclick={() => openCostRecorder(issue)}
										class="text-xs text-blue-600 hover:text-blue-800 mt-1"
									>
										Edit
									</button>
								{:else}
									<button
										onclick={() => openCostRecorder(issue)}
										class="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
									>
										Record Cost
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Re-estimate button -->
			<div class="mt-6 flex items-center justify-between">
				<p class="text-sm text-gray-500">
					{issuesWithEstimates.length} tasks with estimates
				</p>
				<button
					onclick={generateEstimates}
					disabled={loading}
					class="px-4 py-2 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
				>
					Re-estimate costs
				</button>
			</div>
		{/if}
	</div>
</div>
