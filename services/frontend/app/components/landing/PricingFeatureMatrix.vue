<template>
	<div class="pricing-matrix">
		<div class="pricing-matrix__scroll">
			<table class="pricing-matrix__table">
				<caption class="sr-only">
					{{ featureTableTitle(moduleTab) }}
				</caption>
				<thead v-if="showMobileHead" class="lg:hidden">
					<tr>
						<th
							class="pricing-matrix__sticky-col pricing-matrix__head-feature"
							scope="col"
						>
							Тариф
						</th>
						<th
							v-for="plan in PRICING_PLANS"
							:key="`mobile-head-${plan.id}`"
							class="pricing-matrix__plan-col"
							scope="col"
						>
							<div
								class="pricing-matrix__mobile-plan"
								:class="{
									'pricing-matrix__mobile-plan--popular': plan.isPopular,
									'pricing-matrix__mobile-plan--disabled': isPlanDisabled(plan),
								}"
							>
								<UBadge
									v-if="plan.isPopular"
									color="warning"
									variant="subtle"
									size="xs"
									label="Популярный"
									class="mb-1"
								/>
								<span class="font-semibold text-highlighted">{{ plan.name }}</span>
								<p
									v-if="isPlanDisabled(plan)"
									class="mt-1 text-center text-[0.65rem] leading-snug text-muted"
								>
									Доступно только в Модуле 1
								</p>
								<template v-else-if="plan.isEnterprise">
									<span class="text-sm font-medium text-highlighted">
										По запросу
									</span>
								</template>
								<template v-else-if="planTier(plan)">
									<span class="pricing-matrix__mobile-price">
										{{ formatAmount(displayMonthly(planTier(plan)!)) }}
									</span>
									<span class="text-xs text-muted">{{ PRICING_CURRENCY }}/мес</span>
									<UBadge
										v-if="isSixMonthBilling"
										color="success"
										variant="subtle"
										size="xs"
										class="mt-1"
										:label="`−${formatAmount(tierSavings(planTier(plan)!))}`"
									/>
								</template>
								<UButton
									color="neutral"
									variant="outline"
									size="xs"
									class="mt-2 cursor-pointer"
									block
									:disabled="isPlanDisabled(plan)"
									@click="onPlanCta(plan)"
								>
									{{ plan.ctaText }}
								</UButton>
							</div>
						</th>
					</tr>
				</thead>

				<tbody>
					<tr
						v-if="!hideCategoryRow"
						class="pricing-matrix__category-row"
					>
						<th
							class="pricing-matrix__sticky-col"
							:colspan="PRICING_PLANS.length + 1"
							scope="colgroup"
						>
							<span class="block px-4 py-3 text-sm font-semibold text-highlighted">
								{{ featureTableTitle(moduleTab) }}
							</span>
						</th>
					</tr>

					<tr
						v-for="feature in activeFeatures"
						:key="feature.name"
						class="pricing-matrix__feature-row"
					>
						<th
							class="pricing-matrix__sticky-col pricing-matrix__feature-name"
							scope="row"
						>
							<span class="inline-flex items-center gap-1.5">
								{{ feature.name }}
								<UTooltip
									v-if="feature.tooltipDescription"
									:text="feature.tooltipDescription"
								>
									<button
										type="button"
										class="pricing-matrix__info-btn"
										:aria-label="`Подробнее: ${feature.name}`"
									>
										<UIcon
											name="i-lucide-info"
											class="size-3.5"
										/>
									</button>
								</UTooltip>
							</span>
						</th>
						<td
							v-for="plan in PRICING_PLANS"
							:key="`${feature.name}-${plan.id}`"
							class="pricing-matrix__plan-col"
							:class="{
								'pricing-matrix__plan-col--popular': plan.isPopular,
								'pricing-matrix__plan-col--disabled': isPlanDisabled(plan),
							}"
						>
							<PricingFeatureCell :value="feature.values[plan.id]" />
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {
	PRICING_CURRENCY,
	PRICING_PLANS,
	featureTableTitle,
	featuresForModuleTab,
	isPlanAvailableForTab,
	planTierForTab,
	pricingDisplayMonthly,
	pricingTierSavings,
	type PlanPricingTier,
	type PricingModuleTab,
	type PricingPlan,
} from '#shared/constants/pricing'
import PricingFeatureCell from '~/components/landing/PricingFeatureCell.vue'

const props = withDefaults(
	defineProps<{
		moduleTab: PricingModuleTab
		showMobileHead?: boolean
		isSixMonthBilling?: boolean
		hideCategoryRow?: boolean
	}>(),
	{
		showMobileHead: false,
		isSixMonthBilling: false,
		hideCategoryRow: false,
	},
)

const consultation = useConsultationModal()

const activeFeatures = computed(() => featuresForModuleTab(props.moduleTab))

function isPlanDisabled(plan: PricingPlan): boolean {
	return !isPlanAvailableForTab(plan.id, props.moduleTab)
}

function planTier(plan: PricingPlan): PlanPricingTier | null {
	return planTierForTab(plan, props.moduleTab)
}

function formatAmount(value: number): string {
	return value.toLocaleString('ru-RU')
}

function displayMonthly(tier: PlanPricingTier): number {
	return pricingDisplayMonthly(tier, props.isSixMonthBilling)
}

function tierSavings(tier: PlanPricingTier): number {
	return pricingTierSavings(tier)
}

function onPlanCta(plan: PricingPlan) {
	if (isPlanDisabled(plan)) return
	if (plan.isEnterprise) {
		consultation.open()
		return
	}
	navigateTo('/auth?mode=register')
}
</script>
