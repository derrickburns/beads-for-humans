// Domain Schema Library
// Pre-built schemas for common planning domains

import type { DomainSchema, DomainType, EntityDefinition, AttributeDefinition } from '$lib/types/facts';
import { retirementPlanningSchema } from './retirement';
import { estatePlanningSchema } from './estate';
import { insuranceReviewSchema } from './insurance';

// ============================================
// SCHEMA VERSIONING & MIGRATION
// ============================================

/**
 * Schema version history for migration tracking
 */
export interface SchemaVersion {
	version: string;
	releasedAt: string;
	changes: string[];
	migrationsRequired: SchemaMigration[];
}

/**
 * A migration to apply when upgrading schema versions
 */
export interface SchemaMigration {
	fromVersion: string;
	toVersion: string;
	description: string;

	// Attribute changes
	addedAttributes?: Array<{ entity: string; attribute: AttributeDefinition }>;
	removedAttributes?: Array<{ entity: string; attributeName: string }>;
	renamedAttributes?: Array<{ entity: string; oldName: string; newName: string }>;

	// Entity changes
	addedEntities?: EntityDefinition[];
	removedEntities?: string[];
	renamedEntities?: Array<{ oldName: string; newName: string }>;

	// Value transformations for existing facts
	valueTransforms?: Array<{
		entity: string;
		attribute: string;
		transform: 'string_to_number' | 'number_to_string' | 'split' | 'merge' | 'custom';
		customTransform?: string; // For complex transforms, stored as expression
	}>;
}

/**
 * Schema registry with version tracking
 */
export interface SchemaRegistry {
	schemas: Record<string, DomainSchema>;  // keyed by schema ID
	versionHistory: Record<string, SchemaVersion[]>;  // keyed by domain
	currentVersions: Record<DomainType, string>;  // domain -> current version
}

// ============================================
// SCHEMA REGISTRY
// ============================================

/**
 * All built-in domain schemas
 */
export const builtInSchemas: Record<DomainType, DomainSchema | null> = {
	retirement_planning: retirementPlanningSchema,
	estate_planning: estatePlanningSchema,
	home_renovation: null,      // TODO: Implement
	insurance_review: insuranceReviewSchema,
	tax_planning: null,         // TODO: Implement
	debt_management: null,      // TODO: Implement
	investment_portfolio: null, // TODO: Implement
	business_planning: null,    // TODO: Implement
	healthcare_planning: null,  // TODO: Implement
	education_planning: null,   // TODO: Implement
	custom: null                // Custom schemas are created dynamically
};

/**
 * Get a built-in schema by domain type
 */
export function getBuiltInSchema(domain: DomainType): DomainSchema | null {
	return builtInSchemas[domain] || null;
}

/**
 * Get all available built-in schemas
 */
export function getAvailableSchemas(): DomainSchema[] {
	return Object.values(builtInSchemas).filter((s): s is DomainSchema => s !== null);
}

/**
 * Check if a domain has a built-in schema
 */
export function hasBuiltInSchema(domain: DomainType): boolean {
	return builtInSchemas[domain] !== null;
}

/**
 * Domain metadata for UI display
 */
export const domainMetadata: Record<DomainType, { name: string; description: string; icon: string }> = {
	retirement_planning: {
		name: 'Retirement Planning',
		description: 'Plan for retirement including Social Security, pensions, and investments',
		icon: '🏖️'
	},
	estate_planning: {
		name: 'Estate Planning',
		description: 'Organize wills, trusts, beneficiaries, and asset transfers',
		icon: '📜'
	},
	home_renovation: {
		name: 'Home Renovation',
		description: 'Plan and track home improvement projects',
		icon: '🏠'
	},
	insurance_review: {
		name: 'Insurance Review',
		description: 'Document and optimize insurance coverage',
		icon: '🛡️'
	},
	tax_planning: {
		name: 'Tax Planning',
		description: 'Optimize tax strategy and track deductions',
		icon: '📊'
	},
	debt_management: {
		name: 'Debt Management',
		description: 'Track and plan debt payoff strategies',
		icon: '💳'
	},
	investment_portfolio: {
		name: 'Investment Portfolio',
		description: 'Track and optimize investment allocations',
		icon: '📈'
	},
	business_planning: {
		name: 'Business Planning',
		description: 'Plan business strategy and track metrics',
		icon: '💼'
	},
	healthcare_planning: {
		name: 'Healthcare Planning',
		description: 'Plan for healthcare costs and coverage',
		icon: '🏥'
	},
	education_planning: {
		name: 'Education Planning',
		description: 'Plan and save for education expenses',
		icon: '🎓'
	},
	custom: {
		name: 'Custom Domain',
		description: 'Create a custom schema for your specific needs',
		icon: '⚙️'
	}
};

// ============================================
// SCHEMA MIGRATION UTILITIES
// ============================================

/**
 * Get the migration path between two schema versions
 */
export function getMigrationPath(
	domain: DomainType,
	fromVersion: string,
	toVersion: string,
	versionHistory: SchemaVersion[]
): SchemaMigration[] {
	const migrations: SchemaMigration[] = [];
	let currentVersion = fromVersion;

	// Find all versions between from and to
	const versionsInRange = versionHistory.filter(v => {
		const vNum = parseVersion(v.version);
		const fromNum = parseVersion(fromVersion);
		const toNum = parseVersion(toVersion);
		return vNum > fromNum && vNum <= toNum;
	}).sort((a, b) => parseVersion(a.version) - parseVersion(b.version));

	for (const version of versionsInRange) {
		migrations.push(...version.migrationsRequired);
	}

	return migrations;
}

