import type { DomainSchema, EntityDefinition, ValidationRule } from '$lib/types/facts';

// ============================================
// TAX PLANNING DOMAIN SCHEMA
// ============================================

const taxFilerEntity: EntityDefinition = {
	name: 'TaxFiler',
	displayName: 'Tax Filer',
	description: 'Individual or married couple filing taxes',
	category: 'identity',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Full Legal Name',
			description: 'Legal name as it appears on tax return',
			type: 'string',
			required: true,
			extractionHints: ['tax return', 'W-2', 'Form 1040']
		},
		{
			name: 'ssn',
			displayName: 'Social Security Number',
			description: 'SSN for tax filing',
			type: 'string',
			required: false,
			pattern: '^\\d{3}-\\d{2}-\\d{4}$',
			extractionHints: ['Social Security card', 'tax return']
		},
		{
			name: 'filingStatus',
			displayName: 'Filing Status',
			description: 'Tax filing status',
			type: 'string',
			required: true,
			allowedValues: ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household', 'qualifying_widow'],
			extractionHints: ['Form 1040', 'dialog']
		},
		{
			name: 'birthDate',
			displayName: 'Date of Birth',
			description: 'Date of birth for age-related tax provisions',
			type: 'date',
			required: true,
			extractionHints: ['drivers license', 'tax return']
		},
		{
			name: 'occupation',
			displayName: 'Occupation',
			description: 'Primary occupation',
			type: 'string',
			required: false,
			extractionHints: ['Form 1040', 'dialog']
		},
		{
			name: 'isBlind',
			displayName: 'Legally Blind',
			description: 'Whether filer is legally blind (affects standard deduction)',
			type: 'boolean',
			required: false,
			extractionHints: ['Form 1040']
		},
		{
			name: 'state',
			displayName: 'State of Residence',
			description: 'State of primary residence for state tax purposes',
			type: 'string',
			required: true,
			extractionHints: ['address', 'W-2', 'state tax return']
		}
	]
};

const dependentEntity: EntityDefinition = {
	name: 'Dependent',
	displayName: 'Dependent',
	description: 'Qualifying dependent for tax purposes',
	category: 'identity',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Full Name',
			description: 'Dependent full legal name',
			type: 'string',
			required: true,
			extractionHints: ['tax return', 'birth certificate']
		},
		{
			name: 'ssn',
			displayName: 'Social Security Number',
			description: 'Dependent SSN or ITIN',
			type: 'string',
			required: false,
			extractionHints: ['Social Security card']
		},
		{
			name: 'birthDate',
			displayName: 'Date of Birth',
			description: 'Date of birth',
			type: 'date',
			required: true,
			extractionHints: ['birth certificate']
		},
		{
			name: 'relationship',
			displayName: 'Relationship',
			description: 'Relationship to taxpayer',
			type: 'string',
			required: true,
			allowedValues: ['child', 'stepchild', 'foster_child', 'sibling', 'parent', 'grandparent', 'grandchild', 'niece_nephew', 'other'],
			extractionHints: ['dialog', 'tax return']
		},
		{
			name: 'qualifiesForChildTaxCredit',
			displayName: 'Qualifies for Child Tax Credit',
			description: 'Whether dependent qualifies for child tax credit',
			type: 'boolean',
			required: false,
			extractionHints: ['under 17 at year end']
		},
		{
			name: 'qualifiesForCDCC',
			displayName: 'Qualifies for Child & Dependent Care Credit',
			description: 'Whether dependent qualifies for CDCC',
			type: 'boolean',
			required: false,
			extractionHints: ['under 13 or disabled']
		},
		{
			name: 'monthsLivedWithTaxpayer',
			displayName: 'Months Lived with Taxpayer',
			description: 'Number of months dependent lived with taxpayer',
			type: 'number',
			required: false,
			min: 0,
			max: 12,
			extractionHints: ['dialog']
		}
	]
};

