import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, ExecutionType } from '$lib/types/issue';

interface NextTaskRequest {
	issues: Issue[];
	executionTypes?: ExecutionType[];
	limit?: number;
}

interface PrioritizedTask {
	task: Issue;
	score: number;
	reasons: string[];
}

interface NextTaskResponse {
	task: Issue | null;
	score: number;
	reasons: string[];
	alternates: PrioritizedTask[];
}

// Calculate how many tasks become directly ready when this task completes
function getUnblockScore(issues: Issue[], issueId: string): number {
	const directDependents = issues.filter(
		(i) => i.dependencies.includes(issueId) && i.status !== 'closed'
	);
	let unblockCount = 0;
	for (const dep of directDependents) {
		const otherBlockers = dep.dependencies.filter((d) => d !== issueId);
		const allOthersClosed = otherBlockers.every((blockerId) => {
			const blocker = issues.find((i) => i.id === blockerId);
			return blocker?.status === 'closed';
		});
		if (allOthersClosed) unblockCount++;
	}
	return unblockCount;
}

// Calculate transitive impact (all downstream tasks)
function getTransitiveUnblockScore(
	issues: Issue[],
	issueId: string,
	visited = new Set<string>()
): number {
	if (visited.has(issueId)) return 0;
	visited.add(issueId);

	const directDependents = issues.filter(
		(i) => i.dependencies.includes(issueId) && i.status !== 'closed'
	);
	let score = directDependents.length;
	for (const dep of directDependents) {
		score += getTransitiveUnblockScore(issues, dep.id, visited) * 0.5;
	}
	return score;
}

// Get ready issues (not closed, no open blockers)
function getReadyIssues(issues: Issue[]): Issue[] {
	return issues.filter((issue) => {
		if (issue.status === 'closed') return false;
		if (issue.dependencies.length === 0) return true;
		return issue.dependencies.every((depId) => {
			const dep = issues.find((i) => i.id === depId);
			return dep?.status === 'closed';
		});
	});
}

// Score and rank ready tasks using dependency-weighted priority
function getPrioritizedReady(
	issues: Issue[],
	executionTypes?: ExecutionType[]
): PrioritizedTask[] {
	let readyIssues = getReadyIssues(issues);

	// Filter by execution type if specified
	if (executionTypes && executionTypes.length > 0) {
		readyIssues = readyIssues.filter(
			(i) => i.executionType && executionTypes.includes(i.executionType)
		);
	}

	return readyIssues
		.map((issue) => {
			const reasons: string[] = [];
			let score = 0;

			// Factor 1: Unblock score (most important - tasks that unblock others first)
			const unblockScore = getUnblockScore(issues, issue.id);
			const transitiveScore = getTransitiveUnblockScore(issues, issue.id);
			score += unblockScore * 10;
			score += transitiveScore * 2;
			if (unblockScore > 0) {
				reasons.push(`Unblocks ${unblockScore} task${unblockScore > 1 ? 's' : ''}`);
			}
			if (transitiveScore > unblockScore * 2) {
				reasons.push(`High downstream impact`);
			}

			// Factor 2: Priority (0=critical, 4=backlog)
			const priorityScore = (4 - issue.priority) * 5;
			score += priorityScore;
			if (issue.priority <= 1) {
				reasons.push(issue.priority === 0 ? 'Critical priority' : 'High priority');
			}

			// Factor 3: Execution type preference (automated/AI tasks are faster)
			if (issue.executionType === 'automated') {
				score += 3;
				reasons.push('Can be fully automated');
			} else if (issue.executionType === 'ai_assisted') {
				score += 2;
				reasons.push('Can be AI-assisted');
			}

			// Factor 4: Validation not required (faster to complete)
			if (!issue.validationRequired) {
				score += 1;
			} else {
				reasons.push('Requires validation');
			}

			if (reasons.length === 0) {
				reasons.push('Ready to start');
			}

			return { task: issue, score, reasons };
		})
		.sort((a, b) => b.score - a.score);
}

export const POST: RequestHandler = async ({ request }) => {
	const { issues, executionTypes, limit = 5 } = (await request.json()) as NextTaskRequest;

	if (!issues || !Array.isArray(issues)) {
		return json({ error: 'Missing or invalid issues array' }, { status: 400 });
	}

	try {
		// Get prioritized ready tasks
		const prioritized = getPrioritizedReady(issues, executionTypes);

		if (prioritized.length === 0) {
			return json({
				task: null,
				score: 0,
				reasons: ['No ready tasks available'],
				alternates: []
			} satisfies NextTaskResponse);
		}

		const [first, ...rest] = prioritized;
		const response: NextTaskResponse = {
			task: first.task,
			score: first.score,
			reasons: first.reasons,
			alternates: rest.slice(0, limit - 1)
		};

		return json(response);
	} catch (error) {
		console.error('Error getting next task:', error);
		return json({ error: 'Failed to get next task' }, { status: 500 });
	}
};
