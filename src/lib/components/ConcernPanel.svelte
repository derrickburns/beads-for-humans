<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import type { Issue, Concern, ConcernTier } from '$lib/types/issue';

	interface Props {
		goalId: string;
		onConcernAction?: (concernId: string, action: string) => void;
	}

	let { goalId, onConcernAction }: Props = $props();

	// Track which tiers are expanded
	let expandedTiers = $state<Set<ConcernTier>>(new Set([1, 2])); // Show blockers and critical by default
	let expandedConcerns = $state<Set<string>>(new Set());

	// Get concerns by tier
	let concernsByTier = $derived(issueStore.getConcernsByTier(goalId));

	const tierConfig: Record<ConcernTier, { label: string; color: string; bgColor: string; icon: string; description: string }> = {
		1: {
			label: 'Blockers',
			color: 'text-red-700',
			bgColor: 'bg-red-50 border-red-200',
			icon: '🚨',
			description: 'Must be resolved before proceeding'
		},
		2: {
			label: 'Critical',
			color: 'text-orange-700',
			bgColor: 'bg-orange-50 border-orange-200',
			icon: '⚠️',
			description: 'High risk if not addressed'
		},
		3: {
			label: 'Considerations',
			color: 'text-yellow-700',
			bgColor: 'bg-yellow-50 border-yellow-200',
			icon: '💡',
			description: 'Worth thinking about'
		},
		4: {
			label: 'Background',
			color: 'text-gray-600',
			bgColor: 'bg-gray-50 border-gray-200',
			icon: '📋',
			description: 'Good to know'
		}
	};

	const concernTypeLabels: Record<string, string> = {
		assumption: 'Assumption',
		risk: 'Risk',
		gap: 'Gap',
		dependency: 'Dependency',
		scope_expansion: 'Scope Expansion',
		hidden_work: 'Hidden Work'
	};

	const concernTypeColors: Record<string, string> = {
		assumption: 'bg-purple-100 text-purple-700',
		risk: 'bg-red-100 text-red-700',
		gap: 'bg-blue-100 text-blue-700',
		dependency: 'bg-cyan-100 text-cyan-700',
		scope_expansion: 'bg-amber-100 text-amber-700',
		hidden_work: 'bg-pink-100 text-pink-700'
	};

	function toggleTier(tier: ConcernTier) {
		const newExpanded = new Set(expandedTiers);
		if (newExpanded.has(tier)) {
			newExpanded.delete(tier);
		} else {
			newExpanded.add(tier);
		}
		expandedTiers = newExpanded;
	}

	function toggleConcern(concernId: string) {
		const newExpanded = new Set(expandedConcerns);
		if (newExpanded.has(concernId)) {
			newExpanded.delete(concernId);
		} else {
			newExpanded.add(concernId);
		}
		expandedConcerns = newExpanded;
	}

	function handleAction(issueId: string, concernId: string, action: Concern['status']) {
		issueStore.updateConcernStatus(issueId, concernId, action);
		onConcernAction?.(concernId, action);
	}

	function getTotalOpenCount(): number {
		return Object.values(concernsByTier).reduce(
			(sum, items) => sum + items.filter(c => c.concern.status === 'open').length,
			0
		);
	}

	let totalOpen = $derived(getTotalOpenCount());
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
	<!-- Header -->
	<div class="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-semibold text-gray-900 flex items-center gap-2">
					<svg class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					Concerns & Risks
				</h3>
				<p class="text-sm text-gray-500 mt-0.5">
					{totalOpen} open concern{totalOpen !== 1 ? 's' : ''} to review
				</p>
			</div>
			<div class="flex gap-1">
				{#each [1, 2, 3, 4] as tier}
					{@const count = concernsByTier[tier as ConcernTier]?.length || 0}
					{#if count > 0}
						<button
							onclick={() => toggleTier(tier as ConcernTier)}
							class="px-2 py-1 text-xs font-medium rounded-full transition-colors {expandedTiers.has(tier as ConcernTier) ? tierConfig[tier as ConcernTier].bgColor + ' border' : 'bg-gray-100 text-gray-500'}"
						>
							{tierConfig[tier as ConcernTier].icon} {count}
						</button>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	<!-- Concern Tiers -->
	<div class="divide-y divide-gray-100">
		{#each [1, 2, 3, 4] as tier}
			{@const tierData = concernsByTier[tier as ConcernTier] || []}
			{@const config = tierConfig[tier as ConcernTier]}
			{@const openCount = tierData.filter(c => c.concern.status === 'open').length}

			{#if tierData.length > 0}
				<div class="border-l-4 {tier === 1 ? 'border-l-red-400' : tier === 2 ? 'border-l-orange-400' : tier === 3 ? 'border-l-yellow-400' : 'border-l-gray-300'}">
					<!-- Tier Header -->
					<button
						onclick={() => toggleTier(tier as ConcernTier)}
						class="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
					>
						<div class="flex items-center gap-3">
							<span class="text-lg">{config.icon}</span>
							<div class="text-left">
								<span class="font-medium {config.color}">{config.label}</span>
								<span class="text-xs text-gray-500 ml-2">
									{openCount} open of {tierData.length}
								</span>
							</div>
						</div>
						<svg
							class="w-5 h-5 text-gray-400 transition-transform {expandedTiers.has(tier as ConcernTier) ? 'rotate-180' : ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					<!-- Tier Contents -->
					{#if expandedTiers.has(tier as ConcernTier)}
						<div class="px-5 pb-4 space-y-3">
							{#each tierData as { issue, concern }}
								<div class="rounded-lg border {config.bgColor} overflow-hidden">
									<!-- Concern Header -->
									<button
										onclick={() => toggleConcern(concern.id)}
										class="w-full px-4 py-3 flex items-start justify-between text-left"
									>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 flex-wrap mb-1">
												<span class="px-2 py-0.5 text-xs font-medium rounded-full {concernTypeColors[concern.type] || 'bg-gray-100 text-gray-700'}">
													{concernTypeLabels[concern.type] || concern.type}
												</span>
												{#if concern.status !== 'open'}
													<span class="px-2 py-0.5 text-xs font-medium rounded-full {concern.status === 'addressed' ? 'bg-green-100 text-green-700' : concern.status === 'deferred' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}">
														{concern.status}
													</span>
												{/if}
											</div>
											<h4 class="font-medium text-gray-900">{concern.title}</h4>
											<p class="text-sm text-gray-600 mt-0.5 line-clamp-2">{concern.description}</p>
										</div>
										<svg
											class="w-4 h-4 text-gray-400 ml-2 flex-shrink-0 transition-transform {expandedConcerns.has(concern.id) ? 'rotate-180' : ''}"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</button>

									<!-- Expanded Details -->
									{#if expandedConcerns.has(concern.id)}
										<div class="px-4 pb-4 pt-2 border-t border-gray-200/50 space-y-3">
											<!-- Metrics -->
											<div class="flex gap-4 text-sm">
												<div>
													<span class="text-gray-500">Impact:</span>
													<span class="font-medium ml-1">{concern.impact === 3 ? 'High' : concern.impact === 2 ? 'Medium' : 'Low'}</span>
												</div>
												<div>
													<span class="text-gray-500">Probability:</span>
													<span class="font-medium ml-1">{concern.probability === 3 ? 'High' : concern.probability === 2 ? 'Medium' : 'Low'}</span>
												</div>
												<div>
													<span class="text-gray-500">Urgency:</span>
													<span class="font-medium ml-1">{concern.urgency === 3 ? 'High' : concern.urgency === 2 ? 'Medium' : 'Low'}</span>
												</div>
											</div>

											<!-- Related Issues -->
											{#if concern.relatedIssueIds.length > 0}
												<div>
													<span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Related Issues</span>
													<div class="flex flex-wrap gap-1 mt-1">
														{#each concern.relatedIssueIds as relatedId}
															{@const relatedIssue = issueStore.getById(relatedId)}
															{#if relatedIssue}
																<a
																	href="/issue/{relatedId}"
																	class="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-700 hover:bg-gray-50"
																>
																	{relatedIssue.title}
																</a>
															{/if}
														{/each}
													</div>
												</div>
											{/if}

											<!-- Suggested Actions -->
											{#if concern.suggestedActions && concern.suggestedActions.length > 0}
												<div>
													<span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Suggested Actions</span>
													<div class="space-y-2 mt-2">
														{#each concern.suggestedActions as action}
															<div class="flex items-start gap-2 text-sm">
																<span class="text-gray-400">•</span>
																<div class="flex-1">
																	<p class="text-gray-700">{action.description}</p>
																	{#if action.creates}
																		<button
																			onclick={() => {
																				if (action.creates) {
																					issueStore.create({
																						title: action.creates.title || action.description,
																						description: action.creates.description || '',
																						type: action.creates.issueType || 'task',
																						priority: 2
																					});
																				}
																			}}
																			class="text-xs text-blue-600 hover:text-blue-700 mt-1"
																		>
																			+ Create issue
																		</button>
																	{/if}
																</div>
															</div>
														{/each}
													</div>
												</div>
											{/if}

											<!-- Resolution (if addressed) -->
											{#if concern.resolution}
												<div class="p-3 bg-green-50 rounded-lg">
													<span class="text-xs font-medium text-green-700 uppercase tracking-wide">Resolution</span>
													<p class="text-sm text-green-800 mt-1">{concern.resolution}</p>
												</div>
											{/if}

											<!-- Actions -->
											{#if concern.status === 'open'}
												<div class="flex gap-2 pt-2">
													<button
														onclick={() => handleAction(issue.id, concern.id, 'addressed')}
														class="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
													>
														Mark Addressed
													</button>
													<button
														onclick={() => handleAction(issue.id, concern.id, 'deferred')}
														class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
													>
														Defer
													</button>
													<button
														onclick={() => handleAction(issue.id, concern.id, 'accepted')}
														class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
													>
														Accept Risk
													</button>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/each}

		{#if totalOpen === 0 && Object.values(concernsByTier).every(t => t.length === 0)}
			<div class="px-5 py-8 text-center">
				<div class="text-gray-400 mb-2">
					<svg class="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<p class="text-gray-500">No concerns identified yet</p>
				<p class="text-sm text-gray-400 mt-1">Use the red-team analysis to surface risks and assumptions</p>
			</div>
		{/if}
	</div>
</div>
