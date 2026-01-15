<script lang="ts">
	import { issueStore } from '$lib/stores/issues.svelte';
	import { aiSettings } from '$lib/stores/aiSettings.svelte';
	import type { Issue } from '$lib/types/issue';
	import type { DurationEstimate, ScheduledTask, TimelineWeek } from '$lib/types/timeline';

	// State
	let loading = $state(false);
	let error = $state<string | null>(null);
	let estimates = $state<Map<string, DurationEstimate>>(new Map());
	let criticalPath = $state<Set<string>>(new Set());
	let scheduledTasks = $state<ScheduledTask[]>([]);
	let totalDays = $state({ min: 0, max: 0, expected: 0 });
	let userContext = $state('');
	let viewMode = $state<'gantt' | 'calendar'>('gantt');

	// Get open issues
	let openIssues = $derived(
		issueStore.issues.filter(i => i.status !== 'closed')
	);

	// Calculate timeline schedule
	function scheduleTasksFrom(
		issues: Issue[],
		estimates: Map<string, DurationEstimate>,
		criticalPathIds: Set<string>
	): ScheduledTask[] {
		const scheduled: ScheduledTask[] = [];
		const taskEndDays = new Map<string, number>();
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Topological sort for scheduling order
		const sorted = topologicalSort(issues);

		// Assign rows for parallel tasks
		const rowAssignments = new Map<string, number>();
		let maxRow = 0;

		for (const issue of sorted) {
			// Find start day based on dependencies
			let startDay = 0;
			for (const depId of issue.dependencies || []) {
				const depEnd = taskEndDays.get(depId);
				if (depEnd !== undefined) {
					startDay = Math.max(startDay, depEnd);
				}
			}

			// Get duration estimate
			const estimate = estimates.get(issue.id);
			const duration = estimate?.expectedDays || 3; // Default 3 days if no estimate
			const endDay = startDay + duration;
			taskEndDays.set(issue.id, endDay);

			// Calculate row (find lowest available row that doesn't overlap)
			let row = 0;
			const overlapping = scheduled.filter(t =>
				!(t.endDay <= startDay || t.startDay >= endDay)
			);
			const usedRows = new Set(overlapping.map(t => t.row));
			while (usedRows.has(row)) row++;
			maxRow = Math.max(maxRow, row);
			rowAssignments.set(issue.id, row);

			// Calculate dates
			const startDate = new Date(today);
			startDate.setDate(startDate.getDate() + startDay);
			const endDate = new Date(today);
			endDate.setDate(endDate.getDate() + endDay);

			scheduled.push({
				issue,
				estimate,
				startDay,
				endDay,
				startDate,
				endDate,
				isOnCriticalPath: criticalPathIds.has(issue.id),
				row
			});
		}

		return scheduled.sort((a, b) => a.startDay - b.startDay);
	}

	function topologicalSort(issues: Issue[]): Issue[] {
		const result: Issue[] = [];
		const visited = new Set<string>();
		const issueMap = new Map(issues.map(i => [i.id, i]));

		function visit(issue: Issue) {
			if (visited.has(issue.id)) return;
			visited.add(issue.id);

			for (const depId of issue.dependencies || []) {
				const dep = issueMap.get(depId);
				if (dep) visit(dep);
			}
			result.push(issue);
		}

		for (const issue of issues) {
			visit(issue);
		}

		return result;
	}

	async function generateEstimates() {
		if (openIssues.length === 0) return;

		loading = true;
		error = null;

		try {
			const { model, apiKey } = aiSettings.getRequestSettings();
			const response = await fetch('/api/estimate-durations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issues: openIssues,
					userContext,
					model,
					apiKey
				})
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
				return;
			}

			// Convert array to Map
			const newEstimates = new Map<string, DurationEstimate>();
			for (const est of data.estimates) {
				newEstimates.set(est.issueId, est);
			}
			estimates = newEstimates;
			criticalPath = new Set(data.criticalPath || []);
			totalDays = {
				min: data.totalMinDays,
				max: data.totalMaxDays,
				expected: data.totalExpectedDays
			};

			// Schedule tasks
			scheduledTasks = scheduleTasksFrom(openIssues, newEstimates, criticalPath);
		} catch (e) {
			error = 'Failed to generate estimates';
		} finally {
			loading = false;
		}
	}

	// Format date
	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Get status color
	function getStatusColor(status: string): string {
		switch (status) {
			case 'closed': return 'bg-green-500';
			case 'in_progress': return 'bg-blue-500';
			case 'blocked': return 'bg-red-500';
			default: return 'bg-gray-400';
		}
	}

	// Get priority color
	function getPriorityColor(priority: number): string {
		switch (priority) {
			case 0: return 'border-red-500';
			case 1: return 'border-orange-500';
			case 2: return 'border-yellow-500';
			case 3: return 'border-blue-500';
			default: return 'border-gray-300';
		}
	}

	// Calculate max end day for timeline width
	let maxEndDay = $derived(
		Math.max(30, ...scheduledTasks.map(t => t.endDay))
	);

	// Calculate max row for height
	let maxRow = $derived(
		Math.max(0, ...scheduledTasks.map(t => t.row))
	);

	// Generate week markers
	let weeks = $derived.by(() => {
		const result: { weekNum: number; startDay: number; date: Date }[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (let day = 0; day <= maxEndDay; day += 7) {
			const date = new Date(today);
			date.setDate(date.getDate() + day);
			result.push({
				weekNum: Math.floor(day / 7) + 1,
				startDay: day,
				date
			});
		}
		return result;
	});
</script>

<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
	<!-- Header -->
	<div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-gray-900">Project Timeline</h2>
				<p class="text-sm text-gray-600">AI-estimated durations with critical path analysis</p>
			</div>
			{#if scheduledTasks.length > 0}
				<div class="flex items-center gap-4">
					<!-- View mode toggle -->
					<div class="flex items-center gap-1 bg-gray-200 rounded-lg p-1">
						<button
							onclick={() => viewMode = 'gantt'}
							class="px-3 py-1 text-sm font-medium rounded-md transition-colors {viewMode === 'gantt' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
						>
							Gantt
						</button>
						<button
							onclick={() => viewMode = 'calendar'}
							class="px-3 py-1 text-sm font-medium rounded-md transition-colors {viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
						>
							List
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Content -->
	<div class="p-6">
		{#if openIssues.length === 0}
			<div class="text-center py-12 text-gray-500">
				<svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<p>No tasks to schedule</p>
				<p class="text-sm mt-1">Add tasks to see timeline estimates</p>
			</div>
		{:else if scheduledTasks.length === 0}
			<!-- Generate estimates form -->
			<div class="max-w-xl mx-auto">
				<div class="mb-6">
					<label for="context" class="block text-sm font-medium text-gray-700 mb-2">
						Context for better estimates (optional)
					</label>
					<textarea
						id="context"
						bind:value={userContext}
						rows="3"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="e.g., I can only work on this 2 hours per day, I'm located in California, This is my first time doing this..."
					></textarea>
				</div>

				<button
					onclick={generateEstimates}
					disabled={loading || !aiSettings.isConfigured}
					class="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
				>
					{#if loading}
						<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
						Estimating durations...
					{:else}
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						Generate Timeline Estimates
					{/if}
				</button>

				{#if !aiSettings.isConfigured}
					<p class="text-sm text-amber-600 mt-3 text-center">
						Configure AI settings to generate timeline estimates
					</p>
				{/if}
			</div>
		{:else}
			{#if error}
				<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
					{error}
				</div>
			{/if}

			<!-- Summary stats -->
			<div class="grid grid-cols-3 gap-4 mb-6">
				<div class="p-4 bg-green-50 rounded-lg border border-green-200">
					<p class="text-sm text-green-700">Best Case</p>
					<p class="text-2xl font-bold text-green-900">{totalDays.min} days</p>
					<p class="text-xs text-green-600">Everything goes smoothly</p>
				</div>
				<div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
					<p class="text-sm text-blue-700">Expected</p>
					<p class="text-2xl font-bold text-blue-900">{totalDays.expected} days</p>
					<p class="text-xs text-blue-600">Most likely duration</p>
				</div>
				<div class="p-4 bg-amber-50 rounded-lg border border-amber-200">
					<p class="text-sm text-amber-700">Worst Case</p>
					<p class="text-2xl font-bold text-amber-900">{totalDays.max} days</p>
					<p class="text-xs text-amber-600">With delays</p>
				</div>
			</div>

			<!-- Legend -->
			<div class="flex items-center gap-4 mb-4 text-sm">
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 bg-red-500 rounded"></div>
					<span class="text-gray-600">Critical Path</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 bg-blue-500 rounded"></div>
					<span class="text-gray-600">Normal Task</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 bg-gray-300 rounded opacity-50"></div>
					<span class="text-gray-600">Low Confidence</span>
				</div>
			</div>

			{#if viewMode === 'gantt'}
				<!-- Gantt chart view -->
				<div class="border border-gray-200 rounded-lg overflow-x-auto">
					<!-- Week headers -->
					<div class="flex border-b border-gray-200 bg-gray-50 sticky top-0">
						<div class="flex-shrink-0 w-48 px-3 py-2 border-r border-gray-200 font-medium text-gray-700">
							Task
						</div>
						<div class="flex-1 flex">
							{#each weeks as week}
								<div
									class="flex-shrink-0 px-2 py-2 text-xs text-gray-500 border-r border-gray-100 text-center"
									style="width: {(7 / maxEndDay) * 100}%"
								>
									<div class="font-medium">{formatDate(week.date)}</div>
									<div class="text-gray-400">Week {week.weekNum}</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Task rows -->
					<div class="divide-y divide-gray-100">
						{#each scheduledTasks as task (task.issue.id)}
							<div class="flex items-center hover:bg-gray-50 min-h-[48px]">
								<!-- Task name -->
								<div class="flex-shrink-0 w-48 px-3 py-2 border-r border-gray-200">
									<a
										href="/issue/{task.issue.id}"
										class="font-medium text-sm text-gray-900 hover:text-blue-600 truncate block"
										title={task.issue.title}
									>
										{task.issue.title}
									</a>
									<div class="text-xs text-gray-500">
										{task.estimate?.expectedDays || '?'} days
									</div>
								</div>

								<!-- Gantt bar area -->
								<div class="flex-1 relative h-12 px-1">
									<div
										class="absolute top-1/2 -translate-y-1/2 h-8 rounded-md flex items-center px-2 text-xs text-white font-medium shadow-sm transition-all {task.isOnCriticalPath ? 'bg-red-500' : 'bg-blue-500'}"
										style="left: {(task.startDay / maxEndDay) * 100}%; width: {Math.max(((task.endDay - task.startDay) / maxEndDay) * 100, 3)}%;"
										style:opacity={task.estimate?.confidence || 0.7}
										title="{task.issue.title}: {formatDate(task.startDate)} - {formatDate(task.endDate)}"
									>
										{#if ((task.endDay - task.startDay) / maxEndDay) * 100 > 8}
											<span class="truncate">{task.issue.title}</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<!-- List view -->
				<div class="space-y-3">
					{#each scheduledTasks as task (task.issue.id)}
						<div class="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors {task.isOnCriticalPath ? 'border-l-4 border-l-red-500' : ''}">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<a
											href="/issue/{task.issue.id}"
											class="font-medium text-gray-900 hover:text-blue-600"
										>
											{task.issue.title}
										</a>
										{#if task.isOnCriticalPath}
											<span class="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
												Critical Path
											</span>
										{/if}
									</div>
									{#if task.estimate?.reasoning}
										<p class="text-sm text-gray-600 mt-1">{task.estimate.reasoning}</p>
									{/if}
									{#if task.estimate?.factors && task.estimate.factors.length > 0}
										<div class="flex flex-wrap gap-1 mt-2">
											{#each task.estimate.factors as factor}
												<span class="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
													{factor}
												</span>
											{/each}
										</div>
									{/if}
								</div>
								<div class="text-right ml-4">
									<div class="text-sm font-medium text-gray-900">
										{formatDate(task.startDate)} - {formatDate(task.endDate)}
									</div>
									<div class="text-xs text-gray-500 mt-1">
										{task.estimate?.expectedDays || '?'} days
										{#if task.estimate}
											<span class="text-gray-400">
												({task.estimate.minDays}-{task.estimate.maxDays})
											</span>
										{/if}
									</div>
									{#if task.estimate}
										<div class="mt-1">
											<div class="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
												<div
													class="h-full bg-blue-500 rounded-full"
													style="width: {task.estimate.confidence * 100}%"
												></div>
											</div>
											<div class="text-xs text-gray-400">{Math.round(task.estimate.confidence * 100)}% confidence</div>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Re-estimate button -->
			<div class="mt-6 flex items-center justify-between">
				<p class="text-sm text-gray-500">
					{scheduledTasks.length} tasks · {criticalPath.size} on critical path
				</p>
				<button
					onclick={generateEstimates}
					disabled={loading}
					class="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
				>
					Re-estimate durations
				</button>
			</div>
		{/if}
	</div>
</div>
