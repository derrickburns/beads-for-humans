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
