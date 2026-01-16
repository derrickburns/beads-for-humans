# Core Concepts

This document explains the fundamental ideas behind Beads' planning system and why they matter.

## The Problem: Planning is Messy

Real-world planning fails in predictable ways:

1. **Plans become stale immediately** - The moment you write a plan, reality diverges from it
2. **Hidden work emerges** - Tasks reveal dependencies and subtasks that weren't visible upfront
3. **Scope creeps** - Small additions accumulate into major deviations
4. **Risks hide in assumptions** - What you don't question often causes the biggest problems
5. **Human and AI work don't coordinate** - Different types of tasks require different executors

Beads addresses these problems through a planning model that stays accurate as work evolves.

## The Plan Accuracy Invariant

The central principle of Beads planning:

> **A plan is accurate if and only if completing all leaf nodes guarantees the parent goal is achieved.**

This is not an aspiration—it's an invariant that the system maintains. When you decompose a task into subtasks, those subtasks must be *sufficient* to complete the parent. If they're not, the plan is inaccurate, and the system will tell you.

### Why This Matters

Traditional project management tracks what you *said* you would do. Beads tracks what *actually needs to be done*. When new work is discovered, it's added to the plan. When scope expands, you're asked to acknowledge it. The plan always reflects reality.

## Hierarchical Task Decomposition

Tasks in Beads form a tree structure through parent-child relationships.

### Container vs Leaf Tasks

- **Leaf tasks** have no children and represent work that someone (human or AI) will do
- **Container tasks** have children and represent goals achieved by completing their children

When you decompose a task, it becomes a container. Containers have no work of their own—their completion is determined entirely by their children.

```
Goal: Launch product
├── Task: Build MVP (container)
│   ├── Task: Design database schema (leaf)
│   ├── Task: Implement API endpoints (leaf)
│   └── Task: Create frontend (leaf)
├── Task: Marketing preparation (container)
│   ├── Task: Write press release (leaf)
│   └── Task: Prepare demo video (leaf)
└── Task: Legal review (leaf)
```

### Derived Status

Container status is computed from children, not set directly:

- **AND decomposition**: Closed when ALL children are closed, failed if ANY child failed
- **OR decomposition**: Closed when ANY child is closed, failed if ALL children failed
- **Choice decomposition**: In progress when all options researched, awaiting human decision

## AND-OR Decomposition

Not all work follows a simple "do everything" pattern. Beads supports four decomposition types:

### AND (Default)
All children must complete. Used for work that requires every part.

```
Task: Deploy to production
├── Run tests (must complete)
├── Build artifacts (must complete)
└── Push to servers (must complete)
```

### OR-Fallback
Try children in order until one succeeds. Used for alternatives with priorities.

```
Task: Get to work
├── Take train (try first)
├── Call rideshare (if train fails)
└── Work from home (if all else fails)
```

### OR-Race
Run children in parallel, first success wins. Used when speed matters more than efficiency.

```
Task: Find a venue
├── Check Hotel A
├── Check Hotel B
└── Check Hotel C
```

### Choice
Explore all options, then a human picks one. Used for decisions requiring judgment.

```
Task: Select database technology
├── Evaluate PostgreSQL
├── Evaluate MongoDB
└── Evaluate CockroachDB
```

## Dependencies vs Hierarchy

Beads distinguishes two types of relationships:

### Dependencies (Blocking Relationships)
"This task cannot start until that task is complete."

Dependencies create a directed acyclic graph (DAG) of work ordering. They answer: "What needs to happen before this can happen?"

### Hierarchy (Parent-Child Relationships)
"These tasks together comprise this larger task."

Hierarchy creates a tree of task decomposition. It answers: "What work makes up this larger goal?"

These are orthogonal. A child task can have dependencies on tasks outside its parent. A task can block tasks in different subtrees.

## Scope Boundaries

Scope expansion is inevitable. Beads makes it visible and manageable.

### Defining Scope

Every goal can have an explicit scope boundary:

- **Includes**: What's explicitly in scope
- **Excludes**: What's explicitly out of scope
- **Boundary Conditions**: Rules for determining if something is in or out

### Detecting Expansion