const w2IncomeEntity: EntityDefinition = {
	name: 'W2Income',
	displayName: 'W-2 Income',
	description: 'Wage and salary income from employment',
	category: 'income',
	allowMultiple: true,
	identifierAttribute: 'employerName',
	attributes: [
		{
			name: 'employerName',
			displayName: 'Employer Name',
			description: 'Name of employer',
			type: 'string',
			required: true,
			extractionHints: ['W-2 Box c', 'paystub']
		},
		{
			name: 'employerEIN',
			displayName: 'Employer EIN',
			description: 'Employer Identification Number',
			type: 'string',
			required: false,
			extractionHints: ['W-2 Box b']
		},
		{
			name: 'wagesTipsOther',
			displayName: 'Wages, Tips, Other Compensation',
			description: 'Total taxable wages (Box 1)',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 1']
		},
		{
			name: 'federalWithholding',
			displayName: 'Federal Income Tax Withheld',
			description: 'Federal tax withheld (Box 2)',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 2']
		},
		{
			name: 'socialSecurityWages',
			displayName: 'Social Security Wages',
			description: 'Wages subject to Social Security (Box 3)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 3']
		},
		{
			name: 'socialSecurityTax',
			displayName: 'Social Security Tax Withheld',
			description: 'Social Security tax withheld (Box 4)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 4']
		},
		{
			name: 'medicareWages',
			displayName: 'Medicare Wages',
			description: 'Wages subject to Medicare (Box 5)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 5']
		},
		{
			name: 'medicareTax',
			displayName: 'Medicare Tax Withheld',
			description: 'Medicare tax withheld (Box 6)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 6']
		},
		{
			name: 'stateWages',
			displayName: 'State Wages',
			description: 'Wages subject to state tax (Box 16)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 16']
		},
		{
			name: 'stateWithholding',
			displayName: 'State Income Tax Withheld',
			description: 'State tax withheld (Box 17)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 17']
		},
		{
			name: 'retirementPlanContributions',
			displayName: '401(k)/403(b) Contributions',
			description: 'Pre-tax retirement plan contributions (Box 12 code D/E)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 12']
		},
		{
			name: 'healthInsurancePremiums',
			displayName: 'Health Insurance Premiums',
			description: 'Pre-tax health insurance premiums (Box 12 code DD)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['W-2 Box 12 code DD']
		}
	]
};

const businessIncomeEntity: EntityDefinition = {
	name: 'BusinessIncome',
	displayName: 'Business Income (Schedule C)',
	description: 'Self-employment and freelance income',
	category: 'income',
	allowMultiple: true,
	identifierAttribute: 'businessName',
	attributes: [
		{
			name: 'businessName',
			displayName: 'Business Name',
			description: 'Name of business or "Self"',
			type: 'string',
			required: true,
			extractionHints: ['Schedule C', '1099-NEC', 'dialog']
		},
		{
			name: 'businessActivity',
			displayName: 'Principal Business Activity',
			description: 'Description of business activity',
			type: 'string',
			required: true,
			extractionHints: ['Schedule C Line A']
		},
		{
			name: 'businessCode',
			displayName: 'Business Code',
			description: 'Principal business code (NAICS)',
			type: 'string',
			required: false,
			extractionHints: ['Schedule C Line B']
		},
		{
			name: 'grossReceipts',
			displayName: 'Gross Receipts',
			description: 'Total business income',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule C Line 1', '1099-NEC total', '1099-K']
		},
		{
			name: 'costOfGoodsSold',
			displayName: 'Cost of Goods Sold',
			description: 'Cost of inventory sold',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule C Line 4']
		},
		{
			name: 'totalExpenses',
			displayName: 'Total Expenses',
			description: 'Total deductible business expenses',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule C Line 28']
		},
		{
			name: 'netProfit',
			displayName: 'Net Profit',
			description: 'Net profit (or loss) from business',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule C Line 31']
		},
		{
			name: 'homeOfficeDeduction',
			displayName: 'Home Office Deduction',
			description: 'Home office deduction (Form 8829)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 8829', 'simplified method']
		},
		{
			name: 'vehicleExpenses',
			displayName: 'Vehicle Expenses',
			description: 'Business vehicle expenses',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['actual expenses', 'standard mileage rate']
		},
		{
			name: 'businessMiles',
			displayName: 'Business Miles Driven',
			description: 'Total business miles for standard mileage rate',
			type: 'number',
			required: false,
			extractionHints: ['mileage log']
		},
		{
			name: 'healthInsuranceDeduction',
			displayName: 'Self-Employed Health Insurance Deduction',
			description: 'Health insurance premiums for self-employed',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['insurance premiums paid']
		}
	]
};

