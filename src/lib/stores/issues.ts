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

	addDependency(issueId: string, dependsOnId: string): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue || issue.dependencies.includes(dependsOnId)) return issue;
		if (issueId === dependsOnId) return issue; // Can't depend on self
		return this.update(issueId, {
			dependencies: [...issue.dependencies, dependsOnId]
		});
	}

	removeDependency(issueId: string, dependsOnId: string): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue) return undefined;
		return this.update(issueId, {
			dependencies: issue.dependencies.filter((id) => id !== dependsOnId)
		});
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
