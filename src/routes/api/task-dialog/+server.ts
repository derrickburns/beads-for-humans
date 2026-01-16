import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority, ScopeBoundary, Constraint, Concern, ImageAttachment } from '$lib/types/issue';
import { chatCompletion, buildVisionContent } from '$lib/ai/provider';

// Graph-aware overlap detection
// Uses DAG structure to only check relevant tasks, then uses AI for semantic comparison

interface OverlapCheckTask {
	id: string;
	title: string;
	relationship: 'current' | 'child' | 'sibling' | 'ancestor' | 'dependency';
}

interface SemanticOverlapResult {
	hasOverlap: boolean;
	overlapType: 'duplicate' | 'subset' | 'covered_by_parent' | 'already_child' | 'parallel_work' | 'none';
	matchingTask?: { id: string; title: string; relationship: string };
	reason?: string;
}

// Build the relevant subgraph to check for overlaps
function buildOverlapCheckList(
	currentTask: { id: string; title: string },
	context: {
		children: Array<{ id: string; title: string }>;
		siblings: Array<{ id: string; title: string }>;
		ancestors: Array<{ id: string; title: string }>;
		parent: { id: string; title: string } | null;
	}
): OverlapCheckTask[] {
	const tasks: OverlapCheckTask[] = [];

	// Always check current task (is proposed just rephrasing the parent?)
	tasks.push({ id: currentTask.id, title: currentTask.title, relationship: 'current' });

	// Check existing children (is this already a subtask?)
	for (const child of context.children || []) {
		tasks.push({ id: child.id, title: child.title, relationship: 'child' });
	}

	// Check siblings (is this parallel work already planned?)
	for (const sibling of context.siblings || []) {
		tasks.push({ id: sibling.id, title: sibling.title, relationship: 'sibling' });
	}

	// Check ancestors (is this already covered by a parent task?)
	for (const ancestor of context.ancestors || []) {
		tasks.push({ id: ancestor.id, title: ancestor.title, relationship: 'ancestor' });
	}

	return tasks;
}

// Use AI to check semantic overlap (called once for batch of proposed tasks)
async function checkSemanticOverlaps(
	proposedTasks: Array<{ title: string; description?: string }>,
	existingTasks: OverlapCheckTask[],
	model?: string,
	apiKey?: string
): Promise<Map<string, SemanticOverlapResult>> {
	const results = new Map<string, SemanticOverlapResult>();

	// If no existing tasks to compare, all proposed are unique
	if (existingTasks.length === 0) {
		for (const proposed of proposedTasks) {
			results.set(proposed.title, { hasOverlap: false, overlapType: 'none' });
		}
		return results;
	}

	// Build prompt for AI overlap check
	const existingList = existingTasks
		.map(t => `- [${t.relationship}] "${t.title}"`)
		.join('\n');

	const proposedList = proposedTasks
		.map((t, i) => `${i + 1}. "${t.title}"${t.description ? ` - ${t.description}` : ''}`)
		.join('\n');

	const prompt = `You are checking for semantic overlap between proposed subtasks and existing tasks in a project DAG.

EXISTING TASKS (with their relationship to current task):
${existingList}

PROPOSED SUBTASKS:
${proposedList}

For each proposed subtask, determine if it overlaps with any existing task:
- "duplicate": Same work, just different wording
- "already_child": Already exists as a child task
- "covered_by_parent": The current/ancestor task already encompasses this
- "parallel_work": A sibling task already covers this
- "none": Truly new work, no overlap

Respond with JSON array:
[
  { "proposed": "title", "overlap": "none|duplicate|already_child|covered_by_parent|parallel_work", "matchingTask": "title if overlap", "reason": "brief explanation" }
]

Only JSON, no other text.`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 1000,
			model,
			apiKey
		});

		if (result.content) {
			// Extract JSON from response
			const jsonMatch = result.content.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				const overlaps = JSON.parse(jsonMatch[0]) as Array<{
					proposed: string;
					overlap: string;
					matchingTask?: string;
					reason?: string;
				}>;

				for (const item of overlaps) {
					const matchingExisting = item.matchingTask
						? existingTasks.find(t => t.title.toLowerCase().includes(item.matchingTask!.toLowerCase().slice(0, 20)))
						: undefined;

					results.set(item.proposed, {
						hasOverlap: item.overlap !== 'none',
						overlapType: item.overlap as SemanticOverlapResult['overlapType'],
						matchingTask: matchingExisting ? {
							id: matchingExisting.id,
							title: matchingExisting.title,
							relationship: matchingExisting.relationship
						} : undefined,
						reason: item.reason
					});
				}
			}
		}
	} catch (e) {
		// If AI check fails, allow all (fail open)
		console.error('Semantic overlap check failed:', e);
	}

	// Fill in any missing results as no overlap
	for (const proposed of proposedTasks) {
		if (!results.has(proposed.title)) {
			results.set(proposed.title, { hasOverlap: false, overlapType: 'none' });
		}
	}

	return results;
}

