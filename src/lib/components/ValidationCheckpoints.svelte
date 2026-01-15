<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';
	import type { Issue } from '$lib/types/issue';

	interface ExpertQuestion {
		question: string;
		whyAsk: string;
		redFlags: string[];
	}

	interface ExpertGuidance {
		questions: ExpertQuestion[];
		expertType: string;
		beforeYouGo: string;
		afterConsult: string;
	}

	// State
	let isOpen = $state(true);
	let selectedIssue = $state<Issue | null>(null);
	let guidance = $state<ExpertGuidance | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Tasks requiring validation
	let validationTasks = $derived(
		issueStore.issues.filter(
			(i) => i.validationRequired && i.status !== 'closed'
		).sort((a, b) => a.priority - b.priority)
	);

	// Group by expert type
	let tasksByExpert = $derived.by(() => {
		const groups = new Map<string, Issue[]>();
		for (const task of validationTasks) {
			const expert = task.executionReason?.includes('expert') || task.executionReason?.includes('review')
				? extractExpertType(task)
				: 'Professional Review';
			if (!groups.has(expert)) groups.set(expert, []);
			groups.get(expert)!.push(task);
		}
		return groups;
	});

	function extractExpertType(task: Issue): string {
		const description = `${task.title} ${task.description} ${task.executionReason || ''}`.toLowerCase();

		if (description.includes('legal') || description.includes('attorney') || description.includes('contract'))
			return 'Legal Professional';
		if (description.includes('accountant') || description.includes('cpa') || description.includes('tax'))
			return 'Financial/Tax Professional';
		if (description.includes('engineer') || description.includes('structural') || description.includes('building'))
			return 'Licensed Engineer';
		if (description.includes('inspector') || description.includes('inspection'))
			return 'Licensed Inspector';
		if (description.includes('realtor') || description.includes('real estate'))
			return 'Real Estate Professional';
		if (description.includes('doctor') || description.includes('medical'))
			return 'Medical Professional';
		if (description.includes('insurance'))
			return 'Insurance Professional';

		return 'Professional Expert';
	}

	async function getExpertGuidance(task: Issue) {
		selectedIssue = task;
		guidance = null;
		error = null;
		loading = true;

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/suggest-expert-questions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					taskTitle: task.title,
					taskDescription: task.description,
					expertType: extractExpertType(task),
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				guidance = data;
			}
		} catch (e) {
			error = 'Failed to generate expert questions';
		} finally {
			loading = false;
		}
	}

	function closeGuidance() {
		selectedIssue = null;
		guidance = null;
	}

	// Mark validation as complete (changes validationRequired to false)
	function markValidated(issueId: string) {
		issueStore.update(issueId, {
			validationRequired: false,
			executionReason: 'Expert validation completed'
		});
	}

	const expertIcons: Record<string, string> = {
		'Legal Professional': 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
		'Financial/Tax Professional': 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		'Licensed Engineer': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
		'default': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
	};

	function getExpertIcon(expertType: string): string {
		for (const [key, icon] of Object.entries(expertIcons)) {
			if (expertType.includes(key.split(' ')[0])) return icon;
		}
		return expertIcons.default;
	}
</script>

