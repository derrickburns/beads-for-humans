import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, RelationshipSuggestion, GraphImprovement } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

export const POST: RequestHandler = async ({ request }) => {
	const { issue, existingIssues, currentIssueId, model } = await request.json() as {
		issue: { title: string; description: string };
		existingIssues: Issue[];
		currentIssueId?: string;
		model?: string;
	};

	if (!issue || !existingIssues) {
		return json(
			{ error: 'Missing required fields' },
			{ status: 400 }
		);
	}

	// If no existing issues, nothing to suggest
	if (existingIssues.length === 0) {
		return json({ suggestions: [], improvements: [] });
	}

	// Build a representation of the current dependency graph
	const graphDescription = existingIssues
		.filter(i => i.dependencies.length > 0)
		.map(i => {
			const depTitles = i.dependencies
				.map(depId => existingIssues.find(e => e.id === depId)?.title || depId)
				.join(', ');
			return `  "${i.title}" depends on: [${depTitles}]`;
		})
		.join('\n');

	const prompt = `You are analyzing a dependency graph in an issue tracker. Your goal is to suggest improvements that make the graph cleaner and more accurate.

CURRENT ISSUES:
${existingIssues.map((i) => `- [${i.id}] "${i.title}" (${i.status})${i.description ? `: ${i.description}` : ''}`).join('\n')}

CURRENT DEPENDENCY GRAPH:
${graphDescription || '(No dependencies yet)'}

FOCUSED ISSUE (analyze relationships for this):
ID: ${currentIssueId || 'N/A'}
Title: "${issue.title}"
Description: "${issue.description || 'No description'}"

TASK: Suggest improvements to the dependency graph. Consider:

1. DIRECT DEPENDENCIES: What issues must be completed before the focused issue can start?
   - Only suggest direct dependencies, NOT transitive ones
   - If A needs C, and B needs C, and A needs B, then A should NOT directly depend on C (it's redundant via B)

2. GRAPH IMPROVEMENTS: Are there sets of changes that would make the graph better?
   - Removing redundant edges (A→C when A→B→C exists)
   - Adding missing intermediate dependencies
   - Restructuring for clarity

Respond in JSON:
{
  "suggestions": [
    {
      "targetId": "issue-id",
      "type": "dependency",
      "confidence": 0.0-1.0,
      "reason": "Brief explanation"
    }
  ],
  "improvements": [
    {
      "id": "unique-id",
      "description": "Human-readable description of this improvement",
      "confidence": 0.0-1.0,
      "changes": [
        { "action": "add" | "remove", "fromId": "issue-id", "toId": "depends-on-id", "reason": "why" }
      ]
    }
  ]
}

IMPORTANT RULES:
- Only suggest dependencies that ADD VALUE (not redundant)
- For improvements, include ALL changes needed (additions AND removals)
- confidence >= 0.7 for suggestions, >= 0.8 for improvements
- If no improvements needed, return empty arrays`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 2048,
			model
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ suggestions: [], improvements: [] });
		}

		// Parse JSON from response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ suggestions: [], improvements: [] });
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate suggestions
		const suggestions: RelationshipSuggestion[] = (parsed.suggestions || []).filter(
			(s: RelationshipSuggestion) =>
				existingIssues.some((i) => i.id === s.targetId) &&
				['dependency', 'blocks', 'related'].includes(s.type) &&
				typeof s.confidence === 'number' &&
				s.confidence >= 0.7
		);

		// Validate improvements
		const improvements: GraphImprovement[] = (parsed.improvements || []).filter(
			(imp: GraphImprovement) => {
				if (typeof imp.confidence !== 'number' || imp.confidence < 0.8) return false;
				if (!Array.isArray(imp.changes) || imp.changes.length === 0) return false;

				// Validate all changes reference valid issues
				return imp.changes.every(change =>
					existingIssues.some(i => i.id === change.fromId) &&
					existingIssues.some(i => i.id === change.toId) &&
					['add', 'remove'].includes(change.action)
				);
			}
		);

		return json({ suggestions, improvements });
	} catch (error) {
		console.error('Error calling AI API:', error);
		return json({ suggestions: [], improvements: [] });
	}
};
