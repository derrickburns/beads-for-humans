<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { issueStore } from '$lib/stores/issues.svelte';
	import IssueCard from '$lib/components/IssueCard.svelte';
	import GraphHealth from '$lib/components/GraphHealth.svelte';
	import DependencyGraph from '$lib/components/DependencyGraph.svelte';
	import GraphChatSidebar from '$lib/components/GraphChatSidebar.svelte';
	import ProjectSelector from '$lib/components/ProjectSelector.svelte';
	import DependencyManager from '$lib/components/DependencyManager.svelte';
	import QuickCreate from '$lib/components/QuickCreate.svelte';
	import WhatNext from '$lib/components/WhatNext.svelte';
	import HumanTaskNotifier from '$lib/components/HumanTaskNotifier.svelte';
	import BenchmarkSuggestions from '$lib/components/BenchmarkSuggestions.svelte';
	import ValidationCheckpoints from '$lib/components/ValidationCheckpoints.svelte';
	import { graphChatStore } from '$lib/stores/graphChat.svelte';
	import type { IssueStatus } from '$lib/types/issue';

	// Get focus parameter from URL (for "View in Graph" navigation)
	let initialFocusId = $derived($page.url.searchParams.get('focus'));

	// Chat sidebar state
	let chatOpen = $state(false);
	let focusedIssueId = $state<string | null>(initialFocusId);

	// Dependency manager state
	let depManagerOpen = $state(false);

	// Update focused issue when initialFocusId changes
	$effect(() => {
		if (initialFocusId) {
			focusedIssueId = initialFocusId;
		}
	});

	// View mode - default to graph, persist preference
	// Force graph view if coming from "View in Graph" link
	let viewMode = $state<'graph' | 'list'>('graph');

	// Load saved preference (but override if focus param present)
	if (browser) {
		const saved = localStorage.getItem('view-mode');
		if (saved === 'list' && !initialFocusId) viewMode = 'list';
	}

	// Clean up URL after initial focus (remove ?focus param to avoid persistence on refresh)
	$effect(() => {
		if (browser && initialFocusId) {
			const url = new URL(window.location.href);
			url.searchParams.delete('focus');
			window.history.replaceState({}, '', url.toString());
		}
	});

	function setViewMode(mode: 'graph' | 'list') {
		viewMode = mode;
		if (browser) {
			localStorage.setItem('view-mode', mode);
		}
	}

	// List view filters (only used when in list mode)
	let filter = $state<'all' | 'ready' | 'blocked'>('all');
	let statusFilter = $state<IssueStatus | 'all'>('all');

	let filteredIssues = $derived.by(() => {
		let issues = issueStore.issues;

		if (filter === 'ready') {
			issues = issueStore.ready;
		} else if (filter === 'blocked') {
			issues = issueStore.blocked;
		}

		if (statusFilter !== 'all') {
			issues = issues.filter((i) => i.status === statusFilter);
		}

		return [...issues].sort((a, b) => {
			if (a.status === 'closed' && b.status !== 'closed') return 1;
			if (a.status !== 'closed' && b.status === 'closed') return -1;
			if (a.priority !== b.priority) return a.priority - b.priority;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	});

	let counts = $derived({
		all: issueStore.issues.filter((i) => i.status !== 'closed').length,
		ready: issueStore.ready.length,
		blocked: issueStore.blocked.length,
		open: issueStore.byStatus.open.length,
		in_progress: issueStore.byStatus.in_progress.length,
		closed: issueStore.byStatus.closed.length
	});
</script>

<div class="space-y-4">
	<!-- View Toggle -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
				<button
					onclick={() => setViewMode('graph')}
					class="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 {viewMode === 'graph'
						? 'bg-white text-gray-900 shadow-sm'
						: 'text-gray-600 hover:text-gray-900'}"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
					Graph
				</button>
				<button
					onclick={() => setViewMode('list')}
					class="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 {viewMode === 'list'
						? 'bg-white text-gray-900 shadow-sm'
						: 'text-gray-600 hover:text-gray-900'}"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
					</svg>
					List
				</button>
			</div>

			<!-- Project Selector -->
			<ProjectSelector />

			<!-- Dependency Manager -->
			<button
				onclick={() => depManagerOpen = true}
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
				title="Manage task order and what needs to happen first"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
				</svg>
				<span>Task Order</span>
			</button>

			<!-- AI Planning Mode -->
			<a
				href="/plan"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
				title="Use AI to plan a new project or add tasks interactively"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
				<span>Plan Project</span>
			</a>

			<!-- Decision Matrix -->
			<a
				href="/decide"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
				title="Compare options with a weighted decision matrix"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
				<span>Decide</span>
			</a>

			<!-- Risk Register -->
			<a
				href="/risks"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
				title="Identify and track project risks"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<span>Risks</span>
			</a>

			<!-- Project Templates -->
			<a
				href="/templates"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
				title="Start from a pre-built project template"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
				</svg>
				<span>Templates</span>
			</a>

			<!-- Project Timeline -->
			<a
				href="/timeline"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors"
				title="View project timeline with AI-estimated durations"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<span>Timeline</span>
			</a>

			<!-- Budget Tracker -->
			<a
				href="/budget"
				class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-lime-700 bg-lime-50 border border-lime-200 rounded-lg hover:bg-lime-100 transition-colors"
				title="Track and estimate project costs"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>Budget</span>
			</a>
		</div>

		<div class="text-sm text-gray-500">
			{counts.all} active · {counts.ready} can start · {counts.blocked} waiting
		</div>
	</div>

	<!-- Graph Health Warnings -->
	<GraphHealth />

	<!-- Human Task Notifications -->
	<HumanTaskNotifier />

	<!-- Contextual Guidance -->
	<WhatNext />

	<!-- Quick Create -->
	<QuickCreate />

	<!-- AI Capability Benchmark -->
	<BenchmarkSuggestions />

	<!-- Validation Checkpoints -->
	<ValidationCheckpoints />

	{#if viewMode === 'graph'}
		<!-- Graph View (Primary) with Chat Sidebar -->
		<div class="flex h-[calc(100vh-16rem)] gap-0">
			<!-- Graph Area -->
			<div class="flex-1 min-w-0">
				<DependencyGraph focusId={initialFocusId} bind:focusedIssueId={focusedIssueId} />
			</div>

			<!-- Chat Sidebar -->
			<GraphChatSidebar
				{focusedIssueId}
				isOpen={chatOpen}
				onClose={() => (chatOpen = false)}
			/>
		</div>

		<!-- Chat Toggle Button (Fixed position) -->
		<button
			onclick={() => (chatOpen = !chatOpen)}
			class="fixed bottom-6 right-6 p-4 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all hover:scale-105 z-50 {chatOpen ? 'rotate-180' : ''}"
			aria-label={chatOpen ? 'Close chat' : 'Open chat assistant'}
		>
			{#if chatOpen}
				<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			{:else}
				<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
				</svg>
			{/if}
		</button>
	{:else}
		<!-- List View (Secondary) -->
		<div class="space-y-4">
			<!-- List Filters -->
			<div class="flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
					<button
						onclick={() => (filter = 'all')}
						class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter === 'all'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						All ({counts.all})
					</button>
					<button
						onclick={() => (filter = 'ready')}
						class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter === 'ready'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						Can Start ({counts.ready})
					</button>
					<button
						onclick={() => (filter = 'blocked')}
						class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {filter === 'blocked'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						Waiting ({counts.blocked})
					</button>
				</div>

				<div class="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
					<button
						onclick={() => (statusFilter = 'all')}
						class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {statusFilter === 'all'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						Any
					</button>
					<button
						onclick={() => (statusFilter = 'open')}
						class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {statusFilter === 'open'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						Open
					</button>
					<button
						onclick={() => (statusFilter = 'in_progress')}
						class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {statusFilter === 'in_progress'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						In Progress
					</button>
					<button
						onclick={() => (statusFilter = 'closed')}
						class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {statusFilter === 'closed'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						Closed
					</button>
				</div>
			</div>

			<!-- Issue List -->
			{#if filteredIssues.length === 0}
				<div class="text-center py-16">
					<div class="text-gray-400 mb-4">
						<svg class="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
					</div>
					<h3 class="text-lg font-medium text-gray-900 mb-1">No issues found</h3>
					<p class="text-gray-500 mb-4">
						{#if issueStore.issues.length === 0}
							Get started by creating your first issue.
						{:else}
							Try adjusting your filters.
						{/if}
					</p>
					{#if issueStore.issues.length === 0}
						<a
							href="/issue/new"
							class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
						>
							Create Issue
						</a>
					{/if}
				</div>
			{:else}
				<div class="grid gap-3">
					{#each filteredIssues as issue (issue.id)}
						<IssueCard {issue} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Dependency Manager Modal -->
<DependencyManager isOpen={depManagerOpen} onClose={() => depManagerOpen = false} />