interface DialogMessage {
	role: 'user' | 'assistant';
	content: string;
}

interface IssueRef {
	id: string;
	title: string;
	type?: string;
	status?: string;
	decompositionType?: string;
}

interface ConstraintRef {
	type: string;
	description: string;
	value?: string | number;
	unit?: string;
}

interface ConcernRef {
	type: string;
	title: string;
	status: string;
}

interface RelatedDialogRef {
	issueId: string;
	issueTitle: string;
	relationship: 'parent' | 'sibling' | 'child' | 'blocker';
	messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
}

interface RichContext {
	// Hierarchy
	ancestors: IssueRef[];
	parent: IssueRef | null;
	siblings: IssueRef[];
	children: IssueRef[];

	// Dependencies
	blockedBy: IssueRef[];
	blocks: IssueRef[];

	// Constraints & Scope
	constraints: ConstraintRef[];
	scopeBoundary: ScopeBoundary | null;
	successCriteria: string[];

	// Concerns
	existingConcerns: ConcernRef[];

	// Project
	projectIssues: IssueRef[];

	// Related dialog history - the AI's long-term memory from related tasks
	relatedDialogs?: RelatedDialogRef[];
}

interface SuggestedAction {
	type: 'update_task' | 'create_subtask' | 'mark_complete' | 'add_dependency' | 'add_concern' | 'ask_question' | 'update_scope' | 'add_constraint' | 'add_uncertainty_parameter' | 'suggest_simulation' | 'extract_fact';
	description: string;
	data?: {
		title?: string;
		description?: string;
		type?: IssueType;
		priority?: IssuePriority;
		status?: string;
		concernType?: string;
		question?: string;
		constraintType?: string;
		scopeUpdate?: Partial<ScopeBoundary>;
		// Uncertainty modeling
		name?: string;
		uncertaintyType?: string;
		distribution?: string;
		parameters?: Record<string, unknown>;
		source?: string;
		rationale?: string;
		approach?: string;
		iterations?: number;
		timeHorizon?: number;
		confidenceLevel?: number;
		// Fact extraction
		entity?: string;
		attribute?: string;
		value?: unknown;
		valueType?: string;
		currency?: string;
		confidence?: number;
		extractedPhrase?: string;
		effectiveDate?: string;
	};
}

