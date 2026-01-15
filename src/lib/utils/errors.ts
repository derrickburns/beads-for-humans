/**
 * User-friendly error messages
 * Converts technical errors to plain English that non-technical users can understand
 */

export interface FriendlyError {
	message: string;
	suggestion?: string;
	canRetry: boolean;
}

/**
 * Maps error patterns to user-friendly messages
 */
const errorPatterns: Array<{
	pattern: RegExp | string;
	message: string;
	suggestion?: string;
	canRetry: boolean;
}> = [
	// Network errors
	{
		pattern: /network|fetch|connect|ECONNREFUSED|ENOTFOUND|timeout/i,
		message: "Couldn't connect to the internet",
		suggestion: 'Check your connection and try again',
		canRetry: true
	},
	{
		pattern: /offline/i,
		message: "You're offline",
		suggestion: 'Connect to the internet and try again',
		canRetry: true
	},

	// AI/API errors
	{
		pattern: /api.*key|invalid.*key|unauthorized|401/i,
		message: 'API key issue',
		suggestion: 'Check your API key in settings',
		canRetry: false
	},
	{
		pattern: /rate.*limit|too.*many.*requests|429/i,
		message: 'Too many requests',
		suggestion: 'Wait a moment and try again',
		canRetry: true
	},
	{
		pattern: /quota|billing|payment|402/i,
		message: 'API quota exceeded',
		suggestion: 'Check your API account for usage limits',
		canRetry: false
	},
	{
		pattern: /model.*not.*found|invalid.*model/i,
		message: 'AI model unavailable',
		suggestion: 'Try a different model in settings',
		canRetry: false
	},
	{
		pattern: /ai|openrouter|anthropic|openai|503|502|500/i,
		message: 'AI service temporarily unavailable',
		suggestion: 'Try again in a moment',
		canRetry: true
	},

	// Data errors
	{
		pattern: /parse|json|syntax/i,
		message: 'Received unexpected data',
		suggestion: 'Try again - if this keeps happening, report the issue',
		canRetry: true
	},
	{
		pattern: /not.*found|404/i,
		message: "Couldn't find what you're looking for",
		suggestion: 'It may have been deleted or moved',
		canRetry: false
	},
	{
		pattern: /duplicate|already.*exists|conflict/i,
		message: 'This already exists',
		suggestion: 'Try a different name or update the existing one',
		canRetry: false
	},

	// Validation errors
	{
		pattern: /required|missing|empty/i,
		message: 'Some required information is missing',
		suggestion: 'Fill in all required fields',
		canRetry: false
	},
	{
		pattern: /invalid|format|type/i,
		message: 'Something was entered incorrectly',
		suggestion: 'Check your input and try again',
		canRetry: false
	},
	{
		pattern: /too.*long|too.*short|length/i,
		message: 'Input is the wrong length',
		suggestion: 'Make it shorter or longer',
		canRetry: false
	},

	// Permission errors
	{
		pattern: /forbidden|permission|access|403/i,
		message: "You don't have permission to do this",
		canRetry: false
	},

	// Cycle/dependency errors
	{
		pattern: /cycle|circular/i,
		message: 'This would create a circular dependency',
		suggestion: 'Tasks cannot depend on each other in a loop',
		canRetry: false
	}
];

/**
 * Convert any error to a user-friendly message
 */
export function toFriendlyError(error: unknown): FriendlyError {
	let errorString = '';

	if (error instanceof Error) {
		errorString = error.message;
	} else if (typeof error === 'string') {
		errorString = error;
	} else if (error && typeof error === 'object') {
		errorString = JSON.stringify(error);
	} else {
		errorString = String(error);
	}

	// Check against patterns
	for (const { pattern, message, suggestion, canRetry } of errorPatterns) {
		const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
		if (regex.test(errorString)) {
			return { message, suggestion, canRetry };
		}
	}

	// Default fallback - never show technical details
	return {
		message: 'Something went wrong',
		suggestion: 'Your data is safe. Try again or refresh the page.',
		canRetry: true
	};
}

/**
 * Get a simple error message string (for backwards compatibility)
 */
export function friendlyErrorMessage(error: unknown): string {
	const { message, suggestion } = toFriendlyError(error);
	return suggestion ? `${message}. ${suggestion}` : message;
}

/**
 * Check if an error indicates a temporary issue that might resolve with retry
 */
export function isRetryableError(error: unknown): boolean {
	return toFriendlyError(error).canRetry;
}

/**
 * Wrap an async function with user-friendly error handling
 */
export async function withFriendlyError<T>(
	fn: () => Promise<T>,
	defaultValue: T
): Promise<{ result: T; error: FriendlyError | null }> {
	try {
		const result = await fn();
		return { result, error: null };
	} catch (e) {
		return { result: defaultValue, error: toFriendlyError(e) };
	}
}
