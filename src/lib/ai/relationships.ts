import type { Issue, RelationshipSuggestion } from '$lib/types/issue';

export async function suggestRelationships(
	issue: { title: string; description: string },
	existingIssues: Issue[]
): Promise<RelationshipSuggestion[]> {
	try {
		const response = await fetch('/api/suggest-relationships', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ issue, existingIssues })
		});

		if (!response.ok) {
			console.error('Failed to get suggestions:', response.statusText);
			return [];
		}

		const data = await response.json();
		return data.suggestions || [];
	} catch (error) {
		console.error('Error getting relationship suggestions:', error);
		return [];
	}
}
