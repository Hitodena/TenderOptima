const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const

export interface UtmParams {
	utm_source: string | null
	utm_medium: string | null
	utm_campaign: string | null
	utm_content: string | null
}

/**
 * Captures UTM query params on first visit and persists them in a cookie
 * so they survive navigation for later lead/consultation submissions.
 */
export function useUtmParams() {
	const cookie = useCookie<UtmParams | null>('to_utm', {
		maxAge: 60 * 60 * 24 * 30,
		sameSite: 'lax',
	})

	function captureFromRoute() {
		const route = useRoute()
		const found = UTM_KEYS.some((key) => typeof route.query[key] === 'string')
		if (!found) return

		cookie.value = {
			utm_source: (route.query.utm_source as string) ?? null,
			utm_medium: (route.query.utm_medium as string) ?? null,
			utm_campaign: (route.query.utm_campaign as string) ?? null,
			utm_content: (route.query.utm_content as string) ?? null,
		}
	}

	function get(): UtmParams {
		return (
			cookie.value ?? {
				utm_source: null,
				utm_medium: null,
				utm_campaign: null,
				utm_content: null,
			}
		)
	}

	return { captureFromRoute, get }
}
