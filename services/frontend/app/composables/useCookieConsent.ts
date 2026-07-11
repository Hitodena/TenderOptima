export interface CookieConsentPreferences {
	necessary: true
	analytics: boolean
	marketing: boolean
	savedAt: string
}

const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180

function defaultPreferences(): CookieConsentPreferences {
	return {
		necessary: true,
		analytics: false,
		marketing: false,
		savedAt: new Date().toISOString(),
	}
}

export function useCookieConsent() {
	const consent = useCookie<CookieConsentPreferences | null>('to_cookie_consent', {
		maxAge: COOKIE_CONSENT_MAX_AGE,
		sameSite: 'lax',
	})

	const hasChoice = computed(() => consent.value !== null)
	const preferences = computed(() => consent.value ?? defaultPreferences())
	const canUseAnalytics = computed(() => preferences.value.analytics)
	const canUseMarketing = computed(() => preferences.value.marketing)

	function clearAnalyticsCookies() {
		const utm = useCookie('to_utm')
		utm.value = null
	}

	function saveChoice(choice: { analytics: boolean; marketing: boolean }) {
		consent.value = {
			necessary: true,
			analytics: choice.analytics,
			marketing: choice.marketing,
			savedAt: new Date().toISOString(),
		}
		if (!choice.analytics) {
			clearAnalyticsCookies()
		}
	}

	function acceptAll() {
		saveChoice({ analytics: true, marketing: true })
	}

	function necessaryOnly() {
		saveChoice({ analytics: false, marketing: false })
	}

	return {
		consent,
		hasChoice,
		preferences,
		canUseAnalytics,
		canUseMarketing,
		saveChoice,
		acceptAll,
		necessaryOnly,
	}
}
