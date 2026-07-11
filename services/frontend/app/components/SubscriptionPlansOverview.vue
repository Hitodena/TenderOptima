<script lang="ts" setup>
import type { SubscriptionResponse } from '#shared/types'
import type { PricingPlanProps, TabsItem } from '@nuxt/ui'
import {
	PRICING_CURRENCY,
	PRICING_PLANS,
	PRICING_TEASER_DESCRIPTIONS,
	featureTableTitle,
	featureTableTitleMobile,
	featuresForModuleTab,
	isPlanAvailableForTab,
	planTierForTab,
	pricingTierSavings,
	type FeatureValue,
	type PricingModuleTab,
	type PricingPlan,
} from '#shared/constants/pricing'
import { t } from '~/constants/translations'

const props = withDefaults(defineProps<{
	subscription?: SubscriptionResponse | null
}>(), {
	subscription: null,
})

const currentPlan = computed(() => props.subscription?.plan ?? null)
const activeModuleTab = ref<PricingModuleTab>('module1')

const moduleTabItems = computed<TabsItem[]>(() =>
	[
		{ label: 'Модуль 1', value: 'module1' },
		{ label: 'Модуль 2', value: 'module2' },
		{ label: 'М1+М2', value: 'complex' },
	],
)

function formatFeatureValue(value: FeatureValue): string | null {
	if (value === null || value === false) return null
	if (value === true) return null
	if (typeof value === 'number') return value.toLocaleString('ru-RU')
	return String(value)
}

function planFeatures(plan: PricingPlan, tab: PricingModuleTab) {
	const items: Array<{ title: string; icon: string }> = []

	if (plan.isEnterprise) {
		items.push({
			title: t('subscription.enterpriseLimits'),
			icon: 'i-lucide-sliders-horizontal',
		})
		items.push({
			title: 'Приоритетная поддержка',
			icon: 'i-lucide-headphones',
		})
		return items
	}

	if (!isPlanAvailableForTab(plan.id, tab)) {
		items.push({
			title: tab === 'module2'
				? t('subscription.module2UnavailableForMini')
				: t('subscription.complexUnavailableForMini'),
			icon: 'i-lucide-circle-slash',
		})
		return items
	}

	const activeFeatures = featuresForModuleTab(tab)
	for (const feature of activeFeatures) {
		const value = feature.values[plan.id]
		if (value === null || value === false) continue
		const valueText = formatFeatureValue(value)
		items.push({
			title: valueText ? `${feature.name}: ${valueText}` : feature.name,
			icon: 'i-lucide-check',
		})
		if (items.length >= 5) break
	}

	return items
}

function planScope(tab: PricingModuleTab): string {
	if (tab === 'module1') return t('subscription.module1Scope')
	if (tab === 'module2') return t('subscription.module2Scope')
	return t('subscription.complexScope')
}

function buildPricingPlan(plan: PricingPlan): PricingPlanProps {
	const tab = activeModuleTab.value
	const tier = planTierForTab(plan, tab)
	const isCurrent = currentPlan.value === plan.id
	const isUnavailable = !plan.isEnterprise && !isPlanAvailableForTab(plan.id, tab)

	if (plan.isEnterprise) {
		return {
			title: plan.name,
			description: PRICING_TEASER_DESCRIPTIONS[plan.id],
			tagline: t('subscription.enterpriseLimits'),
			price: t('subscription.priceOnRequest'),
			terms: `${t('subscription.enterprisePrice')} · ${t('subscription.priceWithoutVat')}`,
			features: planFeatures(plan, tab),
			orientation: 'horizontal',
			variant: isCurrent ? 'subtle' : 'outline',
			highlight: isCurrent,
			badge: isCurrent
				? { label: t('subscription.currentPlan'), color: 'primary', variant: 'subtle' }
				: undefined,
			ui: {
				root: 'min-w-0 w-full',
				featureTitle: 'text-muted text-sm text-pretty break-words',
				terms: 'text-xs/5 text-muted text-center text-balance break-words',
				title: 'text-highlighted text-xl sm:text-2xl text-pretty font-semibold',
			},
		}
	}

	return {
		title: plan.name,
		description: PRICING_TEASER_DESCRIPTIONS[plan.id],
		tagline: isUnavailable ? t('subscription.unavailablePlan') : planScope(tab),
		price: tier ? tier.monthly.toLocaleString('ru-RU') : undefined,
		billingCycle: tier ? ` ${PRICING_CURRENCY}/${t('subscription.perMonth')}` : undefined,
		billingPeriod: isUnavailable ? undefined : featureTableTitleMobile(tab),
		terms: tier
			? `${t('subscription.sixMonthPayment')}: ${tier.sixMonth.toLocaleString('ru-RU')} ${PRICING_CURRENCY} · −${pricingTierSavings(tier).toLocaleString('ru-RU')} ${PRICING_CURRENCY} · ${t('subscription.priceWithoutVat')}`
			: undefined,
		features: planFeatures(plan, tab),
		orientation: 'horizontal',
		variant: isCurrent ? 'subtle' : 'outline',
		highlight: isCurrent,
		badge: isCurrent
			? { label: t('subscription.currentPlan'), color: 'primary', variant: 'subtle' }
			: plan.isPopular && !isUnavailable
				? { label: t('subscription.popularPlan'), color: 'success', variant: 'subtle' }
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
	PRICING_PLANS.map((plan) => buildPricingPlan(plan)),
)
</script>

<template>
	<div class="min-w-0 space-y-5">
		<UTabs
			v-model="activeModuleTab"
			:items="moduleTabItems"
			:content="false"
			variant="pill"
			:ui="{
				list: 'w-full',
				trigger: 'flex-1 justify-center text-xs sm:text-sm',
			}"
		/>
		<p class="text-sm text-muted">
			{{ featureTableTitle(activeModuleTab) }}
		</p>
		<UPricingPlans
			orientation="vertical"
			:plans="pricingPlans"
			:ui="{ base: 'flex flex-col gap-4 min-w-0' }"
		/>
	</div>
</template>