const investmentIncomeEntity: EntityDefinition = {
	name: 'InvestmentIncome',
	displayName: 'Investment Income',
	description: 'Income from investments (dividends, interest, capital gains)',
	category: 'income',
	allowMultiple: true,
	identifierAttribute: 'accountName',
	attributes: [
		{
			name: 'accountName',
			displayName: 'Account/Institution',
			description: 'Brokerage account or institution name',
			type: 'string',
			required: true,
			extractionHints: ['1099-DIV', '1099-INT', '1099-B']
		},
		{
			name: 'ordinaryDividends',
			displayName: 'Ordinary Dividends',
			description: 'Total ordinary dividends (1099-DIV Box 1a)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1099-DIV Box 1a']
		},
		{
			name: 'qualifiedDividends',
			displayName: 'Qualified Dividends',
			description: 'Qualified dividends (1099-DIV Box 1b)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1099-DIV Box 1b']
		},
		{
			name: 'interestIncome',
			displayName: 'Interest Income',
			description: 'Total interest income (1099-INT)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1099-INT Box 1']
		},
		{
			name: 'taxExemptInterest',
			displayName: 'Tax-Exempt Interest',
			description: 'Municipal bond interest',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1099-INT Box 8']
		},
		{
			name: 'shortTermCapitalGains',
			displayName: 'Short-Term Capital Gains',
			description: 'Net short-term capital gains',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1099-B', 'Schedule D']
		},
		{
			name: 'longTermCapitalGains',
			displayName: 'Long-Term Capital Gains',
			description: 'Net long-term capital gains',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1099-B', 'Schedule D']
		},
		{
			name: 'capitalGainDistributions',
			displayName: 'Capital Gain Distributions',
			description: 'Capital gain distributions from mutual funds',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1099-DIV Box 2a']
		},
		{
			name: 'foreignTaxPaid',
			displayName: 'Foreign Tax Paid',
			description: 'Foreign taxes paid (for credit)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1099-DIV Box 7']
		}
	]
};

const rentalIncomeEntity: EntityDefinition = {
	name: 'RentalIncome',
	displayName: 'Rental Income (Schedule E)',
	description: 'Income and expenses from rental real estate',
	category: 'income',
	allowMultiple: true,
	identifierAttribute: 'propertyAddress',
	attributes: [
		{
			name: 'propertyAddress',
			displayName: 'Property Address',
			description: 'Address of rental property',
			type: 'string',
			required: true,
			extractionHints: ['Schedule E', 'deed', 'lease']
		},
		{
			name: 'propertyType',
			displayName: 'Property Type',
			description: 'Type of rental property',
			type: 'string',
			required: true,
			allowedValues: ['single_family', 'multi_family', 'vacation_rental', 'commercial', 'land'],
			extractionHints: ['Schedule E']
		},
		{
			name: 'rentalDays',
			displayName: 'Days Rented',
			description: 'Number of days property was rented',
			type: 'number',
			required: false,
			extractionHints: ['rental records']
		},
		{
			name: 'personalUseDays',
			displayName: 'Personal Use Days',
			description: 'Number of days used personally',
			type: 'number',
			required: false,
			extractionHints: ['records']
		},
		{
			name: 'grossRents',
			displayName: 'Gross Rents',
			description: 'Total rental income received',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule E Line 3', 'rental deposits']
		},
		{
			name: 'advertising',
			displayName: 'Advertising',
			description: 'Advertising expenses',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule E Line 5']
		},
		{
			name: 'insurance',
			displayName: 'Insurance',
			description: 'Property insurance',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule E Line 9']
		},
		{
			name: 'mortgageInterest',
			displayName: 'Mortgage Interest',
			description: 'Mortgage interest paid',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['1098', 'Schedule E Line 12']
		},
		{
			name: 'repairs',
			displayName: 'Repairs',
			description: 'Repair and maintenance expenses',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule E Line 14']
		},
		{
			name: 'propertyTaxes',
			displayName: 'Property Taxes',
			description: 'Real estate taxes',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule E Line 16', 'tax bill']
		},
		{
			name: 'utilities',
			displayName: 'Utilities',
			description: 'Utilities paid by landlord',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule E Line 17']
		},
		{
			name: 'depreciation',
			displayName: 'Depreciation',
			description: 'Depreciation expense',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule E Line 18', 'Form 4562']
		},
		{
			name: 'propertyBasis',
			displayName: 'Property Basis',
			description: 'Cost basis of property for depreciation',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['closing statement', 'purchase price']
		},
		{
			name: 'netRentalIncome',
			displayName: 'Net Rental Income',
			description: 'Net income (or loss) from rental',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule E Line 21']
		}
	]
};

