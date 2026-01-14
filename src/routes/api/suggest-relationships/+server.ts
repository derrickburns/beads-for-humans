import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, RelationshipSuggestion } from '$lib/types/issue';
import { env } from '$env/dynamic/private';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;

	// Gracefully handle missing API key - just return no suggestions
	if (!apiKey) {
		return json({ suggestions: [] });
	}

	const { issue, existingIssues } = await request.json() as {
		issue: { title: string; description: string };
		existingIssues: Issue[];
	};

	if (!issue || !existingIssues) {
		return json(
			{ error: 'Missing required fields' },
			{ status: 400 }
		);
	}

	// If no existing issues, nothing to suggest
	if (existingIssues.length === 0) {
		return json({ suggestions: [] });
	}

	const prompt = `You are analyzing issues in an issue tracker to suggest relationships.

Existing issues:
${existingIssues.map((i, idx) => `${idx + 1}. [${i.id}] "${i.title}" - ${i.description || 'No description'} (Status: ${i.status})`).join('\n')}

New/updated issue:
Title: "${issue.title}"
Description: "${issue.description || 'No description'}"

Analyze if this issue has any relationships with existing issues:
- "dependency": This issue requires another issue to be completed first
- "blocks": This issue must be completed before another issue can start
- "related": Issues are conceptually related but don't have a blocking relationship

For each potential relationship, provide:
1. The ID of the related issue
2. The relationship type
3. A confidence score (0.0-1.0)
4. A brief reason

Respond in JSON format:
{
  "suggestions": [
    {
      "targetId": "issue-id",
      "type": "dependency" | "blocks" | "related",
      "confidence": 0.0-1.0,
      "reason": "Brief explanation"
    }
  ]
}

Only suggest relationships with confidence >= 0.5. Return empty suggestions array if no clear relationships exist.`;

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
				max_tokens: 1024,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				]
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

		// Parse JSON from response
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ suggestions: [] });
		}

		const parsed = JSON.parse(jsonMatch[0]);
		const suggestions: RelationshipSuggestion[] = parsed.suggestions || [];

		// Filter to only valid suggestions
		const validSuggestions = suggestions.filter(
			(s) =>
				existingIssues.some((i) => i.id === s.targetId) &&
				['dependency', 'blocks', 'related'].includes(s.type) &&
				typeof s.confidence === 'number' &&
				s.confidence >= 0.5
		);

		return json({ suggestions: validSuggestions });
	} catch (error) {
		console.error('Error calling Anthropic API:', error);
		return json({ suggestions: [] });
	}
};
