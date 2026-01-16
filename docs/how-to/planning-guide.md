# How-To Guides

Practical guides for accomplishing specific tasks with Beads.

---

## How to Define a Well-Specified Goal

### Problem
You have a vague idea but need a clear, actionable goal with measurable success criteria.

### Solution

1. **Create the initial goal** using Quick Add with a rough description
2. **Open the goal** and navigate to the Planning Assistant
3. **Click "Refine Goal"** to have AI transform it
4. **Review the refinement**:
   - Is the title specific enough?
   - Are success criteria measurable?
   - Is scope clearly bounded?
5. **Apply the refinement** if acceptable, or manually edit

### Example

**Before**: "Improve website performance"

**After**:
```
Title: Reduce Website Load Time to Under 2 Seconds
Success Criteria:
- Lighthouse performance score > 90
- Time to First Contentful Paint < 1.5s
- Time to Interactive < 2.0s
- Core Web Vitals all "Good"
```

### Tips
- Success criteria should be objectively verifiable
- Include what's NOT in scope if it's ambiguous
- Attach a timeline constraint if there's a deadline

---

## How to Surface Hidden Risks

### Problem
You're about to start work but want to identify risks and assumptions first.

### Solution

1. **Open your goal or task**
2. **Click "Analyze Risks"** in the Planning Assistant
3. **Review each concern**:
   - Assumptions: What are we taking for granted?
   - Risks: What could go wrong?
   - Gaps: What's missing from the plan?
   - Dependencies: What external factors matter?
4. **Add relevant concerns** to the issue
5. **Address high-tier concerns** before proceeding:
   - Tier 1 (Blocker): Must resolve now
   - Tier 2 (Critical): Should address soon
   - Tier 3-4: Track but don't block

### Example Workflow

For a "Migrate database" task, the AI might surface:

```
Assumption (Tier 2): Assumes application can handle 10 minutes downtime
Risk (Tier 1): No rollback plan if migration fails
Gap (Tier 2): No data validation step after migration
Dependency (Tier 3): Requires DBA approval for schema changes
```

Address the Tier 1 blocker (rollback plan) before starting work.

---

## How to Decompose a Complex Task

### Problem
You have a large task that needs to be broken into manageable pieces.

### Solution

1. **Open the task** you want to decompose
2. **Click "Break Down"** in the Planning Assistant
3. **Review the suggested subtasks**:
   - Are they atomic (can be done without further breakdown)?
   - Do they collectively achieve the parent goal?
   - Are any duplicates of existing tasks?
4. **Check for shared resources** (things that affect multiple subtasks)
5. **Choose decomposition type**:
   - AND: All must complete (default)
   - OR-Fallback: Try in order until one works
   - OR-Race: Parallel, first success wins
   - Choice: Explore all, human picks one
6. **Create the subtasks**

### When to Use Each Decomposition Type

| Scenario | Type | Example |
|----------|------|---------|
| All parts required | AND | Build feature (design + code + test) |
| Backup plans | OR-Fallback | Get to airport (drive → taxi → rideshare) |
| Speed critical | OR-Race | Find hotel (check 3 booking sites in parallel) |
| Human judgment needed | Choice | Select vendor (evaluate 3 options) |

### Tips
- Decompose only when needed—don't over-structure
- If shared resources are detected, consider if scope should expand
- Leaf tasks should be completable in a single work session

---

## How to Handle Scope Expansion

### Problem
You've discovered work that's outside the original scope and need to decide how to handle it.

### Solution

1. **When the alert appears**: "Scope Expansion Detected"
2. **Click "Review scope"** to see what triggered it
3. **Understand the expansion**:
   - What new work was detected?
   - Why is it outside scope?
   - What triggered the expansion?
4. **Choose your response**:

#### Option A: EXPAND
Accept the larger scope:
- Update success criteria to include new work
- Adjust constraints (budget, timeline)
- Communicate the change to stakeholders

#### Option B: CONSTRAIN
Reject the expansion:
- Remove the out-of-scope task
- Add a constraint to prevent similar expansion
- Document why it's explicitly out of scope

#### Option C: SPLIT
Create a separate project:
- Move the work to a new goal
- Optionally add a dependency if they're related
- Track separately with its own scope boundary

### Example

**Original scope**: "Remodel kitchen"
**Detected expansion**: "Replace knob-and-tube wiring in kitchen wall"

The wiring affects the whole house. Your choices:

