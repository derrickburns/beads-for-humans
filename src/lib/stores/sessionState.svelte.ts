/**
 * Session State Store
 *
 * Tracks the user's session so the AI can drive the process.
 * The AI is the general contractor - it knows what needs to be done
 * and guides the human through providing necessary information.
 *
 * Key principles:
 * - AI drives, human provides info when available
 * - Human may disappear at any moment (abrupt close, incomplete answer)
 * - On return, AI reminds human where they were and what's next
 * - AI maintains the long-term memory and project state
 */

const STORAGE_KEY = 'beads-session-state';

export interface PendingQuestion {
	taskId: string;
	taskTitle: string;
	question: string;
	askedAt: string;
	context?: string;  // Why this matters
}

export interface SessionState {
	// Last active task
	lastTaskId: string | null;
	lastTaskTitle: string | null;
	lastInteractionAt: string | null;

	// What the AI is waiting for from the human
	pendingQuestions: PendingQuestion[];

	// Session tracking
	sessionStartedAt: string | null;
	totalInteractions: number;
}

function loadState(): SessionState {
	if (typeof localStorage === 'undefined') {
		return createEmptyState();
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.error('Failed to load session state:', e);
	}

	return createEmptyState();
}

function createEmptyState(): SessionState {
	return {
		lastTaskId: null,
		lastTaskTitle: null,
		lastInteractionAt: null,
		pendingQuestions: [],
		sessionStartedAt: null,
		totalInteractions: 0
	};
}

function saveState(state: SessionState) {
	if (typeof localStorage === 'undefined') return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.error('Failed to save session state:', e);
	}
}

class SessionStateStore {
	private _state = $state<SessionState>(loadState());

	get state() {
		return this._state;
	}

	get lastTaskId() {
		return this._state.lastTaskId;
	}

	get lastTaskTitle() {
		return this._state.lastTaskTitle;
	}

	get lastInteractionAt() {
		return this._state.lastInteractionAt;
	}

	get pendingQuestions() {
		return this._state.pendingQuestions;
	}

	get hasPendingQuestions() {
		return this._state.pendingQuestions.length > 0;
	}

	// Called when user starts working on a task
	setActiveTask(taskId: string, taskTitle: string) {
		this._state = {
			...this._state,
			lastTaskId: taskId,
			lastTaskTitle: taskTitle,
			lastInteractionAt: new Date().toISOString(),
			sessionStartedAt: this._state.sessionStartedAt || new Date().toISOString()
		};
		saveState(this._state);
	}

	// Called on any user interaction
	recordInteraction() {
		this._state = {
			...this._state,
			lastInteractionAt: new Date().toISOString(),
			totalInteractions: this._state.totalInteractions + 1
		};
		saveState(this._state);
	}

	// AI is waiting for human to answer something
	addPendingQuestion(taskId: string, taskTitle: string, question: string, context?: string) {
		// Don't duplicate
		const exists = this._state.pendingQuestions.some(
			q => q.taskId === taskId && q.question === question
		);
		if (exists) return;

		this._state = {
			...this._state,
			pendingQuestions: [
				...this._state.pendingQuestions,
				{
					taskId,
					taskTitle,
					question,
					askedAt: new Date().toISOString(),
					context
				}
			]
		};
		saveState(this._state);
	}

	// Human answered a question (or we got the info another way)
	resolvePendingQuestion(taskId: string, question?: string) {
		this._state = {
			...this._state,
			pendingQuestions: this._state.pendingQuestions.filter(q => {
				if (question) {
					return !(q.taskId === taskId && q.question === question);
				}
				return q.taskId !== taskId;
			})
		};
		saveState(this._state);
	}

	// Get pending questions for a specific task
	getPendingQuestionsForTask(taskId: string): PendingQuestion[] {
		return this._state.pendingQuestions.filter(q => q.taskId === taskId);
	}

	// How long since last interaction (for staleness detection)
	getTimeSinceLastInteraction(): number | null {
		if (!this._state.lastInteractionAt) return null;
		return Date.now() - new Date(this._state.lastInteractionAt).getTime();
	}

	// Format time since last interaction for display
	getLastInteractionDisplay(): string {
		const ms = this.getTimeSinceLastInteraction();
		if (ms === null) return 'Never';

		const minutes = Math.floor(ms / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
		if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
		return 'Just now';
	}

	// Clear session (for testing or reset)
	clear() {
		this._state = createEmptyState();
		saveState(this._state);
	}
}

export const sessionState = new SessionStateStore();
