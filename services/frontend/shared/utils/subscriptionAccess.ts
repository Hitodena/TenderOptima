import type { SubscriptionResponse } from '#shared/types'

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
