import type { DomainSchema, EntityDefinition, ValidationRule } from '$lib/types/facts';

// ============================================
// ESTATE PLANNING DOMAIN SCHEMA
// ============================================

const personEntity: EntityDefinition = {
	name: 'Person',
	displayName: 'Person',
	description: 'Individual in the estate plan (principal, spouse, beneficiary)',
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
			extractionHints: ['will', 'trust document', 'drivers license']
		},
		{
			name: 'relationship',
			displayName: 'Relationship',
			description: 'Relationship to the principal (self, spouse, child, etc.)',
			type: 'string',
			required: true,
			allowedValues: ['self', 'spouse', 'child', 'grandchild', 'sibling', 'parent', 'friend', 'charity', 'other'],
			extractionHints: ['dialog', 'will']
		},
		{
			name: 'birthDate',
			displayName: 'Date of Birth',
			description: 'Date of birth',
			type: 'date',
			required: false,
			extractionHints: ['drivers license', 'birth certificate']
		},
		{
			name: 'ssn',
			displayName: 'Social Security Number',
			description: 'SSN (stored securely)',
			type: 'string',
			required: false,
			pattern: '^\\d{3}-\\d{2}-\\d{4}$',
			extractionHints: ['Social Security card', 'tax return']
		},
		{
			name: 'address',
			displayName: 'Current Address',
			description: 'Current residential address',
			type: 'string',
			required: false,
			extractionHints: ['dialog', 'drivers license']
		},
		{
			name: 'phone',
			displayName: 'Phone Number',
			description: 'Primary phone number',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		},
		{
			name: 'email',
			displayName: 'Email Address',
			description: 'Email address',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		},
		{
			name: 'isMinor',
			displayName: 'Is Minor',
			description: 'Whether this person is under 18',
			type: 'boolean',
			required: false,
			extractionHints: ['calculated from birth date']
		}
	]
};

const willEntity: EntityDefinition = {
	name: 'Will',
	displayName: 'Last Will and Testament',
	description: 'The principal\'s will',
	category: 'document',
	allowMultiple: false,
	attributes: [
		{
			name: 'exists',
			displayName: 'Has Will',
			description: 'Whether a will exists',
			type: 'boolean',
			required: true,
			extractionHints: ['dialog']
		},
		{
			name: 'executionDate',
			displayName: 'Date Executed',
			description: 'Date the will was signed',
			type: 'date',
			required: false,
			verificationMethod: 'document',
			extractionHints: ['will signature page']
		},
		{
			name: 'state',
			displayName: 'Governing State',
			description: 'State law that governs the will',
			type: 'string',
			required: false,
			extractionHints: ['will', 'dialog']
		},
		{
			name: 'attorney',
			displayName: 'Drafting Attorney',
			description: 'Attorney who drafted the will',
			type: 'contact',
			required: false,
			extractionHints: ['will', 'dialog']
		},
		{
			name: 'originalLocation',
			displayName: 'Location of Original',
			description: 'Where the original signed will is kept',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		},
		{
			name: 'executor',
			displayName: 'Executor',
			description: 'Person named to execute the will',
			type: 'string',
			required: false,
			extractionHints: ['will']
		},
		{
			name: 'alternateExecutor',
			displayName: 'Alternate Executor',
			description: 'Backup executor if primary cannot serve',
			type: 'string',
			required: false,
			extractionHints: ['will']
		},
		{
			name: 'guardianForMinors',
			displayName: 'Guardian for Minor Children',
			description: 'Person named as guardian for minor children',
			type: 'string',
			required: false,
			extractionHints: ['will']
		},
		{
			name: 'lastReviewDate',
			displayName: 'Last Review Date',
			description: 'When the will was last reviewed for updates',
			type: 'date',
			required: false,
			extractionHints: ['dialog']
		}
	]
};

