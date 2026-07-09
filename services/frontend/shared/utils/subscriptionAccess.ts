import type { SubscriptionResponse } from '#shared/types'

export function isTestPlan(
	subscription: SubscriptionResponse | null | undefined,
): boolean {
	return subscription?.plan === 'test'
}

/** Search/auto-found suppliers selectable on trial (excluding manual slot). */
export const TEST_PLAN_SEARCH_SUPPLIER_LIMIT = 10

/** One manually added supplier slot on trial. */
export const TEST_PLAN_MANUAL_SUPPLIER_BONUS = 1

/** Total outbound emails per trial mailing month (10 auto + 1 manual). */
export const TEST_PLAN_EMAIL_LIMIT = TEST_PLAN_SEARCH_SUPPLIER_LIMIT
	+ TEST_PLAN_MANUAL_SUPPLIER_BONUS

export function testPlanEmailLimit(
	subscription: SubscriptionResponse | null | undefined,
): number | null {
	if (!isTestPlan(subscription)) return null
	const stored = subscription?.max_emails_per_month
	if (stored == null) return TEST_PLAN_EMAIL_LIMIT
	return Math.max(stored, TEST_PLAN_EMAIL_LIMIT)
}

export function effectiveEmailLimit(
	subscription: SubscriptionResponse | null | undefined,
): number | null {
	if (!subscription) return null
	const testLimit = testPlanEmailLimit(subscription)
	if (testLimit != null) return testLimit
	return subscription.max_emails_per_month
}

export function emailQuotaRemaining(
	subscription: SubscriptionResponse | null | undefined,
): number | null {
	if (!subscription?.is_active || !subscription.module_1_enabled) return 0
	const limit = effectiveEmailLimit(subscription)
	if (limit == null) return null
	const used = subscription.emails_sent_this_month ?? 0
	return Math.max(0, limit - used)
}

export function canSendEmail(
	subscription: SubscriptionResponse | null | undefined,
	count = 1,
): boolean {
	if (count <= 0) return true
	const remaining = emailQuotaRemaining(subscription)
	if (remaining === null) return Boolean(subscription?.is_active && subscription.module_1_enabled)
	return remaining >= count
}

export function emailQuotaBlockMessage(
	subscription: SubscriptionResponse | null | undefined,
	count = 1,
): string | null {
	if (!subscription) return 'Подписка не назначена'
	if (!subscription.is_active) return 'Подписка неактивна или истекла'
	if (!subscription.module_1_enabled) {
		return 'Модуль 1 (поиск и рассылка) не подключён к вашей подписке'
	}
	if (canSendEmail(subscription, count)) return null
	const limit = effectiveEmailLimit(subscription)
	const used = subscription.emails_sent_this_month ?? 0
	if (limit == null) return null
	return `Лимит подписки: ${used.toLocaleString('ru-RU')} из ${limit.toLocaleString('ru-RU')} писем в этом месяце`
}

export function testPlanVisibleSupplierLimit(
	subscription: SubscriptionResponse | null | undefined,
): number | null {
	if (!isTestPlan(subscription)) return null
	return TEST_PLAN_SEARCH_SUPPLIER_LIMIT
}

export function isManualSupplierSource(
	fromSource: string | null | undefined,
): boolean {
	return fromSource === 'manual'
}

export function testPlanMaxSelectableSuppliers(
	subscription: SubscriptionResponse | null | undefined,
	manualSupplierCount: number,
): number | null {
	if (!isTestPlan(subscription)) return null
	const manualBonus = Math.min(
		TEST_PLAN_MANUAL_SUPPLIER_BONUS,
		Math.max(0, manualSupplierCount),
	)
	return TEST_PLAN_SEARCH_SUPPLIER_LIMIT + manualBonus
}

