import { proxyRequest } from 'h3';

/**
 * Proxy browser /api/* requests to the FastAPI backend.
 * Keeps API calls same-origin (HTTPS) and avoids mixed-content blocks.
 *
 * Note: h3's proxyRequest uses the target URL as-is and does not automatically
 * forward query parameters from the original request, so we extract and append
 * them explicitly.
 */
export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const pathParam = event.context.params?.path;
	const path = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam ?? '');

	const rawUrl = event.node.req.url ?? '';
	const qsIndex = rawUrl.indexOf('?');
	const qs = qsIndex >= 0 ? rawUrl.slice(qsIndex) : '';

	const target = `${config.backendInternalUrl}/api/${path}${qs}`;
	return proxyRequest(event, target);
});
