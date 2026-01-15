import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface FollowUpSuggestion {
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
	relationship: 'prerequisite' | 'follow-up' | 'parallel' | 'verification';
	reason: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { issue, existingIssues, model, apiKey } = (await request.json()) as {
		issue: Issue;
		existingIssues: Issue[];
		model?: string;
		apiKey?: string;
	};

	if (!issue) {
		return json({ error: 'Issue is required' }, { status: 400 });
	}

	// Build context from existing issues
	const existingContext = existingIssues.length > 0
		? `\nEXISTING ISSUES (avoid duplicates):\n${existingIssues.map(i => `- "${i.title}"`).join('\n')}`
		: '';

	const prompt = `You are a project planning assistant. A user just created this issue and you should suggest related tasks they might want to create.

NEWLY CREATED ISSUE:
Title: "${issue.title}"
Description: "${issue.description || '(no description)'}"
Type: ${issue.type}
Priority: P${issue.priority}
${existingContext}

Suggest 2-4 related tasks the user might want to create. Consider:

1. PREREQUISITES - Things that should be done BEFORE this issue
   - Research, planning, design work
   - Setup or configuration tasks

2. FOLLOW-UPS - Things that naturally come AFTER this issue
   - Testing, documentation, deployment
   - Related features or improvements

3. PARALLEL WORK - Things that could be done alongside
   - Related but independent tasks
   - Supporting work

4. VERIFICATION - Quality assurance tasks
   - Testing, review, validation
   - User acceptance checks

RULES:
- Don't suggest tasks that duplicate existing issues
- Be specific and actionable, not generic
- Match priority to the parent issue (related work should have similar priority)
- Keep titles concise (under 60 chars)

Respond with valid JSON:
{
  "suggestions": [
    {
      "title": "Clear, actionable title",
      "description": "Brief explanation of what this involves",
      "type": "task|bug|feature",
      "priority": 0-4,
      "relationship": "prerequisite|follow-up|parallel|verification",
      "reason": "Why this is relevant to the created issue"
    }
  ]
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 1500,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ suggestions: [] });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ suggestions: [] });
		}

		const parsed = JSON.parse(jsonMatch[0]);
		const suggestions: FollowUpSuggestion[] = (parsed.suggestions || [])
			.filter((s: FollowUpSuggestion) => {
				// Validate each suggestion
				if (!s.title || s.title.length < 5) return false;
				if (!['task', 'bug', 'feature'].includes(s.type)) return false;
				if (typeof s.priority !== 'number' || s.priority < 0 || s.priority > 4) return false;
				if (!['prerequisite', 'follow-up', 'parallel', 'verification'].includes(s.relationship)) return false;
				return true;
			})
			.map((s: FollowUpSuggestion) => ({
				title: s.title,
				description: s.description || '',
				type: s.type,
				priority: s.priority as IssuePriority,
				relationship: s.relationship,
				reason: s.reason || ''
			}));

		return json({ suggestions });
	} catch (error) {
		console.error('Error suggesting follow-ups:', error);
		return json({ suggestions: [] });
	}
};
