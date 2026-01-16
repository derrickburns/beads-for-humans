import { browser } from '$app/environment';
import type {
	Issue,
	IssueStatus,
	IssuePriority,
	IssueType,
	ExecutionType,
	DecompositionType,
	AIAssignment,
	NeedsHumanTrigger,
	BudgetEstimate,
	ActualCost,
	Concern,
	Constraint,
	ScopeBoundary
} from '$lib/types/issue';

const STORAGE_KEY_PREFIX = 'issues-';
const LEGACY_STORAGE_KEY = 'issues';

// Get storage key for a project
function getStorageKey(projectId: string | null): string {
	return projectId ? `${STORAGE_KEY_PREFIX}${projectId}` : LEGACY_STORAGE_KEY;
}

function generateId(): string {
	return crypto.randomUUID();
}

// Validate and repair issues loaded from storage
function validateLoadedIssues(issues: Issue[]): Issue[] {
	const validIds = new Set(issues.map(i => i.id));
	const validStatuses: IssueStatus[] = ['open', 'in_progress', 'closed', 'failed'];
	const validTypes: IssueType[] = ['goal', 'task', 'assumption', 'risk', 'contingency', 'question', 'constraint', 'bug', 'feature'];
	const validExecutionTypes: ExecutionType[] = ['human', 'ai_assisted', 'human_assisted', 'automated'];
	const validDecompositionTypes: DecompositionType[] = ['and', 'or_fallback', 'or_race', 'choice'];

	return issues.map(issue => {
		// Filter out invalid dependencies
		const validDeps = (issue.dependencies || []).filter(depId => validIds.has(depId));

		// Clamp priority to valid range
		const priority = Math.max(0, Math.min(4, issue.priority ?? 2)) as IssuePriority;

		// Validate status
		const status = validStatuses.includes(issue.status) ? issue.status : 'open';

		// Validate type
		const type = validTypes.includes(issue.type) ? issue.type : 'task';

		// Validate execution type
		const executionType = issue.executionType && validExecutionTypes.includes(issue.executionType)
			? issue.executionType
			: undefined;

		// Validate parent ID (must exist)
		const parentId = issue.parentId && validIds.has(issue.parentId)
			? issue.parentId
			: undefined;

		// Validate decomposition type
		const decompositionType = issue.decompositionType && validDecompositionTypes.includes(issue.decompositionType)
			? issue.decompositionType
			: undefined;

		return {
			...issue,
			dependencies: validDeps,
			priority,
			status,
			type,
			executionType,
			parentId,
			decompositionType
		};
	});
}

function loadIssues(projectId: string | null = null): Issue[] {
	if (!browser) return [];
	try {
		const key = getStorageKey(projectId);
		const stored = localStorage.getItem(key);
		if (!stored) return [];
		const parsed = JSON.parse(stored) as Issue[];
		return validateLoadedIssues(parsed);
	} catch (e) {
		console.error('Failed to load issues from storage:', e);
		return [];
	}
}

function saveIssues(issues: Issue[], projectId: string | null = null): void {
	if (browser) {
		const key = getStorageKey(projectId);
		localStorage.setItem(key, JSON.stringify(issues));
	}
}

class IssueStore {
	issues = $state<Issue[]>([]);
	currentProjectId = $state<string | null>(null);

	// Load issues for a specific project
	loadProject(projectId: string | null): void {
		this.currentProjectId = projectId;
		this.issues = loadIssues(projectId);
	}

	// Save current issues (called internally after mutations)
	private save(): void {
		saveIssues(this.issues, this.currentProjectId);
	}

	// Clear current project
	clearProject(): void {
		this.currentProjectId = null;
		this.issues = [];
	}

	// Computed: issues grouped by status
	get byStatus() {
		return {
			open: this.issues.filter((i) => i.status === 'open'),
			in_progress: this.issues.filter((i) => i.status === 'in_progress'),
			closed: this.issues.filter((i) => i.status === 'closed'),
			failed: this.issues.filter((i) => i.status === 'failed')
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

	// ===== Parent-Child Hierarchy =====

	// Get all children of an issue
	getChildren(issueId: string): Issue[] {
		return this.issues.filter(i => i.parentId === issueId);
	}

	// Get all descendants (children, grandchildren, etc.)
	getDescendants(issueId: string): Issue[] {
		const descendants: Issue[] = [];
		const queue = [issueId];

		while (queue.length > 0) {
			const currentId = queue.shift()!;
			const children = this.getChildren(currentId);
			for (const child of children) {
				descendants.push(child);
				queue.push(child.id);
			}
		}
		return descendants;
	}

	// Get the parent issue
	getParent(issueId: string): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue?.parentId) return undefined;
		return this.getById(issue.parentId);
	}