interface UrlContent {
	url: string;
	content: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	// Handle initial message case (AI leads the conversation)
	if (body.isInitialMessage) {
		const { issue, model, apiKey } = body as {
			issue: { id: string; title: string; description?: string; type: string; status: string; priority: number };
			model?: string;
			apiKey?: string;
		};

		const initialPrompt = `You are the user's Chief of Staff. They just opened this task:

**Task:** ${issue.title}
${issue.description ? `**Description:** ${issue.description}` : ''}
**Type:** ${issue.type}
**Status:** ${issue.status}
**Priority:** P${issue.priority}

Your job is to get them making progress IMMEDIATELY. Assess the task and respond with ONE of these approaches:

**If this task needs PLANNING (complex, multi-step, unclear scope):**
- Say what you're doing: "Breaking this down..."
- List 3-5 subtasks you're creating (these will appear as ghost nodes in the graph)
- Ask ONE question to start: "Let's start with [first subtask] - [specific question]?"

**If this task needs EXECUTION (simple, clear goal):**
- State what's needed: "To complete this, I need [specific thing]."
- Ask the ONE question that unblocks progress.

**If this task might already be DONE:**
- Check if the goal is achieved based on the description
- If yes: "This looks complete - should I mark it done?"

Rules:
- 2-3 sentences MAX
- End with exactly ONE question
- Be specific to THIS task, not generic
- Take action (create subtasks, mark complete) - don't just describe what you COULD do`;

		// Add instruction for JSON output format
		const initialPromptWithFormat = initialPrompt + `

If you create subtasks, output them in a JSON block at the end:
\`\`\`json
{
  "actions": [
    { "type": "create_subtask", "description": "Create: [title]", "data": { "title": "[title]", "type": "task" } }
  ]
}
\`\`\``;

		try {
			const result = await chatCompletion({
				messages: [{ role: 'user', content: initialPromptWithFormat }],
				maxTokens: 800,
				model,
				apiKey
			});

			if (result.error || !result.content) {
				return json({ error: result.error || 'No response from AI' });
			}

			// Parse actions from initial response
			let responseText = result.content;
			let actions: SuggestedAction[] = [];

			const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```\s*$/);
			if (jsonMatch) {
				try {
					const parsed = JSON.parse(jsonMatch[1]);
					actions = parsed.actions || [];
					responseText = result.content.replace(/```json\s*[\s\S]*?\s*```\s*$/, '').trim();
				} catch {
					// JSON parse failed, keep full response
				}
			}

			return json({
				message: responseText,
				suggestedActions: actions
			});
		} catch (error) {
			return json({ error: String(error) });
		}
	}

	// File reference type for uploaded files
	interface FileRef {
		name: string;
		mimeType: string;
		size: number;
		parsedContent?: unknown;
		summary?: string;
	}

	// Regular message handling
	const { task, message, history, context, urlContents, images, files, storedFiles, model, apiKey } = body as {
		task: Issue;
		message: string;
		history: DialogMessage[];
		context: RichContext;
		urlContents?: UrlContent[];
		images?: ImageAttachment[];  // Screenshots/images attached to this message
		files?: FileRef[];           // Newly uploaded files with parsed content
		storedFiles?: FileRef[];     // Previously stored files on this task
		model?: string;
		apiKey?: string;
	};

	// Build the rich context section
	const contextSections: string[] = [];

	// Current task
	contextSections.push(`## Current Task
- Title: "${task.title}"
- Description: ${task.description || 'No description yet'}
- Type: ${task.type}
- Priority: P${task.priority}
- Status: ${task.status}
${task.successCriteria?.length ? `- Success Criteria:\n${task.successCriteria.map(c => `  - ${c}`).join('\n')}` : ''}`);

	// Hierarchy context
	if (context.ancestors.length > 0) {
		const hierarchyPath = [...context.ancestors].reverse().map(a => a.title).join(' → ');
		contextSections.push(`## Hierarchy
This task is part of: ${hierarchyPath} → [Current Task]

${context.parent ? `Direct parent: "${context.parent.title}" (${context.parent.type}${context.parent.decompositionType ? `, ${context.parent.decompositionType} decomposition` : ''})` : ''}`);
	}

	// Siblings
	if (context.siblings.length > 0) {
		contextSections.push(`## Sibling Tasks (same level)
${context.siblings.map(s => `- "${s.title}" (${s.status})`).join('\n')}`);
	}

	// Children
	if (context.children.length > 0) {
		contextSections.push(`## Subtasks
${context.children.map(c => `- "${c.title}" (${c.status})`).join('\n')}`);
	}

	// Dependencies
	if (context.blockedBy.length > 0 || context.blocks.length > 0) {
		let depText = '## Dependencies\n';
		if (context.blockedBy.length > 0) {
			depText += `Blocked by (must complete first):\n${context.blockedBy.map(b => `- "${b.title}" (${b.status})`).join('\n')}\n`;
		}
		if (context.blocks.length > 0) {
			depText += `Blocks (waiting on this):\n${context.blocks.map(b => `- "${b.title}"`).join('\n')}`;
		}
		contextSections.push(depText);
	}

	// Constraints
	if (context.constraints.length > 0) {
		contextSections.push(`## Active Constraints
${context.constraints.map(c => `- ${c.type}: ${c.description}${c.value ? ` (${c.value}${c.unit || ''})` : ''}`).join('\n')}`);
	}

	// Scope boundary
	if (context.scopeBoundary) {
		let scopeText = '## Scope Boundary\n';
		if (context.scopeBoundary.includes.length > 0) {
			scopeText += `In scope: ${context.scopeBoundary.includes.join(', ')}\n`;
		}
		if (context.scopeBoundary.excludes.length > 0) {
			scopeText += `Out of scope: ${context.scopeBoundary.excludes.join(', ')}\n`;
		}
		if (context.scopeBoundary.boundaryConditions.length > 0) {
			scopeText += `Boundary rules: ${context.scopeBoundary.boundaryConditions.join('; ')}`;
		}
		contextSections.push(scopeText);
	}

	// Existing concerns
	if (context.existingConcerns.length > 0) {
		contextSections.push(`## Already Surfaced Concerns
${context.existingConcerns.map(c => `- [${c.status}] ${c.type}: ${c.title}`).join('\n')}`);
	}

	// Other project issues
	if (context.projectIssues.length > 0) {
		contextSections.push(`## Other Issues in Project
${context.projectIssues.map(i => `- "${i.title}" (${i.type}, ${i.status})`).join('\n')}`);
	}

	// Related dialog history - the AI's long-term memory from conversations on related tasks
	// CRITICAL: This is how you remember what was discussed on parent/sibling/blocker tasks
	// Never ask questions that have already been answered in these conversations
	if (context.relatedDialogs && context.relatedDialogs.length > 0) {
		const dialogSections = context.relatedDialogs.map(rd => {
			const messagesText = rd.messages.map(m =>
				`[${m.role === 'user' ? 'Human' : 'AI'}]: ${m.content}`
			).join('\n');
			return `### ${rd.relationship.toUpperCase()}: "${rd.issueTitle}"
${messagesText}`;
		}).join('\n\n');

		contextSections.push(`## Prior Conversations on Related Tasks
IMPORTANT: These are verbatim conversations from related tasks. Use this context to:
1. Never re-ask questions that were already answered
2. Build on information already gathered
3. Understand what the user has already shared

${dialogSections}`);
	}

	// Uploaded files with parsed content
	const allFiles = [...(files || []), ...(storedFiles || [])];
	if (allFiles.length > 0) {
		const fileSections = allFiles.map(f => {
			let fileInfo = `### File: "${f.name}" (${f.mimeType}, ${Math.round(f.size / 1024)}KB)`;
			if (f.summary) {
				fileInfo += `\nSummary: ${f.summary}`;
			}
			if (f.parsedContent) {
				// For JSON files, include the parsed content so AI can analyze it
				const contentStr = typeof f.parsedContent === 'string'
					? f.parsedContent
					: JSON.stringify(f.parsedContent, null, 2);
				// Limit content length to avoid token limits
				const maxLength = 50000;
				if (contentStr.length > maxLength) {
					fileInfo += `\nParsed Content (truncated to first ${maxLength} chars):\n\`\`\`json\n${contentStr.substring(0, maxLength)}...\n\`\`\``;
				} else {
					fileInfo += `\nParsed Content:\n\`\`\`json\n${contentStr}\n\`\`\``;
				}
			}
			return fileInfo;
		}).join('\n\n');

