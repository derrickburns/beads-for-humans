import type { DomainSchema, EntityDefinition, ValidationRule } from '$lib/types/facts';

// ============================================
// DEBT MANAGEMENT DOMAIN SCHEMA
// ============================================

const debtorEntity: EntityDefinition = {
	name: 'Debtor',
	displayName: 'Debtor',
	description: 'Individual managing debt',
	category: 'identity',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Full Name',
			description: 'Legal name',
			type: 'string',
			required: true,
			extractionHints: ['credit report', 'loan documents']
		},
		{
			name: 'ssn',
			displayName: 'Social Security Number',
			description: 'SSN for credit report pulls',
			type: 'string',
			required: false,
			pattern: '^\\d{3}-\\d{2}-\\d{4}$',
			extractionHints: ['credit report']
		},
		{
			name: 'creditScore',
			displayName: 'Credit Score',
			description: 'Current credit score (FICO or VantageScore)',
			type: 'number',
			required: false,
			min: 300,
			max: 850,
			extractionHints: ['credit report', 'credit monitoring service']
		},
		{
			name: 'creditScoreDate',
			displayName: 'Credit Score Date',
			description: 'Date credit score was pulled',
			type: 'date',
			required: false,
			extractionHints: ['credit report']
		},
		{
			name: 'monthlyIncome',
			displayName: 'Monthly Gross Income',
			description: 'Total monthly income before taxes',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['paystub', 'tax return', 'dialog']
		},
		{
			name: 'monthlyTakeHome',
			displayName: 'Monthly Take-Home Pay',
			description: 'Monthly income after taxes and deductions',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['paystub', 'bank statement']
		},
		{
			name: 'monthlyExpenses',
			displayName: 'Monthly Fixed Expenses',
			description: 'Total monthly fixed expenses (excluding debt payments)',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['budget', 'dialog']
		},
		{
			name: 'emergencyFund',
			displayName: 'Emergency Fund Balance',
			description: 'Current emergency savings',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['bank statement', 'dialog']
		}
	]
};

const creditCardEntity: EntityDefinition = {
	name: 'CreditCard',
	displayName: 'Credit Card',
	description: 'Credit card debt',
	category: 'debt',
	allowMultiple: true,
	identifierAttribute: 'cardName',
	attributes: [
		{
			name: 'cardName',
			displayName: 'Card Name',
			description: 'Descriptive name for this card',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'card itself']
		},
		{
			name: 'issuer',
			displayName: 'Card Issuer',
			description: 'Bank or company that issued the card',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'card']
		},
		{
			name: 'accountNumber',
			displayName: 'Account Number (Last 4)',
			description: 'Last 4 digits of account number',
			type: 'string',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'currentBalance',
			displayName: 'Current Balance',
			description: 'Outstanding balance on the card',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement', 'online account']
		},
		{
			name: 'creditLimit',
			displayName: 'Credit Limit',
			description: 'Maximum credit available',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'apr',
			displayName: 'Annual Percentage Rate',
			description: 'Current APR on purchases',
			type: 'percentage',
			required: true,
			extractionHints: ['statement', 'rate section']
		},
		{
			name: 'penaltyApr',
			displayName: 'Penalty APR',
			description: 'APR if payment is late',
			type: 'percentage',
			required: false,
			extractionHints: ['terms', 'statement']
		},
		{
			name: 'introApr',
			displayName: 'Introductory APR',
			description: 'Promotional APR if applicable',
			type: 'percentage',
			required: false,
			extractionHints: ['statement', 'offer terms']
		},
		{
			name: 'introAprExpires',
			displayName: 'Intro APR Expiration',
			description: 'Date promotional rate expires',
			type: 'date',
			required: false,
			extractionHints: ['statement', 'offer terms']
		},
		{
			name: 'minimumPayment',
			displayName: 'Minimum Payment',
			description: 'Minimum payment due',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'paymentDueDate',
			displayName: 'Payment Due Date',
			description: 'Day of month payment is due',
			type: 'number',
			required: false,
			min: 1,
			max: 31,
			extractionHints: ['statement']
		},
		{
			name: 'annualFee',
			displayName: 'Annual Fee',
			description: 'Yearly fee for the card',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statement', 'terms']
		},
		{
			name: 'lastPaymentAmount',
			displayName: 'Last Payment Amount',
			description: 'Amount of last payment made',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'lastPaymentDate',
			displayName: 'Last Payment Date',
			description: 'Date of last payment',
			type: 'date',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'utilizationRate',
			displayName: 'Utilization Rate',
			description: 'Balance / Credit Limit percentage',
			type: 'percentage',
			required: false,
			extractionHints: ['calculated']
		},
		{
			name: 'hasBalanceTransferOffer',
			displayName: 'Balance Transfer Offer Available',
			description: 'Whether a balance transfer offer is available',
			type: 'boolean',
			required: false,
			extractionHints: ['statement', 'email offers']
		},
		{
			name: 'balanceTransferFee',
			displayName: 'Balance Transfer Fee',
			description: 'Fee percentage for balance transfers',
			type: 'percentage',
			required: false,
			extractionHints: ['terms', 'offer']
		}
	]
};

