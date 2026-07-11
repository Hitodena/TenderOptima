export default defineNuxtRouteMiddleware((to) => {
	if (import.meta.server) return;

	const auth = useAuthStore();
	const publicRoutes = [
		'/',
		'/auth',
		'/legal/personal-data-consent',
		'/legal/privacy-policy',
	];

	if (!auth.isAuthenticated.value && !publicRoutes.includes(to.path)) {
		return navigateTo('/auth');
	}
});
