<script lang="ts" setup>
import type { PricingPlanProps } from '@nuxt/ui'
import type { SubscriptionPlan, SubscriptionResponse } from '#shared/types'
import {
	PLAN_DESCRIPTIONS,
	PLAN_LABELS,
	PLAN_TAGLINES,
	SUBSCRIPTION_PLAN_ORDER,
	catalogForPlan,
	formatEmailsFeature,
	formatKpFeature,
	formatSearchesFeature,
	formatUsageLimit,
} from '#shared/utils/subscriptionDisplay'
import { effectiveEmailLimit } from '#shared/utils/subscriptionAccess'

const props = defineProps<{
	subscription: SubscriptionResponse | null | undefined
}>()

const planLabels = PLAN_LABELS
const emailLimit = computed(() => effectiveEmailLimit(props.subscription))

function formatUsage(used: number | undefined, limit: number | null | undefined) {
	const usedLabel = (used ?? 0).toLocaleString('ru-RU')
	if (limit == null) return `${usedLabel} / ${formatUsageLimit(limit)}`
	return `${usedLabel} / ${limit.toLocaleString('ru-RU')}`
}

const planLabel = computed(() =>
	props.subscription ? planLabels[props.subscription.plan] ?? props.subscription.plan : null,
)

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
		const kp = formatKpFeature(catalog.max_kp_processed_per_month)

		if (searches) {
			items.push({ title: searches, icon: 'i-lucide-search' })
		}
		if (emails) {
			items.push({ title: emails, icon: 'i-lucide-send' })
		}
		if (kp) {
			items.push({ title: kp, icon: 'i-lucide-file-spreadsheet' })
		}
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

	if (plan === 'corporate') {
		return 'Стоимость по запросу · без НДС'
	}
	if (plan === 'test') {
		return 'Бесплатный период ознакомления'
	}

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
		variant: isCurrent ? 'subtle' : 'outline',
		highlight: isCurrent || isRecommended,
		scale: isRecommended && !isCurrent,
		badge: isCurrent
			? { label: 'Ваш тариф', color: 'primary', variant: 'subtle' }
			: isRecommended
				? { label: 'Рекомендуем', color: 'success', variant: 'subtle' }
				: undefined,
	}
}

const pricingPlans = computed(() =>
	SUBSCRIPTION_PLAN_ORDER.map((plan) => buildPricingPlan(plan)),
)
</script>

<template>
	<div v-if="subscription" class="space-y-8">
		<div class="flex flex-wrap items-center gap-2">
			<UBadge
				:color="subscription.is_active ? 'success' : 'neutral'"
				variant="subtle"
				:label="subscription.is_active ? 'Активна' : 'Неактивна'"
			/>
			<UBadge color="primary" variant="subtle" :label="planLabel ?? subscription.plan" />
			<UBadge
				v-if="subscription.module_1_enabled"
				color="neutral"
				variant="outline"
				label="Модуль 1"
			/>
			<UBadge
				v-if="subscription.module_2_enabled"
				color="neutral"
				variant="outline"
				label="Модуль 2"
			/>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<UCard :ui="{ body: 'p-5 space-y-3' }">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
						<UIcon name="i-lucide-mail" class="w-4 h-4 text-primary" />
					</div>
					<p class="text-sm font-semibold">Модуль 1 — использование</p>
				</div>
				<div class="grid gap-2 text-sm">
					<div class="flex justify-between gap-3">
						<span class="text-muted">Поиски</span>
						<span class="font-medium tabular-nums">
							{{ formatUsage(subscription.searches_used_this_month, subscription.max_searches_per_month) }}
						</span>
					</div>
					<div class="flex justify-between gap-3">
						<span class="text-muted">Email</span>
						<span class="font-medium tabular-nums">
							{{ formatUsage(subscription.emails_sent_this_month, emailLimit) }}
						</span>
					</div>
				</div>
			</UCard>

			<UCard :ui="{ body: 'p-5 space-y-3' }">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
						<UIcon name="i-lucide-file-search" class="w-4 h-4 text-primary" />
					</div>
					<p class="text-sm font-semibold">Модуль 2 — использование</p>
				</div>
				<div class="flex justify-between gap-3 text-sm">
					<span class="text-muted">КП в месяц</span>
					<span class="font-medium tabular-nums">
						{{ formatUsage(subscription.kp_processed_this_month, subscription.max_kp_processed_per_month) }}
					</span>
				</div>
			</UCard>
		</div>

		<div>
			<div class="mb-5">
				<h3 class="text-lg font-semibold text-highlighted">Тарифы TenderOptima</h3>
				<p class="text-sm text-muted mt-1">
					Сравните возможности и лимиты по каждому плану
				</p>
			</div>
			<UPricingPlans orientation="vertical" scale compact :plans="pricingPlans" />
		</div>
	</div>

	<div v-else class="space-y-8">
		<div class="flex flex-col items-center justify-center py-10 gap-3">
			<UIcon name="i-lucide-credit-card" class="w-10 h-10 text-muted opacity-40" />
			<p class="text-muted">Подписка не назначена</p>
		</div>

		<div>
			<div class="mb-5">
				<h3 class="text-lg font-semibold text-highlighted">Доступные тарифы</h3>
				<p class="text-sm text-muted mt-1">
					Сравните возможности и лимиты по каждому плану
				</p>
			</div>
			<UPricingPlans orientation="vertical" scale compact :plans="pricingPlans" />
		</div>
	</div>
</template>