const personalLoanEntity: EntityDefinition = {
	name: 'PersonalLoan',
	displayName: 'Personal Loan',
	description: 'Unsecured personal loan',
	category: 'debt',
	allowMultiple: true,
	identifierAttribute: 'loanName',
	attributes: [
		{
			name: 'loanName',
			displayName: 'Loan Name',
			description: 'Descriptive name for this loan',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'dialog']
		},
		{
			name: 'lender',
			displayName: 'Lender',
			description: 'Financial institution or lender',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'loan documents']
		},
		{
			name: 'accountNumber',
			displayName: 'Account Number',
			description: 'Loan account number',
			type: 'string',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'originalAmount',
			displayName: 'Original Loan Amount',
			description: 'Amount originally borrowed',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['loan documents', 'statement']
		},
		{
			name: 'currentBalance',
			displayName: 'Current Balance',
			description: 'Outstanding principal balance',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement', 'online account']
		},
		{
			name: 'interestRate',
			displayName: 'Interest Rate',
			description: 'Annual interest rate',
			type: 'percentage',
			required: true,
			extractionHints: ['statement', 'loan documents']
		},
		{
			name: 'isFixedRate',
			displayName: 'Fixed Rate',
			description: 'Whether rate is fixed or variable',
			type: 'boolean',
			required: false,
			extractionHints: ['loan documents']
		},
		{
			name: 'monthlyPayment',
			displayName: 'Monthly Payment',
			description: 'Required monthly payment',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'paymentDueDate',
			displayName: 'Payment Due Date',
			description: 'Day of month payment is due',
			type: 'number',
			required: false,
			min: 1,
			max: 31,
			extractionHints: ['statement']
		},
		{
			name: 'loanTerm',
			displayName: 'Loan Term (Months)',
			description: 'Total loan term in months',
			type: 'number',
			required: false,
			extractionHints: ['loan documents']
		},
		{
			name: 'remainingTerm',
			displayName: 'Remaining Term (Months)',
			description: 'Months remaining on loan',
			type: 'number',
			required: false,
			extractionHints: ['statement', 'calculated']
		},
		{
			name: 'originationDate',
			displayName: 'Origination Date',
			description: 'Date loan was originated',
			type: 'date',
			required: false,
			extractionHints: ['loan documents']
		},
		{
			name: 'maturityDate',
			displayName: 'Maturity Date',
			description: 'Date loan will be paid off',
			type: 'date',
			required: false,
			extractionHints: ['loan documents', 'statement']
		},
		{
			name: 'purpose',
			displayName: 'Loan Purpose',
			description: 'What the loan was used for',
			type: 'string',
			required: false,
			allowedValues: ['debt_consolidation', 'home_improvement', 'medical', 'wedding', 'vacation', 'major_purchase', 'other'],
			extractionHints: ['loan application', 'dialog']
		},
		{
			name: 'prepaymentPenalty',
			displayName: 'Prepayment Penalty',
			description: 'Whether early payoff has a penalty',
			type: 'boolean',
			required: false,
			extractionHints: ['loan documents']
		},
		{
			name: 'originationFee',
			displayName: 'Origination Fee',
			description: 'Fee paid at loan origination',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['loan documents']
		}
	]
};

