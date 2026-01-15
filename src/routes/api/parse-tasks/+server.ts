import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

export interface PartialCompletion {
	existingIssueId: string;  // ID of existing issue that is partially done
	existingTitle: string;    // Title of existing issue
	completedPortion: string; // What was completed
	remainingWork: string;    // What still needs to be done
	suggestedSplit: {
		completedTitle: string;
		remainingTitle: string;
	};
	confidence: number;       // 0-1
}

export interface ParsedTask {
	tempId: string;
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
	dependsOn: string[]; // tempIds of tasks this depends on
	suggestedExistingDeps: string[]; // IDs of existing issues this might depend on
}

export interface ParseResult {
	tasks: ParsedTask[];
	partialCompletions: PartialCompletion[];  // Existing issues with partial progress
	reasoning: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { text, existingIssues, model } = (await request.json()) as {
		text: string;
		existingIssues: Issue[];
		model?: string;
	};

	if (!text || text.trim().length < 10) {
		return json({ error: 'Please enter more text describing your tasks', tasks: [], partialCompletions: [], reasoning: '' });
	}

	const existingContext = existingIssues.length > 0
		? `\n\nExisting issues in the project (you can suggest dependencies to these using their IDs):\n${existingIssues.map(i => `- ID: "${i.id}" | Title: "${i.title}" | Status: ${i.status}`).join('\n')}`
		: '';

	const prompt = `You are a project planning assistant. Parse the following freeform text into a structured list of tasks with dependencies.

Input text:
"""
${text}
"""
${existingContext}

Instructions:
1. Extract individual tasks from the text
2. Assign each task a temporary ID (temp-1, temp-2, etc.)
3. Determine the logical order and dependencies between tasks
4. A task "depends on" another if it cannot start until that task is complete
5. Infer task types: "task" (general work), "bug" (fixing something), "feature" (new capability)
6. Assign priorities: 0 (critical), 1 (high), 2 (medium), 3 (low), 4 (backlog)
7. If tasks relate to existing issues, include those IDs in suggestedExistingDeps
8. Write clear, actionable titles and brief descriptions

IMPORTANT - Detect Partial Completions:
If the input text indicates that SOME work on an existing issue has been completed but more remains:
- Identify which existing issue is affected
- Describe what portion is complete vs what remains
- Suggest how to split the issue (completed title + remaining title)
- This helps refactor existing issues that are partially done

Respond in JSON format:
{
  "tasks": [
    {
      "tempId": "temp-1",
      "title": "Clear, actionable task title",
      "description": "Brief description of what needs to be done",
      "type": "task" | "bug" | "feature",
      "priority": 0-4,
      "dependsOn": ["temp-X", "temp-Y"],
      "suggestedExistingDeps": ["existing-issue-id"]
    }
  ],
  "partialCompletions": [
    {
      "existingIssueId": "ID of existing issue",
      "existingTitle": "Title of existing issue",
      "completedPortion": "What has been completed",
      "remainingWork": "What still needs to be done",
      "suggestedSplit": {
        "completedTitle": "Suggested title for completed portion",
        "remainingTitle": "Suggested title for remaining work"
      },
      "confidence": 0.0-1.0
    }
  ],
  "reasoning": "Brief explanation of the task breakdown and dependency logic"
}

Important:
- Tasks should be actionable and specific
- Dependencies should reflect true ordering constraints (what MUST be done first)
- Don't create artificial dependencies - only when truly necessary
- Keep descriptions concise but informative
- Only include partialCompletions if the input text clearly indicates partial progress on an existing issue`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 4000,
			model
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to parse tasks', tasks: [], partialCompletions: [], reasoning: '' });
		}

		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Could not parse AI response', tasks: [], partialCompletions: [], reasoning: '' });
		}

		const parsed = JSON.parse(jsonMatch[0]) as ParseResult;

		// Validate and clean up the parsed tasks
		const validTasks = parsed.tasks.filter(t =>
			t.tempId &&
			t.title &&
			['task', 'bug', 'feature'].includes(t.type) &&
			typeof t.priority === 'number' && t.priority >= 0 && t.priority <= 4
		).map(t => ({
			...t,
			dependsOn: t.dependsOn || [],
			suggestedExistingDeps: t.suggestedExistingDeps || [],
			description: t.description || ''
		}));

		// Validate partial completions
		const validPartialCompletions = (parsed.partialCompletions || []).filter(pc => {
			// Verify the existing issue ID is valid
			const existingIssue = existingIssues.find(i => i.id === pc.existingIssueId);
			if (!existingIssue) return false;

			// Must have required fields
			if (!pc.completedPortion || !pc.remainingWork) return false;
			if (!pc.suggestedSplit?.completedTitle || !pc.suggestedSplit?.remainingTitle) return false;

			// Confidence must be reasonable
			if (typeof pc.confidence !== 'number' || pc.confidence < 0.5) return false;

			return true;
		}).map(pc => ({
			...pc,
			existingTitle: existingIssues.find(i => i.id === pc.existingIssueId)?.title || pc.existingTitle
		}));

		return json({
			tasks: validTasks,
			partialCompletions: validPartialCompletions,
			reasoning: parsed.reasoning || ''
		});
	} catch (error) {
		console.error('Error parsing tasks:', error);
		return json({ error: 'Failed to parse tasks', tasks: [], partialCompletions: [], reasoning: '' });
	}
};
