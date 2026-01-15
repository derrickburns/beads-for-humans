import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, stat, readdir } from 'fs/promises';
import { join } from 'path';
import type { Issue } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface ExternalIssue {
	id: string;
	title: string;
	description?: string;
	status: string;
	priority?: number;
	issue_type?: string;
	close_reason?: string;
}

interface PartialMatch {
	localIssueId: string;
	localTitle: string;
	completedPortion: string;
	remainingWork: string;
	matchedExternalIssues: Array<{
		id: string;
		title: string;
		status: string;
	}>;
	confidence: number;
	suggestedSplit: {
		completedTitle: string;
		remainingTitle: string;
	};
}

interface SyncResult {
	projectName: string;
	projectPath: string;
	externalIssues: {
		total: number;
		open: number;
		closed: number;
	};
	matches: Array<{
		localIssueId: string;
		localTitle: string;
		externalIssueId: string;
		externalTitle: string;
		externalStatus: string;
		confidence: number;
		shouldClose: boolean;
		reason?: string;
	}>;
	partialMatches: PartialMatch[];
	summary: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { projectPath, localIssues, model } = (await request.json()) as {
		projectPath: string;
		localIssues: Issue[];
		model?: string;
	};

	if (!projectPath) {
		return json({ error: 'Missing projectPath' }, { status: 400 });
	}