const studentLoanEntity: EntityDefinition = {
	name: 'StudentLoan',
	displayName: 'Student Loan',
	description: 'Federal or private student loan',
	category: 'debt',
	allowMultiple: true,
	identifierAttribute: 'loanName',
	attributes: [
		{
			name: 'loanName',
			displayName: 'Loan Name',
			description: 'Descriptive name for this loan',
			type: 'string',
			required: true,
			extractionHints: ['studentaid.gov', 'servicer statement']
		},
		{
			name: 'servicer',
			displayName: 'Loan Servicer',
			description: 'Company servicing the loan',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'studentaid.gov']
		},
		{
			name: 'loanType',
			displayName: 'Loan Type',
			description: 'Type of student loan',
			type: 'string',
			required: true,
			allowedValues: ['direct_subsidized', 'direct_unsubsidized', 'direct_plus', 'perkins', 'ffel_subsidized', 'ffel_unsubsidized', 'private'],
			extractionHints: ['studentaid.gov', 'loan documents']
		},
		{
			name: 'originalAmount',
			displayName: 'Original Loan Amount',
			description: 'Amount originally borrowed',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['loan documents']
		},
		{
			name: 'currentBalance',
			displayName: 'Current Balance',
			description: 'Outstanding balance including interest',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement', 'studentaid.gov']
		},
		{
			name: 'principalBalance',
			displayName: 'Principal Balance',
			description: 'Outstanding principal only',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'accruedInterest',
			displayName: 'Accrued Interest',
			description: 'Unpaid interest that has accrued',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'interestRate',
			displayName: 'Interest Rate',
			description: 'Annual interest rate',
			type: 'percentage',
			required: true,
			extractionHints: ['statement', 'studentaid.gov']
		},
		{
			name: 'repaymentPlan',
			displayName: 'Repayment Plan',
			description: 'Current repayment plan',
			type: 'string',
			required: false,
			allowedValues: ['standard', 'graduated', 'extended', 'income_driven_ibr', 'income_driven_paye', 'income_driven_repaye', 'income_driven_icr', 'income_driven_save'],
			extractionHints: ['servicer', 'studentaid.gov']
		},
		{
			name: 'monthlyPayment',
			displayName: 'Monthly Payment',
			description: 'Current monthly payment amount',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'paymentDueDate',
			displayName: 'Payment Due Date',
			description: 'Day of month payment is due',
			type: 'number',
			required: false,
			min: 1,
			max: 31,
			extractionHints: ['statement']
		},
		{
			name: 'inDeferment',
			displayName: 'In Deferment',
			description: 'Whether loan is in deferment',
			type: 'boolean',
			required: false,
			extractionHints: ['servicer', 'statement']
		},
		{
			name: 'inForbearance',
			displayName: 'In Forbearance',
			description: 'Whether loan is in forbearance',
			type: 'boolean',
			required: false,
			extractionHints: ['servicer', 'statement']
		},
		{
			name: 'eligibleForPSLF',
			displayName: 'PSLF Eligible',
			description: 'Whether loan qualifies for Public Service Loan Forgiveness',
			type: 'boolean',
			required: false,
			extractionHints: ['loan type analysis', 'studentaid.gov']
		},
		{
			name: 'pslfPaymentsMade',
			displayName: 'PSLF Qualifying Payments',
			description: 'Number of qualifying PSLF payments made',
			type: 'number',
			required: false,
			extractionHints: ['PSLF tracker', 'studentaid.gov']
		},
		{
			name: 'disbursementDate',
			displayName: 'Disbursement Date',
			description: 'Date loan was disbursed',
			type: 'date',
			required: false,
			extractionHints: ['loan documents']
		}
	]
};

const autoLoanEntity: EntityDefinition = {
	name: 'AutoLoan',
	displayName: 'Auto Loan',
	description: 'Vehicle financing loan',
	category: 'debt',
	allowMultiple: true,
	identifierAttribute: 'loanName',
	attributes: [
		{
			name: 'loanName',
			displayName: 'Loan Name',
			description: 'Descriptive name (e.g., "2022 Honda Civic")',
			type: 'string',
			required: true,
			extractionHints: ['dialog', 'statement']
		},
		{
			name: 'lender',
			displayName: 'Lender',
			description: 'Bank, credit union, or finance company',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'loan documents']
		},
		{
			name: 'accountNumber',
			displayName: 'Account Number',
			description: 'Loan account number',
			type: 'string',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'vehicleYear',
			displayName: 'Vehicle Year',
			description: 'Model year of vehicle',
			type: 'number',
			required: false,
			extractionHints: ['registration', 'loan documents']
		},
		{
			name: 'vehicleMake',
			displayName: 'Vehicle Make',
			description: 'Manufacturer of vehicle',
			type: 'string',
			required: false,
			extractionHints: ['registration', 'loan documents']
		},
		{
			name: 'vehicleModel',
			displayName: 'Vehicle Model',
			description: 'Model name of vehicle',
			type: 'string',
			required: false,
			extractionHints: ['registration', 'loan documents']
		},
		{
			name: 'vin',
			displayName: 'VIN',
			description: 'Vehicle Identification Number',
			type: 'string',
			required: false,
			extractionHints: ['registration', 'loan documents']
		},
		{
			name: 'originalAmount',
			displayName: 'Original Loan Amount',
			description: 'Amount financed',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['loan documents']
		},
		{
			name: 'currentBalance',
			displayName: 'Current Balance',
			description: 'Outstanding loan balance',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement', 'online account']
		},
		{
			name: 'interestRate',
			displayName: 'Interest Rate',
			description: 'Annual interest rate',
			type: 'percentage',
			required: true,
			extractionHints: ['statement', 'loan documents']
		},
		{
			name: 'monthlyPayment',
			displayName: 'Monthly Payment',
			description: 'Required monthly payment',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'paymentDueDate',
			displayName: 'Payment Due Date',
			description: 'Day of month payment is due',
			type: 'number',
			required: false,
			min: 1,
			max: 31,
			extractionHints: ['statement']
		},
		{
			name: 'loanTerm',
			displayName: 'Loan Term (Months)',
			description: 'Total loan term in months',
			type: 'number',
			required: false,
			extractionHints: ['loan documents']
		},
		{
			name: 'remainingTerm',
			displayName: 'Remaining Term (Months)',
			description: 'Months remaining on loan',
			type: 'number',
			required: false,
			extractionHints: ['statement', 'calculated']
		},
		{
			name: 'maturityDate',
			displayName: 'Maturity Date',
			description: 'Date loan will be paid off',
			type: 'date',
			required: false,
			extractionHints: ['loan documents', 'statement']
		},
		{
			name: 'estimatedVehicleValue',
			displayName: 'Estimated Vehicle Value',
			description: 'Current market value of vehicle',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['KBB', 'Edmunds', 'NADA']
		},
		{
			name: 'isUpsideDown',
			displayName: 'Upside Down',
			description: 'Whether balance exceeds vehicle value',
			type: 'boolean',
			required: false,
			extractionHints: ['calculated']
		}
	]
};

