export function useAuthStore() {
	const token = useState<string | null>('sf_token', () => null);

	if (import.meta.client && token.value === null) {
		token.value = localStorage.getItem('sf_token');
	}

	const isAuthenticated = computed(() => !!token.value);

	function setToken(t: string) {
		token.value = t;
		localStorage.setItem('sf_token', t);
	}

	function clearToken() {
		token.value = null;
		localStorage.removeItem('sf_token');
	}

	return { token, isAuthenticated, setToken, clearToken };
}
