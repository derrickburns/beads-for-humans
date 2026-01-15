# Getting Started with Beads Planning

This tutorial walks you through creating your first structured plan in Beads. By the end, you'll understand how to define goals, decompose work, manage concerns, and maintain plan accuracy.

## Prerequisites

- Beads installed and running locally
- An AI provider configured (OpenAI, Anthropic, or custom)
- About 30 minutes

## What We'll Build

We'll plan a "Launch Personal Blog" project, discovering:
- How to refine vague goals into actionable plans
- How the AI surfaces risks and assumptions
- How to handle scope expansion
- How to validate plan accuracy

## Step 1: Create Your First Goal

### Create the Goal

1. Click **"Quick Add"** in the top bar
2. Type: "Launch a personal blog"
3. Click **"Quick Add"** or press Enter

The AI will expand this into a structured issue:

```
Title: Launch Personal Blog
Type: Goal
Priority: P2 - Medium
Description: Set up and deploy a personal blog for publishing articles...
```

### View the Goal

Click **"View"** to open the goal detail page. Notice:
- It's marked as a **Goal** type (indicating a high-level outcome)
- There's no decomposition yet (it's still a leaf node)
- The Planning Assistant section appears at the bottom

## Step 2: Refine the Goal

Vague goals lead to vague plans. Let's make this goal specific.

### Use the Refine Tool

1. In the **Planning Assistant** section, click **"Refine Goal"**
2. Wait for the AI to analyze your goal

The AI returns refined details:

```
Refined Title: Launch Personal Tech Blog
Success Criteria:
- Blog is accessible at a custom domain
- At least 5 articles are published
- Site loads in under 2 seconds
- RSS feed is functional
- Analytics tracking is active
```

### Apply the Refinement

Click **"Apply Refinement"** to update your goal. Now it has explicit success criteria—you'll know when you're done.

## Step 3: Analyze Risks Before Decomposing

Before breaking down the work, let's identify what could go wrong.

### Run Risk Analysis

1. Click **"Analyze Risks"**
2. Review the concerns surfaced

The AI might identify:

```
Concerns:
1. Assumption (High Impact): Assumes technical expertise with web hosting
2. Risk (Medium Impact): Domain registration may take 24-48 hours
3. Gap: No content strategy or writing schedule defined
4. Dependency: Need to choose tech stack before any implementation
```

### Add the Concerns

Click **"Add 4 Concerns"** to attach these to your goal. They now appear in the **Concern Panel** organized by tier:

- **Blockers** (Tier 1): None yet
- **Critical** (Tier 2): Technical expertise assumption
- **Considerations** (Tier 3): Domain timing, content strategy
- **Background** (Tier 4): Tech stack dependency

## Step 4: Decompose the Goal

Now that we understand the risks, let's break down the work.

### Generate Decomposition

1. Click **"Break Down"**
2. Review the suggested subtasks

```
Suggested Subtasks:
1. Select and configure tech stack
2. Set up hosting environment
3. Register and configure custom domain
4. Create initial blog design
5. Write and publish first 5 articles
6. Set up analytics and RSS

Shared Resources Detected:
- Domain name (affects hosting, DNS, email)
- Hosting provider (affects deployment, costs, SSL)
```

### Notice the Shared Resources

The system identifies that "domain name" and "hosting provider" are shared resources—decisions that affect multiple tasks. Changing them later would cascade through your plan.

### Create the Subtasks

Click **"Create 6 Subtasks"** to decompose your goal.

Your goal is now a **container** with 6 children. Its status will be computed from the children (AND decomposition by default—all must complete).

## Step 5: Explore the Plan Structure

### View in Graph

Click **"View in Graph"** from the goal page. You'll see:

```
[Launch Personal Tech Blog] (container)
    ├── [Select and configure tech stack] (leaf)
    ├── [Set up hosting environment] (leaf)
    ├── [Register and configure domain] (leaf)
    ├── [Create initial blog design] (leaf)
    ├── [Write and publish articles] (leaf)
    └── [Set up analytics and RSS] (leaf)
```

### Understand Container Status

Notice your goal now shows:
- **Type**: Goal (container)
- **Status**: Open (derived from children)
- **Children**: 6 tasks (0 complete)

The goal will automatically close when all 6 tasks close.

