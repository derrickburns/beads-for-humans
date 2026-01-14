import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface Message {
	role: 'user' | 'assistant';
	content: string;
}

interface TaskSuggestion {
	title: string;
	description: string;
	type: IssueType;
	priority: IssuePriority;
	dependsOn: string[]; // IDs of existing issues
	confidence: number; // 0-1, how confident AI is this is correct
}

interface RelatedIssue {
	id: string;
	title: string;
	similarity: string; // Brief explanation of why it's related
}

interface AssistantResponse {
	type: 'question' | 'suggestion' | 'complete';
	message: string;
	suggestion?: TaskSuggestion;
	relatedIssues?: RelatedIssue[];
	followUpQuestions?: string[]; // Quick response options for user
}

export const POST: RequestHandler = async ({ request }) => {
	const { messages, existingIssues, createdInSession, model } = (await request.json()) as {
		messages: Message[];
		existingIssues: Issue[];
		createdInSession: string[]; // Titles of issues created this session
		model?: string;
	};

	if (!messages || messages.length === 0) {
		return json({ error: 'No messages provided' });
	}

	const existingContext = existingIssues.length > 0
		? `\nExisting issues in project:\n${existingIssues.map(i =>
			`- "${i.title}" (ID: ${i.id}, Status: ${i.status}, Priority: P${i.priority})`
		).join('\n')}`
		: '\nNo existing issues in project yet.';

	const createdContext = createdInSession.length > 0
		? `\nIssues created in this planning session:\n${createdInSession.map(t => `- "${t}"`).join('\n')}`
		: '';

	const systemPrompt = `You are an expert project planning assistant. Your goal is to help users break down their work into clear, actionable tasks with proper dependencies.

CRITICAL RULES:
1. Suggest ONE task at a time for maximum quality and user acceptance
2. Ask clarifying questions when requirements are ambiguous
3. NEVER suggest duplicates of existing issues or issues created this session
4. Show related existing issues when relevant (but don't duplicate them)
5. Aim for 98%+ acceptance rate - only suggest tasks you're highly confident about
6. Tasks should be specific, actionable, and appropriately scoped
7. Consider dependencies carefully - what must be done first?

${existingContext}
${createdContext}

When responding, output valid JSON in this exact format:

For a clarifying question:
{
  "type": "question",
  "message": "Your question to the user",
  "followUpQuestions": ["Quick option 1", "Quick option 2", "Quick option 3"]
}

For a task suggestion (only when confident):
{
  "type": "suggestion",
  "message": "Brief context for why you're suggesting this",
  "suggestion": {
    "title": "Clear, actionable task title",
    "description": "What needs to be done and why",
    "type": "task|bug|feature",
    "priority": 0-4,
    "dependsOn": ["existing-issue-id"],
    "confidence": 0.0-1.0
  },
  "relatedIssues": [
    {"id": "existing-id", "title": "Related task", "similarity": "Why it's related"}
  ],
  "followUpQuestions": ["Accept", "Modify", "Skip this"]
}

For completion (no more tasks to suggest):
{
  "type": "complete",
  "message": "Summary of what was planned",
  "followUpQuestions": ["Add more tasks", "Review created tasks", "Done"]
}

Priority levels: 0=Critical, 1=High, 2=Medium, 3=Low, 4=Backlog
Only suggest confidence >= 0.85. If unsure, ask a clarifying question instead.`;

	const conversationMessages = [
		{ role: 'system' as const, content: systemPrompt },
		...messages.map(m => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		}))
	];

	try {
		const result = await chatCompletion({
			messages: conversationMessages,
			maxTokens: 2000,
			model
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to get response from AI' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			// If AI didn't return JSON, wrap the response
			return json({
				response: {
					type: 'question',
					message: result.content,
					followUpQuestions: []
				}
			});
		}

		const parsed = JSON.parse(jsonMatch[0]) as AssistantResponse;

		// Validate suggestion if present
		if (parsed.suggestion) {
			// Check for duplicates
			const titleLower = parsed.suggestion.title.toLowerCase();
			const isDuplicate = existingIssues.some(i =>
				i.title.toLowerCase() === titleLower ||
				levenshteinSimilarity(i.title.toLowerCase(), titleLower) > 0.85
			) || createdInSession.some(t =>
				t.toLowerCase() === titleLower ||
				levenshteinSimilarity(t.toLowerCase(), titleLower) > 0.85
			);

			if (isDuplicate) {
				// Ask AI to try again
				return json({
					response: {
						type: 'question',
						message: 'I was about to suggest something similar to an existing task. What other aspects of your project should we plan?',
						followUpQuestions: ['What else needs to be done?', 'Let me describe another area', 'I think we\'re done']
					}
				});
			}

			// Validate confidence
			if (parsed.suggestion.confidence < 0.85) {
				parsed.type = 'question';
				parsed.message = `I'm not fully certain about this task. ${parsed.message} Can you confirm or clarify?`;
				delete parsed.suggestion;
			}
		}

		return json({ response: parsed });
	} catch (error) {
		console.error('Error in plan assistant:', error);
		return json({ error: 'Failed to process request' });
	}
};

function levenshteinSimilarity(a: string, b: string): number {
	const longer = a.length > b.length ? a : b;
	const shorter = a.length > b.length ? b : a;

	if (longer.length === 0) return 1.0;

	const costs: number[] = [];
	for (let i = 0; i <= shorter.length; i++) {
		let lastValue = i;
		for (let j = 0; j <= longer.length; j++) {
			if (i === 0) {
				costs[j] = j;
			} else if (j > 0) {
				let newValue = costs[j - 1];
				if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
					newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
				}
				costs[j - 1] = lastValue;
				lastValue = newValue;
			}
		}
		if (i > 0) costs[longer.length] = lastValue;
	}

	return (longer.length - costs[longer.length]) / longer.length;
}
