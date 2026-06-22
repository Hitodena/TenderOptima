<script lang="ts" setup>
import type { SubscriptionResponse } from '#shared/types'
import { PLAN_LABELS } from '#shared/utils/subscriptionDisplay'

const props = defineProps<{
	subscription: SubscriptionResponse | null | undefined
}>()

const planLabels = PLAN_LABELS

function formatUsage(used: number | undefined, limit: number | null | undefined) {
	const usedLabel = (used ?? 0).toLocaleString('ru-RU')
	if (limit == null) return `${usedLabel} / индивидуально`
	return `${usedLabel} / ${limit.toLocaleString('ru-RU')}`
}

function formatPrice(value: string | null | undefined, currency: string) {
	if (!value) return 'индивидуально'
	return `${value} ${currency}/мес`
}

const planLabel = computed(() =>
	props.subscription ? planLabels[props.subscription.plan] ?? props.subscription.plan : null,
)
</script>

<template>
	<div v-if="subscription" class="space-y-5">
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
			<UCard :ui="{ body: 'p-4 space-y-2' }">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted">
					Модуль 1
				</p>
				<p class="text-sm">
					Поиски:
					<span class="font-medium">
						{{ formatUsage(subscription.searches_used_this_month, subscription.max_searches_per_month) }}
					</span>
				</p>
				<p class="text-sm">
					Email:
					<span class="font-medium">
						{{ formatUsage(subscription.emails_sent_this_month, subscription.max_emails_per_month) }}
					</span>
				</p>
				<p class="text-sm text-muted">
					ИИ-обработка входящих, сравнительная таблица, доп. письма — включено
				</p>
			</UCard>

			<UCard :ui="{ body: 'p-4 space-y-2' }">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted">
					Модуль 2
				</p>
				<p class="text-sm">
					КП в месяц:
					<span class="font-medium">
						{{ formatUsage(subscription.kp_processed_this_month, subscription.max_kp_processed_per_month) }}
					</span>
				</p>
				<p class="text-sm text-muted">
					Технический анализ КП, доп. письма и шаблоны — включено
				</p>
			</UCard>
		</div>

		<UCard :ui="{ body: 'p-4' }">
			<p class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
				Стоимость без НДС
			</p>
			<div class="grid gap-2 sm:grid-cols-3 text-sm">
				<p>
					Модуль 1:
					<span class="font-medium">
						{{ formatPrice(subscription.price_module_1_monthly, subscription.currency_code) }}
					</span>
				</p>
				<p>
					Модуль 2:
					<span class="font-medium">
						{{ formatPrice(subscription.price_module_2_monthly, subscription.currency_code) }}
					</span>
				</p>
				<p>
					Модуль 1+2:
					<span class="font-medium">
						{{ formatPrice(subscription.price_bundle_monthly, subscription.currency_code) }}
					</span>
				</p>
			</div>
			<p class="text-xs text-muted mt-3">
				Geo: {{ subscription.geo_code }} · Валюта: {{ subscription.currency_code }}
			</p>
		</UCard>
	</div>

	<div v-else class="flex flex-col items-center justify-center py-16 gap-3">
		<UIcon name="i-lucide-credit-card" class="w-10 h-10 text-muted opacity-40" />
		<p class="text-muted">Подписка не назначена</p>
	</div>
</template>
