import type { Ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'

const POLL_INTERVAL_MS = 3_000

export function useRunStatusPolling<T extends { status?: string }>(
	polling: Ref<boolean>,
	fetchLatest: () => Promise<T | null>,
	onUpdate: (data: T) => void,
	onSuccess?: () => void | Promise<void>,
	onFailure?: () => void | Promise<void>,
	keepPolling?: (data: T) => boolean,
) {
	const { pause, resume } = useIntervalFn(
		async () => {
			if (!polling.value) return
			try {
				const data = await fetchLatest()
				if (!data) return
				onUpdate(data)
				if (data.status === 'processing' || keepPolling?.(data)) return
				polling.value = false
				pause()
				if (data.status === 'active') await onSuccess?.()
				else if (data.status === 'failed') await onFailure?.()
			} catch {
				// ignore transient polling errors
			}
		},
		POLL_INTERVAL_MS,
		{ immediate: false },
	)

	watch(polling, (active) => {
		if (active) resume()
		else pause()
	}, { immediate: true })

	onUnmounted(() => pause())
}
