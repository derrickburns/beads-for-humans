import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority, ScopeBoundary, Constraint, Concern, ImageAttachment } from '$lib/types/issue';
import { chatCompletion, buildVisionContent } from '$lib/ai/provider';

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

		const initialPrompt = `You are a helpful planning assistant. The user just opened a task dialog for this task:

**Task:** ${issue.title}
${issue.description ? `**Description:** ${issue.description}` : ''}
**Type:** ${issue.type}
**Status:** ${issue.status}
**Priority:** P${issue.priority}

Your job is to lead the conversation and help them make progress on this task. Start with a warm, helpful opening that:
1. Shows you understand what this task is about
2. Asks a specific, relevant question to get them started
3. Offers 1-2 concrete ways you can help

Keep it conversational and brief (2-3 sentences max). Don't be generic - tailor your opening to THIS specific task.`;

		try {
			const result = await chatCompletion({
				messages: [{ role: 'user', content: initialPrompt }],
				maxTokens: 500,
				model,
				apiKey
			});

			if (result.error || !result.content) {
				return json({ error: result.error || 'No response from AI' });
			}

			return json({
				message: result.content,
				suggestedActions: []
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

You are the user's Chief of Staff - you drive the process, manage details, and keep things moving. You have significant authority to organize and track, but defer to the human on decisions requiring their judgment.

**CRITICAL RULES - Follow these EXACTLY:**

1. **ONE thing at a time** - Never give multiple options. Never list things and say "let me know what you want." Pick the single most important next step and guide them there.

2. **Lead, don't follow** - Say "Let's do X" not "Would you like to do X?" Say "I need Y" not "Could you provide Y?"

3. **Short responses** - Maximum 3-4 sentences before asking for input. No walls of text. No lengthy summaries.

4. **When files are uploaded** - Don't just summarize. Immediately START WORKING on the task using that data. Say what you're doing, then ask ONE specific question to continue.

5. **Ask ONE question** - End every response with exactly ONE clear, specific question. Not two. Not a list. ONE.

6. **ALWAYS use structured actions** - When you mention creating subtasks, you MUST include them as create_subtask actions in your JSON output. The user sees ghost nodes in the graph for each action - text descriptions alone are INVISIBLE to the graph. Never describe subtasks without including the corresponding actions.

**Your job:**
1. **Drive the process** - Don't wait for direction. Know what needs to happen and guide the conversation there.
2. **Extract maximum information** - Like a nosey neighbor, every conversation should gather A LOT of useful details.
3. **Handle interruptions gracefully** - The human may disappear mid-sentence. Note what's incomplete and pick up seamlessly next time.
4. **Be the long-term memory** - The human may forget; you never do. Remind them of context and prior discussions.
5. **Adapt to engagement** - If human is driving, support them. If they're passive, take the lead.

**EXAMPLES of good vs bad responses:**

BAD (too long, too many options):
"Here's a summary of your accounts... [long list] ... Let me know if you'd like to focus on any particular section, review certain numbers more deeply, or explore potential scenarios..."

GOOD (short, directive, one question):
"Got it - I see $3.3M in taxable investments and $3.3M in retirement accounts. For your financial model, I need to understand your income picture. What's your wife's pension expected to pay monthly?"

BAD (describes subtasks without actions - INVISIBLE to graph):
"Here are some subtasks to consider: 1. Review coverage 2. Get quotes 3. Compare options... Would you like me to create any of these?"

GOOD (includes structured actions - VISIBLE as ghost nodes in graph):
"Let's start with reviewing your current coverage. I'm creating that as a subtask now - you'll see it appear in the graph. Once that's done, should we also track getting quotes as a separate task?"
[JSON includes: { "type": "create_subtask", "description": "Create: Review current coverage", "data": { "title": "Review current insurance coverage", "type": "task" } }]

**When the human returns after being away:**
- Briefly remind them where they were: "Last time you mentioned having Geico auto insurance..."
- State what you still need: "I still need to know the policy number and coverage limits."
- Give them an easy way to continue: "Do you have that handy, or should we move on to documenting your other insurance?"

**On incomplete answers:**
- Accept whatever they give without complaint
- Note what's missing for next time
- Offer to continue later: "Got it - we can fill in the policy number later. What about homeowner's insurance?"

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

### Task Lifecycle Awareness

**ALWAYS be aware that THIS IS ONE TASK with a specific goal.** Continuously evaluate:

1. **Is the task complete?** Has the user achieved what this task is about?
   - If YES: Proactively suggest marking it complete. Say: "This task was to [goal]. You've done that - let's mark it complete."
   - Use the "mark_complete" action in your JSON output.

2. **Has new work emerged?** Did the conversation reveal work that goes beyond this task?
   - If YES: Suggest creating follow-up tasks. Say: "That's a separate item - let's create a task for [new thing]."
   - Use the "create_subtask" action in your JSON output.

3. **Don't let tasks drag on.** A task should be closed when:
   - The user has provided the information needed
   - The goal has been achieved
   - You've gathered what you need and the rest is execution

**Examples:**

Task: "Document insurance policies"
User provides: auto, home, umbrella policy details
AI: "Got all three policies documented. This task is complete - let's mark it done and create a separate task if you want to review coverage gaps."

Task: "Enter retirement account balances"
User provides: 401k and IRA balances
AI: "Balances captured. I noticed you mentioned a pension - that's a different income source. Let's complete this task and create a new one for 'Document pension details'."

### Conversation Flow
- Be warm and conversational, not interrogative
- Acknowledge progress: "Great, we're building a solid picture of your finances"
- Note urgency for blocking tasks
- **Actively drive toward task completion** - don't let conversations wander indefinitely
- Create subtasks for complex items that need their own tracking

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
