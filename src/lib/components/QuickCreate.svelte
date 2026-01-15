<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';
	import type { Issue, IssueType, IssuePriority, ExecutionType } from '$lib/types/issue';
	import { EXECUTION_TYPE_LABELS } from '$lib/types/issue';
	import { toFriendlyError, type FriendlyError } from '$lib/utils/errors';
	import FollowUpSuggestions from './FollowUpSuggestions.svelte';

	let quickInput = $state('');
	let isExpanding = $state(false);
	let expandedResult = $state<{
		title: string;
		description: string;
		type: IssueType;
		priority: IssuePriority;
		executionType?: ExecutionType;
		aiConfidence?: number;
		validationRequired?: boolean;
		executionReason?: string;
	} | null>(null);
	let error = $state<FriendlyError | null>(null);
	let createdIssue = $state<Issue | null>(null);

	async function expandAndCreate() {
		if (!quickInput.trim()) return;

		isExpanding = true;
		error = null;
		expandedResult = null;

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/expand-issue', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					input: quickInput.trim(),
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.error) {
				error = toFriendlyError(data.error);
				return;
			}

			expandedResult = data;
		} catch (e) {
			error = toFriendlyError(e);
		} finally {
			isExpanding = false;
		}
	}

	function confirmCreate() {
		if (!expandedResult) return;

		const newIssue = issueStore.create({
			title: expandedResult.title,
			description: expandedResult.description,
			type: expandedResult.type,
			priority: expandedResult.priority,
			executionType: expandedResult.executionType,
			aiConfidence: expandedResult.aiConfidence,
			validationRequired: expandedResult.validationRequired,
			executionReason: expandedResult.executionReason
		});

		// Show follow-up suggestions
		createdIssue = newIssue;
		expandedResult = null;
	}

	function dismissSuggestions() {
		// Reset everything
		quickInput = '';
		createdIssue = null;
	}

	function editManually() {
		// Could dispatch an event to open IssueForm with pre-filled data
		// For now, just reset and let user create manually
		quickInput = '';
		expandedResult = null;
	}

	function cancel() {
		expandedResult = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !isExpanding && !expandedResult) {
			e.preventDefault();
			expandAndCreate();
		}
	}

	const typeColors: Record<IssueType, string> = {
		task: 'bg-blue-100 text-blue-700',
		bug: 'bg-red-100 text-red-700',
		feature: 'bg-purple-100 text-purple-700'
	};

	const priorityLabels: Record<IssuePriority, string> = {
		0: 'P0 - Critical',
		1: 'P1 - High',
		2: 'P2 - Medium',
		3: 'P3 - Low',
		4: 'P4 - Backlog'
	};

	const executionTypeColors: Record<ExecutionType, string> = {
		automated: 'bg-emerald-100 text-emerald-700',
		human: 'bg-red-100 text-red-700',
		ai_assisted: 'bg-sky-100 text-sky-700',
		human_assisted: 'bg-violet-100 text-violet-700'
	};
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
	{#if createdIssue}
		<!-- Show follow-up suggestions after creating -->
		<div class="space-y-4">
			<div class="flex items-center gap-2 text-green-700 mb-2">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				<span class="font-medium">Created: {createdIssue.title}</span>
				<a
					href="/issue/{createdIssue.id}"
					class="text-sm text-blue-600 hover:text-blue-700 ml-auto"
				>
					View →
				</a>
			</div>
			<FollowUpSuggestions issue={createdIssue} onDismiss={dismissSuggestions} />
		</div>
	{:else if !expandedResult}
		<!-- Quick input mode -->
		<div class="flex gap-3">
			<div class="flex-1 relative">
				<input
					type="text"
					bind:value={quickInput}
					onkeydown={handleKeydown}
					placeholder="Describe what you need to do..."
					disabled={isExpanding || !aiSettings.isConfigured}
					class="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
				/>
				{#if isExpanding}
					<div class="absolute right-3 top-1/2 -translate-y-1/2">
						<div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
					</div>
				{/if}
			</div>
			<button
				onclick={expandAndCreate}
				disabled={!quickInput.trim() || isExpanding || !aiSettings.isConfigured}
				class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<span class="hidden sm:inline">Quick Add</span>
			</button>
		</div>

		{#if !aiSettings.isConfigured}
			<p class="mt-2 text-sm text-amber-600">
				Set up AI in the top menu to use quick create.
			</p>
		{/if}

		{#if error}
			<div class="mt-2 flex items-center gap-2 text-sm text-red-600">
				<span>{error.message}{error.suggestion ? `. ${error.suggestion}` : ''}</span>
				{#if error.canRetry}
					<button
						onclick={expandAndCreate}
						class="text-red-700 underline hover:no-underline"
					>
						Try again
					</button>
				{/if}
			</div>
		{/if}

		<p class="mt-2 text-xs text-gray-500">
			Type a few words and AI will create a full issue. Press Enter or click Quick Add.
		</p>
	{:else}
		<!-- Preview expanded result -->
		<div class="space-y-4">
			<div class="flex items-start justify-between">
				<h3 class="text-lg font-semibold text-gray-900">Review & Create</h3>
				<div class="flex flex-wrap gap-2">
					<span class="px-2 py-1 text-xs font-medium rounded-full {typeColors[expandedResult.type]}">
						{expandedResult.type}
					</span>
					<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
						{priorityLabels[expandedResult.priority]}
					</span>
					{#if expandedResult.executionType}
						<span class="px-2 py-1 text-xs font-medium rounded-full {executionTypeColors[expandedResult.executionType]}">
							{EXECUTION_TYPE_LABELS[expandedResult.executionType]}
						</span>
						{#if expandedResult.validationRequired}
							<span class="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
								✓ Needs Review
							</span>
						{/if}
					{/if}
				</div>
			</div>

			<div class="bg-gray-50 rounded-lg p-4 space-y-3">
				<div>
					<span class="block text-xs font-medium text-gray-500 mb-1">Title</span>
					<p class="text-gray-900 font-medium">{expandedResult.title}</p>
				</div>
				<div>
					<span class="block text-xs font-medium text-gray-500 mb-1">Description</span>
					<p class="text-gray-700 text-sm">{expandedResult.description}</p>
				</div>
				{#if expandedResult.executionReason}
					<div>
						<span class="block text-xs font-medium text-gray-500 mb-1">Who Should Do This</span>
						<p class="text-gray-600 text-sm">{expandedResult.executionReason}</p>
						{#if expandedResult.aiConfidence !== undefined}
							<div class="flex items-center gap-2 mt-1">
								<span class="text-xs text-gray-400">AI confidence:</span>
								<div class="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
									<div
										class="h-full rounded-full {expandedResult.aiConfidence > 0.7 ? 'bg-green-500' : expandedResult.aiConfidence > 0.4 ? 'bg-amber-500' : 'bg-red-500'}"
										style="width: {expandedResult.aiConfidence * 100}%"
									></div>
								</div>
								<span class="text-xs text-gray-400">{Math.round(expandedResult.aiConfidence * 100)}%</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-between pt-2">
				<button
					onclick={cancel}
					class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
				>
					Cancel
				</button>
				<div class="flex gap-2">
					<button
						onclick={editManually}
						class="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
					>
						Edit First
					</button>
					<button
						onclick={confirmCreate}
						class="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						Create Issue
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
