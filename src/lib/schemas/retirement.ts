import type { DomainSchema, EntityDefinition, AttributeDefinition, ValidationRule } from '$lib/types/facts';

// ============================================
// RETIREMENT PLANNING DOMAIN SCHEMA
// ============================================

const personEntity: EntityDefinition = {
	name: 'Person',
	displayName: 'Person',
	description: 'The individual(s) planning for retirement',
	category: 'identity',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Full Legal Name',
			description: 'Legal name as it appears on official documents',
			type: 'string',
			required: true,
			extractionHints: ['tax return', 'Social Security card', 'drivers license']
		},
		{
			name: 'birthDate',
			displayName: 'Date of Birth',
			description: 'Date of birth for age calculations',
			type: 'date',
			required: true,
			extractionHints: ['drivers license', 'birth certificate', 'passport']
		},
		{
			name: 'ssn',
			displayName: 'Social Security Number',
			description: 'SSN for benefit lookups (stored securely)',
			type: 'string',
			required: false,
			pattern: '^\\d{3}-\\d{2}-\\d{4}$',
			extractionHints: ['Social Security card', 'tax return']
		},
		{
			name: 'retirementAge',
			displayName: 'Target Retirement Age',
			description: 'Age at which person plans to retire',
			type: 'number',
			required: true,
			min: 50,
			max: 80,
			extractionHints: ['stated preference', 'dialog']
		},
		{
			name: 'lifeExpectancy',
			displayName: 'Planning Life Expectancy',
			description: 'Age to plan finances until',
			type: 'number',
			required: false,
			min: 70,
			max: 110,
			extractionHints: ['stated preference', 'family history']
		},
		{
			name: 'healthStatus',
			displayName: 'Health Status',
			description: 'General health status for longevity estimates',
			type: 'string',
			required: false,
			allowedValues: ['excellent', 'good', 'fair', 'poor'],
			extractionHints: ['dialog']
		}
	]
};

const socialSecurityEntity: EntityDefinition = {
	name: 'SocialSecurity',
	displayName: 'Social Security Benefits',
	description: 'Social Security retirement benefits',
	category: 'income',
	allowMultiple: false,
	attributes: [
		{
			name: 'estimatedMonthlyAt62',
			displayName: 'Estimated Monthly at 62',
			description: 'Estimated monthly benefit if starting at age 62',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			verificationMethod: 'external_api',
			verificationUrl: 'https://www.ssa.gov/myaccount/',
			extractionHints: ['SSA statement', 'my Social Security account', 'SSA-1099']
		},
		{
			name: 'estimatedMonthlyAtFRA',
			displayName: 'Estimated Monthly at Full Retirement Age',
			description: 'Estimated monthly benefit at full retirement age (66-67)',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			verificationMethod: 'external_api',
			verificationUrl: 'https://www.ssa.gov/myaccount/',
			extractionHints: ['SSA statement', 'my Social Security account']
		},
		{
			name: 'estimatedMonthlyAt70',
			displayName: 'Estimated Monthly at 70',
			description: 'Estimated monthly benefit if delaying until age 70',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			verificationMethod: 'external_api',
			verificationUrl: 'https://www.ssa.gov/myaccount/',
			extractionHints: ['SSA statement', 'my Social Security account']
		},
		{
			name: 'fullRetirementAge',
			displayName: 'Full Retirement Age',
			description: 'Age at which full benefits are available',
			type: 'number',
			required: true,
			min: 65,
			max: 67,
			extractionHints: ['SSA statement', 'based on birth year']
		},
		{
			name: 'plannedStartAge',
			displayName: 'Planned Start Age',
			description: 'Age at which person plans to start benefits',
			type: 'number',
			required: true,
			min: 62,
			max: 70,
			extractionHints: ['dialog', 'stated preference']
		},
		{
			name: 'plannedStartDate',
			displayName: 'Planned Start Date',
			description: 'Specific date to begin benefits',
			type: 'date',
			required: false,
			extractionHints: ['dialog', 'calculated from start age']
		},
		{
			name: 'estimatedMonthlyAtPlannedAge',
			displayName: 'Estimated Monthly at Planned Age',
			description: 'Calculated benefit at the planned start age',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['calculated', 'SSA estimator']
		},
		{
			name: 'workCredits',
			displayName: 'Work Credits Earned',
			description: 'Number of work credits earned (40 required for benefits)',
			type: 'number',
			required: false,
			min: 0,
			max: 160,
			extractionHints: ['SSA statement']
		}
	]
};

