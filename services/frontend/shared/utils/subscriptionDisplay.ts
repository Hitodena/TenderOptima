import type { SubscriptionResponse } from '#shared/types'

export const PLAN_LABELS: Record<string, string> = {
	test: 'Тестовый',
	basic: 'Базовый',
	advanced: 'Расширенный',
	corporate: 'Корпоративный',
}

export function subscriptionPlanLabel(
	plan: string | null | undefined,
): string {
	if (!plan) return 'Без тарифа'
	return PLAN_LABELS[plan] ?? plan
}

export function subscriptionModulesSummary(
	subscription: SubscriptionResponse | null | undefined,
): string {
	if (!subscription) return 'Подписка не назначена'
	const modules: string[] = []
	if (subscription.module_1_enabled) modules.push('М1')
	if (subscription.module_2_enabled) modules.push('М2')
	if (modules.length === 0) return 'Модули не подключены'
	return modules.join(' · ')
}

export function subscriptionNavBadge(
	subscription: SubscriptionResponse | null | undefined,
): { label: string; color: 'primary' | 'success' | 'error' | 'neutral' } {
	if (!subscription) {
		return { label: 'Нет', color: 'neutral' }
	}
	if (!subscription.is_active) {
		return { label: 'Неактивна', color: 'error' }
	}
	return {
		label: subscriptionPlanLabel(subscription.plan),
		color: 'primary',
	}
}

export function subscriptionProfilePath(tab = 'subscription'): string {
	return `/profile?tab=${tab}`
}
