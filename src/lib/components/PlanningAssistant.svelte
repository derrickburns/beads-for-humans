<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';
	import type { Issue, Concern, Constraint, ScopeBoundary } from '$lib/types/issue';
	import ConcernPanel from './ConcernPanel.svelte';

	interface Props {
		goalId: string;
	}

	let { goalId }: Props = $props();

	let loading = $state(false);
	let activeAction = $state<string | null>(null);
	let result = $state<{
		type: 'refinement' | 'risks' | 'decomposition' | 'scope' | 'accuracy';
		data: unknown;
	} | null>(null);
	let error = $state<string | null>(null);

	let goal = $derived(issueStore.getById(goalId));
	let projectScope = $derived(issueStore.getProjectScope(goalId));
	let scopeExpansion = $derived(issueStore.detectScopeExpansion(goalId));
	let planAccuracy = $derived(issueStore.checkPlanAccuracy(goalId));

	async function runAction(action: string) {
		if (!goal || !aiSettings.isConfigured) return;

		loading = true;
		activeAction = action;
		error = null;
		result = null;

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/red-team-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action,
					goal: {
						id: goal.id,
						title: goal.title,
						description: goal.description,
						type: goal.type,
						status: goal.status,
						scopeBoundary: goal.scopeBoundary,
						constraints: goal.constraints,
						successCriteria: goal.successCriteria
					},
					context: {
						existingIssues: projectScope.allIssues,
						constraints: issueStore.getEffectiveConstraints(goalId),
						scopeBoundary: goal.scopeBoundary
					},
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
				return;
			}

			// Process and apply results based on action type
			if (action === 'refine_goal' && data.refinedGoal) {
				result = { type: 'refinement', data: data };
			} else if (action === 'analyze_risks' && data.concerns) {
				result = { type: 'risks', data: data };
			} else if (action === 'suggest_decomposition' && data.subtasks) {
				result = { type: 'decomposition', data: data };
			} else if (action === 'detect_scope_expansion') {
				result = { type: 'scope', data: data };
			} else if (action === 'validate_accuracy') {
				result = { type: 'accuracy', data: data };
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to run analysis';
		} finally {
			loading = false;
			activeAction = null;
		}
	}

	function applyRefinement(refinement: {
		title?: string;
		description?: string;
		successCriteria?: string[];
		scopeBoundary?: ScopeBoundary;
		constraints?: Constraint[];
	}) {
		const updates: Partial<Issue> = {};

		if (refinement.title) updates.title = refinement.title;
		if (refinement.description) updates.description = refinement.description;
		if (refinement.successCriteria) {
			updates.successCriteria = refinement.successCriteria;
			updates.isWellSpecified = true;
		}
		if (refinement.scopeBoundary) updates.scopeBoundary = refinement.scopeBoundary;

		issueStore.update(goalId, updates);

		if (refinement.constraints) {
			for (const constraint of refinement.constraints) {
				issueStore.addConstraint(goalId, constraint);
			}
		}

		result = null;
	}

	function applyConcerns(concerns: Omit<Concern, 'id' | 'surfacedAt' | 'status'>[]) {
		for (const concern of concerns) {
			issueStore.addConcern(goalId, concern);
		}
		result = null;
	}

	function applyDecomposition(subtasks: Array<{
		title: string;
		description: string;
		type?: Issue['type'];
		priority?: Issue['priority'];
	}>, decompositionType: 'and' | 'or_fallback' | 'or_race' | 'choice' = 'and') {
		issueStore.decompose(goalId, subtasks, decompositionType);
		result = null;
	}

	const actions = [
		{
			id: 'refine_goal',
			label: 'Refine Goal',
			icon: '🎯',
			description: 'Make this goal SMART with clear success criteria',
			color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
		},
		{
			id: 'analyze_risks',
			label: 'Analyze Risks',
			icon: '🔍',
			description: 'Surface assumptions, risks, and hidden dependencies',
			color: 'bg-orange-50 border-orange-200 hover:bg-orange-100'
		},
		{
			id: 'suggest_decomposition',
			label: 'Break Down',
			icon: '📋',
			description: 'Suggest subtasks and identify shared resources',
			color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
		},
		{
			id: 'detect_scope_expansion',
			label: 'Check Scope',
			icon: '📏',
			description: 'Detect scope creep and boundary violations',
			color: 'bg-amber-50 border-amber-200 hover:bg-amber-100'
		},
		{
			id: 'validate_accuracy',
			label: 'Validate Plan',
			icon: '✓',
			description: 'Check if the plan is complete and accurate',
			color: 'bg-green-50 border-green-200 hover:bg-green-100'
		}
	];