const deductionEntity: EntityDefinition = {
	name: 'Deduction',
	displayName: 'Tax Deductions',
	description: 'Itemized and above-the-line deductions',
	category: 'deduction',
	allowMultiple: false,
	attributes: [
		{
			name: 'deductionMethod',
			displayName: 'Deduction Method',
			description: 'Standard or itemized deductions',
			type: 'string',
			required: true,
			allowedValues: ['standard', 'itemized'],
			extractionHints: ['Schedule A', 'Form 1040']
		},
		{
			name: 'standardDeductionAmount',
			displayName: 'Standard Deduction Amount',
			description: 'Standard deduction amount if applicable',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040 instructions', 'based on filing status']
		},
		// Itemized deductions (Schedule A)
		{
			name: 'medicalExpenses',
			displayName: 'Medical & Dental Expenses',
			description: 'Medical expenses exceeding 7.5% of AGI',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule A Line 4', 'medical receipts']
		},
		{
			name: 'stateLocalTaxes',
			displayName: 'State and Local Taxes (SALT)',
			description: 'State/local income or sales tax plus property taxes (max $10,000)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule A Line 5d', 'W-2 Box 17', 'property tax bills']
		},
		{
			name: 'mortgageInterest',
			displayName: 'Mortgage Interest',
			description: 'Home mortgage interest paid',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1098', 'Schedule A Line 8a']
		},
		{
			name: 'charitableCash',
			displayName: 'Cash Charitable Contributions',
			description: 'Cash donations to qualified charities',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['donation receipts', 'Schedule A Line 11']
		},
		{
			name: 'charitableNonCash',
			displayName: 'Non-Cash Charitable Contributions',
			description: 'Property donated to charities',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 8283', 'donation receipts']
		},
		{
			name: 'casualtyLosses',
			displayName: 'Casualty & Theft Losses',
			description: 'Federally declared disaster losses',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 4684']
		},
		// Above-the-line deductions
		{
			name: 'educatorExpenses',
			displayName: 'Educator Expenses',
			description: 'Classroom expenses for K-12 educators (up to $300)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040 Schedule 1 Line 11']
		},
		{
			name: 'hsaContributions',
			displayName: 'HSA Contributions',
			description: 'Health Savings Account contributions',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 8889', 'W-2 Box 12 code W']
		},
		{
			name: 'studentLoanInterest',
			displayName: 'Student Loan Interest',
			description: 'Student loan interest paid (up to $2,500)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1098-E']
		},
		{
			name: 'traditionalIRAContributions',
			displayName: 'Traditional IRA Contributions',
			description: 'Deductible traditional IRA contributions',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 5498', 'brokerage statement']
		},
		{
			name: 'sepSimpleContributions',
			displayName: 'SEP/SIMPLE Contributions',
			description: 'Self-employed retirement plan contributions',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 5498', 'plan statement']
		},
		{
			name: 'alimonyPaid',
			displayName: 'Alimony Paid',
			description: 'Alimony paid (for divorces before 2019)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['divorce decree', 'payment records']
		}
	]
};