{#if validationTasks.length > 0}
	<div class="bg-white rounded-xl border border-amber-200 overflow-hidden">
		<button
			type="button"
			onclick={() => isOpen = !isOpen}
			class="w-full px-4 py-3 flex items-center justify-between text-left bg-amber-50 hover:bg-amber-100 transition-colors"
		>
			<div class="flex items-center gap-2">
				<svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
				</svg>
				<span class="font-medium text-amber-900">Validation Checkpoints</span>
				<span class="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded-full">
					{validationTasks.length} task{validationTasks.length === 1 ? '' : 's'}
				</span>
			</div>
			<svg
				class="w-4 h-4 text-amber-600 transition-transform {isOpen ? 'rotate-180' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if isOpen}
			<div class="p-4 space-y-4">
				<p class="text-sm text-gray-600">
					These tasks require professional validation before proceeding. Don't skip these checkpoints - they protect you from costly mistakes.
				</p>

				<!-- Expert guidance modal -->
				{#if selectedIssue}
					<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
						<button
							type="button"
							class="absolute inset-0 bg-black/50 cursor-default"
							onclick={closeGuidance}
							aria-label="Close"
						></button>
						<div class="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
							<div class="sticky top-0 bg-amber-50 px-6 py-4 border-b border-amber-200">
								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-semibold text-amber-900">Expert Consultation Guide</h3>
										<p class="text-sm text-amber-700">{selectedIssue.title}</p>
									</div>
									<button
										onclick={closeGuidance}
										class="p-2 hover:bg-amber-100 rounded-lg transition-colors"
									>
										<svg class="w-5 h-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</div>

							<div class="p-6">
								{#if loading}
									<div class="flex items-center justify-center py-8">
										<div class="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
									</div>
								{:else if error}
									<div class="text-center py-8">
										<p class="text-red-600 mb-4">{error}</p>
										<button
											onclick={() => getExpertGuidance(selectedIssue!)}
											class="px-4 py-2 text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
										>
											Try Again
										</button>
									</div>
								{:else if guidance}
									<div class="space-y-6">
										<div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
											<h4 class="font-medium text-blue-900 mb-1">Expert Type</h4>
											<p class="text-blue-800">{guidance.expertType}</p>
										</div>

										<div>
											<h4 class="font-medium text-gray-900 mb-1">Before You Go</h4>
											<p class="text-sm text-gray-700">{guidance.beforeYouGo}</p>
										</div>

										<div>
											<h4 class="font-medium text-gray-900 mb-3">Questions to Ask</h4>
											<div class="space-y-4">
												{#each guidance.questions as q, i}
													<div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
														<div class="flex items-start gap-3">
															<span class="flex-shrink-0 w-6 h-6 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
																{i + 1}
															</span>
															<div class="flex-1">
																<p class="font-medium text-gray-900">{q.question}</p>
																<p class="text-sm text-gray-600 mt-1">{q.whyAsk}</p>
																{#if q.redFlags.length > 0}
																	<div class="mt-2 p-2 bg-red-50 rounded border border-red-200">
																		<p class="text-xs font-medium text-red-800 mb-1">Watch out for:</p>
																		<ul class="text-xs text-red-700 space-y-0.5">
																			{#each q.redFlags as flag}
																				<li class="flex items-start gap-1">
																					<span class="text-red-500">!</span>
																					{flag}
																				</li>
																			{/each}
																		</ul>
																	</div>
																{/if}
															</div>
														</div>
													</div>
												{/each}
											</div>
										</div>

										<div>
											<h4 class="font-medium text-gray-900 mb-1">After the Consultation</h4>
											<p class="text-sm text-gray-700">{guidance.afterConsult}</p>
										</div>

										<div class="flex items-center justify-between pt-4 border-t border-gray-200">
											<button
												onclick={closeGuidance}
												class="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
											>
												Close
											</button>
											<button
												onclick={() => { markValidated(selectedIssue!.id); closeGuidance(); }}
												class="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
											>
												Mark as Validated
											</button>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- Tasks grouped by expert type -->
				{#each [...tasksByExpert.entries()] as [expert, tasks]}
					<div class="border border-gray-200 rounded-lg overflow-hidden">
						<div class="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
							<svg class="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getExpertIcon(expert)} />
							</svg>
							<span class="font-medium text-gray-700">{expert}</span>
							<span class="text-xs text-gray-500">({tasks.length})</span>
						</div>
						<div class="divide-y divide-gray-100">
							{#each tasks as task}
								<div class="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
									<div class="flex-1 min-w-0 pr-4">
										<a
											href="/issue/{task.id}"
											class="font-medium text-gray-900 hover:text-blue-600 truncate block"
										>
											{task.title}
										</a>
										{#if task.executionReason}
											<p class="text-xs text-gray-500 truncate">{task.executionReason}</p>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										{#if aiSettings.isConfigured}
											<button
												onclick={() => getExpertGuidance(task)}
												class="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
											>
												Prepare Questions
											</button>
										{/if}
										<button
											onclick={() => markValidated(task.id)}
											class="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
										>
											Done
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