</script>

<div class="space-y-6">
	<!-- Goal Summary -->
	{#if goal}
		<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-lg font-semibold text-gray-900">{goal.title}</h2>
					{#if goal.description}
						<p class="text-sm text-gray-600 mt-1">{goal.description}</p>
					{/if}
				</div>
				<div class="flex gap-2">
					{#if goal.isWellSpecified}
						<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
							Well-specified
						</span>
					{:else}
						<span class="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
							Needs refinement
						</span>
					{/if}
				</div>
			</div>

			<!-- Success Criteria -->
			{#if goal.successCriteria && goal.successCriteria.length > 0}
				<div class="mt-4 p-3 bg-green-50 rounded-lg">
					<span class="text-xs font-medium text-green-700 uppercase tracking-wide">Success Criteria</span>
					<ul class="mt-2 space-y-1">
						{#each goal.successCriteria as criterion}
							<li class="flex items-start gap-2 text-sm text-green-800">
								<svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								{criterion}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Project Stats -->
			<div class="mt-4 grid grid-cols-4 gap-4">
				<div class="text-center p-3 bg-gray-50 rounded-lg">
					<div class="text-2xl font-bold text-gray-900">{projectScope.allIssues.length}</div>
					<div class="text-xs text-gray-500">Total Issues</div>
				</div>
				<div class="text-center p-3 bg-gray-50 rounded-lg">
					<div class="text-2xl font-bold text-gray-900">{projectScope.leafCount}</div>
					<div class="text-xs text-gray-500">Actionable</div>
				</div>
				<div class="text-center p-3 bg-gray-50 rounded-lg">
					<div class="text-2xl font-bold text-gray-900">{projectScope.containerCount}</div>
					<div class="text-xs text-gray-500">Containers</div>
				</div>
				<div class="text-center p-3 bg-gray-50 rounded-lg">
					<div class="text-2xl font-bold text-gray-900">
						{projectScope.totalEstimatedCost > 0
							? `$${Math.round(projectScope.totalEstimatedCost).toLocaleString()}`
							: '—'}
					</div>
					<div class="text-xs text-gray-500">Est. Cost</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Quick Alerts -->
	{#if scopeExpansion.hasExpanded || !planAccuracy.isAccurate}
		<div class="space-y-3">
			{#if scopeExpansion.hasExpanded}
				<div class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
					<span class="text-xl">📏</span>
					<div class="flex-1">
						<h4 class="font-medium text-amber-800">Scope Expansion Detected</h4>
						<p class="text-sm text-amber-700 mt-1">
							{scopeExpansion.expansions.length} issue{scopeExpansion.expansions.length !== 1 ? 's' : ''} may be outside original scope.
						</p>
						<button
							onclick={() => runAction('detect_scope_expansion')}
							class="text-sm text-amber-800 font-medium mt-2 hover:underline"
						>
							Review scope →
						</button>
					</div>
				</div>
			{/if}

			{#if !planAccuracy.isAccurate}
				<div class="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
					<span class="text-xl">📋</span>
					<div class="flex-1">
						<h4 class="font-medium text-blue-800">Plan Needs Work</h4>
						<p class="text-sm text-blue-700 mt-1">
							{#if planAccuracy.underspecifiedLeaves.length > 0}
								{planAccuracy.underspecifiedLeaves.length} task{planAccuracy.underspecifiedLeaves.length !== 1 ? 's need' : ' needs'} more detail.
							{/if}
							{#if planAccuracy.missingDecomposition.length > 0}
								{planAccuracy.missingDecomposition.length} container{planAccuracy.missingDecomposition.length !== 1 ? 's have' : ' has'} no subtasks.
							{/if}
						</p>
						<button
							onclick={() => runAction('validate_accuracy')}
							class="text-sm text-blue-800 font-medium mt-2 hover:underline"
						>
							Validate plan →
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- AI Actions -->
	{#if aiSettings.isConfigured}
		<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
			<h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
				<svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
				Red-Team Planning
			</h3>

			<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
				{#each actions as action}
					<button
						onclick={() => runAction(action.id)}
						disabled={loading}
						class="p-4 rounded-lg border text-left transition-all {action.color} {loading && activeAction === action.id ? 'ring-2 ring-offset-2 ring-purple-500' : ''} disabled:opacity-50"
					>
						<div class="flex items-center gap-2 mb-1">
							<span class="text-lg">{action.icon}</span>
							<span class="font-medium text-gray-900">{action.label}</span>
							{#if loading && activeAction === action.id}
								<div class="ml-auto w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
							{/if}
						</div>
						<p class="text-xs text-gray-600">{action.description}</p>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
			<p class="text-gray-500">Configure AI in the top menu to use planning assistant</p>
		</div>
	{/if}

	<!-- Results Panel -->
	{#if error}
		<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
			<p class="text-red-700">{error}</p>
		</div>
	{/if}

	{#if result}
		<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
			<div class="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50">
				<h3 class="font-semibold text-gray-900">
					{#if result.type === 'refinement'}
						Refined Goal
					{:else if result.type === 'risks'}
						Identified Concerns
					{:else if result.type === 'decomposition'}
						Suggested Breakdown
					{:else if result.type === 'scope'}
						Scope Analysis
					{:else if result.type === 'accuracy'}
						Plan Validation
					{/if}
				</h3>
			</div>

			<div class="p-5">
				{#if result.type === 'refinement'}
					{@const data = result.data as { refinedGoal: { title: string; description: string; successCriteria: string[] }; scopeBoundary?: ScopeBoundary; constraints?: Constraint[] }}
					<div class="space-y-4">
						<div>
							<span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Refined Title</span>
							<p class="text-gray-900 font-medium mt-1">{data.refinedGoal.title}</p>
						</div>
						<div>
							<span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</span>
							<p class="text-gray-700 mt-1">{data.refinedGoal.description}</p>
						</div>
						{#if data.refinedGoal.successCriteria}
							<div>
								<span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Success Criteria</span>
								<ul class="mt-2 space-y-1">
									{#each data.refinedGoal.successCriteria as criterion}
										<li class="flex items-start gap-2 text-sm">
											<svg class="w-4 h-4 mt-0.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											{criterion}
										</li>
									{/each}
								</ul>
							</div>
						{/if}
						<div class="flex gap-2 pt-4">
							<button
								onclick={() => applyRefinement(data.refinedGoal)}
								class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
							>
								Apply Refinement
							</button>
							<button
								onclick={() => result = null}
								class="px-4 py-2 text-gray-600 text-sm hover:text-gray-900"
							>
								Dismiss
							</button>
						</div>
					</div>
				{:else if result.type === 'risks'}
					{@const data = result.data as { concerns: Omit<Concern, 'id' | 'surfacedAt' | 'status'>[] }}
					<div class="space-y-3">
						{#each data.concerns as concern}
							<div class="p-3 bg-orange-50 rounded-lg border border-orange-200">
								<div class="flex items-center gap-2 mb-1">
									<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
										{concern.type}
									</span>
									<span class="text-xs text-gray-500">
										Impact: {concern.impact} | Prob: {concern.probability} | Urgency: {concern.urgency}
									</span>
								</div>
								<h4 class="font-medium text-gray-900">{concern.title}</h4>
								<p class="text-sm text-gray-600 mt-1">{concern.description}</p>
							</div>
						{/each}
						<div class="flex gap-2 pt-4">
							<button
								onclick={() => applyConcerns(data.concerns)}
								class="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700"
							>
								Add {data.concerns.length} Concern{data.concerns.length !== 1 ? 's' : ''}
							</button>
							<button
								onclick={() => result = null}
								class="px-4 py-2 text-gray-600 text-sm hover:text-gray-900"
							>
								Dismiss
							</button>
						</div>
					</div>
				{:else if result.type === 'decomposition'}
					{@const data = result.data as { subtasks: Array<{ title: string; description: string; type?: string }>; decompositionType?: string; sharedResources?: string[] }}
					<div class="space-y-3">
						{#if data.sharedResources && data.sharedResources.length > 0}
							<div class="p-3 bg-amber-50 rounded-lg border border-amber-200">
								<span class="text-xs font-medium text-amber-700 uppercase tracking-wide">Shared Resources Detected</span>
								<p class="text-sm text-amber-800 mt-1">
									These resources affect multiple tasks: {data.sharedResources.join(', ')}
								</p>
							</div>
						{/if}
						{#each data.subtasks as subtask, i}
							<div class="p-3 bg-blue-50 rounded-lg border border-blue-200">
								<span class="text-xs text-gray-500">#{i + 1}</span>
								<h4 class="font-medium text-gray-900">{subtask.title}</h4>
								<p class="text-sm text-gray-600 mt-1">{subtask.description}</p>
							</div>
						{/each}
						<div class="flex gap-2 pt-4">
							<button
								onclick={() => applyDecomposition(data.subtasks as Array<{title: string; description: string; type?: Issue['type']; priority?: Issue['priority']}>, (data.decompositionType as 'and' | 'or_fallback' | 'or_race' | 'choice') || 'and')}
								class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
							>
								Create {data.subtasks.length} Subtask{data.subtasks.length !== 1 ? 's' : ''}
							</button>
							<button
								onclick={() => result = null}
								class="px-4 py-2 text-gray-600 text-sm hover:text-gray-900"
							>
								Dismiss
							</button>
						</div>
					</div>
				{:else if result.type === 'scope'}
					{@const data = result.data as { hasExpanded: boolean; expansions: Array<{ issueTitle: string; reason: string; options: string[] }> }}
					<div class="space-y-3">
						{#if data.hasExpanded}
							{#each data.expansions as expansion}
								<div class="p-3 bg-amber-50 rounded-lg border border-amber-200">
									<h4 class="font-medium text-gray-900">{expansion.issueTitle}</h4>
									<p class="text-sm text-amber-700 mt-1">{expansion.reason}</p>
									{#if expansion.options}
										<div class="flex gap-2 mt-3">
											{#each expansion.options as option}
												<button class="px-3 py-1 text-xs bg-white border border-amber-300 rounded text-amber-800 hover:bg-amber-100">
													{option}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						{:else}
							<div class="p-4 bg-green-50 rounded-lg text-center">
								<svg class="w-8 h-8 mx-auto text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<p class="text-green-700">All issues are within defined scope</p>
							</div>
						{/if}
						<button
							onclick={() => result = null}
							class="px-4 py-2 text-gray-600 text-sm hover:text-gray-900"
						>
							Dismiss
						</button>
					</div>
				{:else if result.type === 'accuracy'}
					{@const data = result.data as { isAccurate: boolean; issues: Array<{ title: string; problem: string; suggestion: string }> }}
					<div class="space-y-3">
						{#if data.isAccurate}
							<div class="p-4 bg-green-50 rounded-lg text-center">
								<svg class="w-8 h-8 mx-auto text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<p class="text-green-700 font-medium">Plan is accurate and complete</p>
							</div>
						{:else}
							{#each data.issues as issue}
								<div class="p-3 bg-blue-50 rounded-lg border border-blue-200">
									<h4 class="font-medium text-gray-900">{issue.title}</h4>
									<p class="text-sm text-blue-700 mt-1">{issue.problem}</p>
									<p class="text-sm text-gray-600 mt-1 italic">Suggestion: {issue.suggestion}</p>
								</div>
							{/each}
						{/if}
						<button
							onclick={() => result = null}
							class="px-4 py-2 text-gray-600 text-sm hover:text-gray-900"
						>
							Dismiss
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Concern Panel -->
	<ConcernPanel {goalId} />
</div>
