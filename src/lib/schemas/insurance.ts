import type { DomainSchema, EntityDefinition, ValidationRule } from '$lib/types/facts';

// ============================================
// INSURANCE REVIEW DOMAIN SCHEMA
// ============================================

const insuredPersonEntity: EntityDefinition = {
	name: 'InsuredPerson',
	displayName: 'Insured Person',
	description: 'Person covered by insurance policies',
	category: 'identity',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Full Name',
			description: 'Full legal name',
			type: 'string',
			required: true,
			extractionHints: ['policy', 'dialog']
		},
		{
			name: 'birthDate',
			displayName: 'Date of Birth',
			description: 'Date of birth for premium calculations',
			type: 'date',
			required: false,
			extractionHints: ['policy application', 'dialog']
		},
		{
			name: 'relationship',
			displayName: 'Relationship',
			description: 'Relationship to primary policyholder',
			type: 'string',
			required: true,
			allowedValues: ['self', 'spouse', 'child', 'parent', 'other'],
			extractionHints: ['dialog']
		},
		{
			name: 'smoker',
			displayName: 'Smoker Status',
			description: 'Whether person is a smoker (affects premiums)',
			type: 'boolean',
			required: false,
			extractionHints: ['life insurance application']
		},
		{
			name: 'occupation',
			displayName: 'Occupation',
			description: 'Current occupation (affects some policies)',
			type: 'string',
			required: false,
			extractionHints: ['dialog', 'application']
		}
	]
};

const autoInsuranceEntity: EntityDefinition = {
	name: 'AutoInsurance',
	displayName: 'Auto Insurance',
	description: 'Vehicle insurance policy',
	category: 'policy',
	allowMultiple: true,
	identifierAttribute: 'policyNumber',
	attributes: [
		{
			name: 'carrier',
			displayName: 'Insurance Company',
			description: 'Name of insurance carrier',
			type: 'string',
			required: true,
			extractionHints: ['declarations page', 'insurance card', 'dialog']
		},
		{
			name: 'policyNumber',
			displayName: 'Policy Number',
			description: 'Policy identification number',
			type: 'string',
			required: true,
			verificationMethod: 'document',
			extractionHints: ['declarations page', 'insurance card']
		},
		{
			name: 'effectiveDate',
			displayName: 'Effective Date',
			description: 'When coverage begins',
			type: 'date',
			required: false,
			extractionHints: ['declarations page']
		},
		{
			name: 'expirationDate',
			displayName: 'Expiration Date',
			description: 'When coverage ends/renews',
			type: 'date',
			required: true,
			extractionHints: ['declarations page', 'renewal notice']
		},
		{
			name: 'premium',
			displayName: 'Premium',
			description: 'Premium amount per payment period',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page', 'billing statement']
		},
		{
			name: 'paymentFrequency',
			displayName: 'Payment Frequency',
			description: 'How often premium is paid',
			type: 'string',
			required: false,
			allowedValues: ['monthly', 'quarterly', 'semi_annual', 'annual'],
			extractionHints: ['billing statement']
		},
		{
			name: 'bodilyInjuryPerPerson',
			displayName: 'Bodily Injury (Per Person)',
			description: 'Liability limit per person for bodily injury',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'bodilyInjuryPerAccident',
			displayName: 'Bodily Injury (Per Accident)',
			description: 'Liability limit per accident for bodily injury',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'propertyDamage',
			displayName: 'Property Damage Liability',
			description: 'Liability limit for property damage',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'collisionDeductible',
			displayName: 'Collision Deductible',
			description: 'Deductible for collision coverage',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'comprehensiveDeductible',
			displayName: 'Comprehensive Deductible',
			description: 'Deductible for comprehensive coverage',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'uninsuredMotorist',
			displayName: 'Uninsured Motorist Coverage',
			description: 'Coverage for uninsured/underinsured motorists',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'medicalPayments',
			displayName: 'Medical Payments',
			description: 'Medical payments coverage limit',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'roadsideAssistance',
			displayName: 'Roadside Assistance',
			description: 'Whether roadside assistance is included',
			type: 'boolean',
			required: false,
			extractionHints: ['declarations page']
		},
		{
			name: 'rentalReimbursement',
			displayName: 'Rental Reimbursement',
			description: 'Rental car coverage while vehicle is being repaired',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'agentName',
			displayName: 'Agent Name',
			description: 'Insurance agent name',
			type: 'string',
			required: false,
			extractionHints: ['policy', 'dialog']
		},
		{
			name: 'agentPhone',
			displayName: 'Agent Phone',
			description: 'Agent phone number',
			type: 'string',
			required: false,
			extractionHints: ['policy', 'dialog']
		}
	]
};

