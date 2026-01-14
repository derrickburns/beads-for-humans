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

	// ===== Graph Health Analysis =====

	// Find dependencies pointing to non-existent issues
	findInvalidDependencies(): Array<{ issueId: string; issueTitle: string; invalidDepId: string }> {
		const invalid: Array<{ issueId: string; issueTitle: string; invalidDepId: string }> = [];
		const issueIds = new Set(this.issues.map(i => i.id));

		for (const issue of this.issues) {
			for (const depId of issue.dependencies) {
				if (!issueIds.has(depId)) {
					invalid.push({
						issueId: issue.id,
						issueTitle: issue.title,
						invalidDepId: depId
					});
				}
			}
		}
		return invalid;
	}

	// Find redundant transitive dependencies
	// If A depends on B, and B depends on C, then A depending on C is redundant
	findRedundantDependencies(): Array<{
		issueId: string;
		issueTitle: string;
		redundantDepId: string;
		redundantDepTitle: string;
		throughId: string;
		throughTitle: string;
	}> {
		const redundant: Array<{
			issueId: string;
			issueTitle: string;
			redundantDepId: string;
			redundantDepTitle: string;
			throughId: string;
			throughTitle: string;
		}> = [];

		for (const issue of this.issues) {
			if (issue.dependencies.length < 2) continue;

			// For each dependency, compute all transitive dependencies
			const transitiveReach = new Map<string, Set<string>>();

			for (const depId of issue.dependencies) {
				const reachable = this.getTransitiveDependencies(depId);
				transitiveReach.set(depId, reachable);
			}

			// Check if any direct dependency is reachable through another
			for (const depId of issue.dependencies) {
				for (const [otherId, reachable] of transitiveReach) {
					if (otherId !== depId && reachable.has(depId)) {
						const depIssue = this.getById(depId);
						const throughIssue = this.getById(otherId);
						if (depIssue && throughIssue) {
							redundant.push({
								issueId: issue.id,
								issueTitle: issue.title,
								redundantDepId: depId,
								redundantDepTitle: depIssue.title,
								throughId: otherId,
								throughTitle: throughIssue.title
							});
						}
					}
				}
			}
		}
		return redundant;
	}

	// Get all transitive dependencies of an issue (not including itself)
	getTransitiveDependencies(issueId: string): Set<string> {
		const visited = new Set<string>();
		const queue = [issueId];

		while (queue.length > 0) {
			const current = queue.shift()!;
			if (visited.has(current)) continue;
			if (current !== issueId) visited.add(current);

			const currentIssue = this.getById(current);
			if (currentIssue) {
				for (const depId of currentIssue.dependencies) {
					if (!visited.has(depId)) {
						queue.push(depId);
					}
				}
			}
		}
		return visited;
	}

	// Check for existing cycles in the graph (shouldn't happen but might from bugs or imports)
	findExistingCycles(): Array<{ cycle: string[]; titles: string[] }> {
		const cycles: Array<{ cycle: string[]; titles: string[] }> = [];
		const visited = new Set<string>();
		const recursionStack = new Set<string>();

		const dfs = (issueId: string, path: string[]): boolean => {
			visited.add(issueId);
			recursionStack.add(issueId);

			const issue = this.getById(issueId);
			if (!issue) return false;

			for (const depId of issue.dependencies) {
				if (!visited.has(depId)) {
					if (dfs(depId, [...path, issueId])) return true;
				} else if (recursionStack.has(depId)) {
					// Found a cycle
					const cycleStart = path.indexOf(depId);
					const cyclePath = cycleStart >= 0
						? [...path.slice(cycleStart), issueId, depId]
						: [...path, issueId, depId];
					cycles.push({
						cycle: cyclePath,
						titles: cyclePath.map(id => this.getById(id)?.title || id)
					});
					return true;
				}
			}

			recursionStack.delete(issueId);
			return false;
		};

		for (const issue of this.issues) {
			if (!visited.has(issue.id)) {
				dfs(issue.id, []);
			}
		}

		return cycles;
	}

	// Aggregate all graph health issues
	getGraphHealth(): {
		isHealthy: boolean;
		invalidDeps: Array<{ issueId: string; issueTitle: string; invalidDepId: string }>;
		redundantDeps: Array<{
			issueId: string;
			issueTitle: string;
			redundantDepId: string;
			redundantDepTitle: string;
			throughId: string;
			throughTitle: string;
		}>;
		cycles: Array<{ cycle: string[]; titles: string[] }>;
	} {
		const invalidDeps = this.findInvalidDependencies();
		const redundantDeps = this.findRedundantDependencies();
		const cycles = this.findExistingCycles();

		return {
			isHealthy: invalidDeps.length === 0 && redundantDeps.length === 0 && cycles.length === 0,
			invalidDeps,
			redundantDeps,
			cycles
		};
	}

	// Auto-fix: remove invalid dependencies
	removeInvalidDependencies(): number {
		let removed = 0;
		const issueIds = new Set(this.issues.map(i => i.id));

		for (const issue of this.issues) {
			const validDeps = issue.dependencies.filter(depId => issueIds.has(depId));
			if (validDeps.length !== issue.dependencies.length) {
				removed += issue.dependencies.length - validDeps.length;
				this.update(issue.id, { dependencies: validDeps });
			}
		}
		return removed;
	}

	// Auto-fix: remove redundant dependencies
	removeRedundantDependencies(): number {
		let removed = 0;
		const redundant = this.findRedundantDependencies();

		// Group by issue to avoid multiple updates
		const byIssue = new Map<string, Set<string>>();
		for (const r of redundant) {
			if (!byIssue.has(r.issueId)) {
				byIssue.set(r.issueId, new Set());
			}
			byIssue.get(r.issueId)!.add(r.redundantDepId);
		}

		for (const [issueId, redundantDeps] of byIssue) {
			const issue = this.getById(issueId);
			if (issue) {
				const newDeps = issue.dependencies.filter(d => !redundantDeps.has(d));
				removed += issue.dependencies.length - newDeps.length;
				this.update(issueId, { dependencies: newDeps });
			}
		}
		return removed;
	}
}

export const issueStore = new IssueStore();
