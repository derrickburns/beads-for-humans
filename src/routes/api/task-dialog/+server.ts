import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority, ScopeBoundary, Constraint, Concern } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface DialogMessage {
	role: 'user' | 'assistant';
	content: string;
}

interface IssueRef {
	id: string;
	title: string;
	type?: string;
	status?: string;
	decompositionType?: string;
}

interface ConstraintRef {
	type: string;
	description: string;
	value?: string | number;
	unit?: string;
}

interface ConcernRef {
	type: string;
	title: string;
	status: string;
}

interface RelatedDialogRef {
	issueId: string;
	issueTitle: string;
	relationship: 'parent' | 'sibling' | 'child' | 'blocker';
	messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
}

interface RichContext {
	// Hierarchy
	ancestors: IssueRef[];
	parent: IssueRef | null;
	siblings: IssueRef[];
	children: IssueRef[];

	// Dependencies
	blockedBy: IssueRef[];
	blocks: IssueRef[];

	// Constraints & Scope
	constraints: ConstraintRef[];
	scopeBoundary: ScopeBoundary | null;
	successCriteria: string[];

	// Concerns
	existingConcerns: ConcernRef[];

	// Project
	projectIssues: IssueRef[];

	// Related dialog history - the AI's long-term memory from related tasks
	relatedDialogs?: RelatedDialogRef[];
}

interface SuggestedAction {
	type: 'update_task' | 'create_subtask' | 'mark_complete' | 'add_dependency' | 'add_concern' | 'ask_question' | 'update_scope' | 'add_constraint';
	description: string;
	data?: {
		title?: string;
		description?: string;
		type?: IssueType;
		priority?: IssuePriority;
		status?: string;
		concernType?: string;
		question?: string;
		constraintType?: string;
		scopeUpdate?: Partial<ScopeBoundary>;
	};
}

interface UrlContent {
	url: string;
	content: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { task, message, history, context, urlContents, model, apiKey } = (await request.json()) as {
		task: Issue;
		message: string;
		history: DialogMessage[];
		context: RichContext;
		urlContents?: UrlContent[];
		model?: string;
		apiKey?: string;
	};

	// Build the rich context section
	const contextSections: string[] = [];

	// Current task
	contextSections.push(`## Current Task
- Title: "${task.title}"
- Description: ${task.description || 'No description yet'}
- Type: ${task.type}
- Priority: P${task.priority}
- Status: ${task.status}
${task.successCriteria?.length ? `- Success Criteria:\n${task.successCriteria.map(c => `  - ${c}`).join('\n')}` : ''}`);

	// Hierarchy context
	if (context.ancestors.length > 0) {
		const hierarchyPath = [...context.ancestors].reverse().map(a => a.title).join(' → ');
		contextSections.push(`## Hierarchy
This task is part of: ${hierarchyPath} → [Current Task]

${context.parent ? `Direct parent: "${context.parent.title}" (${context.parent.type}${context.parent.decompositionType ? `, ${context.parent.decompositionType} decomposition` : ''})` : ''}`);
	}

	// Siblings
	if (context.siblings.length > 0) {
		contextSections.push(`## Sibling Tasks (same level)
${context.siblings.map(s => `- "${s.title}" (${s.status})`).join('\n')}`);
	}

	// Children
	if (context.children.length > 0) {
		contextSections.push(`## Subtasks
${context.children.map(c => `- "${c.title}" (${c.status})`).join('\n')}`);
	}

	// Dependencies
	if (context.blockedBy.length > 0 || context.blocks.length > 0) {
		let depText = '## Dependencies\n';
		if (context.blockedBy.length > 0) {
			depText += `Blocked by (must complete first):\n${context.blockedBy.map(b => `- "${b.title}" (${b.status})`).join('\n')}\n`;
		}
		if (context.blocks.length > 0) {
			depText += `Blocks (waiting on this):\n${context.blocks.map(b => `- "${b.title}"`).join('\n')}`;
		}
		contextSections.push(depText);
	}

	// Constraints
	if (context.constraints.length > 0) {
		contextSections.push(`## Active Constraints
${context.constraints.map(c => `- ${c.type}: ${c.description}${c.value ? ` (${c.value}${c.unit || ''})` : ''}`).join('\n')}`);
	}

	// Scope boundary
	if (context.scopeBoundary) {
		let scopeText = '## Scope Boundary\n';
		if (context.scopeBoundary.includes.length > 0) {
			scopeText += `In scope: ${context.scopeBoundary.includes.join(', ')}\n`;
		}
		if (context.scopeBoundary.excludes.length > 0) {
			scopeText += `Out of scope: ${context.scopeBoundary.excludes.join(', ')}\n`;
		}
		if (context.scopeBoundary.boundaryConditions.length > 0) {
			scopeText += `Boundary rules: ${context.scopeBoundary.boundaryConditions.join('; ')}`;
		}
		contextSections.push(scopeText);
	}

	// Existing concerns
	if (context.existingConcerns.length > 0) {
		contextSections.push(`## Already Surfaced Concerns
${context.existingConcerns.map(c => `- [${c.status}] ${c.type}: ${c.title}`).join('\n')}`);
	}

	// Other project issues
	if (context.projectIssues.length > 0) {
		contextSections.push(`## Other Issues in Project
${context.projectIssues.map(i => `- "${i.title}" (${i.type}, ${i.status})`).join('\n')}`);
	}

