<script lang="ts">
	import { browser } from '$app/environment';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';

	interface Risk {
		id: string;
		title: string;
		description: string;
		severity: 'critical' | 'high' | 'medium' | 'low';
		probability: 'likely' | 'possible' | 'unlikely';
		category: string;
		mitigation: string;
		earlyWarnings: string[];
		relatedTasks: string[];
		impact: string;
		acknowledged?: boolean;
	}

	// State
	let loading = $state(false);
	let error = $state<string | null>(null);
	let risks = $state<Risk[]>([]);
	let summary = $state('');
	let analyzedAt = $state<string | null>(null);
	let filterSeverity = $state<string>('all');
	let filterCategory = $state<string>('all');
	let expandedRisks = $state<Set<string>>(new Set());
	let projectContext = $state('');

	// Load cached risks from localStorage
	const STORAGE_KEY = 'risk-register';
	if (browser) {
		try {
			const cached = localStorage.getItem(STORAGE_KEY);
			if (cached) {
				const parsed = JSON.parse(cached);
				risks = parsed.risks || [];
				summary = parsed.summary || '';
				analyzedAt = parsed.analyzedAt;
			}
		} catch {
			// Ignore
		}
	}

	// Save risks to localStorage
	function saveRisks() {
		if (browser && risks.length > 0) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ risks, summary, analyzedAt }));
		}
	}

	async function analyzeRisks() {
		const issues = issueStore.issues.filter(i => i.status !== 'closed');
		if (issues.length === 0) {
			error = 'Add some tasks first before analyzing risks';
			return;
		}

		loading = true;
		error = null;

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/analyze-risks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issues,
					projectContext: projectContext.trim() || undefined,
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				risks = data.risks;
				summary = data.summary;
				analyzedAt = data.analyzedAt;
				saveRisks();
			}
		} catch (e) {
			error = 'Failed to analyze risks';
		} finally {
			loading = false;
		}
	}

	function acknowledgeRisk(id: string) {
		risks = risks.map(r => r.id === id ? { ...r, acknowledged: true } : r);
		saveRisks();
	}

	function toggleExpanded(id: string) {
		const newSet = new Set(expandedRisks);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedRisks = newSet;
	}

	// Risk score for sorting (higher = more urgent)
	function getRiskScore(risk: Risk): number {
		const severityScores = { critical: 4, high: 3, medium: 2, low: 1 };
		const probabilityScores = { likely: 3, possible: 2, unlikely: 1 };
		return severityScores[risk.severity] * probabilityScores[risk.probability];
	}

	// Filtered and sorted risks
	let filteredRisks = $derived(
		risks
			.filter(r => filterSeverity === 'all' || r.severity === filterSeverity)
			.filter(r => filterCategory === 'all' || r.category === filterCategory)
			.sort((a, b) => getRiskScore(b) - getRiskScore(a))
	);

	// Counts
	let counts = $derived({
		total: risks.length,
		critical: risks.filter(r => r.severity === 'critical').length,
		high: risks.filter(r => r.severity === 'high').length,
		acknowledged: risks.filter(r => r.acknowledged).length
	});

	// Categories present in current risks
	let categories = $derived([...new Set(risks.map(r => r.category))].sort());

	const severityColors: Record<string, string> = {
		critical: 'bg-red-100 text-red-800 border-red-200',
		high: 'bg-orange-100 text-orange-800 border-orange-200',
		medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
		low: 'bg-blue-100 text-blue-800 border-blue-200'
	};

	const severityBgColors: Record<string, string> = {
		critical: 'bg-red-50 border-red-300',
		high: 'bg-orange-50 border-orange-300',
		medium: 'bg-yellow-50 border-yellow-300',
		low: 'bg-blue-50 border-blue-300'
	};

	const probabilityLabels: Record<string, string> = {
		likely: 'Likely (>50%)',
		possible: 'Possible (20-50%)',
		unlikely: 'Unlikely (<20%)'
	};

	const categoryLabels: Record<string, string> = {
		schedule: 'Timeline',
		financial: 'Financial',
		quality: 'Quality',
		external: 'External',
		resource: 'Resources',
		technical: 'Technical',
		personal: 'Personal'
	};
</script>

