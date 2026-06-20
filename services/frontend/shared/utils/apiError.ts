type ValidationErrorItem = { msg?: string }

type ApiErrorResponse = {
	response?: {
		data?: {
			detail?: string | ValidationErrorItem[]
		}
	}
}

export function getApiErrorDetail(error: unknown): string | undefined {
	const detail = (error as ApiErrorResponse)?.response?.data?.detail
	if (typeof detail === 'string') return detail
	if (Array.isArray(detail)) {
		const messages = detail
			.map((item) => item.msg)
			.filter((msg): msg is string => typeof msg === 'string' && msg.length > 0)
		return messages.length > 0 ? messages.join(', ') : undefined
	}
	return undefined
}