const taxCreditEntity: EntityDefinition = {
	name: 'TaxCredit',
	displayName: 'Tax Credits',
	description: 'Federal tax credits',
	category: 'credit',
	allowMultiple: false,
	attributes: [
		{
			name: 'childTaxCredit',
			displayName: 'Child Tax Credit',
			description: 'Credit for qualifying children under 17',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule 8812', 'Form 1040']
		},
		{
			name: 'otherDependentCredit',
			displayName: 'Credit for Other Dependents',
			description: 'Credit for dependents who dont qualify for CTC',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule 8812']
		},
		{
			name: 'childDependentCareCredit',
			displayName: 'Child & Dependent Care Credit',
			description: 'Credit for childcare expenses',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 2441']
		},
		{
			name: 'childcareExpenses',
			displayName: 'Childcare Expenses Paid',
			description: 'Total childcare expenses paid',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['daycare receipts', 'Form W-10']
		},
		{
			name: 'earnedIncomeCredit',
			displayName: 'Earned Income Tax Credit',
			description: 'EITC for lower income workers',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule EIC']
		},
		{
			name: 'americanOpportunityCredit',
			displayName: 'American Opportunity Credit',
			description: 'Education credit for first 4 years of college',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 8863', 'Form 1098-T']
		},
		{
			name: 'lifetimeLearningCredit',
			displayName: 'Lifetime Learning Credit',
			description: 'Education credit for any higher education',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 8863', 'Form 1098-T']
		},
		{
			name: 'educationExpenses',
			displayName: 'Qualified Education Expenses',
			description: 'Tuition and fees paid',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1098-T Box 1']
		},
		{
			name: 'saverCredit',
			displayName: 'Retirement Savings Credit',
			description: 'Credit for low/moderate income retirement contributions',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 8880']
		},
		{
			name: 'foreignTaxCredit',
			displayName: 'Foreign Tax Credit',
			description: 'Credit for foreign taxes paid',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1116', '1099-DIV Box 7']
		},
		{
			name: 'residentialEnergyCredit',
			displayName: 'Residential Energy Credit',
			description: 'Credit for energy-efficient home improvements',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 5695', 'contractor invoices']
		},
		{
			name: 'electricVehicleCredit',
			displayName: 'Clean Vehicle Credit',
			description: 'Credit for electric/clean vehicles',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 8936', 'dealer documentation']
		},
		{
			name: 'adoptionCredit',
			displayName: 'Adoption Credit',
			description: 'Credit for qualified adoption expenses',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 8839']
		}
	]
};

const estimatedTaxEntity: EntityDefinition = {
	name: 'EstimatedTax',
	displayName: 'Estimated Tax Payments',
	description: 'Quarterly estimated tax payments',
	category: 'payment',
	allowMultiple: false,
	attributes: [
		{
			name: 'q1Payment',
			displayName: 'Q1 Payment (April 15)',
			description: 'First quarter estimated payment',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040-ES', 'bank records']
		},
		{
			name: 'q1Date',
			displayName: 'Q1 Payment Date',
			description: 'Date Q1 payment was made',
			type: 'date',
			required: false,
			extractionHints: ['bank records', 'IRS account']
		},
		{
			name: 'q2Payment',
			displayName: 'Q2 Payment (June 15)',
			description: 'Second quarter estimated payment',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040-ES', 'bank records']
		},
		{
			name: 'q2Date',
			displayName: 'Q2 Payment Date',
			description: 'Date Q2 payment was made',
			type: 'date',
			required: false,
			extractionHints: ['bank records', 'IRS account']
		},
		{
			name: 'q3Payment',
			displayName: 'Q3 Payment (September 15)',
			description: 'Third quarter estimated payment',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040-ES', 'bank records']
		},
		{
			name: 'q3Date',
			displayName: 'Q3 Payment Date',
			description: 'Date Q3 payment was made',
			type: 'date',
			required: false,
			extractionHints: ['bank records', 'IRS account']
		},
		{
			name: 'q4Payment',
			displayName: 'Q4 Payment (January 15)',
			description: 'Fourth quarter estimated payment',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040-ES', 'bank records']
		},
		{
			name: 'q4Date',
			displayName: 'Q4 Payment Date',
			description: 'Date Q4 payment was made',
			type: 'date',
			required: false,
			extractionHints: ['bank records', 'IRS account']
		},
		{
			name: 'totalEstimatedPayments',
			displayName: 'Total Estimated Payments',
			description: 'Sum of all estimated payments for the year',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['sum of quarters', 'IRS account']
		},
		{
			name: 'priorYearOverpaymentApplied',
			displayName: 'Prior Year Overpayment Applied',
			description: 'Amount from prior year refund applied to current year',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['prior year return', 'IRS account']
		}
	]
};

