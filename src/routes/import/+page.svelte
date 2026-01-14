<script lang="ts">
	import { goto } from '$app/navigation';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { PRIORITY_LABELS, TYPE_LABELS } from '$lib/types/issue';
	import type { IssueType, IssuePriority } from '$lib/types/issue';

	interface ParsedTask {
		tempId: string;
		title: string;
		description: string;
		type: IssueType;
		priority: IssuePriority;
		dependsOn: string[];
		suggestedExistingDeps: string[];
	}

	interface ValidationIssue {
		type: 'cycle' | 'missing_dep';
		message: string;
		involvedTasks: string[];
		suggestion?: {
			action: 'remove_dep';
			fromTask: string;
			toTask: string;
		};
	}

	let inputText = $state('');
	let parsing = $state(false);
	let parsedTasks = $state<ParsedTask[]>([]);
	let reasoning = $state('');
	let error = $state<string | null>(null);
	let validationIssues = $state<ValidationIssue[]>([]);
	let importing = $state(false);

	// Track which tasks user wants to import
	let selectedTasks = $state<Set<string>>(new Set());

	// Get titles for display
	function getTaskTitle(tempId: string): string {
		const task = parsedTasks.find(t => t.tempId === tempId);
		return task?.title || tempId;
	}

	function getExistingTitle(id: string): string {
		const issue = issueStore.getById(id);
		return issue?.title || id;
	}

	async function parseText() {
		if (inputText.trim().length < 10) {
			error = 'Please enter more text describing your tasks';
			return;
		}

		parsing = true;
		error = null;
		parsedTasks = [];
		reasoning = '';
		validationIssues = [];

		try {
			const response = await fetch('/api/parse-tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: inputText,
					existingIssues: issueStore.issues
				})
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				parsedTasks = data.tasks;
				reasoning = data.reasoning;
				// Select all tasks by default
				selectedTasks = new Set(parsedTasks.map(t => t.tempId));
				// Validate the proposed graph
				validateGraph();
			}
		} catch (e) {
			error = 'Failed to parse tasks. Please try again.';
		} finally {
			parsing = false;
		}
	}

	function validateGraph() {
		validationIssues = [];

		// Build a combined graph: existing issues + new tasks
		const allNodes = new Map<string, { deps: string[] }>();

		// Add existing issues
		for (const issue of issueStore.issues) {
			allNodes.set(issue.id, { deps: [...issue.dependencies] });
		}

		// Add new tasks (only selected ones)
		const tempIdToRealDeps = new Map<string, string[]>();
		for (const task of parsedTasks) {
			if (!selectedTasks.has(task.tempId)) continue;

			const deps: string[] = [];

			// Dependencies on other new tasks (using tempIds for now)
			for (const depTempId of task.dependsOn) {
				if (selectedTasks.has(depTempId)) {
					deps.push(depTempId);
				}
			}

			// Dependencies on existing issues
			for (const existingId of task.suggestedExistingDeps) {
				if (issueStore.getById(existingId)) {
					deps.push(existingId);
				}
			}

			tempIdToRealDeps.set(task.tempId, deps);
			allNodes.set(task.tempId, { deps });
		}

		// Check for cycles using DFS
		const visited = new Set<string>();
		const inStack = new Set<string>();
		const cyclePath: string[] = [];

		function hasCycle(nodeId: string, path: string[]): boolean {
			if (inStack.has(nodeId)) {
				// Found cycle - extract it
				const cycleStart = path.indexOf(nodeId);
				cyclePath.push(...path.slice(cycleStart), nodeId);
				return true;
			}
			if (visited.has(nodeId)) return false;

			visited.add(nodeId);
			inStack.add(nodeId);
			path.push(nodeId);

			const node = allNodes.get(nodeId);
			if (node) {
				for (const depId of node.deps) {
					if (hasCycle(depId, path)) return true;
				}
			}

			path.pop();
			inStack.delete(nodeId);
			return false;
		}

		for (const nodeId of allNodes.keys()) {
			if (!visited.has(nodeId) && hasCycle(nodeId, [])) {
				// Found a cycle
				const suggestion = cyclePath.length >= 2 ? {
					action: 'remove_dep' as const,
					fromTask: cyclePath[1],
					toTask: cyclePath[0]
				} : undefined;

				validationIssues.push({
					type: 'cycle',
					message: `Circular dependency detected: ${cyclePath.map(id => {
						const task = parsedTasks.find(t => t.tempId === id);
						return task ? task.title : getExistingTitle(id);
					}).join(' → ')}`,
					involvedTasks: cyclePath,
					suggestion
				});
				break;
			}
		}

		// Check for missing dependencies
		for (const task of parsedTasks) {
			if (!selectedTasks.has(task.tempId)) continue;
			for (const depTempId of task.dependsOn) {
				if (!selectedTasks.has(depTempId) && !parsedTasks.find(t => t.tempId === depTempId)) {
					validationIssues.push({
						type: 'missing_dep',
						message: `Task "${task.title}" depends on unknown task "${depTempId}"`,
						involvedTasks: [task.tempId]
					});
				}
			}
		}
	}

	function toggleTask(tempId: string) {
		const newSet = new Set(selectedTasks);
		if (newSet.has(tempId)) {
			newSet.delete(tempId);
		} else {
			newSet.add(tempId);
		}
		selectedTasks = newSet;
		validateGraph();
	}

	function removeDependency(taskTempId: string, depId: string) {
		parsedTasks = parsedTasks.map(t => {
			if (t.tempId === taskTempId) {
				return {
					...t,
					dependsOn: t.dependsOn.filter(d => d !== depId),
					suggestedExistingDeps: t.suggestedExistingDeps.filter(d => d !== depId)
				};
			}
			return t;
		});
		validateGraph();
	}

	function applySuggestion(suggestion: ValidationIssue['suggestion']) {
		if (!suggestion) return;
		if (suggestion.action === 'remove_dep') {
			removeDependency(suggestion.fromTask, suggestion.toTask);
		}
	}

	async function importTasks() {
		if (validationIssues.some(v => v.type === 'cycle')) {
			error = 'Please resolve all cycles before importing';
			return;
		}

		importing = true;

		try {
			// Map tempIds to real IDs as we create
			const tempIdToRealId = new Map<string, string>();

			// Sort tasks by dependency order (create dependencies first)
			const sorted = topologicalSort(parsedTasks.filter(t => selectedTasks.has(t.tempId)));

			for (const task of sorted) {
				// Convert tempId dependencies to real IDs
				const realDeps: string[] = [];

				for (const depTempId of task.dependsOn) {
					const realId = tempIdToRealId.get(depTempId);
					if (realId) {
						realDeps.push(realId);
					}
				}

				// Add existing issue dependencies
				for (const existingId of task.suggestedExistingDeps) {
					if (issueStore.getById(existingId)) {
						realDeps.push(existingId);
					}
				}

				// Create the issue
				const created = issueStore.create({
					title: task.title,
					description: task.description,
					type: task.type,
					priority: task.priority,
					dependencies: realDeps
				});

				if (created) {
					tempIdToRealId.set(task.tempId, created.id);
				}
			}

			goto('/');
		} catch (e) {
			error = 'Failed to import tasks';
		} finally {
			importing = false;
		}
	}

	function topologicalSort(tasks: ParsedTask[]): ParsedTask[] {
		const result: ParsedTask[] = [];
		const visited = new Set<string>();
		const taskMap = new Map(tasks.map(t => [t.tempId, t]));

		function visit(task: ParsedTask) {
			if (visited.has(task.tempId)) return;
			visited.add(task.tempId);

			for (const depTempId of task.dependsOn) {
				const depTask = taskMap.get(depTempId);
				if (depTask) visit(depTask);
			}

			result.push(task);
		}

		for (const task of tasks) {
			visit(task);
		}

		return result;
	}

	const priorityColors: Record<number, string> = {
		0: 'bg-red-100 text-red-800',
		1: 'bg-orange-100 text-orange-800',
		2: 'bg-yellow-100 text-yellow-800',
		3: 'bg-blue-100 text-blue-800',
		4: 'bg-gray-100 text-gray-600'
	};