const vehicleEntity: EntityDefinition = {
	name: 'Vehicle',
	displayName: 'Vehicle',
	description: 'Vehicle covered by auto insurance',
	category: 'asset',
	allowMultiple: true,
	identifierAttribute: 'vin',
	attributes: [
		{
			name: 'year',
			displayName: 'Year',
			description: 'Model year',
			type: 'number',
			required: true,
			extractionHints: ['registration', 'declarations page']
		},
		{
			name: 'make',
			displayName: 'Make',
			description: 'Vehicle manufacturer',
			type: 'string',
			required: true,
			extractionHints: ['registration', 'declarations page']
		},
		{
			name: 'model',
			displayName: 'Model',
			description: 'Vehicle model',
			type: 'string',
			required: true,
			extractionHints: ['registration', 'declarations page']
		},
		{
			name: 'vin',
			displayName: 'VIN',
			description: 'Vehicle Identification Number',
			type: 'string',
			required: true,
			pattern: '^[A-HJ-NPR-Z0-9]{17}$',
			verificationMethod: 'document',
			extractionHints: ['registration', 'declarations page', 'title']
		},
		{
			name: 'primaryDriver',
			displayName: 'Primary Driver',
			description: 'Primary driver of this vehicle',
			type: 'string',
			required: false,
			extractionHints: ['policy', 'dialog']
		},
		{
			name: 'annualMileage',
			displayName: 'Annual Mileage',
			description: 'Estimated annual miles driven',
			type: 'number',
			required: false,
			extractionHints: ['policy application', 'dialog']
		},
		{
			name: 'garagedAddress',
			displayName: 'Garaged Address',
			description: 'Where vehicle is primarily kept',
			type: 'string',
			required: false,
			extractionHints: ['policy']
		}
	]
};

const homeInsuranceEntity: EntityDefinition = {
	name: 'HomeInsurance',
	displayName: 'Homeowners/Renters Insurance',
	description: 'Property insurance for home or rental',
	category: 'policy',
	allowMultiple: true,
	identifierAttribute: 'policyNumber',
	attributes: [
		{
			name: 'policyType',
			displayName: 'Policy Type',
			description: 'Type of property insurance',
			type: 'string',
			required: true,
			allowedValues: ['homeowners', 'renters', 'condo', 'landlord', 'mobile_home'],
			extractionHints: ['declarations page', 'dialog']
		},
		{
			name: 'carrier',
			displayName: 'Insurance Company',
			description: 'Name of insurance carrier',
			type: 'string',
			required: true,
			extractionHints: ['declarations page']
		},
		{
			name: 'policyNumber',
			displayName: 'Policy Number',
			description: 'Policy identification number',
			type: 'string',
			required: true,
			verificationMethod: 'document',
			extractionHints: ['declarations page']
		},
		{
			name: 'propertyAddress',
			displayName: 'Property Address',
			description: 'Address of insured property',
			type: 'string',
			required: true,
			extractionHints: ['declarations page']
		},
		{
			name: 'effectiveDate',
			displayName: 'Effective Date',
			description: 'When coverage begins',
			type: 'date',
			required: false,
			extractionHints: ['declarations page']
		},
		{
			name: 'expirationDate',
			displayName: 'Expiration Date',
			description: 'When coverage ends/renews',
			type: 'date',
			required: true,
			extractionHints: ['declarations page']
		},
		{
			name: 'annualPremium',
			displayName: 'Annual Premium',
			description: 'Annual premium amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page', 'billing']
		},
		{
			name: 'dwellingCoverage',
			displayName: 'Dwelling Coverage (Coverage A)',
			description: 'Coverage for the structure',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'otherStructures',
			displayName: 'Other Structures (Coverage B)',
			description: 'Coverage for detached structures',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'personalProperty',
			displayName: 'Personal Property (Coverage C)',
			description: 'Coverage for belongings',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'lossOfUse',
			displayName: 'Loss of Use (Coverage D)',
			description: 'Coverage for additional living expenses',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'personalLiability',
			displayName: 'Personal Liability (Coverage E)',
			description: 'Liability coverage',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'medicalPayments',
			displayName: 'Medical Payments (Coverage F)',
			description: 'Medical payments to others',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'deductible',
			displayName: 'Deductible',
			description: 'Standard deductible amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'windHailDeductible',
			displayName: 'Wind/Hail Deductible',
			description: 'Separate deductible for wind/hail damage',
			type: 'string',
			required: false,
			extractionHints: ['declarations page']
		},
		{
			name: 'floodCoverage',
			displayName: 'Flood Coverage',
			description: 'Whether separate flood insurance exists',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog', 'separate policy']
		},
		{
			name: 'earthquakeCoverage',
			displayName: 'Earthquake Coverage',
			description: 'Whether earthquake coverage is included',
			type: 'boolean',
			required: false,
			extractionHints: ['declarations page', 'endorsement']
		},
		{
			name: 'replacementCost',
			displayName: 'Replacement Cost Coverage',
			description: 'Whether personal property has replacement cost coverage',
			type: 'boolean',
			required: false,
			extractionHints: ['declarations page']
		},
		{
			name: 'scheduledItems',
			displayName: 'Scheduled Personal Property',
			description: 'High-value items with separate coverage',
			type: 'string',
			required: false,
			extractionHints: ['endorsement', 'floater']
		}
	]
};

