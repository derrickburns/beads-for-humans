import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAIConfigured } from '$lib/ai/provider';

export const GET: RequestHandler = async () => {
	return json({
		configured: isAIConfigured()
	});
};
