import type { FrontendErrorLogCreate } from '#shared/types'

const DEDUP_WINDOW_MS = 5000

interface DedupeKey {
	message: string
	requestUrl: string | null | undefined
}

const recentKeys = new Map<string, number>()

function makeKey(payload: DedupeKey): string {
	return `${payload.message}||${payload.requestUrl ?? ''}`
}

function isDuplicate(payload: DedupeKey): boolean {
	const key = makeKey(payload)
	const last = recentKeys.get(key)
	const now = Date.now()
	if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
		return true
	}
	recentKeys.set(key, now)
	if (recentKeys.size > 200) {
		const oldest = [...recentKeys.entries()].sort((a, b) => a[1] - b[1])[0]
		if (oldest) recentKeys.delete(oldest[0])
	}
	return false
}

export function useErrorReporter() {
	const config = useRuntimeConfig()
	const auth = useAuthStore()

	async function reportError(payload: FrontendErrorLogCreate): Promise<void> {
		if (!import.meta.client) return
		if (isDuplicate({ message: payload.message, requestUrl: payload.request_url })) return

		const base = config.public.apiBase as string

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		const token = auth.token?.value
		if (token) {
			headers['Authorization'] = `Bearer ${token}`
		}

		try {
			await $fetch(`${base}/feedback/errors`, {
				method: 'POST',
				headers,
				body: payload,
			})
		} catch {
			// silently drop — logging must never cause secondary errors
		}
	}

	return { reportError }
}