const trustEntity: EntityDefinition = {
	name: 'Trust',
	displayName: 'Trust',
	description: 'A trust document (revocable, irrevocable, etc.)',
	category: 'document',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Trust Name',
			description: 'Full legal name of the trust',
			type: 'string',
			required: true,
			extractionHints: ['trust document', 'dialog']
		},
		{
			name: 'type',
			displayName: 'Trust Type',
			description: 'Type of trust',
			type: 'string',
			required: true,
			allowedValues: ['revocable_living', 'irrevocable', 'testamentary', 'special_needs', 'charitable', 'spendthrift', 'bypass', 'qtip', 'grat', 'ilit', 'other'],
			extractionHints: ['trust document']
		},
		{
			name: 'creationDate',
			displayName: 'Creation Date',
			description: 'Date the trust was created',
			type: 'date',
			required: false,
			verificationMethod: 'document',
			extractionHints: ['trust document']
		},
		{
			name: 'grantor',
			displayName: 'Grantor/Settlor',
			description: 'Person who created the trust',
			type: 'string',
			required: true,
			extractionHints: ['trust document']
		},
		{
			name: 'trustee',
			displayName: 'Current Trustee',
			description: 'Person or entity managing the trust',
			type: 'string',
			required: false,
			extractionHints: ['trust document']
		},
		{
			name: 'successorTrustee',
			displayName: 'Successor Trustee',
			description: 'Person who becomes trustee if current cannot serve',
			type: 'string',
			required: false,
			extractionHints: ['trust document']
		},
		{
			name: 'beneficiaries',
			displayName: 'Beneficiaries',
			description: 'Primary beneficiaries of the trust',
			type: 'string',
			required: false,
			extractionHints: ['trust document']
		},
		{
			name: 'isFunded',
			displayName: 'Is Funded',
			description: 'Whether assets have been transferred into the trust',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog', 'account statements']
		},
		{
			name: 'estimatedValue',
			displayName: 'Estimated Value',
			description: 'Approximate value of assets in trust',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statements', 'dialog']
		},
		{
			name: 'attorney',
			displayName: 'Drafting Attorney',
			description: 'Attorney who drafted the trust',
			type: 'contact',
			required: false,
			extractionHints: ['trust document', 'dialog']
		},
		{
			name: 'originalLocation',
			displayName: 'Location of Original',
			description: 'Where the original signed trust is kept',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		}
	]
};

const powerOfAttorneyEntity: EntityDefinition = {
	name: 'PowerOfAttorney',
	displayName: 'Power of Attorney',
	description: 'Durable power of attorney document',
	category: 'document',
	allowMultiple: true,
	identifierAttribute: 'type',
	attributes: [
		{
			name: 'type',
			displayName: 'POA Type',
			description: 'Type of power of attorney',
			type: 'string',
			required: true,
			allowedValues: ['financial', 'healthcare', 'general', 'limited', 'springing'],
			extractionHints: ['POA document']
		},
		{
			name: 'exists',
			displayName: 'Exists',
			description: 'Whether this POA exists',
			type: 'boolean',
			required: true,
			extractionHints: ['dialog']
		},
		{
			name: 'executionDate',
			displayName: 'Date Executed',
			description: 'Date the POA was signed',
			type: 'date',
			required: false,
			verificationMethod: 'document',
			extractionHints: ['POA signature page']
		},
		{
			name: 'agent',
			displayName: 'Agent/Attorney-in-Fact',
			description: 'Person granted power of attorney',
			type: 'string',
			required: false,
			extractionHints: ['POA document']
		},
		{
			name: 'alternateAgent',
			displayName: 'Alternate Agent',
			description: 'Backup agent if primary cannot serve',
			type: 'string',
			required: false,
			extractionHints: ['POA document']
		},
		{
			name: 'isDurable',
			displayName: 'Is Durable',
			description: 'Whether POA remains effective if principal becomes incapacitated',
			type: 'boolean',
			required: false,
			extractionHints: ['POA document']
		},
		{
			name: 'isSpringing',
			displayName: 'Is Springing',
			description: 'Whether POA only becomes effective upon incapacity',
			type: 'boolean',
			required: false,
			extractionHints: ['POA document']
		},
		{
			name: 'originalLocation',
			displayName: 'Location of Original',
			description: 'Where the original signed POA is kept',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		}
	]
};

