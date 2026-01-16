# API Reference

Complete reference for Beads types, store methods, and API endpoints.

---

## Data Types

### Issue

The core data structure representing a task, goal, or any tracked item.

```typescript
interface Issue {
  // Identity
  id: string;                          // Unique identifier (UUID)

  // Content
  title: string;                       // Short descriptive title
  description: string;                 // Detailed description

  // Classification
  type: IssueType;                     // Category of issue
  priority: IssuePriority;             // 0 (critical) to 4 (backlog)
  status: IssueStatus;                 // Current state

  // Dependencies
  dependencies: string[];              // IDs of issues this depends on

  // Hierarchy
  parentId?: string;                   // Parent container ID
  decompositionType?: DecompositionType; // How children combine

  // Execution
  executionType?: ExecutionType;       // Who should do this
  aiConfidence?: number;               // AI confidence in execution type (0-1)
  validationRequired?: boolean;        // Needs human review
  executionReason?: string;            // Why this execution type

  // AI Assignment
  aiAssignment?: AIAssignment;         // Currently assigned AI
  needsHuman?: NeedsHumanReason;       // Why human attention needed

  // Scope & Constraints
  scopeBoundary?: ScopeBoundary;       // What's in/out of scope
  constraints?: Constraint[];          // Explicit limitations

  // Concerns
  concerns?: Concern[];                // Risks, assumptions, gaps
  sharedResources?: SharedResource[];  // Resources affecting multiple areas

  // Completion
  successCriteria?: string[];          // Measurable outcomes
  isWellSpecified?: boolean;           // Has sufficient detail
  failureReason?: string;              // Why the task failed

  // Estimates
  budgetEstimate?: BudgetEstimate;     // Cost estimate
  durationEstimate?: DurationEstimate; // Time estimate

  // Timestamps
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
}
```

### IssueType

Category of the issue.

```typescript
type IssueType =
  | 'goal'        // High-level outcome to achieve
  | 'task'        // Work to be done
  | 'assumption'  // Something assumed to be true
  | 'risk'        // Something that could go wrong
  | 'contingency' // Backup plan if risk materializes
  | 'question'    // Needs research or decision
  | 'constraint'  // Hard limitation
  | 'bug'         // Something broken
  | 'feature';    // Enhancement request
```

### IssueStatus

Current state of the issue.

```typescript
type IssueStatus =
  | 'open'        // Not started
  | 'in_progress' // Currently being worked
  | 'closed'      // Complete
  | 'failed';     // Could not complete
```

### IssuePriority

Urgency level (lower is higher priority).

```typescript
type IssuePriority = 0 | 1 | 2 | 3 | 4;

// Labels:
// 0: Critical
// 1: High
// 2: Medium
// 3: Low
// 4: Backlog
```

### DecompositionType

How children combine to complete a parent.

```typescript
type DecompositionType =
  | 'and'          // All children must complete
  | 'or_fallback'  // Try in order until one succeeds
  | 'or_race'      // Parallel, first success wins
  | 'choice';      // Explore all, human picks winner
```

### ExecutionType

Who should perform the work.

```typescript
type ExecutionType =
  | 'automated'      // AI can do without supervision
  | 'human'          // Only human can do
  | 'ai_assisted'    // AI does, human reviews
  | 'human_assisted'; // Human does, AI supports
```

### Constraint

An explicit limitation on the project.

```typescript
interface Constraint {
  id: string;
  type: ConstraintType;
  description: string;
  rationale: string;
  value?: string | number;
  unit?: string;
  communicateTo?: string[];      // Stakeholders to inform
  negotiable: boolean;
  source: 'user' | 'ai_suggested' | 'discovered';
  createdAt: string;
}

type ConstraintType =
  | 'budget'     // Cost limit
  | 'timeline'   // Time limit
  | 'scope'      // Boundary limit
  | 'must_have'  // Required feature
  | 'must_not'   // Prohibited approach
  | 'boundary';  // Scope detection rule
```

### Concern

A risk, assumption, or gap identified in planning.

```typescript
interface Concern {
  id: string;
  type: ConcernType;
  title: string;
  description: string;
  impact: 1 | 2 | 3;           // Severity (3 = severe)
  probability: 1 | 2 | 3;      // Likelihood (3 = very likely)
  urgency: 1 | 2 | 3;          // Time-sensitivity (3 = immediate)
  tier: ConcernTier;           // Computed priority tier
  relatedIssueIds: string[];   // Issues this affects
  suggestedActions: SuggestedConcernAction[];
  status: 'open' | 'addressed' | 'deferred' | 'accepted';
  userAware: boolean;          // Did user mention this?
  surfacedAt: string;
  addressedAt?: string;
  resolution?: string;
}

type ConcernType =
  | 'assumption'       // Something taken for granted
  | 'risk'             // Something that could go wrong
  | 'gap'              // Missing piece in plan
  | 'dependency'       // External factor relied upon
  | 'scope_expansion'  // Work outside original scope
  | 'hidden_work';     // Work not represented in plan

type ConcernTier = 1 | 2 | 3 | 4;
// 1: Blocker (must resolve now)
// 2: Critical (high risk if ignored)
// 3: Consideration (worth thinking about)
// 4: Background (good to know)
```

