import { browser } from '$app/environment';
import type { Issue, IssueStatus, IssuePriority, IssueType } from '$lib/types/issue';

const STORAGE_KEY = 'issues';

function generateId(): string {
	return crypto.randomUUID();
}

function loadIssues(): Issue[] {
	if (!browser) return [];
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored ? JSON.parse(stored) : [];
}

function saveIssues(issues: Issue[]): void {
	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
	}
}

class IssueStore {
	issues = $state<Issue[]>(loadIssues());

	// Computed: issues grouped by status
	get byStatus() {
		return {
			open: this.issues.filter((i) => i.status === 'open'),
			in_progress: this.issues.filter((i) => i.status === 'in_progress'),
			closed: this.issues.filter((i) => i.status === 'closed')
		};
	}

	// Computed: ready issues (open with no unresolved dependencies)
	get ready() {
		return this.issues.filter((issue) => {
			if (issue.status !== 'open') return false;
			return issue.dependencies.every((depId) => {
				const dep = this.issues.find((i) => i.id === depId);
				return dep?.status === 'closed';
			});
		});
	}

	// Computed: blocked issues (have unresolved dependencies)
	get blocked() {
		return this.issues.filter((issue) => {
			if (issue.status === 'closed') return false;
			return issue.dependencies.some((depId) => {
				const dep = this.issues.find((i) => i.id === depId);
				return dep && dep.status !== 'closed';
			});
		});
	}

	// Get issues that block a given issue
	getBlockers(issueId: string): Issue[] {
		const issue = this.issues.find((i) => i.id === issueId);
		if (!issue) return [];
		return issue.dependencies
			.map((depId) => this.issues.find((i) => i.id === depId))
			.filter((i): i is Issue => i !== undefined && i.status !== 'closed');
	}

	// Get issues blocked by a given issue
	getBlocking(issueId: string): Issue[] {
		return this.issues.filter(
			(i) => i.dependencies.includes(issueId) && i.status !== 'closed'
		);
	}

	getById(id: string): Issue | undefined {
		return this.issues.find((i) => i.id === id);
	}

	create(data: {
		title: string;
		description: string;
		priority: IssuePriority;
		type: IssueType;
		dependencies?: string[];
	}): Issue {
		const now = new Date().toISOString();
		const issue: Issue = {
			id: generateId(),
			title: data.title,
			description: data.description,
			status: 'open',
			priority: data.priority,
			type: data.type,
			createdAt: now,
			updatedAt: now,
			dependencies: data.dependencies ?? []
		};
		this.issues = [...this.issues, issue];
		saveIssues(this.issues);
		return issue;
	}

	update(id: string, updates: Partial<Omit<Issue, 'id' | 'createdAt'>>): Issue | undefined {
		const index = this.issues.findIndex((i) => i.id === id);
		if (index === -1) return undefined;

		const updated = {
			...this.issues[index],
			...updates,
			updatedAt: new Date().toISOString()
		};
		this.issues = [...this.issues.slice(0, index), updated, ...this.issues.slice(index + 1)];
		saveIssues(this.issues);
		return updated;
	}

	updateStatus(id: string, status: IssueStatus): Issue | undefined {
		return this.update(id, { status });
	}

	// Check if adding a dependency would create a cycle
	wouldCreateCycle(issueId: string, dependsOnId: string): boolean {
		if (issueId === dependsOnId) return true;

		// BFS to check if dependsOnId can reach issueId through existing dependencies
		const visited = new Set<string>();
		const queue = [dependsOnId];

		while (queue.length > 0) {
			const current = queue.shift()!;
			if (current === issueId) return true;
			if (visited.has(current)) continue;
			visited.add(current);

			const currentIssue = this.getById(current);
			if (currentIssue) {
				for (const depId of currentIssue.dependencies) {
					if (!visited.has(depId)) {
						queue.push(depId);
					}
				}
			}
		}
		return false;
	}

	// Find the path that would form a cycle if we add issueId -> dependsOnId
	findCyclePath(issueId: string, dependsOnId: string): string[] | null {
		if (issueId === dependsOnId) return [issueId];

		// BFS to find path from dependsOnId back to issueId
		const visited = new Set<string>();
		const parent = new Map<string, string>();
		const queue = [dependsOnId];

		while (queue.length > 0) {
			const current = queue.shift()!;
			if (current === issueId) {
				// Reconstruct path
				const path: string[] = [issueId];
				let node = dependsOnId;
				while (node !== issueId) {
					path.unshift(node);
					const p = parent.get(node);
					if (!p) break;
					node = p;
				}
				return path;
			}
			if (visited.has(current)) continue;
			visited.add(current);

			const currentIssue = this.getById(current);
			if (currentIssue) {
				for (const depId of currentIssue.dependencies) {
					if (!visited.has(depId)) {
						parent.set(depId, current);
						queue.push(depId);
					}
				}
			}
		}
		return null;
	}

