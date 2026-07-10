<template>
	<section
		:id="sectionId"
		ref="sectionRef"
		class="reveal py-[var(--landing-section-py)] px-4 sm:px-6 lg:px-8"
	>
		<div class="mx-auto max-w-7xl">
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

			<div class="pricing-module-tabs mx-auto mb-8 max-w-3xl sm:mb-10">
				<UTabs
					v-model="activeModuleTab"
					:items="moduleTabItems"
					:content="false"
					variant="pill"
					:ui="{
						list: 'pricing-module-tabs__list w-full',
						trigger: 'flex-1 justify-center text-xs sm:text-sm',
					}"
				/>
			</div>

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
				<article
					v-for="(plan, index) in planTeasers"
					:key="plan.id"
					class="landing-card landing-pricing-teaser reveal"
					:class="[
						`stagger-${index + 1}`,
						{
							'is-visible': isVisible,
							'landing-pricing-teaser-recommended': plan.recommended && !plan.disabled,
							'landing-pricing-teaser--disabled': plan.disabled,
						},
					]"
				>
					<p v-if="plan.recommended && !plan.disabled" class="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
						Рекомендуем
					</p>
					<h3 class="mb-1 text-lg font-semibold text-highlighted">
						{{ plan.label }}
					</h3>
					<p
						class="mb-1"
						:class="plan.unavailable
							? 'text-sm leading-snug text-muted'
							: 'landing-pricing-teaser-price'"
					>
						{{ plan.price }}
					</p>
					<p v-if="plan.period" class="mb-3 text-xs text-muted">
						{{ plan.period }}
					</p>
					<p
						v-else-if="!plan.unavailable"
						class="mb-3"
					/>
					<p class="mb-4 flex-1 text-sm leading-relaxed text-muted">
						{{ plan.description }}
					</p>
					<div
						v-if="plan.moduleScopeLabel || plan.features.length"
						class="text-left text-xs text-muted"
					>
						<p v-if="plan.moduleScopeLabel">
							{{ plan.moduleScopeLabel }}
						</p>
						<ul v-if="plan.features.length" class="mb-0 mt-2 space-y-1.5">
							<li
								v-for="feature in plan.features"
								:key="feature"
								class="flex items-start gap-2"
							>
								<UIcon
									name="i-lucide-check"
									class="mt-0.5 size-3.5 shrink-0 text-primary"
								/>
								<span>{{ feature }}</span>
							</li>
						</ul>
					</div>
				</article>
			</div>

			<div class="pricing-teaser-details mt-6 sm:mt-8">
				<button
					type="button"
					class="pricing-teaser-details__trigger"
					:aria-expanded="detailsOpen"
					@click="detailsOpen = !detailsOpen"
				>
					<span class="min-w-0 text-left text-sm font-medium text-highlighted sm:text-base">
						{{ featureTableTitle(activeModuleTab) }}
					</span>
					<UIcon
						:name="detailsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
						class="size-5 shrink-0 text-muted"
						aria-hidden="true"
					/>
				</button>
				<div
					v-show="detailsOpen"
					class="pricing-teaser-details__panel"
				>
					<PricingFeatureMatrix
						:module-tab="activeModuleTab"
						hide-category-row
					/>
				</div>
			</div>

			<p class="mt-4 text-center text-xs text-muted">
				* * Все цены указаны без учёта НДС. При оплате за 6 месяцев — скидка 10%. Пакеты расширения действуют в течение оплаченного периода.
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
import type { TabsItem } from '@nuxt/ui'

import BaseButton from '~/components/landing/BaseButton.vue'
import PricingFeatureMatrix from '~/components/landing/PricingFeatureMatrix.vue'
import { LANDING_CTA_LABEL } from '#shared/constants/landing'
import {
	PRICING_MODULE_TABS,
	featureTableTitle,
	pricingTeaserPlans,
	type PricingModuleTab,
} from '#shared/constants/pricing'

withDefaults(
	defineProps<{
		sectionId?: string
		title?: string
		description?: string
	}>(),
	{
		sectionId: 'pricing',
		title: 'Тариф под задачи вашей команды',
		description:
			'Пять уровней — от пилотного запуска до корпоративного контура. '
			+ 'Модуль 1 — поиск и рассылка, модуль 2 — анализ ТЗ и КП.',
	},
)

const consultation = useConsultationModal()
const landingCtaLabel = LANDING_CTA_LABEL
const { target: sectionRef, isVisible } = useScrollReveal()

const activeModuleTab = ref<PricingModuleTab>('module1')
const detailsOpen = ref(false)

const moduleTabItems = computed<TabsItem[]>(() =>
	PRICING_MODULE_TABS.map((tab) => ({
		label: tab.label,
		value: tab.value,
	})),
)

const planTeasers = computed(() => pricingTeaserPlans(activeModuleTab.value))
</script>