### ScopeBoundary

Defines what's in and out of scope.

```typescript
interface ScopeBoundary {
  includes: string[];          // Explicitly in scope
  excludes: string[];          // Explicitly out of scope
  boundaryConditions: string[]; // Rules for determining scope
}
```

### AIAssignment

Tracks AI assignment to a task.

```typescript
interface AIAssignment {
  modelId: string;        // e.g., "anthropic/claude-sonnet-4"
  modelName: string;      // e.g., "Claude Sonnet 4"
  assignedAt: string;     // ISO timestamp
  lastActivityAt: string; // Updated on progress
}
```

### NeedsHumanReason

Why a task needs human attention.

```typescript
interface NeedsHumanReason {
  trigger: 'ai_blocked' | 'timeout' | 'user_flagged';
  reason: string;
  flaggedAt: string;
  aiModelId?: string;
}
```

### DialogMessage

A message in the task conversation history.

```typescript
interface DialogMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  urlsReferenced?: string[];   // URLs the user shared
  actionsApplied?: string[];   // Actions taken from this message
}
```

### AIAgendaItem

An item in the AI's agenda - something it wants to do, ask, or gather.

```typescript
interface AIAgendaItem {
  id: string;
  type: 'question' | 'resource_request' | 'background_task' | 'access_request';
  priority: 'blocking' | 'important' | 'nice_to_have';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  createdAt: string;
  completedAt?: string;

  // For questions
  question?: string;
  context?: string;
  suggestedAnswers?: string[];

  // For resource requests
  resourceType?: 'web_page' | 'document' | 'api' | 'account';
  resourceUrl?: string;
  resourceDescription?: string;

  // For access requests
  accessType?: 'read' | 'write' | 'admin';
  serviceName?: string;
  whyNeeded?: string;

  // For background tasks
  taskDescription?: string;
  canRunWithoutHuman?: boolean;
  estimatedDuration?: string;
}
```

### AIAgenda

The AI's agenda for a task - what it's tracking and waiting for.

```typescript
interface AIAgenda {
  items: AIAgendaItem[];
  lastUpdated: string;
  nextHumanQuestion?: string;
}
```

### SessionState

Session tracking for continuity.

```typescript
interface SessionState {
  lastTaskId: string | null;
  lastTaskTitle: string | null;
  lastInteractionAt: string | null;
  pendingQuestions: PendingQuestion[];
  sessionStartedAt: string | null;
  totalInteractions: number;
}

interface PendingQuestion {
  taskId: string;
  taskTitle: string;
  question: string;
  askedAt: string;
  context?: string;
}
```

---

## Store Methods

The `issueStore` singleton provides all issue operations.

### Basic CRUD

#### create(data)
Create a new issue.

```typescript
issueStore.create({
  title: string;
  description?: string;
  type?: IssueType;
  priority?: IssuePriority;
  dependencies?: string[];
  parentId?: string;
  executionType?: ExecutionType;
  // ... other Issue fields
}): Issue | undefined
```

#### getById(id)
Get an issue by ID.

```typescript
issueStore.getById(id: string): Issue | undefined
```

#### update(id, updates)
Update an issue.

```typescript
issueStore.update(
  id: string,
  updates: Partial<Issue>
): Issue | undefined
```

#### delete(id)
Delete an issue and clean up references.

```typescript
issueStore.delete(id: string): void
```

#### updateStatus(id, status)
Update issue status.

```typescript
issueStore.updateStatus(
  id: string,
  status: IssueStatus
): Issue | undefined
```

### Dependencies

#### addDependency(issueId, dependsOnId)
Add a dependency (issueId depends on dependsOnId).

```typescript
issueStore.addDependency(
  issueId: string,
  dependsOnId: string
): {
  success: boolean;
  error?: string;
  cycleBreakOptions?: Array<{from: string; to: string}>;
}
```

#### removeDependency(issueId, dependsOnId)
Remove a dependency.

```typescript
issueStore.removeDependency(
  issueId: string,
  dependsOnId: string
): void
```

#### reverseDependency(issueId, dependsOnId)
Reverse dependency direction.

```typescript
issueStore.reverseDependency(
  issueId: string,
  dependsOnId: string
): { success: boolean; error?: string }
```

#### getBlockers(issueId)
Get incomplete issues blocking this one.

```typescript
issueStore.getBlockers(issueId: string): Issue[]
```

#### getBlocking(issueId)
Get issues waiting on this one.

```typescript
issueStore.getBlocking(issueId: string): Issue[]
```

### Hierarchy

#### getChildren(issueId)
Get direct children.

```typescript
issueStore.getChildren(issueId: string): Issue[]
```

#### getDescendants(issueId)
Get all descendants (recursive).

```typescript
issueStore.getDescendants(issueId: string): Issue[]
```

#### getParent(issueId)
Get parent container.

```typescript
issueStore.getParent(issueId: string): Issue | undefined
```

#### getAncestors(issueId)
Get all ancestors up to root.

```typescript
issueStore.getAncestors(issueId: string): Issue[]
```

#### isContainer(issueId)
Check if issue has children.

```typescript
issueStore.isContainer(issueId: string): boolean
```

