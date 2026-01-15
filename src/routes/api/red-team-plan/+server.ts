import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type {
	Issue,
	IssueType,
	IssuePriority,
	Concern,
	ConcernType,
	Constraint,
	ScopeBoundary,
	DecompositionType
} from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

// Request types
interface RefineGoalRequest {
	action: 'refine_goal';
	goal: string;
	context?: string;
	existingIssues?: Issue[];
}

interface AnalyzeRisksRequest {
	action: 'analyze_risks';
	issue: Issue;
	existingIssues: Issue[];
	scopeBoundary?: ScopeBoundary;
}

interface SuggestDecompositionRequest {
	action: 'suggest_decomposition';
	issue: Issue;
	existingIssues: Issue[];
	constraints?: Constraint[];
	depth?: 'shallow' | 'deep';
}

interface DetectScopeExpansionRequest {
	action: 'detect_scope_expansion';
	originalGoal: Issue;
	currentIssues: Issue[];
}

interface ValidateAccuracyRequest {
	action: 'validate_accuracy';
	goal: Issue;
	allIssues: Issue[];
}

type RedTeamRequest =
	| RefineGoalRequest
	| AnalyzeRisksRequest
	| SuggestDecompositionRequest
	| DetectScopeExpansionRequest
	| ValidateAccuracyRequest;

// Response types
interface RefinedGoal {
	title: string;
	description: string;
	successCriteria: string[];
	isWellSpecified: boolean;
	clarifyingQuestions?: string[];
	suggestedConstraints?: Array<{
		type: Constraint['type'];
		description: string;
		rationale: string;
	}>;
	suggestedScopeBoundary?: {
		description: string;
		includes: string[];
		excludes: string[];
		boundaryConditions: string[];
	};
}

interface IdentifiedConcern {
	type: ConcernType;
	title: string;
	description: string;
	impact: 1 | 2 | 3;
	probability: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	relatedIssueIds: string[];
	suggestedActions: Array<{
		type: 'expand_scope' | 'add_constraint' | 'add_contingency' | 'research' | 'split_project';
		description: string;
		creates?: {
			issueType: IssueType;
			title: string;
			description: string;
		};
	}>;
	userAware: boolean;
}

interface SuggestedDecomposition {
	decompositionType: DecompositionType;
	rationale: string;
	children: Array<{
		title: string;
		description: string;
		type: IssueType;
		priority: IssuePriority;
		successCriteria?: string[];
		executionType?: 'human' | 'ai_assisted' | 'human_assisted' | 'automated';
		dependsOnIndex?: number[]; // Indices of other children this depends on
	}>;
	sharedResources?: Array<{
		name: string;
		type: string;
		affectsAreas: string[];
		riskDescription: string;
	}>;
	questionsBeforeProceeding?: string[];
}

interface ScopeExpansionResult {
	hasExpanded: boolean;
	expansions: Array<{
		issueTitle: string;
		issueId: string;
		reason: string;
		severity: 'high' | 'medium' | 'low';
		suggestedAction: 'expand' | 'constrain' | 'split' | 'remove';
	}>;
	recommendation: string;
}

interface AccuracyValidation {
	isAccurate: boolean;
	issues: Array<{
		type: 'underspecified' | 'missing_decomposition' | 'insufficient_children' | 'orphaned_dependency';
		issueId: string;
		issueTitle: string;
		problem: string;
		suggestion: string;
	}>;
	overallAssessment: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { action, model, apiKey, ...rest } = body as RedTeamRequest & { model?: string; apiKey?: string };

	try {
		switch (action) {
			case 'refine_goal':
				return json(await refineGoal(rest as RefineGoalRequest, model, apiKey));
			case 'analyze_risks':
				return json(await analyzeRisks(rest as AnalyzeRisksRequest, model, apiKey));
			case 'suggest_decomposition':
				return json(await suggestDecomposition(rest as SuggestDecompositionRequest, model, apiKey));
			case 'detect_scope_expansion':
				return json(await detectScopeExpansion(rest as DetectScopeExpansionRequest, model, apiKey));
			case 'validate_accuracy':
				return json(await validateAccuracy(rest as ValidateAccuracyRequest, model, apiKey));
			default:
				return json({ error: `Unknown action: ${action}` }, { status: 400 });
		}
	} catch (error) {
		console.error('Red team API error:', error);
		return json({ error: 'Failed to process request' }, { status: 500 });
	}
};

