import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority } from '$lib/types/issue';
import { env } from '$env/dynamic/private';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export interface SuggestedAction {
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
	relationship: {
		type: 'dependency' | 'blocks' | 'related';
		targetId: string;
		reason: string;
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;

	if (!apiKey) {
		return json({ suggestions: [] });
	}

	const { issue, existingIssues } = (await request.json()) as {
		issue: Issue;
		existingIssues: Issue[];
	};

	if (!issue) {
		return json({ error: 'Missing issue' }, { status: 400 });
	}

	const existingTitles = existingIssues.map((i) => i.title.toLowerCase());

	const prompt = `You are a project planning assistant. Given an issue in an issue tracker, suggest 2-4 NEW actions/tasks that would naturally complement or support this issue.

Current issue being viewed:
- Title: "${issue.title}"
- Description: "${issue.description || 'No description'}"
- Type: ${issue.type}
- Priority: P${issue.priority}
- Status: ${issue.status}

Existing issues in the project (DO NOT suggest duplicates of these):
${existingIssues.map((i) => `- "${i.title}" (${i.type}, ${i.status})`).join('\n') || 'None'}

For each suggested action:
1. It must be NEW - not a duplicate or near-duplicate of any existing issue
2. It should logically relate to the current issue
3. Identify the relationship type:
   - "dependency": The suggested action should be done BEFORE the current issue
   - "blocks": The suggested action should be done AFTER the current issue (current issue blocks it)
   - "related": Related but no strict ordering

Common patterns to consider:
- If it's a feature: suggest tests, documentation, error handling, edge cases
- If it's a bug: suggest regression tests, root cause investigation, related fixes
- If it's a task: suggest validation, review, follow-up tasks

Respond in JSON format:
{
  "suggestions": [
    {
      "title": "Short action title",
      "description": "Brief description of what needs to be done",
      "type": "task" | "bug" | "feature",
      "priority": 0-4 (0=critical, 2=medium, 4=backlog),
      "relationship": {
        "type": "dependency" | "blocks" | "related",
        "reason": "Why this relates to the current issue"
      }
    }
  ]
}

Be practical and specific. Suggest actions that a real team would actually need to do.`;

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
				max_tokens: 1500,
				messages: [{ role: 'user', content: prompt }]
			})
		});

		if (!response.ok) {
			console.error('Anthropic API error:', await response.text());
			return json({ suggestions: [] });
		}

		const data = await response.json();
		const content = data.content?.[0]?.text;

		if (!content) {
			return json({ suggestions: [] });
		}

		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ suggestions: [] });
		}

		const parsed = JSON.parse(jsonMatch[0]);
		let suggestions: SuggestedAction[] = parsed.suggestions || [];

		// Filter out any that are too similar to existing issues
		suggestions = suggestions.filter((s) => {
			const titleLower = s.title.toLowerCase();
			return !existingTitles.some(
				(existing) =>
					existing.includes(titleLower) ||
					titleLower.includes(existing) ||
					levenshteinSimilarity(existing, titleLower) > 0.7
			);
		});

		// Add the target issue ID to each relationship
		suggestions = suggestions.map((s) => ({
			...s,
			relationship: {
				...s.relationship,
				targetId: issue.id
			}
		}));

		return json({ suggestions });
	} catch (error) {
		console.error('Error calling Anthropic API:', error);
		return json({ suggestions: [] });
	}
};

// Simple Levenshtein similarity (0-1)
function levenshteinSimilarity(a: string, b: string): number {
	const longer = a.length > b.length ? a : b;
	const shorter = a.length > b.length ? b : a;

	if (longer.length === 0) return 1.0;

	const costs: number[] = [];
	for (let i = 0; i <= shorter.length; i++) {
		let lastValue = i;
		for (let j = 0; j <= longer.length; j++) {
			if (i === 0) {
				costs[j] = j;
			} else if (j > 0) {
				let newValue = costs[j - 1];
				if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
					newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
				}
				costs[j - 1] = lastValue;
				lastValue = newValue;
			}
		}
		if (i > 0) costs[longer.length] = lastValue;
	}

	return (longer.length - costs[longer.length]) / longer.length;
}
