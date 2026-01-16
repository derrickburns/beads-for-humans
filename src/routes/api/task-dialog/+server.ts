import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority, ScopeBoundary, Constraint, Concern } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

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
	const { task, message, history, context, urlContents, model, apiKey } = (await request.json()) as {
		task: Issue;
		message: string;
		history: DialogMessage[];
		context: RichContext;
		urlContents?: UrlContent[];
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

**Your job:**
1. **Drive the process** - Don't wait for direction. Know what needs to happen and guide the conversation there.
2. **Extract maximum information** - Like a nosey neighbor, every conversation should gather A LOT of useful details.
3. **Handle interruptions gracefully** - The human may disappear mid-sentence. Note what's incomplete and pick up seamlessly next time.
4. **Be the long-term memory** - The human may forget; you never do. Remind them of context and prior discussions.
5. **Adapt to engagement** - If human is driving, support them. If they're passive, take the lead.

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

### Conversation Flow
- Be warm and conversational, not interrogative
- Acknowledge progress: "Great, we're building a solid picture of your finances"
- Note urgency for blocking tasks
- Suggest marking complete when you have enough
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

	const messages = [
		{ role: 'system' as const, content: systemPrompt },
		...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
		{ role: 'user' as const, content: message }
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
