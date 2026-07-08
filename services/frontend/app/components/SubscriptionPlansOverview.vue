<script lang="ts" setup>
import type { SubscriptionPlan, SubscriptionResponse } from '#shared/types'
import {
	PLAN_DESCRIPTIONS,
	PLAN_LABELS,
	PLAN_TAGLINES,
	SUBSCRIPTION_PLAN_ORDER,
	catalogForPlan,
	formatEmailsFeature,
	formatPagesFeature,
	formatSearchesFeature,
} from '#shared/utils/subscriptionDisplay'
import type { PricingPlanProps } from '@nuxt/ui'

const props = defineProps<{
	subscription: SubscriptionResponse | null | undefined
}>()

const planLabels = PLAN_LABELS
const currentPlan = computed(() => props.subscription?.plan ?? null)
const currencyCode = computed(() => props.subscription?.currency_code ?? 'BYN')

function planFeatures(plan: SubscriptionPlan) {
	const catalog = catalogForPlan(plan)
	const items: Array<{ title: string; icon: string }> = []

	if (catalog.module_1_enabled) {
		items.push({
			title: 'Модуль 1 — поиск, рассылка, inbox',
			icon: 'i-lucide-mail',
		})
	}
	if (catalog.module_2_enabled) {
		items.push({
			title: 'Модуль 2 — анализ ТЗ/КП, экспорт, письма',
			icon: 'i-lucide-file-search',
		})
	} else if (plan === 'basic') {
		items.push({
			title: 'Модуль 2 подключается отдельно',
			icon: 'i-lucide-puzzle',
		})
	}

	if (plan === 'corporate') {
		items.push({
			title: 'Лимиты и стоимость согласуются индивидуально',
			icon: 'i-lucide-sliders-horizontal',
		})
	} else {
		const searches = formatSearchesFeature(catalog.max_searches_per_month)
		const emails = formatEmailsFeature(catalog.max_emails_per_month)
		const pages = formatPagesFeature(catalog.max_pages_analyzed_per_month)

		if (searches) items.push({ title: searches, icon: 'i-lucide-search' })
		if (emails) items.push({ title: emails, icon: 'i-lucide-send' })
		if (pages) items.push({ title: pages, icon: 'i-lucide-file-spreadsheet' })
	}

	if (catalog.module_1_enabled) {
		items.push({
			title: 'ИИ-обработка ответов и сравнительная таблица',
			icon: 'i-lucide-table',
		})
		items.push({
			title: 'Формирование дополнительных писем',
			icon: 'i-lucide-mail-plus',
		})
	}

	if (catalog.module_2_enabled) {
		items.push({
			title: 'Письма поставщикам с готовыми шаблонами',
			icon: 'i-lucide-file-text',
		})
	}

	if (plan === 'test') {
		items.push({
			title: 'Загрузка файлов до 1 МБ',
			icon: 'i-lucide-upload',
		})
	}
	if (plan === 'corporate') {
		items.push({
			title: 'Приоритетная поддержка',
			icon: 'i-lucide-headphones',
		})
	}

	return items
}

function planPricingTerms(plan: SubscriptionPlan): string | undefined {
	const catalog = catalogForPlan(plan)
	const currency = currencyCode.value

	if (plan === 'corporate') return 'Стоимость по запросу · без НДС'
	if (plan === 'test') return 'Бесплатный период ознакомления'

	const parts: string[] = []
	if (catalog.price_module_1_monthly) {
		parts.push(`М1: ${catalog.price_module_1_monthly} ${currency}`)
	}
	if (catalog.price_module_2_monthly) {
		parts.push(`М2: ${catalog.price_module_2_monthly} ${currency}`)
	}
	if (catalog.price_bundle_monthly) {
		parts.push(`М1+2: ${catalog.price_bundle_monthly} ${currency}`)
	}

	return parts.length > 0 ? `${parts.join(' · ')} · без НДС` : undefined
}

function buildPricingPlan(plan: SubscriptionPlan): PricingPlanProps {
	const catalog = catalogForPlan(plan)
	const isCurrent = currentPlan.value === plan
	const isRecommended = plan === 'advanced'
	const currency = currencyCode.value

	let price: string | undefined
	let billingCycle: string | undefined
	let billingPeriod: string | undefined
	let tagline = PLAN_TAGLINES[plan]

	if (plan === 'test') {
		price = '0'
		billingCycle = ` ${currency}/мес`
		billingPeriod = 'Оба модуля'
	} else if (plan === 'corporate') {
		price = 'По запросу'
		tagline = 'Индивидуальный расчёт'
	} else if (plan === 'basic' && catalog.price_module_1_monthly) {
		price = `${catalog.price_module_1_monthly}`
		billingCycle = ` ${currency}/мес`
		billingPeriod = 'Модуль 1'
	} else if (plan === 'advanced' && catalog.price_bundle_monthly) {
		price = `${catalog.price_bundle_monthly}`
		billingCycle = ` ${currency}/мес`
		billingPeriod = 'Модуль 1+2'
	}

	return {
		title: planLabels[plan] ?? plan,
		description: PLAN_DESCRIPTIONS[plan],
		tagline,
		price,
		billingCycle,
		billingPeriod: plan === 'corporate' ? undefined : billingPeriod,
		terms: planPricingTerms(plan),
		features: planFeatures(plan),
		orientation: 'horizontal',
		variant: isCurrent ? 'subtle' : 'outline',
		highlight: isCurrent,
		badge: isCurrent
			? { label: 'Ваш тариф', color: 'primary', variant: 'subtle' }
			: isRecommended
				? { label: 'Рекомендуем', color: 'success', variant: 'subtle' }
				: undefined,
		ui: {
			root: 'min-w-0 w-full',
			featureTitle: 'text-muted text-sm text-pretty break-words',
			terms: 'text-xs/5 text-muted text-center text-balance break-words',
			title: 'text-highlighted text-xl sm:text-2xl text-pretty font-semibold',
		},
	}
}

const pricingPlans = computed(() =>
	SUBSCRIPTION_PLAN_ORDER.map((plan) => buildPricingPlan(plan)),
)
</script>

<template>
	<div class="min-w-0">
		<UPricingPlans
			orientation="vertical"
			:plans="pricingPlans"
			:ui="{ base: 'flex flex-col gap-4 min-w-0' }"
		/>
	</div>
</template>