const healthcareDirectiveEntity: EntityDefinition = {
	name: 'HealthcareDirective',
	displayName: 'Healthcare Directive',
	description: 'Advance healthcare directive / living will',
	category: 'document',
	allowMultiple: false,
	attributes: [
		{
			name: 'exists',
			displayName: 'Has Directive',
			description: 'Whether a healthcare directive exists',
			type: 'boolean',
			required: true,
			extractionHints: ['dialog']
		},
		{
			name: 'executionDate',
			displayName: 'Date Executed',
			description: 'Date the directive was signed',
			type: 'date',
			required: false,
			verificationMethod: 'document',
			extractionHints: ['directive signature page']
		},
		{
			name: 'healthcareProxy',
			displayName: 'Healthcare Proxy',
			description: 'Person designated to make healthcare decisions',
			type: 'string',
			required: false,
			extractionHints: ['directive', 'dialog']
		},
		{
			name: 'alternateProxy',
			displayName: 'Alternate Healthcare Proxy',
			description: 'Backup person for healthcare decisions',
			type: 'string',
			required: false,
			extractionHints: ['directive']
		},
		{
			name: 'dnrStatus',
			displayName: 'DNR Status',
			description: 'Do Not Resuscitate preferences',
			type: 'string',
			required: false,
			allowedValues: ['full_code', 'dnr', 'dni', 'dnr_dni', 'comfort_only', 'not_specified'],
			extractionHints: ['directive', 'dialog']
		},
		{
			name: 'organDonor',
			displayName: 'Organ Donor',
			description: 'Organ donation preferences',
			type: 'boolean',
			required: false,
			extractionHints: ['directive', 'drivers license']
		},
		{
			name: 'originalLocation',
			displayName: 'Location of Original',
			description: 'Where the original signed directive is kept',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		},
		{
			name: 'physicianHasCopy',
			displayName: 'Physician Has Copy',
			description: 'Whether primary physician has a copy',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog']
		}
	]
};

const assetEntity: EntityDefinition = {
	name: 'EstateAsset',
	displayName: 'Estate Asset',
	description: 'Asset that will be part of the estate',
	category: 'asset',
	allowMultiple: true,
	identifierAttribute: 'description',
	attributes: [
		{
			name: 'description',
			displayName: 'Description',
			description: 'Description of the asset',
			type: 'string',
			required: true,
			extractionHints: ['dialog', 'title', 'deed']
		},
		{
			name: 'type',
			displayName: 'Asset Type',
			description: 'Category of asset',
			type: 'string',
			required: true,
			allowedValues: ['real_estate', 'bank_account', 'investment', 'retirement', 'life_insurance', 'vehicle', 'business', 'personal_property', 'digital', 'other'],
			extractionHints: ['dialog', 'statement']
		},
		{
			name: 'estimatedValue',
			displayName: 'Estimated Value',
			description: 'Current estimated value',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statement', 'appraisal', 'dialog']
		},
		{
			name: 'ownership',
			displayName: 'Ownership Type',
			description: 'How title is held',
			type: 'string',
			required: false,
			allowedValues: ['sole', 'joint_tenants', 'tenants_in_common', 'community_property', 'trust', 'tod_pod', 'other'],
			extractionHints: ['deed', 'title', 'account statement']
		},
		{
			name: 'beneficiaryDesignation',
			displayName: 'Named Beneficiary',
			description: 'Beneficiary designated on this asset',
			type: 'string',
			required: false,
			extractionHints: ['beneficiary form', 'account statement']
		},
		{
			name: 'inTrust',
			displayName: 'Held in Trust',
			description: 'Whether asset is titled in a trust',
			type: 'boolean',
			required: false,
			extractionHints: ['title', 'statement']
		},
		{
			name: 'trustName',
			displayName: 'Trust Name',
			description: 'Name of trust if asset is in trust',
			type: 'string',
			required: false,
			extractionHints: ['statement', 'title']
		},
		{
			name: 'institution',
			displayName: 'Institution',
			description: 'Bank, broker, or company holding asset',
			type: 'string',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'accountNumber',
			displayName: 'Account Number',
			description: 'Account or policy number',
			type: 'string',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'location',
			displayName: 'Physical Location',
			description: 'Where physical asset is located',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		}
	]
};

const beneficiaryDesignationEntity: EntityDefinition = {
	name: 'BeneficiaryDesignation',
	displayName: 'Beneficiary Designation',
	description: 'Beneficiary designation on an account or policy',
	category: 'document',
	allowMultiple: true,
	identifierAttribute: 'accountDescription',
	attributes: [
		{
			name: 'accountDescription',
			displayName: 'Account Description',
			description: 'Description of the account or policy',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'dialog']
		},
		{
			name: 'accountType',
			displayName: 'Account Type',
			description: 'Type of account',
			type: 'string',
			required: true,
			allowedValues: ['401k', 'ira', 'life_insurance', 'annuity', 'bank_pod', 'brokerage_tod', 'pension', 'other'],
			extractionHints: ['statement']
		},
		{
			name: 'institution',
			displayName: 'Institution',
			description: 'Company holding the account',
			type: 'string',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'primaryBeneficiary',
			displayName: 'Primary Beneficiary',
			description: 'Primary beneficiary name and percentage',
			type: 'string',
			required: true,
			extractionHints: ['beneficiary form', 'statement']
		},
		{
			name: 'primaryPercentage',
			displayName: 'Primary Percentage',
			description: 'Percentage to primary beneficiary',
			type: 'percentage',
			required: false,
			extractionHints: ['beneficiary form']
		},
		{
			name: 'contingentBeneficiary',
			displayName: 'Contingent Beneficiary',
			description: 'Contingent/secondary beneficiary',
			type: 'string',
			required: false,
			extractionHints: ['beneficiary form']
		},
		{
			name: 'lastUpdated',
			displayName: 'Last Updated',
			description: 'When beneficiary designation was last updated',
			type: 'date',
			required: false,
			extractionHints: ['beneficiary form', 'dialog']
		},
		{
			name: 'needsUpdate',
			displayName: 'Needs Update',
			description: 'Whether designation needs to be updated',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog', 'review']
		}
	]
};

