import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { IssueType, IssuePriority } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface ExpandedIssue {
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
}

export const POST: RequestHandler = async ({ request }) => {
	const { input, model, apiKey } = (await request.json()) as {
		input: string;
		model?: string;
		apiKey?: string;
	};

	if (!input || input.trim().length < 3) {
		return json({ error: 'Please provide more detail about the issue' });
	}

	const prompt = `You are helping create an issue in a project tracker. The user has typed a brief description and you need to expand it into a complete issue.

USER INPUT: "${input}"

Create a well-structured issue with:
1. A clear, actionable title (improve on the input if needed)
2. A description that explains what needs to be done and why (2-3 sentences)
3. The appropriate type (task, bug, or feature)
4. A reasonable priority (0-4 where 0=critical, 1=high, 2=medium, 3=low, 4=backlog)

TYPE GUIDELINES:
- "task": General work items, administrative tasks, research, documentation
- "bug": Something is broken or not working correctly
- "feature": New functionality to be added

PRIORITY GUIDELINES:
- 0 (Critical): Blocking work, urgent fix needed immediately
- 1 (High): Important, should be done this week
- 2 (Medium): Normal priority, plan to do it
- 3 (Low): Nice to have when time permits
- 4 (Backlog): Future consideration, maybe someday

Respond with ONLY valid JSON:
{
  "title": "Clear, actionable title",
  "description": "What needs to be done and why. Keep it practical.",
  "type": "task|bug|feature",
  "priority": 0-4
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 500,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to expand issue. Please try again.' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' });
		}

		const expanded = JSON.parse(jsonMatch[0]) as ExpandedIssue;

		// Validate and normalize the response
		const validTypes: IssueType[] = ['task', 'bug', 'feature'];
		const type: IssueType = validTypes.includes(expanded.type) ? expanded.type : 'task';

		const priority: IssuePriority =
			typeof expanded.priority === 'number' && expanded.priority >= 0 && expanded.priority <= 4
				? (expanded.priority as IssuePriority)
				: 2;

		return json({
			title: expanded.title || input,
			description: expanded.description || '',
			type,
			priority
		});
	} catch (error) {
		console.error('Error expanding issue:', error);
		return json({ error: 'Failed to expand issue. Please try again.' });
	}
};
