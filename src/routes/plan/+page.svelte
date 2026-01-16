<script lang="ts">
	import { goto } from '$app/navigation';
	import { issueStore } from '$lib/stores/issues.svelte';
	import { PRIORITY_LABELS, TYPE_LABELS, EXECUTION_TYPE_LABELS } from '$lib/types/issue';
	import type { IssueType, IssuePriority, ExecutionType } from '$lib/types/issue';

	// Mode: 'choose' | 'project' | 'conversational'
	let mode = $state<'choose' | 'project' | 'conversational'>('choose');

	// ===== Project Decomposition State =====
	interface DecomposedTask {
		id: string;
		title: string;
		description: string;
		type: IssueType;
		priority: IssuePriority;
		executionType: ExecutionType;
		validationRequired: boolean;
		executionReason: string;
		dependsOn: string[];
		category: string;
		estimatedDuration?: string;
		expertNeeded?: string;
		selected: boolean; // User can deselect tasks
	}

	interface Risk {
		title: string;
		description: string;
		severity: 'high' | 'medium' | 'low';
		mitigation: string;
		relatedTasks: string[];
	}

	interface ProjectPlan {
		summary: string;
		tasks: DecomposedTask[];
		risks: Risk[];
		validationCheckpoints: string[];
		estimatedTotalDuration?: string;
		budgetConsiderations?: string[];
		questionsForUser?: string[];
	}

	let projectGoal = $state('');
	let projectContext = $state('');
	let projectLoading = $state(false);
	let projectError = $state<string | null>(null);
	let projectPlan = $state<ProjectPlan | null>(null);
	let creatingIssues = $state(false);

	// Streaming progress state
	let progressPhase = $state<string>('');
	let progressMessage = $state<string>('');
	let thinkingPreview = $state<string>('');
	let contentLength = $state<number>(0);

	// Group tasks by category
	let tasksByCategory = $derived.by(() => {
		if (!projectPlan) return new Map<string, DecomposedTask[]>();
		const groups = new Map<string, DecomposedTask[]>();
		for (const task of projectPlan.tasks) {
			const cat = task.category || 'other';
			if (!groups.has(cat)) groups.set(cat, []);
			groups.get(cat)!.push(task);
		}
		return groups;
	});

	let selectedTaskCount = $derived(
		projectPlan?.tasks.filter(t => t.selected).length ?? 0
	);

	async function decomposeProject() {
		if (!projectGoal.trim() || projectLoading) return;

		projectLoading = true;
		projectError = null;
		progressPhase = 'starting';
		progressMessage = 'Connecting...';
		thinkingPreview = '';
		contentLength = 0;

		try {
			const response = await fetch('/api/decompose-project-stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectGoal: projectGoal.trim(),
					context: projectContext.trim() || undefined
				})
			});

			if (!response.ok) {
				const data = await response.json();
				projectError = data.error || 'Failed to start planning';
				projectLoading = false;
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) {
				projectError = 'No response stream available';
				projectLoading = false;
				return;
			}

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n\n');
				buffer = lines.pop() || '';

				for (const block of lines) {
					if (!block.trim()) continue;

					const eventMatch = block.match(/^event: (\w+)\ndata: (.+)$/s);
					if (!eventMatch) continue;

					const [, eventType, dataStr] = eventMatch;

					try {
						const data = JSON.parse(dataStr);

						switch (eventType) {
							case 'progress':
								progressPhase = data.phase;
								progressMessage = data.message;
								if (data.thinkingPreview) {
									thinkingPreview = data.thinkingPreview;
								}
								break;

							case 'content':
								contentLength = data.accumulated;
								progressPhase = 'generating';
								progressMessage = 'Generating plan...';
								break;

							case 'complete':
								if (data.plan) {
									projectPlan = {
										...data.plan,
										tasks: data.plan.tasks.map((t: DecomposedTask) => ({ ...t, selected: true }))
									};
								}
								projectLoading = false;
								return;

							case 'error':
								projectError = data.message;
								projectLoading = false;
								return;
						}
					} catch {
						// Ignore parse errors
					}
				}
			}

			// Stream ended without complete event
			if (!projectPlan) {
				projectError = 'Stream ended unexpectedly';
			}
		} catch (e) {
			projectError = 'Failed to analyze project. Please try again.';
		} finally {
			projectLoading = false;
		}
	}

	function toggleTaskSelection(taskId: string) {
		if (!projectPlan) return;
		projectPlan = {
			...projectPlan,
			tasks: projectPlan.tasks.map(t =>
				t.id === taskId ? { ...t, selected: !t.selected } : t
			)
		};
	}

	function selectAll() {
		if (!projectPlan) return;
		projectPlan = {
			...projectPlan,
			tasks: projectPlan.tasks.map(t => ({ ...t, selected: true }))
		};
	}

	function deselectAll() {
		if (!projectPlan) return;
		projectPlan = {
			...projectPlan,
			tasks: projectPlan.tasks.map(t => ({ ...t, selected: false }))
		};
	}

	async function createSelectedIssues() {
		if (!projectPlan || creatingIssues) return;

		const selectedTasks = projectPlan.tasks.filter(t => t.selected);
		if (selectedTasks.length === 0) return;

		creatingIssues = true;

		// Create a mapping from temporary IDs to real IDs
		const idMap = new Map<string, string>();

		// Create issues in dependency order (tasks with no deps first)
		const created: string[] = [];
		const remaining = [...selectedTasks];

		while (remaining.length > 0) {
			// Find tasks whose dependencies are all created (or not selected)
			const batch = remaining.filter(task => {
				const selectedDeps = task.dependsOn.filter(depId =>
					selectedTasks.some(t => t.id === depId)
				);
				return selectedDeps.every(depId => idMap.has(depId));
			});

			if (batch.length === 0 && remaining.length > 0) {
				// Circular dependency or missing - create remaining without deps
				for (const task of remaining) {
					const issue = issueStore.create({
						title: task.title,
						description: task.description,
						type: task.type,
						priority: task.priority,
						executionType: task.executionType,
						validationRequired: task.validationRequired,
						executionReason: task.executionReason,
						dependencies: []
					});
					if (issue) {
						idMap.set(task.id, issue.id);
						created.push(issue.id);
					}
				}
				break;
			}

			for (const task of batch) {
				// Map dependencies to real IDs
				const realDeps = task.dependsOn
					.filter(depId => idMap.has(depId))
					.map(depId => idMap.get(depId)!);

				const issue = issueStore.create({
					title: task.title,
					description: task.description,
					type: task.type,
					priority: task.priority,
					executionType: task.executionType,
					validationRequired: task.validationRequired,
					executionReason: task.executionReason,
					dependencies: realDeps
				});

				if (issue) {
					idMap.set(task.id, issue.id);
					created.push(issue.id);
				}

				// Remove from remaining
				const idx = remaining.findIndex(t => t.id === task.id);
				if (idx >= 0) remaining.splice(idx, 1);
			}
		}

		creatingIssues = false;

		// Navigate to main page
		goto('/?created=' + created.length);
	}

	// ===== Conversational Planning State =====
	interface Message {
		role: 'user' | 'assistant';
		content: string;
		suggestion?: TaskSuggestion;
		relatedIssues?: RelatedIssue[];
		followUpQuestions?: string[];
		created?: boolean;
	}

	interface TaskSuggestion {
		title: string;
		description: string;
		type: IssueType;
		priority: IssuePriority;
		dependsOn: string[];
		confidence: number;
	}

	interface RelatedIssue {
		id: string;
		title: string;
		similarity: string;
	}

	let messages = $state<Message[]>([]);
	let inputText = $state('');
	let loading = $state(false);
	let createdInSession = $state<string[]>([]);

	// Start with a welcome message when entering conversational mode
	$effect(() => {
		if (mode === 'conversational' && messages.length === 0) {
			messages = [{
				role: 'assistant',
				content: 'What task do you need to add? I\'ll help you break it down and connect it to your existing plan.',
				followUpQuestions: ['Add a new task', 'Help me think through something', 'What should I work on next?']
			}];
		}
	});

	async function sendMessage(text: string) {
		if (!text.trim() || loading) return;

		messages = [...messages, { role: 'user', content: text }];
		inputText = '';
		loading = true;

		try {
			const response = await fetch('/api/plan-assistant', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: messages.map(m => ({ role: m.role, content: m.content })),
					existingIssues: issueStore.issues,
					createdInSession
				})
			});

			const data = await response.json();

			if (data.error) {
				messages = [...messages, {
					role: 'assistant',
					content: `Sorry, I encountered an error: ${data.error}`,
					followUpQuestions: ['Try again', 'Start over']
				}];
			} else if (data.response) {
				const resp = data.response;
				messages = [...messages, {
					role: 'assistant',
					content: resp.message,
					suggestion: resp.suggestion,
					relatedIssues: resp.relatedIssues,
					followUpQuestions: resp.followUpQuestions
				}];
			}
		} catch {
			messages = [...messages, {
				role: 'assistant',
				content: 'Sorry, something went wrong. Please try again.',
				followUpQuestions: ['Try again']
			}];
		} finally {
			loading = false;
			setTimeout(() => {
				const container = document.getElementById('chat-container');
				if (container) container.scrollTop = container.scrollHeight;
			}, 100);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage(inputText);
		}
	}

	function acceptSuggestion(messageIndex: number) {
		const msg = messages[messageIndex];
		if (!msg.suggestion || msg.created) return; // Guard against double-clicks

		// Immediately mark as created to prevent duplicate clicks
		messages = messages.map((m, i) =>
			i === messageIndex ? { ...m, created: true } : m
		);

		const created = issueStore.create({
			title: msg.suggestion.title,
			description: msg.suggestion.description,
			type: msg.suggestion.type,
			priority: msg.suggestion.priority,
			dependencies: msg.suggestion.dependsOn
		});

		if (created) {
			createdInSession = [...createdInSession, msg.suggestion.title];
			sendMessage('Done, I accepted that task. What\'s next?');
		}
	}

	function skipSuggestion() {
		sendMessage('Skip this one, suggest something else.');
	}

	function modifySuggestion(messageIndex: number) {
		const msg = messages[messageIndex];
		if (!msg.suggestion) return;
		inputText = `I want to modify this: "${msg.suggestion.title}" - `;
	}

	const priorityColors: Record<number, string> = {
		0: 'bg-red-100 text-red-800 border-red-200',
		1: 'bg-orange-100 text-orange-800 border-orange-200',
		2: 'bg-yellow-100 text-yellow-800 border-yellow-200',
		3: 'bg-blue-100 text-blue-800 border-blue-200',
		4: 'bg-gray-100 text-gray-600 border-gray-200'
	};

	const executionColors: Record<ExecutionType, string> = {
		automated: 'bg-emerald-100 text-emerald-800',
		human: 'bg-rose-100 text-rose-800',
		ai_assisted: 'bg-sky-100 text-sky-800',
		human_assisted: 'bg-violet-100 text-violet-800'
	};

	const categoryLabels: Record<string, string> = {
		legal: 'Legal & Contracts',
		financial: 'Financial',
		physical: 'Physical Tasks',
		research: 'Research',
		administrative: 'Administrative',
		decision: 'Decisions',
		other: 'Other'
	};

	const severityColors: Record<string, string> = {
		high: 'bg-red-100 text-red-800 border-red-300',
		medium: 'bg-amber-100 text-amber-800 border-amber-300',
		low: 'bg-blue-100 text-blue-800 border-blue-300'
	};
