export default defineNuxtPlugin((nuxtApp) => {
	const { reportError } = useErrorReporter()

	nuxtApp.vueApp.config.errorHandler = (err, _instance, info) => {
		if (!err) return
		const message = err instanceof Error ? err.message : String(err)
		void reportError({
			message: `[Vue] ${message}${info ? ` (${info})` : ''}`,
			backend_response: null,
			page_url: import.meta.client ? window.location.pathname : null,
		})
	}

	window.addEventListener('error', (event) => {
		const message = event.error instanceof Error
			? event.error.message
			: event.message ?? 'Unknown JS error'
		void reportError({
			message: `[JS] ${message}`,
			backend_response: null,
			page_url: window.location.pathname,
		})
	})

	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason
		const message = reason instanceof Error
			? reason.message
			: String(reason ?? 'Unhandled promise rejection')
		void reportError({
			message: `[Promise] ${message}`,
			backend_response: null,
			page_url: window.location.pathname,
		})
	})
})