const taxSummaryEntity: EntityDefinition = {
	name: 'TaxSummary',
	displayName: 'Tax Summary',
	description: 'Calculated tax amounts and final liability',
	category: 'summary',
	allowMultiple: false,
	attributes: [
		{
			name: 'taxYear',
			displayName: 'Tax Year',
			description: 'Tax year being planned for',
			type: 'number',
			required: true,
			extractionHints: ['dialog', 'current year']
		},
		{
			name: 'grossIncome',
			displayName: 'Gross Income',
			description: 'Total income before adjustments',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['calculated']
		},
		{
			name: 'adjustedGrossIncome',
			displayName: 'Adjusted Gross Income (AGI)',
			description: 'Income after above-the-line deductions',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040 Line 11', 'calculated']
		},
		{
			name: 'taxableIncome',
			displayName: 'Taxable Income',
			description: 'Income after deductions',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040 Line 15', 'calculated']
		},
		{
			name: 'regularTax',
			displayName: 'Regular Tax',
			description: 'Tax from tax tables/rate schedules',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040 Line 16', 'calculated']
		},
		{
			name: 'alternativeMinimumTax',
			displayName: 'Alternative Minimum Tax',
			description: 'AMT if applicable',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 6251']
		},
		{
			name: 'selfEmploymentTax',
			displayName: 'Self-Employment Tax',
			description: 'SE tax on business income',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Schedule SE']
		},
		{
			name: 'totalTax',
			displayName: 'Total Tax',
			description: 'Total tax liability',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040 Line 24', 'calculated']
		},
		{
			name: 'totalCredits',
			displayName: 'Total Credits',
			description: 'Sum of all tax credits',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['calculated']
		},
		{
			name: 'totalPayments',
			displayName: 'Total Payments',
			description: 'Withholding plus estimated payments',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040 Line 33', 'calculated']
		},
		{
			name: 'refundOrOwed',
			displayName: 'Refund or Amount Owed',
			description: 'Final refund (positive) or balance due (negative)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Form 1040 Lines 34-37', 'calculated']
		},
		{
			name: 'effectiveTaxRate',
			displayName: 'Effective Tax Rate',
			description: 'Total tax / Taxable income',
			type: 'percentage',
			required: false,
			extractionHints: ['calculated']
		},
		{
			name: 'marginalTaxBracket',
			displayName: 'Marginal Tax Bracket',
			description: 'Highest tax bracket',
			type: 'percentage',
			required: false,
			extractionHints: ['based on taxable income']
		}
	]
};

const taxProfessionalEntity: EntityDefinition = {
	name: 'TaxProfessional',
	displayName: 'Tax Professional',
	description: 'CPA, enrolled agent, or tax preparer',
	category: 'contact',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Name',
			description: 'Tax professional name',
			type: 'string',
			required: true,
			extractionHints: ['tax return', 'business card']
		},
		{
			name: 'firm',
			displayName: 'Firm Name',
			description: 'Accounting firm name',
			type: 'string',
			required: false,
			extractionHints: ['tax return', 'invoice']
		},
		{
			name: 'credentials',
			displayName: 'Credentials',
			description: 'Professional credentials',
			type: 'string',
			required: false,
			allowedValues: ['cpa', 'enrolled_agent', 'tax_attorney', 'annual_filing_season'],
			extractionHints: ['business card', 'website']
		},
		{
			name: 'ptin',
			displayName: 'PTIN',
			description: 'Preparer Tax Identification Number',
			type: 'string',
			required: false,
			extractionHints: ['tax return preparer section']
		},
		{
			name: 'phone',
			displayName: 'Phone',
			description: 'Contact phone number',
			type: 'string',
			required: false,
			extractionHints: ['business card', 'website']
		},
		{
			name: 'email',
			displayName: 'Email',
			description: 'Contact email',
			type: 'string',
			required: false,
			extractionHints: ['business card', 'website']
		},
		{
			name: 'address',
			displayName: 'Address',
			description: 'Office address',
			type: 'string',
			required: false,
			extractionHints: ['tax return', 'invoice']
		},
		{
			name: 'yearlyFee',
			displayName: 'Yearly Fee',
			description: 'Annual tax preparation fee',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['invoice', 'dialog']
		}
	]
};