</script>

<svelte:head>
	<title>Plan Your Project - Middle Manager</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<div class="mb-6">
		<a href="/" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Tasks
		</a>
	</div>

	{#if mode === 'choose'}
		<!-- Mode Selection -->
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Plan Your Project</h1>
			<p class="text-gray-600">Let AI help you break down your project into actionable tasks</p>
		</div>

		<div class="grid md:grid-cols-2 gap-6">
			<!-- Start a New Project -->
			<button
				onclick={() => { mode = 'project'; }}
				class="p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all text-left group"
			>
				<div class="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
					<svg class="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
					</svg>
				</div>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">Start a New Project</h2>
				<p class="text-gray-600 mb-4">
					Describe your goal and I'll create a complete plan with tasks, dependencies, and checkpoints.
				</p>
				<div class="text-sm text-gray-500">
					<span class="font-medium">Best for:</span> New projects like selling a house, kitchen remodel, retirement planning
				</div>
			</button>

			<!-- Add Individual Tasks -->
			<button
				onclick={() => { mode = 'conversational'; }}
				class="p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all text-left group"
			>
				<div class="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
					<svg class="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
					</svg>
				</div>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">Add Tasks Interactively</h2>
				<p class="text-gray-600 mb-4">
					Chat with AI to add tasks one at a time. Great for refining an existing plan.
				</p>
				<div class="text-sm text-gray-500">
					<span class="font-medium">Best for:</span> Adding to existing plans, quick task capture
				</div>
			</button>
		</div>

		<!-- Example Projects -->
		<div class="mt-12">
			<h3 class="text-lg font-medium text-gray-900 mb-4 text-center">Example Projects People Plan</h3>
			<div class="flex flex-wrap justify-center gap-3">
				{#each ['Sell my house', 'Kitchen remodel', 'Choose a school for my child', 'Plan retirement', 'Start a small business', 'Plan a wedding'] as example}
					<button
						onclick={() => { mode = 'project'; projectGoal = example; }}
						class="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors text-sm"
					>
						{example}
					</button>
				{/each}
			</div>
		</div>

	{:else if mode === 'project'}
		<!-- Project Decomposition Mode -->
		{#if !projectPlan}
			<!-- Input Form -->
			<div class="bg-white rounded-2xl border border-gray-200 p-8">
				<div class="flex items-center justify-between mb-6">
					<div>
						<h1 class="text-2xl font-semibold text-gray-900">Start a New Project</h1>
						<p class="text-gray-500 text-sm mt-1">Describe your goal and I'll create a complete plan</p>
					</div>
					<button
						onclick={() => { mode = 'choose'; projectGoal = ''; projectContext = ''; }}
						class="text-sm text-gray-500 hover:text-gray-700"
					>
						← Back
					</button>
				</div>

				<div class="space-y-6">
					<div>
						<label for="goal" class="block text-sm font-medium text-gray-700 mb-2">
							What do you want to accomplish?
						</label>
						<input
							id="goal"
							type="text"
							bind:value={projectGoal}
							placeholder="e.g., Sell my house, Plan a kitchen remodel, Choose a school for my child"
							class="w-full px-4 py-3 text-lg bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>

					<div>
						<label for="context" class="block text-sm font-medium text-gray-700 mb-2">
							Any additional context? <span class="text-gray-400">(optional)</span>
						</label>
						<textarea
							id="context"
							bind:value={projectContext}
							placeholder="e.g., Timeline, budget, location, specific concerns..."
							rows="3"
							class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
						></textarea>
					</div>

					{#if projectError}
						<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
							{projectError}
						</div>
					{/if}

					{#if projectLoading}
						<!-- Progress Display -->
						<div class="w-full p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
							<div class="flex items-center gap-4 mb-4">
								<div class="relative">
									<div class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
									<div class="absolute inset-0 flex items-center justify-center">
										<svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
										</svg>
									</div>
								</div>
								<div class="flex-1">
									<p class="text-lg font-semibold text-blue-900">{progressMessage}</p>
									<p class="text-sm text-blue-600">
										{#if progressPhase === 'thinking'}
											AI is reasoning through your project...
										{:else if progressPhase === 'generating'}
											Building your task list ({contentLength.toLocaleString()} chars)
										{:else if progressPhase === 'parsing'}
											Organizing tasks and dependencies...
										{:else}
											Initializing AI planner...
										{/if}
									</p>
								</div>
							</div>

							<!-- Progress Steps -->
							<div class="flex items-center gap-2 mb-4">
								{#each ['starting', 'thinking', 'generating', 'parsing'] as step, i}
									{@const isActive = step === progressPhase}
									{@const isPast = ['starting', 'thinking', 'generating', 'parsing'].indexOf(progressPhase) > i}
									<div class="flex-1">
										<div class="h-2 rounded-full {isPast ? 'bg-blue-600' : isActive ? 'bg-blue-400 animate-pulse' : 'bg-blue-200'}"></div>
									</div>
								{/each}
							</div>

							{#if thinkingPreview}
								<div class="mt-4 p-3 bg-white/60 rounded-lg border border-blue-100">
									<p class="text-xs font-medium text-blue-700 mb-1">AI is considering:</p>
									<p class="text-sm text-gray-600 italic line-clamp-2">{thinkingPreview}...</p>
								</div>
							{/if}

							<button
								onclick={() => { projectLoading = false; projectError = 'Cancelled by user'; }}
								class="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
							>
								Cancel
							</button>
						</div>
					{:else}
						<button
							onclick={decomposeProject}
							disabled={!projectGoal.trim()}
							class="w-full py-4 bg-blue-600 text-white text-lg font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							Create My Plan
						</button>
					{/if}
				</div>
			</div>

		{:else}
			<!-- Plan Review -->
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<div>
						<h1 class="text-2xl font-semibold text-gray-900">Your Project Plan</h1>
						<p class="text-gray-500">{projectPlan.summary}</p>
					</div>
					<button
						onclick={() => { projectPlan = null; }}
						class="text-sm text-gray-500 hover:text-gray-700"
					>
						← Start Over
					</button>
				</div>

				<!-- Stats Bar -->
				<div class="flex items-center gap-6 p-4 bg-white rounded-xl border border-gray-200">
					<div class="text-center">
						<div class="text-2xl font-bold text-gray-900">{projectPlan.tasks.length}</div>
						<div class="text-xs text-gray-500">Total Tasks</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold text-blue-600">{selectedTaskCount}</div>
						<div class="text-xs text-gray-500">Selected</div>
					</div>
					{#if projectPlan.estimatedTotalDuration}
						<div class="text-center">
							<div class="text-2xl font-bold text-gray-900">{projectPlan.estimatedTotalDuration}</div>
							<div class="text-xs text-gray-500">Est. Duration</div>
						</div>
					{/if}
					<div class="text-center">
						<div class="text-2xl font-bold text-amber-600">{projectPlan.risks.length}</div>
						<div class="text-xs text-gray-500">Risks Identified</div>
					</div>
					<div class="ml-auto flex items-center gap-2">
						<button onclick={selectAll} class="text-sm text-blue-600 hover:text-blue-800">Select All</button>
						<span class="text-gray-300">|</span>
						<button onclick={deselectAll} class="text-sm text-gray-500 hover:text-gray-700">Deselect All</button>
					</div>
				</div>

				<!-- Validation Checkpoints -->
				{#if projectPlan.validationCheckpoints && projectPlan.validationCheckpoints.length > 0}
					{@const checkpointTasks = projectPlan.tasks.filter(t => projectPlan?.validationCheckpoints?.includes(t.id))}
					{#if checkpointTasks.length > 0}
						<div class="p-4 bg-purple-50 border border-purple-200 rounded-xl">
							<div class="flex items-center gap-2 mb-3">
								<svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<h3 class="font-medium text-purple-900">Validation Checkpoints</h3>
							</div>
							<p class="text-sm text-purple-700 mb-3">
								These are critical milestones where you should stop and verify everything is on track before continuing.
							</p>
							<div class="space-y-2">
								{#each checkpointTasks as task, i}
									<div class="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
										<span class="flex-shrink-0 w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
											{i + 1}
										</span>
										<div class="flex-1">
											<span class="font-medium text-purple-900">{task.title}</span>
											{#if task.expertNeeded}
												<span class="ml-2 text-xs text-purple-600">({task.expertNeeded} review)</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				<!-- Questions for User -->
				{#if projectPlan.questionsForUser && projectPlan.questionsForUser.length > 0}
					<div class="p-4 bg-amber-50 border border-amber-200 rounded-xl">
						<h3 class="font-medium text-amber-900 mb-2">Questions to Consider</h3>
						<ul class="space-y-1 text-sm text-amber-800">
							{#each projectPlan.questionsForUser as question}
								<li class="flex items-start gap-2">
									<span class="text-amber-500 mt-0.5">?</span>
									{question}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Tasks by Category -->
				{#each [...tasksByCategory.entries()] as [category, tasks]}
					<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
						<div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
							<h3 class="font-medium text-gray-900">{categoryLabels[category] || category}</h3>
							<p class="text-xs text-gray-500">{tasks.filter(t => t.selected).length} of {tasks.length} selected</p>
						</div>
						<div class="divide-y divide-gray-100">
							{#each tasks as task}
								<div
									class="p-4 hover:bg-gray-50 transition-colors {task.selected ? '' : 'opacity-50'}"
								>
									<div class="flex items-start gap-3">
										<input
											type="checkbox"
											checked={task.selected}
											onchange={() => toggleTaskSelection(task.id)}
											class="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
										/>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 flex-wrap mb-1">
												<span class="text-xs font-medium px-2 py-0.5 rounded-full {executionColors[task.executionType]}">
													{EXECUTION_TYPE_LABELS[task.executionType]}
												</span>
												<span class="text-xs font-medium px-2 py-0.5 rounded-full {priorityColors[task.priority]}">
													P{task.priority}
												</span>
												{#if task.validationRequired}
													<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
														✓ Needs Verification
													</span>
												{/if}
												{#if task.estimatedDuration}
													<span class="text-xs text-gray-500">{task.estimatedDuration}</span>
												{/if}
											</div>
											<h4 class="font-medium text-gray-900">{task.title}</h4>
											{#if task.description}
												<p class="text-sm text-gray-600 mt-1">{task.description}</p>
											{/if}
											{#if task.expertNeeded}
												<p class="text-xs text-amber-600 mt-1">
													<span class="font-medium">Expert needed:</span> {task.expertNeeded}
												</p>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}

				<!-- Risks -->
				{#if projectPlan.risks.length > 0}
					<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
						<div class="px-4 py-3 bg-red-50 border-b border-red-100">
							<h3 class="font-medium text-red-900">Risks to Watch</h3>
							<p class="text-xs text-red-700">Things that could go wrong - plan for these</p>
						</div>
						<div class="divide-y divide-gray-100">
							{#each projectPlan.risks as risk}
								<div class="p-4">
									<div class="flex items-start gap-3">
										<span class="px-2 py-0.5 text-xs font-medium rounded {severityColors[risk.severity]}">
											{risk.severity}
										</span>
										<div class="flex-1">
											<h4 class="font-medium text-gray-900">{risk.title}</h4>
											<p class="text-sm text-gray-600 mt-1">{risk.description}</p>
											<p class="text-sm text-green-700 mt-2">
												<span class="font-medium">Mitigation:</span> {risk.mitigation}
											</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Budget Considerations -->
				{#if projectPlan.budgetConsiderations && projectPlan.budgetConsiderations.length > 0}
					<div class="p-4 bg-green-50 border border-green-200 rounded-xl">
						<h3 class="font-medium text-green-900 mb-2">Budget Considerations</h3>
						<ul class="space-y-1 text-sm text-green-800">
							{#each projectPlan.budgetConsiderations as item}
								<li class="flex items-start gap-2">
									<span class="text-green-500 mt-0.5">$</span>
									{item}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Create Issues Button -->
				<div class="sticky bottom-4 bg-white rounded-xl border border-gray-200 p-4 shadow-lg">
					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium text-gray-900">{selectedTaskCount} tasks selected</p>
							<p class="text-sm text-gray-500">Ready to add to your project</p>
						</div>
						<button
							onclick={createSelectedIssues}
							disabled={selectedTaskCount === 0 || creatingIssues}
							class="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
						>
							{#if creatingIssues}
								<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
								Creating...
							{:else}
								Create {selectedTaskCount} Tasks
							{/if}
						</button>
					</div>
				</div>
			</div>
		{/if}

	{:else if mode === 'conversational'}
		<!-- Conversational Mode -->
		<div class="flex flex-col h-[calc(100vh-12rem)]">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h1 class="text-2xl font-semibold text-gray-900">Add Tasks</h1>
					<p class="text-gray-500 text-sm">Interactive task planning</p>
				</div>
				<div class="flex items-center gap-4">
					{#if createdInSession.length > 0}
						<span class="text-sm text-green-600 font-medium">
							{createdInSession.length} task{createdInSession.length === 1 ? '' : 's'} created
						</span>
					{/if}
					<button
						onclick={() => { mode = 'choose'; messages = []; createdInSession = []; }}
						class="text-sm text-gray-500 hover:text-gray-700"
					>
						← Back
					</button>
				</div>
			</div>

			<!-- Chat Container -->
			<div
				id="chat-container"
				class="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-4 space-y-4"
			>
				{#each messages as msg, i}
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div class="max-w-[85%] {msg.role === 'user'
							? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3'
							: 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-3'}">

							<p class="whitespace-pre-wrap">{msg.content}</p>

							{#if msg.suggestion && msg.role === 'assistant'}
								<div class="mt-3 p-4 bg-white rounded-xl border {msg.created ? 'border-green-300 bg-green-50' : 'border-gray-200'} shadow-sm">
									{#if msg.created}
										<div class="flex items-center gap-2 text-green-600 mb-2">
											<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											<span class="text-sm font-medium">Created!</span>
										</div>
									{/if}
									<div class="flex items-center gap-2 mb-2">
										<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
											{TYPE_LABELS[msg.suggestion.type]}
										</span>
										<span class="text-xs font-medium px-2 py-0.5 rounded-full {priorityColors[msg.suggestion.priority]}">
											{PRIORITY_LABELS[msg.suggestion.priority]}
										</span>
									</div>
									<h4 class="font-semibold text-gray-900">{msg.suggestion.title}</h4>
									{#if msg.suggestion.description}
										<p class="text-sm text-gray-600 mt-1">{msg.suggestion.description}</p>
									{/if}

									{#if !msg.created}
										<div class="mt-3 flex items-center gap-2">
											<button
												onclick={() => acceptSuggestion(i)}
												class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
											>
												Accept
											</button>
											<button
												onclick={() => modifySuggestion(i)}
												class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
											>
												Modify
											</button>
											<button
												onclick={skipSuggestion}
												class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
											>
												Skip
											</button>
										</div>
									{/if}
								</div>
							{/if}

							{#if msg.followUpQuestions && msg.followUpQuestions.length > 0 && i === messages.length - 1 && msg.role === 'assistant' && !msg.suggestion}
								<div class="mt-3 flex flex-wrap gap-2">
									{#each msg.followUpQuestions as question}
										<button
											onclick={() => sendMessage(question)}
											disabled={loading}
											class="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
										>
											{question}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}

				{#if loading}
					<div class="flex justify-start">
						<div class="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
							<div class="flex items-center gap-2 text-gray-500">
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Input Area -->
			<div class="mt-4 bg-white rounded-xl border border-gray-200 p-3">
				<div class="flex items-end gap-3">
					<textarea
						bind:value={inputText}
						onkeydown={handleKeydown}
						placeholder="Describe what you need to do..."
						rows="2"
						disabled={loading}
						class="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none disabled:opacity-50"
					></textarea>
					<button
						onclick={() => sendMessage(inputText)}
						disabled={loading || !inputText.trim()}
						class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
