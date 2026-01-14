<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { goto } from '$app/navigation';
	import type { Issue, RelationshipSuggestion } from '$lib/types/issue';

	// Props
	interface Props {
		focusId?: string | null;
	}
	let { focusId = null }: Props = $props();

	// Layout constants
	const NODE_WIDTH = 200;
	const NODE_HEIGHT = 60;
	const HORIZONTAL_GAP = 80;
	const VERTICAL_GAP = 40;
	const PADDING = 80;

	// Filter state
	let showClosed = $state(false);
	let focusedIssueId = $state<string | null>(focusId);

	// AI Suggestions state
	let suggestions = $state<RelationshipSuggestion[]>([]);
	let loadingSuggestions = $state(false);
	let dismissedSuggestions = $state<Set<string>>(new Set());

	// Active suggestions for the focused issue (filtered for validity)
	let activeSuggestions = $derived(
		suggestions.filter((s) => {
			if (!focusedIssueId) return false;
			if (dismissedSuggestions.has(s.targetId)) return false;

			const focusedIssue = issueStore.getById(focusedIssueId);
			if (!focusedIssue) return false;

			// Already a dependency
			if (focusedIssue.dependencies.includes(s.targetId)) return false;

			// Target doesn't exist
			if (!issueStore.getById(s.targetId)) return false;

			// Would create a cycle
			if (issueStore.wouldCreateCycle(focusedIssueId, s.targetId)) return false;

			return true;
		})
	);

	// Error state for showing messages
	let errorMessage = $state<string | null>(null);

	// Sync focusedIssueId when focusId prop changes
	$effect(() => {
		if (focusId) {
			focusedIssueId = focusId;
		}
	});

	// Auto-load suggestions when focus changes
	$effect(() => {
		if (focusedIssueId) {
			suggestions = [];
			dismissedSuggestions = new Set();
			// Auto-trigger AI suggestions after a short delay
			const timer = setTimeout(() => {
				loadAISuggestions();
			}, 300);
			return () => clearTimeout(timer);
		}
	});

	// Zoom/pan state
	let scale = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let lastMousePos = $state({ x: 0, y: 0 });

	interface NodePosition {
		issue: Issue;
		x: number;
		y: number;
		layer: number;
		order: number;
	}

	// Get issues to display based on filters
	let displayedIssues = $derived.by(() => {
		let issues = issueStore.issues;

		if (!showClosed) {
			issues = issues.filter((i) => i.status !== 'closed');
		}

		if (focusedIssueId) {
			const focused = issues.find((i) => i.id === focusedIssueId);
			if (focused) {
				const relatedIds = new Set<string>([focusedIssueId]);

				function addUpstream(id: string) {
					const issue = issueStore.issues.find((i) => i.id === id);
					if (issue) {
						issue.dependencies.forEach((depId) => {
							if (!relatedIds.has(depId)) {
								relatedIds.add(depId);
								addUpstream(depId);
							}
						});
					}
				}

				function addDownstream(id: string) {
					issueStore.issues
						.filter((i) => i.dependencies.includes(id))
						.forEach((i) => {
							if (!relatedIds.has(i.id)) {
								relatedIds.add(i.id);
								addDownstream(i.id);
							}
						});
				}

				addUpstream(focusedIssueId);
				addDownstream(focusedIssueId);

				// Also include suggested targets
				activeSuggestions.forEach((s) => relatedIds.add(s.targetId));

				issues = issues.filter((i) => relatedIds.has(i.id));
			}
		}

		return issues;
	});

	// Layout calculations
	function calculateLayers(issues: Issue[]): Map<string, number> {
		const layers = new Map<string, number>();
		const issueSet = new Set(issues.map((i) => i.id));

		function getLayer(issue: Issue, visited: Set<string>): number {
			if (layers.has(issue.id)) return layers.get(issue.id)!;
			if (visited.has(issue.id)) return 0;

			visited.add(issue.id);

			const deps = issue.dependencies.filter((d) => issueSet.has(d));
			if (deps.length === 0) {
				layers.set(issue.id, 0);
				return 0;
			}

			let maxDepLayer = -1;
			for (const depId of deps) {
				const dep = issues.find((i) => i.id === depId);
				if (dep) {
					maxDepLayer = Math.max(maxDepLayer, getLayer(dep, visited));
				}
			}

			const layer = maxDepLayer + 1;
			layers.set(issue.id, layer);
			return layer;
		}

		issues.forEach((issue) => getLayer(issue, new Set()));
		return layers;
	}

	function orderNodesInLayers(issues: Issue[], layers: Map<string, number>): Map<string, number> {
		const orders = new Map<string, number>();
		const maxLayer = Math.max(...layers.values(), 0);

		const layerGroups: Issue[][] = Array.from({ length: maxLayer + 1 }, () => []);
		issues.forEach((issue) => {
			const layer = layers.get(issue.id) ?? 0;
			layerGroups[layer].push(issue);
		});

		layerGroups.forEach((group) => {
			group.sort((a, b) => a.priority - b.priority);
			group.forEach((issue, idx) => orders.set(issue.id, idx));
		});

		for (let iter = 0; iter < 4; iter++) {
			for (let layer = 1; layer <= maxLayer; layer++) {
				const group = layerGroups[layer];
				group.forEach((issue) => {
					const deps = issue.dependencies.filter((d) => layers.get(d) === layer - 1);
					if (deps.length > 0) {
						const avgOrder = deps.reduce((sum, d) => sum + (orders.get(d) ?? 0), 0) / deps.length;
						orders.set(issue.id, avgOrder);
					}
				});
				group.sort((a, b) => (orders.get(a.id) ?? 0) - (orders.get(b.id) ?? 0));
				group.forEach((issue, idx) => orders.set(issue.id, idx));
			}

			for (let layer = maxLayer - 1; layer >= 0; layer--) {
				const group = layerGroups[layer];
				group.forEach((issue) => {
					const dependents = issues.filter(
						(i) => i.dependencies.includes(issue.id) && layers.get(i.id) === layer + 1
					);
					if (dependents.length > 0) {
						const avgOrder =
							dependents.reduce((sum, d) => sum + (orders.get(d.id) ?? 0), 0) / dependents.length;
						orders.set(issue.id, avgOrder);
					}
				});
				group.sort((a, b) => (orders.get(a.id) ?? 0) - (orders.get(b.id) ?? 0));
				group.forEach((issue, idx) => orders.set(issue.id, idx));
			}
		}

		return orders;
	}

	function layoutNodes(issues: Issue[]): NodePosition[] {
		if (issues.length === 0) return [];

		const layers = calculateLayers(issues);
		const orders = orderNodesInLayers(issues, layers);

		return issues.map((issue) => ({
			issue,
			x: PADDING + (layers.get(issue.id) ?? 0) * (NODE_WIDTH + HORIZONTAL_GAP),
			y: PADDING + (orders.get(issue.id) ?? 0) * (NODE_HEIGHT + VERTICAL_GAP),
			layer: layers.get(issue.id) ?? 0,
			order: orders.get(issue.id) ?? 0
		}));
	}

	function getStatusColor(status: string, isBlocked: boolean): string {
		if (status === 'closed') return '#9ca3af';
		if (isBlocked) return '#f59e0b';
		if (status === 'in_progress') return '#3b82f6';
		return '#22c55e';
	}

	function getStatusBg(status: string, isBlocked: boolean): string {
		if (status === 'closed') return '#f3f4f6';
		if (isBlocked) return '#fffbeb';
		if (status === 'in_progress') return '#eff6ff';
		return '#f0fdf4';
	}

	let positions = $derived(layoutNodes(displayedIssues));

	let svgWidth = $derived.by(() => {
		if (positions.length === 0) return 800;
		const maxLayer = Math.max(...positions.map((p) => p.layer), 0);
		return PADDING * 2 + (maxLayer + 1) * (NODE_WIDTH + HORIZONTAL_GAP);
	});

	let svgHeight = $derived.by(() => {
		if (positions.length === 0) return 500;
		const layerCounts: Record<number, number> = {};
		positions.forEach((p) => {
			layerCounts[p.layer] = (layerCounts[p.layer] || 0) + 1;
		});
		const maxNodesInLayer = Math.max(...Object.values(layerCounts), 1);
		return PADDING * 2 + maxNodesInLayer * (NODE_HEIGHT + VERTICAL_GAP);
	});

	function getPosition(id: string): NodePosition | undefined {
		return positions.find((p) => p.issue.id === id);
	}

	// Event handlers
	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		scale = Math.max(0.3, Math.min(2, scale * delta));
	}

	function handleMouseDown(e: MouseEvent) {
		if (e.button === 0) {
			isPanning = true;
			lastMousePos = { x: e.clientX, y: e.clientY };
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (isPanning) {
			panX += e.clientX - lastMousePos.x;
			panY += e.clientY - lastMousePos.y;
			lastMousePos = { x: e.clientX, y: e.clientY };
		}
	}

	function handleMouseUp() {
		isPanning = false;
	}

	function resetView() {
		scale = 1;
		panX = 0;
		panY = 0;
		focusedIssueId = null;
		suggestions = [];
	}

	// Click handling
	let clickTimer: ReturnType<typeof setTimeout> | null = null;
	let clickedId: string | null = null;
	const DOUBLE_CLICK_DELAY = 250;

	function handleNodeClick(e: MouseEvent, id: string) {
		e.stopPropagation();

		if (clickTimer && clickedId === id) {
			clearTimeout(clickTimer);
			clickTimer = null;
			clickedId = null;
			navigateToIssue(id);
		} else {
			if (clickTimer) clearTimeout(clickTimer);
			clickedId = id;
			clickTimer = setTimeout(() => {
				focusOnIssue(id);
				clickTimer = null;
				clickedId = null;
			}, DOUBLE_CLICK_DELAY);
		}
	}

	function focusOnIssue(id: string) {
		if (focusedIssueId === id) {
			focusedIssueId = null;
			suggestions = [];
		} else {
			focusedIssueId = id;
		}
	}

	function navigateToIssue(id: string) {
		goto(`/issue/${id}`);
	}

	// AI Suggestions
	async function loadAISuggestions() {
		if (!focusedIssueId) return;
		const issue = issueStore.getById(focusedIssueId);
		if (!issue) return;

		loadingSuggestions = true;
		try {
			const response = await fetch('/api/suggest-relationships', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issue: { title: issue.title, description: issue.description },
					existingIssues: issueStore.issues.filter((i) => i.id !== issue.id)
				})
			});
			if (response.ok) {
				const data = await response.json();
				suggestions = data.suggestions || [];
			}
		} catch {
			suggestions = [];
		} finally {
			loadingSuggestions = false;
		}
	}

	function acceptSuggestion(suggestion: RelationshipSuggestion) {
		if (focusedIssueId) {
			const result = issueStore.addDependency(focusedIssueId, suggestion.targetId);
			if (result.error) {
				errorMessage = result.error;
				setTimeout(() => (errorMessage = null), 3000);
			} else {
				// Remove from suggestions list
				suggestions = suggestions.filter((s) => s.targetId !== suggestion.targetId);
			}
		}
	}

	function dismissSuggestion(suggestion: RelationshipSuggestion) {
		dismissedSuggestions = new Set([...dismissedSuggestions, suggestion.targetId]);
	}
