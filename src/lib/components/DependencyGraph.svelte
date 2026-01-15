<script lang="ts">
	import { browser } from '$app/environment';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { goto } from '$app/navigation';
	import type { Issue, RelationshipSuggestion, GraphImprovement, ExecutionType } from '$lib/types/issue';
	import { getModelAbbrev, getModelColor } from '$lib/types/graphChat';
	import HelpTooltip from './HelpTooltip.svelte';
	import ContextMenu from './ContextMenu.svelte';

	// Execution type visual config
	const executionTypeConfig: Record<ExecutionType, { color: string; bgColor: string; icon: string; label: string }> = {
		automated: { color: '#059669', bgColor: '#d1fae5', icon: '⚡', label: 'AI' },
		human: { color: '#dc2626', bgColor: '#fee2e2', icon: '👤', label: 'You' },
		ai_assisted: { color: '#0284c7', bgColor: '#e0f2fe', icon: '🤝', label: 'AI+✓' },
		human_assisted: { color: '#7c3aed', bgColor: '#ede9fe', icon: '💡', label: 'You+AI' }
	};

	// Props
	interface Props {
		focusId?: string | null;
		focusedIssueId?: string | null;
	}
	let { focusId = null, focusedIssueId = $bindable<string | null>(null) }: Props = $props();

	// Layout constants
	const NODE_WIDTH = 320;
	const NODE_MIN_HEIGHT = 60;
	const NODE_HEADER_HEIGHT = 48; // Title + metadata
	const DESC_LINE_HEIGHT = 14;
	const DESC_CHARS_PER_LINE = 48;
	const DESC_MAX_LINES = 8;
	const HORIZONTAL_GAP = 100;
	const VERTICAL_GAP = 40;
	const PADDING = 80;

	// Calculate node height based on description
	function getNodeHeight(issue: Issue): number {
		if (!issue.description || issue.description.trim().length === 0) {
			return NODE_MIN_HEIGHT;
		}
		const desc = issue.description.replace(/\n/g, ' ').trim();
		const numLines = Math.min(Math.ceil(desc.length / DESC_CHARS_PER_LINE), DESC_MAX_LINES);
		return NODE_HEADER_HEIGHT + numLines * DESC_LINE_HEIGHT + 12; // 12px padding
	}

	// Filter state
	let showClosed = $state(false);
	// focusedIssueId is now a bindable prop

	// Legend and help state
	const LEGEND_COLLAPSED_KEY = 'graph-legend-collapsed';
	const FIRST_VISIT_KEY = 'graph-first-visit-seen';

	function getStoredBoolean(key: string, defaultValue: boolean): boolean {
		if (!browser) return defaultValue;
		try {
			const stored = localStorage.getItem(key);
			return stored !== null ? stored === 'true' : defaultValue;
		} catch {
			return defaultValue;
		}
	}

	let legendCollapsed = $state(getStoredBoolean(LEGEND_COLLAPSED_KEY, false));
	let firstVisitSeen = $state(getStoredBoolean(FIRST_VISIT_KEY, false));

	function toggleLegend() {
		legendCollapsed = !legendCollapsed;
		if (browser) {
			localStorage.setItem(LEGEND_COLLAPSED_KEY, String(legendCollapsed));
		}
	}

	function dismissFirstVisit() {
		firstVisitSeen = true;
		if (browser) {
			localStorage.setItem(FIRST_VISIT_KEY, 'true');
		}
	}

	// Complexity warning threshold
	const COMPLEXITY_THRESHOLD = 20;

	// AI Suggestions state
	let suggestions = $state<RelationshipSuggestion[]>([]);
	let improvements = $state<GraphImprovement[]>([]);
	let loadingSuggestions = $state(false);
	let dismissedSuggestions = $state<Set<string>>(new Set());
	let dismissedImprovements = $state<Set<string>>(new Set());

	// Active improvements (not dismissed)
	let activeImprovements = $derived(
		improvements.filter((imp) => !dismissedImprovements.has(imp.id))
	);

	// Active suggestions for the focused issue (filtered for validity)
	let activeSuggestions = $derived(
		suggestions.filter((s) => {
			if (!focusedIssueId) return false;
			if (dismissedSuggestions.has(s.targetId)) return false;

			const focusedIssue = issueStore.getById(focusedIssueId);
			if (!focusedIssue) return false;

			// Already a direct dependency
			if (focusedIssue.dependencies.includes(s.targetId)) return false;

			// Target doesn't exist
			if (!issueStore.getById(s.targetId)) return false;

			// Would create a cycle
			if (issueStore.wouldCreateCycle(focusedIssueId, s.targetId)) return false;

			// Would be redundant (already reachable transitively)
			const transitiveDeps = issueStore.getTransitiveDependencies(focusedIssueId);
			if (transitiveDeps.has(s.targetId)) return false;

			return true;
		})
	);

	// Error state for showing messages
	let errorMessage = $state<string | null>(null);

	// Context menu state
	let contextMenu = $state<{ issue: Issue; x: number; y: number } | null>(null);

	function handleContextMenu(e: MouseEvent, issue: Issue) {
		e.preventDefault();
		e.stopPropagation();
		contextMenu = { issue, x: e.clientX, y: e.clientY };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	// Inline issue creation state
	let inlineCreate = $state<{ x: number; y: number } | null>(null);
	let inlineCreateTitle = $state('');
	let creatingInline = $state(false);

	// Track if we're in panning mode to avoid triggering create
	let wasPanning = $state(false);
	let panStartPos = $state<{ x: number; y: number } | null>(null);

	// Drag-to-connect state for creating dependencies
	let dragConnect = $state<{
		fromId: string;
		fromX: number;
		fromY: number;
		toX: number;
		toY: number;
	} | null>(null);
	let dragOverNodeId = $state<string | null>(null);

	function handleBackgroundDoubleClick(e: MouseEvent) {
		// Don't create if we were panning
		if (wasPanning) return;

		// Get click position relative to viewport
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;

		// Open inline create form
		inlineCreate = { x, y };
		inlineCreateTitle = '';
	}

	function closeInlineCreate() {
		inlineCreate = null;
		inlineCreateTitle = '';
		creatingInline = false;
	}

	function createInlineIssue() {
		if (!inlineCreateTitle.trim()) return;

		creatingInline = true;

		const newIssue = issueStore.create({
			title: inlineCreateTitle.trim(),
			description: '',
			priority: 2,
			type: 'task'
		});

		if (newIssue) {
			focusedIssueId = newIssue.id;
		}

		closeInlineCreate();
	}

	// Drag-to-connect handlers
	function startDragConnect(e: MouseEvent, issueId: string, nodeX: number, nodeY: number, nodeHeight: number) {
		e.stopPropagation();
		e.preventDefault();

		// Get SVG element to compute coordinates
		const svg = (e.target as Element).closest('svg');
		if (!svg) return;

		const rect = svg.getBoundingClientRect();
		const svgX = nodeX + NODE_WIDTH;
		const svgY = nodeY + nodeHeight / 2;

		dragConnect = {
			fromId: issueId,
			fromX: svgX,
			fromY: svgY,
			toX: svgX,
			toY: svgY
		};

		// Add window listeners for drag
		window.addEventListener('mousemove', handleDragConnectMove);
		window.addEventListener('mouseup', handleDragConnectEnd);
	}

	function handleDragConnectMove(e: MouseEvent) {
		if (!dragConnect) return;

		const svg = document.querySelector('.dependency-graph-svg');
		if (!svg) return;

		const rect = svg.getBoundingClientRect();
		// Convert screen coords to SVG coords accounting for pan and scale
		const svgX = (e.clientX - rect.left - panX) / scale;
		const svgY = (e.clientY - rect.top - panY) / scale;

		dragConnect = {
			...dragConnect,
			toX: svgX,
			toY: svgY
		};

		// Check if we're over a node
		dragOverNodeId = null;
		for (const pos of positions) {
			if (pos.issue.id === dragConnect.fromId) continue; // Can't connect to self

			if (
				svgX >= pos.x &&
				svgX <= pos.x + NODE_WIDTH &&
				svgY >= pos.y &&
				svgY <= pos.y + pos.height
			) {
				dragOverNodeId = pos.issue.id;
				break;
			}
		}
	}

	function handleDragConnectEnd() {
		window.removeEventListener('mousemove', handleDragConnectMove);
		window.removeEventListener('mouseup', handleDragConnectEnd);

		if (dragConnect && dragOverNodeId) {
			// Create dependency: fromId depends on dragOverNodeId
			// (fromId → dragOverNodeId means dragOverNodeId must be done first)
			const result = issueStore.addDependency(dragConnect.fromId, dragOverNodeId);
			if (result.error) {
				errorMessage = result.error;
				setTimeout(() => (errorMessage = null), 3000);
			}
		}

		dragConnect = null;
		dragOverNodeId = null;
	}

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
			improvements = [];
			dismissedSuggestions = new Set();
			dismissedImprovements = new Set();
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
		height: number;
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

		// Group issues by layer and sort by order
		const layerGroups = new Map<number, Issue[]>();
		issues.forEach((issue) => {
			const layer = layers.get(issue.id) ?? 0;
			if (!layerGroups.has(layer)) layerGroups.set(layer, []);
			layerGroups.get(layer)!.push(issue);
		});

		// Sort each layer group by order
		layerGroups.forEach((group) => {
			group.sort((a, b) => (orders.get(a.id) ?? 0) - (orders.get(b.id) ?? 0));
		});

		// Calculate y positions based on cumulative heights
		const yPositions = new Map<string, number>();
		layerGroups.forEach((group) => {
			let currentY = PADDING;
			for (const issue of group) {
				yPositions.set(issue.id, currentY);
				currentY += getNodeHeight(issue) + VERTICAL_GAP;
			}
		});

		return issues.map((issue) => ({
			issue,
			x: PADDING + (layers.get(issue.id) ?? 0) * (NODE_WIDTH + HORIZONTAL_GAP),
			y: yPositions.get(issue.id) ?? PADDING,
			height: getNodeHeight(issue),
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
		// Find max y + height across all nodes
		let maxBottom = 0;
		positions.forEach((p) => {
			const bottom = p.y + p.height;
			if (bottom > maxBottom) maxBottom = bottom;
		});
		return maxBottom + PADDING;
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
			panStartPos = { x: e.clientX, y: e.clientY };
			wasPanning = false;
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (isPanning) {
			const dx = e.clientX - lastMousePos.x;
			const dy = e.clientY - lastMousePos.y;
			panX += dx;
			panY += dy;
			lastMousePos = { x: e.clientX, y: e.clientY };

			// Mark as panning if moved more than 5px
			if (panStartPos) {
				const totalMoved = Math.abs(e.clientX - panStartPos.x) + Math.abs(e.clientY - panStartPos.y);
				if (totalMoved > 5) {
					wasPanning = true;
				}
			}
		}
	}

	function handleMouseUp() {
		isPanning = false;
		// Reset panning flag after a short delay to allow double-click to check it
		setTimeout(() => {
			wasPanning = false;
			panStartPos = null;
		}, 100);
	}

	function resetView() {
		scale = 1;
		panX = 0;
		panY = 0;
		focusedIssueId = null;
		suggestions = [];
		improvements = [];
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
					existingIssues: issueStore.issues,
					currentIssueId: focusedIssueId
				})
			});
			if (response.ok) {
				const data = await response.json();
				suggestions = data.suggestions || [];
				improvements = data.improvements || [];
			}
		} catch {
			suggestions = [];
			improvements = [];
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

	function acceptImprovement(improvement: GraphImprovement) {
		let hasError = false;
		// Apply all changes in the improvement set
		for (const change of improvement.changes) {
			if (change.action === 'add') {
				const result = issueStore.addDependency(change.fromId, change.toId);
				if (result.error) {
					errorMessage = result.error;
					hasError = true;
					break;
				}
			} else if (change.action === 'remove') {
				issueStore.removeDependency(change.fromId, change.toId);
			}
		}
		if (!hasError) {
			improvements = improvements.filter((imp) => imp.id !== improvement.id);
		} else {
			setTimeout(() => (errorMessage = null), 3000);
		}
	}

	function dismissImprovement(improvement: GraphImprovement) {
		dismissedImprovements = new Set([...dismissedImprovements, improvement.id]);
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

				<!-- AI Assignment Quick Actions -->
				<div class="flex items-center gap-1 p-1 bg-amber-50 rounded-lg border border-amber-200">
					{#if focused.aiAssignment}
						<span class="px-2 py-1 text-xs text-amber-700">
							{focused.aiAssignment.modelName}
						</span>
						<button
							onclick={() => { issueStore.unassignAI(focused.id); }}
							class="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 rounded transition-colors"
						>
							Unassign AI
						</button>
					{:else}
						<button
							onclick={() => { issueStore.assignAI(focused.id, 'anthropic/claude-sonnet-4', 'Claude Sonnet 4'); }}
							class="px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 rounded transition-colors"
							title="Assign Claude"
						>
							🤖 Claude
						</button>
						<button
							onclick={() => { issueStore.assignAI(focused.id, 'openai/gpt-4o', 'GPT-4o'); }}
							class="px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 rounded transition-colors"
							title="Assign GPT-4o"
						>
							🤖 GPT
						</button>
					{/if}
				</div>

				<!-- Flag for Human Attention -->
				{#if focused.needsHuman}
					<button
						onclick={() => { issueStore.clearNeedsHuman(focused.id); }}
						class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						Resolve
					</button>
				{:else}
					<button
						onclick={() => { issueStore.flagNeedsHuman(focused.id, 'user_flagged', 'Manually flagged for attention'); }}
						class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors"
						title="Flag for human attention"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						Flag
					</button>
				{/if}

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
				<span class="font-medium text-purple-900">AI Suggested: Finish These First</span>
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

	<!-- Graph Improvements Panel -->
	{#if activeImprovements.length > 0}
		<div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
			<div class="flex items-center gap-2 mb-3">
				<svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
				</svg>
				<span class="font-medium text-amber-900">AI Graph Improvements</span>
				<span class="text-sm text-amber-600">({activeImprovements.length} set{activeImprovements.length !== 1 ? 's' : ''})</span>
			</div>
			<div class="space-y-3">
				{#each activeImprovements as improvement}
					<div class="bg-white border border-amber-200 rounded-lg p-3 shadow-sm">
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1">
								<p class="text-sm font-medium text-gray-900">{improvement.description}</p>
								<div class="mt-2 space-y-1">
									{#each improvement.changes as change}
										{@const fromIssue = issueStore.getById(change.fromId)}
										{@const toIssue = issueStore.getById(change.toId)}
										<div class="flex items-center gap-2 text-xs">
											<span class="px-1.5 py-0.5 rounded font-medium {change.action === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
												{change.action === 'add' ? '+' : '−'}
											</span>
											<span class="text-gray-600">
												"{fromIssue?.title.slice(0, 20) || change.fromId}" → "{toIssue?.title.slice(0, 20) || change.toId}"
											</span>
										</div>
									{/each}
								</div>
							</div>
							<div class="flex items-center gap-1 flex-shrink-0">
								<button
									onclick={() => acceptImprovement(improvement)}
									class="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors"
								>
									Apply
								</button>
								<button
									onclick={() => dismissImprovement(improvement)}
									class="p-1.5 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
									title="Dismiss"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					</div>
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
		ondblclick={handleBackgroundDoubleClick}
		role="img"
		aria-label="Task order graph"
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
					<p class="text-gray-500 mb-4">Create your first task to start building your plan.</p>
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
				class="dependency-graph-svg"
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
					<marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
						<polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
					</marker>
				</defs>

				<!-- Existing Edges with importance-based styling -->
				{#each positions as pos}
					{#each pos.issue.dependencies as depId}
						{@const depPos = getPosition(depId)}
						{#if depPos}
							{@const startX = depPos.x + NODE_WIDTH}
							{@const startY = depPos.y + depPos.height / 2}
							{@const endX = pos.x}
							{@const endY = pos.y + pos.height / 2}
							{@const midX = (startX + endX) / 2}
							{@const isHighlighted = focusedIssueId === pos.issue.id || focusedIssueId === depId}
							{@const importance = issueStore.getBlockerImportance(depId)}
							{@const importanceWidth = 2 + importance * 2}
							{@const importanceOpacity = 0.5 + importance * 0.5}
							<path
								d="M {startX} {startY} C {midX} {startY}, {midX} {endY}, {endX} {endY}"
								fill="none"
								stroke={isHighlighted ? '#3b82f6' : '#d1d5db'}
								stroke-width={isHighlighted ? 3 : importanceWidth}
								opacity={isHighlighted ? 1 : importanceOpacity}
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
						{@const startY = targetPos.y + targetPos.height / 2}
						{@const endX = focusedPos.x}
						{@const endY = focusedPos.y + focusedPos.height / 2}
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

				<!-- Drag-to-connect preview line -->
				{#if dragConnect}
					{@const midX = (dragConnect.fromX + dragConnect.toX) / 2}
					<path
						d="M {dragConnect.fromX} {dragConnect.fromY} C {midX} {dragConnect.fromY}, {midX} {dragConnect.toY}, {dragConnect.toX} {dragConnect.toY}"
						fill="none"
						stroke={dragOverNodeId ? '#22c55e' : '#9ca3af'}
						stroke-width="3"
						stroke-dasharray={dragOverNodeId ? 'none' : '6,4'}
						marker-end={dragOverNodeId ? 'url(#arrowhead-green)' : 'url(#arrowhead)'}
						class="pointer-events-none"
					/>
				{/if}

				<!-- Nodes -->
				{#each positions as pos}
					{@const isBlocked = issueStore.getBlockers(pos.issue.id).length > 0}
					{@const statusColor = getStatusColor(pos.issue.status, isBlocked)}
					{@const statusBg = getStatusBg(pos.issue.status, isBlocked)}
					{@const isFocused = focusedIssueId === pos.issue.id}
					{@const isSuggested = activeSuggestions.some((s) => s.targetId === pos.issue.id)}
					{@const hasAI = !!pos.issue.aiAssignment}
					{@const needsHuman = !!pos.issue.needsHuman}
					{@const aiColor = hasAI ? getModelColor(pos.issue.aiAssignment!.modelId) : null}
					{@const isDragTarget = dragOverNodeId === pos.issue.id}
					{@const isDragSource = dragConnect?.fromId === pos.issue.id}
					<g
						transform="translate({pos.x}, {pos.y})"
						onclick={(e) => handleNodeClick(e, pos.issue.id)}
						oncontextmenu={(e) => handleContextMenu(e, pos.issue)}
						onmousedown={(e) => e.stopPropagation()}
						style="cursor: pointer;"
						role="button"
						tabindex="0"
						onkeydown={(e) => {
							if (e.key === 'Enter') navigateToIssue(pos.issue.id);
							else if (e.key === ' ') focusOnIssue(pos.issue.id);
						}}
					>
						<!-- Needs Human attention glow (red/coral) -->
						{#if needsHuman}
							<rect
								x="-6"
								y="-6"
								width={NODE_WIDTH + 12}
								height={pos.height + 12}
								rx="14"
								fill="none"
								stroke="#ef4444"
								stroke-width="3"
								opacity="0.6"
								class="animate-pulse"
							/>
						{/if}

						<!-- Node background with glow for focused/suggested -->
						{#if isFocused && !needsHuman}
							<rect
								x="-4"
								y="-4"
								width={NODE_WIDTH + 8}
								height={pos.height + 8}
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
								height={pos.height + 8}
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
							height={pos.height}
							rx="10"
							fill={isSuggested ? '#faf5ff' : needsHuman ? '#fef2f2' : statusBg}
							stroke={needsHuman ? '#ef4444' : isFocused ? '#3b82f6' : isSuggested ? '#9333ea' : statusColor}
							stroke-width={needsHuman || isFocused || isSuggested ? 3 : 2}
							class="transition-all duration-200"
						/>

						<!-- Status indicator -->
						<circle cx="16" cy="20" r="5" fill={statusColor} />

						<!-- Title -->
						<text x="30" y="24" font-size="13" font-weight="600" fill="#1f2937">
							{pos.issue.title.length > 30 ? pos.issue.title.slice(0, 30) + '…' : pos.issue.title}
						</text>

						<!-- Metadata -->
						<text x="30" y="40" font-size="11" fill="#6b7280">
							P{pos.issue.priority} · {pos.issue.status.replace('_', ' ')}
						</text>

						<!-- Execution Type badge (bottom-left, shows who does this task) -->
						{#if pos.issue.executionType}
							{@const execConfig = executionTypeConfig[pos.issue.executionType]}
							<g transform="translate(8, {pos.height - 24})">
								<rect x="0" y="0" width="48" height="18" rx="9" fill={execConfig.bgColor} stroke={execConfig.color} stroke-width="1" />
								<text x="24" y="13" font-size="10" fill={execConfig.color} text-anchor="middle" font-weight="600">
									{execConfig.label}
								</text>
							</g>
							{#if pos.issue.validationRequired}
								<g transform="translate(60, {pos.height - 24})">
									<rect x="0" y="0" width="20" height="18" rx="9" fill="#fef3c7" stroke="#f59e0b" stroke-width="1" />
									<text x="10" y="13" font-size="10" fill="#d97706" text-anchor="middle" font-weight="bold">✓</text>
								</g>
							{/if}
						{/if}

						<!-- Description (truncated, wrapped - up to 6 lines) -->
						{#if pos.issue.description}
							{@const desc = pos.issue.description.replace(/\n/g, ' ').trim()}
							{@const charsPerLine = 50}
							{@const maxLines = 6}
							{@const lines = []}
							{#each Array(maxLines) as _, i}
								{@const start = i * charsPerLine}
								{@const end = (i + 1) * charsPerLine}
								{@const isLast = i === maxLines - 1 || end >= desc.length}
								{@const lineText = desc.slice(start, end)}
								{#if lineText}
									<text x="12" y={58 + i * 14} font-size="11" fill="#6b7280">
										{lineText}{isLast && desc.length > end ? '…' : ''}
									</text>
								{/if}
							{/each}
						{:else}
							<text x="12" y="58" font-size="11" fill="#d1d5db" font-style="italic">
								No description
							</text>
						{/if}

						<!-- AI Assignment badge (top-right) -->
						{#if hasAI && aiColor}
							<g transform="translate({NODE_WIDTH - 28}, -8)">
								<rect x="0" y="0" width="28" height="20" rx="10" fill={aiColor.bg} />
								<text x="14" y="14" font-size="9" fill={aiColor.text} text-anchor="middle" font-weight="bold">
									{getModelAbbrev(pos.issue.aiAssignment!.modelId)}
								</text>
							</g>
						{/if}

						<!-- Needs Human badge (top-left, pulsing exclamation) -->
						{#if needsHuman}
							<g transform="translate(-8, -8)">
								<circle cx="12" cy="12" r="12" fill="#ef4444" class="animate-pulse" />
								<text x="12" y="17" font-size="14" fill="white" text-anchor="middle" font-weight="bold">!</text>
							</g>
						{/if}

						<!-- Suggested badge (only if no AI assignment) -->
						{#if isSuggested && !hasAI}
							<g transform="translate({NODE_WIDTH - 24}, -8)">
								<circle cx="12" cy="12" r="12" fill="#9333ea" />
								<text x="12" y="16" font-size="10" fill="white" text-anchor="middle" font-weight="bold">AI</text>
							</g>
						{/if}

						<!-- Drag-to-connect handle (right edge) -->
						<g
							class="connector-handle"
							transform="translate({NODE_WIDTH}, {pos.height / 2})"
							onmousedown={(e) => startDragConnect(e, pos.issue.id, pos.x, pos.y, pos.height)}
							style="cursor: crosshair;"
						>
							<!-- Invisible larger hit area -->
							<circle
								cx="0"
								cy="0"
								r="14"
								fill="transparent"
							/>
							<!-- Visible handle -->
							<circle
								cx="0"
								cy="0"
								r={isDragTarget ? 10 : isDragSource ? 8 : 6}
								fill={isDragTarget ? '#22c55e' : isDragSource ? '#3b82f6' : '#e5e7eb'}
								stroke={isDragTarget ? '#16a34a' : isDragSource ? '#2563eb' : '#9ca3af'}
								stroke-width="2"
							/>
							<!-- Arrow icon indicating direction -->
							{#if !isDragTarget && !isDragSource}
								<text x="0" y="4" font-size="10" fill="#6b7280" text-anchor="middle">→</text>
							{/if}
							{#if isDragTarget}
								<text x="0" y="4" font-size="12" fill="white" text-anchor="middle" font-weight="bold">+</text>
							{/if}
							{#if isDragSource}
								<circle cx="0" cy="0" r="3" fill="white" />
							{/if}
						</g>
					</g>
				{/each}
			</svg>
		{/if}
	</div>

	<!-- First Visit Hint -->
	{#if !firstVisitSeen && displayedIssues.length > 0}
		<div class="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
			<div class="text-blue-600 mt-0.5">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium text-gray-900">Welcome to the Graph View!</p>
				<p class="text-sm text-gray-600 mt-1">
					<span class="font-medium">Click</span> a task to select it ·
					<span class="font-medium">Double-click</span> to edit ·
					<span class="font-medium">Drag the → handle</span> to connect tasks ·
					<span class="font-medium">Scroll</span> to zoom ·
					<span class="font-medium">Drag background</span> to pan
				</p>
			</div>
			<button
				onclick={dismissFirstVisit}
				class="text-gray-400 hover:text-gray-600 p-1"
				aria-label="Dismiss hint"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Complexity Warning -->
	{#if displayedIssues.length >= COMPLEXITY_THRESHOLD}
		<div class="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
			<svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<p class="text-sm text-amber-800">
				Your plan has <strong>{displayedIssues.length} tasks</strong> – the List view may be easier to scan.
			</p>
		</div>
	{/if}

	<!-- Legend & Actions -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<button
				onclick={toggleLegend}
				class="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
			>
				<svg
					class="w-4 h-4 transition-transform {legendCollapsed ? '' : 'rotate-90'}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				<span class="font-medium">Legend</span>
			</button>

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

		{#if !legendCollapsed}
			<div class="flex flex-wrap items-center gap-4 text-sm pl-6 pb-2 transition-all">
				<!-- Status indicators -->
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-green-500"></div>
					<span class="text-gray-600">Can Start</span>
					<HelpTooltip text="Ready to work on - no blockers" position="bottom" />
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-blue-500"></div>
					<span class="text-gray-600">In Progress</span>
					<HelpTooltip text="Currently being worked on" position="bottom" />
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-amber-500"></div>
					<span class="text-gray-600">Waiting</span>
					<HelpTooltip text="Blocked by other tasks that must finish first" position="bottom" />
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-gray-400"></div>
					<span class="text-gray-600">Closed</span>
					<HelpTooltip text="Completed and done" position="bottom" />
				</div>
				<div class="h-4 border-l border-gray-300"></div>
				<!-- Execution type (who does it) -->
				<div class="flex items-center gap-2">
					<div class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300">You</div>
					<span class="text-gray-600">You do</span>
					<HelpTooltip text="Only you can do this (physical action, signature, decision)" position="bottom" />
				</div>
				<div class="flex items-center gap-2">
					<div class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300">AI</div>
					<span class="text-gray-600">AI does</span>
					<HelpTooltip text="AI can complete this without your involvement" position="bottom" />
				</div>
				<div class="flex items-center gap-2">
					<div class="px-1 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300">✓</div>
					<span class="text-gray-600">Verify</span>
					<HelpTooltip text="You need to review and approve when this is done" position="bottom" />
				</div>
				<div class="h-4 border-l border-gray-300"></div>
				<!-- Connection & edge help -->
				<div class="flex items-center gap-2">
					<div class="w-5 h-3 rounded bg-gray-200 flex items-center justify-center">
						<span class="text-[8px] text-gray-600">→</span>
					</div>
					<span class="text-gray-600">Connect</span>
					<HelpTooltip text="Drag this handle to create a 'must finish first' connection" position="bottom" />
				</div>
				<div class="flex items-center gap-2">
					<svg class="w-6 h-3" viewBox="0 0 24 12">
						<line x1="0" y1="6" x2="24" y2="6" stroke="#9ca3af" stroke-width="2" />
						<polygon points="20,3 24,6 20,9" fill="#9ca3af" />
					</svg>
					<span class="text-gray-600">Must finish first</span>
					<HelpTooltip text="Arrow points from blocker to blocked task" position="bottom" />
				</div>
				<div class="h-4 border-l border-gray-300"></div>
				<div class="flex items-center gap-2">
					<div class="w-5 h-3.5 rounded bg-amber-600 flex items-center justify-center">
						<span class="text-[8px] text-white font-bold">CL</span>
					</div>
					<span class="text-gray-600">AI Working</span>
					<HelpTooltip text="An AI model is actively working on this task" position="bottom" />
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
					<span class="text-gray-600">Needs Help</span>
					<HelpTooltip text="AI got stuck or timed out - you need to intervene" position="bottom" />
				</div>
				{#if activeSuggestions.length > 0}
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded-full bg-purple-600"></div>
						<span class="text-gray-600">AI Suggested</span>
						<HelpTooltip text="AI thinks this task should be done before the selected one" position="bottom" />
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Help text -->
	<div class="text-center text-sm text-gray-400 pt-2">
		Click to select · Double-click node to edit · <span class="text-green-600">Drag → to connect</span> · Double-click empty space to create · Scroll to zoom · Drag to pan · Right-click for menu
		{#if !focusedIssueId}
			· <span class="text-purple-600">Select an issue to see AI suggestions</span>
		{/if}
	</div>
</div>

<!-- Context Menu -->
{#if contextMenu}
	<ContextMenu
		issue={contextMenu.issue}
		x={contextMenu.x}
		y={contextMenu.y}
		onClose={closeContextMenu}
	/>
{/if}

<!-- Inline Create Form -->
{#if inlineCreate}
	<div class="fixed inset-0 z-[90]" onclick={closeInlineCreate}></div>
	<div
		class="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-72"
		style="left: {Math.min(inlineCreate.x, window.innerWidth - 300)}px; top: {Math.min(inlineCreate.y, window.innerHeight - 150)}px;"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center gap-2 mb-2">
			<svg class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			<span class="text-sm font-medium text-gray-900">Quick Create</span>
		</div>
		<form onsubmit={(e) => { e.preventDefault(); createInlineIssue(); }}>
			<input
				type="text"
				bind:value={inlineCreateTitle}
				placeholder="What needs to be done?"
				class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				autofocus
			/>
			<div class="flex items-center justify-between mt-2">
				<button
					type="button"
					onclick={closeInlineCreate}
					class="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!inlineCreateTitle.trim() || creatingInline}
					class="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Create
				</button>
			</div>
		</form>
		<p class="text-xs text-gray-400 mt-2">Press Enter to create</p>
	</div>
{/if}
