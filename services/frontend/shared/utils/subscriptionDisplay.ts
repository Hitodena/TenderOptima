import type { SubscriptionPlan, SubscriptionResponse } from '#shared/types'

export const PLAN_LABELS: Record<string, string> = {
	test: 'Тестовый',
	basic: 'Базовый',
	advanced: 'Расширенный',
	corporate: 'Корпоративный',
}

export type PlanCatalogEntry = {
	max_searches_per_month: number | null
	max_emails_per_month: number | null
	max_kp_processed_per_month: number | null
	price_module_1_monthly: string | null
	price_module_2_monthly: string | null
	price_bundle_monthly: string | null
	module_1_enabled: boolean
	module_2_enabled: boolean
	features: string[]
}

export const PLAN_CATALOG: Record<SubscriptionPlan, PlanCatalogEntry> = {
	test: {
		max_searches_per_month: 5,
		max_emails_per_month: 11,
		max_kp_processed_per_month: 2,
		price_module_1_monthly: null,
		price_module_2_monthly: null,
		price_bundle_monthly: null,
		module_1_enabled: true,
		module_2_enabled: true,
		features: [
			'Модуль 1: поиск и рассылка (ограниченный тест)',
			'Модуль 2: анализ ТЗ и КП (до 2 КП)',
			'Загрузка файлов до 1 МБ',
		],
	},
	basic: {
		max_searches_per_month: 50,
		max_emails_per_month: 1000,
		max_kp_processed_per_month: 7,
		price_module_1_monthly: '160',
		price_module_2_monthly: '220',
		price_bundle_monthly: '340',
		module_1_enabled: true,
		module_2_enabled: false,
		features: [
			'Модуль 1: поиск, рассылка, inbox, сравнение',
			'До 50 поисков и 1000 писем в месяц',
			'Модуль 2 подключается отдельно',
		],
	},
	advanced: {
		max_searches_per_month: 150,
		max_emails_per_month: 2500,
		max_kp_processed_per_month: 20,
		price_module_1_monthly: '250',
		price_module_2_monthly: '480',
		price_bundle_monthly: '690',
		module_1_enabled: true,
		module_2_enabled: true,
		features: [
			'Модуль 1 и модуль 2 в одной подписке',
			'До 150 поисков, 2500 писем, 20 КП в месяц',
			'Анализ ТЗ/КП, экспорт, письма поставщикам',
		],
	},
	corporate: {
		max_searches_per_month: null,
		max_emails_per_month: null,
		max_kp_processed_per_month: null,
		price_module_1_monthly: null,
		price_module_2_monthly: null,
		price_bundle_monthly: null,
		module_1_enabled: true,
		module_2_enabled: true,
		features: [
			'Оба модуля без стандартных лимитов',
			'Индивидуальные лимиты и цены',
			'Приоритетная поддержка',
		],
	},
}

export function catalogForPlan(plan: SubscriptionPlan): PlanCatalogEntry {
	return PLAN_CATALOG[plan] ?? PLAN_CATALOG.basic
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

export function formatPlanLimit(value: number | null | undefined): string {
	if (value == null) return 'индивидуально'
	return value.toLocaleString('ru-RU')
}

export function formatSearchesFeature(value: number | null | undefined): string | null {
	if (value == null) return null
	return `${value.toLocaleString('ru-RU')} поисковых запросов в месяц`
}

export function formatEmailsFeature(value: number | null | undefined): string | null {
	if (value == null) return null
	return `До ${value.toLocaleString('ru-RU')} emails в месяц`
}

export function formatKpFeature(value: number | null | undefined): string | null {
	if (value == null) return null
	return `${value.toLocaleString('ru-RU')} КП в месяц`
}

export function formatUsageLimit(value: number | null | undefined): string {
	if (value == null) return 'по договору'
	return value.toLocaleString('ru-RU')
}

export const SUBSCRIPTION_PLAN_ORDER: SubscriptionPlan[] = [
	'test',
	'basic',
	'advanced',
	'corporate',
]

export const PLAN_DESCRIPTIONS: Record<SubscriptionPlan, string> = {
	test: 'Ознакомление с платформой и обоими модулями',
	basic: 'Поиск поставщиков и рассылка для небольших команд',
	advanced: 'Полный цикл: поиск, inbox и анализ ТЗ/КП',
	corporate: 'Индивидуальные лимиты и сопровождение',
}

export const PLAN_TAGLINES: Record<SubscriptionPlan, string> = {
	test: 'Бесплатный тест',
	basic: 'Старт закупок',
	advanced: 'Оптимальный пакет',
	corporate: 'Enterprise',
}

export function planModulePriceSum(catalog: PlanCatalogEntry): number | null {
	if (!catalog.price_module_1_monthly && !catalog.price_module_2_monthly) {
		return null
	}
	const m1 = Number(catalog.price_module_1_monthly ?? 0)
	const m2 = Number(catalog.price_module_2_monthly ?? 0)
	return m1 + m2
}