</script>

<div class="space-y-4">
	<!-- Controls -->
	<div class="flex flex-wrap items-center gap-4">
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={showClosed} class="rounded" />
			<span class="text-gray-600">Show closed</span>
		</label>

		{#if focusedIssueId}
			{@const focused = issueStore.getById(focusedIssueId)}
			{#if focused}
				<div class="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm">
					<span class="font-medium">{focused.title.slice(0, 25)}{focused.title.length > 25 ? '…' : ''}</span>
					<button onclick={() => (focusedIssueId = null)} class="font-bold hover:text-blue-600 ml-1">
						×
					</button>
				</div>

				<!-- Quick Status Change -->
				<div class="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
					<button
						onclick={() => { issueStore.updateStatus(focused.id, 'open'); }}
						class="px-2 py-1 text-xs font-medium rounded transition-colors {focused.status === 'open' ? 'bg-green-500 text-white' : 'text-gray-600 hover:bg-gray-200'}"
					>
						Open
					</button>
					<button
						onclick={() => { issueStore.updateStatus(focused.id, 'in_progress'); }}
						class="px-2 py-1 text-xs font-medium rounded transition-colors {focused.status === 'in_progress' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'}"
					>
						In Progress
					</button>
					<button
						onclick={() => { issueStore.updateStatus(focused.id, 'closed'); }}
						class="px-2 py-1 text-xs font-medium rounded transition-colors {focused.status === 'closed' ? 'bg-gray-500 text-white' : 'text-gray-600 hover:bg-gray-200'}"
					>
						Done
					</button>
				</div>

				<!-- Edit Link -->
				<a
					href="/issue/{focused.id}"
					class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
					</svg>
					Edit
				</a>

				<!-- AI Suggest Button -->
				{#if loadingSuggestions}
					<div class="flex items-center gap-2 px-3 py-1.5 text-purple-600 text-sm">
						<span class="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></span>
						Analyzing...
					</div>
				{/if}
			{/if}
		{/if}

		<div class="flex items-center gap-2 text-sm text-gray-500 ml-auto">
			<span>Zoom: {Math.round(scale * 100)}%</span>
			<button onclick={resetView} class="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
				Reset
			</button>
		</div>
	</div>

	<!-- Error Banner -->
	{#if errorMessage}
		<div class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-800">
			<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span class="text-sm">{errorMessage}</span>
			<button onclick={() => (errorMessage = null)} class="ml-auto p-1 hover:bg-red-100 rounded">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Active Suggestions Panel -->
	{#if activeSuggestions.length > 0}
		<div class="bg-purple-50 border border-purple-200 rounded-xl p-4">
			<div class="flex items-center gap-2 mb-3">
				<svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<span class="font-medium text-purple-900">AI Suggested Dependencies</span>
				<span class="text-sm text-purple-600">({activeSuggestions.length})</span>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each activeSuggestions as suggestion}
					{@const target = issueStore.getById(suggestion.targetId)}
					{#if target}
						<div class="flex items-center gap-2 px-3 py-2 bg-white border border-purple-200 rounded-lg shadow-sm">
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 truncate">{target.title}</p>
								<p class="text-xs text-purple-600 truncate">{suggestion.reason}</p>
							</div>
							<div class="flex items-center gap-1">
								<button
									onclick={() => acceptSuggestion(suggestion)}
									class="p-1.5 text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
									title="Accept"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
								</button>
								<button
									onclick={() => dismissSuggestion(suggestion)}
									class="p-1.5 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
									title="Dismiss"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Graph -->
	<div
		class="overflow-hidden bg-white rounded-xl border border-gray-200 cursor-grab"
		class:cursor-grabbing={isPanning}
		onwheel={handleWheel}
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
		role="img"
		aria-label="Dependency graph"
	>
		{#if displayedIssues.length === 0}
			<div class="p-16 text-center">
				<div class="text-gray-400 mb-4">
					<svg class="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</div>
				{#if issueStore.issues.length === 0}
					<h3 class="text-lg font-medium text-gray-900 mb-2">No issues yet</h3>
					<p class="text-gray-500 mb-4">Create your first issue to start building your dependency graph.</p>
					<a
						href="/issue/new"
						class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
					>
						Create Issue
					</a>
				{:else}
					<h3 class="text-lg font-medium text-gray-900 mb-2">All issues are closed</h3>
					<p class="text-gray-500">Toggle "Show closed" to see completed work.</p>
				{/if}
			</div>
		{:else}
			<svg
				width="100%"
				height="600"
				viewBox="0 0 {svgWidth} {svgHeight}"
				style="transform: scale({scale}) translate({panX / scale}px, {panY / scale}px); transform-origin: center;"
			>
				<defs>
					<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
						<polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
					</marker>
					<marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
						<polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
					</marker>
					<marker id="arrowhead-purple" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
						<polygon points="0 0, 10 3.5, 0 7" fill="#9333ea" />
					</marker>
				</defs>

				<!-- Existing Edges -->
				{#each positions as pos}
					{#each pos.issue.dependencies as depId}
						{@const depPos = getPosition(depId)}
						{#if depPos}
							{@const startX = depPos.x + NODE_WIDTH}
							{@const startY = depPos.y + NODE_HEIGHT / 2}
							{@const endX = pos.x}
							{@const endY = pos.y + NODE_HEIGHT / 2}
							{@const midX = (startX + endX) / 2}
							{@const isHighlighted = focusedIssueId === pos.issue.id || focusedIssueId === depId}
							<path
								d="M {startX} {startY} C {midX} {startY}, {midX} {endY}, {endX} {endY}"
								fill="none"
								stroke={isHighlighted ? '#3b82f6' : '#d1d5db'}
								stroke-width={isHighlighted ? 3 : 2}
								marker-end={isHighlighted ? 'url(#arrowhead-blue)' : 'url(#arrowhead)'}
								class="transition-all duration-200"
							/>
						{/if}
					{/each}
				{/each}

				<!-- Suggested Edges (dashed) -->
				{#each activeSuggestions as suggestion}
					{@const focusedPos = focusedIssueId ? getPosition(focusedIssueId) : null}
					{@const targetPos = getPosition(suggestion.targetId)}
					{#if focusedPos && targetPos}
						{@const startX = targetPos.x + NODE_WIDTH}
						{@const startY = targetPos.y + NODE_HEIGHT / 2}
						{@const endX = focusedPos.x}
						{@const endY = focusedPos.y + NODE_HEIGHT / 2}
						{@const midX = (startX + endX) / 2}
						<path
							d="M {startX} {startY} C {midX} {startY}, {midX} {endY}, {endX} {endY}"
							fill="none"
							stroke="#9333ea"
							stroke-width="3"
							stroke-dasharray="8,4"
							marker-end="url(#arrowhead-purple)"
							class="animate-pulse"
						/>
					{/if}
				{/each}

				<!-- Nodes -->
				{#each positions as pos}
					{@const isBlocked = issueStore.getBlockers(pos.issue.id).length > 0}
					{@const statusColor = getStatusColor(pos.issue.status, isBlocked)}
					{@const statusBg = getStatusBg(pos.issue.status, isBlocked)}
					{@const isFocused = focusedIssueId === pos.issue.id}
					{@const isSuggested = activeSuggestions.some((s) => s.targetId === pos.issue.id)}
					<g
						transform="translate({pos.x}, {pos.y})"
						onclick={(e) => handleNodeClick(e, pos.issue.id)}
						onmousedown={(e) => e.stopPropagation()}
						style="cursor: pointer;"
						role="button"
						tabindex="0"
						onkeydown={(e) => {
							if (e.key === 'Enter') navigateToIssue(pos.issue.id);
							else if (e.key === ' ') focusOnIssue(pos.issue.id);
						}}
					>
						<!-- Node background with glow for focused/suggested -->
						{#if isFocused}
							<rect
								x="-4"
								y="-4"
								width={NODE_WIDTH + 8}
								height={NODE_HEIGHT + 8}
								rx="12"
								fill="none"
								stroke="#3b82f6"
								stroke-width="2"
								opacity="0.3"
								class="animate-pulse"
							/>
						{/if}
						{#if isSuggested}
							<rect
								x="-4"
								y="-4"
								width={NODE_WIDTH + 8}
								height={NODE_HEIGHT + 8}
								rx="12"
								fill="none"
								stroke="#9333ea"
								stroke-width="2"
								opacity="0.5"
								stroke-dasharray="4,2"
								class="animate-pulse"
							/>
						{/if}

						<!-- Main node rectangle -->
						<rect
							width={NODE_WIDTH}
							height={NODE_HEIGHT}
							rx="10"
							fill={isSuggested ? '#faf5ff' : statusBg}
							stroke={isFocused ? '#3b82f6' : isSuggested ? '#9333ea' : statusColor}
							stroke-width={isFocused || isSuggested ? 3 : 2}
							class="transition-all duration-200"
						/>

						<!-- Status indicator -->
						<circle cx="16" cy={NODE_HEIGHT / 2} r="5" fill={statusColor} />

						<!-- Title -->
						<text x="30" y={NODE_HEIGHT / 2 - 6} font-size="13" font-weight="600" fill="#1f2937">
							{pos.issue.title.length > 20 ? pos.issue.title.slice(0, 20) + '…' : pos.issue.title}
						</text>

						<!-- Metadata -->
						<text x="30" y={NODE_HEIGHT / 2 + 12} font-size="11" fill="#6b7280">
							P{pos.issue.priority} · {pos.issue.status.replace('_', ' ')}
						</text>

						<!-- Suggested badge -->
						{#if isSuggested}
							<g transform="translate({NODE_WIDTH - 24}, -8)">
								<circle cx="12" cy="12" r="12" fill="#9333ea" />
								<text x="12" y="16" font-size="10" fill="white" text-anchor="middle" font-weight="bold">AI</text>
							</g>
						{/if}
					</g>
				{/each}
			</svg>
		{/if}
	</div>

	<!-- Legend & Actions -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex flex-wrap items-center gap-6 text-sm">
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-full bg-green-500"></div>
				<span class="text-gray-600">Ready</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-full bg-blue-500"></div>
				<span class="text-gray-600">In Progress</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-full bg-amber-500"></div>
				<span class="text-gray-600">Blocked</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-full bg-gray-400"></div>
				<span class="text-gray-600">Closed</span>
			</div>
			{#if activeSuggestions.length > 0}
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-purple-600"></div>
					<span class="text-gray-600">AI Suggested</span>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-4">
			<span class="text-sm text-gray-500">
				{displayedIssues.length} issue{displayedIssues.length !== 1 ? 's' : ''} shown
			</span>
			<a
				href="/issue/new"
				class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New Issue
			</a>
		</div>
	</div>

	<!-- Help text -->
	<div class="text-center text-sm text-gray-400 pt-2">
		Click to select · Double-click to edit · Scroll to zoom · Drag to pan
		{#if !focusedIssueId}
			· <span class="text-purple-600">Select an issue to see AI suggestions</span>
		{/if}
	</div>
</div>