#### isLeaf(issueId)
Check if issue has no children.

```typescript
issueStore.isLeaf(issueId: string): boolean
```

### Decomposition

#### decompose(parentId, children, decompositionType)
Decompose a task into subtasks.

```typescript
issueStore.decompose(
  parentId: string,
  children: Array<{
    title: string;
    description: string;
    type?: IssueType;
    priority?: IssuePriority;
    dependencies?: string[];
    executionType?: ExecutionType;
  }>,
  decompositionType?: DecompositionType
): Issue[]
```

#### createChild(parentId, data)
Create a single child.

```typescript
issueStore.createChild(
  parentId: string,
  data: { title: string; description?: string; type?: IssueType; priority?: IssuePriority }
): Issue | undefined
```

#### getDerivedStatus(issueId)
Compute container status from children.

```typescript
issueStore.getDerivedStatus(issueId: string): IssueStatus
```

#### markFailed(issueId, reason)
Mark an issue as failed.

```typescript
issueStore.markFailed(
  issueId: string,
  reason: string
): Issue | undefined
```

### Scope & Constraints

#### setScopeBoundary(goalId, boundary)
Set scope boundary on a goal.

```typescript
issueStore.setScopeBoundary(
  goalId: string,
  boundary: ScopeBoundary
): Issue | undefined
```

#### detectScopeExpansion(goalId)
Check for scope violations.

```typescript
issueStore.detectScopeExpansion(goalId: string): {
  hasExpanded: boolean;
  expansions: Array<{ issue: Issue; reason: string }>;
}
```

#### addConstraint(issueId, constraint)
Add a constraint to an issue.

```typescript
issueStore.addConstraint(
  issueId: string,
  constraint: Omit<Constraint, 'id' | 'createdAt'>
): Issue | undefined
```

#### removeConstraint(issueId, constraintId)
Remove a constraint.

```typescript
issueStore.removeConstraint(
  issueId: string,
  constraintId: string
): Issue | undefined
```

#### getEffectiveConstraints(issueId)
Get all constraints including inherited ones.

```typescript
issueStore.getEffectiveConstraints(issueId: string): Constraint[]
```

### Concerns

#### addConcern(issueId, concern)
Add a concern (tier computed automatically).

```typescript
issueStore.addConcern(
  issueId: string,
  concern: Omit<Concern, 'id' | 'surfacedAt' | 'status'>
): Issue | undefined
```

#### updateConcernStatus(issueId, concernId, status, resolution?)
Update concern status.

```typescript
issueStore.updateConcernStatus(
  issueId: string,
  concernId: string,
  status: Concern['status'],
  resolution?: string
): Issue | undefined
```

#### getOpenConcerns(goalId)
Get all open concerns for a goal and descendants.

```typescript
issueStore.getOpenConcerns(goalId: string): Array<{
  issue: Issue;
  concern: Concern;
}>
```

#### getConcernsByTier(goalId)
Get concerns organized by tier.

```typescript
issueStore.getConcernsByTier(goalId: string): Record<
  1 | 2 | 3 | 4,
  Array<{ issue: Issue; concern: Concern }>
>
```

### Dialog History

#### addDialogMessage(issueId, message)
Add a message to a task's dialog history.

```typescript
issueStore.addDialogMessage(
  issueId: string,
  message: {
    role: 'user' | 'assistant';
    content: string;
    urlsReferenced?: string[];
    actionsApplied?: string[];
  }
): Issue | undefined
```

#### getDialogHistory(issueId)
Get the dialog history for a task.

```typescript
issueStore.getDialogHistory(issueId: string): DialogMessage[]
```

#### getRelatedDialogContext(issueId)
Get dialog history from related tasks (parent, siblings, blockers).

```typescript
issueStore.getRelatedDialogContext(issueId: string): Array<{
  issueId: string;
  issueTitle: string;
  relationship: 'parent' | 'sibling' | 'child' | 'blocker';
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
}>
```

### Plan Accuracy

#### checkPlanAccuracy(goalId)
Validate plan completeness.

```typescript
issueStore.checkPlanAccuracy(goalId: string): {
  isAccurate: boolean;
  underspecifiedLeaves: Issue[];
  missingDecomposition: Issue[];
}
```

#### setSuccessCriteria(issueId, criteria)
Set success criteria.

```typescript
issueStore.setSuccessCriteria(
  issueId: string,
  criteria: string[]
): Issue | undefined
```

### Project Metrics

#### getProjectScope(goalId)
Get aggregate metrics for a goal.

```typescript
issueStore.getProjectScope(goalId: string): {
  goal: Issue | undefined;
  allIssues: Issue[];
  leafCount: number;
  containerCount: number;
  totalEstimatedCost: number;
}
```

### Derived Getters

```typescript
// All issues
issueStore.issues: Issue[]

// Root issues (no parent)
issueStore.roots: Issue[]

// Leaf issues (no children)
issueStore.leaves: Issue[]

// Actionable issues (leaves with no blockers)
issueStore.actionable: Issue[]

// Issues needing human attention
issueStore.needsHuman: Issue[]

// Issues assigned to AI
issueStore.aiAssigned: Issue[]
```

---

## API Endpoints

### POST /api/red-team-plan

