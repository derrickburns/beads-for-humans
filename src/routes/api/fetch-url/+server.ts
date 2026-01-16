import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Simple HTML to text extraction
function htmlToText(html: string): string {
	// Remove scripts and styles
	let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
	text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

	// Remove HTML tags but keep content
	text = text.replace(/<[^>]+>/g, ' ');

	// Decode HTML entities
	text = text.replace(/&nbsp;/g, ' ');
	text = text.replace(/&amp;/g, '&');
	text = text.replace(/&lt;/g, '<');
	text = text.replace(/&gt;/g, '>');
	text = text.replace(/&quot;/g, '"');
	text = text.replace(/&#39;/g, "'");

	// Clean up whitespace
	text = text.replace(/\s+/g, ' ').trim();

	return text;
}

// Extract key information from page
function extractKeyInfo(html: string, url: string): string {
	const sections: string[] = [];

	// Get title
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	if (titleMatch) {
		sections.push(`Title: ${titleMatch[1].trim()}`);
	}

	// Get meta description
	const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
	if (descMatch) {
		sections.push(`Description: ${descMatch[1].trim()}`);
	}

	// Get main content (look for article, main, or body)
	let mainContent = '';
	const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
	const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

	if (articleMatch) {
		mainContent = htmlToText(articleMatch[1]);
	} else if (mainMatch) {
		mainContent = htmlToText(mainMatch[1]);
	} else {
		// Fall back to body content
		const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
		if (bodyMatch) {
			mainContent = htmlToText(bodyMatch[1]);
		}
	}

	// Limit content length
	if (mainContent.length > 3000) {
		mainContent = mainContent.substring(0, 3000) + '...';
	}

	if (mainContent) {
		sections.push(`Content: ${mainContent}`);
	}

	sections.push(`Source URL: ${url}`);

	return sections.join('\n\n');
}

export const POST: RequestHandler = async ({ request }) => {
	const { url } = (await request.json()) as { url: string };

	if (!url) {
		return json({ error: 'URL is required' });
	}

	// Validate URL
	try {
		new URL(url);
	} catch {
		return json({ error: 'Invalid URL format' });
	}

	// Don't fetch sensitive domains
	const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.', '172.'];
	const urlObj = new URL(url);
	if (blockedDomains.some(d => urlObj.hostname.includes(d))) {
		return json({ error: 'Cannot fetch from local/private addresses' });
	}

	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; BeadsBot/1.0; +https://beads.app)',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			},
			signal: AbortSignal.timeout(10000) // 10 second timeout
		});

		if (!response.ok) {
			return json({ error: `Failed to fetch: ${response.status} ${response.statusText}` });
		}

		const contentType = response.headers.get('content-type') || '';

		if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
			const html = await response.text();
			const content = extractKeyInfo(html, url);
			return json({ content, contentType: 'html' });
		} else if (contentType.includes('application/json')) {
			const jsonData = await response.json();
			const content = `JSON from ${url}:\n${JSON.stringify(jsonData, null, 2).substring(0, 3000)}`;
			return json({ content, contentType: 'json' });
		} else if (contentType.includes('text/')) {
			const text = await response.text();
			const content = `Text from ${url}:\n${text.substring(0, 3000)}`;
			return json({ content, contentType: 'text' });
		} else {
			return json({ error: `Unsupported content type: ${contentType}` });
		}
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				return json({ error: 'Request timed out' });
			}
			return json({ error: `Failed to fetch: ${error.message}` });
		}
		return json({ error: 'Failed to fetch URL' });
	}
};
