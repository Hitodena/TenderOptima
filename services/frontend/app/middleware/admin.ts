export default defineNuxtRouteMiddleware(async () => {
	if (import.meta.server) return

	const { user, ensureLoaded } = useCurrentUser()
	await ensureLoaded()
	if (!user.value?.is_admin) {
		return navigateTo('/')
	}
})
