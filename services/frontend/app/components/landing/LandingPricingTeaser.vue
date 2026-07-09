<template>
	<section
		:id="sectionId"
		ref="sectionRef"
		class="reveal py-[var(--landing-section-py)] px-4 sm:px-6 lg:px-8"
	>
		<div class="mx-auto max-w-6xl">
			<header class="mb-10 text-center sm:mb-12">
				<p class="landing-section-headline mb-2">
					Тарифы
				</p>
				<h2 class="landing-section-title mb-4">
					{{ title }}
				</h2>
				<p class="landing-section-description mx-auto">
					{{ description }}
				</p>
			</header>

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<article
					v-for="(plan, index) in planTeasers"
					:key="plan.id"
					class="landing-card landing-pricing-teaser reveal"
					:class="[
						`stagger-${index + 1}`,
						{ 'is-visible': isVisible, 'landing-pricing-teaser-recommended': plan.recommended },
					]"
				>
					<p v-if="plan.recommended" class="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
						Рекомендуем
					</p>
					<h3 class="mb-1 text-lg font-semibold text-highlighted">
						{{ plan.label }}
					</h3>
					<p class="landing-pricing-teaser-price mb-1">
						{{ plan.price }}
					</p>
					<p v-if="plan.period" class="mb-3 text-xs text-muted">
						{{ plan.period }}
					</p>
					<p class="mb-4 flex-1 text-sm leading-relaxed text-muted">
						{{ plan.description }}
					</p>
					<ul class="mb-0 space-y-1.5 text-left text-xs text-muted">
						<li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
							<UIcon name="i-lucide-check" class="mt-0.5 size-3.5 shrink-0 text-primary" />
							<span>{{ feature }}</span>
						</li>
					</ul>
				</article>
			</div>
			<p class="mt-4 text-center text-xs text-muted">
				* Цены указаны без учета НДС.
			</p>

			<div class="mt-10 flex justify-center">
				<BaseButton leading-icon="i-lucide-play-circle" @click="consultation.open()">
					{{ landingCtaLabel }}
				</BaseButton>
			</div>

			
		</div>
	</section>
</template>

<script lang="ts" setup>
import BaseButton from '~/components/landing/BaseButton.vue'
import { LANDING_CTA_LABEL } from '#shared/constants/landing'
import {
	PLAN_CATALOG,
	PLAN_DESCRIPTIONS,
	PLAN_LABELS,
	SUBSCRIPTION_PLAN_ORDER,
} from '#shared/utils/subscriptionDisplay'
import type { SubscriptionPlan } from '#shared/types'

withDefaults(
	defineProps<{
		sectionId?: string
		title?: string
		description?: string
	}>(),
	{
		sectionId: 'pricing',
		title: 'Тариф под задачи вашей команды',
		description: 'От тестового периода до корпоративного пакета с индивидуальными лимитами. Модуль 1 — поиск и рассылка, модуль 2 — анализ ТЗ и КП.',
	},
)

const consultation = useConsultationModal()
const landingCtaLabel = LANDING_CTA_LABEL
const { target: sectionRef, isVisible } = useScrollReveal()

const CURRENCY = 'BYN'

interface PlanTeaser {
	id: SubscriptionPlan
	label: string
	price: string
	period?: string
	description: string
	features: string[]
	recommended: boolean
}

function formatPlanPrice(plan: SubscriptionPlan): { price: string; period?: string } {
	const catalog = PLAN_CATALOG[plan]

	if (plan === 'test') {
		return { price: '0', period: `${CURRENCY}/мес · оба модуля` }
	}
	if (plan === 'corporate') {
		return { price: 'По запросу' }
	}
	if (plan === 'basic' && catalog.price_module_1_monthly) {
		return {
			price: `${catalog.price_module_1_monthly} ${CURRENCY}`,
			period: 'мес · модуль 1',
		}
	}
	if (plan === 'advanced' && catalog.price_bundle_monthly) {
		return {
			price: `${catalog.price_bundle_monthly} ${CURRENCY}`,
			period: 'мес · модули 1+2',
		}
	}

	return { price: '—' }
}

const planTeasers = computed<PlanTeaser[]>(() =>
	SUBSCRIPTION_PLAN_ORDER.map((plan) => {
		const catalog = PLAN_CATALOG[plan]
		const pricing = formatPlanPrice(plan)

		return {
			id: plan,
			label: PLAN_LABELS[plan] ?? plan,
			price: pricing.price,
			period: pricing.period,
			description: PLAN_DESCRIPTIONS[plan],
			features: catalog.features.slice(0, 2),
			recommended: plan === 'advanced',
		}
	}),
)
</script>
