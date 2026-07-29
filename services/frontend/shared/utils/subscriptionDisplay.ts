import type { SubscriptionPlan, SubscriptionResponse } from '#shared/types'

export const PLAN_LABELS: Record<string, string> = {
	test: 'Тестовый',
	mini: 'Мини',
	starter: 'Начальный',
	basic: 'Базовый',
	advanced: 'Расширенный',
	extended: 'Расширенный',
	corporate: 'Корпоративный',
}

export type PlanCatalogEntry = {
	max_searches_per_month: number | null
	max_emails_per_month: number | null
	max_kp_processed_per_month: number | null
	max_pages_analyzed_per_month: number | null
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
		max_pages_analyzed_per_month: 40,
		price_module_1_monthly: null,
		price_module_2_monthly: null,
		price_bundle_monthly: null,
		module_1_enabled: true,
		module_2_enabled: true,
		features: [
			'Модуль 1: поиск и рассылка (ограниченный тест)',
			'Модуль 2: анализ ТЗ и КП (до 40 страниц)',
			'Загрузка файлов до 1 МБ',
		],
	},
	mini: {
		max_searches_per_month: 10,
		max_emails_per_month: 200,
		max_kp_processed_per_month: null,
		max_pages_analyzed_per_month: null,
		price_module_1_monthly: '65',
		price_module_2_monthly: null,
		price_bundle_monthly: null,
		module_1_enabled: true,
		module_2_enabled: false,
		features: [
			'Модуль 1: пилотный поиск и рассылка',
			'До 10 поисков и 200 писем в месяц',
			'Модуль 2 недоступен на тарифе Мини',
		],
	},
	starter: {
		max_searches_per_month: 50,
		max_emails_per_month: 1000,
		max_kp_processed_per_month: 7,
		max_pages_analyzed_per_month: 500,
		price_module_1_monthly: '160',
		price_module_2_monthly: '220',
		price_bundle_monthly: '360',
		module_1_enabled: true,
		module_2_enabled: false,
		features: [
			'Модуль 1: поиск, рассылка, inbox, сравнение',
			'До 50 поисков и 1000 писем в месяц',
			'Модуль 2 подключается отдельно',
		],
	},
	basic: {
		max_searches_per_month: 100,
		max_emails_per_month: 2000,
		max_kp_processed_per_month: 20,
		max_pages_analyzed_per_month: 1500,
		price_module_1_monthly: '250',
		price_module_2_monthly: '480',
		price_bundle_monthly: '690',
		module_1_enabled: true,
		module_2_enabled: true,
		features: [
			'Модуль 1 и модуль 2 для регулярных закупок',
			'До 100 поисков, 2000 писем, 1500 страниц в месяц',
			'Анализ ТЗ/КП, экспорт, письма поставщикам',
		],
	},
	advanced: {
		max_searches_per_month: 200,
		max_emails_per_month: 4000,
		max_kp_processed_per_month: 40,
		max_pages_analyzed_per_month: 3000,
		price_module_1_monthly: '400',
		price_module_2_monthly: '770',
		price_bundle_monthly: '1110',
		module_1_enabled: true,
		module_2_enabled: true,
		features: [
			'Legacy id расширенного тарифа',
			'До 200 поисков, 4000 писем, 3000 страниц в месяц',
			'Анализ ТЗ/КП, экспорт, письма поставщикам',
		],
	},
	extended: {
		max_searches_per_month: 200,
		max_emails_per_month: 4000,
		max_kp_processed_per_month: 40,
		max_pages_analyzed_per_month: 3000,
		price_module_1_monthly: '400',
		price_module_2_monthly: '770',
		price_bundle_monthly: '1110',
		module_1_enabled: true,
		module_2_enabled: true,
		features: [
			'Модуль 1 и модуль 2 для высокой нагрузки',
			'До 200 поисков, 4000 писем, 3000 страниц в месяц',
			'Анализ ТЗ/КП, экспорт, письма поставщикам',
		],
	},
	corporate: {
		max_searches_per_month: null,
		max_emails_per_month: null,
		max_kp_processed_per_month: null,
		max_pages_analyzed_per_month: null,
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

export function subscriptionProfilePath(tab = 'acts'): string {
	return `/profile?tab=${tab}`
}

export function subscriptionPlansPath(): string {
	return '/subscription'
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

export function formatPagesFeature(value: number | null | undefined): string | null {
	if (value == null) return null
	return `${value.toLocaleString('ru-RU')} страниц в месяц`
}

export function formatUsageLimit(value: number | null | undefined): string {
	if (value == null) return 'по договору'
	return value.toLocaleString('ru-RU')
}

export const SUBSCRIPTION_EXPIRY_WARNING_DAYS = 14

export type SubscriptionExpiryStatus =
	| 'none'
	| 'unlimited'
	| 'starts_only'
	| 'active'
	| 'warning'
	| 'expired'

export function daysUntilExpiry(
	subscription: SubscriptionResponse | null | undefined,
): number | null {
	if (!subscription?.expires_at) return null
	const expires = new Date(subscription.expires_at)
	if (Number.isNaN(expires.getTime())) return null
	const now = new Date()
	const msPerDay = 1000 * 60 * 60 * 24
	return Math.ceil((expires.getTime() - now.getTime()) / msPerDay)
}

export function subscriptionExpiryStatus(
	subscription: SubscriptionResponse | null | undefined,
): SubscriptionExpiryStatus {
	if (!subscription) return 'none'
	if (!subscription.expires_at) {
		if (!subscription.is_active) return 'none'
		if (subscription.starts_at) return 'starts_only'
		return 'unlimited'
	}
	const days = daysUntilExpiry(subscription)
	if (days == null) return 'none'
	if (days < 0 || !subscription.is_active) return 'expired'
	if (days <= SUBSCRIPTION_EXPIRY_WARNING_DAYS) return 'warning'
	return 'active'
}

export function formatExpiryDate(iso: string | null | undefined): string {
	if (!iso) return ''
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	return date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}

export function formatDaysRemaining(days: number): string {
	const abs = Math.abs(days)
	const mod100 = abs % 100
	const mod10 = abs % 10
	let unit = 'дней'
	if (mod100 < 11 || mod100 > 14) {
		if (mod10 === 1) unit = 'день'
		else if (mod10 >= 2 && mod10 <= 4) unit = 'дня'
	}
	return `${abs} ${unit}`
}

export const SUBSCRIPTION_PLAN_ORDER: SubscriptionPlan[] = [
	'test',
	'mini',
	'starter',
	'basic',
	'extended',
	'corporate',
]

export const PLAN_DESCRIPTIONS: Record<SubscriptionPlan, string> = {
	test: 'Ознакомление с платформой и обоими модулями',
	mini: 'Пилотный запуск модуля поиска и рассылки',
	starter: 'Поиск поставщиков и рассылка для небольших команд',
	basic: 'Сбалансированный объём для регулярных закупок',
	advanced: 'Legacy id расширенного тарифа',
	extended: 'Высокая нагрузка и большое количество закупок',
	corporate: 'Индивидуальные лимиты и сопровождение',
}

export const PLAN_TAGLINES: Record<SubscriptionPlan, string> = {
	test: 'Бесплатный тест',
	mini: 'Пилот',
	starter: 'Старт закупок',
	basic: 'Оптимальный пакет',
	advanced: 'Архивный id',
	extended: 'Высокая нагрузка',
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
