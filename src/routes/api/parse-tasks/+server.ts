import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority } from '$lib/types/issue';
import { env } from '$env/dynamic/private';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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
	reasoning: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;

	if (!apiKey) {
		return json({ error: 'AI features not configured', tasks: [], reasoning: '' });
	}

	const { text, existingIssues } = (await request.json()) as {
		text: string;
		existingIssues: Issue[];
	};

	if (!text || text.trim().length < 10) {
		return json({ error: 'Please enter more text describing your tasks', tasks: [], reasoning: '' });
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
  "reasoning": "Brief explanation of the task breakdown and dependency logic"
}

Important:
- Tasks should be actionable and specific
- Dependencies should reflect true ordering constraints (what MUST be done first)
- Don't create artificial dependencies - only when truly necessary
- Keep descriptions concise but informative`;

	try {
		const response = await fetch(ANTHROPIC_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 4000,
				messages: [{ role: 'user', content: prompt }]
			})
		});

		if (!response.ok) {
			console.error('Anthropic API error:', await response.text());
			return json({ error: 'Failed to parse tasks', tasks: [], reasoning: '' });
		}

		const data = await response.json();
		const content = data.content?.[0]?.text;

		if (!content) {
			return json({ error: 'No response from AI', tasks: [], reasoning: '' });
		}

		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Could not parse AI response', tasks: [], reasoning: '' });
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

		return json({
			tasks: validTasks,
			reasoning: parsed.reasoning || ''
		});
	} catch (error) {
		console.error('Error parsing tasks:', error);
		return json({ error: 'Failed to parse tasks', tasks: [], reasoning: '' });
	}
};