const validationRules: ValidationRule[] = [
	{
		id: 'salt-cap',
		name: 'SALT Deduction Cap',
		description: 'State and local tax deduction is capped at $10,000',
		expression: 'Deduction.stateLocalTaxes <= 10000',
		severity: 'warning',
		message: 'State and local tax deduction is limited to $10,000'
	},
	{
		id: 'ira-contribution-limit',
		name: 'IRA Contribution Limit',
		description: 'Traditional IRA contributions have annual limits',
		expression: 'Deduction.traditionalIRAContributions <= 7000',
		severity: 'error',
		message: 'IRA contribution limit exceeded (limit: $7,000, $8,000 if 50+)'
	},
	{
		id: 'hsa-eligibility',
		name: 'HSA Eligibility',
		description: 'HSA contributions require HDHP coverage',
		expression: 'Deduction.hsaContributions > 0 IMPLIES hasHDHP = true',
		severity: 'error',
		message: 'HSA contributions require enrollment in a High Deductible Health Plan'
	},
	{
		id: 'estimated-tax-safe-harbor',
		name: 'Estimated Tax Safe Harbor',
		description: 'Check if estimated payments meet safe harbor',
		expression: 'EstimatedTax.totalEstimatedPayments + totalWithholding >= 0.9 * TaxSummary.totalTax OR EstimatedTax.totalEstimatedPayments + totalWithholding >= priorYearTax',
		severity: 'warning',
		message: 'Estimated tax payments may be insufficient - penalty may apply'
	},
	{
		id: 'amt-check',
		name: 'AMT Risk Check',
		description: 'Check for high-risk AMT situations',
		expression: 'Deduction.stateLocalTaxes > 5000 OR hasISO = true',
		severity: 'info',
		message: 'Consider calculating AMT - you may have high-risk factors'
	},
	{
		id: 'qbi-deduction',
		name: 'QBI Deduction Eligibility',
		description: 'Self-employed may qualify for 20% QBI deduction',
		expression: 'BusinessIncome.netProfit > 0',
		severity: 'info',
		message: 'You may qualify for the 20% Qualified Business Income (QBI) deduction'
	},
	{
		id: 'child-tax-credit-age',
		name: 'Child Tax Credit Age Check',
		description: 'Children must be under 17 for CTC',
		expression: 'Dependent.qualifiesForChildTaxCredit = true IMPLIES age(Dependent.birthDate) < 17',
		severity: 'error',
		message: 'Child must be under 17 at end of year to qualify for Child Tax Credit'
	}
];