AI-powered planning assistant actions.

#### Request

```typescript
{
  action: 'refine_goal' | 'analyze_risks' | 'suggest_decomposition' |
          'detect_scope_expansion' | 'validate_accuracy';
  goal: {
    id: string;
    title: string;
    description?: string;
    type: IssueType;
    status: IssueStatus;
    scopeBoundary?: ScopeBoundary;
    constraints?: Constraint[];
    successCriteria?: string[];
  };
  context: {
    existingIssues: Issue[];
    constraints?: Constraint[];
    scopeBoundary?: ScopeBoundary;
  };
  model?: string;
  apiKey?: string;
}
```

#### Response by Action

**refine_goal**:
```typescript
{
  refinedGoal: {
    title: string;
    description: string;
    successCriteria: string[];
  };
  scopeBoundary?: ScopeBoundary;
  constraints?: Constraint[];
}
```

**analyze_risks**:
```typescript
{
  concerns: Array<Omit<Concern, 'id' | 'surfacedAt' | 'status'>>;
}
```

**suggest_decomposition**:
```typescript
{
  subtasks: Array<{
    title: string;
    description: string;
    type?: IssueType;
    executionType?: ExecutionType;
  }>;
  decompositionType?: DecompositionType;
  sharedResources?: string[];
}
```

**detect_scope_expansion**:
```typescript
{
  hasExpanded: boolean;
  expansions: Array<{
    issueTitle: string;
    reason: string;
    options: string[]; // ['EXPAND', 'CONSTRAIN', 'SPLIT']
  }>;
}
```

**validate_accuracy**:
```typescript
{
  isAccurate: boolean;
  issues: Array<{
    title: string;
    problem: string;
    suggestion: string;
  }>;
}
```

### POST /api/expand-issue

Expand brief input into full issue.

#### Request
```typescript
{
  input: string;
  model?: string;
  apiKey?: string;
}
```

#### Response
```typescript
{
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  executionType?: ExecutionType;
  aiConfidence?: number;
  validationRequired?: boolean;
  executionReason?: string;
}
```

### POST /api/suggest-follow-ups

Suggest related tasks after issue creation.

#### Request
```typescript
{
  issue: Issue;
  existingIssues: Issue[];
  model?: string;
  apiKey?: string;
}
```

#### Response
```typescript
{
  suggestions: Array<{
    title: string;
    description: string;
    type: IssueType;
    priority: IssuePriority;
    relationship: 'prerequisite' | 'follow-up' | 'parallel' | 'verification';
    reason: string;
  }>;
}
```

### POST /api/suggest-relationships

Suggest dependencies between issues.

#### Request
```typescript
{
  issue: { title: string; description?: string };
  existingIssues: Issue[];
  model?: string;
  apiKey?: string;
}
```

#### Response
```typescript
{
  suggestions: Array<{
    targetId: string;
    type: 'dependency' | 'blocks';
    reason: string;
    confidence: number;
  }>;
}
```

### POST /api/task-dialog

Conversational AI for task information gathering. The AI acts as a Chief of Staff, proactively extracting information and suggesting actions.

#### Request
```typescript
{
  task: Issue;                    // The task being discussed
  message: string;                // User's message
  history: DialogMessage[];       // Prior conversation
  context: {
    ancestors: IssueRef[];        // Parent chain
    parent: IssueRef | null;      // Direct parent
    siblings: IssueRef[];         // Same-level tasks
    children: IssueRef[];         // Child tasks
    blockedBy: IssueRef[];        // Blocking dependencies
    blocks: IssueRef[];           // Tasks waiting on this
    constraints: ConstraintRef[]; // Active constraints
    scopeBoundary: ScopeBoundary | null;
    successCriteria: string[];
    existingConcerns: ConcernRef[];
    projectIssues: IssueRef[];    // Other relevant issues
    relatedDialogs?: RelatedDialogRef[]; // Conversations from related tasks
  };
  urlContents?: Array<{ url: string; content: string }>; // Fetched web content
  model?: string;
  apiKey?: string;
}
```

#### Response
```typescript
{
  response: string;               // AI's conversational response
  actions: Array<{
    type: 'update_task' | 'create_subtask' | 'mark_complete' |
          'add_dependency' | 'add_concern' | 'add_constraint' | 'update_scope';
    description: string;
    data?: {
      title?: string;
      description?: string;
      type?: IssueType;
      priority?: IssuePriority;
      concernType?: string;
      constraintType?: string;
      scopeUpdate?: Partial<ScopeBoundary>;
    };
  }>;
  agenda: {
    pendingQuestions?: Array<{
      question: string;
      priority?: 'blocking' | 'important' | 'nice_to_have';
      context?: string;
    }>;
    resourcesNeeded?: Array<{
      type?: 'web_page' | 'document' | 'api' | 'account';
      url?: string;
      description?: string;
      whyNeeded?: string;
    }>;
    accessRequests?: Array<{
      service?: string;
      accessType?: 'read' | 'write' | 'admin';
      whyNeeded?: string;
    }>;
    backgroundTasks?: Array<{
      description?: string;
      canRunWithoutHuman?: boolean;
    }>;
  };
}
```

### POST /api/fetch-url