When new tasks are created, the system checks if they reference excluded items or violate boundary conditions. If they do, it surfaces a scope expansion concern.

### Handling Expansion

When scope expansion is detected, you have three choices:

1. **EXPAND**: Accept the larger scope, update the boundary
2. **CONSTRAIN**: Reject the expansion, add a constraint to prevent it
3. **SPLIT**: Create a separate project for the expanded work

## Concerns and Red-Teaming

Beads includes an AI-powered "red team" that proactively surfaces issues you might not have considered.

### Concern Types

- **Assumptions**: Things you're taking for granted that might not be true
- **Risks**: Things that could go wrong
- **Gaps**: Missing pieces in the plan
- **Dependencies**: External factors the plan relies on
- **Scope Expansion**: Work that's bigger than originally scoped
- **Hidden Work**: Tasks that exist but aren't represented

### Concern Tiers

Concerns are prioritized by severity (computed from impact × probability × urgency):

1. **Blocker** (Tier 1): Must resolve before proceeding
2. **Critical** (Tier 2): High risk if not addressed
3. **Consideration** (Tier 3): Worth thinking about
4. **Background** (Tier 4): Good to know

### Progressive Disclosure

The system shows Blockers and Critical concerns by default. Considerations and Background concerns are collapsed until you want to see them. This prevents overwhelm while ensuring nothing is hidden.

## Constraints

Constraints are explicit limitations on a project:

- **Budget**: Maximum cost allowed
- **Timeline**: Deadlines that must be met
- **Scope**: Boundaries on what's included
- **Must Have**: Required features or outcomes
- **Must Not**: Prohibited approaches or outcomes
- **Boundary**: Conditions for detecting scope violations

Constraints inherit down the hierarchy. A budget constraint on a goal applies to all its children.

## Human-AI Collaboration: The Chief of Staff Model

Beads reimagines AI assistance. The AI isn't a passive tool waiting for instructions—it's your Chief of Staff.

### The Chief of Staff Role

Like a Chief of Staff in an organization, the AI:

- **Drives the process** - Knows what needs to happen and guides conversations toward it
- **Manages details** - Tracks everything so you don't have to
- **Adapts to engagement** - Takes the lead when you're passive, supports when you're driving
- **Defers on authority** - You make the decisions; it executes and tracks

### The Nosey Neighbor Pattern

Every conversation should leave with a LOT of useful information. When you mention something, the AI doesn't just acknowledge—it digs deeper:

**User:** "I have Geico for auto insurance"

**Bad AI:** "Great, got it. Anything else?"

**Good AI (Beads):** "Geico auto - got it. Quick details: What's the policy number? Coverage limits? When does it renew? Also, most people have 2+ vehicles - do you have others on this policy?"

