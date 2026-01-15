export type IssueStatus = 'open' | 'in_progress' | 'closed';
export type IssuePriority = 0 | 1 | 2 | 3 | 4;
export type IssueType = 'task' | 'bug' | 'feature';
export type NeedsHumanTrigger = 'ai_blocked' | 'timeout' | 'user_flagged';

// Execution type: who does this task?
export type ExecutionType =
	| 'automated'      // AI can complete without human involvement
	| 'human'          // Only a human can do this (legal, physical, etc.)
	| 'ai_assisted'    // AI does the work, human validates
	| 'human_assisted'; // Human does the work with AI guidance

// AI assignment tracking
export interface AIAssignment {
	modelId: string;        // e.g., "anthropic/claude-sonnet-4"
	modelName: string;      // e.g., "Claude Sonnet 4"
	assignedAt: string;     // ISO timestamp
	lastActivityAt: string; // Updated on AI progress
}

// Human attention tracking
export interface NeedsHumanReason {
	trigger: NeedsHumanTrigger;
	reason: string;
	flaggedAt: string;
	aiModelId?: string;     // Which AI flagged it (for ai_blocked)
}

// Benchmark result for tracking classification changes
export interface BenchmarkResult {
	currentType: ExecutionType;
	suggestedType: ExecutionType;
	confidence: number;
	reasoning: string;
	changed: boolean;
	benchmarkedAt: string;
	modelUsed: string;
}

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
	aiAssignment?: AIAssignment;
	needsHuman?: NeedsHumanReason;
	// Execution type classification
	executionType?: ExecutionType;           // Who does this task?
	aiConfidence?: number;                   // 0-1, how confident AI is it can help
	validationRequired?: boolean;            // Does this need human sign-off?
	executionReason?: string;                // Why this execution type was chosen
	// Benchmark history
	lastBenchmark?: BenchmarkResult;         // Most recent AI capability benchmark
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

export const PRIORITY_DESCRIPTIONS: Record<IssuePriority, string> = {
	0: 'Drop everything. This is blocking other people or causing major damage right now.',
	1: 'Do this soon. Important work that should be done this week.',
	2: 'Normal priority. Plan to do this but no rush.',
	3: 'Nice to have. Do when higher priorities are done.',
	4: 'Maybe someday. Park here and revisit later.'
};

export const STATUS_LABELS: Record<IssueStatus, string> = {
	open: 'Open',
	in_progress: 'In Progress',
	closed: 'Closed'
};

export const STATUS_DESCRIPTIONS: Record<IssueStatus, string> = {
	open: 'Ready to start. No blockers preventing work.',
	in_progress: 'Currently being worked on.',
	closed: 'Completed and done.'
};

export const TYPE_LABELS: Record<IssueType, string> = {
	task: 'Task',
	bug: 'Bug',
	feature: 'Feature'
};

export const EXECUTION_TYPE_LABELS: Record<ExecutionType, string> = {
	automated: 'AI Can Do This',
	human: 'You Must Do This',
	ai_assisted: 'AI Does, You Verify',
	human_assisted: 'You Do, AI Helps'
};

export const EXECUTION_TYPE_DESCRIPTIONS: Record<ExecutionType, string> = {
	automated: 'The AI can complete this task without your involvement',
	human: 'Only you can do this (physical action, legal signature, decision)',
	ai_assisted: 'AI will do the work, but you should check the result',
	human_assisted: 'You do the work, AI provides guidance and answers'
};
