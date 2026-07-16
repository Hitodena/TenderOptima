const COOKIE_NAME = 'to_business_card_hint_seen'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Tracks whether the user has already seen (or dismissed) the first-search
 * business-card onboarding hint.
 */
export function useBusinessCardHint() {
	const seen = useCookie<string | null>(COOKIE_NAME, {
		maxAge: COOKIE_MAX_AGE,
		sameSite: 'lax',
	})

	const hasSeen = computed(() => seen.value === '1')

	function markSeen() {
		seen.value = '1'
	}

	return { hasSeen, markSeen }
}