const lifeInsuranceEntity: EntityDefinition = {
	name: 'LifeInsurance',
	displayName: 'Life Insurance',
	description: 'Life insurance policy',
	category: 'policy',
	allowMultiple: true,
	identifierAttribute: 'policyNumber',
	attributes: [
		{
			name: 'policyType',
			displayName: 'Policy Type',
			description: 'Type of life insurance',
			type: 'string',
			required: true,
			allowedValues: ['term', 'whole_life', 'universal', 'variable', 'variable_universal', 'final_expense', 'group'],
			extractionHints: ['policy', 'dialog']
		},
		{
			name: 'carrier',
			displayName: 'Insurance Company',
			description: 'Name of insurance carrier',
			type: 'string',
			required: true,
			extractionHints: ['policy', 'statement']
		},
		{
			name: 'policyNumber',
			displayName: 'Policy Number',
			description: 'Policy identification number',
			type: 'string',
			required: true,
			verificationMethod: 'document',
			extractionHints: ['policy', 'statement']
		},
		{
			name: 'insured',
			displayName: 'Insured Person',
			description: 'Person whose life is insured',
			type: 'string',
			required: true,
			extractionHints: ['policy']
		},
		{
			name: 'owner',
			displayName: 'Policy Owner',
			description: 'Owner of the policy (may differ from insured)',
			type: 'string',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'deathBenefit',
			displayName: 'Death Benefit',
			description: 'Face value / death benefit amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['policy', 'statement']
		},
		{
			name: 'premium',
			displayName: 'Premium',
			description: 'Premium amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['policy', 'billing']
		},
		{
			name: 'paymentFrequency',
			displayName: 'Payment Frequency',
			description: 'How often premium is paid',
			type: 'string',
			required: false,
			allowedValues: ['monthly', 'quarterly', 'semi_annual', 'annual'],
			extractionHints: ['billing']
		},
		{
			name: 'issueDate',
			displayName: 'Issue Date',
			description: 'When policy was issued',
			type: 'date',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'termLength',
			displayName: 'Term Length',
			description: 'Length of term (for term policies)',
			type: 'number',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'termExpiration',
			displayName: 'Term Expiration',
			description: 'When term coverage expires',
			type: 'date',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'cashValue',
			displayName: 'Cash Value',
			description: 'Current cash value (for permanent policies)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['annual statement']
		},
		{
			name: 'cashValueAsOfDate',
			displayName: 'Cash Value As Of',
			description: 'Date of cash value',
			type: 'date',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'primaryBeneficiary',
			displayName: 'Primary Beneficiary',
			description: 'Primary beneficiary',
			type: 'string',
			required: true,
			extractionHints: ['policy', 'beneficiary form']
		},
		{
			name: 'contingentBeneficiary',
			displayName: 'Contingent Beneficiary',
			description: 'Contingent/secondary beneficiary',
			type: 'string',
			required: false,
			extractionHints: ['policy', 'beneficiary form']
		},
		{
			name: 'acceleratedBenefits',
			displayName: 'Accelerated Death Benefits',
			description: 'Whether policy has living benefits rider',
			type: 'boolean',
			required: false,
			extractionHints: ['policy', 'rider']
		},
		{
			name: 'waiverOfPremium',
			displayName: 'Waiver of Premium',
			description: 'Whether policy has waiver of premium rider',
			type: 'boolean',
			required: false,
			extractionHints: ['policy', 'rider']
		}
	]
};

