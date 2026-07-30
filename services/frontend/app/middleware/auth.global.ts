export default defineNuxtRouteMiddleware((to) => {
	if (import.meta.server) return;

	const auth = useAuthStore();
	const publicRoutes = new Set([
		'/',
		'/auth',
	]);

	const isPublic
		= publicRoutes.has(to.path)
			|| to.path.startsWith('/legal/');

	if (!auth.isAuthenticated.value && !isPublic) {
		return navigateTo('/auth');
	}
});