const mortgageEntity: EntityDefinition = {
	name: 'Mortgage',
	displayName: 'Mortgage',
	description: 'Home mortgage loan',
	category: 'debt',
	allowMultiple: true,
	identifierAttribute: 'propertyAddress',
	attributes: [
		{
			name: 'propertyAddress',
			displayName: 'Property Address',
			description: 'Address of mortgaged property',
			type: 'string',
			required: true,
			extractionHints: ['statement', 'loan documents']
		},
		{
			name: 'lender',
			displayName: 'Lender/Servicer',
			description: 'Current mortgage servicer',
			type: 'string',
			required: true,
			extractionHints: ['statement']
		},
		{
			name: 'accountNumber',
			displayName: 'Loan Number',
			description: 'Mortgage loan number',
			type: 'string',
			required: false,
			extractionHints: ['statement']
		},
		{
			name: 'loanType',
			displayName: 'Loan Type',
			description: 'Type of mortgage',
			type: 'string',
			required: true,
			allowedValues: ['conventional', 'fha', 'va', 'usda', 'jumbo', 'heloc', 'home_equity'],
			extractionHints: ['loan documents', 'statement']
		},
		{
			name: 'originalAmount',
			displayName: 'Original Loan Amount',
			description: 'Amount originally borrowed',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['loan documents', 'closing disclosure']
		},
		{
			name: 'currentBalance',
			displayName: 'Current Balance',
			description: 'Outstanding principal balance',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'interestRate',
			displayName: 'Interest Rate',
			description: 'Current interest rate',
			type: 'percentage',
			required: true,
			extractionHints: ['statement']
		},
		{
			name: 'isFixedRate',
			displayName: 'Fixed Rate',
			description: 'Whether rate is fixed or adjustable',
			type: 'boolean',
			required: true,
			extractionHints: ['loan documents']
		},
		{
			name: 'armAdjustmentDate',
			displayName: 'ARM Adjustment Date',
			description: 'Next rate adjustment date for ARM loans',
			type: 'date',
			required: false,
			extractionHints: ['statement', 'loan documents']
		},
		{
			name: 'monthlyPayment',
			displayName: 'Monthly P&I Payment',
			description: 'Principal and interest payment',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'monthlyEscrow',
			displayName: 'Monthly Escrow',
			description: 'Taxes and insurance escrow amount',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'totalMonthlyPayment',
			displayName: 'Total Monthly Payment',
			description: 'P&I plus escrow',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		},
		{
			name: 'paymentDueDate',
			displayName: 'Payment Due Date',
			description: 'Day of month payment is due',
			type: 'number',
			required: false,
			min: 1,
			max: 31,
			extractionHints: ['statement']
		},
		{
			name: 'loanTerm',
			displayName: 'Loan Term (Years)',
			description: 'Original loan term in years',
			type: 'number',
			required: false,
			allowedValues: ['10', '15', '20', '25', '30'],
			extractionHints: ['loan documents']
		},
		{
			name: 'originationDate',
			displayName: 'Origination Date',
			description: 'Date mortgage was originated',
			type: 'date',
			required: false,
			extractionHints: ['loan documents']
		},
		{
			name: 'maturityDate',
			displayName: 'Maturity Date',
			description: 'Date mortgage will be paid off',
			type: 'date',
			required: false,
			extractionHints: ['loan documents', 'statement']
		},
		{
			name: 'estimatedHomeValue',
			displayName: 'Estimated Home Value',
			description: 'Current estimated property value',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['Zillow', 'Redfin', 'appraisal']
		},
		{
			name: 'ltvRatio',
			displayName: 'Loan-to-Value Ratio',
			description: 'Current LTV percentage',
			type: 'percentage',
			required: false,
			extractionHints: ['calculated']
		},
		{
			name: 'pmiRequired',
			displayName: 'PMI Required',
			description: 'Whether PMI is currently required',
			type: 'boolean',
			required: false,
			extractionHints: ['statement', 'LTV analysis']
		},
		{
			name: 'pmiAmount',
			displayName: 'PMI Amount',
			description: 'Monthly PMI payment',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['statement']
		}
	]
};