</script>

<svelte:head>
	<title>Import Tasks</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<div class="mb-8">
		<a href="/" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Issues
		</a>
		<h1 class="text-2xl font-semibold text-gray-900">Bulk Import Tasks</h1>
		<p class="text-gray-500 mt-1">Enter tasks in freeform text. AI will parse them and determine dependencies.</p>
	</div>

	<!-- Input Section -->
	<div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
		<label for="input" class="block text-sm font-medium text-gray-700 mb-2">
			Describe your tasks
		</label>
		<textarea
			id="input"
			bind:value={inputText}
			rows="8"
			placeholder="Example:
- Set up the database schema
- Build the user authentication API (needs database first)
- Create the login page UI
- Integrate login page with auth API
- Write tests for authentication
- Deploy to staging

Or just describe your project naturally:
We need to build a user dashboard. First we need to design the wireframes, then implement the backend API, then build the React components. The components depend on the API being ready. Finally we need to write E2E tests."
			class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none font-mono text-sm"
		></textarea>

		<div class="mt-4 flex items-center gap-4">
			<button
				onclick={parseText}
				disabled={parsing || inputText.trim().length < 10}
				class="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
			>
				{#if parsing}
					<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
					Parsing...
				{:else}
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
					Parse with AI
				{/if}
			</button>

			{#if parsedTasks.length > 0}
				<span class="text-sm text-gray-500">
					{parsedTasks.length} tasks parsed
				</span>
			{/if}
		</div>
	</div>

	<!-- Error -->
	{#if error}
		<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
			<p class="text-sm font-medium">{error}</p>
		</div>
	{/if}

	<!-- Validation Issues -->
	{#if validationIssues.length > 0}
		<div class="mb-6 space-y-3">
			{#each validationIssues as issue}
				<div class="p-4 bg-amber-50 border border-amber-200 rounded-lg">
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<div class="flex-1">
							<p class="text-sm font-medium text-amber-800">{issue.message}</p>
							{#if issue.suggestion}
								<button
									onclick={() => applySuggestion(issue.suggestion)}
									class="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded hover:bg-amber-700 transition-colors"
								>
									Fix: Remove dependency
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Parsed Tasks Preview -->
	{#if parsedTasks.length > 0}
		<div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-gray-900">Parsed Tasks</h2>
				<span class="text-sm text-gray-500">{selectedTasks.size} of {parsedTasks.length} selected</span>
			</div>

			{#if reasoning}
				<div class="mb-4 p-3 bg-gray-50 rounded-lg">
					<p class="text-sm text-gray-600"><strong>AI reasoning:</strong> {reasoning}</p>
				</div>
			{/if}

			<div class="space-y-3">
				{#each parsedTasks as task}
					<div class="p-4 border rounded-lg transition-colors {selectedTasks.has(task.tempId) ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-gray-50 opacity-60'}">
						<div class="flex items-start gap-3">
							<input
								type="checkbox"
								checked={selectedTasks.has(task.tempId)}
								onchange={() => toggleTask(task.tempId)}
								class="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
							/>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
										{TYPE_LABELS[task.type]}
									</span>
									<span class="text-xs font-medium px-2 py-0.5 rounded-full {priorityColors[task.priority]}">
										{PRIORITY_LABELS[task.priority]}
									</span>
								</div>
								<h3 class="font-medium text-gray-900">{task.title}</h3>
								{#if task.description}
									<p class="text-sm text-gray-600 mt-1">{task.description}</p>
								{/if}

								<!-- Dependencies -->
								{#if task.dependsOn.length > 0 || task.suggestedExistingDeps.length > 0}
									<div class="mt-2 flex flex-wrap items-center gap-2">
										<span class="text-xs text-gray-500">Depends on:</span>
										{#each task.dependsOn as depTempId}
											<span class="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
												{getTaskTitle(depTempId)}
												<button
													onclick={() => removeDependency(task.tempId, depTempId)}
													class="hover:text-red-600"
													title="Remove dependency"
												>
													<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											</span>
										{/each}
										{#each task.suggestedExistingDeps as existingId}
											<span class="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
												{getExistingTitle(existingId)}
												<button
													onclick={() => removeDependency(task.tempId, existingId)}
													class="hover:text-red-600"
													title="Remove dependency"
												>
													<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											</span>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Import Button -->
			<div class="mt-6 flex items-center gap-4">
				<button
					onclick={importTasks}
					disabled={importing || selectedTasks.size === 0 || validationIssues.some(v => v.type === 'cycle')}
					class="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
				>
					{#if importing}
						<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
						Importing...
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						Import {selectedTasks.size} Tasks
					{/if}
				</button>

				{#if validationIssues.some(v => v.type === 'cycle')}
					<span class="text-sm text-red-600">Please resolve cycles before importing</span>
				{/if}
			</div>
		</div>
	{/if}
</div>