	// Get all ancestors (parent, grandparent, etc.)
	getAncestors(issueId: string): Issue[] {
		const ancestors: Issue[] = [];
		let current = this.getParent(issueId);
		while (current) {
			ancestors.push(current);
			current = this.getParent(current.id);
		}
		return ancestors;
	}

	// Get root issues (no parent)
	get roots(): Issue[] {
		return this.issues.filter(i => !i.parentId);
	}

	// Check if issue is a container (has children)
	isContainer(issueId: string): boolean {
		return this.getChildren(issueId).length > 0;
	}

	// Check if issue is a leaf (no children)
	isLeaf(issueId: string): boolean {
		return this.getChildren(issueId).length === 0;
	}

	// Get all leaf issues (workable units)
	get leaves(): Issue[] {
		return this.issues.filter(i => this.isLeaf(i.id));
	}

	// Get derived status for a container based on children
	getDerivedStatus(issueId: string): IssueStatus {
		const children = this.getChildren(issueId);
		if (children.length === 0) {
			// Not a container, return actual status
			return this.getById(issueId)?.status || 'open';
		}

		const issue = this.getById(issueId);
		const decompositionType = issue?.decompositionType || 'and';

		if (decompositionType === 'and') {
			// AND: all must complete
			const allClosed = children.every(c => this.getDerivedStatus(c.id) === 'closed');
			if (allClosed) return 'closed';

			const anyFailed = children.some(c => this.getDerivedStatus(c.id) === 'failed');
			if (anyFailed) return 'failed';

			const anyInProgress = children.some(c =>
				['in_progress', 'closed'].includes(this.getDerivedStatus(c.id))
			);
			if (anyInProgress) return 'in_progress';

			return 'open';
		}

		if (decompositionType === 'or_fallback' || decompositionType === 'or_race') {
			// OR: any success = success
			const anyClosed = children.some(c => this.getDerivedStatus(c.id) === 'closed');
			if (anyClosed) return 'closed';

			const allFailed = children.every(c => this.getDerivedStatus(c.id) === 'failed');
			if (allFailed) return 'failed';

			const anyInProgress = children.some(c =>
				this.getDerivedStatus(c.id) === 'in_progress'
			);
			if (anyInProgress) return 'in_progress';

			return 'open';
		}

		if (decompositionType === 'choice') {
			// Choice: check if decision made (one child marked as chosen)
			// For now, treat like AND until selection mechanism is added
			const allResearched = children.every(c =>
				['closed', 'failed'].includes(this.getDerivedStatus(c.id))
			);
			if (allResearched) return 'in_progress'; // Awaiting decision
			return 'open';
		}

		return 'open';
	}

	// Decompose a task into subtasks
	decompose(
		parentId: string,
		children: Array<{
			title: string;
			description: string;
			type?: IssueType;
			priority?: IssuePriority;
			dependencies?: string[];
			executionType?: ExecutionType;
		}>,
		decompositionType: DecompositionType = 'and'
	): Issue[] {
		const parent = this.getById(parentId);
		if (!parent) return [];

		// Update parent to set decomposition type
		this.update(parentId, { decompositionType });

		// Create children
		const created: Issue[] = [];
		for (const child of children) {
			const issue = this.createChild(parentId, {
				title: child.title,
				description: child.description,
				type: child.type || 'task',
				priority: child.priority ?? parent.priority,
				dependencies: child.dependencies,
				executionType: child.executionType
			});
			if (issue) created.push(issue);
		}

		return created;
	}

	// Create a child issue
	createChild(
		parentId: string,
		data: {
			title: string;
			description: string;
			type: IssueType;
			priority: IssuePriority;
			dependencies?: string[];
			executionType?: ExecutionType;
		}
	): Issue | undefined {
		const parent = this.getById(parentId);
		if (!parent) return undefined;

		const issue = this.create({
			...data,
			dependencies: data.dependencies || []
		});

		if (issue) {
			// Set parent ID
			this.update(issue.id, { parentId });
		}

		return issue ? this.getById(issue.id) : undefined;
	}

	// Mark an issue as failed
	markFailed(issueId: string, reason: string): Issue | undefined {
		return this.update(issueId, {
			status: 'failed',
			failureReason: reason
		});
	}