const medicalDebtEntity: EntityDefinition = {
	name: 'MedicalDebt',
	displayName: 'Medical Debt',
	description: 'Medical bills and healthcare debt',
	category: 'debt',
	allowMultiple: true,
	identifierAttribute: 'providerName',
	attributes: [
		{
			name: 'providerName',
			displayName: 'Provider/Facility Name',
			description: 'Healthcare provider or facility',
			type: 'string',
			required: true,
			extractionHints: ['bill', 'statement']
		},
		{
			name: 'accountNumber',
			displayName: 'Account Number',
			description: 'Patient account number',
			type: 'string',
			required: false,
			extractionHints: ['bill']
		},
		{
			name: 'originalAmount',
			displayName: 'Original Bill Amount',
			description: 'Total amount billed',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['EOB', 'bill']
		},
		{
			name: 'insurancePaid',
			displayName: 'Insurance Paid',
			description: 'Amount covered by insurance',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['EOB']
		},
		{
			name: 'currentBalance',
			displayName: 'Current Balance',
			description: 'Amount still owed',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['bill', 'statement']
		},
		{
			name: 'serviceDate',
			displayName: 'Date of Service',
			description: 'When service was provided',
			type: 'date',
			required: false,
			extractionHints: ['bill', 'EOB']
		},
		{
			name: 'serviceDescription',
			displayName: 'Service Description',
			description: 'Type of medical service',
			type: 'string',
			required: false,
			extractionHints: ['bill', 'EOB']
		},
		{
			name: 'inCollections',
			displayName: 'In Collections',
			description: 'Whether debt has been sent to collections',
			type: 'boolean',
			required: false,
			extractionHints: ['credit report', 'collection notices']
		},
		{
			name: 'collectionAgency',
			displayName: 'Collection Agency',
			description: 'Name of collection agency if applicable',
			type: 'string',
			required: false,
			extractionHints: ['collection letter']
		},
		{
			name: 'paymentPlanAvailable',
			displayName: 'Payment Plan Available',
			description: 'Whether provider offers payment plan',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog with provider']
		},
		{
			name: 'monthlyPaymentAmount',
			displayName: 'Monthly Payment Amount',
			description: 'Amount if on payment plan',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['payment plan agreement']
		},
		{
			name: 'interestRate',
			displayName: 'Interest Rate',
			description: 'Interest rate if applicable',
			type: 'percentage',
			required: false,
			extractionHints: ['payment plan terms']
		},
		{
			name: 'financialAssistanceApplied',
			displayName: 'Financial Assistance Applied',
			description: 'Whether charity care or assistance was applied for',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog', 'application status']
		}
	]
};

const collectionAccountEntity: EntityDefinition = {
	name: 'CollectionAccount',
	displayName: 'Collection Account',
	description: 'Debt sent to collections',
	category: 'debt',
	allowMultiple: true,
	identifierAttribute: 'collectionAgency',
	attributes: [
		{
			name: 'collectionAgency',
			displayName: 'Collection Agency',
			description: 'Name of collection agency',
			type: 'string',
			required: true,
			extractionHints: ['collection letter', 'credit report']
		},
		{
			name: 'originalCreditor',
			displayName: 'Original Creditor',
			description: 'Original company owed',
			type: 'string',
			required: true,
			extractionHints: ['collection letter', 'credit report']
		},
		{
			name: 'accountNumber',
			displayName: 'Account Number',
			description: 'Collection account number',
			type: 'string',
			required: false,
			extractionHints: ['collection letter']
		},
		{
			name: 'originalAmount',
			displayName: 'Original Amount',
			description: 'Amount when sent to collections',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['collection letter', 'credit report']
		},
		{
			name: 'currentBalance',
			displayName: 'Current Balance',
			description: 'Current amount owed including fees/interest',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['collection letter']
		},
		{
			name: 'debtType',
			displayName: 'Debt Type',
			description: 'Type of original debt',
			type: 'string',
			required: false,
			allowedValues: ['credit_card', 'medical', 'utility', 'telecom', 'retail', 'personal_loan', 'other'],
			extractionHints: ['collection letter', 'credit report']
		},
		{
			name: 'dateReported',
			displayName: 'Date Reported',
			description: 'Date collection was reported to credit bureaus',
			type: 'date',
			required: false,
			extractionHints: ['credit report']
		},
		{
			name: 'statusDate',
			displayName: 'Status Date',
			description: 'Date of most recent status update',
			type: 'date',
			required: false,
			extractionHints: ['credit report']
		},
		{
			name: 'statuteOfLimitations',
			displayName: 'Statute of Limitations',
			description: 'Whether debt is past statute of limitations',
			type: 'boolean',
			required: false,
			extractionHints: ['analysis based on state and date']
		},
		{
			name: 'settlementOffered',
			displayName: 'Settlement Offered',
			description: 'Whether a settlement has been offered',
			type: 'boolean',
			required: false,
			extractionHints: ['collection letter', 'dialog']
		},
		{
			name: 'settlementAmount',
			displayName: 'Settlement Amount',
			description: 'Amount offered to settle debt',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['collection letter', 'dialog']
		},
		{
			name: 'disputeStatus',
			displayName: 'Dispute Status',
			description: 'Whether debt has been disputed',
			type: 'string',
			required: false,
			allowedValues: ['not_disputed', 'disputed_pending', 'dispute_resolved', 'removed'],
			extractionHints: ['credit report', 'dispute records']
		}
	]
};

