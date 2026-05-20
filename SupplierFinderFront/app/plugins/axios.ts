import axios from 'axios';

export default defineNuxtPlugin(() => {
	const api = axios.create({
		baseURL: 'http://localhost:8000/api',
	});

	api.interceptors.request.use((config) => {
		if (import.meta.client) {
			const auth = useAuthStore();
			if (auth.token.value)
				config.headers.Authorization = `Bearer ${auth.token.value}`;
		}
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

			if (status === 502 || status >= 500) {
				const toast = useToast();
				toast.add({
					title: 'Ошибка сервера',
					description: 'Попробуйте позже',
					color: 'error',
				});
			}

			return Promise.reject(error);
		},
	);

	return { provide: { axios: api } };
});
