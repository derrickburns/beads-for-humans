import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';

export interface ProjectInfo {
	name: string;
	path: string;
	hasBeads: boolean;
	hasClaude: boolean;
	issueCount?: number;
	openIssues?: number;
	closedIssues?: number;
	lastModified: string;
}

// Base directory for projects
const PROJECTS_BASE = '/Users/derrickburns/Documents/claude-assisted';

export const GET: RequestHandler = async () => {
	try {
		const entries = await readdir(PROJECTS_BASE, { withFileTypes: true });
		const projects: ProjectInfo[] = [];

		for (const entry of entries) {
			// Skip hidden directories (except .beads)
			if (entry.name.startsWith('.')) continue;
			if (!entry.isDirectory()) continue;

			const projectPath = join(PROJECTS_BASE, entry.name);

			try {
				const projectStat = await stat(projectPath);

				// Check for beads directory
				let hasBeads = false;
				let issueCount = 0;
				let openIssues = 0;
				let closedIssues = 0;

				try {
					const beadsPath = join(projectPath, '.beads');
					await stat(beadsPath);
					hasBeads = true;

					// Try to read issues.jsonl
					const issuesPath = join(beadsPath, 'issues.jsonl');
					const issuesContent = await readFile(issuesPath, 'utf-8');
					const lines = issuesContent.trim().split('\n').filter(Boolean);

					for (const line of lines) {
						try {
							const issue = JSON.parse(line);
							issueCount++;
							if (issue.status === 'closed') {
								closedIssues++;
							} else {
								openIssues++;
							}
						} catch {
							// Skip malformed lines
						}
					}
				} catch {
					// No beads directory
				}

				// Check for CLAUDE.md
				let hasClaude = false;
				try {
					await stat(join(projectPath, 'CLAUDE.md'));
					hasClaude = true;
				} catch {
					// No CLAUDE.md
				}

				projects.push({
					name: entry.name,
					path: projectPath,
					hasBeads,
					hasClaude,
					issueCount: hasBeads ? issueCount : undefined,
					openIssues: hasBeads ? openIssues : undefined,
					closedIssues: hasBeads ? closedIssues : undefined,
					lastModified: projectStat.mtime.toISOString()
				});
			} catch {
				// Skip directories we can't access
			}
		}

		// Sort by last modified, most recent first
		projects.sort(
			(a, b) =>
				new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
		);

		return json({ projects, basePath: PROJECTS_BASE });
	} catch (error) {
		console.error('Error listing projects:', error);
		return json({ error: 'Failed to list projects', projects: [] }, { status: 500 });
	}
};
