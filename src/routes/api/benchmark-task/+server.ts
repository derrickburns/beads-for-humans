import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ExecutionType } from '$lib/types/issue';
import { chatCompletion } from '$lib/ai/provider';

interface BenchmarkResult {
	currentType: ExecutionType;
	suggestedType: ExecutionType;
	confidence: number;
	reasoning: string;
	changed: boolean;
	benchmarkedAt: string;
	modelUsed: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const { title, description, currentExecutionType, model, apiKey } = (await request.json()) as {
		title: string;
		description?: string;
		currentExecutionType: ExecutionType;
		model?: string;
		apiKey?: string;
	};

	if (!title) {
		return json({ error: 'Task title is required' });
	}

	const modelToUse = model || 'anthropic/claude-sonnet-4';

	const prompt = `You are evaluating whether a task's execution type classification is still accurate given current AI capabilities.

CURRENT CLASSIFICATION: ${currentExecutionType}

TASK:
Title: ${title}
${description ? `Description: ${description}` : ''}

EXECUTION TYPE DEFINITIONS:
- "automated": AI can complete entirely without human involvement (research, data analysis, drafting, code generation)
- "human": Only a human can do this (physical actions, legal signatures, in-person meetings, financial account access)
- "ai_assisted": AI does the work but human should verify (important communications, code review, financial analysis)
- "human_assisted": Human does the core work, AI provides guidance (negotiations, interviews, creative decisions)

EVALUATION CRITERIA:
1. Consider what modern AI (like me) can actually do well
2. Consider safety - tasks involving money, legal, or irreversible decisions may need human oversight
3. Consider quality - would AI output be good enough, or does it need human judgment?
4. Be honest about AI limitations - don't oversell capabilities

Respond with ONLY valid JSON:
{
  "suggestedType": "automated|human|ai_assisted|human_assisted",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this classification, and whether AI capabilities have improved for this task type"
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 500,
			model: modelToUse,
			apiKey
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to benchmark task' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' });
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate execution type
		const validTypes: ExecutionType[] = ['automated', 'human', 'ai_assisted', 'human_assisted'];
		const suggestedType: ExecutionType = validTypes.includes(parsed.suggestedType)
			? parsed.suggestedType
			: currentExecutionType;

		const confidence = typeof parsed.confidence === 'number'
			? Math.max(0, Math.min(1, parsed.confidence))
			: 0.5;

		const benchmarkResult: BenchmarkResult = {
			currentType: currentExecutionType,
			suggestedType,
			confidence,
			reasoning: parsed.reasoning || 'Classification evaluated against current AI capabilities',
			changed: suggestedType !== currentExecutionType,
			benchmarkedAt: new Date().toISOString(),
			modelUsed: modelToUse
		};

		return json({ result: benchmarkResult });
	} catch (error) {
		console.error('Error benchmarking task:', error);
		return json({ error: 'Failed to benchmark task' });
	}
};