1. **EXPAND**: Include full electrical upgrade, adjust budget from $30K to $50K
2. **CONSTRAIN**: Add constraint "Do not modify wiring outside kitchen", inform contractor
3. **SPLIT**: Create "Electrical Upgrade" project, coordinate timelines

---

## How to Set Up Dependencies

### Problem
Tasks have ordering constraints that need to be expressed.

### Solution

#### Adding a Dependency Manually

1. **Open the task** that needs something done first
2. **Go to "Must Complete First"** section
3. **Click "Add"** and select the prerequisite task
4. The selected task now blocks this one

#### Using AI Suggestions

1. **Click "AI Suggest"** in the dependencies section
2. **Review suggested dependencies**:
   - Do they make logical sense?
   - Are they already implied by hierarchy?
   - Would adding them create unnecessary constraints?
3. **Accept or Ignore** each suggestion

#### Removing a Dependency

1. **Click the X** next to the dependency
2. The task is immediately unblocked

#### Reversing a Dependency

If A depends on B, but it should be B depends on A:
1. **Click the reverse arrow** next to the dependency
2. The direction flips

### Handling Cycles

If adding a dependency would create a cycle:
1. The system detects it and shows options
2. Choose which existing dependency to remove
3. The cycle is broken, new dependency is added

---

## How to Work with Constraints

### Problem
You need to set explicit limits on budget, timeline, or scope.

### Solution

#### Adding a Constraint

1. **Open your goal** and go to Planning Assistant
2. **Click "Refine Goal"** or add constraints manually
3. **For each constraint, specify**:
   - Type: budget, timeline, scope, must_have, must_not, boundary
   - Description: What the constraint is
   - Rationale: Why this constraint exists
   - Value/Unit: Quantitative limit if applicable
   - Negotiable: Can it be changed?

#### Constraint Types

| Type | Use For | Example |
|------|---------|---------|
| Budget | Cost limits | "Maximum $10,000 including contingency" |
| Timeline | Deadlines | "Launch by Q2 2024" |
| Scope | Boundaries | "Only production environment, not staging" |
| Must Have | Required features | "Must support WCAG 2.1 AA accessibility" |
| Must Not | Prohibited approaches | "Must not use deprecated APIs" |
| Boundary | Detection rules | "Any work outside main application is out of scope" |

#### Inheritance

Constraints inherit to children:
- A $10,000 budget on a goal applies to all subtasks
- Use `getEffectiveConstraints()` to see all inherited constraints

---

## How to Review and Address Concerns

### Problem
The system has surfaced concerns and you need to work through them.

### Solution

1. **Open the Concern Panel** on your goal
2. **Work through tiers in order**:

#### Tier 1 (Blockers)
- Must resolve before any work starts
- Click into each one
- Either:
  - **Mark Addressed**: You've resolved it
  - **Create Issue**: Create a task to resolve it
  - **Accept Risk**: Proceed despite the risk (document why)

#### Tier 2 (Critical)
- High risk if ignored
- Should address before work completes
- Same actions as Tier 1

#### Tier 3-4 (Considerations/Background)
- Collapsed by default
- Expand to review
- **Defer** if not relevant now
- **Accept** if risk is acceptable

### Concern Actions

| Action | When to Use |
|--------|-------------|
| Mark Addressed | You've taken action to resolve the concern |
| Defer | Valid concern but not relevant right now |
| Accept Risk | Acknowledge and proceed without resolving |
| Create Issue | Generate a task to handle this concern |

---

## How to Have a Productive Task Dialog

### Problem
You need to gather or provide information about a task, and you want the AI to help you be thorough.

### Solution