	// Check if an issue is actionable (leaf + ready)
	isActionable(issueId: string): boolean {
		if (!this.isLeaf(issueId)) return false;
		const issue = this.getById(issueId);
		if (!issue || issue.status !== 'open') return false;

		// Check blocking dependencies
		return issue.dependencies.every(depId => {
			const dep = this.getById(depId);
			return dep?.status === 'closed';
		});
	}

	// Get all actionable issues (leaf + ready)
	get actionable(): Issue[] {
		return this.leaves.filter(i => this.isActionable(i.id));
	}

	// Check if an issue with this title already exists (case-insensitive)
	findByTitle(title: string): Issue | undefined {
		const normalizedTitle = title.toLowerCase().trim();
		return this.issues.find(i => i.title.toLowerCase().trim() === normalizedTitle);
	}

	create(data: {
		title: string;
		description: string;
		priority: IssuePriority;
		type: IssueType;
		dependencies?: string[];
		executionType?: ExecutionType;
		validationRequired?: boolean;
		aiConfidence?: number;
		executionReason?: string;
	}): Issue | undefined {
		// Prevent duplicates - check if issue with same title exists
		const existing = this.findByTitle(data.title);
		if (existing) {
			console.warn(`Issue with title "${data.title}" already exists, skipping creation`);
			return undefined;
		}

		// Validate and filter dependencies
		const validIds = new Set(this.issues.map(i => i.id));
		const validDependencies = (data.dependencies ?? []).filter(depId => {
			if (!validIds.has(depId)) {
				console.warn(`Ignoring invalid dependency "${depId}" on create - issue does not exist`);
				return false;
			}
			return true;
		});

		// Validate priority (clamp to 0-4)
		const priority = Math.max(0, Math.min(4, data.priority)) as IssuePriority;

		// Validate execution type
		const validExecutionTypes: ExecutionType[] = ['human', 'ai_assisted', 'human_assisted', 'automated'];
		const executionType = data.executionType && validExecutionTypes.includes(data.executionType)
			? data.executionType
			: undefined;

		const now = new Date().toISOString();
		const issue: Issue = {
			id: generateId(),
			title: data.title,
			description: data.description,
			status: 'open',
			priority,
			type: data.type,
			createdAt: now,
			updatedAt: now,
			dependencies: validDependencies,
			executionType,
			validationRequired: data.validationRequired,
			aiConfidence: data.aiConfidence,
			executionReason: data.executionReason
		};
		this.issues = [...this.issues, issue];
		this.save();
		return issue;
	}

	update(id: string, updates: Partial<Omit<Issue, 'id' | 'createdAt'>>): Issue | undefined {
		const index = this.issues.findIndex((i) => i.id === id);
		if (index === -1) return undefined;

		// Validate dependencies if provided
		if (updates.dependencies) {
			// Filter out invalid dependency IDs
			const validIds = new Set(this.issues.map(i => i.id));
			updates.dependencies = updates.dependencies.filter(depId => {
				if (!validIds.has(depId)) {
					console.warn(`Ignoring invalid dependency "${depId}" - issue does not exist`);
					return false;
				}
				if (depId === id) {
					console.warn(`Ignoring self-dependency`);
					return false;
				}
				return true;
			});

			// Check for cycles with the new dependencies
			for (const depId of updates.dependencies) {
				if (!this.issues[index].dependencies.includes(depId)) {
					// This is a new dependency - check for cycle
					if (this.wouldCreateCycle(id, depId)) {
						console.warn(`Ignoring dependency "${depId}" - would create cycle`);
						updates.dependencies = updates.dependencies.filter(d => d !== depId);
					}
				}
			}
		}

		// Validate priority if provided
		if (updates.priority !== undefined) {
			updates.priority = Math.max(0, Math.min(4, updates.priority)) as IssuePriority;
		}

		const updated = {
			...this.issues[index],
			...updates,
			updatedAt: new Date().toISOString()
		};
		this.issues = [...this.issues.slice(0, index), updated, ...this.issues.slice(index + 1)];
		this.save();
		return updated;
	}

	updateStatus(id: string, status: IssueStatus): Issue | undefined {
		return this.update(id, { status });
	}

	// === Dialog History Management ===
	// Dialog history is the AI's long-term memory - never lose it, always build on it