<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
	<!-- Header -->
	<div class="px-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold">Risk Register</h2>
				<p class="text-sm text-white/80">Identify what could go wrong before it happens</p>
			</div>
			{#if risks.length > 0}
				<div class="flex items-center gap-4 text-sm">
					{#if counts.critical > 0}
						<span class="px-2 py-1 bg-red-500 rounded-full font-medium">
							{counts.critical} Critical
						</span>
					{/if}
					{#if counts.high > 0}
						<span class="px-2 py-1 bg-orange-500/80 rounded-full font-medium">
							{counts.high} High
						</span>
					{/if}
					<span class="text-white/70">{counts.total} total</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Content -->
	<div class="p-6 space-y-6">
		{#if risks.length === 0}
			<!-- No risks yet - show analysis prompt -->
			<div class="text-center py-8">
				<svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<h3 class="text-lg font-medium text-gray-900 mb-2">No Risks Analyzed Yet</h3>
				<p class="text-gray-600 mb-6 max-w-md mx-auto">
					Let AI analyze your project tasks to identify potential risks, early warning signs, and mitigation strategies.
				</p>

				<div class="max-w-md mx-auto mb-4">
					<input
						type="text"
						bind:value={projectContext}
						placeholder="Optional: Add context about your project (budget, timeline, concerns)..."
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
					/>
				</div>

				{#if error}
					<p class="text-sm text-red-600 mb-4">{error}</p>
				{/if}

				<button
					onclick={analyzeRisks}
					disabled={loading || !aiSettings.isConfigured}
					class="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
				>
					{#if loading}
						<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
						Analyzing project risks...
					{:else}
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						Analyze Risks
					{/if}
				</button>

				{#if !aiSettings.isConfigured}
					<p class="text-sm text-amber-600 mt-4">
						Set up AI in the top menu to analyze risks.
					</p>
				{/if}
			</div>
		{:else}
			<!-- Summary -->
			{#if summary}
				<div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
					<h4 class="font-medium text-gray-900 mb-2">Risk Assessment Summary</h4>
					<p class="text-sm text-gray-700">{summary}</p>
					{#if analyzedAt}
						<p class="text-xs text-gray-400 mt-2">
							Last analyzed: {new Date(analyzedAt).toLocaleString()}
						</p>
					{/if}
				</div>
			{/if}

			<!-- Filters -->
			<div class="flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-2">
					<label class="text-sm text-gray-600">Severity:</label>
					<select
						bind:value={filterSeverity}
						class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
					>
						<option value="all">All</option>
						<option value="critical">Critical</option>
						<option value="high">High</option>
						<option value="medium">Medium</option>
						<option value="low">Low</option>
					</select>
				</div>

				{#if categories.length > 1}
					<div class="flex items-center gap-2">
						<label class="text-sm text-gray-600">Category:</label>
						<select
							bind:value={filterCategory}
							class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
						>
							<option value="all">All</option>
							{#each categories as cat}
								<option value={cat}>{categoryLabels[cat] || cat}</option>
							{/each}
						</select>
					</div>
				{/if}

				<button
					onclick={analyzeRisks}
					disabled={loading}
					class="ml-auto px-4 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center gap-2"
				>
					{#if loading}
						<span class="w-4 h-4 border-2 border-red-400/30 border-t-red-600 rounded-full animate-spin"></span>
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
					{/if}
					Re-analyze
				</button>
			</div>

			<!-- Risk List -->
			<div class="space-y-4">
				{#each filteredRisks as risk (risk.id)}
					{@const isExpanded = expandedRisks.has(risk.id)}
					<div class="border-2 rounded-xl overflow-hidden transition-all {severityBgColors[risk.severity]} {risk.acknowledged ? 'opacity-60' : ''}">
						<button
							type="button"
							onclick={() => toggleExpanded(risk.id)}
							class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/30 transition-colors"
						>
							<div class="flex items-center gap-3">
								<span class="px-2 py-0.5 text-xs font-medium rounded border {severityColors[risk.severity]}">
									{risk.severity.toUpperCase()}
								</span>
								<span class="font-medium text-gray-900">{risk.title}</span>
								{#if risk.acknowledged}
									<span class="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
										Acknowledged
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-3">
								<span class="text-xs text-gray-500">{categoryLabels[risk.category] || risk.category}</span>
								<svg
									class="w-4 h-4 text-gray-500 transition-transform {isExpanded ? 'rotate-180' : ''}"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</div>
						</button>

						{#if isExpanded}
							<div class="px-4 pb-4 space-y-4 bg-white/50">
								<div class="flex items-center gap-4 text-sm">
									<span class="text-gray-500">Probability:</span>
									<span class="font-medium text-gray-700">{probabilityLabels[risk.probability]}</span>
								</div>

								<div>
									<h5 class="text-sm font-medium text-gray-700 mb-1">Description</h5>
									<p class="text-sm text-gray-600">{risk.description}</p>
								</div>

								<div>
									<h5 class="text-sm font-medium text-gray-700 mb-1">Impact</h5>
									<p class="text-sm text-gray-600">{risk.impact}</p>
								</div>

								<div>
									<h5 class="text-sm font-medium text-gray-700 mb-1">Mitigation</h5>
									<p class="text-sm text-green-700">{risk.mitigation}</p>
								</div>

								{#if risk.earlyWarnings.length > 0}
									<div>
										<h5 class="text-sm font-medium text-gray-700 mb-1">Early Warning Signs</h5>
										<ul class="text-sm text-amber-700 space-y-1">
											{#each risk.earlyWarnings as warning}
												<li class="flex items-start gap-2">
													<svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
													</svg>
													{warning}
												</li>
											{/each}
										</ul>
									</div>
								{/if}

								{#if risk.relatedTasks.length > 0}
									<div>
										<h5 class="text-sm font-medium text-gray-700 mb-1">Related Tasks</h5>
										<div class="flex flex-wrap gap-2">
											{#each risk.relatedTasks as task}
												<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">{task}</span>
											{/each}
										</div>
									</div>
								{/if}

								{#if !risk.acknowledged}
									<button
										onclick={() => acknowledgeRisk(risk.id)}
										class="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
									>
										Acknowledge Risk
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if filteredRisks.length === 0}
				<div class="text-center py-8 text-gray-500">
					No risks match the current filters.
				</div>
			{/if}
		{/if}
	</div>
</div>
