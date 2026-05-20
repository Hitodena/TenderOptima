export default defineNuxtRouteMiddleware((to) => {
	if (import.meta.server) return;

	const auth = useAuthStore();
	const publicRoutes = ['/auth'];

	if (!auth.isAuthenticated && !publicRoutes.includes(to.path)) {
		return navigateTo('/auth');
	}
});