const retirementAccountEntity: EntityDefinition = {
	name: 'RetirementAccount',
	displayName: 'Retirement Account',
	description: 'Tax-advantaged retirement account (401k, IRA, etc.)',
	category: 'asset',
	allowMultiple: true,
	identifierAttribute: 'accountName',
	attributes: [
		{
			name: 'accountName',
			displayName: 'Account Name',
			description: 'Descriptive name for this account',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'dialog']
		},
		{
			name: 'accountType',
			displayName: 'Account Type',
			description: 'Type of retirement account',
			type: 'string',
			required: true,
			allowedValues: ['401k', 'traditional_ira', 'roth_ira', 'roth_401k', '403b', '457b', 'sep_ira', 'simple_ira', 'pension', 'annuity', 'other'],
			extractionHints: ['statement header', 'account type field']
		},
		{
			name: 'institution',
			displayName: 'Financial Institution',
			description: 'Company holding the account',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'website']
		},
		{
			name: 'accountNumber',
			displayName: 'Account Number',
			description: 'Account number (last 4 digits for security)',
			type: 'string',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'currentBalance',
			displayName: 'Current Balance',
			description: 'Current account balance',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			verificationMethod: 'document',
			extractionHints: ['statement', 'account summary']
		},
		{
			name: 'balanceAsOfDate',
			displayName: 'Balance As Of Date',
			description: 'Date the balance was recorded',
			type: 'date',
			required: true,
			extractionHints: ['statement date']
		},
		{
			name: 'monthlyContribution',
			displayName: 'Monthly Contribution',
			description: 'Current monthly contribution amount',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['paycheck', 'contribution schedule']
		},
		{
			name: 'employerMatch',
			displayName: 'Employer Match',
			description: 'Employer matching contribution (if applicable)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['paycheck', 'benefits summary']
		},
		{
			name: 'vestingPercentage',
			displayName: 'Vesting Percentage',
			description: 'Percentage of employer contributions that are vested',
			type: 'percentage',
			required: false,
			extractionHints: ['benefits summary', 'HR']
		},
		{
			name: 'expectedReturnRate',
			displayName: 'Expected Annual Return',
			description: 'Expected annual return rate for projections',
			type: 'percentage',
			required: false,
			extractionHints: ['investment mix', 'dialog']
		},
		{
			name: 'beneficiary',
			displayName: 'Primary Beneficiary',
			description: 'Primary beneficiary of this account',
			type: 'string',
			required: false,
			extractionHints: ['beneficiary designation form']
		}
	]
};

const pensionEntity: EntityDefinition = {
	name: 'Pension',
	displayName: 'Pension',
	description: 'Defined benefit pension plan',
	category: 'income',
	allowMultiple: true,
	identifierAttribute: 'planName',
	attributes: [
		{
			name: 'planName',
			displayName: 'Plan Name',
			description: 'Name of the pension plan',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'benefits summary']
		},
		{
			name: 'employer',
			displayName: 'Employer',
			description: 'Employer sponsoring the pension',
			type: 'string',
			required: true,
			extractionHints: ['statement']
		},
		{
			name: 'yearsOfService',
			displayName: 'Years of Service',
			description: 'Years of service credited to pension',
			type: 'number',
			required: true,
			extractionHints: ['statement', 'HR']
		},
		{
			name: 'estimatedMonthlyBenefit',
			displayName: 'Estimated Monthly Benefit',
			description: 'Estimated monthly pension payment at retirement',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['pension statement', 'benefits projection']
		},
		{
			name: 'normalRetirementDate',
			displayName: 'Normal Retirement Date',
			description: 'Date eligible for full pension benefits',
			type: 'date',
			required: false,
			extractionHints: ['statement', 'benefits summary']
		},
		{
			name: 'survivorBenefit',
			displayName: 'Survivor Benefit Percentage',
			description: 'Percentage of benefit that continues to survivor',
			type: 'percentage',
			required: false,
			extractionHints: ['pension election', 'statement']
		},
		{
			name: 'colaProvision',
			displayName: 'Cost of Living Adjustment',
			description: 'Whether pension includes COLA',
			type: 'boolean',
			required: false,
			extractionHints: ['plan document', 'statement']
		}
	]
};

const expenseEntity: EntityDefinition = {
	name: 'RetirementExpense',
	displayName: 'Retirement Expense',
	description: 'Projected expense category in retirement',
	category: 'expense',
	allowMultiple: true,
	identifierAttribute: 'category',
	attributes: [
		{
			name: 'category',
			displayName: 'Expense Category',
			description: 'Category of expense',
			type: 'string',
			required: true,
			allowedValues: ['housing', 'healthcare', 'food', 'transportation', 'utilities', 'insurance', 'entertainment', 'travel', 'gifts', 'other'],
			extractionHints: ['dialog', 'budget']
		},
		{
			name: 'monthlyAmount',
			displayName: 'Monthly Amount',
			description: 'Estimated monthly expense',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['current budget', 'dialog']
		},
		{
			name: 'inflationRate',
			displayName: 'Expected Inflation Rate',
			description: 'Expected annual inflation for this category',
			type: 'percentage',
			required: false,
			extractionHints: ['healthcare typically 5-7%', 'general 2-3%']
		},
		{
			name: 'startAge',
			displayName: 'Start Age',
			description: 'Age when this expense begins',
			type: 'number',
			required: false,
			extractionHints: ['Medicare at 65', 'dialog']
		},
		{
			name: 'endAge',
			displayName: 'End Age',
			description: 'Age when this expense ends (if applicable)',
			type: 'number',
			required: false,
			extractionHints: ['mortgage payoff', 'dialog']
		}
	]
};