		contextSections.push(`## Uploaded Files
IMPORTANT: The user has uploaded the following files. Analyze the data carefully and:
1. Extract relevant information for this task
2. Identify key data points, accounts, balances, etc.
3. Store important extracted data in your responses
4. Reference specific values from the files when relevant

${fileSections}`);
	}

	// URL contents shared by user
	if (urlContents && urlContents.length > 0) {
		contextSections.push(`## Web Content Shared by User
${urlContents.map(u => `### From: ${u.url}\n${u.content}`).join('\n\n')}`);
	}

	const systemPrompt = `You are a planning assistant helping a user work through a task. You have full context about this task's place in the project hierarchy.

${contextSections.join('\n\n')}

---

## Your Role: Chief of Staff

You are the user's Chief of Staff. Your job is to minimize their cognitive load and maximize their progress. You have FULL AUTHORITY to organize, create tasks, close tasks, and manage the work. The human's job is to make decisions and provide information only they have.

**THE GOLDEN RULE: Just do it.**
- Don't ask "should I create a task?" - CREATE IT. It appears as a ghost node.
- Don't ask "is this done?" - MARK IT COMPLETE if it's done.
- Don't ask "what should we do next?" - TELL THEM what's next.
- Don't list options - PICK ONE and do it.

**SENSE THE USER'S MODE:**

Users come to you in one of two modes. Detect which one and adapt:

**PLANNING MODE** - User wants to understand scope before doing
- Signs: "what's involved?", "how much work?", "let's plan", "break this down"
- Response: Decompose the task into subtasks. Show the full picture. Help them see the forest.
- Create all logical subtasks immediately (they appear as ghost nodes in the graph)
- Say: "Here's how I've broken this down - [X] subtasks. The graph shows them all. Want to adjust before we start?"

**EXECUTION MODE** - User wants to make progress NOW
- Signs: "let's do this", "what's first?", "I have 10 minutes", just diving in
- Response: Focus on ONE thing. Get it done. Move to next.
- Say: "First thing: [specific action]. What's [specific detail you need]?"
- When one thing is done, immediately move to next or mark task complete

**CRITICAL BEHAVIORS:**

1. **ONE thing at a time** - Never give options. Never say "let me know what you want." You decide. You lead.

2. **Create subtasks automatically** - When you see work that needs tracking, CREATE THE SUBTASK. Don't ask. The graph shows ghost nodes - the user can accept/reject with one click.

3. **Close tasks aggressively** - The moment a task's goal is achieved, mark it complete. Say "Done - marking this complete." Don't let tasks linger.

4. **Surface what needs them NOW** - Every response should make clear: "Here's what I need from you to make progress." If you don't need anything, say "Nothing needed from you - I'm [doing X]" or "This is done."

5. **Short responses** - 2-3 sentences max before requiring input. Get in, get what you need, get out.

6. **Always use structured actions** - Every subtask, completion, or update MUST be in the JSON actions. Text without actions is INVISIBLE to the graph.

**EXAMPLES:**

User opens task "Research insurance options"
BAD: "I can help with that! What kind of insurance are you looking for? We could look at auto, home, life..."
GOOD: "Breaking this down into the main insurance types. [Creates 5 subtasks: auto, home, life, umbrella, health]. I see 5 areas in the graph. Let's start with auto - do you currently have coverage or starting fresh?"

User says "I have Geico"
BAD: "Great! Would you like me to document the details?"
GOOD: "Geico auto - got it. Policy number and coverage limits? (If you don't have them handy, we can get them later)"

User provides all details for a task
BAD: "Is there anything else you'd like to add to this task?"
GOOD: "That's everything for auto insurance. Marking this complete. [mark_complete action] Next up: homeowner's. Who's your provider?"

User says "let's see what's left"
BAD: "Here's a summary of all your tasks..."
GOOD: "3 of 5 insurance types done. Remaining: umbrella and health. Umbrella first - do you have a policy or need to get one?"

**PROGRESS IS EVERYTHING:**
- Make the user FEEL progress. "2 down, 3 to go."
- The graph shrinks as tasks complete. Point this out.
- Every interaction should move the needle.

## Guidelines

### Long-term Memory - NEVER Re-Ask
You are the user's long-term memory. You have access to ALL prior conversations on this task AND related tasks.
- NEVER ask a question that has already been answered
- ALWAYS build on information already gathered
- Reference what you know: "You mentioned you have Geico auto insurance..."
- Fill gaps proactively: "For homeowner's insurance, you haven't mentioned the provider yet - who is that through?"

### Maximum Information Extraction
When user shares something, don't just acknowledge - DIG DEEPER:

USER: "I have Geico for auto insurance"
BAD: "Great, got it. Anything else?"
GOOD: "Geico auto - got it. Quick details: What's the policy number? Coverage limits (liability/collision/comprehensive)? And when does it renew? Also, most people have 2+ vehicles - do you have others on this policy or separate policies?"

Every response should:
1. Acknowledge what they shared
2. Ask for missing details on THAT item (policy #, amounts, dates, contacts)
3. Probe for RELATED items they might have forgotten
4. Suggest specific likely items from domain knowledge

### Be Specific, Not Open-Ended
WRONG: "Do you have any other insurance policies?"
RIGHT: "Beyond auto, most people also have: homeowner's/renter's, health, life, umbrella, and sometimes disability or long-term care. Which of these do you have? Let's go through them one by one."

### Domain Knowledge - Use It Aggressively
For insurance: auto, home/renters, health, life, umbrella, disability, long-term care, dental, vision, pet
- For each: carrier, policy #, coverage limits, deductible, premium, renewal date, agent contact

For financial assets: checking, savings, CDs, money market, 401k, IRA (traditional/Roth), brokerage, HSA, 529, real estate, vehicles, jewelry, art, collectibles
- For each: institution, account #, approximate value, beneficiaries, access credentials location

For estate planning: will, revocable trust, power of attorney (financial), healthcare proxy, living will, beneficiary designations on all accounts
- For each: date executed, attorney who drafted, location of originals, who has copies

For debts: mortgage, HELOC, auto loans, student loans, credit cards, personal loans
- For each: lender, account #, balance, interest rate, monthly payment, payoff date

### Task Lifecycle - Be Aggressive

**Every task has ONE goal. Your job is to achieve it and move on.**

1. **Detect completion immediately** - The moment the goal is met, MARK IT COMPLETE. Don't ask "is there anything else?" - that's how tasks linger forever.

2. **Separate concerns ruthlessly** - If something comes up that's NOT this task's goal, CREATE A NEW TASK for it. Don't let scope creep.

3. **Always know what's next** - When you complete a task, immediately point to the next one. "Done. Next up: [sibling task] - ready?"

**COMPLETION TRIGGERS - Mark complete when:**
- Information gathering task: User provided what was asked for
- Decision task: User made the decision
- Research task: You've gathered enough to proceed
- Documentation task: The thing is documented

**DON'T wait for:**
- "Perfect" information - good enough is good enough
- User to say "I'm done" - YOU decide when it's done
- All possible follow-ups - those become new tasks

**The flow:**
1. Task opens → Assess what's needed → Ask for the ONE thing
2. User provides → Capture it → Is goal met?
3. Goal met → MARK COMPLETE → Point to next task
4. Goal not met → Ask for next piece → Repeat

**Example - the RIGHT way:**
Task: "Document auto insurance"
User: "I have Geico, policy ABC123, $100k/$300k liability"
AI: "Got it - Geico, ABC123, 100/300 liability. That's the essentials. Marking complete. [mark_complete] Your home insurance is next - who's the carrier?"

NOT: "Great! Is there anything else about your auto insurance you'd like to add? What about collision coverage? Comprehensive? The renewal date?"

## Output Format
After each response, output a JSON block with actions AND your agenda (what you need). This lets the system track what you're waiting for.

\`\`\`json
{
  "actions": [
    {
      "type": "update_task" | "create_subtask" | "mark_complete" | "add_dependency" | "add_concern" | "add_constraint" | "update_scope",
      "description": "Human-readable description",
      "data": { ... }
    }
  ],
  "agenda": {
    "pendingQuestions": [
      {
        "question": "What is your Geico policy number?",
        "priority": "important",
        "context": "Needed to complete auto insurance documentation"
      }
    ],
    "resourcesNeeded": [
      {
        "type": "web_page",
        "url": "https://www.geico.com/my-policy",
        "description": "User's Geico policy details",
        "whyNeeded": "To extract policy number, coverage limits, and renewal date"
      }
    ],
    "accessRequests": [
      {
        "service": "Geico account",
        "accessType": "read",
        "whyNeeded": "To automatically pull policy details instead of asking user to type them"
      }
    ],
    "backgroundTasks": [
      {
        "description": "Research typical coverage requirements for California drivers",
        "canRunWithoutHuman": true
      }
    ]
  }
}
\`\`\`

**Action types:**
- **update_task**: Update title or description with new information
- **create_subtask**: Create a child task (include title, description)
- **mark_complete**: Mark the current task as done
- **add_dependency**: Add a dependency on another task
- **add_concern**: Surface a risk, assumption, or gap (include concernType: "assumption" | "risk" | "gap")
- **add_constraint**: Add a budget, timeline, or scope constraint
- **update_scope**: Suggest adding to in-scope or out-of-scope lists
- **extract_fact**: Extract a verifiable fact for the validation store (see Fact Extraction below)

⚠️ **MANDATORY**: If your response mentions subtasks, next steps, or things to do, you MUST include a create_subtask action for EACH ONE. Do NOT just describe them in text. Do NOT ask "would you like me to create these?" - just CREATE THEM. The graph shows ghost nodes for each action - without actions, subtasks are invisible.

**Agenda items:**
- **pendingQuestions**: Things you need the human to answer (so system can remind them later)
- **resourcesNeeded**: Web pages, documents, or data you want to fetch
- **accessRequests**: Services/accounts you want read/write access to
- **backgroundTasks**: Work you can do without the human

ALWAYS include an agenda section, even if empty. This is how the system knows what you're waiting for.

## Uncertainty Modeling

Some outcomes cannot be known with certainty (investment returns, longevity, project costs). When you detect uncertainty:

### 1. Recognize Uncertainty
Look for outcomes involving:
- **Market returns** - investment performance, stock prices
- **Inflation** - future cost of living
- **Longevity** - how long someone will live
- **Healthcare costs** - medical expenses over time
- **Income** - employment, earnings changes
- **Interest rates** - borrowing/savings rates
- **Property values** - real estate appreciation
- **Project duration** - how long work takes
- **Project cost** - how much work costs

### 2. Suggest Modeling Approach
Based on the problem, recommend ONE of these:

| Approach | When to Use | Example |
|----------|-------------|---------|
| **Monte Carlo** | Many uncertain parameters, need probability distributions | Retirement planning with investment returns |
| **Scenario Analysis** | Discrete named futures are meaningful | "Bull market", "Stagflation", "Recession" |
| **Sensitivity** | Want to know which parameter matters most | "What if returns are 4% vs 8%?" |
| **Historical Sim** | Past data is available and relevant | Using actual market return sequences |
| **Stress Test** | Need to test extreme but plausible events | "What if market drops 40%?" |
| **Bayesian** | Will update beliefs as new data arrives | Updating retirement plan annually |

### 3. Guide Parameter Definition
For each uncertain parameter, gather:
- **Distribution type**: Normal (typical variation), log-normal (always positive like prices), Student's t (fat tails for markets), triangular (min/mode/max estimate)
- **Key parameters**: mean, standard deviation, min/max bounds
- **Source**: historical data, expert opinion, user estimate
- **Confidence**: how sure are we about these parameters?

### 4. Domain-Specific Defaults
Suggest reasonable defaults based on domain knowledge:

**Investment returns (real, after inflation):**
- US stocks: mean 7%, stdDev 18%, use Student's t (df=5) for fat tails
- US bonds: mean 2%, stdDev 6%, normal distribution
- International stocks: mean 6%, stdDev 22%, Student's t

**Inflation:** mean 3%, stdDev 1.5%, log-normal (always positive)

**Longevity (remaining years at 65):** Use mortality tables, or triangular(15, 22, 35)

**Project durations:** Often log-normal (tasks take longer, rarely shorter), use 1.5x-3x padding

### 5. Output Uncertainty Suggestions
When suggesting uncertainty analysis, include in actions:

\`\`\`json
{
  "type": "add_uncertainty_parameter",
  "description": "Add uncertain parameter for annual stock returns",
  "data": {
    "name": "Annual stock return",
    "uncertaintyType": "market_returns",
    "distribution": "student_t",
    "parameters": {
      "mean": 0.07,
      "stdDev": 0.18,
      "degreesOfFreedom": 5
    },
    "source": "ai_suggested",
    "rationale": "Historical US stock returns with fat tails for crash risk"
  }
}
\`\`\`

Or suggest a simulation configuration:

\`\`\`json
{
  "type": "suggest_simulation",
  "description": "Run Monte Carlo simulation for retirement portfolio",
  "data": {
    "approach": "monte_carlo",
    "iterations": 10000,
    "timeHorizon": 30,
    "confidenceLevel": 0.95
  }
}
\`\`\`

### 6. Explain in Plain English
When presenting uncertainty analysis:
- Explain what the numbers mean: "There's a 5% chance you'll run out of money before age 85"
- Give actionable ranges: "You need between \$1.2M and \$1.8M to retire comfortably"
- Recommend hedges: "Consider a bond tent in your first 5 years of retirement"
- Be honest about limitations: "These projections assume historical patterns continue"

## Fact Extraction

Every conversation contains VERIFIABLE FACTS. Your job is to extract them for the validation store.

### What to Extract
Extract concrete facts that:
- A third party could VERIFY (e.g., Social Security benefit amount, policy number)
- Are SPECIFIC (numbers, dates, names, amounts - not opinions)
- Support the planning process (contact info, account details, dates)

### How to Extract
When the user shares information, output extract_fact actions:

\`\`\`json
{
  "type": "extract_fact",
  "description": "Extract Social Security benefit at full retirement age",
  "data": {
    "entity": "SocialSecurity",
    "attribute": "estimatedMonthlyAtFRA",
    "value": 2850,
    "valueType": "currency",
    "currency": "USD",
    "confidence": 0.95,
    "extractedPhrase": "my statement says $2,850 per month at 67",
    "effectiveDate": "2024-01-15"
  }
}
\`\`\`

### Entity Types
Use these entity names consistently:
- **Person**: Name, birth date, SSN
- **SocialSecurity**: Benefits, start dates
- **RetirementAccount**: 401k, IRA balances
- **Pension**: Pension benefits
- **Insurance**: Policies, coverage
- **Contact**: Advisor, attorney, agent info

### Value Types
- **string**: Text values
- **number**: Plain numbers
- **currency**: Money (include currency field, value as number without formatting)
- **percentage**: As decimal (0.07 for 7%)
- **date**: ISO format (2024-01-15)
- **contact**: Object with name, phone, email, address

### Confidence Levels
- 0.9-1.0: User stated explicitly
- 0.7-0.9: Inferred from strong evidence
- 0.5-0.7: Reasonable inference
- Below 0.5: Don't extract, ask for clarification

### Always Extract From
- Numbers the user mentions (balances, benefits, premiums)
- Dates (birth dates, start dates, renewal dates)
- Contact information (names, phone, email)
- Account identifiers (policy numbers, account numbers)
- Institution names (Fidelity, Vanguard, Geico)`;

	// Build user message - use vision content blocks if images are attached
	let userMessageContent: string | ReturnType<typeof buildVisionContent>;
	if (images && images.length > 0) {
		// Add context about the images
		const imageContext = `\n\n[The user has attached ${images.length} screenshot(s). Please analyze them carefully to extract any relevant information for this task.]`;
		userMessageContent = buildVisionContent(
			message + imageContext,
			images.map(img => ({ data: img.data, mimeType: img.mimeType }))
		);
	} else {
		userMessageContent = message;
	}

	const messages = [
		{ role: 'system' as const, content: systemPrompt },
		...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
		{ role: 'user' as const, content: userMessageContent }
	];

	try {
		const result = await chatCompletion({
			messages,
			maxTokens: 2000,  // Increased to accommodate agenda
			model,
			apiKey
		});

		if (result.error || !result.content) {
			return json({ error: result.error || 'No response from AI' });
		}

		// Parse the response to extract actions and agenda
		const content = result.content;
		let responseText = content;
		let actions: SuggestedAction[] = [];
		let agenda: {
			pendingQuestions?: Array<{ question: string; priority?: string; context?: string }>;
			resourcesNeeded?: Array<{ type?: string; url?: string; description?: string; whyNeeded?: string }>;
			accessRequests?: Array<{ service?: string; accessType?: string; whyNeeded?: string }>;
			backgroundTasks?: Array<{ description?: string; canRunWithoutHuman?: boolean }>;
		} = {};

		// Look for JSON block at the end
		const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```\s*$/);
		if (jsonMatch) {
			try {
				const parsed = JSON.parse(jsonMatch[1]);
				actions = parsed.actions || [];
				agenda = parsed.agenda || {};
				// Remove the JSON block from the response text
				responseText = content.replace(/```json\s*[\s\S]*?\s*```\s*$/, '').trim();
			} catch {
				// JSON parse failed, keep the full response
			}
		}

		// FALLBACK: Extract subtasks from numbered lists if AI didn't include actions
		// This ensures ghost nodes appear even if the model doesn't follow instructions
		const existingSubtaskTitles = new Set(
			actions
				.filter(a => a.type === 'create_subtask')
				.map(a => a.data?.title?.toLowerCase())
		);

		// Track filtered duplicates for user feedback
		const filteredDuplicates: Array<{ proposed: string; existing: string; reason: string }> = [];

		// Collect all proposed subtasks (from both numbered lists and AI actions)
		const proposedFromText: Array<{ title: string; description?: string }> = [];

		// Match numbered list items like "1. **Title:** description" or "1. **Title**\n   - description"
		const numberedListPattern = /^\s*\d+\.\s*\*\*([^*:]+?)(?::\*\*|\*\*:?)\s*(.*)$/gm;
		let match;
		while ((match = numberedListPattern.exec(responseText)) !== null) {
			const title = match[1].trim();
			const description = match[2].trim().replace(/^[-–]\s*/, '');

			// Skip if we already have an action for this
			if (existingSubtaskTitles.has(title.toLowerCase())) continue;

			proposedFromText.push({ title, description: description || undefined });
		}

		// Collect proposed from AI actions too
		const proposedFromActions = actions
			.filter(a => a.type === 'create_subtask' && a.data?.title)
			.map(a => ({ title: a.data!.title!, description: a.data!.description }));

		// Combine all proposed subtasks for semantic overlap checking
		const allProposed = [...proposedFromText, ...proposedFromActions];

		// Build the overlap check list from DAG context
		const overlapCheckList = buildOverlapCheckList(
			{ id: task.id, title: task.title },
			{
				children: context.children.map(c => ({ id: c.id, title: c.title })),
				siblings: context.siblings.map(s => ({ id: s.id, title: s.title })),
				ancestors: context.ancestors.map(a => ({ id: a.id, title: a.title })),
				parent: context.parent ? { id: context.parent.id, title: context.parent.title } : null
			}
		);

		// Run semantic overlap check if we have proposed tasks
		let overlapResults = new Map<string, SemanticOverlapResult>();
		if (allProposed.length > 0 && overlapCheckList.length > 0) {
			overlapResults = await checkSemanticOverlaps(
				allProposed,
				overlapCheckList,
				model,
				apiKey
			);
		}

		// Add text-extracted subtasks as actions, filtering based on semantic overlap
		for (const proposed of proposedFromText) {
			const overlap = overlapResults.get(proposed.title);

			if (overlap?.hasOverlap) {
				// Track what was filtered and why
				const reasonMap: Record<string, string> = {
					duplicate: `Already exists as "${overlap.matchingTask?.title || 'existing task'}"`,
					already_child: `Already a subtask: "${overlap.matchingTask?.title || 'existing child'}"`,
					covered_by_parent: `Already covered by parent task`,
					parallel_work: `Sibling task already covers this: "${overlap.matchingTask?.title || 'sibling'}"`,
					subset: `Covered by "${overlap.matchingTask?.title || 'existing task'}"`,
					none: ''
				};

				filteredDuplicates.push({
					proposed: proposed.title,
					existing: overlap.matchingTask?.title || 'existing task',
					reason: overlap.reason || reasonMap[overlap.overlapType] || 'Overlaps with existing work'
				});

				// Skip duplicates, already_child, and covered_by_parent entirely
				if (['duplicate', 'already_child', 'covered_by_parent', 'subset'].includes(overlap.overlapType)) {
					continue;
				}

				// For parallel_work, still create but note the overlap
				actions.push({
					type: 'create_subtask',
					description: `Create subtask: ${proposed.title} (Note: ${overlap.reason || 'may overlap with parallel work'})`,
					data: {
						title: proposed.title,
						description: proposed.description,
						type: 'task' as IssueType
					}
				});
			} else {
				// No overlap - add normally
				actions.push({
					type: 'create_subtask',
					description: `Create subtask: ${proposed.title}`,
					data: {
						title: proposed.title,
						description: proposed.description,
						type: 'task' as IssueType
					}
				});
			}
		}

		// Filter AI-generated actions based on semantic overlap
		actions = actions.filter(action => {
			if (action.type !== 'create_subtask' || !action.data?.title) return true;

			// Skip if this is one we just added from text extraction
			if (proposedFromText.some(p => p.title === action.data?.title)) return true;

			const overlap = overlapResults.get(action.data.title);
			if (overlap?.hasOverlap &&
				['duplicate', 'already_child', 'covered_by_parent', 'subset'].includes(overlap.overlapType)) {
				filteredDuplicates.push({
					proposed: action.data.title,
					existing: overlap.matchingTask?.title || 'existing task',
					reason: overlap.reason || `${overlap.overlapType} overlap detected`
				});
				return false;
			}
			return true;
		});

		// Append a note about filtered duplicates to the response
		if (filteredDuplicates.length > 0) {
			const notes = filteredDuplicates
				.map(d => `• "${d.proposed}" - ${d.reason}`)
				.join('\n');
			responseText += `\n\n*Note: ${filteredDuplicates.length} suggestion(s) filtered as duplicates/overlaps:*\n${notes}`;
		}

		return json({
			response: responseText,
			actions,
			agenda
		});
	} catch (error) {
		console.error('Error in task dialog:', error);
		return json({ error: 'Failed to process message' });
	}
};
