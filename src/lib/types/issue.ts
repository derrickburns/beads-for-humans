export type IssueStatus = 'open' | 'in_progress' | 'closed';
export type IssuePriority = 0 | 1 | 2 | 3 | 4;
export type IssueType = 'task' | 'bug' | 'feature';

export interface Issue {
	id: string;
	title: string;
	description: string;
	status: IssueStatus;
	priority: IssuePriority;
	type: IssueType;
	createdAt: string;
	updatedAt: string;
	dependencies: string[]; // IDs of issues this depends on
}

export interface RelationshipSuggestion {
	targetId: string;
	type: 'dependency' | 'blocks' | 'related';
	confidence: number;
	reason: string;
}

// A set of graph changes that together improve the dependency structure
export interface GraphImprovement {
	id: string; // Unique ID for this improvement set
	description: string; // Human-readable description of the improvement
	confidence: number;
	changes: GraphChange[];
}

export interface GraphChange {
	action: 'add' | 'remove';
	fromId: string; // Issue that has/will have the dependency
	toId: string; // Issue being depended on
	reason: string;
}

export interface SuggestedAction {
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
	relationship: {
		type: 'dependency' | 'blocks' | 'related';
		targetId: string;
		reason: string;
	};
}

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
	0: 'P0 - Critical',
	1: 'P1 - High',
	2: 'P2 - Medium',
	3: 'P3 - Low',
	4: 'P4 - Backlog'
};

export const STATUS_LABELS: Record<IssueStatus, string> = {
	open: 'Open',
	in_progress: 'In Progress',
	closed: 'Closed'
};

export const TYPE_LABELS: Record<IssueType, string> = {
	task: 'Task',
	bug: 'Bug',
	feature: 'Feature'
};
