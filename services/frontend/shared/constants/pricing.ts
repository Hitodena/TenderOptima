export type PricingPlanId =
	| 'mini'
	| 'starter'
	| 'basic'
	| 'extended'
	| 'corporate'

export type PricingModuleTab = 'module1' | 'module2' | 'complex'

export type FeatureValue = boolean | string | number | null

export interface PlanPricingTier {
	monthly: number
	sixMonth: number
}

export interface PricingPlan {
	id: PricingPlanId
	name: string
	isPopular: boolean
	prices: {
		module1: PlanPricingTier | null
		module2: PlanPricingTier | null
		complex: PlanPricingTier | null
	}
	ctaText: string
	isEnterprise?: boolean
}

export interface PricingFeature {
	name: string
	tooltipDescription?: string
	values: Record<PricingPlanId, FeatureValue>
}

export interface PricingFeatureCategory {
	id: string
	title: string
	subtitle?: string
	features: PricingFeature[]
}

export const PRICING_CURRENCY = 'BYN'

export const PRICING_BILLING = {
	monthly: {
		label: 'Ежемесячно',
		shortLabel: 'Месяц',
	},
	sixMonths: {
		label: 'Оплата за 6 месяцев',
		discountLabel: 'Скидка 10%',
		months: 6,
		discountRate: 0.1,
	},
} as const

export const PRICING_MODULE_TABS: {
	value: PricingModuleTab
	label: string
	labelMobile?: string
}[] = [
	{ value: 'module1', label: 'Модуль 1' },
	{ value: 'module2', label: 'Модуль 2' },
	{
		value: 'complex',
		label: 'Комплексный тариф (-5%)',
		labelMobile: 'М1+М2',
	},
]

export const PRICING_PLANS: PricingPlan[] = [
	{
		id: 'mini',
		name: 'Мини',
		isPopular: false,
		prices: {
			module1: { monthly: 65, sixMonth: 350 },
			module2: null,
			complex: null,
		},
		ctaText: 'Выбрать тариф',
	},
	{
		id: 'starter',
		name: 'Начальный',
		isPopular: false,
		prices: {
			module1: { monthly: 160, sixMonth: 864 },
			module2: { monthly: 220, sixMonth: 1188 },
			complex: { monthly: 360, sixMonth: 1944 },
		},
		ctaText: 'Выбрать тариф',
	},
	{
		id: 'basic',
		name: 'Базовый',
		isPopular: true,
		prices: {
			module1: { monthly: 250, sixMonth: 1350 },
			module2: { monthly: 480, sixMonth: 2592 },
			complex: { monthly: 690, sixMonth: 3726 },
		},
		ctaText: 'Выбрать тариф',
	},
	{
		id: 'extended',
		name: 'Расширенный',
		isPopular: false,
		prices: {
			module1: { monthly: 400, sixMonth: 2160 },
			module2: { monthly: 770, sixMonth: 4158 },
			complex: { monthly: 1110, sixMonth: 5994 },
		},
		ctaText: 'Выбрать тариф',
	},
	{
		id: 'corporate',
		name: 'Корпоративный',
		isPopular: false,
		prices: {
			module1: null,
			module2: null,
			complex: null,
		},
		ctaText: 'Связаться с нами',
		isEnterprise: true,
	},
]

const MODULE_1_FEATURES: PricingFeature[] = [
	{
		name: 'Поиск поставщиков, количество поисковых запросов в месяц, шт.',
		values: {
			mini: 10,
			starter: 50,
			basic: 100,
			extended: 200,
			corporate: 'Индивидуально',
		},
	},
	{
		name: 'Отправка запросов на получение КП у поставщиков (email/мес)',
		values: {
			mini: 'до 200',
			starter: 'до 1 000',
			basic: 'до 2 000',
			extended: 'до 4 000',
			corporate: 'Индивидуально',
		},
	},
	{
		name: 'Автообработка входящих предложений поставщиков',
		values: {
			mini: true,
			starter: true,
			basic: true,
			extended: true,
			corporate: true,
		},
	},
	{
		name: 'Формирование сравнительной таблицы с результатами',
		values: {
			mini: true,
			starter: true,
			basic: true,
			extended: true,
			corporate: true,
		},
	},
	{
		name: 'Генерация дополнительных писем (запрос доп. инфо, снижение цены)',
		values: {
			mini: true,
			starter: true,
			basic: true,
			extended: true,
			corporate: true,
		},
	},
	{
		name: 'Скачивание результатов в Excel',
		values: {
			mini: true,
			starter: true,
			basic: true,
			extended: true,
			corporate: true,
		},
	},
]