const debtSummaryEntity: EntityDefinition = {
	name: 'DebtSummary',
	displayName: 'Debt Summary',
	description: 'Aggregated debt metrics and payoff strategy',
	category: 'summary',
	allowMultiple: false,
	attributes: [
		{
			name: 'totalDebt',
			displayName: 'Total Debt',
			description: 'Sum of all outstanding debt',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['calculated']
		},
		{
			name: 'totalMinimumPayments',
			displayName: 'Total Minimum Payments',
			description: 'Sum of all minimum monthly payments',
			type: 'currency',
			required: true,
			defaultCurrency: 'USD',
			extractionHints: ['calculated']
		},
		{
			name: 'availableForDebt',
			displayName: 'Available for Debt Payments',
			description: 'Monthly amount available for debt repayment',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['income minus expenses', 'dialog']
		},
		{
			name: 'extraPaymentAmount',
			displayName: 'Extra Payment Amount',
			description: 'Amount above minimums to put toward debt',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['calculated', 'dialog']
		},
		{
			name: 'payoffStrategy',
			displayName: 'Payoff Strategy',
			description: 'Debt payoff method being used',
			type: 'string',
			required: false,
			allowedValues: ['avalanche', 'snowball', 'hybrid', 'consolidation', 'custom'],
			extractionHints: ['dialog']
		},
		{
			name: 'debtToIncomeRatio',
			displayName: 'Debt-to-Income Ratio',
			description: 'Total debt payments / monthly gross income',
			type: 'percentage',
			required: false,
			extractionHints: ['calculated']
		},
		{
			name: 'creditUtilization',
			displayName: 'Credit Utilization',
			description: 'Total credit card balances / total credit limits',
			type: 'percentage',
			required: false,
			extractionHints: ['calculated']
		},
		{
			name: 'projectedPayoffDate',
			displayName: 'Projected Payoff Date',
			description: 'Estimated date to be debt-free',
			type: 'date',
			required: false,
			extractionHints: ['calculated based on strategy']
		},
		{
			name: 'projectedInterestSaved',
			displayName: 'Projected Interest Saved',
			description: 'Interest saved vs minimum payments',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['calculated']
		},
		{
			name: 'highestInterestDebt',
			displayName: 'Highest Interest Debt',
			description: 'Debt with highest interest rate',
			type: 'string',
			required: false,
			extractionHints: ['calculated']
		},
		{
			name: 'smallestBalanceDebt',
			displayName: 'Smallest Balance Debt',
			description: 'Debt with smallest balance',
			type: 'string',
			required: false,
			extractionHints: ['calculated']
		},
		{
			name: 'nextMilestone',
			displayName: 'Next Milestone',
			description: 'Next debt to be paid off',
			type: 'string',
			required: false,
			extractionHints: ['calculated based on strategy']
		},
		{
			name: 'nextMilestoneDate',
			displayName: 'Next Milestone Date',
			description: 'Estimated date of next payoff',
			type: 'date',
			required: false,
			extractionHints: ['calculated']
		}
	]
};

