<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { goto } from '$app/navigation';
	import type { Issue } from '$lib/types/issue';

	// Props
	interface Props {
		focusId?: string | null;
	}
	let { focusId = null }: Props = $props();

	// Layout constants
	const NODE_WIDTH = 180;
	const NODE_HEIGHT = 50;
	const HORIZONTAL_GAP = 60;
	const VERTICAL_GAP = 30;
	const PADDING = 60;

	// Filter state
	let showClosed = $state(false);
	let focusedIssueId = $state<string | null>(focusId);

	// Sync focusedIssueId when focusId prop changes (e.g., from URL)
	$effect(() => {
		if (focusId) {
			focusedIssueId = focusId;
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

		// Filter closed
		if (!showClosed) {
			issues = issues.filter((i) => i.status !== 'closed');
		}

		// If focused, show only the focused issue and its dependencies/dependents
		if (focusedIssueId) {
			const focused = issues.find((i) => i.id === focusedIssueId);
			if (focused) {
				const relatedIds = new Set<string>([focusedIssueId]);

				// Get all upstream (blockers)
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

				// Get all downstream (blocked by this)
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

				issues = issues.filter((i) => relatedIds.has(i.id));
			}
		}

		return issues;
	});

	// Calculate layer (depth) for each issue - Sugiyama step 1
	function calculateLayers(issues: Issue[]): Map<string, number> {
		const layers = new Map<string, number>();
		const issueSet = new Set(issues.map((i) => i.id));

		function getLayer(issue: Issue, visited: Set<string>): number {
			if (layers.has(issue.id)) return layers.get(issue.id)!;
			if (visited.has(issue.id)) return 0; // Cycle

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

	// Sugiyama step 2: Order nodes within layers to minimize crossings
	function orderNodesInLayers(issues: Issue[], layers: Map<string, number>): Map<string, number> {
		const orders = new Map<string, number>();
		const maxLayer = Math.max(...layers.values(), 0);

		// Group by layer
		const layerGroups: Issue[][] = Array.from({ length: maxLayer + 1 }, () => []);
		issues.forEach((issue) => {
			const layer = layers.get(issue.id) ?? 0;
			layerGroups[layer].push(issue);
		});

		// Initial ordering by priority
		layerGroups.forEach((group) => {
			group.sort((a, b) => a.priority - b.priority);
			group.forEach((issue, idx) => orders.set(issue.id, idx));
		});

		// Barycenter method - iterate to reduce crossings
		for (let iter = 0; iter < 4; iter++) {
			// Forward pass
			for (let layer = 1; layer <= maxLayer; layer++) {
				const group = layerGroups[layer];
				group.forEach((issue) => {
					const deps = issue.dependencies.filter((d) => layers.get(d) === layer - 1);
					if (deps.length > 0) {
						const avgOrder = deps.reduce((sum, d) => sum + (orders.get(d) ?? 0), 0) / deps.length;
						orders.set(issue.id, avgOrder);
					}
				});
				// Re-sort and reassign integer orders
				group.sort((a, b) => (orders.get(a.id) ?? 0) - (orders.get(b.id) ?? 0));
				group.forEach((issue, idx) => orders.set(issue.id, idx));
			}

			// Backward pass
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

	// Position nodes using Sugiyama layout
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
		if (positions.length === 0) return 600;
		const maxLayer = Math.max(...positions.map((p) => p.layer), 0);
		return PADDING * 2 + (maxLayer + 1) * (NODE_WIDTH + HORIZONTAL_GAP);
	});

	let svgHeight = $derived.by(() => {
		if (positions.length === 0) return 400;
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
	}

	// Click handling with single/double click distinction
	let clickTimer: ReturnType<typeof setTimeout> | null = null;
	let clickedId: string | null = null;
	const DOUBLE_CLICK_DELAY = 250;

	function handleNodeClick(e: MouseEvent, id: string) {
		e.stopPropagation(); // Prevent panning

		if (clickTimer && clickedId === id) {
			// Double click detected
			clearTimeout(clickTimer);
			clickTimer = null;
			clickedId = null;
			navigateToIssue(id);
		} else {
			// Possible single click - wait to see if double click follows
			if (clickTimer) clearTimeout(clickTimer);
			clickedId = id;
			clickTimer = setTimeout(() => {
				// Single click confirmed
				focusOnIssue(id);
				clickTimer = null;
				clickedId = null;
			}, DOUBLE_CLICK_DELAY);
		}
	}

	function focusOnIssue(id: string) {
		if (focusedIssueId === id) {
			focusedIssueId = null;
		} else {
			focusedIssueId = id;
		}
	}

	function navigateToIssue(id: string) {
		goto(`/issue/${id}`);
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
			<div class="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm">
				<span>Focused: {focused?.title.slice(0, 30)}</span>
				<button onclick={() => (focusedIssueId = null)} class="font-bold hover:text-blue-600">
					×
				</button>
			</div>
		{/if}

		<div class="flex items-center gap-2 text-sm text-gray-500">
			<span>Zoom: {Math.round(scale * 100)}%</span>
			<button onclick={resetView} class="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
				Reset
			</button>
		</div>

		<div class="text-sm text-gray-400">
			Scroll to zoom · Drag to pan · Click to focus · Double-click to edit
		</div>
	</div>

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
			<div class="p-12 text-center text-gray-500">
				{#if issueStore.issues.length === 0}
					No issues to visualize. Create some issues first.
				{:else}
					No open issues to show. Toggle "Show closed" to see completed work.
				{/if}
			</div>
		{:else}
			<svg
				width="100%"
				height="500"
				viewBox="0 0 {svgWidth} {svgHeight}"
				style="transform: scale({scale}) translate({panX / scale}px, {panY / scale}px); transform-origin: center;"
			>
				<!-- Edges -->
				{#each positions as pos}
					{#each pos.issue.dependencies as depId}
						{@const depPos = getPosition(depId)}
						{#if depPos}
							{@const startX = depPos.x + NODE_WIDTH}
							{@const startY = depPos.y + NODE_HEIGHT / 2}
							{@const endX = pos.x}
							{@const endY = pos.y + NODE_HEIGHT / 2}
							{@const midX = (startX + endX) / 2}
							<path
								d="M {startX} {startY} C {midX} {startY}, {midX} {endY}, {endX} {endY}"
								fill="none"
								stroke={focusedIssueId === pos.issue.id || focusedIssueId === depId
									? '#3b82f6'
									: '#d1d5db'}
								stroke-width={focusedIssueId === pos.issue.id || focusedIssueId === depId ? 3 : 2}
								marker-end="url(#arrowhead)"
							/>
						{/if}
					{/each}
				{/each}

				<defs>
					<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
						<polygon points="0 0, 10 3.5, 0 7" fill="#d1d5db" />
					</marker>
				</defs>

				<!-- Nodes -->
				{#each positions as pos}
					{@const isBlocked = issueStore.getBlockers(pos.issue.id).length > 0}
					{@const statusColor = getStatusColor(pos.issue.status, isBlocked)}
					{@const statusBg = getStatusBg(pos.issue.status, isBlocked)}
					{@const isFocused = focusedIssueId === pos.issue.id}
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
						<rect
							width={NODE_WIDTH}
							height={NODE_HEIGHT}
							rx="8"
							fill={statusBg}
							stroke={isFocused ? '#3b82f6' : statusColor}
							stroke-width={isFocused ? 3 : 2}
						/>
						<circle cx="14" cy={NODE_HEIGHT / 2} r="4" fill={statusColor} />
						<text x="26" y={NODE_HEIGHT / 2 - 4} font-size="12" font-weight="500" fill="#1f2937">
							{pos.issue.title.length > 18 ? pos.issue.title.slice(0, 18) + '…' : pos.issue.title}
						</text>
						<text x="26" y={NODE_HEIGHT / 2 + 10} font-size="10" fill="#6b7280">
							P{pos.issue.priority} · {pos.issue.status.replace('_', ' ')}
						</text>
					</g>
				{/each}
			</svg>
		{/if}
	</div>

	<!-- Legend -->
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
		<div class="text-gray-400">|</div>
		<div class="text-gray-500">
			{displayedIssues.length} issue{displayedIssues.length !== 1 ? 's' : ''} shown
		</div>
	</div>
</div>