const MODULE_2_FEATURES: PricingFeature[] = [
	{
		name: 'Объём анализа текстов (символов/мес)',
		tooltipDescription:
			'Лимит символов для извлечения требований из ТЗ и сверки с КП. '
			+ '100 000 символов ≈ 50 страниц плотного текста А4.',
		values: {
			mini: null,
			starter: '1 млн символов (~500 стр.)',
			basic: '3 млн символов (~1 500 стр.)',
			extended: '6 млн символов (~3 000 стр.)',
			corporate: 'Индивидуальный объём',
		},
	},
	{
		name: 'Автопроверка соответствия КП к ТЗ',
		values: {
			mini: null,
			starter: true,
			basic: true,
			extended: true,
			corporate: 'Включено',
		},
	},
	{
		name: 'Формирование писем о расхождениях',
		values: {
			mini: null,
			starter: true,
			basic: true,
			extended: true,
			corporate: 'Включено',
		},
	},
	{
		name: 'Скачивание результатов в Excel',
		values: {
			mini: null,
			starter: true,
			basic: true,
			extended: true,
			corporate: 'Включено',
		},
	},
]

const TOP_UP_FEATURES: PricingFeature[] = [
	{
		name: 'Дополнительные Email (за 100 шт.), BYN',
		tooltipDescription:
			'Докупка пакета из 100 исходящих писем при превышении лимита тарифа.',
		values: {
			mini: 20,
			starter: 20,
			basic: 20,
			extended: 20,
			corporate: 'Индивидуально',
		},
	},
	{
		name: 'Дополнительные символы (за 100 000 шт., ≈ 50 стр. текста), BYN',
		tooltipDescription:
			'Докупка объёма анализа текстов для модуля 2.',
		values: {
			mini: null,
			starter: 25,
			basic: 25,
			extended: 25,
			corporate: 'Индивидуально',
		},
	},
]

export const PRICING_FEATURE_CATEGORIES: PricingFeatureCategory[] = [
	{
		id: 'module-1',
		title: 'Модуль 1: поиск поставщиков, отправка и обработка запросов',
		features: MODULE_1_FEATURES,
	},
	{
		id: 'module-2',
		title: 'Модуль 2: технический анализ КП на соответствие ТЗ',
		features: MODULE_2_FEATURES,
	},
	{
		id: 'top-ups',
		title: 'Пакеты расширения',
		subtitle: 'При перерасходе лимита по тарифу',
		features: TOP_UP_FEATURES,
	},
]

export function isPlanAvailableForTab(
	planId: PricingPlanId,
	tab: PricingModuleTab,
): boolean {
	if (planId === 'mini') return tab === 'module1'
	return true
}

export function planTierForTab(
	plan: PricingPlan,
	tab: PricingModuleTab,
): PlanPricingTier | null {
	if (plan.isEnterprise) return null
	if (!isPlanAvailableForTab(plan.id, tab)) return null
	return plan.prices[tab]
}

export function featuresForModuleTab(tab: PricingModuleTab): PricingFeature[] {
	if (tab === 'module1') {
		return [...MODULE_1_FEATURES, TOP_UP_FEATURES[0]!]
	}
	if (tab === 'module2') {
		return [...MODULE_2_FEATURES, TOP_UP_FEATURES[1]!]
	}
	return [...MODULE_1_FEATURES, ...MODULE_2_FEATURES, ...TOP_UP_FEATURES]
}

export function featureTableTitle(tab: PricingModuleTab): string {
	if (tab === 'module1') {
		return PRICING_FEATURE_CATEGORIES[0]!.title
	}
	if (tab === 'module2') {
		return PRICING_FEATURE_CATEGORIES[1]!.title
	}
	return 'Комплексный тариф: модуль 1 + модуль 2'
}

export function featureTableTitleMobile(tab: PricingModuleTab): string {
	if (tab === 'module1') {
		return 'Модуль 1. Поиск поставщиков'
	}
	if (tab === 'module2') {
		return 'Модуль 2. Анализ КП на соответствие'
	}
	return 'М1+М2'
}

export function pricingTierSavings(tier: PlanPricingTier): number {
	return tier.monthly * PRICING_BILLING.sixMonths.months - tier.sixMonth
}

export function pricingDisplayMonthly(
	tier: PlanPricingTier,
	isSixMonthBilling: boolean,
): number {
	if (!isSixMonthBilling) return tier.monthly
	return Math.round(tier.sixMonth / PRICING_BILLING.sixMonths.months)
}

