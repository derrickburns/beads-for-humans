import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';
import type { DomainSchema, ExtractedFact, FactValue, FactSource } from '$lib/types/facts';
import { getBuiltInSchema } from '$lib/schemas';

interface ExtractionRequest {
	// Source content
	content: string;
	contentType: 'dialog' | 'document' | 'url';

	// Source metadata
	sourceMetadata?: {
		documentId?: string;
		documentName?: string;
		dialogMessageId?: string;
		dialogTimestamp?: string;
		url?: string;
	};

	// Schema context
	domain?: string;
	schema?: DomainSchema;

	// Project context
	projectId: string;
	existingFacts?: Array<{ entity: string; attribute: string; value: unknown }>;

	model?: string;
	apiKey?: string;
}

interface ExtractedFactData {
	entity: string;
	attribute: string;
	value: unknown;
	valueType: FactValue['type'];
	currency?: string;
	confidence: number;
	extractedPhrase?: string;
	effectiveDate?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const {
		content,
		contentType,
		sourceMetadata,
		domain,
		schema: providedSchema,
		projectId,
		existingFacts,
		model,
		apiKey
	} = (await request.json()) as ExtractionRequest;

	if (!content) {
		return json({ error: 'Content is required for extraction' });
	}

	// Get schema for the domain
	const schema = providedSchema || (domain ? getBuiltInSchema(domain as any) : null);

	// Build the schema context for the AI
	let schemaContext = '';
	if (schema) {
		schemaContext = `
DOMAIN SCHEMA: ${schema.name}

ENTITIES TO EXTRACT:
${schema.entities.map(e => `
${e.name} (${e.displayName}):
${e.attributes.map(a => `  - ${a.name} (${a.displayName}): ${a.type}${a.required ? ' [REQUIRED]' : ''} - ${a.description}
    Extraction hints: ${a.extractionHints.join(', ')}`).join('\n')}`).join('\n')}

REQUIRED FACTS (prioritize extracting these):
${schema.requiredFacts.join('\n')}
`;
	}

	// Build context about existing facts
	let existingContext = '';
	if (existingFacts && existingFacts.length > 0) {
		existingContext = `
ALREADY KNOWN FACTS (do not re-extract, but use for context):
${existingFacts.map(f => `- ${f.entity}.${f.attribute} = ${JSON.stringify(f.value)}`).join('\n')}
`;
	}

	const prompt = `You are an expert data extraction AI. Your job is to extract structured facts from the provided content.

${schemaContext}

${existingContext}

CONTENT TYPE: ${contentType}

CONTENT TO ANALYZE:
---
${content}
---

INSTRUCTIONS:
1. Extract all facts that match the schema entities and attributes
2. For each fact, provide:
   - entity: The entity type (e.g., "SocialSecurity", "RetirementAccount")
   - attribute: The attribute name (e.g., "monthlyBenefit", "currentBalance")
   - value: The extracted value (numbers as numbers, dates as ISO strings)
   - valueType: The data type ("string", "number", "boolean", "date", "currency", "percentage", "contact")
   - currency: For currency values, the currency code (default "USD")
   - confidence: Your confidence in the extraction (0-1)
   - extractedPhrase: The exact text you extracted this from
   - effectiveDate: If the value is date-specific (e.g., "balance as of"), include that date

3. Be conservative - only extract facts you're confident about
4. For currency values, extract the number only (e.g., 2850, not "$2,850")
5. For percentages, extract as decimal (e.g., 0.07 for 7%)
6. For contact information, structure as an object with name, phone, email, address fields
7. If you see hints about facts but can't extract exact values, note them as low-confidence

Respond with ONLY valid JSON:
{
  "facts": [
    {
      "entity": "SocialSecurity",
      "attribute": "estimatedMonthlyAtFRA",
      "value": 2850,
      "valueType": "currency",
      "currency": "USD",
      "confidence": 0.95,
      "extractedPhrase": "estimated monthly benefit at full retirement age: $2,850"
    }
  ],
  "notes": "Any observations about incomplete or unclear information",
  "suggestedQuestions": ["Questions to ask to get missing required facts"]
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 2500,
			model,
			apiKey,
			extendedThinking: true,
			thinkingBudget: 5000
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to extract facts' });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' });
		}

		const parsed = JSON.parse(jsonMatch[0]);
		const extractedFacts: ExtractedFactData[] = parsed.facts || [];

		// Build source metadata
		const source: FactSource = {
			type: contentType === 'dialog' ? 'dialog' :
				contentType === 'url' ? 'external_query' : 'document',
			confidence: 0, // Will be set per-fact
			aiModel: model || 'default'
		};

		if (contentType === 'dialog' && sourceMetadata) {
			source.dialogMessageId = sourceMetadata.dialogMessageId;
			source.dialogTimestamp = sourceMetadata.dialogTimestamp;
		} else if (contentType === 'document' && sourceMetadata) {
			source.documentId = sourceMetadata.documentId;
			source.documentName = sourceMetadata.documentName;
		} else if (contentType === 'url' && sourceMetadata) {
			source.externalUrl = sourceMetadata.url;
			source.queryTimestamp = new Date().toISOString();
		}

		// Format facts for storage
		const formattedFacts = extractedFacts.map((f, index) => {
			const value: FactValue = {
				type: f.valueType,
				raw: f.value as string | number | boolean
			};

			if (f.valueType === 'currency' && f.currency) {
				value.currency = f.currency;
			}

			if (f.valueType === 'percentage' && typeof f.value === 'number') {
				value.asDecimal = f.value;
			}

			return {
				id: `fact-${Date.now()}-${index}`,
				entity: f.entity,
				attribute: f.attribute,
				value,
				source: {
					...source,
					confidence: f.confidence,
					extractedPhrase: f.extractedPhrase
				},
				validationStatus: 'unverified' as const,
				domainId: schema?.id || 'custom',
				schemaVersion: schema?.version || '1.0.0',
				effectiveDate: f.effectiveDate,
				projectId,
				extractedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
		});

		return json({
			facts: formattedFacts,
			notes: parsed.notes,
			suggestedQuestions: parsed.suggestedQuestions || [],
			factCount: formattedFacts.length,
			extractedAt: new Date().toISOString()
		});

	} catch (error) {
		console.error('Error extracting facts:', error);
		return json({ error: 'Failed to extract facts' });
	}
};
