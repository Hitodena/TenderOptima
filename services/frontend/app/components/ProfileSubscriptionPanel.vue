<script lang="ts" setup>

import type { SubscriptionResponse } from '#shared/types'

import { effectiveEmailLimit } from '#shared/utils/subscriptionAccess'

import {

	PLAN_LABELS,

	formatUsageLimit,

	subscriptionPlansPath,

} from '#shared/utils/subscriptionDisplay'



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

</script>



<template>

	<div v-if="subscription" class="space-y-6">

		<div class="flex flex-wrap items-center gap-2">

			<UBadge
:color="subscription.is_active ? 'success' : 'neutral'" variant="subtle"

				:label="subscription.is_active ? 'Активна' : 'Неактивна'" />

			<UBadge color="primary" variant="subtle" :label="planLabel ?? subscription.plan" />

			<UBadge v-if="subscription.module_1_enabled" color="neutral" variant="outline" label="Модуль 1" />

			<UBadge v-if="subscription.module_2_enabled" color="neutral" variant="outline" label="Модуль 2" />

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

							{{ formatUsage(subscription.searches_used_this_month, subscription.max_searches_per_month)

							}}

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



		<div class="flex flex-wrap items-center gap-3 pt-1">

			<p class="text-sm text-muted">

				Подробное сравнение тарифов и способы оплаты — на отдельной странице.

			</p>

			<UButton

				:to="subscriptionPlansPath()"

				variant="soft"

				color="primary"

				size="sm"

				trailing-icon="i-lucide-arrow-right"

				label="Подробнее о тарифах"

			/>

		</div>

	</div>



	<div v-else class="space-y-6">

		<div class="flex flex-col items-center justify-center py-10 gap-3">

			<UIcon name="i-lucide-credit-card" class="w-10 h-10 text-muted opacity-40" />

			<p class="text-muted">Подписка не назначена</p>

		</div>

		<UButton

			:to="subscriptionPlansPath()"

			variant="soft"

			color="primary"

			trailing-icon="i-lucide-arrow-right"

			label="Посмотреть тарифы"

		/>

	</div>

</template>

