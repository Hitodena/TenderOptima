type CountUpOptions = {
	duration?: number
	prefix?: string
	suffix?: string
	decimals?: number
}

export function useCountUp(
	targetValue: number,
	options: CountUpOptions = {},
) {
	const display = ref('')
	const hasStarted = ref(false)

	const {
		duration = 1500,
		prefix = '',
		suffix = '',
		decimals,
	} = options

	function formatValue(value: number) {
		const rounded = decimals != null
			? value.toFixed(decimals)
			: String(Math.round(value))

		return `${prefix}${rounded}${suffix}`
	}

	function start() {
		if (hasStarted.value) {
			return
		}

		hasStarted.value = true

		if (!import.meta.client) {
			display.value = formatValue(targetValue)
			return
		}

		const prefersReducedMotion = window.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches

		if (prefersReducedMotion) {
			display.value = formatValue(targetValue)
			return
		}

		const startTime = performance.now()

		function tick(now: number) {
			const elapsed = now - startTime
			const progress = Math.min(elapsed / duration, 1)
			const eased = 1 - (1 - progress) ** 3
			const current = targetValue * eased

			display.value = formatValue(current)

			if (progress < 1) {
				requestAnimationFrame(tick)
			} else {
				display.value = formatValue(targetValue)
			}
		}

		display.value = formatValue(0)
		requestAnimationFrame(tick)
	}

	return { display, start, hasStarted }
}
