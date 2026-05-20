export function useAuthStore() {
	const token = useCookie<string | null>('sf_token', {
		sameSite: 'lax',
		secure: import.meta.env.PROD,
		maxAge: 60 * 60 * 24 * 30,
	});

	const isAuthenticated = computed(() => !!token.value);

	function setToken(t: string) {
		token.value = t;
	}

	function clearToken() {
		token.value = null;
	}

	return { token, isAuthenticated, setToken, clearToken };
}
