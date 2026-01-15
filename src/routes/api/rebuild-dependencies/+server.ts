import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface DependencyResult {
	issueId: string;
	dependsOn: string[];
	reasoning: string;
}

interface RebuildResult {
	dependencies: DependencyResult[];
	summary: string;
	cyclesDetected: string[][];
	changesCount: number;
}

// Check if adding a dependency would create a cycle
function wouldCreateCycle(
	fromId: string,
	toId: string,
	proposedDeps: Map<string, Set<string>>
): boolean {
	if (fromId === toId) return true;

	// BFS from toId to see if we can reach fromId
	const visited = new Set<string>();
	const queue = [toId];

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current === fromId) return true;
		if (visited.has(current)) continue;
		visited.add(current);

		const deps = proposedDeps.get(current);
		if (deps) {
			for (const depId of deps) {
				if (!visited.has(depId)) {
					queue.push(depId);
				}
			}
		}
	}

	return false;
}

// Topological sort to detect cycles and order
function detectCycles(deps: Map<string, Set<string>>): string[][] {
	const cycles: string[][] = [];
	const visited = new Set<string>();
	const recursionStack = new Set<string>();

	function dfs(nodeId: string, path: string[]): boolean {
		visited.add(nodeId);
		recursionStack.add(nodeId);

		const nodeDeps = deps.get(nodeId);
		if (nodeDeps) {
			for (const depId of nodeDeps) {
				if (!visited.has(depId)) {
					if (dfs(depId, [...path, nodeId])) return true;
				} else if (recursionStack.has(depId)) {
					// Found cycle
					const cycleStart = path.indexOf(depId);
					if (cycleStart >= 0) {
						cycles.push([...path.slice(cycleStart), nodeId, depId]);
					} else {
						cycles.push([...path, nodeId, depId]);
					}
					return true;
				}
			}
		}

		recursionStack.delete(nodeId);
		return false;
	}

	for (const nodeId of deps.keys()) {
		if (!visited.has(nodeId)) {
			dfs(nodeId, []);
		}
	}

	return cycles;
}

export const POST: RequestHandler = async ({ request }) => {
	const { issues, model, apiKey } = (await request.json()) as {
		issues: Issue[];
		model?: string;
		apiKey?: string;
	};

	if (!issues || issues.length === 0) {
		return json({ error: 'No issues provided' }, { status: 400 });
	}

	// Filter to open issues only
	const openIssues = issues.filter(i => i.status !== 'closed');

	if (openIssues.length === 0) {
		return json({
			dependencies: [],
			summary: 'No open issues to analyze.',
			cyclesDetected: [],
			changesCount: 0
		} as RebuildResult);
	}

	// Build prompt for AI
	const prompt = `You are a project planning expert. Analyze these issues and determine the correct dependency relationships.

ISSUES TO ANALYZE:
${openIssues.map(i => `
[${i.id}] "${i.title}"
Type: ${i.type} | Priority: P${i.priority} | Status: ${i.status}
Description: ${i.description || '(no description)'}
`).join('\n---\n')}

TASK: Determine which issues should depend on which other issues.

Rules for dependencies:
1. Issue A "depends on" Issue B means A cannot start until B is complete
2. Dependencies should reflect LOGICAL ordering - what truly must be done first
3. Consider technical dependencies (e.g., "implement API" before "build UI that uses API")
4. Consider workflow dependencies (e.g., "design" before "implement")
5. DO NOT create circular dependencies
6. Only create dependencies where there is a CLEAR logical reason
7. Prefer fewer, essential dependencies over many weak ones
8. If two issues are independent, don't force a dependency

For each issue, list what it depends on (can be empty if no dependencies).

Respond in JSON:
{
  "dependencies": [
    {
      "issueId": "issue-id",
      "dependsOn": ["other-issue-id", ...],
      "reasoning": "Brief explanation of why these dependencies exist"
    }
  ],
  "summary": "Overview of the dependency structure you created"
}

IMPORTANT:
- Use exact issue IDs from the list above
- Every issue must appear in the dependencies array (even if dependsOn is empty)
- Double-check that no cycles exist`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 4000,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			return json({ error: 'AI analysis failed' }, { status: 500 });
		}

		// Parse response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Could not parse AI response' }, { status: 500 });
		}

		const parsed = JSON.parse(jsonMatch[0]);
		const aiDeps: DependencyResult[] = parsed.dependencies || [];

		// Validate and filter dependencies
		const issueIds = new Set(openIssues.map(i => i.id));
		const proposedDeps = new Map<string, Set<string>>();

		// Initialize all issues with empty deps
		for (const issue of openIssues) {
			proposedDeps.set(issue.id, new Set());
		}

		// Add AI-suggested dependencies, validating each one
		for (const dep of aiDeps) {
			if (!issueIds.has(dep.issueId)) continue;

			const validDeps = new Set<string>();
			for (const targetId of (dep.dependsOn || [])) {
				// Must be a valid issue
				if (!issueIds.has(targetId)) continue;
				// Can't depend on self
				if (targetId === dep.issueId) continue;

				// Temporarily add to check for cycles
				proposedDeps.get(dep.issueId)!.add(targetId);

				// Check if this creates a cycle
				if (wouldCreateCycle(dep.issueId, targetId, proposedDeps)) {
					// Remove it - would create cycle
					proposedDeps.get(dep.issueId)!.delete(targetId);
				} else {
					validDeps.add(targetId);
				}
			}

			proposedDeps.set(dep.issueId, validDeps);
		}

		// Final cycle check
		const cycles = detectCycles(proposedDeps);

		// Build result
		const validatedDeps: DependencyResult[] = [];
		let changesCount = 0;

		for (const issue of openIssues) {
			const newDeps = Array.from(proposedDeps.get(issue.id) || []);
			const oldDeps = new Set(issue.dependencies);
			const newDepsSet = new Set(newDeps);

			// Count changes
			for (const d of newDeps) {
				if (!oldDeps.has(d)) changesCount++;
			}
			for (const d of oldDeps) {
				if (!newDepsSet.has(d) && issueIds.has(d)) changesCount++;
			}

			const aiDep = aiDeps.find(d => d.issueId === issue.id);
			validatedDeps.push({
				issueId: issue.id,
				dependsOn: newDeps,
				reasoning: aiDep?.reasoning || 'No dependencies needed'
			});
		}

		return json({
			dependencies: validatedDeps,
			summary: parsed.summary || `Analyzed ${openIssues.length} issues and created dependency graph.`,
			cyclesDetected: cycles,
			changesCount
		} as RebuildResult);

	} catch (error) {
		console.error('Error rebuilding dependencies:', error);
		return json({ error: 'Failed to analyze dependencies' }, { status: 500 });
	}
};