	// Get edges that could be removed to break a cycle
	// Returns array of {from, to, fromTitle, toTitle} representing edges in the cycle
	getCycleBreakOptions(issueId: string, dependsOnId: string): Array<{from: string; to: string; fromTitle: string; toTitle: string}> {
		const path = this.findCyclePath(issueId, dependsOnId);
		if (!path) return [];

		const options: Array<{from: string; to: string; fromTitle: string; toTitle: string}> = [];

		// The proposed edge would be: issueId depends on dependsOnId
		// The cycle path goes: dependsOnId -> ... -> issueId
		// So the full cycle is: issueId -> dependsOnId -> ... -> issueId

		// Each edge in the existing path is a candidate for removal
		for (let i = 0; i < path.length - 1; i++) {
			const from = path[i + 1]; // issue that has the dependency
			const to = path[i];       // issue it depends on
			const fromIssue = this.getById(from);
			const toIssue = this.getById(to);
			if (fromIssue && toIssue && fromIssue.dependencies.includes(to)) {
				options.push({
					from,
					to,
					fromTitle: fromIssue.title,
					toTitle: toIssue.title
				});
			}
		}

		return options;
	}

	addDependency(issueId: string, dependsOnId: string): {
		issue: Issue | undefined;
		error?: string;
		cycleBreakOptions?: Array<{from: string; to: string; fromTitle: string; toTitle: string}>;
	} {
		const issue = this.getById(issueId);
		if (!issue) return { issue: undefined, error: 'Issue not found' };
		if (issue.dependencies.includes(dependsOnId)) return { issue };
		if (issueId === dependsOnId) return { issue, error: 'Cannot depend on self' };

		// Check for cycles
		if (this.wouldCreateCycle(issueId, dependsOnId)) {
			const cycleBreakOptions = this.getCycleBreakOptions(issueId, dependsOnId);
			return {
				issue,
				error: 'This would create a circular dependency',
				cycleBreakOptions
			};
		}

		return {
			issue: this.update(issueId, {
				dependencies: [...issue.dependencies, dependsOnId]
			})
		};
	}

	// Add dependency after breaking a cycle by removing an edge
	addDependencyBreakingCycle(
		issueId: string,
		dependsOnId: string,
		breakEdge: {from: string; to: string}
	): { issue: Issue | undefined; error?: string } {
		// First remove the edge that breaks the cycle
		this.removeDependency(breakEdge.from, breakEdge.to);

		// Now add the new dependency (should succeed since cycle is broken)
		return this.addDependency(issueId, dependsOnId);
	}

	removeDependency(issueId: string, dependsOnId: string): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue) return undefined;
		return this.update(issueId, {
			dependencies: issue.dependencies.filter((id) => id !== dependsOnId)
		});
	}

	// Reverse the direction of a dependency
	reverseDependency(issueId: string, dependsOnId: string): { success: boolean; error?: string } {
		// Currently: issueId depends on dependsOnId
		// After: dependsOnId depends on issueId

		// First check if the reverse would create a cycle
		// (it shouldn't since we're removing the original edge, but check anyway)
		const issue = this.getById(issueId);
		const target = this.getById(dependsOnId);
		if (!issue || !target) return { success: false, error: 'Issue not found' };

		// Remove the original dependency
		this.removeDependency(issueId, dependsOnId);

		// Add the reverse dependency
		const result = this.addDependency(dependsOnId, issueId);
		if (result.error) {
			// Restore original if reverse fails
			this.update(issueId, {
				dependencies: [...issue.dependencies]
			});
			return { success: false, error: result.error };
		}

		return { success: true };
	}

	delete(id: string): boolean {
		const index = this.issues.findIndex((i) => i.id === id);
		if (index === -1) return false;

		// Remove from dependencies of other issues
		this.issues = this.issues
			.filter((i) => i.id !== id)
			.map((i) => ({
				...i,
				dependencies: i.dependencies.filter((depId) => depId !== id)
			}));
		saveIssues(this.issues);
		return true;
	}
}

export const issueStore = new IssueStore();