const healthInsuranceEntity: EntityDefinition = {
	name: 'HealthInsurance',
	displayName: 'Health Insurance',
	description: 'Health/medical insurance coverage',
	category: 'policy',
	allowMultiple: true,
	identifierAttribute: 'memberId',
	attributes: [
		{
			name: 'planType',
			displayName: 'Plan Type',
			description: 'Type of health plan',
			type: 'string',
			required: true,
			allowedValues: ['employer', 'individual', 'medicare', 'medicare_advantage', 'medicaid', 'medigap', 'cobra', 'marketplace'],
			extractionHints: ['insurance card', 'dialog']
		},
		{
			name: 'carrier',
			displayName: 'Insurance Company',
			description: 'Name of insurance carrier',
			type: 'string',
			required: true,
			extractionHints: ['insurance card', 'EOB']
		},
		{
			name: 'planName',
			displayName: 'Plan Name',
			description: 'Name of the specific plan',
			type: 'string',
			required: false,
			extractionHints: ['insurance card', 'benefits summary']
		},
		{
			name: 'memberId',
			displayName: 'Member ID',
			description: 'Member identification number',
			type: 'string',
			required: true,
			verificationMethod: 'document',
			extractionHints: ['insurance card']
		},
		{
			name: 'groupNumber',
			displayName: 'Group Number',
			description: 'Employer group number',
			type: 'string',
			required: false,
			extractionHints: ['insurance card']
		},
		{
			name: 'effectiveDate',
			displayName: 'Effective Date',
			description: 'When coverage begins',
			type: 'date',
			required: false,
			extractionHints: ['benefits summary']
		},
		{
			name: 'monthlyPremium',
			displayName: 'Monthly Premium',
			description: 'Monthly premium (employee portion)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['paycheck', 'billing']
		},
		{
			name: 'individualDeductible',
			displayName: 'Individual Deductible',
			description: 'Annual deductible per person',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['benefits summary', 'SBC']
		},
		{
			name: 'familyDeductible',
			displayName: 'Family Deductible',
			description: 'Annual deductible for family',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['benefits summary', 'SBC']
		},
		{
			name: 'individualOopMax',
			displayName: 'Individual Out-of-Pocket Max',
			description: 'Maximum annual out-of-pocket per person',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['benefits summary', 'SBC']
		},
		{
			name: 'familyOopMax',
			displayName: 'Family Out-of-Pocket Max',
			description: 'Maximum annual out-of-pocket for family',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['benefits summary', 'SBC']
		},
		{
			name: 'pcpCopay',
			displayName: 'Primary Care Copay',
			description: 'Copay for primary care visits',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['benefits summary', 'SBC']
		},
		{
			name: 'specialistCopay',
			displayName: 'Specialist Copay',
			description: 'Copay for specialist visits',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['benefits summary', 'SBC']
		},
		{
			name: 'erCopay',
			displayName: 'Emergency Room Copay',
			description: 'Copay for ER visits',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['benefits summary', 'SBC']
		},
		{
			name: 'rxCoverage',
			displayName: 'Prescription Coverage',
			description: 'Whether prescription drugs are covered',
			type: 'boolean',
			required: false,
			extractionHints: ['benefits summary']
		},
		{
			name: 'genericCopay',
			displayName: 'Generic Drug Copay',
			description: 'Copay for generic prescriptions',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['benefits summary', 'SBC']
		},
		{
			name: 'networkType',
			displayName: 'Network Type',
			description: 'Type of provider network',
			type: 'string',
			required: false,
			allowedValues: ['hmo', 'ppo', 'epo', 'pos', 'hdhp'],
			extractionHints: ['insurance card', 'benefits summary']
		},
		{
			name: 'hsaEligible',
			displayName: 'HSA Eligible',
			description: 'Whether plan qualifies for HSA',
			type: 'boolean',
			required: false,
			extractionHints: ['benefits summary']
		}
	]
};

