import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { builtInSchemas, domainMetadata, hasBuiltInSchema } from '$lib/schemas';
import type { DomainType } from '$lib/types/facts';

/**
 * GET /api/schemas/[domain]
 * Returns the complete schema for a specific domain
 *
 * Params:
 * - domain: The domain type (e.g., 'retirement_planning', 'insurance_review')
 *
 * Query params:
 * - format: 'full' (default) | 'entities_only' | 'required_only' | 'export_templates'
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { domain } = params;
	const format = url.searchParams.get('format') || 'full';

	// Validate domain
	if (!domain || !(domain in domainMetadata)) {
		const validDomains = Object.keys(domainMetadata);
		return json({
			error: `Invalid domain: ${domain}`,
			validDomains
		}, { status: 400 });
	}

	const domainType = domain as DomainType;
	const meta = domainMetadata[domainType];
	const schema = builtInSchemas[domainType];

	// Check if schema is implemented
	if (!schema) {
		return json({
			domain: domainType,
			name: meta.name,
			description: meta.description,
			icon: meta.icon,
			hasSchema: false,
			message: `Schema for ${meta.name} is not yet implemented`,
			availableSchemas: Object.entries(builtInSchemas)
				.filter(([_, s]) => s !== null)
				.map(([d]) => d)
		}, { status: 404 });
	}

	// Return different formats based on query param
	switch (format) {
		case 'entities_only':
			return json({
				domain: domainType,
				name: meta.name,
				version: schema.version,
				entities: schema.entities
			});

		case 'required_only':
			return json({
				domain: domainType,
				name: meta.name,
				version: schema.version,
				requiredFacts: schema.requiredFacts,
				requiredEntities: schema.entities.filter(e =>
					e.attributes.some(a => a.required)
				).map(e => ({
					name: e.name,
					displayName: e.displayName,
					requiredAttributes: e.attributes
						.filter(a => a.required)
						.map(a => ({
							name: a.name,
							displayName: a.displayName,
							type: a.type
						}))
				}))
			});

		case 'export_templates':
			return json({
				domain: domainType,
				name: meta.name,
				version: schema.version,
				exportTemplates: schema.exportTemplates
			});

		case 'full':
		default:
			return json({
				domain: domainType,
				metadata: meta,
				schema,
				timestamp: new Date().toISOString()
			});
	}
};