Fetch and extract content from a web page.

#### Request
```typescript
{
  url: string;
}
```

#### Response
```typescript
{
  content: string;          // Extracted text content
  contentType: 'html' | 'json' | 'text';
  error?: string;
}
```

---

## Computed Values

### Tier Calculation

Concern tier is computed from impact × probability × urgency:

```typescript
const priority = concern.impact * concern.probability * concern.urgency;

if (priority >= 18) tier = 1;      // Blocker
else if (priority >= 9) tier = 2;  // Critical
else if (priority >= 4) tier = 3;  // Consideration
else tier = 4;                      // Background
```

### Derived Status

Container status is derived from children based on decomposition type:

**AND decomposition**:
- `closed` when ALL children are `closed`
- `failed` when ANY child is `failed`
- `in_progress` when ANY child is `in_progress` or some `closed`
- `open` otherwise

**OR decomposition** (fallback/race):
- `closed` when ANY child is `closed`
- `failed` when ALL children are `failed`
- `in_progress` when ANY child is `in_progress`
- `open` otherwise

**Choice decomposition**:
- `in_progress` when all children have been researched (status tracking)
- Status set manually when human makes choice

### Actionability

An issue is actionable when:
1. It's a leaf (no children)
2. Status is `open` or `in_progress`
3. All dependencies are `closed`

```typescript
isActionable(issueId: string): boolean
```

---

## Uncertainty Modeling

For outcomes that cannot be known with certainty, Beads provides a complete uncertainty modeling system.

### UncertaintyType

Type of uncertain outcome.

```typescript
type UncertaintyType =
  | 'market_returns'    // Investment performance
  | 'inflation'         // Cost of living changes
  | 'longevity'         // How long someone lives
  | 'healthcare_costs'  // Medical expenses
  | 'income'            // Employment/earnings
  | 'interest_rates'    // Borrowing/savings rates
  | 'property_values'   // Real estate
  | 'exchange_rates'    // Currency
  | 'project_duration'  // How long work takes
  | 'project_cost'      // How much work costs
  | 'custom';           // User-defined
```

### ModelingApproach

How to model the uncertainty.

```typescript
type ModelingApproach =
  | 'monte_carlo'         // Random sampling from distributions
  | 'scenario_analysis'   // Discrete named scenarios
  | 'sensitivity'         // Vary one parameter at a time
  | 'historical_sim'      // Use actual historical sequences
  | 'stress_test'         // Extreme but plausible scenarios
  | 'robust_optimization' // Optimize for worst case
  | 'bayesian'            // Update beliefs with evidence
  | 'real_options';       // Value flexibility/optionality
```

| Approach | When to Use | Example |
|----------|-------------|---------|
| Monte Carlo | Many uncertain parameters | Retirement planning |
| Scenario Analysis | Discrete named futures | "Bull market" vs "Recession" |
| Sensitivity | Identify key drivers | "What if returns are 4% vs 8%?" |
| Historical Sim | Past data available | Using actual market sequences |
| Stress Test | Extreme events | "What if market drops 40%?" |
| Bayesian | Updating with new data | Annual retirement review |

### DistributionType

Statistical distribution for uncertain parameters.

```typescript
type DistributionType =
  | 'normal'       // Symmetric, thin tails
  | 'log_normal'   // Always positive, right-skewed (prices, wealth)
  | 'student_t'    // Fat tails (market returns with crashes)
  | 'pareto'       // Power law (extreme events)
  | 'uniform'      // Equal probability in range
  | 'triangular'   // Min/mode/max estimate
  | 'empirical'    // From historical data
  | 'mixture';     // Regime switching (bull/bear markets)
```

### UncertainParameter

Definition of an uncertain input.

```typescript
interface UncertainParameter {
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
  confidence?: number;                  // How confident in parameters
  rationale?: string;                   // Why these values
}
```

### Scenario

Named future state with parameter overrides.

```typescript
interface Scenario {
  id: string;
  name: string;                         // e.g., "Bull Market"
  description: string;
  probability?: number;                 // Estimated likelihood (0-1)
  parameterOverrides: Record<string, number>;
  outcome?: number;                     // Computed result
}
```

### SimulationConfig

Configuration for running a simulation.

```typescript
interface SimulationConfig {
  approach: ModelingApproach;
  iterations?: number;                  // For Monte Carlo (e.g., 10000)
  timeHorizon?: number;                 // Years to simulate
  confidenceLevel?: number;             // e.g., 0.95 for 95% CI

  // For scenario analysis
  scenarios?: Scenario[];

  // For sensitivity analysis
  parameterToVary?: string;
  sweepRange?: { min: number; max: number; steps: number };
}
```

### SimulationResult

Results from running a simulation.

```typescript
interface SimulationResult {
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
  summary: string;                      // Plain English summary
  recommendations?: string[];           // Actionable suggestions
}
```

### UncertaintyAnalysis

Container for all uncertainty data on an issue.

```typescript
interface UncertaintyAnalysis {
  uncertainParameters: UncertainParameter[];
  simulations: SimulationResult[];
  suggestedApproach?: ModelingApproach;
  approachRationale?: string;
}
```

---

## Uncertainty API Endpoints

### POST /api/suggest-uncertainty