## Step 6: Add Dependencies

Some tasks must happen before others. The tech stack choice affects hosting setup.

### Open a Task

Click on "Set up hosting environment" to open its detail page.

### Add a Dependency

1. In the **"Must Complete First"** section, click **"Add"**
2. Select "Select and configure tech stack"
3. The dependency is created

Now "Set up hosting environment" won't be actionable until the tech stack is selected.

### Use AI Suggestions

Click **"AI Suggest"** to have the AI analyze dependencies. It might suggest:

```
"Register and configure domain" should depend on:
- "Select and configure tech stack" (need hosting provider for DNS)

Confidence: 85%
```

Accept or reject each suggestion.

## Step 7: Handle Scope Expansion

Let's simulate discovering additional work.

### Add a New Task

Return to your goal and click "Create Related Issue":

1. Title: "Set up email newsletter with custom domain integration"
2. Choose "This blocks new issue"
3. Click **"Create & Open"**

### Detect the Expansion

On your goal page, the **Planning Assistant** shows an alert:

```
Scope Expansion Detected
1 issue may be outside original scope
```

Click **"Review scope"** to see:

```
"Set up email newsletter" references excluded scope
Reason: Newsletter infrastructure wasn't in original scope
```

### Choose Your Response

You have three options:

1. **EXPAND**: Add newsletter to scope, update success criteria
2. **CONSTRAIN**: Remove the newsletter task, add constraint "no newsletter"
3. **SPLIT**: Create separate "Newsletter Setup" project

For this tutorial, click **"EXPAND"** and update your success criteria to include newsletter functionality.

## Step 8: Further Decompose

Large tasks often need breakdown. Let's decompose "Write and publish articles."

### Open the Task

Navigate to "Write and publish first 5 articles"

### Break It Down

1. Click **"Break Down"** in the Planning Assistant
2. The AI suggests:

```
Subtasks:
1. Outline topics for 5 initial articles
2. Write and edit article 1
3. Write and edit article 2
4. Write and edit article 3
5. Write and edit article 4
6. Write and edit article 5
7. Review and schedule publication
```

### Create as OR-Race

For writing articles, you might want to write them in parallel. When creating, you can choose decomposition type:

- **AND**: All articles must be written (default)
- **OR-Fallback**: Write until you have enough
- **Choice**: Write all, pick best 5

For a blog launch, AND is correct—all 5 are needed.

## Step 9: Validate Plan Accuracy

Before starting work, let's verify the plan is complete.

### Run Validation

Click **"Validate Plan"** on your goal. The system checks:

```
Plan Accuracy Check:
✓ All leaves are well-specified
✓ All containers have sufficient children
✓ No orphan dependencies
✓ No circular dependencies
```

If issues exist:

```
Issues Found:
- "Write and edit article 1" needs more detail
  Suggestion: Add acceptance criteria for article quality
```

Address each issue before starting execution.

## Step 10: Start Executing

### Find Actionable Tasks

Return to the main page and look for tasks that are:
- Leaf nodes (no children)
- Have no blocking dependencies (or dependencies are complete)
- Status is "Open"

These appear in the **Actionable** section.

### Work on a Task

1. Click on "Select and configure tech stack"
2. Click **"In Progress"** to claim it
3. Do the work
4. Click **"Closed"** when complete

### Watch Status Propagate

When all children of a container complete:
- The container automatically closes
- This may unblock other tasks

## Summary

You've learned:

1. **Creating Goals**: Start with high-level outcomes
2. **Refinement**: Make goals SMART with success criteria
3. **Risk Analysis**: Surface assumptions and concerns before planning
4. **Decomposition**: Break work into subtasks with appropriate types (AND/OR)
5. **Dependencies**: Express ordering constraints between tasks
6. **Scope Management**: Detect and handle scope expansion explicitly
7. **Validation**: Verify plan accuracy before execution
8. **Execution**: Work actionable tasks, watch status propagate

## Next Steps

- [How to Work with AI Assistants](../how-to/ai-assistants.md)
- [How to Manage Multiple Projects](../how-to/multiple-projects.md)
- [Concept: AND-OR Decomposition](../explanation/concepts.md#and-or-decomposition)
- [Reference: API Documentation](../reference/api.md)
