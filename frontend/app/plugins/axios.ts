import axios from 'axios';

export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();

	const api = axios.create({
		baseURL: config.public.apiBase,
	});

	api.interceptors.request.use((config) => {
		const token = useCookie('sf_token');
		if (token.value) config.headers.Authorization = `Bearer ${token.value}`;
		return config;
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