AI suggests uncertainty modeling approach for a task.

#### Request
```typescript
{
  issue: Issue;
  projectContext?: string;
  model?: string;
  apiKey?: string;
}
```

#### Response
```typescript
{
  hasUncertainty: boolean;
  explanation: string;                  // Why this does/doesn't need uncertainty modeling
  suggestion?: {
    approach: ModelingApproach;
    rationale: string;
    parameters: UncertainParameter[];
    scenarios?: Scenario[];
    simulationConfig: SimulationConfig;
    explanation: string;
  };
  suggestedAt: string;
}
```

### POST /api/run-simulation

Run an uncertainty simulation.

#### Request
```typescript
{
  config: SimulationConfig;
  parameters: UncertainParameter[];
  context: {
    goalDescription: string;
    timeHorizon?: number;
    initialValue?: number;              // Starting portfolio value
    targetValue?: number;               // Goal amount
    withdrawalRate?: number;            // Annual withdrawal rate
    inflationAdjusted?: boolean;
  };
  model?: string;
  apiKey?: string;
}
```

#### Response
```typescript
{
  result: SimulationResult;
  executionTimeMs: number;
}
```

### Domain-Specific Defaults

The AI suggests these default parameters based on domain knowledge:

#### Investment Returns (Real, After Inflation)
| Asset Class | Mean | StdDev | Distribution |
|-------------|------|--------|--------------|
| US Stocks | 7% | 18% | Student's t (df=5) |
| US Bonds | 2% | 6% | Normal |
| International Stocks | 6% | 22% | Student's t (df=5) |
| Real Estate | 4% | 12% | Log-normal |

#### Other Parameters
| Parameter | Mean | StdDev | Distribution |
|-----------|------|--------|--------------|
| Inflation | 3% | 1.5% | Log-normal |
| Project Duration | 1.5x-3x estimate | varies | Log-normal |
| Longevity at 65 | 22 years | - | Triangular(15, 22, 35) |

### Example: Retirement Planning

```typescript
// 1. Suggest uncertainty modeling
const suggestion = await fetch('/api/suggest-uncertainty', {
  method: 'POST',
  body: JSON.stringify({
    issue: {
      title: "Retirement by age 60",
      description: "Save enough to retire comfortably",
      type: "goal"
    }
  })
});

// 2. Run Monte Carlo simulation
const simulation = await fetch('/api/run-simulation', {
  method: 'POST',
  body: JSON.stringify({
    config: {
      approach: 'monte_carlo',
      iterations: 10000,
      timeHorizon: 30,
      confidenceLevel: 0.95
    },
    parameters: [
      {
        id: 'stock-returns',
        name: 'Annual stock return',
        uncertaintyType: 'market_returns',
        distribution: 'student_t',
        parameters: { mean: 0.07, stdDev: 0.18, degreesOfFreedom: 5 },
        source: 'ai_suggested'
      }
    ],
    context: {
      goalDescription: "Retirement by age 60",
      timeHorizon: 30,
      initialValue: 500000,
      withdrawalRate: 0.04
    }
  })
});

// Result includes:
// - percentiles: { 5: 180000, 50: 1200000, 95: 3500000 }
// - probabilityOfRuin: 0.08
// - recommendations: ["Consider reducing withdrawal rate to 3.5%", ...]
```

---

## Extracted Facts System

For tracking verifiable information extracted from conversations and documents.

### ExtractedFact

A single piece of verified information.

```typescript
interface ExtractedFact {
  id: string;

  // The fact itself
  entity: string;             // "SocialSecurity", "RetirementAccount"
  attribute: string;          // "monthlyBenefit", "currentBalance"
  value: FactValue;           // Typed value

  // Provenance
  source: FactSource;         // Where this came from

  // Validation
  validationStatus: 'unverified' | 'user_confirmed' | 'externally_verified' | 'disputed';
  validatedAt?: string;
  validatedBy?: string;

  // Schema reference
  domainId: string;
  schemaVersion: string;

  // Temporal
  effectiveDate?: string;     // When this fact is/was true
  expiresAt?: string;         // When to re-verify

  // Linkage
  projectId: string;
  issueId?: string;

  extractedAt: string;
  updatedAt: string;
}
```

### FactValue

Typed value with unit support.

```typescript
interface FactValue {
  type: 'string' | 'number' | 'boolean' | 'date' | 'currency' | 'percentage' | 'duration' | 'contact' | 'document_ref';
  raw: string | number | boolean;
  currency?: string;          // For currency
  asDecimal?: number;         // For percentage (0.07 for 7%)
  unit?: 'days' | 'months' | 'years'; // For duration
  contact?: {                 // For contact info
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    organization?: string;
  };
}
```

### FactSource

Provenance tracking for facts.

```typescript
interface FactSource {
  type: 'dialog' | 'document' | 'external_query' | 'manual_entry' | 'calculated';

  // For dialog
  dialogMessageId?: string;
  extractedPhrase?: string;

  // For document
  documentId?: string;
  documentName?: string;
  pageNumber?: number;

  // For external query
  externalUrl?: string;
  sessionId?: string;

  confidence: number;         // 0-1
  aiModel?: string;
}
```

### DomainSchema

