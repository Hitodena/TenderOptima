export default defineNuxtRouteMiddleware((to) => {
	if (import.meta.server) return;

	const auth = useAuthStore();
	const publicRoutes = new Set([
		'/',
		'/auth',
		'/cooperation',
	]);

	const isPublic
		= publicRoutes.has(to.path)
			|| to.path.startsWith('/legal/')
			|| to.path.startsWith('/s/');

	if (!auth.isAuthenticated.value && !isPublic) {
		return navigateTo('/auth');
	}
});
