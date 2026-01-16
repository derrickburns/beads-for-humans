import type { RequestHandler } from './$types';
import type { ExecutionType, IssuePriority, IssueType } from '$lib/types/issue';
import { chatCompletionStream } from '$lib/ai/provider';

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

const systemPrompt = `You are an expert project planner who helps non-experts plan complex, once-in-a-lifetime projects like selling a house, planning a kitchen remodel, choosing a school for children, or navigating pension/retirement decisions.

Your role is to be the "expert advisor" that users would otherwise need to hire - a general contractor, financial planner, or consultant.

## OUTCOME-ORIENTED TASK DESIGN

CRITICAL: Each task must describe a REAL-WORLD OUTCOME, not an activity.

BAD (activity-focused):
- "Research contractors" - vague, no clear done state
- "Call the bank" - describes action, not result
- "Work on budget" - endless activity

GOOD (outcome-focused):
- "Have 3 vetted contractor quotes with references checked" - clear deliverable
- "Have pre-approval letter from lender with max amount confirmed" - verifiable result
- "Have itemized budget with contingency approved by spouse" - specific done state

For each task, ask: "How will I know this is DONE?" The title should answer that question.

## MINIMUM VIABLE BREAKDOWN

Break the project into the MINIMUM set of concrete subtasks required to guarantee the outcome:
- If a subtask doesn't directly contribute to the goal, remove it
- If two subtasks can be combined without losing clarity, combine them
- Each subtask must have a clear "done" state that can be verified

## DEPENDENCY DESIGN

Dependencies should form a directed acyclic graph where:
- "dependsOn" lists tasks that MUST be completed before this task can start
- Think: "What would make it impossible or pointless to start this task?"
- Prefer shallow dependency chains - many tasks can often run in parallel
- Avoid over-sequencing: tasks only depend on what they truly need

## EXECUTION TYPES

Be thoughtful about who does each task:
- "automated": AI can fully complete (research, comparison, drafting)
- "human": Only the user can do this (physical actions, legal signatures, decisions)
- "ai_assisted": AI does the work, user verifies (document drafting, research synthesis)
- "human_assisted": User does it with AI guidance (negotiations, interviews)

## VALIDATION REQUIRED

Flag these situations for expert review:
- Legal contracts or documents
- Financial decisions over $1000
- Safety-related decisions (construction, electrical, etc.)
- Medical or health decisions
- Irreversible decisions

## OUTPUT FORMAT

Respond with valid JSON:
{
  "summary": "Brief overview of the project plan",
  "tasks": [
    {
      "id": "task-1",
      "title": "Outcome-focused task title (what 'done' looks like)",
      "description": "What needs to be done and why",
      "type": "task|bug|feature",
      "priority": 0-4,
      "executionType": "automated|human|ai_assisted|human_assisted",
      "validationRequired": true|false,
      "executionReason": "Why this execution type was chosen",
      "dependsOn": ["task-ids this task is blocked by"],
      "category": "legal|financial|physical|research|administrative|decision",
      "estimatedDuration": "2-3 days",
      "expertNeeded": "Type of expert if validation required"
    }
  ],
  "risks": [
    {
      "title": "Risk title",
      "description": "What could go wrong",
      "severity": "high|medium|low",
      "mitigation": "How to prevent or handle this",
      "relatedTasks": ["task-ids"]
    }
  ],
  "validationCheckpoints": ["task-ids that are critical checkpoints"],
  "estimatedTotalDuration": "Overall timeline estimate",
  "budgetConsiderations": ["Key cost factors to consider"],
  "questionsForUser": ["Clarifying questions if needed"]
}

Priority levels: 0=Critical (blocking), 1=High, 2=Medium, 3=Low, 4=Backlog
Be thorough but practical. Aim for 10-25 tasks for most projects.`;

export const POST: RequestHandler = async ({ request }) => {
	const { projectGoal, context, model, apiKey } = (await request.json()) as {
		projectGoal: string;
		context?: string;
		model?: string;
		apiKey?: string;
	};

	if (!projectGoal || projectGoal.trim().length < 10) {
		return new Response(
			JSON.stringify({ error: 'Please provide a more detailed project description' }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	const userMessage = context
		? `Project: ${projectGoal}\n\nAdditional context: ${context}`
		: `Project: ${projectGoal}`;

	const planningModel = model || 'anthropic/claude-sonnet-4';

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			// Send initial progress
			send('progress', { phase: 'starting', message: 'Analyzing your project...' });

			let fullContent = '';
			let thinkingContent = '';
			let lastProgressUpdate = Date.now();
			const progressMessages = [
				'Understanding project scope...',
				'Identifying key milestones...',
				'Breaking down into tasks...',
				'Analyzing dependencies...',
				'Assessing risks...',
				'Finalizing plan...'
			];
			let progressIndex = 0;

			try {
				const streamGenerator = chatCompletionStream({
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userMessage }
					],
					maxTokens: 4000,
					model: planningModel,
					apiKey,
					extendedThinking: true,
					thinkingBudget: 8000
				});

				for await (const chunk of streamGenerator) {
					if (chunk.type === 'thinking') {
						thinkingContent += chunk.data;
						// Send thinking progress periodically
						const now = Date.now();
						if (now - lastProgressUpdate > 2000) {
							lastProgressUpdate = now;
							progressIndex = Math.min(progressIndex + 1, progressMessages.length - 1);
							send('progress', {
								phase: 'thinking',
								message: progressMessages[progressIndex],
								thinkingPreview: thinkingContent.slice(-200)
							});
						}
					} else if (chunk.type === 'content') {
						fullContent += chunk.data;
						// Send content chunks for live preview
						send('content', { chunk: chunk.data, accumulated: fullContent.length });
					} else if (chunk.type === 'error') {
						send('error', { message: chunk.data });
						controller.close();
						return;
					} else if (chunk.type === 'done') {
						// Parse and validate the final plan
						send('progress', { phase: 'parsing', message: 'Processing your plan...' });

						const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
						if (!jsonMatch) {
							send('error', { message: 'Failed to parse AI response' });
							controller.close();
							return;
						}

						try {
							const plan = JSON.parse(jsonMatch[0]) as ProjectPlan;

							if (!plan.tasks || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
								send('error', { message: 'AI did not generate any tasks' });
								controller.close();
								return;
							}

							// Normalize tasks
							plan.tasks = plan.tasks.map((task, index) => ({
								id: task.id || `task-${index + 1}`,
								title: task.title || 'Untitled Task',
								description: task.description || '',
								type: task.type || 'task',
								priority: typeof task.priority === 'number' ? task.priority : 2,
								executionType: task.executionType || 'human_assisted',
								validationRequired: task.validationRequired ?? false,
								executionReason: task.executionReason || '',
								dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
								category: task.category || 'administrative',
								estimatedDuration: task.estimatedDuration,
								expertNeeded: task.expertNeeded
							}));

							// Validate dependencies
							const taskIds = new Set(plan.tasks.map(t => t.id));
							plan.tasks = plan.tasks.map(task => ({
								...task,
								dependsOn: task.dependsOn.filter(id => taskIds.has(id))
							}));

							send('complete', { plan });
						} catch (parseError) {
							send('error', { message: 'Failed to parse plan structure' });
						}

						controller.close();
						return;
					}
				}

				// If we get here without done, close gracefully
				controller.close();
			} catch (error) {
				send('error', { message: String(error) });
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