/** Landing teaser block: plan order and short copy (aligned with PRICING_PLANS). */
export const PRICING_TEASER_ORDER: PricingPlanId[] = [
	'mini',
	'starter',
	'basic',
	'extended',
	'corporate',
]

export const PRICING_TEASER_DESCRIPTIONS: Record<PricingPlanId, string> = {
	mini: 'Пилотный запуск модуля поиска и рассылки',
	starter: 'Поиск поставщиков и рассылка для небольших команд',
	basic: 'Сбалансированный объём для регулярных закупок',
	extended: 'Высокая нагрузка. Большое количество закупок.',
	corporate: 'Индивидуальные лимиты',
}

export interface PricingTeaserDisplay {
	id: PricingPlanId
	label: string
	price: string
	period?: string
	description: string
	moduleScopeLabel?: string
	features: string[]
	recommended: boolean
	disabled: boolean
	unavailable?: boolean
}

function teaserModuleScopeLabel(
	planId: PricingPlanId,
	tab: PricingModuleTab,
): string | undefined {
	if (planId === 'corporate') return undefined
	if (planId === 'mini') return 'Функционал Модуля 1'
	if (tab === 'complex') return 'Функционал Модуля 1 и 2'
	return undefined
}

function formatTeaserFeatureValue(value: FeatureValue): string | null {
	if (value === null || value === false) return null
	if (value === true) return null
	if (typeof value === 'number') {
		return value.toLocaleString('ru-RU')
	}
	return String(value)
}

function teaserFeaturesForPlan(
	planId: PricingPlanId,
	tab: PricingModuleTab,
): string[] {
	if (planId === 'corporate' || tab === 'complex') {
		return []
	}

	if (tab === 'module2') {
		const volume = MODULE_2_FEATURES[0]!.values[planId]
		const volumeText = formatTeaserFeatureValue(volume)
		const features: string[] = []
		if (volumeText) {
			features.push(`Объём анализа: ${volumeText}`)
		}
		if (MODULE_2_FEATURES[1]!.values[planId]) {
			features.push('Автопроверка соответствия КП к ТЗ')
		}
		return features.slice(0, 2)
	}

	const searches = MODULE_1_FEATURES[0]!.values[planId]
	const emails = MODULE_1_FEATURES[1]!.values[planId]
	const features: string[] = []

	const searchesText = formatTeaserFeatureValue(searches)
	if (searchesText) {
		features.push(`${searchesText} поисковых запросов в месяц`)
	}

	const emailsText = formatTeaserFeatureValue(emails)
	if (emailsText) {
		features.push(`${emailsText} email в месяц`)
	}

	return features.slice(0, 2)
}

function teaserDisplayFields(
	planId: PricingPlanId,
	tab: PricingModuleTab,
): Pick<PricingTeaserDisplay, 'features' | 'moduleScopeLabel'> {
	return {
		moduleScopeLabel: teaserModuleScopeLabel(planId, tab),
		features: teaserFeaturesForPlan(planId, tab),
	}
}

export function pricingTeaserForPlan(
	plan: PricingPlan,
	tab: PricingModuleTab,
): PricingTeaserDisplay {
	const base = {
		id: plan.id,
		label: plan.name,
		description: PRICING_TEASER_DESCRIPTIONS[plan.id],
		recommended: plan.isPopular,
	}

	if (plan.isEnterprise) {
		return {
			...base,
			price: 'По запросу',
			...teaserDisplayFields(plan.id, tab),
			disabled: false,
		}
	}

	if (!isPlanAvailableForTab(plan.id, tab)) {
		return {
			...base,
			price: 'Доступно только в Модуле 1',
			features: [],
			disabled: true,
			unavailable: true,
		}
	}

	const tier = planTierForTab(plan, tab)
	if (!tier) {
		return {
			...base,
			price: '-',
			...teaserDisplayFields(plan.id, tab),
			disabled: false,
		}
	}

	return {
		...base,
		price: tier.monthly.toLocaleString('ru-RU'),
		period: `${PRICING_CURRENCY}/мес`,
		...teaserDisplayFields(plan.id, tab),
		disabled: false,
	}
}

export function pricingTeaserPlans(
	tab: PricingModuleTab = 'module1',
): PricingTeaserDisplay[] {
	return PRICING_TEASER_ORDER
		.map((id) => PRICING_PLANS.find((plan) => plan.id === id))
		.filter((plan): plan is PricingPlan => plan != null)
		.map((plan) => pricingTeaserForPlan(plan, tab))
}