export function testPlanLockedSuppliersMessage(
	subscription: SubscriptionResponse | null | undefined,
	lockedCount: number,
): string {
	if (!isTestPlan(subscription)) return ''
	const lockedPart =
		lockedCount > 0
			? ` Ещё ${lockedCount} из поиска недоступны из‑за ограничения подписки.`
			: ''
	return (
		`На тестовом тарифе доступны ${TEST_PLAN_SEARCH_SUPPLIER_LIMIT} поставщиков из поиска`
		+ ` и ${TEST_PLAN_MANUAL_SUPPLIER_BONUS} добавленный вручную (до ${TEST_PLAN_EMAIL_LIMIT} писем).${lockedPart}`
	)
}

export function isModule1SearchQuotaExhausted(
	subscription: SubscriptionResponse | null | undefined,
): boolean {
	if (!subscription) return false
	const limit = subscription.max_searches_per_month
	if (limit == null) return false
	return (subscription.searches_used_this_month ?? 0) >= limit
}

export function canStartModule1Work(
	subscription: SubscriptionResponse | null | undefined,
): boolean {
	if (!subscription?.is_active || !subscription.module_1_enabled) return false
	return !isModule1SearchQuotaExhausted(subscription)
}

export function module1WorkBlockMessage(
	subscription: SubscriptionResponse | null | undefined,
): string | null {
	if (!subscription) return 'Подписка не назначена'
	if (!subscription.is_active) return 'Подписка неактивна или истекла'
	if (!subscription.module_1_enabled) {
		return 'Модуль 1 (поиск и рассылка) не подключён к вашей подписке'
	}
	if (isModule1SearchQuotaExhausted(subscription)) {
		const limit = subscription.max_searches_per_month
		const used = subscription.searches_used_this_month ?? 0
		if (limit == null) return null
		return `Лимит подписки: ${used.toLocaleString('ru-RU')} из ${limit.toLocaleString('ru-RU')} поисков в этом месяце`
	}
	return null
}

export function module2UploadLimitHint(
	subscription: SubscriptionResponse | null | undefined,
	platformDefaultBytes: number,
): string {
	const limitBytes = tzKpUploadLimitBytes(subscription, platformDefaultBytes)
	const limitLabel = formatUploadLimitMb(limitBytes)
	return (
		`По вашей подписке можно загружать техническое задание и коммерческие предложения `
		+ `размером до ${limitLabel} на каждый файл. Лимит зависит от тарифа.`
	)
}

export function isModule2KpQuotaExhausted(
	subscription: SubscriptionResponse | null | undefined,
): boolean {
	if (!subscription) return false
	const limit = subscription.max_kp_processed_per_month
	if (limit == null) return false
	return (subscription.kp_processed_this_month ?? 0) >= limit
}

export function canStartModule2Work(
	subscription: SubscriptionResponse | null | undefined,
): boolean {
	if (!subscription?.is_active || !subscription.module_2_enabled) return false
	return !isModule2KpQuotaExhausted(subscription)
}

export function module2WorkBlockMessage(
	subscription: SubscriptionResponse | null | undefined,
): string | null {
	if (!subscription) return 'Подписка не назначена'
	if (!subscription.is_active) return 'Подписка неактивна или истекла'
	if (!subscription.module_2_enabled) {
		return 'Модуль 2 (анализ ТЗ и КП) не подключён к вашей подписке'
	}
	if (isModule2KpQuotaExhausted(subscription)) {
		const limit = subscription.max_kp_processed_per_month
		const used = subscription.kp_processed_this_month ?? 0
		if (limit == null) return null
		return `Лимит подписки: ${used.toLocaleString('ru-RU')} из ${limit.toLocaleString('ru-RU')} КП в этом месяце`
	}
	return null
}

export function tzKpUploadLimitBytes(
	subscription: SubscriptionResponse | null | undefined,
	platformDefault: number,
): number {
	const planLimit = subscription?.max_tz_kp_upload_bytes
	return planLimit ?? platformDefault
}

export function formatUploadLimitMb(bytes: number): string {
	const mb = bytes / (1024 * 1024)
	if (mb < 1) {
		return `${Math.round(bytes / 1024)} КБ`
	}
	return `${Math.round(mb)} МБ`
}
