# Beads Planning Documentation

Beads is a planning system that maintains accurate plans as work evolves, bridging human and AI collaboration.

## Documentation Structure

This documentation follows the [Diataxis](https://diataxis.fr/) methodology, organizing content by purpose:

| Section | Purpose | When to Use |
|---------|---------|-------------|
| [Tutorials](tutorials/) | Learning-oriented guides | You're new and want to learn |
| [How-To Guides](how-to/) | Task-oriented instructions | You need to accomplish something specific |
| [Explanation](explanation/) | Understanding-oriented discussions | You want to understand why things work |
| [Reference](reference/) | Information-oriented descriptions | You need exact specifications |

---

## Quick Start

New to Beads? Start here:

1. **[Getting Started Tutorial](tutorials/getting-started.md)** - Create your first plan
2. **[Core Concepts](explanation/concepts.md)** - Understand how Beads thinks about planning

---

## Tutorials

Step-by-step learning guides for new users.

- **[Getting Started](tutorials/getting-started.md)**
  Create a complete plan from scratch, learning refinement, decomposition, and execution.

---

## How-To Guides

Practical instructions for specific tasks.

- **[Planning Guide](how-to/planning-guide.md)**
  - How to Define a Well-Specified Goal
  - How to Surface Hidden Risks
  - How to Decompose a Complex Task
  - How to Handle Scope Expansion
  - How to Set Up Dependencies
  - How to Work with Constraints
  - How to Review and Address Concerns
  - How to Assign Work to AI
  - How to Validate a Plan Before Execution
  - How to Track Progress on a Large Project

---

## Explanation

Understanding the ideas behind Beads.

- **[Core Concepts](explanation/concepts.md)**
  - The Plan Accuracy Invariant
  - Hierarchical Task Decomposition
  - AND-OR Decomposition
  - Dependencies vs Hierarchy
  - Scope Boundaries
  - Concerns and Red-Teaming
  - Constraints
  - Human-AI Collaboration
  - The Planning Workflow

---

## Reference

Technical specifications and API documentation.

- **[API Reference](reference/api.md)**
  - Data Types (Issue, Constraint, Concern, etc.)
  - Store Methods (CRUD, Dependencies, Hierarchy, etc.)
  - API Endpoints
  - Computed Values

---

## Key Concepts

### The Plan Accuracy Invariant

> A plan is accurate if and only if completing all leaf nodes guarantees the parent goal is achieved.

This is the central principle. Plans in Beads don't just track what you said you'd do—they reflect what actually needs to be done.

### Hierarchical Decomposition

Tasks form a tree:
- **Goals** at the top decompose into subtasks
- **Containers** have children and derive their status from them
- **Leaves** are actionable work items

### AND-OR Semantics

How children combine to complete parents:
- **AND**: All children must complete (default)
- **OR-Fallback**: Try in order until one succeeds
- **OR-Race**: Run in parallel, first success wins
- **Choice**: Explore all, human picks one

### Progressive Concern Disclosure

Concerns are tiered by severity:
1. **Blockers**: Must resolve now
2. **Critical**: High risk if ignored
3. **Considerations**: Worth thinking about
4. **Background**: Good to know

Lower tiers are collapsed by default to prevent overwhelm.

### Human-AI Collaboration

Every task has an execution type:
- **Automated**: AI can handle alone
- **AI-Assisted**: AI does, human reviews
- **Human-Assisted**: Human does, AI helps
- **Human**: Only human can do

The system tracks assignments and flags tasks needing attention.

---

## Common Workflows

### Planning a New Project

1. Create a goal with Quick Add
2. Refine the goal (make it SMART)
3. Analyze risks before decomposing
4. Break down into subtasks
5. Add dependencies between tasks
6. Set constraints (budget, timeline, scope)
7. Validate plan accuracy
8. Begin execution on actionable tasks

### Handling Discovered Work

1. Create the new task
2. Link it appropriately (dependency or child)
3. Check for scope expansion
4. If expanded, choose: EXPAND, CONSTRAIN, or SPLIT
5. Update constraints if scope changed

### Reviewing Progress

1. Check project stats on goal page
2. View dependency graph for visual status
3. Review blocked tasks
4. Address tier 1-2 concerns
5. Work actionable tasks

---

## Getting Help

- Check the [How-To Guides](how-to/) for specific tasks
- Read [Core Concepts](explanation/concepts.md) for understanding
- Use [API Reference](reference/api.md) for technical details
- File issues at the project repository
