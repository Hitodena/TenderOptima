import axios from 'axios';

export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();

	const api = axios.create({
		baseURL: config.public.apiBase,
	});
	const auth = useAuthStore();

	api.interceptors.request.use((req) => {
		if (auth.token.value) {
			req.headers.Authorization = `Bearer ${auth.token.value}`;
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
				await navigateTo('/auth');
			}

			if (!error.response || status === 502 || status >= 500) {
				const toast = useToast();
				toast.add({
					title: 'Внутренняя ошибка сервера',
					description: 'Попробуйте позже или обновите страницу',
					color: 'error',
				});
			}

			return Promise.reject(error);
		},
	);

	return { provide: { axios: api } };
});