1. **Open any task** and click "Talk About This"
2. **Start with what you know**: "I have Geico for auto insurance"
3. **Let the AI dig deeper**: It will ask for related details (policy #, coverage, etc.)
4. **Share URLs if helpful**: Paste links and the AI will extract relevant content
5. **Accept suggested actions**: The AI will suggest creating subtasks, updating descriptions, etc.
6. **Close anytime**: Your conversation is saved automatically

### What the AI Does

The AI acts as your Chief of Staff:

- **Extracts maximum information** - Asks for missing details, probes for related items
- **Uses domain knowledge** - Suggests specific things you might have forgotten
- **Creates concrete actions** - Turns conversation into subtasks, updates, concerns
- **Never re-asks** - If you mentioned something before, it remembers

### Example Conversation

**User:** "I have Geico for auto insurance"

**AI:** "Geico auto - got it. Quick details: What's the policy number? Coverage limits? When does it renew? Also, most people have 2+ vehicles - do you have others on this policy?"

**[Suggests action: Create subtask "Document Geico auto policy details"]**

**User:** "Policy is 123456, $100k/$300k liability. I also have State Farm for home."

**AI:** "Got it - Geico policy 123456 with $100k/$300k liability. And State Farm homeowner's. For the State Farm policy, what are the coverage limits and deductible? Also, do you have any other insurance - life, umbrella, health?"

### Tips

- You can close mid-conversation - the AI will pick up where you left off
- Share URLs to documents for the AI to extract details
- Let the AI suggest subtasks rather than creating them manually
- The AI tracks what's still needed and will remind you later

---

## How to Resume Work After Being Away

### Problem
You closed the app and don't remember where you were.

### Solution

1. **Open Beads** - The resume panel shows automatically
2. **See your context**:
   - "Welcome back! You were working on documenting insurance policies..."
   - "Last time you mentioned having Geico auto insurance..."
3. **Continue where you left off**: Click "Continue" to reopen that task dialog
4. **Or address pending items**: The AI shows what it's waiting for
5. **Or tackle prioritized work**: High-priority and stale items are listed

### What the AI Tracks

- **Last task**: Which task you were working on
- **Pending questions**: What the AI asked but you didn't answer
- **Work queue**: Tasks needing attention, prioritized by urgency

### Example Resume

```
Welcome back! You were last here 2 days ago.

On "Document insurance policies", I had asked about your
homeowner's policy deductible.

[Continue where you left off →]

I'm waiting for answers to:
- What is your State Farm deductible? (Document insurance policies)

What needs attention:
- [HIGH] Complete auto insurance documentation (P1)
- [MEDIUM] Review life insurance options (in progress, stale)
```

---

## How to Assign Work to AI

### Problem
You want AI to work on a task while you focus on other things.

### Solution

1. **Open the task** to be assigned
2. **Click "Assign AI"** (or similar action)
3. **Select the AI model**:
   - Claude Sonnet: Good balance of speed and capability
   - Claude Opus: Complex reasoning, higher cost
   - GPT-4: Alternative for different perspective
4. **Monitor progress**:
   - Check the activity timestamp
   - View any output or progress notes
5. **Handle flags**:
   - If AI reports "blocked", review and unblock
   - If timeout occurs, check if task is still relevant

### Execution Types

The system suggests who should do work:

| Type | Meaning | Action |
|------|---------|--------|
| Automated | AI can handle alone | Assign to AI |
| AI-Assisted | AI does, human reviews | Assign to AI, plan review |
| Human-Assisted | Human does, AI helps | Claim yourself, use AI for research |
| Human | Only human can do | Claim yourself |

---

## How to Validate a Plan Before Execution

### Problem
You want to verify the plan is complete and accurate before starting work.

### Solution

1. **Open your goal**
2. **Click "Validate Plan"** in the Planning Assistant
3. **Review the results**:

#### If Accurate
```
✓ All leaves are well-specified
✓ All containers have sufficient children
✓ No orphan dependencies
✓ No circular dependencies
```

You're ready to execute.

#### If Issues Found

For each issue:
- **Under-specified leaf**: Add more detail or success criteria
- **Missing decomposition**: Break down the container
- **Orphan dependency**: Remove or create the missing task
- **Cycle detected**: Break the cycle by removing one edge

### What "Accurate" Means

A plan is accurate if:
1. Every leaf task is well-specified (clear what "done" means)
2. Every container's children are sufficient to complete it
3. All dependencies reference existing tasks
4. The dependency graph has no cycles

---

## How to Track Progress on a Large Project

### Problem
You have many tasks and need to understand overall progress.

### Solution

1. **Check the Project Stats** on your goal page:
   - Total Issues: Count of all descendants
   - Actionable: Leaves ready to work on
   - Containers: Intermediate rollups
   - Est. Cost: Sum of budget estimates

2. **View in Graph** for visual progress:
   - Green nodes: Completed
   - Blue nodes: In progress
   - Yellow nodes: Blocked
   - Red nodes: Failed

3. **Review Derived Status**:
   - Containers show progress percentage
   - AND containers: X of Y complete
   - OR containers: First success wins

4. **Check the Blockers**:
   - What's preventing progress?
   - Are any tasks blocked on external factors?

### Key Questions

| Question | Where to Look |
|----------|---------------|
| What can I work on now? | Actionable section on main page |
| What's blocking progress? | Blocked section on main page |
| How much is done? | Project stats on goal page |
| What's at risk? | Concern panel, Tier 1-2 |
