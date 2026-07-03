import axios from 'axios';

export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();

	const baseURL = import.meta.server
		? `${config.backendInternalUrl}/api`
		: config.public.apiBase;

	const api = axios.create({
		baseURL,
	});
	const auth = useAuthStore();

	api.interceptors.request.use((req) => {
		if (auth.token.value) {
			req.headers.Authorization = `Bearer ${auth.token.value}`;
		}
		if (req.data instanceof FormData) {
			delete req.headers['Content-Type'];
		}
		return req;
	});

	api.interceptors.response.use(
		(res) => res,
		async (error) => {
			const status = error.response?.status;

			if (status === 401) {
				const auth = useAuthStore();
				auth.clearToken();
				if (import.meta.client) {
					await navigateTo('/auth');
				}
			}

			if (
				import.meta.client &&
				(!error.response || status === 502 || status >= 500)
			) {
				const toast = useToast();
				toast.add({
					title: 'Внутренняя ошибка сервера',
					description: 'Попробуйте позже или обновите страницу',
					color: 'error',
				});
			}

			if (import.meta.client) {
				const requestUrl: string | undefined = error.config?.url;
				const isFeedbackEndpoint = requestUrl?.includes('/feedback/errors');
				if (!isFeedbackEndpoint) {
					const route = useRoute();
					const { reportError } = useErrorReporter();
					const backendData = error.response?.data;
					const backendResponse = backendData
						? JSON.stringify(backendData).slice(0, 8000)
						: null;

					void reportError({
						message: error.message ?? 'API error',
						backend_response: backendResponse,
						page_url: route.fullPath,
						request_method: (error.config?.method ?? '').toUpperCase() || null,
						request_url: requestUrl ?? null,
						status_code: status ?? null,
					});
				}
			}

			return Promise.reject(error);
		},
	);

	return { provide: { axios: api } };
});
