export function useSequentialSteps(
	stepCount: number,
	isSectionVisible: Ref<boolean>,
	stepDelayMs = 220,
) {
	const visibleCount = ref(0)
	let timers: ReturnType<typeof setTimeout>[] = []

	function clearTimers() {
		for (const timer of timers) {
			clearTimeout(timer)
		}
		timers = []
	}

	function revealAll() {
		visibleCount.value = stepCount
	}

	function startSequence() {
		clearTimers()
		visibleCount.value = 0

		if (!import.meta.client) {
			revealAll()
			return
		}

		const prefersReducedMotion = window.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches

		if (prefersReducedMotion) {
			revealAll()
			return
		}

		for (let index = 0; index < stepCount; index++) {
			const timer = setTimeout(() => {
				visibleCount.value = index + 1
			}, index * stepDelayMs)
			timers.push(timer)
		}
	}

	watch(
		isSectionVisible,
		(visible) => {
			if (visible) {
				startSequence()
			}
		},
		{ immediate: true },
	)

	onUnmounted(clearTimers)

	function isStepVisible(index: number) {
		return visibleCount.value > index
	}

	const timelineProgress = computed(() => {
		if (visibleCount.value <= 0) {
			return 0
		}

		return visibleCount.value / stepCount
	})

	return {
		visibleCount,
		isStepVisible,
		timelineProgress,
	}
}
