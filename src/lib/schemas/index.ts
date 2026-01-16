// Domain Schema Library
// Pre-built schemas for common planning domains

import type { DomainSchema, DomainType } from '$lib/types/facts';
import { retirementPlanningSchema } from './retirement';

// ============================================
// SCHEMA REGISTRY
// ============================================

/**
 * All built-in domain schemas
 */
export const builtInSchemas: Record<DomainType, DomainSchema | null> = {
	retirement_planning: retirementPlanningSchema,
	estate_planning: null,      // TODO: Implement
	home_renovation: null,      // TODO: Implement
	insurance_review: null,     // TODO: Implement
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

// Re-export individual schemas for direct import
export { retirementPlanningSchema };