async function refineGoal(
	req: RefineGoalRequest,
	model?: string,
	apiKey?: string
): Promise<{ refinedGoal: RefinedGoal }> {
	const prompt = `You are a planning advisor helping refine a goal into a well-specified outcome.

USER'S GOAL: "${req.goal}"
${req.context ? `ADDITIONAL CONTEXT: ${req.context}` : ''}
${req.existingIssues?.length ? `EXISTING TASKS:\n${req.existingIssues.map(i => `- ${i.title}`).join('\n')}` : ''}

Your job is to:
1. Rewrite the goal as a clear, outcome-focused statement (what "done" looks like)
2. Define specific, measurable success criteria
3. Identify what constraints should be established (budget, timeline, scope, must-haves, must-nots)
4. Define scope boundaries (what's IN scope, what's explicitly OUT of scope)
5. Surface any clarifying questions that would help refine the goal further

IMPORTANT: Transform vague goals into concrete outcomes:
- BAD: "Remodel kitchen"
- GOOD: "Have a functional, updated kitchen with new countertops, appliances, and lighting, within budget, by [date]"

Respond with JSON:
{
  "title": "Outcome-focused goal title",
  "description": "Detailed description of what success looks like",
  "successCriteria": ["Specific criterion 1", "Specific criterion 2", ...],
  "isWellSpecified": true/false,
  "clarifyingQuestions": ["Question 1?", "Question 2?"],
  "suggestedConstraints": [
    {"type": "budget|timeline|scope|must_have|must_not|boundary", "description": "...", "rationale": "..."}
  ],
  "suggestedScopeBoundary": {
    "description": "What this project covers",
    "includes": ["Area 1", "Area 2"],
    "excludes": ["Area to avoid 1", "Area to avoid 2"],
    "boundaryConditions": ["Do not affect X", "Must preserve Y"]
  }
}`;

	const result = await chatCompletion({
		messages: [{ role: 'user', content: prompt }],
		maxTokens: 2000,
		model,
		apiKey
	});

	if (result.error || !result.content) {
		throw new Error(result.error || 'No response from AI');
	}

	const jsonMatch = result.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse AI response');
	}

	return { refinedGoal: JSON.parse(jsonMatch[0]) };
}

async function analyzeRisks(
	req: AnalyzeRisksRequest,
	model?: string,
	apiKey?: string
): Promise<{ concerns: IdentifiedConcern[] }> {
	const prompt = `You are a red-team advisor analyzing a task for risks, assumptions, and concerns.

TASK TO ANALYZE:
Title: "${req.issue.title}"
Description: "${req.issue.description || 'No description'}"
Type: ${req.issue.type}
${req.scopeBoundary ? `
SCOPE BOUNDARY:
- In scope: ${req.scopeBoundary.includes.join(', ')}
- Out of scope: ${req.scopeBoundary.excludes.join(', ')}
- Boundary conditions: ${req.scopeBoundary.boundaryConditions.join(', ')}
` : ''}

EXISTING RELATED TASKS:
${req.existingIssues.map(i => `- "${i.title}" (${i.status})`).join('\n')}

Your job is to proactively surface:

1. ASSUMPTIONS - What is the user taking for granted that might not be true?
   - External factors (market conditions, regulations, availability)
   - Resource availability (time, money, people, skills)
   - Technical feasibility
   - Dependencies on third parties

2. RISKS - What could go wrong?
   - Scope creep (work that reveals more work)
   - External dependencies (things outside user's control)
   - Hidden costs or delays
   - Knowledge gaps

3. SHARED RESOURCES - Does this task touch something that affects other areas?
   - Like electrical wiring that runs through multiple rooms
   - Like a database schema used by multiple systems
   - Like a shared dependency that others rely on

4. GAPS - What information is missing?
   - Decisions that haven't been made
   - Research that hasn't been done
   - Stakeholders who haven't been consulted

For each concern, suggest concrete actions the user can take.

Rate each concern:
- impact: 1 (minor), 2 (moderate), 3 (severe)
- probability: 1 (unlikely), 2 (possible), 3 (likely)
- urgency: 1 (can wait), 2 (soon), 3 (immediate)

Respond with JSON:
{
  "concerns": [
    {
      "type": "assumption|risk|gap|dependency|scope_expansion|hidden_work",
      "title": "Short title",
      "description": "Full description with domain knowledge",
      "impact": 1-3,
      "probability": 1-3,
      "urgency": 1-3,
      "relatedIssueIds": [],
      "suggestedActions": [
        {
          "type": "expand_scope|add_constraint|add_contingency|research|split_project",
          "description": "What to do",
          "creates": {
            "issueType": "task|risk|question|constraint|contingency",
            "title": "New issue title",
            "description": "New issue description"
          }
        }
      ],
      "userAware": false
    }
  ]
}

Be thorough but prioritize. Surface the 3-7 most important concerns.
Include domain-specific knowledge (e.g., "Social Security faces 2033 funding cliff").`;

	const result = await chatCompletion({
		messages: [{ role: 'user', content: prompt }],
		maxTokens: 3000,
		model,
		apiKey
	});

	if (result.error || !result.content) {
		throw new Error(result.error || 'No response from AI');
	}

	const jsonMatch = result.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse AI response');
	}

	const parsed = JSON.parse(jsonMatch[0]);
	return { concerns: parsed.concerns || [] };
}