const disabilityInsuranceEntity: EntityDefinition = {
	name: 'DisabilityInsurance',
	displayName: 'Disability Insurance',
	description: 'Short-term or long-term disability coverage',
	category: 'policy',
	allowMultiple: true,
	identifierAttribute: 'policyNumber',
	attributes: [
		{
			name: 'type',
			displayName: 'Disability Type',
			description: 'Short-term or long-term disability',
			type: 'string',
			required: true,
			allowedValues: ['short_term', 'long_term', 'both'],
			extractionHints: ['policy', 'benefits summary']
		},
		{
			name: 'source',
			displayName: 'Coverage Source',
			description: 'Where coverage comes from',
			type: 'string',
			required: true,
			allowedValues: ['employer', 'individual', 'supplemental'],
			extractionHints: ['dialog', 'policy']
		},
		{
			name: 'carrier',
			displayName: 'Insurance Company',
			description: 'Name of insurance carrier',
			type: 'string',
			required: true,
			extractionHints: ['policy']
		},
		{
			name: 'policyNumber',
			displayName: 'Policy Number',
			description: 'Policy identification number',
			type: 'string',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'monthlyBenefit',
			displayName: 'Monthly Benefit',
			description: 'Monthly benefit amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['policy', 'benefits summary']
		},
		{
			name: 'benefitPercentage',
			displayName: 'Benefit Percentage',
			description: 'Percentage of income replaced',
			type: 'percentage',
			required: false,
			extractionHints: ['policy', 'benefits summary']
		},
		{
			name: 'eliminationPeriod',
			displayName: 'Elimination Period',
			description: 'Days before benefits begin',
			type: 'number',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'benefitPeriod',
			displayName: 'Benefit Period',
			description: 'How long benefits are paid',
			type: 'string',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'ownOccupation',
			displayName: 'Own Occupation Definition',
			description: 'Whether policy uses own-occupation disability definition',
			type: 'boolean',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'taxable',
			displayName: 'Benefits Taxable',
			description: 'Whether benefits are taxable (employer-paid premiums = taxable)',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog', 'policy']
		}
	]
};

const umbrellaInsuranceEntity: EntityDefinition = {
	name: 'UmbrellaInsurance',
	displayName: 'Umbrella Insurance',
	description: 'Personal umbrella liability policy',
	category: 'policy',
	allowMultiple: false,
	attributes: [
		{
			name: 'carrier',
			displayName: 'Insurance Company',
			description: 'Name of insurance carrier',
			type: 'string',
			required: true,
			extractionHints: ['policy']
		},
		{
			name: 'policyNumber',
			displayName: 'Policy Number',
			description: 'Policy identification number',
			type: 'string',
			required: true,
			verificationMethod: 'document',
			extractionHints: ['policy']
		},
		{
			name: 'coverageLimit',
			displayName: 'Coverage Limit',
			description: 'Total umbrella coverage amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page']
		},
		{
			name: 'annualPremium',
			displayName: 'Annual Premium',
			description: 'Annual premium amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['declarations page', 'billing']
		},
		{
			name: 'expirationDate',
			displayName: 'Expiration Date',
			description: 'When coverage expires/renews',
			type: 'date',
			required: true,
			extractionHints: ['declarations page']
		},
		{
			name: 'underlyingAutoRequired',
			displayName: 'Required Auto Liability',
			description: 'Minimum auto liability required',
			type: 'string',
			required: false,
			extractionHints: ['policy requirements']
		},
		{
			name: 'underlyingHomeRequired',
			displayName: 'Required Home Liability',
			description: 'Minimum home liability required',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['policy requirements']
		}
	]
};

