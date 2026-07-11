type ScrollRevealOptions = {
	threshold?: number
	rootMargin?: string
	once?: boolean
}

export function useScrollReveal(options: ScrollRevealOptions = {}) {
	const target = ref<HTMLElement | null>(null)
	const isVisible = ref(false)

	const {
		threshold = 0.2,
		rootMargin = '0px 0px -40px 0px',
		once = true,
	} = options

	onMounted(() => {
		if (!import.meta.client) {
			isVisible.value = true
			return
		}

		const element = target.value
		if (!element) {
			return
		}

		const prefersReducedMotion = window.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches

		if (prefersReducedMotion) {
			isVisible.value = true
			element.classList.add('is-visible')
			return
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) {
					if (!once) {
						isVisible.value = false
					}
					return
				}

				isVisible.value = true
				element.classList.add('is-visible')

				if (once) {
					observer.disconnect()
				}
			},
			{ threshold, rootMargin },
		)

		observer.observe(element)

		onUnmounted(() => {
			observer.disconnect()
		})
	})

	return { target, isVisible }
}
