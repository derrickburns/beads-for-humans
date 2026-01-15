import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ExecutionType, IssuePriority, IssueType } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface DecomposedTask {
	id: string; // Temporary ID for dependency references
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
	executionType: ExecutionType;
	validationRequired: boolean;
	executionReason: string;
	dependsOn: string[]; // IDs of other tasks in this plan
	category: string; // Grouping: legal, financial, physical, etc.
	estimatedDuration?: string; // Human-readable: "2-3 days", "1 week"
	expertNeeded?: string; // If validation needed, what type of expert
}

interface Risk {
	title: string;
	description: string;
	severity: 'high' | 'medium' | 'low';
	mitigation: string;
	relatedTasks: string[]; // Task IDs this risk relates to
}

interface ProjectPlan {
	summary: string;
	tasks: DecomposedTask[];
	risks: Risk[];
	validationCheckpoints: string[]; // Task IDs that are critical checkpoints
	estimatedTotalDuration?: string;
	budgetConsiderations?: string[];
	questionsForUser?: string[]; // Things AI needs clarified
}

export const POST: RequestHandler = async ({ request }) => {
	const { projectGoal, context, model, apiKey } = (await request.json()) as {
		projectGoal: string;
		context?: string; // Additional context user provides
		model?: string;
		apiKey?: string;
	};

	if (!projectGoal || projectGoal.trim().length < 10) {
		return json({ error: 'Please provide a more detailed project description' });
	}

	const systemPrompt = `You are an expert project planner who helps non-experts plan complex, once-in-a-lifetime projects like selling a house, planning a kitchen remodel, choosing a school for children, or navigating pension/retirement decisions.

Your role is to be the "expert advisor" that users would otherwise need to hire - a general contractor, financial planner, or consultant. You must:

1. PROACTIVELY identify tasks users wouldn't think of
2. Surface risks and edge cases before they become problems
3. Identify when professional validation is REQUIRED (legal, safety, financial)
4. Be conservative about what AI can handle vs what needs human judgment
5. Consider the user's perspective - they're doing this for the first time

EXECUTION TYPES - Be thoughtful about who does each task:
- "automated": AI can fully complete (research, comparison, drafting)
- "human": Only the user can do this (physical actions, legal signatures, decisions)
- "ai_assisted": AI does the work, user verifies (document drafting, research synthesis)
- "human_assisted": User does it with AI guidance (negotiations, interviews)

VALIDATION REQUIRED - Flag these situations:
- Legal contracts or documents
- Financial decisions over $1000
- Safety-related decisions (construction, electrical, etc.)
- Medical or health decisions
- Irreversible decisions

OUTPUT FORMAT - Respond with valid JSON:
{
  "summary": "Brief overview of the project plan",
  "tasks": [
    {
      "id": "task-1",
      "title": "Clear, actionable task title",
      "description": "What needs to be done and why",
      "type": "task|bug|feature",
      "priority": 0-4,
      "executionType": "automated|human|ai_assisted|human_assisted",
      "validationRequired": true|false,
      "executionReason": "Why this execution type was chosen",
      "dependsOn": ["task-id-1", "task-id-2"],
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

	const userMessage = context
		? `Project: ${projectGoal}\n\nAdditional context: ${context}`
		: `Project: ${projectGoal}`;

	try {
		const result = await chatCompletion({
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage }
			],
			maxTokens: 4000,
			model: model || 'anthropic/claude-sonnet-4',
			apiKey
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to decompose project. Please try again.' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({
				error: 'Failed to parse AI response',
				rawResponse: result.content
			});
		}

		const plan = JSON.parse(jsonMatch[0]) as ProjectPlan;

		// Validate the plan structure
		if (!plan.tasks || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
			return json({ error: 'AI did not generate any tasks' });
		}

		// Ensure all tasks have required fields with defaults
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

		// Validate dependencies (remove references to non-existent tasks)
		const taskIds = new Set(plan.tasks.map(t => t.id));
		plan.tasks = plan.tasks.map(task => ({
			...task,
			dependsOn: task.dependsOn.filter(id => taskIds.has(id))
		}));

		return json({ plan });
	} catch (error) {
		console.error('Error decomposing project:', error);
		return json({ error: 'Failed to process project. Please try again.' });
	}
};
