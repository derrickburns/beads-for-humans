import { browser } from '$app/environment';
import type {
	ExtractedFact,
	FactValue,
	FactSource,
	DomainSchema,
	DomainType,
	Document,
	ExternalSession,
	FactsStoreState
} from '$lib/types/facts';
import { getBuiltInSchema } from '$lib/schemas';

// ============================================
// FACTS STORE
// ============================================

// File path for persistence (server-side)
const FACTS_DIR = '.beads/facts';

function createFactsStore() {
	// State
	let state = $state<FactsStoreState>({
		projectId: '',
		activeDomains: [],
		domainSchemas: [],
		facts: [],
		documents: [],
		externalSessions: [],
		completeness: []
	});

	// LocalStorage key for browser persistence
	const STORAGE_KEY = 'beads-facts';

	// Load from storage on init
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				state = { ...state, ...parsed };
			} catch {
				console.error('Failed to parse stored facts');
			}
		}
	}

	// Persist to storage
	function persist() {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		}
	}

	// Generate unique ID
	function generateId(prefix: string): string {
		return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	return {
		// Getters
		get state() { return state; },
		get facts() { return state.facts; },
		get documents() { return state.documents; },
		get externalSessions() { return state.externalSessions; },
		get activeDomains() { return state.activeDomains; },
		get domainSchemas() { return state.domainSchemas; },

		// ============================================
		// PROJECT MANAGEMENT
		// ============================================

		/**
		 * Initialize facts store for a project
		 */
		initProject(projectId: string, domains: DomainType[] = []): void {
			state.projectId = projectId;
			state.activeDomains = domains;

			// Load built-in schemas for active domains
			state.domainSchemas = domains
				.map(d => getBuiltInSchema(d))
				.filter((s): s is DomainSchema => s !== null);

			this.updateCompleteness();
			persist();
		},

		/**
		 * Add a domain to the project
		 */
		addDomain(domain: DomainType): void {
			if (!state.activeDomains.includes(domain)) {
				state.activeDomains = [...state.activeDomains, domain];

				const schema = getBuiltInSchema(domain);
				if (schema) {
					state.domainSchemas = [...state.domainSchemas, schema];
				}

				this.updateCompleteness();
				persist();
			}
		},

		// ============================================
		// FACT MANAGEMENT
		// ============================================

		/**
		 * Add or update an extracted fact
		 */
		addFact(fact: Omit<ExtractedFact, 'id' | 'extractedAt' | 'updatedAt'>): ExtractedFact {
			const now = new Date().toISOString();

			// Check for existing fact with same entity/attribute
			const existingIndex = state.facts.findIndex(
				f => f.entity === fact.entity &&
					f.attribute === fact.attribute &&
					f.projectId === fact.projectId
			);

			const newFact: ExtractedFact = {
				...fact,
				id: existingIndex >= 0 ? state.facts[existingIndex].id : generateId('fact'),
				extractedAt: existingIndex >= 0 ? state.facts[existingIndex].extractedAt : now,
				updatedAt: now
			};

			if (existingIndex >= 0) {
				state.facts[existingIndex] = newFact;
			} else {
				state.facts = [...state.facts, newFact];
			}

			this.updateCompleteness();
			persist();
			return newFact;
		},

		/**
		 * Get facts for an entity
		 */
		getFactsForEntity(entity: string): ExtractedFact[] {
			return state.facts.filter(f => f.entity === entity && f.projectId === state.projectId);
		},

		/**
		 * Get a specific fact value
		 */
		getFactValue(entity: string, attribute: string): FactValue | undefined {
			const fact = state.facts.find(
				f => f.entity === entity &&
					f.attribute === attribute &&
					f.projectId === state.projectId
			);
			return fact?.value;
		},

		/**
		 * Update fact validation status
		 */
		updateValidation(
			factId: string,
			status: ExtractedFact['validationStatus'],
			validatedBy?: string
		): ExtractedFact | undefined {
			const index = state.facts.findIndex(f => f.id === factId);
			if (index < 0) return undefined;

			state.facts[index] = {
				...state.facts[index],
				validationStatus: status,
				validatedAt: new Date().toISOString(),
				validatedBy,
				updatedAt: new Date().toISOString()
			};

			this.updateCompleteness();
			persist();
			return state.facts[index];
		},

		/**
		 * Delete a fact
		 */
		deleteFact(factId: string): boolean {
			const index = state.facts.findIndex(f => f.id === factId);
			if (index < 0) return false;

			state.facts = state.facts.filter(f => f.id !== factId);
			this.updateCompleteness();
			persist();
			return true;
		},

		// ============================================
		// DOCUMENT MANAGEMENT
		// ============================================

		/**
		 * Add a document record
		 */
		addDocument(doc: Omit<Document, 'id' | 'uploadedAt' | 'extractionStatus' | 'extractedFactIds'>): Document {
			const newDoc: Document = {
				...doc,
				id: generateId('doc'),
				uploadedAt: new Date().toISOString(),
				extractionStatus: 'pending',
				extractedFactIds: []
			};

			state.documents = [...state.documents, newDoc];
			persist();
			return newDoc;
		},

		/**
		 * Update document extraction status
		 */
		updateDocumentStatus(
			docId: string,
			status: Document['extractionStatus'],
			extractedFactIds?: string[],
			error?: string
		): Document | undefined {
			const index = state.documents.findIndex(d => d.id === docId);
			if (index < 0) return undefined;

			state.documents[index] = {
				...state.documents[index],
				extractionStatus: status,
				extractedFactIds: extractedFactIds || state.documents[index].extractedFactIds,
				extractionError: error,
				processedAt: new Date().toISOString()
			};

			persist();
			return state.documents[index];
		},

		/**
		 * Get documents for project
		 */
		getDocuments(): Document[] {
			return state.documents.filter(d => d.projectId === state.projectId);
		},

		// ============================================
		// EXTERNAL SESSION MANAGEMENT
		// ============================================

		/**
		 * Create an external session for data extraction
		 */
		createExternalSession(
			siteName: string,
			siteUrl: string,
			purpose: string
		): ExternalSession {
			const session: ExternalSession = {
				id: generateId('session'),
				projectId: state.projectId,
				siteName,
				siteUrl,
				purpose,
				status: 'pending_login',
				handoffRequestedAt: new Date().toISOString(),
				extractedFactIds: []
			};

			state.externalSessions = [...state.externalSessions, session];
			persist();
			return session;
		},

		/**
		 * Update session status
		 */
		updateSessionStatus(
			sessionId: string,
			status: ExternalSession['status'],
			extractedFactIds?: string[]
		): ExternalSession | undefined {
			const index = state.externalSessions.findIndex(s => s.id === sessionId);
			if (index < 0) return undefined;

			const now = new Date().toISOString();
			const updates: Partial<ExternalSession> = { status };

			if (status === 'active') {
				updates.userLoggedInAt = now;
			} else if (status === 'extracting') {
				updates.sessionHandedOffAt = now;
			} else if (status === 'completed' && extractedFactIds) {
				updates.extractedFactIds = extractedFactIds;
			}

			state.externalSessions[index] = {
				...state.externalSessions[index],
				...updates
			};

			persist();
			return state.externalSessions[index];
		},

		// ============================================
		// COMPLETENESS TRACKING
		// ============================================

		/**
		 * Update completeness metrics for all domains
		 */
		updateCompleteness(): void {
			state.completeness = state.activeDomains.map(domain => {
				const schema = state.domainSchemas.find(s => s.domain === domain);
				if (!schema) {
					return {
						domain,
						requiredFacts: 0,
						extractedFacts: 0,
						verifiedFacts: 0,
						percentage: 0
					};
				}

				const requiredFacts = schema.requiredFacts.length;
				const projectFacts = state.facts.filter(f => f.projectId === state.projectId);

				// Count how many required facts we have
				let extractedCount = 0;
				let verifiedCount = 0;

				for (const required of schema.requiredFacts) {
					const [entity, attribute] = required.split('.');
					const fact = projectFacts.find(f => f.entity === entity && f.attribute === attribute);

					if (fact) {
						extractedCount++;
						if (fact.validationStatus === 'user_confirmed' || fact.validationStatus === 'externally_verified') {
							verifiedCount++;
						}
					}
				}

				return {
					domain,
					requiredFacts,
					extractedFacts: extractedCount,
					verifiedFacts: verifiedCount,
					percentage: requiredFacts > 0 ? Math.round((extractedCount / requiredFacts) * 100) : 0
				};
			});
		},

		/**
		 * Get completeness for a domain
		 */
		getCompleteness(domain: DomainType) {
			return state.completeness.find(c => c.domain === domain);
		},

		/**
		 * Get missing required facts
		 */
		getMissingRequiredFacts(domain: DomainType): string[] {
			const schema = state.domainSchemas.find(s => s.domain === domain);
			if (!schema) return [];

			const projectFacts = state.facts.filter(f => f.projectId === state.projectId);

			return schema.requiredFacts.filter(required => {
				const [entity, attribute] = required.split('.');
				return !projectFacts.some(f => f.entity === entity && f.attribute === attribute);
			});
		},

		// ============================================
		// EXPORT
		// ============================================

		/**
		 * Export facts to JSON
		 */
		exportToJson(options?: {
			entities?: string[];
			includeUnverified?: boolean;
			includeProvenance?: boolean;
		}): string {
			let facts = state.facts.filter(f => f.projectId === state.projectId);

			if (options?.entities) {
				facts = facts.filter(f => options.entities!.includes(f.entity));
			}

			if (!options?.includeUnverified) {
				facts = facts.filter(f =>
					f.validationStatus === 'user_confirmed' ||
					f.validationStatus === 'externally_verified'
				);
			}

			const exportData = facts.map(f => {
				const base = {
					entity: f.entity,
					attribute: f.attribute,
					value: f.value.raw,
					valueType: f.value.type,
					...(f.value.currency && { currency: f.value.currency }),
					validationStatus: f.validationStatus,
					effectiveDate: f.effectiveDate
				};

				if (options?.includeProvenance) {
					return {
						...base,
						source: f.source
					};
				}

				return base;
			});

			return JSON.stringify(exportData, null, 2);
		},

		/**
		 * Export facts to CSV
		 */
		exportToCsv(entities?: string[]): string {
			let facts = state.facts.filter(f => f.projectId === state.projectId);

			if (entities) {
				facts = facts.filter(f => entities.includes(f.entity));
			}

			const headers = ['Entity', 'Attribute', 'Value', 'Type', 'Currency', 'Status', 'Effective Date', 'Source'];
			const rows = facts.map(f => [
				f.entity,
				f.attribute,
				String(f.value.raw),
				f.value.type,
				f.value.currency || '',
				f.validationStatus,
				f.effectiveDate || '',
				f.source.type
			]);

			const csvContent = [
				headers.join(','),
				...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
			].join('\n');

			return csvContent;
		},

		// ============================================
		// CLEAR / RESET
		// ============================================

		/**
		 * Clear all data for current project
		 */
		clearProject(): void {
			state.facts = state.facts.filter(f => f.projectId !== state.projectId);
			state.documents = state.documents.filter(d => d.projectId !== state.projectId);
			state.externalSessions = state.externalSessions.filter(s => s.projectId !== state.projectId);
			state.completeness = [];
			persist();
		},

		/**
		 * Clear all data
		 */
		clearAll(): void {
			state = {
				projectId: '',
				activeDomains: [],
				domainSchemas: [],
				facts: [],
				documents: [],
				externalSessions: [],
				completeness: []
			};
			persist();
		}
	};
}

// Export singleton instance
export const factsStore = createFactsStore();
