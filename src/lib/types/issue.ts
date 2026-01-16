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

// Image attachment for dialog messages
export interface ImageAttachment {
	id: string;
	data: string;        // base64 encoded image data
	mimeType: string;    // image/jpeg, image/png, etc.
	name?: string;       // original filename
}

// File attachment for storing documents on issues
export interface FileAttachment {
	id: string;
	name: string;           // original filename
	mimeType: string;       // application/json, text/csv, etc.
	size: number;           // file size in bytes
	data: string;           // base64 encoded file data
	uploadedAt: string;     // ISO timestamp
	parsedContent?: unknown; // Parsed content for structured files (JSON, CSV)
	summary?: string;       // AI-generated summary of the file
}

// Dialog message for task conversations
export interface DialogMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
	urlsReferenced?: string[];  // URLs the user shared
	actionsApplied?: string[];  // Actions that were applied from this message
	images?: ImageAttachment[]; // Images attached to this message
}

// AI Agenda - what the AI wants to do/ask/gather
// This drives proactive behavior when human is available or absent
export interface AIAgendaItem {
	id: string;
	type: 'question' | 'resource_request' | 'background_task' | 'access_request';
	priority: 'blocking' | 'important' | 'nice_to_have';
	status: 'pending' | 'in_progress' | 'completed' | 'blocked';
	createdAt: string;
	completedAt?: string;

	// For questions
	question?: string;
	context?: string;           // Why we need this
	suggestedAnswers?: string[]; // Help human answer quickly

	// For resource requests
	resourceType?: 'web_page' | 'document' | 'api' | 'account';
	resourceUrl?: string;
	resourceDescription?: string;

	// For access requests
	accessType?: 'read' | 'write' | 'admin';
	serviceName?: string;       // e.g., "Geico account", "Bank portal"
	whyNeeded?: string;

	// For background tasks
	taskDescription?: string;
	canRunWithoutHuman?: boolean;
	estimatedDuration?: string;
}

export interface AIAgenda {
	items: AIAgendaItem[];
	lastUpdated: string;
	nextHumanQuestion?: string;  // The most important thing to ask human
}

// === Uncertainty Modeling ===
// For outcomes that cannot be known with certainty

export type UncertaintyType =
	| 'market_returns'      // Investment performance
	| 'inflation'           // Cost of living changes
	| 'longevity'           // How long someone lives
	| 'healthcare_costs'    // Medical expenses
	| 'income'              // Employment/earnings
	| 'interest_rates'      // Borrowing/savings rates
	| 'property_values'     // Real estate
	| 'exchange_rates'      // Currency
	| 'project_duration'    // How long work takes
	| 'project_cost'        // How much work costs
	| 'custom';             // User-defined

export type ModelingApproach =
	| 'monte_carlo'         // Random sampling from distributions
	| 'scenario_analysis'   // Discrete named scenarios
	| 'sensitivity'         // Vary one parameter at a time
	| 'historical_sim'      // Use actual historical sequences
	| 'stress_test'         // Extreme but plausible scenarios
	| 'robust_optimization' // Optimize for worst case
	| 'bayesian'            // Update beliefs with evidence
	| 'real_options';       // Value flexibility/optionality

export type DistributionType =
	| 'normal'              // Gaussian - symmetric, thin tails
	| 'log_normal'          // Prices, wealth (always positive)
	| 'student_t'           // Fat tails (market returns)
	| 'pareto'              // Power law (extreme events)
	| 'uniform'             // Equal probability in range
	| 'triangular'          // Min/mode/max estimate
	| 'empirical'           // From historical data
	| 'mixture';            // Regime switching (bull/bear)

export interface UncertainParameter {
	id: string;
	name: string;                         // e.g., "Annual stock return"
	uncertaintyType: UncertaintyType;
	description?: string;

	// Distribution specification
	distribution: DistributionType;
	parameters: {
		mean?: number;
		stdDev?: number;
		min?: number;
		max?: number;
		mode?: number;                      // For triangular
		degreesOfFreedom?: number;          // For Student's t
		alpha?: number;                     // For Pareto
		historicalData?: number[];          // For empirical
		regimes?: Array<{                   // For mixture
			name: string;
			probability: number;
			distribution: DistributionType;
			parameters: Record<string, number>;
		}>;
	};

	// For sensitivity analysis
	baseCase?: number;
	lowCase?: number;
	highCase?: number;

	// Source of estimates
	source: 'historical' | 'expert' | 'user' | 'ai_suggested';
	confidence?: number;                  // How confident in these parameters
	rationale?: string;                   // Why these values
}

export interface Scenario {
	id: string;
	name: string;                         // e.g., "Bull market", "Stagflation"
	description: string;
	probability?: number;                 // Estimated likelihood (0-1)
	parameterOverrides: Record<string, number>; // Override uncertain params
	outcome?: number;                     // Computed result
}

export interface SimulationConfig {
	approach: ModelingApproach;
	iterations?: number;                  // For Monte Carlo (e.g., 10000)
	timeHorizon?: number;                 // Years to simulate
	confidenceLevel?: number;             // e.g., 0.95 for 95% CI

	// For scenario analysis
	scenarios?: Scenario[];

	// For sensitivity analysis
	parameterToVary?: string;             // Which parameter to sweep
	sweepRange?: { min: number; max: number; steps: number };
}

export interface SimulationResult {
	id: string;
	config: SimulationConfig;
	runAt: string;

	// Monte Carlo results
	outcomes?: number[];                  // All sampled outcomes
	percentiles?: Record<number, number>; // e.g., {5: 50000, 50: 120000, 95: 300000}
	mean?: number;
	stdDev?: number;
	probabilityOfRuin?: number;           // P(outcome < threshold)

	// Scenario results
	scenarioOutcomes?: Record<string, number>;

	// Sensitivity results
	sensitivityCurve?: Array<{ paramValue: number; outcome: number }>;

	// Interpretation
	summary: string;                      // AI-generated plain English summary
	recommendations?: string[];           // What to do based on results
}

export interface UncertaintyAnalysis {
	uncertainParameters: UncertainParameter[];
	simulations: SimulationResult[];
	suggestedApproach?: ModelingApproach;
	approachRationale?: string;
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

	// === Attached Files ===
	files?: FileAttachment[];                // Files uploaded to this task

	// === AI Agenda ===
	aiAgenda?: AIAgenda;                     // What AI wants to do/ask/gather

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

	// === Uncertainty modeling ===
	uncertaintyAnalysis?: UncertaintyAnalysis; // For outcomes that cannot be known
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
