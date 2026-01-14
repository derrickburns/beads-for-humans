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
			`- [${i.id}] "${i.title}" (${i.status})${i.close_reason ? ` - Closed: ${i.close_reason}` : ''}`
	)
	.join('\n')}

LOCAL ISSUES (in our tracker):
${localIssues.filter((i) => i.status !== 'closed').map((i) => `- [${i.id}] "${i.title}" (${i.status})`).join('\n')}

TASK: Identify which LOCAL issues should be marked as CLOSED based on matching CLOSED EXTERNAL issues.

Rules:
1. Only match if the issues are clearly about the same work
2. If an external issue is CLOSED and matches a local open issue, mark it for closing
3. Include a confidence score (0.0-1.0) for each match
4. Only include matches with confidence >= 0.7

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
				summary: result.content
			} as SyncResult);
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate matches
		const validMatches = (parsed.matches || []).filter((match: SyncResult['matches'][0]) => {
			// Verify local issue exists and is not already closed
			const localIssue = localIssues.find((i) => i.id === match.localIssueId);
			if (!localIssue || localIssue.status === 'closed') return false;

			// Verify external issue exists and is closed
			const externalIssue = externalIssues.find((i) => i.id === match.externalIssueId);
			if (!externalIssue || externalIssue.status !== 'closed') return false;

			return match.confidence >= 0.7;
		});

		return json({
			projectName,
			projectPath,
			externalIssues: {
				total: externalIssues.length,
				open: openExternal,
				closed: closedExternal
			},
			matches: validMatches,
			summary: parsed.summary || `Found ${validMatches.length} matching issues to sync.`
		} as SyncResult);
	} catch (error) {
		console.error('Error syncing project:', error);
		return json(
			{ error: 'Failed to analyze project' },
			{ status: 500 }
		);
	}
};
