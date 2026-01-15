# Agent Instructions

## Product Vision

**Beads** is an AI-powered project planning tool for non-experts tackling life's major projects.

### The Problem
Most people encounter complex, high-stakes projects only once or twice in their lifetimes—electing a pension plan, preparing a house for sale, remodeling a kitchen, choosing a high school or college for a child. They lack expertise and often rely on expensive paid advisors or general contractors.

Traditional project management tools like Microsoft Project are designed for professional project managers and require significant manual effort to maintain dependencies, timelines, and status updates.

### The Solution
Beads replaces the paid advisor with AI that:
- **Predicts dependencies** between tasks automatically
- **Suggests likely outcomes** and identifies blockers
- **Updates the plan** as circumstances change
- **Requires minimal user effort**—no project management expertise needed

### Design Principles
- **Apple-level UX**: Simple, intuitive, delightful to use
- **AI-first**: Let AI handle the complexity; users focus on decisions
- **Adaptive**: The plan evolves with new information
- **Accessible**: Built for people who have never managed a project before

### Target Use Cases
- Personal finance decisions (pension election, insurance selection)
- Home projects (selling a house, remodeling, major repairs)
- Family decisions (school selection, college planning, eldercare)
- Life transitions (career change, relocation, starting a business)

---

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

