// === Extracted Facts & Domain Schema System ===
// For tracking verifiable information extracted from dialogs, documents, and external sources

// ============================================
// CORE FACT TYPES
// ============================================

/**
 * A single extracted fact - the atomic unit of validated information
 * Uses a flexible triple-like structure (entity-attribute-value) with rich metadata
 */
export interface ExtractedFact {
	id: string;

	// The fact itself (subject-predicate-object / entity-attribute-value)
	entity: string;           // e.g., "SocialSecurity", "401k_Fidelity", "Geico_Auto"
	attribute: string;        // e.g., "monthlyBenefit", "balance", "policyNumber"
	value: FactValue;         // The actual value with type information

	// Provenance - where did this fact come from?
	source: FactSource;

	// Validation status
	validationStatus: 'unverified' | 'user_confirmed' | 'externally_verified' | 'disputed';
	validatedAt?: string;
	validatedBy?: string;     // User or external service

	// Schema reference
	domainId: string;         // Which domain schema this belongs to
	schemaVersion: string;    // Version of the schema used

	// Temporal
	effectiveDate?: string;   // When this fact is/was true (e.g., balance as of date)
	expiresAt?: string;       // When this fact needs re-verification

	// Project linkage
	projectId: string;        // Which project this belongs to
	issueId?: string;         // Which issue/task this was extracted from

	// Timestamps
	extractedAt: string;
	updatedAt: string;
}

/**
 * Typed value with unit support
 */
export interface FactValue {
	type: 'string' | 'number' | 'boolean' | 'date' | 'currency' | 'percentage' | 'duration' | 'contact' | 'document_ref';
	raw: string | number | boolean;

	// For currency
	currency?: string;        // USD, EUR, etc.

	// For percentage
	asDecimal?: number;       // 0.07 for 7%

	// For duration
	unit?: 'days' | 'months' | 'years';

	// For contact
	contact?: {
		name?: string;
		phone?: string;
		email?: string;
		address?: string;
		organization?: string;
		role?: string;
	};

	// For document reference
	documentId?: string;
	documentPage?: number;
}

/**
 * Source/provenance of a fact
 */
export interface FactSource {
	type: 'dialog' | 'document' | 'external_query' | 'manual_entry' | 'calculated';

	// For dialog extraction
	dialogMessageId?: string;
	dialogTimestamp?: string;
	extractedPhrase?: string; // The exact text that was parsed

	// For document extraction
	documentId?: string;
	documentName?: string;
	documentType?: string;    // PDF, image, CSV, etc.
	pageNumber?: number;
	boundingBox?: { x: number; y: number; width: number; height: number };

	// For external query
	externalUrl?: string;
	queryTimestamp?: string;
	sessionId?: string;       // For session handoff tracking

	// Confidence
	confidence: number;       // 0-1, how confident the extraction is
	aiModel?: string;         // Which model did the extraction
}

// ============================================
// DOMAIN SCHEMAS
// ============================================

/**
 * Known planning domains with pre-built schemas
 */
export type DomainType =
	| 'retirement_planning'
	| 'estate_planning'
	| 'home_renovation'
	| 'insurance_review'
	| 'tax_planning'
	| 'debt_management'
	| 'investment_portfolio'
	| 'business_planning'
	| 'healthcare_planning'
	| 'education_planning'
	| 'custom';

/**
 * A domain schema defines what facts are expected for a domain
 */
export interface DomainSchema {
	id: string;
	domain: DomainType;
	name: string;             // "Retirement Planning Schema"
	version: string;          // Semantic version
	description: string;

	// Entity definitions
	entities: EntityDefinition[];

	// Relationships between entities
	relationships: RelationshipDefinition[];

	// Validation rules
	validationRules: ValidationRule[];

	// Required vs optional facts for completeness
	requiredFacts: string[];  // ["SocialSecurity.startDate", "SocialSecurity.monthlyBenefit"]

	// Export templates
	exportTemplates: ExportTemplate[];

	// Metadata
	createdAt: string;
	updatedAt: string;
	isBuiltIn: boolean;       // True for library schemas, false for custom
}

/**
 * Definition of an entity type within a domain
 */
export interface EntityDefinition {
	name: string;             // "SocialSecurity", "401k", "IRA"
	displayName: string;      // "Social Security"
	description: string;
	category: string;         // "income", "asset", "expense", "insurance"

	// Attributes this entity can have
	attributes: AttributeDefinition[];

	// Can there be multiple instances?
	allowMultiple: boolean;   // True for "401k" (can have several), false for "SocialSecurity"

	// Identifier attribute for multiple instances
	identifierAttribute?: string; // e.g., "accountName" for 401k
}

/**
 * Definition of an attribute within an entity
 */
