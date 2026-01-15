import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';

interface ExpertQuestion {
	question: string;
	whyAsk: string;
	redFlags: string[]; // Answers that should concern you
}

export const POST: RequestHandler = async ({ request }) => {
	const { taskTitle, taskDescription, expertType, context, model, apiKey } = (await request.json()) as {
		taskTitle: string;
		taskDescription?: string;
		expertType?: string;
		context?: string;
		model?: string;
		apiKey?: string;
	};

	if (!taskTitle) {
		return json({ error: 'Task title is required' });
	}

	const prompt = `You are helping someone prepare for a consultation with a ${expertType || 'professional expert'}. They need to validate an important task before proceeding.

TASK: ${taskTitle}
${taskDescription ? `DESCRIPTION: ${taskDescription}` : ''}
${expertType ? `EXPERT TYPE: ${expertType}` : ''}
${context ? `CONTEXT: ${context}` : ''}

Generate 5-7 important questions they should ask the expert. For each question:
1. Make it specific and actionable (not vague)
2. Explain WHY this question matters
3. List "red flags" - answers that should concern them or prompt more investigation

Consider:
- What information do they need to make a safe decision?
- What mistakes do people commonly make in this situation?
- What would an experienced person know to ask?
- What are the safety/legal/financial implications?

Respond with ONLY valid JSON:
{
  "questions": [
    {
      "question": "The specific question to ask",
      "whyAsk": "Why this question matters",
      "redFlags": ["Concerning answer 1", "Concerning answer 2"]
    }
  ],
  "expertType": "Suggested expert type (e.g., 'Real Estate Attorney', 'Structural Engineer')",
  "beforeYouGo": "What to prepare/bring to the consultation",
  "afterConsult": "What to do with the information you receive"
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 2000,
			model,
			apiKey
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to generate questions' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' });
		}

		const parsed = JSON.parse(jsonMatch[0]);

		const questions: ExpertQuestion[] = (parsed.questions || []).map((q: ExpertQuestion) => ({
			question: q.question || '',
			whyAsk: q.whyAsk || '',
			redFlags: Array.isArray(q.redFlags) ? q.redFlags : []
		}));

		return json({
			questions,
			expertType: parsed.expertType || expertType || 'Professional Expert',
			beforeYouGo: parsed.beforeYouGo || 'Bring all relevant documents and notes',
			afterConsult: parsed.afterConsult || 'Document the expert\'s recommendations and next steps'
		});
	} catch (error) {
		console.error('Error generating expert questions:', error);
		return json({ error: 'Failed to generate questions' });
	}
};