const longTermCareEntity: EntityDefinition = {
	name: 'LongTermCare',
	displayName: 'Long-Term Care Insurance',
	description: 'Long-term care insurance policy',
	category: 'policy',
	allowMultiple: true,
	identifierAttribute: 'policyNumber',
	attributes: [
		{
			name: 'carrier',
			displayName: 'Insurance Company',
			description: 'Name of insurance carrier',
			type: 'string',
			required: true,
			extractionHints: ['policy']
		},
		{
			name: 'policyNumber',
			displayName: 'Policy Number',
			description: 'Policy identification number',
			type: 'string',
			required: true,
			verificationMethod: 'document',
			extractionHints: ['policy']
		},
		{
			name: 'insured',
			displayName: 'Insured Person',
			description: 'Person covered by policy',
			type: 'string',
			required: true,
			extractionHints: ['policy']
		},
		{
			name: 'dailyBenefit',
			displayName: 'Daily Benefit',
			description: 'Maximum daily benefit amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['policy']
		},
		{
			name: 'benefitPeriod',
			displayName: 'Benefit Period',
			description: 'How long benefits are paid (years or lifetime)',
			type: 'string',
			required: true,
			extractionHints: ['policy']
		},
		{
			name: 'eliminationPeriod',
			displayName: 'Elimination Period',
			description: 'Days before benefits begin',
			type: 'number',
			required: true,
			extractionHints: ['policy']
		},
		{
			name: 'inflationProtection',
			displayName: 'Inflation Protection',
			description: 'Type of inflation protection',
			type: 'string',
			required: false,
			allowedValues: ['none', 'simple_3', 'simple_5', 'compound_3', 'compound_5', 'cpi'],
			extractionHints: ['policy']
		},
		{
			name: 'homeCare',
			displayName: 'Home Care Coverage',
			description: 'Whether home care is covered',
			type: 'boolean',
			required: false,
			extractionHints: ['policy']
		},
		{
			name: 'premium',
			displayName: 'Annual Premium',
			description: 'Annual premium amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['policy', 'billing']
		},
		{
			name: 'sharedCare',
			displayName: 'Shared Care Rider',
			description: 'Whether policy has shared care with spouse',
			type: 'boolean',
			required: false,
			extractionHints: ['policy']
		}
	]
};

const insuranceAgentEntity: EntityDefinition = {
	name: 'InsuranceAgent',
	displayName: 'Insurance Agent/Broker',
	description: 'Insurance agent or broker contact',
	category: 'contact',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Name',
			description: 'Agent name',
			type: 'string',
			required: true,
			extractionHints: ['policy', 'dialog']
		},
		{
			name: 'agency',
			displayName: 'Agency',
			description: 'Agency or brokerage name',
			type: 'string',
			required: false,
			extractionHints: ['policy', 'dialog']
		},
		{
			name: 'specialties',
			displayName: 'Specialties',
			description: 'Types of insurance handled',
			type: 'string',
			required: false,
			extractionHints: ['dialog']
		},
		{
			name: 'phone',
			displayName: 'Phone',
			description: 'Phone number',
			type: 'string',
			required: false,
			extractionHints: ['policy', 'dialog']
		},
		{
			name: 'email',
			displayName: 'Email',
			description: 'Email address',
			type: 'string',
			required: false,
			extractionHints: ['policy', 'dialog']
		},
		{
			name: 'address',
			displayName: 'Address',
			description: 'Office address',
			type: 'string',
			required: false,
			extractionHints: ['policy']
		}
	]
};

