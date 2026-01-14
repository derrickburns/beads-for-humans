import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue } from '$lib/types/issue';
import type { GraphChatContext, GraphChatResponse, GraphAction, UnblockSuggestion } from '$lib/types/graphChat';
import { chatCompletion } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request }) => {
	const { message, context, issues, model } = (await request.json()) as {
		message: string;
		context: GraphChatContext;
		issues: Issue[];
		model?: string;
	};

	if (!message) {
		return json({ error: 'Missing message' }, { status: 400 });
	}

	// Build context about the current state
	const focusedIssue = context.focusedIssueId
		? issues.find((i) => i.id === context.focusedIssueId)
		: null;

	// Find blockers for focused issue
	const blockers = focusedIssue
		? issues.filter(
				(i) => focusedIssue.dependencies.includes(i.id) && i.status !== 'closed'
			)
		: [];

	// Calculate which blockers have most downstream impact
	const blockerImpacts = blockers.map((blocker) => {
		const dependents = issues.filter((i) =>
			getAllTransitiveDependents(blocker.id, issues).includes(i.id)
		);
		const priorityWeights = [4, 3, 2, 1.5, 1];
		const impact = dependents.reduce((sum, issue) => {
			return sum + priorityWeights[issue.priority];
		}, 0);
		return { blocker, impact };
	});

	const mostImpactfulBlocker = blockerImpacts.sort((a, b) => b.impact - a.impact)[0];

	// Build the graph description
	const graphDescription = issues
		.filter((i) => i.dependencies.length > 0 && i.status !== 'closed')
		.map((i) => {
			const depTitles = i.dependencies
				.map((depId) => issues.find((e) => e.id === depId)?.title || depId)
				.join(', ');
			return `  "${i.title}" [${i.status}] depends on: [${depTitles}]`;
		})
		.join('\n');

	// Get issues that need human attention
	const needsHumanIssues = issues.filter((i) => i.needsHuman && i.status !== 'closed');

	// Get AI-assigned issues
	const aiAssignedIssues = issues.filter((i) => i.aiAssignment && i.status !== 'closed');

	// Build conversation history for context
	const historyText =
		context.conversationHistory.length > 0
			? '\nRECENT CONVERSATION:\n' +
				context.conversationHistory
					.slice(-5)
					.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
					.join('\n')
			: '';

	const systemPrompt = `You are an AI planning assistant integrated into a dependency graph tool. Your goal is to help the user manage their tasks and dependencies effectively.

CURRENT STATE:
- Total issues: ${issues.length}
- Open issues: ${issues.filter((i) => i.status === 'open').length}
- In progress: ${issues.filter((i) => i.status === 'in_progress').length}
- AI-assigned issues: ${aiAssignedIssues.length}
- Issues needing human attention: ${needsHumanIssues.length}

OPEN ISSUES:
${issues
	.filter((i) => i.status !== 'closed')
	.map(
		(i) =>
			`- [${i.id}] "${i.title}" (P${i.priority}, ${i.status})${i.aiAssignment ? ` [AI: ${i.aiAssignment.modelName}]` : ''}${i.needsHuman ? ' [NEEDS HUMAN]' : ''}`
	)
	.join('\n')}

DEPENDENCY GRAPH:
${graphDescription || '(No dependencies)'}
${
	focusedIssue
		? `\nFOCUSED ISSUE: "${focusedIssue.title}" (${focusedIssue.status})
${blockers.length > 0 ? `Blocked by: ${blockers.map((b) => b.title).join(', ')}` : 'Not blocked'}
${mostImpactfulBlocker ? `Most impactful blocker: "${mostImpactfulBlocker.blocker.title}" (impact score: ${mostImpactfulBlocker.impact.toFixed(1)})` : ''}`
		: ''
}
${historyText}

USER MESSAGE: ${message}

Respond with helpful advice. When you suggest concrete actions, include them in the "suggestedActions" array.

Respond in JSON format:
{
  "message": "Your response text here",
  "suggestedActions": [
    {
      "type": "create_issue" | "update_status" | "add_dependency" | "remove_dependency" | "assign_ai" | "unassign_ai" | "flag_human" | "clear_human_flag",
      "issueId": "issue-id (if applicable)",
      "targetId": "target-issue-id (for dependencies)",
      "data": {
        "title": "for create_issue",
        "description": "for create_issue",
        "priority": 0-4,
        "issueType": "task" | "bug" | "feature",
        "status": "open" | "in_progress" | "closed",
        "modelId": "for assign_ai",
        "modelName": "for assign_ai",
        "reason": "for flag_human"
      },
      "description": "Human-readable description of this action"
    }
  ],
  "unblockSuggestion": {
    "blockerId": "id of most important blocker",
    "blockerTitle": "title",
    "importance": 0.0-1.0,
    "suggestion": "What to do about it",
    "quickActions": []
  }
}

IMPORTANT:
- Keep responses concise and actionable
- Only suggest actions that make sense for the current context
- Use actual issue IDs from the list above
- If suggesting to assign AI, use modelId like "anthropic/claude-sonnet-4" or "openai/gpt-4o"`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: systemPrompt }],
			maxTokens: 2048,
			model
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({
				message: "I'm having trouble connecting. Let me try a simpler response.",
				suggestedActions: []
			});
		}

		// Parse JSON from response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			// If no JSON, use the raw text
			return json({
				message: result.content,
				suggestedActions: []
			});
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate and filter suggested actions
		const validActions: GraphAction[] = (parsed.suggestedActions || []).filter(
			(action: GraphAction) => {
				// Validate action type
				const validTypes = [
					'create_issue',
					'update_status',
					'add_dependency',
					'remove_dependency',
					'assign_ai',
					'unassign_ai',
					'flag_human',
					'clear_human_flag'
				];
				if (!validTypes.includes(action.type)) return false;

				// For issue-specific actions, validate the issue exists
				if (action.issueId && !issues.some((i) => i.id === action.issueId)) {
					return false;
				}

				// For dependency actions, validate both issues exist
				if (
					(action.type === 'add_dependency' || action.type === 'remove_dependency') &&
					action.targetId &&
					!issues.some((i) => i.id === action.targetId)
				) {
					return false;
				}

				return true;
			}
		);

		const response: GraphChatResponse = {
			message: parsed.message || result.content,
			suggestedActions: validActions,
			unblockSuggestion: parsed.unblockSuggestion
		};

		return json(response);
	} catch (error) {
		console.error('Error in graph chat:', error);
		return json({
			message:
				"Something went wrong processing your request. Could you try rephrasing?",
			suggestedActions: []
		});
	}
};

// Helper function to get all transitive dependents of an issue
function getAllTransitiveDependents(issueId: string, issues: Issue[]): string[] {
	const dependents = new Set<string>();
	const queue = [issueId];

	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const issue of issues) {
			if (issue.dependencies.includes(current) && !dependents.has(issue.id)) {
				dependents.add(issue.id);
				queue.push(issue.id);
			}
		}
	}

	return Array.from(dependents);
}
