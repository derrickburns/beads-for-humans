import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { IssueType, IssuePriority, ExecutionType } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface ExpandedIssue {
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
	executionType?: ExecutionType;
	aiConfidence?: number;
	validationRequired?: boolean;
	executionReason?: string;
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
5. Who should do this task (execution type classification)

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

EXECUTION TYPE GUIDELINES (who does this task):
- "automated": AI can complete entirely without human (research, drafts, code, data analysis)
- "human": Only human can do this (sign documents, phone calls, physical tasks, financial decisions)
- "ai_assisted": AI does work but human should verify (important communications, production code)
- "human_assisted": Human does core work, AI helps (interviews, negotiations, creative decisions)

Set validationRequired=true when output affects others, involves money/legal, or is irreversible.
Set aiConfidence 0.0-1.0 based on how clear the classification is.

Respond with ONLY valid JSON:
{
  "title": "Clear, actionable title",
  "description": "What needs to be done and why. Keep it practical.",
  "type": "task|bug|feature",
  "priority": 0-4,
  "executionType": "automated|human|ai_assisted|human_assisted",
  "aiConfidence": 0.0-1.0,
  "validationRequired": true/false,
  "executionReason": "Brief reason for execution type"
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

		// Validate execution type
		const validExecutionTypes: ExecutionType[] = ['automated', 'human', 'ai_assisted', 'human_assisted'];
		const executionType: ExecutionType = expanded.executionType && validExecutionTypes.includes(expanded.executionType)
			? expanded.executionType
			: 'human_assisted';

		const aiConfidence = typeof expanded.aiConfidence === 'number'
			? Math.max(0, Math.min(1, expanded.aiConfidence))
			: 0.5;

		const validationRequired = typeof expanded.validationRequired === 'boolean'
			? expanded.validationRequired
			: true;

		return json({
			title: expanded.title || input,
			description: expanded.description || '',
			type,
			priority,
			executionType,
			aiConfidence,
			validationRequired,
			executionReason: expanded.executionReason || 'Classification based on task content'
		});
	} catch (error) {
		console.error('Error expanding issue:', error);
		return json({ error: 'Failed to expand issue. Please try again.' });
	}
};
