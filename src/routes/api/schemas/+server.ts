import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	builtInSchemas,
	domainMetadata,
	getAvailableSchemas,
	hasBuiltInSchema,
	extendSchema,
	validateFactsAgainstSchema,
	checkForSchemaUpgrade,
	getMigrationPath
} from '$lib/schemas';
import type { DomainSchema, DomainType, EntityDefinition, AttributeDefinition } from '$lib/types/facts';

/**
 * GET /api/schemas
 * Returns list of all available schemas with metadata
 *
 * Query params:
 * - available_only: If 'true', only return domains with implemented schemas
 */
export const GET: RequestHandler = async ({ url }) => {
	const availableOnly = url.searchParams.get('available_only') === 'true';

	// Get all domain types and their metadata
	const domains = Object.keys(domainMetadata) as DomainType[];

	const schemaList = domains
		.filter(domain => !availableOnly || hasBuiltInSchema(domain))
		.map(domain => {
			const schema = builtInSchemas[domain];
			const meta = domainMetadata[domain];

			return {
				domain,
				name: meta.name,
				description: meta.description,
				icon: meta.icon,
				hasSchema: schema !== null,
				version: schema?.version || null,
				entityCount: schema?.entities.length || 0,
				requiredFactCount: schema?.requiredFacts.length || 0,
				// Summary of entities (without full details)
				entities: schema?.entities.map(e => ({
					name: e.name,
					displayName: e.displayName,
					attributeCount: e.attributes.length
				})) || []
			};
		});

	return json({
		schemas: schemaList,
		totalDomains: domains.length,
		implementedCount: getAvailableSchemas().length,
		timestamp: new Date().toISOString()
	});
};

/**
 * POST /api/schemas
 * Operations on schemas: validate, extend, check upgrades
 *
 * Body:
 * - action: 'validate' | 'extend' | 'check_upgrade' | 'get_migrations'
 * - domain: DomainType
 * - facts?: Array of facts to validate
 * - extensions?: Extensions to add to schema
 * - fromVersion?: Version to migrate from
 * - toVersion?: Version to migrate to
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { action, domain, facts, extensions, fromVersion, toVersion, versionHistory } = body;

	switch (action) {
		case 'validate': {
			if (!domain || !facts) {
				return json({ error: 'Domain and facts are required for validation' }, { status: 400 });
			}
			const schema = builtInSchemas[domain as DomainType];
			if (!schema) {
				return json({ error: `No schema available for domain: ${domain}` }, { status: 404 });
			}
			const validation = validateFactsAgainstSchema(facts, schema);
			return json({
				action: 'validate',
				domain,
				...validation
			});
		}

		case 'extend': {
			if (!domain || !extensions) {
				return json({ error: 'Domain and extensions are required' }, { status: 400 });
			}
			const baseSchema = builtInSchemas[domain as DomainType];
			if (!baseSchema) {
				return json({ error: `No base schema available for domain: ${domain}` }, { status: 404 });
			}
			const extended = extendSchema(baseSchema, extensions);
			return json({
				action: 'extend',
				domain,
				schema: extended
			});
		}

		case 'check_upgrade': {
			if (!domain || !fromVersion) {
				return json({ error: 'Domain and fromVersion are required' }, { status: 400 });
			}
			const upgradeInfo = checkForSchemaUpgrade(domain as DomainType, fromVersion);
			return json({
				action: 'check_upgrade',
				domain,
				...upgradeInfo
			});
		}

		case 'get_migrations': {
			if (!domain || !fromVersion || !toVersion || !versionHistory) {
				return json({
					error: 'Domain, fromVersion, toVersion, and versionHistory are required'
				}, { status: 400 });
			}
			const migrations = getMigrationPath(
				domain as DomainType,
				fromVersion,
				toVersion,
				versionHistory
			);
			return json({
				action: 'get_migrations',
				domain,
				fromVersion,
				toVersion,
				migrations,
				migrationCount: migrations.length
			});
		}

		default:
			return json({
				error: `Unknown action: ${action}. Valid actions: validate, extend, check_upgrade, get_migrations`
			}, { status: 400 });
	}
};