Schema defining expected facts for a domain.

```typescript
interface DomainSchema {
  id: string;
  domain: DomainType;
  name: string;
  version: string;
  description: string;

  entities: EntityDefinition[];
  relationships: RelationshipDefinition[];
  validationRules: ValidationRule[];
  requiredFacts: string[];    // e.g., ["SocialSecurity.monthlyBenefit"]
  exportTemplates: ExportTemplate[];

  isBuiltIn: boolean;
}

type DomainType =
  | 'retirement_planning'
  | 'estate_planning'
  | 'home_renovation'
  | 'insurance_review'
  | 'tax_planning'
  | 'debt_management'
  | 'investment_portfolio'
  | 'business_planning'
  | 'healthcare_planning'
  | 'education_planning'
  | 'custom';
```

### Document

Uploaded document for extraction.

```typescript
interface Document {
  id: string;
  projectId: string;
  name: string;
  type: 'pdf' | 'image' | 'csv' | 'excel' | 'text' | 'html' | 'other';
  mimeType: string;
  size: number;
  storagePath: string;
  hash: string;

  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractedFactIds: string[];
  extractionError?: string;

  uploadedAt: string;
  processedAt?: string;
}
```

### ExternalSession

Session for extracting data from external sites.

```typescript
interface ExternalSession {
  id: string;
  projectId: string;

  siteName: string;           // "Social Security Administration"
  siteUrl: string;
  purpose: string;

  status: 'pending_login' | 'active' | 'extracting' | 'completed' | 'expired' | 'failed';

  handoffRequestedAt: string;
  userLoggedInAt?: string;
  sessionHandedOffAt?: string;

  extractedFactIds: string[];
}
```

---

## Facts API Endpoints

### POST /api/extract-facts

Extract structured facts from content using AI.

#### Request
```typescript
{
  content: string;            // Text to extract from
  contentType: 'dialog' | 'document' | 'url';
  sourceMetadata?: {
    documentId?: string;
    dialogMessageId?: string;
    url?: string;
  };
  domain?: string;            // Domain type for schema
  projectId: string;
  existingFacts?: Array<{ entity: string; attribute: string; value: unknown }>;
  model?: string;
  apiKey?: string;
}
```

#### Response
```typescript
{
  facts: ExtractedFact[];
  notes: string;              // AI observations
  suggestedQuestions: string[]; // Questions to get missing facts
  factCount: number;
  extractedAt: string;
}
```

### Facts Store Methods

The `factsStore` provides methods for managing extracted facts:

```typescript
// Initialize for a project
factsStore.initProject(projectId: string, domains: DomainType[]): void

// Add a domain
factsStore.addDomain(domain: DomainType): void

// Add or update a fact
factsStore.addFact(fact: Omit<ExtractedFact, 'id' | 'extractedAt' | 'updatedAt'>): ExtractedFact

// Get facts for entity
factsStore.getFactsForEntity(entity: string): ExtractedFact[]

// Get specific fact value
factsStore.getFactValue(entity: string, attribute: string): FactValue | undefined

// Update validation status
factsStore.updateValidation(factId: string, status: string, validatedBy?: string): ExtractedFact

// Get completeness for domain
factsStore.getCompleteness(domain: DomainType): { requiredFacts: number; extractedFacts: number; percentage: number }

// Get missing required facts
factsStore.getMissingRequiredFacts(domain: DomainType): string[]

// Export to JSON
factsStore.exportToJson(options?: { entities?: string[]; includeUnverified?: boolean }): string

// Export to CSV
factsStore.exportToCsv(entities?: string[]): string

// Document management
factsStore.addDocument(doc: Omit<Document, 'id' | 'uploadedAt'>): Document
factsStore.updateDocumentStatus(docId: string, status: string, extractedFactIds?: string[]): Document

// External session management
factsStore.createExternalSession(siteName: string, siteUrl: string, purpose: string): ExternalSession
factsStore.updateSessionStatus(sessionId: string, status: string, extractedFactIds?: string[]): ExternalSession
```

### Built-in Domain Schemas

#### Retirement Planning
Entities: Person, SocialSecurity, RetirementAccount, Pension, RetirementExpense

Key required facts:
- Person.name, Person.birthDate, Person.retirementAge
- SocialSecurity.estimatedMonthlyAtFRA, SocialSecurity.plannedStartAge

#### Estate Planning
Entities: Person, Will, Trust, PowerOfAttorney, HealthcareDirective, EstateAsset, BeneficiaryDesignation, ProfessionalContact

Key required facts:
- Person.name, Person.birthDate
- Will.hasWill, Trust.hasTrust, PowerOfAttorney.hasPOA

#### Insurance Review
Entities: InsuredPerson, AutoInsurance, Vehicle, HomeInsurance, LifeInsurance, HealthInsurance, DisabilityInsurance, UmbrellaInsurance, LongTermCare, InsuranceAgent

Key required facts:
- InsuredPerson.name, InsuredPerson.birthDate
- At least one insurance policy documented

#### Tax Planning
Entities: TaxFiler, Dependent, W2Income, BusinessIncome, InvestmentIncome, RentalIncome, Deduction, TaxCredit, EstimatedTax, TaxSummary, TaxProfessional