	addDialogMessage(
		issueId: string,
		message: {
			role: 'user' | 'assistant';
			content: string;
			urlsReferenced?: string[];
			actionsApplied?: string[];
		}
	): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue) return undefined;

		const dialogMessage = {
			...message,
			timestamp: new Date().toISOString()
		};

		const existingHistory = issue.dialogHistory || [];
		return this.update(issueId, {
			dialogHistory: [...existingHistory, dialogMessage]
		});
	}

	getDialogHistory(issueId: string): Array<{
		role: 'user' | 'assistant';
		content: string;
		timestamp: string;
		urlsReferenced?: string[];
		actionsApplied?: string[];
	}> {
		const issue = this.getById(issueId);
		return issue?.dialogHistory || [];
	}

	// Get dialog context from related issues (parent, siblings) for richer AI context
	getRelatedDialogContext(issueId: string): Array<{
		issueId: string;
		issueTitle: string;
		relationship: 'parent' | 'sibling' | 'child' | 'blocker';
		messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
	}> {
		const issue = this.getById(issueId);
		if (!issue) return [];

		const relatedDialogs: Array<{
			issueId: string;
			issueTitle: string;
			relationship: 'parent' | 'sibling' | 'child' | 'blocker';
			messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
		}> = [];

		// Parent dialog context
		if (issue.parentId) {
			const parent = this.getById(issue.parentId);
			if (parent?.dialogHistory?.length) {
				relatedDialogs.push({
					issueId: parent.id,
					issueTitle: parent.title,
					relationship: 'parent',
					messages: parent.dialogHistory.map(m => ({
						role: m.role,
						content: m.content,
						timestamp: m.timestamp
					}))
				});
			}
		}

		// Sibling dialog context (same parent)
		if (issue.parentId) {
			const siblings = this.getChildren(issue.parentId).filter(s => s.id !== issueId);
			for (const sibling of siblings) {
				if (sibling.dialogHistory?.length) {
					relatedDialogs.push({
						issueId: sibling.id,
						issueTitle: sibling.title,
						relationship: 'sibling',
						messages: sibling.dialogHistory.map(m => ({
							role: m.role,
							content: m.content,
							timestamp: m.timestamp
						}))
					});
				}
			}
		}

		// Blocker dialog context
		const blockers = this.getBlockers(issueId);
		for (const blocker of blockers) {
			if (blocker.dialogHistory?.length) {
				relatedDialogs.push({
					issueId: blocker.id,
					issueTitle: blocker.title,
					relationship: 'blocker',
					messages: blocker.dialogHistory.map(m => ({
						role: m.role,
						content: m.content,
						timestamp: m.timestamp
					}))
				});
			}
		}

		return relatedDialogs;
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
		this.save();
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

	// ===== AI Assignment Methods =====

	// Assign an AI model to work on an issue
	assignAI(issueId: string, modelId: string, modelName: string): Issue | undefined {
		const now = new Date().toISOString();
		return this.update(issueId, {
			aiAssignment: {
				modelId,
				modelName,
				assignedAt: now,
				lastActivityAt: now
			},
			// Auto-clear needs-human when AI is assigned
			needsHuman: undefined
		});
	}

	// Remove AI assignment from an issue
	unassignAI(issueId: string): Issue | undefined {
		return this.update(issueId, { aiAssignment: undefined });
	}

	// Update AI's last activity timestamp (for timeout tracking)
	updateAIActivity(issueId: string): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue?.aiAssignment) return undefined;
		return this.update(issueId, {
			aiAssignment: {
				...issue.aiAssignment,
				lastActivityAt: new Date().toISOString()
			}
		});
	}

	// ===== Human Attention Methods =====

	// Flag an issue as needing human attention
	flagNeedsHuman(
		issueId: string,
		trigger: NeedsHumanTrigger,
		reason: string,
		aiModelId?: string
	): Issue | undefined {
		return this.update(issueId, {
			needsHuman: {
				trigger,
				reason,
				flaggedAt: new Date().toISOString(),
				aiModelId
			}
		});
	}

	// Clear the needs-human flag
	clearNeedsHuman(issueId: string): Issue | undefined {
		return this.update(issueId, { needsHuman: undefined });
	}

	// ===== AI Capability Benchmarking =====

	// Update the benchmark result for an issue
	updateBenchmark(
		issueId: string,
		result: {
			currentType: ExecutionType;
			suggestedType: ExecutionType;
			confidence: number;
			reasoning: string;
			changed: boolean;
			benchmarkedAt: string;
			modelUsed: string;
		}
	): Issue | undefined {
		return this.update(issueId, { lastBenchmark: result });
	}

	// Apply a benchmark suggestion (change execution type)
	applyBenchmark(issueId: string): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue?.lastBenchmark?.changed) return undefined;

		return this.update(issueId, {
			executionType: issue.lastBenchmark.suggestedType,
			executionReason: `Reclassified based on AI benchmark: ${issue.lastBenchmark.reasoning}`
		});
	}

	// Clear benchmark result
	clearBenchmark(issueId: string): Issue | undefined {
		return this.update(issueId, { lastBenchmark: undefined });
	}

	// Computed: issues with reclassification suggestions
	get benchmarkSuggestions(): Issue[] {
		return this.issues.filter(
			(i) => i.lastBenchmark?.changed && i.status !== 'closed'
		);
	}

	// Computed: issues needing human attention
	get needsHuman(): Issue[] {
		return this.issues.filter((i) => i.needsHuman && i.status !== 'closed');
	}

	// Computed: AI-assigned issues
	get aiAssigned(): Issue[] {
		return this.issues.filter((i) => i.aiAssignment && i.status !== 'closed');
	}

	// Get issues assigned to a specific AI model
	getByAIModel(modelId: string): Issue[] {
		return this.issues.filter(
			(i) => i.aiAssignment?.modelId === modelId && i.status !== 'closed'
		);
	}

	// ===== Blocker Importance Analysis =====

	// Get all issues that transitively depend on this issue
	getTransitiveDependents(issueId: string): Issue[] {
		const dependents = new Set<string>();
		const queue = [issueId];

		while (queue.length > 0) {
			const current = queue.shift()!;
			// Find all issues that directly depend on current
			for (const issue of this.issues) {
				if (issue.dependencies.includes(current) && !dependents.has(issue.id)) {
					dependents.add(issue.id);
					queue.push(issue.id);
				}
			}
		}

		return Array.from(dependents)
			.map((id) => this.getById(id))
			.filter((i): i is Issue => i !== undefined);
	}

	// Calculate importance of a blocker based on downstream impact
	getBlockerImportance(blockerId: string): number {
		const dependents = this.getTransitiveDependents(blockerId);
		if (dependents.length === 0) return 0;

		// Weight by priority of downstream issues (P0 = 4x, P4 = 1x)
		const priorityWeights = [4, 3, 2, 1.5, 1];
		const weightedCount = dependents.reduce((sum, issue) => {
			return sum + priorityWeights[issue.priority];
		}, 0);

		// Normalize to 0-1 range (cap at 10 weighted units)
		return Math.min(1, weightedCount / 10);
	}

	// Get the most important blocker for a blocked issue
	getMostImportantBlocker(
		issueId: string
	): { blocker: Issue; importance: number } | null {
		const blockers = this.getBlockers(issueId);
		if (blockers.length === 0) return null;

		let best: { blocker: Issue; importance: number } | null = null;

		for (const blocker of blockers) {
			const importance = this.getBlockerImportance(blocker.id);
			// Also factor in the blocker's own priority
			const priorityBoost = (4 - blocker.priority) * 0.1; // P0 adds 0.4, P4 adds 0
			const totalScore = importance + priorityBoost;

			if (!best || totalScore > best.importance) {
				best = { blocker, importance: totalScore };
			}
		}

		return best;
	}

	// ===== Dependency-Weighted Priority Scheduling =====

	// Calculate the "unblock score" - how many tasks become ready when this task completes
	getUnblockScore(issueId: string): number {
		// Find tasks that directly depend on this issue
		const directDependents = this.issues.filter(
			i => i.dependencies.includes(issueId) && i.status !== 'closed'
		);

		let unblockCount = 0;
		for (const dep of directDependents) {
			// Check if completing issueId would make this dependent ready
			// (i.e., all OTHER dependencies are already closed)
			const otherBlockers = dep.dependencies.filter(d => d !== issueId);
			const allOthersClosed = otherBlockers.every(blockerId => {
				const blocker = this.getById(blockerId);
				return blocker?.status === 'closed';
			});
			if (allOthersClosed) {
				unblockCount++;
			}
		}
		return unblockCount;
	}

	// Get transitive unblock score (how many tasks eventually become unblocked)
	getTransitiveUnblockScore(issueId: string): number {
		const dependents = this.getTransitiveDependents(issueId);
		// Weight by priority: P0 tasks count more
		const priorityWeights = [5, 4, 3, 2, 1];
		return dependents.reduce((sum, issue) => {
			return sum + priorityWeights[issue.priority];
		}, 0);
	}

	// Get prioritized ready tasks using dependency-weighted scheduling
	// Factors: 1) Unblocks most tasks, 2) Highest priority, 3) Execution type preference
	getPrioritizedReady(): Array<{ issue: Issue; score: number; reasons: string[] }> {
		const readyIssues = this.ready;

		return readyIssues.map(issue => {
			const reasons: string[] = [];
			let score = 0;

			// Factor 1: Unblock score (most important - multiply by 10)
			const unblockScore = this.getUnblockScore(issue.id);
			const transitiveScore = this.getTransitiveUnblockScore(issue.id);
			score += unblockScore * 10;
			score += transitiveScore * 2;
			if (unblockScore > 0) {
				reasons.push(`Unblocks ${unblockScore} task${unblockScore > 1 ? 's' : ''}`);
			}
			if (transitiveScore > 5) {
				reasons.push(`High downstream impact`);
			}

			// Factor 2: Priority (P0 = 20 points, P4 = 0 points)
			const priorityScore = (4 - issue.priority) * 5;
			score += priorityScore;
			if (issue.priority <= 1) {
				reasons.push(`High priority (P${issue.priority})`);
			}

			// Factor 3: Execution type (AI-executable gets slight boost for automation)
			if (issue.executionType === 'automated' || issue.executionType === 'ai_assisted') {
				score += 2;
				reasons.push('Can be AI-assisted');
			}

			// Factor 4: Human-required tasks that have been waiting
			if (issue.executionType === 'human') {
				const age = Date.now() - new Date(issue.createdAt).getTime();
				const daysSinceCreated = age / (1000 * 60 * 60 * 24);
				if (daysSinceCreated > 3) {
					score += 3;
					reasons.push('Needs human attention');
				}
			}

			return { issue, score, reasons };
		}).sort((a, b) => b.score - a.score);
	}

	// Get the single best next task to work on
	getNextTask(): { issue: Issue; score: number; reasons: string[] } | null {
		const prioritized = this.getPrioritizedReady();
		return prioritized.length > 0 ? prioritized[0] : null;
	}

	// Get ready human-required tasks (for notifications)
	get readyHumanTasks(): Issue[] {
		return this.ready.filter(i => i.executionType === 'human');
	}

	// Check for AI timeouts and return issues that should be flagged
	checkAITimeouts(timeoutMinutes: number = 15): Issue[] {
		const now = Date.now();
		const timedOut: Issue[] = [];

		for (const issue of this.issues) {
			if (issue.aiAssignment && !issue.needsHuman && issue.status !== 'closed') {
				const lastActivity = new Date(issue.aiAssignment.lastActivityAt).getTime();
				const minutesInactive = (now - lastActivity) / (1000 * 60);

				if (minutesInactive > timeoutMinutes) {
					timedOut.push(issue);
				}
			}
		}

		return timedOut;
	}

	// ===== Budget Tracking Methods =====

	// Update budget estimate for an issue
	updateBudgetEstimate(issueId: string, estimate: BudgetEstimate): Issue | undefined {
		return this.update(issueId, { budgetEstimate: estimate });
	}

	// Record actual cost for an issue
	recordActualCost(
		issueId: string,
		amount: number,
		currency: string = 'USD',
		notes?: string
	): Issue | undefined {
		return this.update(issueId, {
			actualCost: {
				amount,
				currency,
				recordedAt: new Date().toISOString(),
				notes
			}
		});
	}

	// Clear budget estimate
	clearBudgetEstimate(issueId: string): Issue | undefined {
		return this.update(issueId, { budgetEstimate: undefined });
	}

	// Clear actual cost
	clearActualCost(issueId: string): Issue | undefined {
		return this.update(issueId, { actualCost: undefined });
	}

	// Computed: total estimated budget
	get totalBudget(): { min: number; max: number; expected: number; currency: string } {
		const issues = this.issues.filter(i => i.budgetEstimate && i.status !== 'closed');
		return {
			min: issues.reduce((sum, i) => sum + (i.budgetEstimate?.minCost || 0), 0),
			max: issues.reduce((sum, i) => sum + (i.budgetEstimate?.maxCost || 0), 0),
			expected: issues.reduce((sum, i) => sum + (i.budgetEstimate?.expectedCost || 0), 0),
			currency: issues[0]?.budgetEstimate?.currency || 'USD'
		};
	}

	// Computed: total actual costs
	get totalActualCost(): { amount: number; currency: string } {
		const issues = this.issues.filter(i => i.actualCost);
		return {
			amount: issues.reduce((sum, i) => sum + (i.actualCost?.amount || 0), 0),
			currency: issues[0]?.actualCost?.currency || 'USD'
		};
	}

	// Computed: issues over budget
	get overBudget(): Issue[] {
		return this.issues.filter(i => {
			if (!i.actualCost || !i.budgetEstimate) return false;
			return i.actualCost.amount > i.budgetEstimate.maxCost;
		});
	}

	// Computed: issues with cost estimates
	get withBudgetEstimates(): Issue[] {
		return this.issues.filter(i => i.budgetEstimate && i.status !== 'closed');
	}

	// Get budget variance (actual vs expected)
	getBudgetVariance(): { variance: number; percentOver: number } {
		const actual = this.totalActualCost.amount;
		const expected = this.totalBudget.expected;
		const variance = actual - expected;
		const percentOver = expected > 0 ? (variance / expected) * 100 : 0;
		return { variance, percentOver };
	}

	// ===== Scope Monitoring =====

	// Get all issues under a goal (root issue)
	getProjectScope(goalId: string): {
		goal: Issue | undefined;
		allIssues: Issue[];
		leafCount: number;
		containerCount: number;
		totalEstimatedCost: number;
	} {
		const goal = this.getById(goalId);
		const allIssues = this.getDescendants(goalId);
		const leaves = allIssues.filter(i => this.isLeaf(i.id));
		const containers = allIssues.filter(i => this.isContainer(i.id));
		const totalEstimatedCost = allIssues.reduce(
			(sum, i) => sum + (i.budgetEstimate?.expectedCost || 0),
			0
		);

		return {
			goal,
			allIssues,
			leafCount: leaves.length,
			containerCount: containers.length,
			totalEstimatedCost
		};
	}

	// Detect scope expansion by comparing current state to original scope boundary
	detectScopeExpansion(goalId: string): {
		hasExpanded: boolean;
		expansions: Array<{
			issue: Issue;
			reason: string;
		}>;
	} {
		const goal = this.getById(goalId);
		if (!goal?.scopeBoundary) {
			return { hasExpanded: false, expansions: [] };
		}

		const boundary = goal.scopeBoundary;
		const descendants = this.getDescendants(goalId);
		const expansions: Array<{ issue: Issue; reason: string }> = [];

		for (const issue of descendants) {
			// Check if issue title/description mentions excluded items
			const titleLower = issue.title.toLowerCase();
			const descLower = (issue.description || '').toLowerCase();

			for (const excluded of boundary.excludes) {
				const excludedLower = excluded.toLowerCase();
				if (titleLower.includes(excludedLower) || descLower.includes(excludedLower)) {
					expansions.push({
						issue,
						reason: `References excluded scope: "${excluded}"`
					});
				}
			}

			// Check if issue violates boundary conditions
			for (const condition of boundary.boundaryConditions) {
				// Simple keyword check - in production, use AI for semantic matching
				const conditionKeywords = condition.toLowerCase().split(/\s+/);
				const violatesCondition = conditionKeywords.some(
					kw => kw.length > 3 && (titleLower.includes(kw) || descLower.includes(kw))
				);
				if (violatesCondition) {
					expansions.push({
						issue,
						reason: `May violate boundary: "${condition}"`
					});
				}
			}
		}

		return {
			hasExpanded: expansions.length > 0,
			expansions
		};
	}

	// Add a scope boundary to a goal
	setScopeBoundary(
		goalId: string,
		boundary: ScopeBoundary
	): Issue | undefined {
		return this.update(goalId, { scopeBoundary: boundary });
	}

	// Add a constraint to an issue
	addConstraint(
		issueId: string,
		constraint: Omit<Constraint, 'id' | 'createdAt'>
	): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue) return undefined;

		const newConstraint: Constraint = {
			...constraint,
			id: generateId(),
			createdAt: new Date().toISOString()
		};

		const constraints = [...(issue.constraints || []), newConstraint];
		return this.update(issueId, { constraints });
	}

	// Remove a constraint
	removeConstraint(issueId: string, constraintId: string): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue?.constraints) return undefined;

		const constraints = issue.constraints.filter(c => c.id !== constraintId);
		return this.update(issueId, { constraints });
	}

	// Get all constraints for a goal (including inherited from ancestors)
	getEffectiveConstraints(issueId: string): Constraint[] {
		const constraints: Constraint[] = [];
		const ancestors = [this.getById(issueId), ...this.getAncestors(issueId)];

		for (const ancestor of ancestors) {
			if (ancestor?.constraints) {
				constraints.push(...ancestor.constraints);
			}
		}

		return constraints;
	}

	// ===== Concern Management =====

	// Add a concern to an issue
	addConcern(
		issueId: string,
		concern: Omit<Concern, 'id' | 'surfacedAt' | 'status'>
	): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue) return undefined;

		// Calculate tier based on impact, probability, urgency
		const priority = concern.impact * concern.probability * concern.urgency;
		let tier: 1 | 2 | 3 | 4;
		if (priority >= 18) tier = 1;      // Blocker
		else if (priority >= 9) tier = 2;  // Critical
		else if (priority >= 4) tier = 3;  // Consideration
		else tier = 4;                      // Background

		const newConcern: Concern = {
			...concern,
			id: generateId(),
			tier,
			surfacedAt: new Date().toISOString(),
			status: 'open'
		};

		const concerns = [...(issue.concerns || []), newConcern];
		return this.update(issueId, { concerns });
	}

	// Update concern status
	updateConcernStatus(
		issueId: string,
		concernId: string,
		status: Concern['status'],
		resolution?: string
	): Issue | undefined {
		const issue = this.getById(issueId);
		if (!issue?.concerns) return undefined;

		const concerns = issue.concerns.map(c => {
			if (c.id !== concernId) return c;
			return {
				...c,
				status,
				resolution,
				addressedAt: status !== 'open' ? new Date().toISOString() : undefined
			};
		});

		return this.update(issueId, { concerns });
	}

	// Get all open concerns for a goal and its descendants
	getOpenConcerns(goalId: string): Array<{ issue: Issue; concern: Concern }> {
		const issues = [this.getById(goalId), ...this.getDescendants(goalId)].filter(
			(i): i is Issue => i !== undefined
		);

		const concerns: Array<{ issue: Issue; concern: Concern }> = [];
		for (const issue of issues) {
			for (const concern of issue.concerns || []) {
				if (concern.status === 'open') {
					concerns.push({ issue, concern });
				}
			}
		}

		// Sort by tier (1 = blocker, most important first)
		return concerns.sort((a, b) => a.concern.tier - b.concern.tier);
	}

	// Get concerns by tier
	getConcernsByTier(goalId: string): Record<1 | 2 | 3 | 4, Array<{ issue: Issue; concern: Concern }>> {
		const allConcerns = this.getOpenConcerns(goalId);
		return {
			1: allConcerns.filter(c => c.concern.tier === 1),
			2: allConcerns.filter(c => c.concern.tier === 2),
			3: allConcerns.filter(c => c.concern.tier === 3),
			4: allConcerns.filter(c => c.concern.tier === 4)
		};
	}

	// ===== Plan Accuracy =====

	// Check if an issue is well-specified (has success criteria)
	isWellSpecified(issueId: string): boolean {
		const issue = this.getById(issueId);
		if (!issue) return false;

		// Has explicit well-specified flag
		if (issue.isWellSpecified !== undefined) return issue.isWellSpecified;

		// Has success criteria
		if (issue.successCriteria && issue.successCriteria.length > 0) return true;

		// Has clear description (heuristic: >50 chars)
		if (issue.description && issue.description.length > 50) return true;

		return false;
	}

	// Check plan accuracy: all leaves must be well-specified
	checkPlanAccuracy(goalId: string): {
		isAccurate: boolean;
		underspecifiedLeaves: Issue[];
		missingDecomposition: Issue[];
	} {
		const descendants = this.getDescendants(goalId);
		const leaves = descendants.filter(i => this.isLeaf(i.id));
		const underspecifiedLeaves = leaves.filter(i => !this.isWellSpecified(i.id));

		// Find containers that might need further decomposition
		// (e.g., single vague child, or children that don't cover parent's scope)
		const missingDecomposition: Issue[] = [];
		for (const issue of descendants) {
			if (this.isContainer(issue.id)) {
				const children = this.getChildren(issue.id);
				// Heuristic: container with only 1 child might need more breakdown
				if (children.length === 1 && !this.isWellSpecified(children[0].id)) {
					missingDecomposition.push(issue);
				}
			}
		}

		return {
			isAccurate: underspecifiedLeaves.length === 0 && missingDecomposition.length === 0,
			underspecifiedLeaves,
			missingDecomposition
		};
	}

	// Set success criteria for an issue
	setSuccessCriteria(issueId: string, criteria: string[]): Issue | undefined {
		return this.update(issueId, {
			successCriteria: criteria,
			isWellSpecified: criteria.length > 0
		});
	}
}

export const issueStore = new IssueStore();
