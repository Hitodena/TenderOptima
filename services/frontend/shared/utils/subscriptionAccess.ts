import type { SubscriptionResponse } from '#shared/types'

export function isTestPlan(
	subscription: SubscriptionResponse | null | undefined,
): boolean {
	return subscription?.plan === 'test'
}

export function emailQuotaRemaining(
	subscription: SubscriptionResponse | null | undefined,
): number | null {
	if (!subscription?.is_active || !subscription.module_1_enabled) return 0
	const limit = subscription.max_emails_per_month
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
	const limit = subscription.max_emails_per_month
	const used = subscription.emails_sent_this_month ?? 0
	if (limit == null) return null
	return `Лимит подписки: ${used.toLocaleString('ru-RU')} из ${limit.toLocaleString('ru-RU')} писем в этом месяце`
}

export function testPlanVisibleSupplierLimit(
	subscription: SubscriptionResponse | null | undefined,
): number | null {
	if (!isTestPlan(subscription)) return null
	return subscription?.max_emails_per_month ?? 10
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