const debtAdvisorEntity: EntityDefinition = {
	name: 'DebtAdvisor',
	displayName: 'Debt Advisor',
	description: 'Credit counselor or financial advisor',
	category: 'contact',
	allowMultiple: true,
	identifierAttribute: 'name',
	attributes: [
		{
			name: 'name',
			displayName: 'Name',
			description: 'Advisor name',
			type: 'string',
			required: true,
			extractionHints: ['dialog', 'paperwork']
		},
		{
			name: 'organization',
			displayName: 'Organization',
			description: 'Credit counseling agency or firm',
			type: 'string',
			required: false,
			extractionHints: ['website', 'paperwork']
		},
		{
			name: 'organizationType',
			displayName: 'Organization Type',
			description: 'Type of organization',
			type: 'string',
			required: false,
			allowedValues: ['nonprofit_credit_counseling', 'debt_settlement', 'bankruptcy_attorney', 'financial_advisor', 'other'],
			extractionHints: ['dialog', 'website']
		},
		{
			name: 'isNFCCMember',
			displayName: 'NFCC Member',
			description: 'Member of National Foundation for Credit Counseling',
			type: 'boolean',
			required: false,
			extractionHints: ['NFCC website']
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
			name: 'enrolledInDMP',
			displayName: 'Enrolled in Debt Management Plan',
			description: 'Whether enrolled in DMP with this agency',
			type: 'boolean',
			required: false,
			extractionHints: ['dialog', 'enrollment paperwork']
		},
		{
			name: 'dmpMonthlyPayment',
			displayName: 'DMP Monthly Payment',
			description: 'Monthly payment amount in DMP',
			type: 'currency',
			required: false,
			defaultCurrency: 'USD',
			extractionHints: ['DMP agreement']
		},
		{
			name: 'dmpStartDate',
			displayName: 'DMP Start Date',
			description: 'Date enrolled in DMP',
			type: 'date',
			required: false,
			extractionHints: ['DMP agreement']
		}
	]
};

const validationRules: ValidationRule[] = [
	{
		id: 'high-credit-utilization',
		name: 'High Credit Utilization Warning',
		description: 'Credit utilization above 30% impacts credit score',
		expression: 'DebtSummary.creditUtilization > 0.30',
		severity: 'warning',
		message: 'Credit utilization is above 30%, which may negatively impact your credit score'
	},
	{
		id: 'very-high-utilization',
		name: 'Very High Credit Utilization',
		description: 'Credit utilization above 50% significantly impacts credit score',
		expression: 'DebtSummary.creditUtilization > 0.50',
		severity: 'error',
		message: 'Credit utilization is above 50%, which significantly impacts your credit score. Consider paying down balances urgently.'
	},
	{
		id: 'high-dti',
		name: 'High Debt-to-Income Ratio',
		description: 'DTI above 43% may make it difficult to get new credit',
		expression: 'DebtSummary.debtToIncomeRatio > 0.43',
		severity: 'warning',
		message: 'Debt-to-income ratio exceeds 43%, which may limit your ability to qualify for new credit'
	},
	{
		id: 'intro-apr-expiring',
		name: 'Intro APR Expiring Soon',
		description: 'Promotional rate expiring within 60 days',
		expression: 'CreditCard.introAprExpires IS_WITHIN 60_DAYS',
		severity: 'warning',
		message: 'Promotional APR is expiring soon. Consider paying down balance or transferring to another card.'
	},
	{
		id: 'arm-adjustment',
		name: 'ARM Adjustment Coming',
		description: 'Adjustable rate mortgage adjustment within 6 months',
		expression: 'Mortgage.armAdjustmentDate IS_WITHIN 180_DAYS',
		severity: 'warning',
		message: 'Your ARM rate is adjusting soon. Consider refinancing to a fixed rate.'
	},
	{
		id: 'pmi-removable',
		name: 'PMI May Be Removable',
		description: 'LTV below 80% may allow PMI removal',
		expression: 'Mortgage.ltvRatio < 0.80 AND Mortgage.pmiRequired = true',
		severity: 'info',
		message: 'Your LTV is below 80%. You may be able to request PMI removal.'
	},
	{
		id: 'upside-down-auto',
		name: 'Upside Down Auto Loan',
		description: 'Vehicle worth less than loan balance',
		expression: 'AutoLoan.isUpsideDown = true',
		severity: 'warning',
		message: 'You owe more than your vehicle is worth. Avoid trading in until balance is paid down.'
	},
	{
		id: 'student-loan-pslf',
		name: 'PSLF Progress Tracking',
		description: 'Track PSLF qualifying payments',
		expression: 'StudentLoan.eligibleForPSLF = true AND StudentLoan.pslfPaymentsMade >= 100',
		severity: 'info',
		message: 'You are approaching PSLF forgiveness eligibility (120 payments required).'
	},
	{
		id: 'no-emergency-fund',
		name: 'No Emergency Fund',
		description: 'Emergency fund below minimum recommended',
		expression: 'Debtor.emergencyFund < 1000',
		severity: 'warning',
		message: 'Consider building a starter emergency fund of $1,000 before aggressive debt payoff'
	},
	{
		id: 'collection-statute',
		name: 'Collection Past Statute',
		description: 'Collection may be past statute of limitations',
		expression: 'CollectionAccount.statuteOfLimitations = true',
		severity: 'info',
		message: 'This debt may be past the statute of limitations. Be careful not to reset the clock with a payment.'
	}
];