async function suggestDecomposition(
	req: SuggestDecompositionRequest,
	model?: string,
	apiKey?: string
): Promise<{ decomposition: SuggestedDecomposition }> {
	const prompt = `You are a planning advisor helping break down a task into subtasks.

TASK TO DECOMPOSE:
Title: "${req.issue.title}"
Description: "${req.issue.description || 'No description'}"
Priority: P${req.issue.priority}
${req.issue.successCriteria?.length ? `Success Criteria:\n${req.issue.successCriteria.map(c => `- ${c}`).join('\n')}` : ''}

${req.constraints?.length ? `CONSTRAINTS:\n${req.constraints.map(c => `- [${c.type}] ${c.description}`).join('\n')}` : ''}

EXISTING ISSUES FOR REFERENCE:
${req.existingIssues.map(i => `- "${i.title}" (${i.type}, ${i.status})`).join('\n')}

Depth preference: ${req.depth || 'shallow'} (shallow = level 1 only, deep = fully detailed)

Your job is to:
1. Break this task into the MINIMUM set of subtasks required to guarantee the outcome
2. Determine the decomposition type:
   - "and" = ALL subtasks must complete (most common)
   - "or_fallback" = Try subtasks in order until one succeeds
   - "or_race" = Run subtasks in parallel, first success wins
   - "choice" = Explore all options, then choose one

3. For each subtask:
   - Write an outcome-focused title (what "done" looks like)
   - Determine who can do it (human, ai_assisted, human_assisted, automated)
   - Identify dependencies between subtasks (which must be done first)

4. Identify SHARED RESOURCES that might cause scope expansion
   - Resources that affect areas outside this task's scope
   - Things that might reveal hidden work

5. Note any questions that should be answered before proceeding

Respond with JSON:
{
  "decompositionType": "and|or_fallback|or_race|choice",
  "rationale": "Why this decomposition type",
  "children": [
    {
      "title": "Outcome-focused subtask title",
      "description": "What this subtask accomplishes",
      "type": "task|question|risk|contingency",
      "priority": 0-4,
      "successCriteria": ["Criterion 1"],
      "executionType": "human|ai_assisted|human_assisted|automated",
      "dependsOnIndex": [0, 1]  // Indices of other children this depends on
    }
  ],
  "sharedResources": [
    {
      "name": "Resource name (e.g., 'electrical wiring')",
      "type": "Category (e.g., 'electrical')",
      "affectsAreas": ["Kitchen", "Dining room"],
      "riskDescription": "How this could expand scope"
    }
  ],
  "questionsBeforeProceeding": ["Question 1?", "Question 2?"]
}

IMPORTANT:
- Each subtask must have a clear "done" state
- Prefer fewer, well-specified subtasks over many vague ones
- If subtask is too complex, note it should be further decomposed`;

	const result = await chatCompletion({
		messages: [{ role: 'user', content: prompt }],
		maxTokens: 3000,
		model,
		apiKey
	});

	if (result.error || !result.content) {
		throw new Error(result.error || 'No response from AI');
	}

	const jsonMatch = result.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse AI response');
	}

	return { decomposition: JSON.parse(jsonMatch[0]) };
}