export interface AttributeDefinition {
	name: string;             // "monthlyBenefit"
	displayName: string;      // "Monthly Benefit Amount"
	description: string;
	type: FactValue['type'];

	// Constraints
	required: boolean;
	min?: number;
	max?: number;
	pattern?: string;         // Regex for validation
	allowedValues?: string[]; // Enum values

	// For currency/percentage
	defaultCurrency?: string;

	// Verification
	verificationMethod?: 'document' | 'external_api' | 'user_attestation';
	verificationUrl?: string; // e.g., "https://www.ssa.gov/myaccount/"

	// Help text for extraction
	extractionHints: string[]; // ["Social Security statement", "SSA-1099"]
}

/**
 * Relationship between entities
 */
export interface RelationshipDefinition {
	name: string;             // "beneficiaryOf"
	fromEntity: string;       // "Person"
	toEntity: string;         // "401k"
	cardinality: 'one-to-one' | 'one-to-many' | 'many-to-many';
	description: string;
}

/**
 * Cross-field validation rules
 */
export interface ValidationRule {
	id: string;
	name: string;
	description: string;
	expression: string;       // e.g., "SocialSecurity.startDate >= Person.birthDate + 62 years"
	severity: 'error' | 'warning' | 'info';
	message: string;          // "Social Security cannot start before age 62"
}

/**
 * Template for exporting facts
 */
export interface ExportTemplate {
	id: string;
	name: string;             // "Retirement Summary"
	format: 'json' | 'csv' | 'pdf' | 'markdown';
	description: string;

	// Which facts to include
	includedEntities: string[];
	includedAttributes?: Record<string, string[]>; // Entity -> attributes

	// For PDF
	pdfTemplate?: string;     // Template name or content

	// For CSV
	csvColumns?: Array<{
		header: string;
		factPath: string;     // "SocialSecurity.monthlyBenefit"
	}>;
}

// ============================================
// DOCUMENT & EXTERNAL SOURCE TRACKING
// ============================================

/**
 * Uploaded or referenced document
 */
export interface Document {
	id: string;
	projectId: string;

	// File info
	name: string;
	type: 'pdf' | 'image' | 'csv' | 'excel' | 'text' | 'html' | 'other';
	mimeType: string;
	size: number;

	// Storage
	storagePath: string;      // Path in local storage
	hash: string;             // SHA-256 for deduplication

	// Extraction status
	extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
	extractedFactIds: string[];
	extractionError?: string;

	// Source tracking
	sourceUrl?: string;       // If downloaded from web
	sourceDescription?: string;

	// Timestamps
	uploadedAt: string;
	processedAt?: string;
}

/**
 * External site session for data extraction
 */
export interface ExternalSession {
	id: string;
	projectId: string;

	// Site info
	siteName: string;         // "Social Security Administration"
	siteUrl: string;          // "https://www.ssa.gov/myaccount/"
	purpose: string;          // "Extract benefit estimates"

	// Session state
	status: 'pending_login' | 'active' | 'extracting' | 'completed' | 'expired' | 'failed';

	// Handoff tracking
	handoffRequestedAt: string;
	userLoggedInAt?: string;
	sessionHandedOffAt?: string;
	sessionExpiresAt?: string;

	// Extraction results
	extractedFactIds: string[];
	extractionNotes?: string;

	// Error handling
	error?: string;
}

// ============================================
// FACTS STORE STATE
// ============================================

/**
 * State of the facts store for a project
 */
export interface FactsStoreState {
	projectId: string;

	// Active domain(s)
	activeDomains: DomainType[];
	domainSchemas: DomainSchema[];

	// All extracted facts
	facts: ExtractedFact[];

	// Documents
	documents: Document[];

	// External sessions
	externalSessions: ExternalSession[];

	// Completeness tracking
	completeness: {
		domain: DomainType;
		requiredFacts: number;
		extractedFacts: number;
		verifiedFacts: number;
		percentage: number;
	}[];

	// Last sync
	lastExportedAt?: string;
	lastSyncedAt?: string;
}

// ============================================
// EXPORT TYPES
// ============================================

/**
 * Export request
 */
export interface ExportRequest {
	projectId: string;
	format: 'json' | 'csv' | 'pdf' | 'markdown';
	templateId?: string;

	// Filters
	entities?: string[];
	includeUnverified?: boolean;
	includeProvenance?: boolean;

	// Date range
	effectiveDateFrom?: string;
	effectiveDateTo?: string;
}

/**
 * Export result
 */
export interface ExportResult {
	format: 'json' | 'csv' | 'pdf' | 'markdown';
	content: string | Blob;
	filename: string;
	generatedAt: string;
	factCount: number;
}
