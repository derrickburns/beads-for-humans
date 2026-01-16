import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion } from '$lib/ai/provider';
import { builtInSchemas, domainMetadata } from '$lib/schemas';
import type { DomainSchema, DomainType, EntityDefinition, AttributeDefinition } from '$lib/types/facts';

interface SchemaSuggestionRequest {
	// Context about observed facts that don't fit current schema
	observedFacts: Array<{
		entity: string;
		attribute: string;
		value: unknown;
		context?: string;  // Where this came from
	}>;

	// Current domain
	domain: DomainType;

	// Existing schema (optional, will use built-in if not provided)
	currentSchema?: DomainSchema;

	// AI configuration
	model?: string;
	apiKey?: string;
}

interface SchemaSuggestion {
	type: 'add_entity' | 'add_attribute' | 'modify_attribute' | 'add_relationship';
	confidence: number;
	reason: string;

	// For add_entity
	entity?: EntityDefinition;

	// For add_attribute
	targetEntity?: string;
	attribute?: AttributeDefinition;

	// For add_relationship
	relationship?: {
		from: string;
		to: string;
		type: 'one-to-one' | 'one-to-many' | 'many-to-many';
		description: string;
	};
}

/**
 * POST /api/schema-suggestions
 * AI analyzes facts that don't fit the current schema and suggests extensions
 *
 * This enables schema evolution: when the AI encounters facts that don't match
 * the schema, it can propose how to extend the schema to accommodate them.
 */
export const POST: RequestHandler = async ({ request }) => {
	const {
		observedFacts,
		domain,
		currentSchema,
		model,
		apiKey
	} = (await request.json()) as SchemaSuggestionRequest;

	if (!observedFacts || observedFacts.length === 0) {
		return json({ error: 'observedFacts are required' }, { status: 400 });
	}

	if (!domain) {
		return json({ error: 'domain is required' }, { status: 400 });
	}

	// Get current schema
	const schema = currentSchema || builtInSchemas[domain];
	const meta = domainMetadata[domain];

	if (!schema) {
		return json({
			error: `No schema available for domain: ${domain}`,
			suggestion: 'Consider creating a new schema for this domain'
		}, { status: 404 });
	}

	// Build schema context for AI
	const schemaContext = `
CURRENT SCHEMA: ${schema.name} (v${schema.version})
DOMAIN: ${meta.name} - ${meta.description}

EXISTING ENTITIES:
${schema.entities.map(e => `
${e.name} (${e.displayName}):
${e.attributes.map(a => `  - ${a.name}: ${a.type}${a.required ? ' [required]' : ''}`).join('\n')}`).join('\n')}

EXISTING RELATIONSHIPS:
${schema.relationships.map(r => `- ${r.fromEntity} → ${r.toEntity}: ${r.cardinality}`).join('\n')}
`;

	const observedFactsContext = `
OBSERVED FACTS THAT DON'T FIT CURRENT SCHEMA:
${observedFacts.map(f => `
- Entity: ${f.entity}
  Attribute: ${f.attribute}
  Value: ${JSON.stringify(f.value)}
  Context: ${f.context || 'N/A'}`).join('\n')}
`;

	const prompt = `You are a schema evolution expert. Analyze facts that don't fit the current schema and suggest how to extend it.

${schemaContext}

${observedFactsContext}

INSTRUCTIONS:
1. For each observed fact, determine if it:
   - Belongs to an existing entity with a new attribute
   - Belongs to a new entity type
   - Indicates a missing relationship

2. Propose schema extensions that:
   - Are consistent with the domain's purpose
   - Follow existing naming conventions
   - Include appropriate data types and validation
   - Don't duplicate existing functionality

3. For new entities, provide complete definitions including:
   - name (snake_case)
   - displayName (human readable)
   - description
   - attributes with types, extractionHints

4. For new attributes, provide:
   - name, displayName, description
   - type (string, number, boolean, date, currency, percentage, contact, document_ref)
   - required (true/false)
   - extractionHints (phrases that indicate this attribute)

Respond with ONLY valid JSON:
{
  "suggestions": [
    {
      "type": "add_entity" | "add_attribute" | "modify_attribute" | "add_relationship",
      "confidence": 0.0-1.0,
      "reason": "Explanation of why this extension is needed",
      "entity": { ... } // For add_entity
      "targetEntity": "EntityName", // For add_attribute
      "attribute": { ... } // For add_attribute
      "relationship": { ... } // For add_relationship
    }
  ],
  "summary": "Overall summary of suggested changes",
  "impact": "Low" | "Medium" | "High" // Impact on existing data
}`;

	try {
		const result = await chatCompletion({
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 3000,
			model,
			apiKey,
			extendedThinking: true,
			thinkingBudget: 8000
		});

		if (result.error || !result.content) {
			console.error('AI API error:', result.error);
			return json({ error: 'Failed to analyze schema suggestions' }, { status: 500 });
		}

		// Parse JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to parse AI response' }, { status: 500 });
		}

		const parsed = JSON.parse(jsonMatch[0]);

		return json({
			domain,
			currentSchemaVersion: schema.version,
			observedFactCount: observedFacts.length,
			suggestions: parsed.suggestions || [],
			summary: parsed.summary,
			impact: parsed.impact,
			timestamp: new Date().toISOString(),
			// Include content as reasoning for transparency
			reasoning: result.content
		});

	} catch (error) {
		console.error('Error generating schema suggestions:', error);
		return json({ error: 'Failed to generate schema suggestions' }, { status: 500 });
	}
};

/**
 * GET /api/schema-suggestions
 * Returns guidance on schema evolution capabilities
 */
export const GET: RequestHandler = async () => {
	return json({
		description: 'Schema evolution endpoint - AI suggests schema extensions based on observed facts',
		usage: {
			method: 'POST',
			body: {
				observedFacts: 'Array of facts that do not fit current schema',
				domain: 'Domain type to evolve',
				currentSchema: 'Optional - current schema (uses built-in if not provided)',
				model: 'Optional - AI model to use',
				apiKey: 'Optional - API key'
			}
		},
		suggestionTypes: [
			'add_entity - Propose a new entity type',
			'add_attribute - Propose a new attribute on existing entity',
			'modify_attribute - Propose changes to existing attribute',
			'add_relationship - Propose a new relationship between entities'
		],
		example: {
			observedFacts: [
				{
					entity: 'UnknownEntity',
					attribute: 'someField',
					value: 'example value',
					context: 'User mentioned this in dialog about insurance'
				}
			],
			domain: 'insurance_review'
		}
	});
};