const validationRules: ValidationRule[] = [
	{
		id: 'umbrella-underlying-check',
		name: 'Umbrella Underlying Coverage',
		description: 'Umbrella policy requires adequate underlying coverage',
		expression: 'UmbrellaInsurance.coverageLimit > 0 AND AutoInsurance.bodilyInjuryPerPerson < 250000',
		severity: 'warning',
		message: 'Umbrella policy may require higher underlying auto liability limits'
	},
	{
		id: 'life-insurance-coverage-ratio',
		name: 'Life Insurance Coverage Check',
		description: 'Life insurance should typically be 10-12x income',
		expression: 'LifeInsurance.deathBenefit < InsuredPerson.annualIncome * 10',
		severity: 'info',
		message: 'Life insurance coverage may be below recommended 10x income'
	},
	{
		id: 'policy-expiration-warning',
		name: 'Policy Expiration Warning',
		description: 'Policy expires within 30 days',
		expression: 'AutoInsurance.expirationDate < today() + 30 days',
		severity: 'warning',
		message: 'Auto insurance policy expires soon - review renewal'
	},
	{
		id: 'home-replacement-cost',
		name: 'Home Replacement Cost',
		description: 'Dwelling coverage should meet replacement cost',
		expression: 'HomeInsurance.replacementCost == false',
		severity: 'warning',
		message: 'Consider replacement cost coverage for personal property'
	},
	{
		id: 'disability-coverage-gap',
		name: 'Disability Coverage Gap',
		description: 'Disability should replace 60-70% of income',
		expression: 'DisabilityInsurance.benefitPercentage < 0.6',
		severity: 'info',
		message: 'Disability coverage replaces less than 60% of income - consider supplemental'
	},
	{
		id: 'ltc-inflation-protection',
		name: 'LTC Inflation Protection',
		description: 'Long-term care should have inflation protection',
		expression: 'LongTermCare.inflationProtection == "none"',
		severity: 'warning',
		message: 'Long-term care policy has no inflation protection - benefits may not keep pace with costs'
	},
	{
		id: 'health-hsa-reminder',
		name: 'HSA Contribution Reminder',
		description: 'HSA-eligible plan should maximize contributions',
		expression: 'HealthInsurance.hsaEligible == true',
		severity: 'info',
		message: 'You have an HSA-eligible health plan - consider maximizing HSA contributions'
	},
	{
		id: 'beneficiary-review',
		name: 'Life Insurance Beneficiary Review',
		description: 'Beneficiaries should be reviewed periodically',
		expression: 'LifeInsurance.primaryBeneficiary != null',
		severity: 'info',
		message: 'Remember to review life insurance beneficiaries after major life events'
	}
];