async function detectScopeExpansion(
	req: DetectScopeExpansionRequest,
	model?: string,
	apiKey?: string
): Promise<ScopeExpansionResult> {
	const prompt = `You are a scope monitor analyzing whether a project has expanded beyond its original boundaries.

ORIGINAL GOAL:
Title: "${req.originalGoal.title}"
Description: "${req.originalGoal.description || 'No description'}"
${req.originalGoal.scopeBoundary ? `
Scope Boundary:
- In scope: ${req.originalGoal.scopeBoundary.includes.join(', ')}
- Out of scope: ${req.originalGoal.scopeBoundary.excludes.join(', ')}
- Boundary conditions: ${req.originalGoal.scopeBoundary.boundaryConditions.join(', ')}
` : 'No explicit scope boundary defined.'}

CURRENT TASKS IN PLAN:
${req.currentIssues.map(i => `- "${i.title}": ${i.description || 'No description'}`).join('\n')}

Analyze whether any current tasks:
1. Fall outside the original scope (work on areas marked as "out of scope")
2. Violate boundary conditions (e.g., "do not affect other rooms")
3. Represent discovered work that expands the project
4. Are truly necessary vs. scope creep

For each expansion found, recommend:
- "expand" = Accept the expansion, update scope
- "constrain" = Add boundary constraint to limit impact
- "split" = Move to separate project
- "remove" = Remove from plan (not necessary)

Respond with JSON:
{
  "hasExpanded": true/false,
  "expansions": [
    {
      "issueTitle": "Task title",
      "issueId": "task-id",
      "reason": "Why this is scope expansion",
      "severity": "high|medium|low",
      "suggestedAction": "expand|constrain|split|remove"
    }
  ],
  "recommendation": "Overall recommendation for the user"
}`;

	const result = await chatCompletion({
		messages: [{ role: 'user', content: prompt }],
		maxTokens: 2000,
		model,
		apiKey
	});

	if (result.error || !result.content) {
		throw new Error(result.error || 'No response from AI');
	}

	const jsonMatch = result.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse AI response');
	}

	return JSON.parse(jsonMatch[0]);
}

async function validateAccuracy(
	req: ValidateAccuracyRequest,
	model?: string,
	apiKey?: string
): Promise<AccuracyValidation> {
	const prompt = `You are a plan accuracy validator checking that a project plan is complete and well-specified.

GOAL:
Title: "${req.goal.title}"
Description: "${req.goal.description || 'No description'}"
${req.goal.successCriteria?.length ? `Success Criteria:\n${req.goal.successCriteria.map(c => `- ${c}`).join('\n')}` : ''}

ALL TASKS IN PLAN:
${req.allIssues.map(i => {
	const hasChildren = req.allIssues.some(c => c.parentId === i.id);
	return `- [${i.id}] "${i.title}" (${hasChildren ? 'CONTAINER' : 'LEAF'}) - ${i.description || 'No description'}`;
}).join('\n')}

Check for these accuracy issues:

1. UNDERSPECIFIED LEAVES - Leaf tasks (no children) that don't have clear success criteria
   - What does "done" look like?
   - Is it actionable?

2. MISSING DECOMPOSITION - Containers that need more breakdown
   - Is the task too vague to execute as-is?
   - Are children sufficient to complete the parent?

3. INSUFFICIENT CHILDREN - Containers whose children don't fully cover the parent's scope
   - Are there gaps in the breakdown?
   - Would completing all children guarantee the parent is done?

4. ORPHANED DEPENDENCIES - Tasks that depend on things that don't exist

For each issue found, suggest how to fix it.

Respond with JSON:
{
  "isAccurate": true/false,
  "issues": [
    {
      "type": "underspecified|missing_decomposition|insufficient_children|orphaned_dependency",
      "issueId": "task-id",
      "issueTitle": "Task title",
      "problem": "Description of the problem",
      "suggestion": "How to fix it"
    }
  ],
  "overallAssessment": "Summary of plan quality and what to do next"
}`;

	const result = await chatCompletion({
		messages: [{ role: 'user', content: prompt }],
		maxTokens: 2000,
		model,
		apiKey
	});

	if (result.error || !result.content) {
		throw new Error(result.error || 'No response from AI');
	}

	const jsonMatch = result.content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse AI response');
	}

	return JSON.parse(jsonMatch[0]);
}