/**
 * Parse semantic version to comparable number
 */
function parseVersion(version: string): number {
	const parts = version.split('.').map(Number);
	return parts[0] * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
}

/**
 * Apply migrations to existing facts
 */
export function migrateFactsToNewSchema(
	facts: Array<{ entity: string; attribute: string; value: unknown }>,
	migrations: SchemaMigration[]
): Array<{ entity: string; attribute: string; value: unknown; migrated: boolean }> {
	let migratedFacts = facts.map(f => ({ ...f, migrated: false }));

	for (const migration of migrations) {
		// Handle entity renames
		if (migration.renamedEntities) {
			for (const rename of migration.renamedEntities) {
				migratedFacts = migratedFacts.map(f => {
					if (f.entity === rename.oldName) {
						return { ...f, entity: rename.newName, migrated: true };
					}
					return f;
				});
			}
		}

		// Handle attribute renames
		if (migration.renamedAttributes) {
			for (const rename of migration.renamedAttributes) {
				migratedFacts = migratedFacts.map(f => {
					if (f.entity === rename.entity && f.attribute === rename.oldName) {
						return { ...f, attribute: rename.newName, migrated: true };
					}
					return f;
				});
			}
		}

		// Handle value transforms
		if (migration.valueTransforms) {
			for (const transform of migration.valueTransforms) {
				migratedFacts = migratedFacts.map(f => {
					if (f.entity === transform.entity && f.attribute === transform.attribute) {
						let newValue = f.value;
						switch (transform.transform) {
							case 'string_to_number':
								newValue = typeof f.value === 'string' ? parseFloat(f.value) : f.value;
								break;
							case 'number_to_string':
								newValue = typeof f.value === 'number' ? String(f.value) : f.value;
								break;
							// Other transforms would be handled here
						}
						return { ...f, value: newValue, migrated: true };
					}
					return f;
				});
			}
		}

		// Mark removed attributes
		if (migration.removedAttributes) {
			for (const removed of migration.removedAttributes) {
				migratedFacts = migratedFacts.filter(
					f => !(f.entity === removed.entity && f.attribute === removed.attributeName)
				);
			}
		}
	}

	return migratedFacts;
}

/**
 * Validate that facts match the current schema
 */
export function validateFactsAgainstSchema(
	facts: Array<{ entity: string; attribute: string; value: unknown }>,
	schema: DomainSchema
): { valid: boolean; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	const entityNames = new Set(schema.entities.map(e => e.name));
	const attributeMap = new Map<string, Set<string>>();

	for (const entity of schema.entities) {
		attributeMap.set(entity.name, new Set(entity.attributes.map(a => a.name)));
	}

	for (const fact of facts) {
		// Check entity exists
		if (!entityNames.has(fact.entity)) {
			warnings.push(`Unknown entity: ${fact.entity} (may be from older schema version)`);
			continue;
		}

		// Check attribute exists
		const validAttrs = attributeMap.get(fact.entity);
		if (validAttrs && !validAttrs.has(fact.attribute)) {
			warnings.push(`Unknown attribute: ${fact.entity}.${fact.attribute} (may be from older schema version)`);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings
	};
}

/**
 * Check if schema upgrade is available
 */
export function checkForSchemaUpgrade(
	domain: DomainType,
	currentVersion: string
): { upgradeAvailable: boolean; latestVersion: string; changes: string[] } {
	const schema = builtInSchemas[domain];
	if (!schema) {
		return { upgradeAvailable: false, latestVersion: currentVersion, changes: [] };
	}

	const latestVersion = schema.version;
	const upgradeAvailable = parseVersion(latestVersion) > parseVersion(currentVersion);

	return {
		upgradeAvailable,
		latestVersion,
		changes: upgradeAvailable ? [`Upgrade from ${currentVersion} to ${latestVersion}`] : []
	};
}

/**
 * Create a custom schema extension from a base schema
 */
export function extendSchema(
	baseSchema: DomainSchema,
	extensions: {
		additionalEntities?: EntityDefinition[];
		additionalAttributes?: Array<{ entityName: string; attributes: AttributeDefinition[] }>;
		additionalRequiredFacts?: string[];
	}
): DomainSchema {
	const extended = { ...baseSchema };
	extended.id = `${baseSchema.id}-extended`;
	extended.isBuiltIn = false;
	extended.updatedAt = new Date().toISOString();

	// Add additional entities
	if (extensions.additionalEntities) {
		extended.entities = [...extended.entities, ...extensions.additionalEntities];
	}

	// Add additional attributes to existing entities
	if (extensions.additionalAttributes) {
		extended.entities = extended.entities.map(entity => {
			const additions = extensions.additionalAttributes?.find(a => a.entityName === entity.name);
			if (additions) {
				return {
					...entity,
					attributes: [...entity.attributes, ...additions.attributes]
				};
			}
			return entity;
		});
	}

	// Add additional required facts
	if (extensions.additionalRequiredFacts) {
		extended.requiredFacts = [...extended.requiredFacts, ...extensions.additionalRequiredFacts];
	}

	return extended;
}

// Re-export individual schemas for direct import
export { retirementPlanningSchema };
export { estatePlanningSchema };
export { insuranceReviewSchema };