	// Related dialog history - the AI's long-term memory from conversations on related tasks
	// CRITICAL: This is how you remember what was discussed on parent/sibling/blocker tasks
	// Never ask questions that have already been answered in these conversations
	if (context.relatedDialogs && context.relatedDialogs.length > 0) {
		const dialogSections = context.relatedDialogs.map(rd => {
			const messagesText = rd.messages.map(m =>
				`[${m.role === 'user' ? 'Human' : 'AI'}]: ${m.content}`
			).join('\n');
			return `### ${rd.relationship.toUpperCase()}: "${rd.issueTitle}"
${messagesText}`;
		}).join('\n\n');

		contextSections.push(`## Prior Conversations on Related Tasks
IMPORTANT: These are verbatim conversations from related tasks. Use this context to:
1. Never re-ask questions that were already answered
2. Build on information already gathered
3. Understand what the user has already shared

${dialogSections}`);
	}

	// URL contents shared by user
	if (urlContents && urlContents.length > 0) {
		contextSections.push(`## Web Content Shared by User
${urlContents.map(u => `### From: ${u.url}\n${u.content}`).join('\n\n')}`);
	}

	const systemPrompt = `You are a planning assistant helping a user work through a task. You have full context about this task's place in the project hierarchy.

${contextSections.join('\n\n')}

---

## Your Role
1. **Listen actively** - Understand what the user is telling you about their situation
2. **Connect the dots** - Relate what they share to the task hierarchy, dependencies, and constraints
3. **Suggest concrete actions** - Propose specific changes based on what you learn
4. **Bring domain knowledge** - Use your knowledge to suggest specific, likely items they may have forgotten
5. **Track progress** - Suggest marking things complete or creating subtasks as appropriate

## Guidelines

### Long-term Memory - NEVER Re-Ask
You are the user's long-term memory. You have access to ALL prior conversations on this task AND related tasks (parent, siblings, blockers).
- NEVER ask a question that has already been answered in any conversation
- ALWAYS build on information already gathered
- Reference what you know: "You mentioned you have Geico auto insurance..."
- If information seems incomplete, fill in gaps: "For homeowner's insurance, you haven't mentioned the provider yet - who is that through?"
- Treat the user as if they may have forgotten what they told you - remind them and extend

### Be Specific, Not Open-Ended
WRONG: "Do you have any other insurance policies?"
RIGHT: "Beyond auto insurance, most people also have: homeowner's/renter's insurance, health insurance, life insurance, and sometimes umbrella liability. Which of these do you have?"

Always enumerate specific, likely examples rather than asking open-ended questions. Use your domain knowledge to help users think comprehensively.

### General Guidelines
- Be conversational and collaborative, not interrogative
- When the user shares information, acknowledge it AND suggest the next specific thing to check
- If they mention something that affects blocking tasks, note the urgency
- If they reveal work that might be out of scope, ask whether to expand or constrain
- If they've essentially completed the task, suggest marking it done
- If complexity emerges, suggest breaking down into subtasks with specific names
- Keep responses concise (2-4 sentences) plus any suggested actions

### Domain Knowledge Examples
For insurance documentation: auto, home/renters, health, life, umbrella, disability, long-term care
For financial assets: checking, savings, 401k, IRA, brokerage, real estate, vehicles, valuables
For retirement planning: Social Security, pensions, annuities, required minimum distributions
For estate planning: will, trust, power of attorney, healthcare directive, beneficiary designations

Always suggest the SPECIFIC items relevant to the task context.

## Suggested Actions
After each response, if there are actionable suggestions, output them in this JSON format at the END of your response:

\`\`\`json
{
  "actions": [
    {
      "type": "update_task" | "create_subtask" | "mark_complete" | "add_dependency" | "add_concern" | "add_constraint" | "update_scope",
      "description": "Human-readable description",
      "data": { ... }
    }
  ]
}
\`\`\`

Action types:
- **update_task**: Update title or description with new information
- **create_subtask**: Create a child task (include title, description)
- **mark_complete**: Mark the current task as done
- **add_dependency**: Add a dependency on another task
- **add_concern**: Surface a risk, assumption, or gap (include concernType: "assumption" | "risk" | "gap")
- **add_constraint**: Add a budget, timeline, or scope constraint
- **update_scope**: Suggest adding to in-scope or out-of-scope lists

If no actions are needed (just conversation), omit the JSON block.`;

	const messages = [
		{ role: 'system' as const, content: systemPrompt },
		...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
		{ role: 'user' as const, content: message }
	];

	try {
		const result = await chatCompletion({
			messages,
			maxTokens: 1500,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			return json({ error: result.error || 'No response from AI' });
		}

		// Parse the response to extract actions
		const content = result.content;
		let responseText = content;
		let actions: SuggestedAction[] = [];

		// Look for JSON block at the end
		const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```\s*$/);
		if (jsonMatch) {
			try {
				const parsed = JSON.parse(jsonMatch[1]);
				actions = parsed.actions || [];
				// Remove the JSON block from the response text
				responseText = content.replace(/```json\s*[\s\S]*?\s*```\s*$/, '').trim();
			} catch {
				// JSON parse failed, keep the full response
			}
		}

		return json({
			response: responseText,
			actions
		});
	} catch (error) {
		console.error('Error in task dialog:', error);
		return json({ error: 'Failed to process message' });
	}
};
