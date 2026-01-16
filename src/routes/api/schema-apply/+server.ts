import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { builtInSchemas, extendSchema, migrateFactsToNewSchema } from '$lib/schemas';
import type { DomainSchema, DomainType, EntityDefinition, AttributeDefinition } from '$lib/types/facts';
import type { SchemaMigration } from '$lib/schemas';

interface ApplySchemaRequest {
	// The domain to extend
	domain: DomainType;

	// Current schema (optional - uses built-in if not provided)
	currentSchema?: DomainSchema;

	// Extensions to apply
	extensions: {
		additionalEntities?: EntityDefinition[];
		additionalAttributes?: Array<{
			entityName: string;
			attributes: AttributeDefinition[];
		}>;
		additionalRequiredFacts?: string[];
	};

	// Existing facts to migrate (optional)
	factsToMigrate?: Array<{
		entity: string;
		attribute: string;
		value: unknown;
	}>;

	// New version number for the extended schema
	newVersion?: string;
}

/**
 * POST /api/schema-apply
 * Applies schema extensions and optionally migrates existing facts
 *
 * This is the action endpoint that takes suggestions from /api/schema-suggestions
 * and applies them to create an extended schema.
 */
export const POST: RequestHandler = async ({ request }) => {
	const {
		domain,
		currentSchema,
		extensions,
		factsToMigrate,
		newVersion
	} = (await request.json()) as ApplySchemaRequest;

	if (!domain) {
		return json({ error: 'domain is required' }, { status: 400 });
	}

	if (!extensions) {
		return json({ error: 'extensions are required' }, { status: 400 });
	}

	// Get base schema
	const baseSchema = currentSchema || builtInSchemas[domain];
	if (!baseSchema) {
		return json({
			error: `No schema available for domain: ${domain}`,
			hint: 'Create a base schema first before extending'
		}, { status: 404 });
	}

	try {
		// Apply extensions to create new schema
		const extendedSchema = extendSchema(baseSchema, extensions);

		// Override version if provided
		if (newVersion) {
			extendedSchema.version = newVersion;
		}

		// Build migration record
		const migration: SchemaMigration = {
			fromVersion: baseSchema.version,
			toVersion: extendedSchema.version,
			description: `Extended schema with ${
				(extensions.additionalEntities?.length || 0)
			} entities and ${
				extensions.additionalAttributes?.reduce((sum, a) => sum + a.attributes.length, 0) || 0
			} attributes`,
			addedEntities: extensions.additionalEntities,
			addedAttributes: extensions.additionalAttributes?.flatMap(a =>
				a.attributes.map(attr => ({
					entity: a.entityName,
					attribute: attr
				}))
			)
		};

		// Migrate facts if provided
		let migratedFacts: Array<{
			entity: string;
			attribute: string;
			value: unknown;
			migrated: boolean;
		}> = [];

		if (factsToMigrate && factsToMigrate.length > 0) {
			migratedFacts = migrateFactsToNewSchema(factsToMigrate, [migration]);
		}

		return json({
			success: true,
			domain,
			previousVersion: baseSchema.version,
			newVersion: extendedSchema.version,
			schema: extendedSchema,
			migration,
			migratedFacts: migratedFacts.length > 0 ? {
				total: migratedFacts.length,
				modified: migratedFacts.filter(f => f.migrated).length,
				facts: migratedFacts
			} : null,
			timestamp: new Date().toISOString()
		});

	} catch (error) {
		console.error('Error applying schema extensions:', error);
		return json({
			error: 'Failed to apply schema extensions',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

/**
 * GET /api/schema-apply
 * Returns information about the apply endpoint
 */
export const GET: RequestHandler = async () => {
	return json({
		description: 'Apply schema extensions to create an evolved schema',
		usage: {
			method: 'POST',
			body: {
				domain: 'Domain type to extend (required)',
				currentSchema: 'Current schema object (optional - uses built-in if not provided)',
				extensions: {
					additionalEntities: 'Array of new EntityDefinition objects',
					additionalAttributes: 'Array of { entityName, attributes[] } to add to existing entities',
					additionalRequiredFacts: 'Array of new required fact patterns'
				},
				factsToMigrate: 'Optional array of existing facts to migrate to new schema',
				newVersion: 'Optional new version string (auto-generated if not provided)'
			}
		},
		workflow: [
			'1. Observe facts that do not fit current schema',
			'2. POST to /api/schema-suggestions to get AI-suggested extensions',
			'3. Review suggestions and select which to apply',
			'4. POST to /api/schema-apply with selected extensions',
			'5. Store extended schema for project-specific use'
		],
		example: {
			domain: 'insurance_review',
			extensions: {
				additionalEntities: [{
					name: 'pet_insurance',
					displayName: 'Pet Insurance',
					description: 'Insurance coverage for pets',
					category: 'insurance_policies',
					attributes: [
						{
							name: 'pet_name',
							displayName: 'Pet Name',
							description: 'Name of the insured pet',
							type: 'string',
							required: true,
							extractionHints: ['pet', 'pet name', 'animal name']
						}
					]
				}]
			},
			newVersion: '1.1.0'
		}
	});
};
