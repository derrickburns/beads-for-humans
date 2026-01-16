export type IssueStatus = 'open' | 'in_progress' | 'closed' | 'failed';
export type IssuePriority = 0 | 1 | 2 | 3 | 4;
export type NeedsHumanTrigger = 'ai_blocked' | 'timeout' | 'user_flagged';

// Extended issue types for planning
export type IssueType =
	| 'goal'        // High-level outcome to achieve (container)
	| 'task'        // Work to do (leaf or container)
	| 'assumption'  // Something we're assuming is true
	| 'risk'        // Something that could go wrong
	| 'contingency' // Plan B if risk materializes
	| 'question'    // Needs research or decision
	| 'constraint'  // Hard limit (budget, timeline, scope)
	| 'bug'         // Something broken
	| 'feature';    // Enhancement

// How children combine to complete parent
export type DecompositionType =
	| 'and'          // All children must complete (default)
	| 'or_fallback'  // Try in order until one succeeds
	| 'or_race'      // Parallel, first success wins
	| 'choice';      // Explore all, human picks winner

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

// Dialog message for task conversations
export interface DialogMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
	urlsReferenced?: string[];  // URLs the user shared
	actionsApplied?: string[];  // Actions that were applied from this message
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

// Budget tracking for cost estimation
export interface BudgetEstimate {
	minCost: number;
	maxCost: number;
	expectedCost: number;
	currency: string;
	confidence: number;
	reasoning: string;
	factors: string[];
	alternatives?: BudgetAlternative[];
	estimatedAt: string;
	location?: string;
}

export interface BudgetAlternative {
	description: string;
	savings: number;
	tradeoff: string;
}

export interface ActualCost {
	amount: number;
	currency: string;
	recordedAt: string;
	notes?: string;
}

// Scope boundary defines what's in/out of scope for a goal
export interface ScopeBoundary {
	description: string;           // "Kitchen only"
	includes: string[];            // What's explicitly in scope
	excludes: string[];            // What's explicitly out of scope
	boundaryConditions: string[];  // "Do not affect other rooms"
}

// Constraint types
export type ConstraintType =
	| 'scope'      // What's in/out of scope
	| 'budget'     // Cost limits
	| 'timeline'   // Time limits
	| 'quality'    // Quality requirements
	| 'must_have'  // Required features/outcomes
	| 'must_not'   // Things to avoid
	| 'boundary';  // Physical/logical boundaries

// Constraints limit the solution space
export interface Constraint {
	id: string;
	type: ConstraintType;
	description: string;
	rationale: string;
	value?: string | number;        // e.g., "$50000" for budget
	unit?: string;                  // e.g., "USD", "days"
	communicateTo?: string[];       // Stakeholders who need to know
	negotiable: boolean;
	source: 'user' | 'ai_suggested' | 'discovered';
	createdAt: string;
}

// Concern types for red-teaming
export type ConcernType =
	| 'assumption'      // Something we're taking for granted
	| 'risk'            // What could go wrong
	| 'gap'             // Missing information
	| 'dependency'      // External factor we don't control
	| 'scope_expansion' // Detected scope creep
	| 'hidden_work';    // Work revealed by other work

// Priority tier for progressive disclosure
export type ConcernTier = 1 | 2 | 3 | 4;
// 1 = Blocker (must address), 2 = Critical, 3 = Consideration, 4 = Background

// Concerns surfaced by AI during planning
export interface Concern {
	id: string;
	type: ConcernType;
	title: string;
	description: string;
	impact: 1 | 2 | 3;        // How bad if it goes wrong (3 = severe)
	probability: 1 | 2 | 3;   // How likely (3 = very likely)
	urgency: 1 | 2 | 3;       // Time-sensitive? (3 = immediate)
	tier: ConcernTier;        // Computed disclosure tier
	relatedIssueIds: string[];// Issues this concern relates to
	suggestedActions: SuggestedConcernAction[];
	status: 'open' | 'addressed' | 'deferred' | 'accepted';
	userAware: boolean;       // Did user mention this?
	surfacedAt: string;
	addressedAt?: string;
	resolution?: string;
}

// Actions suggested to address a concern
export interface SuggestedConcernAction {
	type: 'expand_scope' | 'add_constraint' | 'add_contingency' | 'research' | 'split_project';
	description: string;
	creates?: {
		issueType: IssueType;
		title: string;
		description: string;
	};
}

