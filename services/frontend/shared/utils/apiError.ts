type ValidationErrorItem = { msg?: string }

export type SubscriptionErrorCode =
	| 'subscription_limit'
	| 'subscription_inactive'
	| 'subscription_required'
	| 'subscription_module_disabled'

type SubscriptionLimitDetail = {
	code?: SubscriptionErrorCode | string
	resource?: string
	limit?: number
	used?: number
	requested?: number
	message?: string
	module?: number
}

type ApiErrorResponse = {
	response?: {
		data?: {
			detail?: string | ValidationErrorItem[] | SubscriptionLimitDetail
		}
	}
}

export type ParsedApiError = {
	message: string
	isSubscription: boolean
	subscriptionCode?: SubscriptionErrorCode
	subscriptionPath: string
}

const RESOURCE_LABELS: Record<string, string> = {
	searches: 'поисков',
	emails: 'писем',
	kp_processed: 'КП',
	pages_analyzed: 'страниц',
}

const SUBSCRIPTION_CODES = new Set<string>([
	'subscription_limit',
	'subscription_inactive',
	'subscription_required',
	'subscription_module_disabled',
])

function formatSubscriptionDetail(detail: SubscriptionLimitDetail): string | undefined {
	if (detail.code === 'subscription_limit') {
		const label = RESOURCE_LABELS[detail.resource ?? ''] ?? 'операций'
		const limit = detail.limit?.toLocaleString('ru-RU') ?? '—'
		const used = detail.used?.toLocaleString('ru-RU') ?? '—'
		return `Лимит подписки: ${used} из ${limit} ${label} в этом месяце`
	}
	if (detail.code === 'subscription_inactive') {
		return 'Подписка неактивна или истекла'
	}
	if (detail.code === 'subscription_required') {
		return 'Подписка не назначена'
	}
	if (detail.code === 'subscription_module_disabled') {
		if (detail.module === 1) {
			return 'Модуль 1 (поиск и рассылка) не подключён к вашей подписке'
		}
		if (detail.module === 2) {
			return 'Модуль 2 (анализ ТЗ и КП) не подключён к вашей подписке'
		}
		return 'Модуль недоступен по вашей подписке'
	}
	if (typeof detail.message === 'string' && detail.message.length > 0) {
		return detail.message
	}
	return undefined
}

function extractDetail(error: unknown): unknown {
	return (error as ApiErrorResponse)?.response?.data?.detail
}

export function parseApiError(error: unknown): ParsedApiError | null {
	if (error instanceof Error && error.message && !(error as ApiErrorResponse).response) {
		return {
			message: error.message,
			isSubscription: false,
			subscriptionPath: '/subscription',
		}
	}

	const detail = extractDetail(error)
	if (typeof detail === 'string' && detail.trim()) {
		return {
			message: detail,
			isSubscription: false,
			subscriptionPath: '/subscription',
		}
	}

	if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
		const subscriptionDetail = detail as SubscriptionLimitDetail
		const message = formatSubscriptionDetail(subscriptionDetail)
		if (message) {
			const code = subscriptionDetail.code
			return {
				message,
				isSubscription: Boolean(code && SUBSCRIPTION_CODES.has(code)),
				subscriptionCode: SUBSCRIPTION_CODES.has(code ?? '')
					? (code as SubscriptionErrorCode)
					: undefined,
				subscriptionPath: '/subscription',
			}
		}
	}

	if (Array.isArray(detail)) {
		const messages = detail
			.map((item) => item.msg)
			.filter((msg): msg is string => typeof msg === 'string' && msg.length > 0)
		if (messages.length > 0) {
			return {
				message: messages.join(', '),
				isSubscription: false,
				subscriptionPath: '/subscription',
			}
		}
	}

	return null
}

export type SubscriptionLimitInfo = {
	code?: SubscriptionErrorCode
	resource?: string
	limit?: number
	used?: number
	requested?: number
	module?: number
	remaining?: number
}

export function getSubscriptionLimitInfo(
	error: unknown,
): SubscriptionLimitInfo | null {
	const detail = extractDetail(error)
	if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
		return null
	}
	const subscriptionDetail = detail as SubscriptionLimitDetail
	const code = subscriptionDetail.code
	if (!code || !SUBSCRIPTION_CODES.has(code)) return null
	const limit = subscriptionDetail.limit
	const used = subscriptionDetail.used
	const remaining =
		typeof limit === 'number' && typeof used === 'number'
			? Math.max(0, limit - used)
			: undefined
	return {
		code: code as SubscriptionErrorCode,
		resource: subscriptionDetail.resource,
		limit,
		used,
		requested: subscriptionDetail.requested,
		module: subscriptionDetail.module,
		remaining,
	}
}

export function isPagesQuotaExceededError(error: unknown): boolean {
	const info = getSubscriptionLimitInfo(error)
	return (
		info?.code === 'subscription_limit'
		&& info.resource === 'pages_analyzed'
	)
}

export function getApiErrorDetail(error: unknown): string | undefined {
	return parseApiError(error)?.message
}

export function isSubscriptionApiError(error: unknown): boolean {
	return parseApiError(error)?.isSubscription ?? false
}