The AI uses domain knowledge to:
- Ask for missing details (policy #, amounts, dates, contacts)
- Probe for related items you might have forgotten
- Suggest specific likely items from its knowledge base

### Long-Term Memory

The AI never forgets. Every conversation is persisted with the task and available as context for future interactions.

- **On this task**: Full dialog history is preserved
- **Related tasks**: Parent, sibling, and blocker task conversations are included as context
- **Never re-ask**: If you answered a question before, the AI references it instead of asking again

When you return after being away:
- The AI reminds you where you were
- States what it still needs
- Offers easy ways to continue

### Handling Interruptions

You may close the app mid-conversation, give incomplete answers, or disappear for days. The AI handles this gracefully:

- **Incomplete answers**: Accepts whatever you give, notes what's missing for later
- **Abrupt closure**: Tracks what was being discussed for when you return
- **Long absence**: Provides context summary and prioritized action list on return

### AI Agenda

The AI maintains its own agenda—what it wants to do, ask, or gather:

- **Pending Questions**: Things it needs you to answer
- **Resources Needed**: Web pages, documents, or data it wants to fetch
- **Access Requests**: Services it wants read access to (to gather info automatically)
- **Background Tasks**: Work it can do without you

This enables proactive behavior: the AI works on what it can while you're away, and comes to you only with what requires your input.

### Execution Types

- **Automated**: AI can do this without supervision
- **AI-Assisted**: AI can do this with human review
- **Human-Assisted**: Human does this with AI support
- **Human**: Only a human can do this

### Assignment

Each task can be assigned to a specific AI model or marked as needing human attention. The system tracks:

- When the assignment was made
- Last activity timestamp
- Whether the task is blocked or needs escalation

### Flagging

Tasks get flagged for human attention when:

- AI reports being blocked
- Timeout (no activity for 15 minutes)
- User explicitly flags it

## Session Continuity

Beads maintains session state to ensure seamless continuation of work.

### What's Tracked

- **Last task**: Which task you were working on
- **Last interaction**: When you last engaged
- **Pending questions**: What the AI is waiting to have answered
- **Prioritized work**: What needs attention, in order of urgency

### Resume Experience

When you return to Beads, you see:

1. **Context reminder**: "Welcome back! You were working on documenting insurance policies..."
2. **Continue button**: Jump right back to where you were
3. **Pending questions**: "I'm still waiting to know your policy number"
4. **Prioritized work queue**: High-priority and stale items that need attention

This eliminates the "where was I?" problem. The AI remembers so you don't have to.

## The Planning Workflow

### 1. Define Goals
Start with a high-level goal. Use "Refine Goal" to make it SMART (Specific, Measurable, Achievable, Relevant, Time-bound).

### 2. Analyze Risks
Use "Analyze Risks" to surface assumptions, risks, gaps, and dependencies before decomposing.

### 3. Decompose
Break goals into subtasks. The system suggests decompositions and identifies shared resources that might affect scope.

### 4. Check Scope
Periodically check for scope expansion. Address any violations explicitly.

### 5. Validate Accuracy
Verify that leaf nodes are well-specified and sufficient to complete parents.

### 6. Execute
Work on actionable leaves (those with no blocking dependencies). Mark complete or failed as appropriate.

### 7. Iterate
As work reveals new information, update the plan. Add concerns, adjust constraints, decompose further.

## Uncertainty Modeling

Some outcomes cannot be known with certainty. Investment returns, project durations, healthcare costs, and longevity are all fundamentally uncertain. Beads provides tools to model and reason about this uncertainty.

### When Uncertainty Matters

Traditional planning assumes we know outcomes. "The project will cost $50,000." "Returns will be 7%." But these are estimates, not facts. Ignoring uncertainty leads to:

- **Overconfidence**: Plans that look precise but aren't
- **Fragility**: Plans that break when reality differs from expectations
- **Poor Decisions**: Choices that ignore tail risks

Beads makes uncertainty explicit and computable.

### Modeling Approaches

Different problems call for different approaches:

| Approach | Best For | Example |
|----------|----------|---------|
| **Monte Carlo** | Many uncertain parameters, need probability distributions | Retirement planning: "What's my chance of running out of money?" |
| **Scenario Analysis** | Discrete named futures are meaningful | Business planning: "What happens in a recession vs. growth?" |
| **Sensitivity Analysis** | Understanding which parameter matters most | Project planning: "Does timeline or cost uncertainty matter more?" |
| **Stress Testing** | Extreme but plausible events | Risk management: "What if the market drops 40%?" |
| **Historical Simulation** | Past data is available and relevant | Market analysis: Using actual historical return sequences |

### Distribution Types

Not all uncertainty is the same:

- **Normal (Gaussian)**: Symmetric, thin tails. Good for averages of many factors.
- **Log-Normal**: Always positive, right-skewed. Good for prices, wealth, and durations (things can't be negative).
- **Student's t**: Fat tails. Essential for market returns where crashes happen more often than normal distributions predict.
- **Triangular**: Min/mode/max. Good when you have three-point estimates from experts.
- **Mixture (Regime-Switching)**: Different states with different distributions. Good for markets that switch between bull and bear.

### AI Suggests Modeling

When you create a goal that involves uncertainty (retirement planning, project cost estimation, financial projections), the AI:

1. **Recognizes the uncertainty** - Identifies which outcomes are inherently unpredictable
2. **Suggests an approach** - Recommends Monte Carlo, scenarios, or other methods
3. **Proposes parameters** - Uses domain knowledge to suggest reasonable distributions
4. **Runs simulations** - Generates thousands of scenarios to compute probabilities
5. **Explains in plain English** - "There's a 5% chance you'll run out of money before age 85"

### Domain Knowledge

The AI uses research-backed defaults:

- **US Stocks**: 7% mean real return, 18% standard deviation, Student's t distribution (df=5) for fat tails
- **Inflation**: 3% mean, 1.5% standard deviation, log-normal (always positive)
- **Project Duration**: Log-normal with 1.5-3x padding (tasks take longer, rarely shorter)
- **Longevity at 65**: Triangular distribution with 15/22/35 years (min/mode/max)

These can be overridden with user-specific data or expert opinion.

### Key Outputs

After running simulations, you get:

- **Percentiles**: "In the 5th percentile, you have $180K. In the 95th, you have $3.5M."
- **Probability of Ruin**: "There's an 8% chance of running out of money."
- **Sensitivity**: "Returns matter more than inflation for your outcome."
- **Recommendations**: "Consider reducing withdrawal rate to 3.5%."

This transforms vague uncertainty into actionable insight.

## Extracted Facts & Validation

Planning produces information that third parties need to verify. A retirement plan, for example, contains specific claims: "Social Security benefit is $2,850/month starting at age 67." These claims need to be:

1. **Extracted** from conversations and documents
2. **Stored** in a structured, queryable format
3. **Verified** against authoritative sources
4. **Exported** for advisors, attorneys, or family members

### The Facts Store

Beads automatically extracts facts during every conversation and stores them in a validation-ready format:

```
Entity: SocialSecurity
Attribute: estimatedMonthlyAtFRA
Value: $2,850
Source: Dialog on 2024-01-15
Confidence: 0.95
Status: User Confirmed
Verification: https://www.ssa.gov/myaccount/
```

### Domain Schemas

Different planning domains have different data requirements. Beads includes pre-built schemas for common domains:

- **Retirement Planning**: Social Security, retirement accounts, pensions, expenses
- **Estate Planning**: Wills, trusts, beneficiaries, assets
- **Insurance Review**: Policies, coverage, premiums, agents
- **Home Renovation**: Contractors, costs, timelines, materials

Schemas define:
- What entities exist (e.g., "RetirementAccount")
- What attributes each entity has (e.g., "currentBalance", "institution")
- Which facts are required vs. optional
- How to verify each fact (document, API, attestation)

### Automatic Extraction

During every conversation, the AI:
1. Listens for concrete facts (numbers, dates, names)
2. Extracts them into structured form
3. Associates them with the appropriate entity/attribute
4. Records the source phrase for auditability

"I have $450,000 in my Fidelity 401k" becomes:
```
Entity: RetirementAccount
Instance: Fidelity 401k
Attribute: currentBalance
Value: $450,000
Extracted: "I have $450,000 in my Fidelity 401k"
```

### Validation Workflow

Facts move through validation states:
1. **Unverified**: Extracted from conversation
2. **User Confirmed**: User explicitly confirmed the value
3. **Externally Verified**: Verified against authoritative source
4. **Disputed**: User or system flagged as incorrect

### External Data Sources

For authoritative verification, Beads supports:
- **Document Upload**: Upload statements, policies, tax returns
- **Session Handoff**: User logs into site, hands session to AI for extraction
- **API Integration**: Direct queries to supported services

### Export Formats

Facts can be exported for external use:
- **JSON**: Structured data for integration
- **CSV**: Spreadsheet-friendly tabular format
- **PDF**: Formatted reports for advisors or family

## Why This Approach Works

### Accuracy Over Precision
We don't predict timelines or promise certainty. We ensure the plan accurately reflects what needs to be done.

### Explicit Over Hidden
Scope expansion, assumptions, and risks are surfaced, not buried. You can't accidentally ignore what the system shows you.

### Structured Over Freeform
The decomposition model and concern taxonomy provide structure. You're not starting from a blank page.

### Collaborative Over Siloed
Human and AI work is coordinated through the same system. Both can see the full plan and contribute appropriately.

### Adaptive Over Rigid
Plans change as work reveals information. The system supports this instead of fighting it.