// Shared resource that may affect scope
export interface SharedResource {
	id: string;
	name: string;              // "Knob and tube wiring"
	type: string;              // "electrical", "plumbing", "structural"
	affectsAreas: string[];    // ["kitchen", "dining room", "bedroom"]
	inScopeAreas: string[];    // ["kitchen"]
	outOfScopeAreas: string[]; // ["dining room", "bedroom"]
	riskDescription: string;   // "Removal may cut power to other rooms"
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
	dependencies: string[]; // IDs of issues this depends on (blocking)

	// === Hierarchy (parent-child decomposition) ===
	parentId?: string;                       // This issue is a child of parent
	decompositionType?: DecompositionType;   // How children combine (default: 'and')

	// === Dialog History ===
	dialogHistory?: DialogMessage[];         // Conversation history for this task

	// === Scope & Constraints ===
	scopeBoundary?: ScopeBoundary;           // What's in/out of scope (for goals)
	constraints?: Constraint[];              // Limits on this issue

	// === Concerns (red-teaming) ===
	concerns?: Concern[];                    // Risks, assumptions, gaps
	sharedResources?: SharedResource[];      // Resources that may affect other areas

	// === Failure handling ===
	failureReason?: string;                  // Why this failed (if status === 'failed')

	// === Success criteria ===
	successCriteria?: string[];              // What "done" looks like
	isWellSpecified?: boolean;               // Has clear outcome definition

	// === AI Assignment ===
	aiAssignment?: AIAssignment;
	needsHuman?: NeedsHumanReason;

	// === Execution type classification ===
	executionType?: ExecutionType;           // Who does this task?
	aiConfidence?: number;                   // 0-1, how confident AI is it can help
	validationRequired?: boolean;            // Does this need human sign-off?
	executionReason?: string;                // Why this execution type was chosen

	// === Benchmark history ===
	lastBenchmark?: BenchmarkResult;         // Most recent AI capability benchmark

	// === Budget tracking ===
	budgetEstimate?: BudgetEstimate;         // AI-estimated cost range
	actualCost?: ActualCost;                 // User-recorded actual cost
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
	closed: 'Closed',
	failed: 'Failed'
};

export const STATUS_DESCRIPTIONS: Record<IssueStatus, string> = {
	open: 'Ready to start. No blockers preventing work.',
	in_progress: 'Currently being worked on.',
	closed: 'Completed and done.',
	failed: 'Could not be completed. May need alternative approach.'
};

export const TYPE_LABELS: Record<IssueType, string> = {
	goal: 'Goal',
	task: 'Task',
	assumption: 'Assumption',
	risk: 'Risk',
	contingency: 'Contingency',
	question: 'Question',
	constraint: 'Constraint',
	bug: 'Bug',
	feature: 'Feature'
};

export const TYPE_DESCRIPTIONS: Record<IssueType, string> = {
	goal: 'High-level outcome to achieve. Contains subtasks.',
	task: 'Specific work to be done.',
	assumption: 'Something we are assuming is true. Should be validated.',
	risk: 'Something that could go wrong. Needs mitigation.',
	contingency: 'Backup plan if primary approach fails.',
	question: 'Open question that needs research or decision.',
	constraint: 'Hard limit that shapes the solution.',
	bug: 'Something that is broken and needs fixing.',
	feature: 'New capability to add.'
};

export const DECOMPOSITION_LABELS: Record<DecompositionType, string> = {
	and: 'All Required',
	or_fallback: 'Try Until Success',
	or_race: 'First Success Wins',
	choice: 'Pick One'
};

export const DECOMPOSITION_DESCRIPTIONS: Record<DecompositionType, string> = {
	and: 'All children must complete for parent to complete.',
	or_fallback: 'Try children in order until one succeeds.',
	or_race: 'Run children in parallel, first success completes parent.',
	choice: 'Explore all options, then choose which to pursue.'
};

export const CONCERN_TYPE_LABELS: Record<ConcernType, string> = {
	assumption: 'Assumption',
	risk: 'Risk',
	gap: 'Information Gap',
	dependency: 'External Dependency',
	scope_expansion: 'Scope Expansion',
	hidden_work: 'Hidden Work'
};

export const CONCERN_TIER_LABELS: Record<ConcernTier, string> = {
	1: 'Blocker',
	2: 'Critical',
	3: 'Consideration',
	4: 'Background'
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