export const debtManagementSchema: DomainSchema = {
	id: 'debt-management-v1',
	domain: 'debt_management',
	name: 'Debt Management',
	version: '1.0.0',
	description: 'Schema for tracking and managing debt including credit cards, loans, mortgages, and payoff strategies',

	entities: [
		debtorEntity,
		creditCardEntity,
		personalLoanEntity,
		studentLoanEntity,
		autoLoanEntity,
		mortgageEntity,
		medicalDebtEntity,
		collectionAccountEntity,
		debtSummaryEntity,
		debtAdvisorEntity
	],

	relationships: [
		{
			name: 'hasCreditCards',
			fromEntity: 'Debtor',
			toEntity: 'CreditCard',
			cardinality: 'one-to-many',
			description: 'Debtor has credit card debt'
		},
		{
			name: 'hasPersonalLoans',
			fromEntity: 'Debtor',
			toEntity: 'PersonalLoan',
			cardinality: 'one-to-many',
			description: 'Debtor has personal loans'
		},
		{
			name: 'hasStudentLoans',
			fromEntity: 'Debtor',
			toEntity: 'StudentLoan',
			cardinality: 'one-to-many',
			description: 'Debtor has student loans'
		},
		{
			name: 'hasAutoLoans',
			fromEntity: 'Debtor',
			toEntity: 'AutoLoan',
			cardinality: 'one-to-many',
			description: 'Debtor has auto loans'
		},
		{
			name: 'hasMortgages',
			fromEntity: 'Debtor',
			toEntity: 'Mortgage',
			cardinality: 'one-to-many',
			description: 'Debtor has mortgages'
		},
		{
			name: 'hasMedicalDebt',
			fromEntity: 'Debtor',
			toEntity: 'MedicalDebt',
			cardinality: 'one-to-many',
			description: 'Debtor has medical debt'
		},
		{
			name: 'hasCollections',
			fromEntity: 'Debtor',
			toEntity: 'CollectionAccount',
			cardinality: 'one-to-many',
			description: 'Debtor has accounts in collections'
		},
		{
			name: 'hasDebtSummary',
			fromEntity: 'Debtor',
			toEntity: 'DebtSummary',
			cardinality: 'one-to-one',
			description: 'Debtor has debt summary'
		},
		{
			name: 'worksWithAdvisor',
			fromEntity: 'Debtor',
			toEntity: 'DebtAdvisor',
			cardinality: 'many-to-many',
			description: 'Debtor works with advisor'
		}
	],

	validationRules,

	requiredFacts: [
		'Debtor.name',
		'Debtor.monthlyIncome',
		'Debtor.monthlyTakeHome',
		'DebtSummary.totalDebt',
		'DebtSummary.totalMinimumPayments'
	],

	exportTemplates: [
		{
			id: 'debt-inventory',
			name: 'Debt Inventory',
			format: 'pdf',
			description: 'Complete list of all debts with details',
			includedEntities: ['Debtor', 'CreditCard', 'PersonalLoan', 'StudentLoan', 'AutoLoan', 'Mortgage', 'MedicalDebt', 'CollectionAccount']
		},
		{
			id: 'debt-summary',
			name: 'Debt Summary',
			format: 'pdf',
			description: 'Overview of debt situation and payoff strategy',
			includedEntities: ['Debtor', 'DebtSummary']
		},
		{
			id: 'debt-spreadsheet',
			name: 'Debt Spreadsheet',
			format: 'csv',
			description: 'All debts in spreadsheet format for analysis',
			includedEntities: ['CreditCard', 'PersonalLoan', 'StudentLoan', 'AutoLoan', 'Mortgage', 'MedicalDebt', 'CollectionAccount'],
			csvColumns: [
				{ header: 'Debt Name', factPath: 'cardName|loanName|propertyAddress|providerName|collectionAgency' },
				{ header: 'Type', factPath: 'entity.name' },
				{ header: 'Balance', factPath: 'currentBalance' },
				{ header: 'Interest Rate', factPath: 'apr|interestRate' },
				{ header: 'Min Payment', factPath: 'minimumPayment|monthlyPayment' },
				{ header: 'Lender/Issuer', factPath: 'issuer|lender|servicer' }
			]
		},
		{
			id: 'payoff-plan',
			name: 'Debt Payoff Plan',
			format: 'pdf',
			description: 'Month-by-month payoff schedule',
			includedEntities: ['DebtSummary', 'CreditCard', 'PersonalLoan', 'StudentLoan', 'AutoLoan']
		},
		{
			id: 'counselor-report',
			name: 'Credit Counselor Report',
			format: 'json',
			description: 'All facts for credit counseling session',
			includedEntities: ['Debtor', 'CreditCard', 'PersonalLoan', 'StudentLoan', 'AutoLoan', 'Mortgage', 'MedicalDebt', 'CollectionAccount', 'DebtSummary']
		}
	],

	createdAt: '2024-01-01T00:00:00Z',
	updatedAt: '2024-01-01T00:00:00Z',
	isBuiltIn: true
};