	try {
		// Read external project's beads issues
		const beadsPath = join(projectPath, '.beads', 'issues.jsonl');
		let externalIssues: ExternalIssue[] = [];

		try {
			const issuesContent = await readFile(beadsPath, 'utf-8');
			const lines = issuesContent.trim().split('\n').filter(Boolean);

			for (const line of lines) {
				try {
					externalIssues.push(JSON.parse(line));
				} catch {
					// Skip malformed lines
				}
			}
		} catch {
			return json(
				{ error: 'No beads issues found in project' },
				{ status: 404 }
			);
		}

		// Count external issues by status
		const openExternal = externalIssues.filter((i) => i.status !== 'closed').length;
		const closedExternal = externalIssues.filter((i) => i.status === 'closed').length;

		// Get project name from path
		const projectName = projectPath.split('/').pop() || projectPath;

		// If no local issues to match, return summary only
		if (!localIssues || localIssues.length === 0) {
			return json({
				projectName,
				projectPath,
				externalIssues: {
					total: externalIssues.length,
					open: openExternal,
					closed: closedExternal
				},
				matches: [],
				partialMatches: [],
				summary: `Project has ${externalIssues.length} issues (${closedExternal} closed, ${openExternal} open). No local issues to sync.`
			} as SyncResult);
		}

		// Build prompt for AI to match issues
		const prompt = `You are analyzing two issue trackers to find matching issues.

EXTERNAL PROJECT: ${projectName}
EXTERNAL ISSUES (from ${projectPath}):
${externalIssues
	.map(
		(i) =>
			`- [${i.id}] "${i.title}" (${i.status})${i.close_reason ? ` - Closed: ${i.close_reason}` : ''}${i.description ? ` - ${i.description.slice(0, 100)}...` : ''}`
	)
	.join('\n')}

LOCAL ISSUES (in our tracker):
${localIssues.filter((i) => i.status !== 'closed').map((i) => `- [${i.id}] "${i.title}" (${i.status})${i.description ? ` - ${i.description.slice(0, 100)}...` : ''}`).join('\n')}

TASK: Identify two types of matches:

1. COMPLETE MATCHES: Local issues that should be marked CLOSED because a matching external issue is closed.

2. PARTIAL MATCHES: Local issues where SOME work is done (one or more closed external issues address PART of the local issue), but additional work remains. These should be suggested for REFACTORING (splitting into completed and remaining parts).

Rules for Complete Matches:
- Only match if the issues are clearly about the same work
- The external issue must be CLOSED
- Include confidence score (0.0-1.0), only include if >= 0.7

Rules for Partial Matches:
- The local issue scope is BROADER than what the external issue(s) cover
- At least one related external issue is CLOSED
- Identify what portion is complete and what remains
- Suggest how to split the issue
- Include confidence score (0.0-1.0), only include if >= 0.6

Respond in JSON:
{
  "matches": [
    {
      "localIssueId": "local-id",
      "localTitle": "local title",
      "externalIssueId": "external-id",
      "externalTitle": "external title",
      "externalStatus": "closed",
      "confidence": 0.0-1.0,
      "shouldClose": true,
      "reason": "Why this match was made"
    }
  ],
  "partialMatches": [
    {
      "localIssueId": "local-id",
      "localTitle": "local title",
      "completedPortion": "Description of what has been completed",
      "remainingWork": "Description of what still needs to be done",
      "matchedExternalIssues": [
        {"id": "ext-id", "title": "external title", "status": "closed"}
      ],
      "confidence": 0.0-1.0,
      "suggestedSplit": {
        "completedTitle": "Suggested title for completed portion",
        "remainingTitle": "Suggested title for remaining work"
      }
    }
  ],
  "summary": "Brief summary of what was found"
}`;

		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 2048,
			model
		});

		if (result.error || !result.content) {
			return json({
				projectName,
				projectPath,
				externalIssues: {
					total: externalIssues.length,
					open: openExternal,
					closed: closedExternal
				},
				matches: [],
				partialMatches: [],
				summary: 'AI analysis failed. Project context loaded but no automatic matching performed.'
			} as SyncResult);
		}

		// Parse AI response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({
				projectName,
				projectPath,
				externalIssues: {
					total: externalIssues.length,
					open: openExternal,
					closed: closedExternal
				},
				matches: [],
				partialMatches: [],
				summary: result.content
			} as SyncResult);
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate complete matches
		const validMatches = (parsed.matches || []).filter((match: SyncResult['matches'][0]) => {
			// Verify local issue exists and is not already closed
			const localIssue = localIssues.find((i) => i.id === match.localIssueId);
			if (!localIssue || localIssue.status === 'closed') return false;

			// Verify external issue exists and is closed
			const externalIssue = externalIssues.find((i) => i.id === match.externalIssueId);
			if (!externalIssue || externalIssue.status !== 'closed') return false;

			return match.confidence >= 0.7;
		});

		// Validate partial matches
		const validPartialMatches = (parsed.partialMatches || []).filter((match: PartialMatch) => {
			// Verify local issue exists and is not already closed
			const localIssue = localIssues.find((i) => i.id === match.localIssueId);
			if (!localIssue || localIssue.status === 'closed') return false;

			// Don't suggest partial if already a complete match
			if (validMatches.some((m: SyncResult['matches'][0]) => m.localIssueId === match.localIssueId)) {
				return false;
			}

			// Verify at least one matched external issue exists
			if (!match.matchedExternalIssues || match.matchedExternalIssues.length === 0) {
				return false;
			}

			// Verify the matched external issues actually exist
			const hasValidExternal = match.matchedExternalIssues.some((ext) =>
				externalIssues.some((i) => i.id === ext.id)
			);
			if (!hasValidExternal) return false;

			return match.confidence >= 0.6;
		});

		const summary = parsed.summary ||
			`Found ${validMatches.length} complete match${validMatches.length !== 1 ? 'es' : ''} and ${validPartialMatches.length} partial match${validPartialMatches.length !== 1 ? 'es' : ''}.`;

		return json({
			projectName,
			projectPath,
			externalIssues: {
				total: externalIssues.length,
				open: openExternal,
				closed: closedExternal
			},
			matches: validMatches,
			partialMatches: validPartialMatches,
			summary
		} as SyncResult);
	} catch (error) {
		console.error('Error syncing project:', error);
		return json(
			{ error: 'Failed to analyze project' },
			{ status: 500 }
		);
	}
};
