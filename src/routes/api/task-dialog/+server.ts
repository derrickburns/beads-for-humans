import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue, IssueType, IssuePriority } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface DialogMessage {
	role: 'user' | 'assistant';
	content: string;
}

interface SuggestedAction {
	type: 'update_task' | 'create_subtask' | 'mark_complete' | 'add_dependency' | 'add_concern' | 'ask_question';
	description: string;
	data?: {
		title?: string;
		description?: string;
		type?: IssueType;
		priority?: IssuePriority;
		status?: string;
		concernType?: string;
		question?: string;
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const { task, message, history, existingIssues, model, apiKey } = (await request.json()) as {
		task: Issue;
		message: string;
		history: DialogMessage[];
		existingIssues: Issue[];
		model?: string;
		apiKey?: string;
	};

	const systemPrompt = `You are a planning assistant helping a user work through a task. Your role is to:
1. Listen to what the user shares about their situation
2. Ask clarifying questions when needed
3. Suggest concrete actions based on what they tell you
4. Help break down work or mark things as complete

Current Task:
- Title: "${task.title}"
- Description: ${task.description || 'No description'}
- Type: ${task.type}
- Priority: P${task.priority}
- Status: ${task.status}

Related Issues in Project:
${existingIssues.slice(0, 10).map(i => `- "${i.title}" (${i.type}, ${i.status})`).join('\n')}

Guidelines:
- Be conversational and helpful
- When the user shares information, acknowledge it and suggest what to do next
- If they've essentially completed part of the task, suggest marking it or creating subtasks for remaining work
- If they reveal complexity, suggest breaking down the task
- If they mention risks or assumptions, note those as concerns
- Keep responses concise (2-4 sentences max for conversation, plus any suggested actions)

IMPORTANT: After each response, if there are actionable suggestions, output them in this JSON format at the END of your response:

\`\`\`json
{
  "actions": [
    {
      "type": "update_task" | "create_subtask" | "mark_complete" | "add_dependency" | "add_concern" | "ask_question",
      "description": "Human-readable description of the action",
      "data": { ... relevant data ... }
    }
  ]
}
\`\`\`

Action types:
- update_task: Update the current task's title/description
- create_subtask: Create a child task
- mark_complete: Mark the current task as done
- add_dependency: Add a dependency on another task
- add_concern: Surface a risk/assumption
- ask_question: A clarifying question to ask the user

If no actions are needed (just conversation), omit the JSON block.`;

	const messages = [
		{ role: 'system' as const, content: systemPrompt },
		...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
		{ role: 'user' as const, content: message }
	];

	try {
		const result = await chatCompletion({
			messages,
			maxTokens: 1000,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			return json({ error: result.error || 'No response from AI' });
		}

		// Parse the response to extract actions
		const content = result.content;
		let responseText = content;
		let actions: SuggestedAction[] = [];

		// Look for JSON block at the end
		const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```\s*$/);
		if (jsonMatch) {
			try {
				const parsed = JSON.parse(jsonMatch[1]);
				actions = parsed.actions || [];
				// Remove the JSON block from the response text
				responseText = content.replace(/```json\s*[\s\S]*?\s*```\s*$/, '').trim();
			} catch {
				// JSON parse failed, keep the full response
			}
		}

		return json({
			response: responseText,
			actions
		});
	} catch (error) {
		console.error('Error in task dialog:', error);
		return json({ error: 'Failed to process message' });
	}
};