export const insuranceReviewSchema: DomainSchema = {
	id: 'insurance-review-v1',
	domain: 'insurance_review',
	name: 'Insurance Review',
	version: '1.0.0',
	description: 'Schema for comprehensive insurance review including auto, home, life, health, disability, umbrella, and long-term care',

	entities: [
		insuredPersonEntity,
		autoInsuranceEntity,
		vehicleEntity,
		homeInsuranceEntity,
		lifeInsuranceEntity,
		healthInsuranceEntity,
		disabilityInsuranceEntity,
		umbrellaInsuranceEntity,
		longTermCareEntity,
		insuranceAgentEntity
	],

	relationships: [
		{
			name: 'hasAutoInsurance',
			fromEntity: 'InsuredPerson',
			toEntity: 'AutoInsurance',
			cardinality: 'one-to-many',
			description: 'Person has auto insurance policies'
		},
		{
			name: 'insuresVehicle',
			fromEntity: 'AutoInsurance',
			toEntity: 'Vehicle',
			cardinality: 'one-to-many',
			description: 'Auto policy covers vehicles'
		},
		{
			name: 'hasHomeInsurance',
			fromEntity: 'InsuredPerson',
			toEntity: 'HomeInsurance',
			cardinality: 'one-to-many',
			description: 'Person has home/renters insurance'
		},
		{
			name: 'hasLifeInsurance',
			fromEntity: 'InsuredPerson',
			toEntity: 'LifeInsurance',
			cardinality: 'one-to-many',
			description: 'Person has life insurance policies'
		},
		{
			name: 'hasHealthInsurance',
			fromEntity: 'InsuredPerson',
			toEntity: 'HealthInsurance',
			cardinality: 'one-to-many',
			description: 'Person has health insurance'
		},
		{
			name: 'hasDisabilityInsurance',
			fromEntity: 'InsuredPerson',
			toEntity: 'DisabilityInsurance',
			cardinality: 'one-to-many',
			description: 'Person has disability coverage'
		},
		{
			name: 'hasUmbrellaInsurance',
			fromEntity: 'InsuredPerson',
			toEntity: 'UmbrellaInsurance',
			cardinality: 'one-to-one',
			description: 'Person has umbrella liability'
		},
		{
			name: 'hasLongTermCare',
			fromEntity: 'InsuredPerson',
			toEntity: 'LongTermCare',
			cardinality: 'one-to-many',
			description: 'Person has long-term care insurance'
		},
		{
			name: 'worksWithAgent',
			fromEntity: 'InsuredPerson',
			toEntity: 'InsuranceAgent',
			cardinality: 'one-to-many',
			description: 'Person works with insurance agents'
		}
	],

	validationRules,

	requiredFacts: [
		'InsuredPerson.name',
		'AutoInsurance.carrier',
		'AutoInsurance.policyNumber',
		'AutoInsurance.bodilyInjuryPerPerson',
		'HomeInsurance.carrier',
		'HomeInsurance.dwellingCoverage',
		'HealthInsurance.carrier',
		'HealthInsurance.individualDeductible'
	],

	exportTemplates: [
		{
			id: 'insurance-summary',
			name: 'Insurance Summary',
			format: 'pdf',
			description: 'Complete insurance portfolio summary',
			includedEntities: ['InsuredPerson', 'AutoInsurance', 'HomeInsurance', 'LifeInsurance', 'HealthInsurance', 'UmbrellaInsurance']
		},
		{
			id: 'policy-inventory',
			name: 'Policy Inventory',
			format: 'csv',
			description: 'All policies with key details',
			includedEntities: ['AutoInsurance', 'HomeInsurance', 'LifeInsurance', 'HealthInsurance', 'DisabilityInsurance', 'UmbrellaInsurance', 'LongTermCare'],
			csvColumns: [
				{ header: 'Type', factPath: 'entity.displayName' },
				{ header: 'Carrier', factPath: 'carrier' },
				{ header: 'Policy Number', factPath: 'policyNumber' },
				{ header: 'Coverage/Benefit', factPath: 'deathBenefit|dwellingCoverage|coverageLimit' },
				{ header: 'Premium', factPath: 'premium|annualPremium' },
				{ header: 'Expiration', factPath: 'expirationDate|termExpiration' }
			]
		},
		{
			id: 'coverage-gaps',
			name: 'Coverage Gap Analysis',
			format: 'markdown',
			description: 'Analysis of potential coverage gaps',
			includedEntities: ['AutoInsurance', 'HomeInsurance', 'LifeInsurance', 'DisabilityInsurance', 'UmbrellaInsurance', 'LongTermCare']
		},
		{
			id: 'agent-contacts',
			name: 'Agent Contact List',
			format: 'csv',
			description: 'All insurance agent contacts',
			includedEntities: ['InsuranceAgent'],
			csvColumns: [
				{ header: 'Name', factPath: 'name' },
				{ header: 'Agency', factPath: 'agency' },
				{ header: 'Specialties', factPath: 'specialties' },
				{ header: 'Phone', factPath: 'phone' },
				{ header: 'Email', factPath: 'email' }
			]
		},
		{
			id: 'renewal-calendar',
			name: 'Renewal Calendar',
			format: 'csv',
			description: 'Policy renewal dates',
			includedEntities: ['AutoInsurance', 'HomeInsurance', 'UmbrellaInsurance'],
			csvColumns: [
				{ header: 'Policy Type', factPath: 'entity.displayName' },
				{ header: 'Carrier', factPath: 'carrier' },
				{ header: 'Expiration Date', factPath: 'expirationDate' },
				{ header: 'Premium', factPath: 'premium|annualPremium' }
			]
		}
	],

	createdAt: '2024-01-01T00:00:00Z',
	updatedAt: '2024-01-01T00:00:00Z',
	isBuiltIn: true
};