const professionalContactEntity: EntityDefinition = {
	name: 'ProfessionalContact',
	displayName: 'Professional Contact',
	description: 'Attorney, accountant, or advisor involved in estate',
	category: 'contact',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Name',
			description: 'Full name of professional',
			type: 'string',
			required: true,
			extractionHints: ['dialog', 'document']
		},
		{
			name: 'role',
			displayName: 'Role',
			description: 'Professional role',
			type: 'string',
			required: true,
			allowedValues: ['estate_attorney', 'tax_attorney', 'cpa', 'financial_advisor', 'insurance_agent', 'trustee', 'other'],
			extractionHints: ['dialog']
		},
		{
			name: 'firm',
			displayName: 'Firm Name',
			description: 'Name of firm or company',
			type: 'string',
			required: false,
			extractionHints: ['letterhead', 'dialog']
		},
		{
			name: 'phone',
			displayName: 'Phone',
			description: 'Phone number',
			type: 'string',
			required: false,
			extractionHints: ['dialog', 'letterhead']
		},
		{
			name: 'email',
			displayName: 'Email',
			description: 'Email address',
			type: 'string',
			required: false,
			extractionHints: ['dialog', 'letterhead']
		},
		{
			name: 'address',
			displayName: 'Address',
			description: 'Office address',
			type: 'string',
			required: false,
			extractionHints: ['letterhead']
		},
		{
			name: 'hasDocuments',
			displayName: 'Has Documents',
			description: 'Whether this professional holds original documents',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog']
		},
		{
			name: 'documentsHeld',
			displayName: 'Documents Held',
			description: 'Which documents they hold',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		}
	]
};

const validationRules: ValidationRule[] = [
	{
		id: 'will-execution-date',
		name: 'Will Execution Date Valid',
		description: 'Will execution date must be in the past',
		expression: 'Will.executionDate <= today()',
		severity: 'error',
		message: 'Will execution date cannot be in the future'
	},
	{
		id: 'trust-funding-check',
		name: 'Trust Funding Check',
		description: 'Revocable living trust should be funded',
		expression: 'Trust.type == "revocable_living" AND Trust.isFunded == false',
		severity: 'warning',
		message: 'Revocable living trust exists but may not be funded - assets may go through probate'
	},
	{
		id: 'healthcare-proxy-required',
		name: 'Healthcare Proxy Recommended',
		description: 'Healthcare directive should name a proxy',
		expression: 'HealthcareDirective.exists == true AND HealthcareDirective.healthcareProxy == null',
		severity: 'warning',
		message: 'Healthcare directive exists but no healthcare proxy is named'
	},
	{
		id: 'poa-financial-required',
		name: 'Financial POA Recommended',
		description: 'Everyone should have a financial power of attorney',
		expression: 'PowerOfAttorney.type == "financial" AND PowerOfAttorney.exists == false',
		severity: 'warning',
		message: 'No financial power of attorney exists - consider creating one'
	},
	{
		id: 'beneficiary-review',
		name: 'Beneficiary Review',
		description: 'Beneficiary designations should be reviewed periodically',
		expression: 'BeneficiaryDesignation.lastUpdated < today() - 3 years',
		severity: 'info',
		message: 'Beneficiary designation has not been reviewed in over 3 years'
	},
	{
		id: 'executor-is-beneficiary',
		name: 'Executor Awareness',
		description: 'Executor should know they are named',
		expression: 'Will.executor != null',
		severity: 'info',
		message: 'Ensure the executor knows they are named and has access to documents'
	},
	{
		id: 'minor-guardian',
		name: 'Guardian for Minors',
		description: 'Parents with minor children should name a guardian',
		expression: 'Person.isMinor == true AND Will.guardianForMinors == null',
		severity: 'warning',
		message: 'Minor children exist but no guardian is named in the will'
	}
];