const validationRules: ValidationRule[] = [
	{
		id: 'ss-start-age-valid',
		name: 'Social Security Start Age Valid',
		description: 'Social Security cannot start before 62 or after 70',
		expression: 'SocialSecurity.plannedStartAge >= 62 AND SocialSecurity.plannedStartAge <= 70',
		severity: 'error',
		message: 'Social Security benefits can only start between ages 62 and 70'
	},
	{
		id: 'retirement-age-after-current',
		name: 'Retirement Age After Current',
		description: 'Retirement age must be in the future',
		expression: 'Person.retirementAge > currentAge(Person.birthDate)',
		severity: 'error',
		message: 'Target retirement age must be greater than current age'
	},
	{
		id: 'rmd-planning',
		name: 'RMD Planning Reminder',
		description: 'Traditional accounts require RMDs starting at 73',
		expression: 'RetirementAccount.accountType IN ("401k", "traditional_ira") AND Person.retirementAge >= 73',
		severity: 'info',
		message: 'Remember to plan for Required Minimum Distributions (RMDs) starting at age 73'
	},
	{
		id: 'healthcare-gap',
		name: 'Healthcare Coverage Gap',
		description: 'Gap between retirement and Medicare eligibility',
		expression: 'Person.retirementAge < 65',
		severity: 'warning',
		message: 'You will need healthcare coverage between retirement and Medicare eligibility at 65'
	}
];

export const retirementPlanningSchema: DomainSchema = {
	id: 'retirement-planning-v1',
	domain: 'retirement_planning',
	name: 'Retirement Planning',
	version: '1.0.0',
	description: 'Schema for retirement planning including Social Security, retirement accounts, pensions, and expense projections',

	entities: [
		personEntity,
		socialSecurityEntity,
		retirementAccountEntity,
		pensionEntity,
		expenseEntity
	],

	relationships: [
		{
			name: 'hasSocialSecurity',
			fromEntity: 'Person',
			toEntity: 'SocialSecurity',
			cardinality: 'one-to-one',
			description: 'Person has Social Security benefits'
		},
		{
			name: 'ownsAccount',
			fromEntity: 'Person',
			toEntity: 'RetirementAccount',
			cardinality: 'one-to-many',
			description: 'Person owns retirement accounts'
		},
		{
			name: 'hasPension',
			fromEntity: 'Person',
			toEntity: 'Pension',
			cardinality: 'one-to-many',
			description: 'Person has pension benefits'
		},
		{
			name: 'hasExpense',
			fromEntity: 'Person',
			toEntity: 'RetirementExpense',
			cardinality: 'one-to-many',
			description: 'Person has projected retirement expenses'
		}
	],

	validationRules,

	requiredFacts: [
		'Person.name',
		'Person.birthDate',
		'Person.retirementAge',
		'SocialSecurity.estimatedMonthlyAtFRA',
		'SocialSecurity.plannedStartAge'
	],

	exportTemplates: [
		{
			id: 'retirement-summary',
			name: 'Retirement Summary',
			format: 'pdf',
			description: 'One-page retirement planning summary',
			includedEntities: ['Person', 'SocialSecurity', 'RetirementAccount', 'Pension']
		},
		{
			id: 'income-sources',
			name: 'Income Sources',
			format: 'csv',
			description: 'All income sources in spreadsheet format',
			includedEntities: ['SocialSecurity', 'Pension', 'RetirementAccount'],
			csvColumns: [
				{ header: 'Source', factPath: 'entity.displayName' },
				{ header: 'Type', factPath: 'accountType' },
				{ header: 'Monthly Amount', factPath: 'estimatedMonthlyBenefit|currentBalance' },
				{ header: 'Start Age', factPath: 'plannedStartAge|normalRetirementDate' }
			]
		},
		{
			id: 'verification-checklist',
			name: 'Verification Checklist',
			format: 'markdown',
			description: 'List of facts needing verification with sources',
			includedEntities: ['SocialSecurity', 'RetirementAccount', 'Pension']
		}
	],

	createdAt: '2024-01-01T00:00:00Z',
	updatedAt: '2024-01-01T00:00:00Z',
	isBuiltIn: true
};
