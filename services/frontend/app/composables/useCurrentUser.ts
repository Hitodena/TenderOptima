import type { UserResponse } from '#shared/types'

let fetchPromise: Promise<void> | null = null

export function useCurrentUser() {
	const user = useState<UserResponse | null>('current-user', () => null)
	const loaded = useState<boolean>('current-user-loaded', () => false)

	const { get } = useApi()
	const auth = useAuthStore()

	async function ensureLoaded(): Promise<void> {
		if (loaded.value) return
		if (fetchPromise) return fetchPromise
		fetchPromise = get<UserResponse>('/auth/me')
			.then((data) => {
				user.value = data
				loaded.value = true
			})
			.catch(() => {
				user.value = null
				loaded.value = true
			})
			.finally(() => {
				fetchPromise = null
			})
		return fetchPromise
	}

	function invalidate() {
		user.value = null
		loaded.value = false
	}

	watch(
		() => auth.isAuthenticated.value,
		(authenticated) => {
			if (!authenticated) invalidate()
		},
	)

	return { user, loaded, ensureLoaded, invalidate }
}
