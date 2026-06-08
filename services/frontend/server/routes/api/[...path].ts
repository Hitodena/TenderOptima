import { proxyRequest } from 'h3';

/**
 * Proxy browser /api/* requests to the FastAPI backend.
 * Keeps API calls same-origin (HTTPS) and avoids mixed-content blocks.
 */
export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const pathParam = event.context.params?.path;
	const path = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam ?? '');
	const target = `${config.backendInternalUrl}/api/${path}`;
	return proxyRequest(event, target);
});