export const taxPlanningSchema: DomainSchema = {
	id: 'tax-planning-v1',
	domain: 'tax_planning',
	name: 'Tax Planning',
	version: '1.0.0',
	description: 'Schema for tax planning including income, deductions, credits, and estimated payments',

	entities: [
		taxFilerEntity,
		dependentEntity,
		w2IncomeEntity,
		businessIncomeEntity,
		investmentIncomeEntity,
		rentalIncomeEntity,
		deductionEntity,
		taxCreditEntity,
		estimatedTaxEntity,
		taxSummaryEntity,
		taxProfessionalEntity
	],

	relationships: [
		{
			name: 'hasDependents',
			fromEntity: 'TaxFiler',
			toEntity: 'Dependent',
			cardinality: 'one-to-many',
			description: 'Tax filer has dependents'
		},
		{
			name: 'hasW2Income',
			fromEntity: 'TaxFiler',
			toEntity: 'W2Income',
			cardinality: 'one-to-many',
			description: 'Tax filer has W-2 income sources'
		},
		{
			name: 'hasBusinessIncome',
			fromEntity: 'TaxFiler',
			toEntity: 'BusinessIncome',
			cardinality: 'one-to-many',
			description: 'Tax filer has self-employment income'
		},
		{
			name: 'hasInvestmentIncome',
			fromEntity: 'TaxFiler',
			toEntity: 'InvestmentIncome',
			cardinality: 'one-to-many',
			description: 'Tax filer has investment income'
		},
		{
			name: 'hasRentalIncome',
			fromEntity: 'TaxFiler',
			toEntity: 'RentalIncome',
			cardinality: 'one-to-many',
			description: 'Tax filer has rental income'
		},
		{
			name: 'hasDeductions',
			fromEntity: 'TaxFiler',
			toEntity: 'Deduction',
			cardinality: 'one-to-one',
			description: 'Tax filer has deductions'
		},
		{
			name: 'hasCredits',
			fromEntity: 'TaxFiler',
			toEntity: 'TaxCredit',
			cardinality: 'one-to-one',
			description: 'Tax filer has tax credits'
		},
		{
			name: 'hasEstimatedPayments',
			fromEntity: 'TaxFiler',
			toEntity: 'EstimatedTax',
			cardinality: 'one-to-one',
			description: 'Tax filer has estimated tax payments'
		},
		{
			name: 'hasTaxSummary',
			fromEntity: 'TaxFiler',
			toEntity: 'TaxSummary',
			cardinality: 'one-to-one',
			description: 'Tax filer has tax summary'
		},
		{
			name: 'usesTaxProfessional',
			fromEntity: 'TaxFiler',
			toEntity: 'TaxProfessional',
			cardinality: 'many-to-many',
			description: 'Tax filer uses tax professional'
		}
	],

	validationRules,

	requiredFacts: [
		'TaxFiler.name',
		'TaxFiler.filingStatus',
		'TaxFiler.birthDate',
		'TaxFiler.state',
		'TaxSummary.taxYear'
	],

	exportTemplates: [
		{
			id: 'tax-summary',
			name: 'Tax Summary',
			format: 'pdf',
			description: 'Overview of income, deductions, credits, and estimated liability',
			includedEntities: ['TaxFiler', 'TaxSummary', 'Deduction', 'TaxCredit']
		},
		{
			id: 'income-summary',
			name: 'Income Summary',
			format: 'csv',
			description: 'All income sources in spreadsheet format',
			includedEntities: ['W2Income', 'BusinessIncome', 'InvestmentIncome', 'RentalIncome'],
			csvColumns: [
				{ header: 'Source', factPath: 'employerName|businessName|accountName|propertyAddress' },
				{ header: 'Type', factPath: 'entity.name' },
				{ header: 'Gross Amount', factPath: 'wagesTipsOther|grossReceipts|ordinaryDividends|grossRents' },
				{ header: 'Net Amount', factPath: 'wagesTipsOther|netProfit|longTermCapitalGains|netRentalIncome' }
			]
		},
		{
			id: 'document-checklist',
			name: 'Document Checklist',
			format: 'markdown',
			description: 'List of tax documents needed with status',
			includedEntities: ['W2Income', 'InvestmentIncome', 'Deduction']
		},
		{
			id: 'estimated-tax-schedule',
			name: 'Estimated Tax Schedule',
			format: 'pdf',
			description: 'Quarterly estimated payment schedule',
			includedEntities: ['EstimatedTax', 'TaxSummary']
		},
		{
			id: 'professional-verification',
			name: 'Facts for CPA Review',
			format: 'json',
			description: 'All extracted facts for tax professional verification',
			includedEntities: ['TaxFiler', 'Dependent', 'W2Income', 'BusinessIncome', 'InvestmentIncome', 'RentalIncome', 'Deduction', 'TaxCredit']
		}
	],

	createdAt: '2024-01-01T00:00:00Z',
	updatedAt: '2024-01-01T00:00:00Z',
	isBuiltIn: true
};
