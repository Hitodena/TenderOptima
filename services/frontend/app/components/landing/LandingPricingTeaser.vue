<template>
	<section
		:id="sectionId"
		ref="sectionRef"
		class="reveal px-4 py-12 sm:px-6 md:py-24 lg:px-8"
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

			<div
				class="pricing-teaser-cards -mx-4 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3 xl:grid-cols-5"
				role="list"
			>
				<article
					v-for="(plan, index) in planTeasers"
					:key="plan.id"
					class="pricing-teaser-cards__slide landing-card landing-pricing-teaser reveal flex snap-center flex-col p-6 md:p-8"
					role="listitem"
					:class="[
						`stagger-${index + 1}`,
						{
							'is-visible': isVisible,
							'landing-pricing-teaser-recommended': plan.recommended && !plan.disabled,
							'landing-pricing-teaser--disabled': plan.disabled,
						},
					]"
				>
					<p
						class="landing-pricing-teaser__badge mb-2 text-xs font-semibold uppercase tracking-wide"
						:class="plan.recommended && !plan.disabled
							? 'text-primary max-sm:invisible'
							: 'invisible'"
						aria-hidden="true"
					>
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
					<p
						class="mb-3 text-xs text-muted"
						:class="{ invisible: !plan.period }"
					>
						{{ plan.period || `${PRICING_CURRENCY}/мес` }}
					</p>
					<p class="landing-pricing-teaser__description mb-4 flex-1 text-sm leading-relaxed text-muted">
						{{ plan.description }}
					</p>
					<div
						class="landing-pricing-teaser__features mt-auto text-left text-xs text-muted"
					>
						<p
							class="mb-0"
							:class="{ invisible: !plan.moduleScopeLabel }"
						>
							{{ plan.moduleScopeLabel || 'Функционал' }}
						</p>
						<ul class="mb-0 mt-2 space-y-1.5">
							<li
								v-for="slot in 2"
								:key="slot"
								class="flex items-start gap-2"
								:class="{ invisible: !plan.features[slot - 1] }"
							>
								<UIcon
									name="i-lucide-check"
									class="mt-0.5 size-3.5 shrink-0 text-primary"
								/>
								<span>{{ plan.features[slot - 1] || '—' }}</span>
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
					<span class="pricing-teaser-details__label min-w-0 text-left md:hidden">
						{{ featureTableTitleMobile(activeModuleTab) }}
					</span>
					<span class="pricing-teaser-details__label hidden min-w-0 text-left font-medium text-highlighted md:inline md:text-base">
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
						mobile-head="compact"
					/>
				</div>
			</div>

			<p class="mt-4 text-center text-xs text-muted">
				* Все цены указаны без учёта НДС. При оплате за 6 месяцев - скидка 10%. Пакеты расширения действуют в течение оплаченного периода.
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
import { useMediaQuery } from '@vueuse/core'

import BaseButton from '~/components/landing/BaseButton.vue'
import PricingFeatureMatrix from '~/components/landing/PricingFeatureMatrix.vue'
import { LANDING_CTA_LABEL } from '#shared/constants/landing'
import {
	PRICING_CURRENCY,
	PRICING_MODULE_TABS,
	featureTableTitle,
	featureTableTitleMobile,
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
			'Пять уровней - от пилотного запуска до корпоративного контура. '
			+ 'Модуль 1 - поиск и рассылка, модуль 2 - анализ ТЗ и КП.',
	},
)

const consultation = useConsultationModal()
const landingCtaLabel = LANDING_CTA_LABEL
const { target: sectionRef, isVisible } = useScrollReveal()

const activeModuleTab = ref<PricingModuleTab>('module1')
const detailsOpen = ref(false)
const isMounted = ref(false)
const isMobileTabs = useMediaQuery('(max-width: 767px)')

onMounted(() => {
	isMounted.value = true
})

const moduleTabItems = computed<TabsItem[]>(() =>
	PRICING_MODULE_TABS.map((tab) => ({
		label: isMounted.value && isMobileTabs.value
			? (tab.labelMobile ?? tab.label)
			: tab.label,
		value: tab.value,
	})),
)

const planTeasers = computed(() => pricingTeaserPlans(activeModuleTab.value))
</script>