export const estatePlanningSchema: DomainSchema = {
	id: 'estate-planning-v1',
	domain: 'estate_planning',
	name: 'Estate Planning',
	version: '1.0.0',
	description: 'Schema for estate planning including wills, trusts, powers of attorney, healthcare directives, and beneficiary designations',

	entities: [
		personEntity,
		willEntity,
		trustEntity,
		powerOfAttorneyEntity,
		healthcareDirectiveEntity,
		assetEntity,
		beneficiaryDesignationEntity,
		professionalContactEntity
	],

	relationships: [
		{
			name: 'hasWill',
			fromEntity: 'Person',
			toEntity: 'Will',
			cardinality: 'one-to-one',
			description: 'Principal has a will'
		},
		{
			name: 'hasTrust',
			fromEntity: 'Person',
			toEntity: 'Trust',
			cardinality: 'one-to-many',
			description: 'Principal has created trusts'
		},
		{
			name: 'hasPOA',
			fromEntity: 'Person',
			toEntity: 'PowerOfAttorney',
			cardinality: 'one-to-many',
			description: 'Principal has powers of attorney'
		},
		{
			name: 'hasHealthcareDirective',
			fromEntity: 'Person',
			toEntity: 'HealthcareDirective',
			cardinality: 'one-to-one',
			description: 'Principal has healthcare directive'
		},
		{
			name: 'ownsAsset',
			fromEntity: 'Person',
			toEntity: 'EstateAsset',
			cardinality: 'one-to-many',
			description: 'Principal owns estate assets'
		},
		{
			name: 'hasBeneficiaryDesignation',
			fromEntity: 'EstateAsset',
			toEntity: 'BeneficiaryDesignation',
			cardinality: 'one-to-one',
			description: 'Asset has beneficiary designation'
		},
		{
			name: 'worksWithProfessional',
			fromEntity: 'Person',
			toEntity: 'ProfessionalContact',
			cardinality: 'one-to-many',
			description: 'Principal works with professional advisors'
		}
	],

	validationRules,

	requiredFacts: [
		'Person.name',
		'Will.exists',
		'PowerOfAttorney.exists',
		'HealthcareDirective.exists'
	],

	exportTemplates: [
		{
			id: 'estate-summary',
			name: 'Estate Plan Summary',
			format: 'pdf',
			description: 'Comprehensive estate planning summary for family members',
			includedEntities: ['Person', 'Will', 'Trust', 'PowerOfAttorney', 'HealthcareDirective', 'ProfessionalContact']
		},
		{
			id: 'asset-inventory',
			name: 'Asset Inventory',
			format: 'csv',
			description: 'Complete inventory of estate assets',
			includedEntities: ['EstateAsset'],
			csvColumns: [
				{ header: 'Description', factPath: 'description' },
				{ header: 'Type', factPath: 'type' },
				{ header: 'Estimated Value', factPath: 'estimatedValue' },
				{ header: 'Ownership', factPath: 'ownership' },
				{ header: 'Beneficiary', factPath: 'beneficiaryDesignation' },
				{ header: 'In Trust', factPath: 'inTrust' },
				{ header: 'Institution', factPath: 'institution' }
			]
		},
		{
			id: 'beneficiary-review',
			name: 'Beneficiary Designation Review',
			format: 'csv',
			description: 'All beneficiary designations for review',
			includedEntities: ['BeneficiaryDesignation'],
			csvColumns: [
				{ header: 'Account', factPath: 'accountDescription' },
				{ header: 'Type', factPath: 'accountType' },
				{ header: 'Institution', factPath: 'institution' },
				{ header: 'Primary Beneficiary', factPath: 'primaryBeneficiary' },
				{ header: 'Contingent', factPath: 'contingentBeneficiary' },
				{ header: 'Last Updated', factPath: 'lastUpdated' }
			]
		},
		{
			id: 'document-locator',
			name: 'Document Locator',
			format: 'pdf',
			description: 'Where to find all estate planning documents',
			includedEntities: ['Will', 'Trust', 'PowerOfAttorney', 'HealthcareDirective', 'ProfessionalContact']
		},
		{
			id: 'emergency-contacts',
			name: 'Emergency Contacts',
			format: 'markdown',
			description: 'Key contacts for family in case of emergency',
			includedEntities: ['ProfessionalContact', 'Person']
		}
	],

	createdAt: '2024-01-01T00:00:00Z',
	updatedAt: '2024-01-01T00:00:00Z',
	isBuiltIn: true
};