Key required facts:
- TaxFiler.name, TaxFiler.filingStatus, TaxFiler.birthDate, TaxFiler.state
- TaxSummary.taxYear

---

## Schema API Endpoints

The schema API enables backend-centric architecture where domain knowledge lives on the server.

### GET /api/schemas

List all available schemas with metadata.

#### Query Parameters
- `available_only` (boolean): If 'true', only return domains with implemented schemas

#### Response
```typescript
{
  schemas: Array<{
    domain: DomainType;
    name: string;
    description: string;
    icon: string;
    hasSchema: boolean;
    version: string | null;
    entityCount: number;
    requiredFactCount: number;
    entities: Array<{
      name: string;
      displayName: string;
      attributeCount: number;
    }>;
  }>;
  totalDomains: number;
  implementedCount: number;
  timestamp: string;
}
```

### GET /api/schemas/[domain]

Get complete schema for a specific domain.

#### Path Parameters
- `domain`: Domain type (e.g., 'retirement_planning', 'tax_planning')

#### Query Parameters
- `format`: Response format
  - `full` (default): Complete schema with all details
  - `entities_only`: Just entity definitions
  - `required_only`: Required facts and required attributes
  - `export_templates`: Just export template definitions

#### Response (full format)
```typescript
{
  domain: DomainType;
  metadata: { name: string; description: string; icon: string };
  schema: DomainSchema;
  timestamp: string;
}
```

### POST /api/schemas

Schema operations: validate, extend, check upgrades, get migrations.

#### Request
```typescript
{
  action: 'validate' | 'extend' | 'check_upgrade' | 'get_migrations';
  domain: DomainType;
  facts?: Array<{ entity: string; attribute: string; value: unknown }>;  // For validate
  extensions?: {                                                          // For extend
    additionalEntities?: EntityDefinition[];
    additionalAttributes?: Array<{ entityName: string; attributes: AttributeDefinition[] }>;
    additionalRequiredFacts?: string[];
  };
  fromVersion?: string;     // For check_upgrade, get_migrations
  toVersion?: string;       // For get_migrations
  versionHistory?: SchemaVersion[];  // For get_migrations
}
```

#### Response (validate)
```typescript
{
  action: 'validate';
  domain: DomainType;
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

#### Response (extend)
```typescript
{
  action: 'extend';
  domain: DomainType;
  schema: DomainSchema;  // Extended schema
}
```

### POST /api/schema-suggestions

AI analyzes facts that don't fit current schema and suggests extensions.

#### Request
```typescript
{
  observedFacts: Array<{
    entity: string;
    attribute: string;
    value: unknown;
    context?: string;
  }>;
  domain: DomainType;
  currentSchema?: DomainSchema;
  model?: string;
  apiKey?: string;
}
```

#### Response
```typescript
{
  domain: DomainType;
  currentSchemaVersion: string;
  observedFactCount: number;
  suggestions: Array<{
    type: 'add_entity' | 'add_attribute' | 'modify_attribute' | 'add_relationship';
    confidence: number;
    reason: string;
    entity?: EntityDefinition;
    targetEntity?: string;
    attribute?: AttributeDefinition;
    relationship?: {
      from: string;
      to: string;
      type: 'one-to-one' | 'one-to-many' | 'many-to-many';
      description: string;
    };
  }>;
  summary: string;
  impact: 'Low' | 'Medium' | 'High';
  timestamp: string;
}
```

### POST /api/schema-apply

Apply schema extensions and migrate existing facts.

#### Request
```typescript
{
  domain: DomainType;
  currentSchema?: DomainSchema;
  extensions: {
    additionalEntities?: EntityDefinition[];
    additionalAttributes?: Array<{ entityName: string; attributes: AttributeDefinition[] }>;
    additionalRequiredFacts?: string[];
  };
  factsToMigrate?: Array<{ entity: string; attribute: string; value: unknown }>;
  newVersion?: string;
}
```

#### Response
```typescript
{
  success: boolean;
  domain: DomainType;
  previousVersion: string;
  newVersion: string;
  schema: DomainSchema;  // Extended schema
  migration: SchemaMigration;
  migratedFacts?: {
    total: number;
    modified: number;
    facts: Array<{ entity: string; attribute: string; value: unknown; migrated: boolean }>;
  };
  timestamp: string;
}
```

---

#### Example: Retirement Account Entity
```typescript
{
  name: 'RetirementAccount',
  displayName: 'Retirement Account',
  category: 'asset',
  allowMultiple: true,
  identifierAttribute: 'accountName',
  attributes: [
    { name: 'accountName', type: 'string', required: true },
    { name: 'accountType', type: 'string', required: true,
      allowedValues: ['401k', 'traditional_ira', 'roth_ira', 'roth_401k', '403b', '457b', 'sep_ira', 'pension', 'annuity'] },
    { name: 'institution', type: 'string', required: true },
    { name: 'currentBalance', type: 'currency', required: true },
    { name: 'balanceAsOfDate', type: 'date', required: true },
    { name: 'monthlyContribution', type: 'currency', required: false },
    { name: 'employerMatch', type: 'currency', required: false },
    { name: 'beneficiary', type: 'string', required: false }
  ]
}
```
