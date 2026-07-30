<script lang="ts" setup>
import type { SubscriptionResponse } from '#shared/types'
import {
	PLAN_LABELS,
	subscriptionPlansPath,
} from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'

const props = defineProps<{
	subscription: SubscriptionResponse | null | undefined
}>()

const planLabel = computed(() =>
	props.subscription
		? PLAN_LABELS[props.subscription.plan] ?? props.subscription.plan
		: null,
)
</script>

<template>
	<div v-if="subscription" class="space-y-6">
		<div class="flex flex-wrap items-center gap-2">
			<UBadge
				:color="subscription.is_active ? 'success' : 'neutral'"
				variant="subtle"
				:label="subscription.is_active ? t('subscription.active') : t('subscription.inactive')"
			/>
			<UBadge
				color="primary"
				variant="subtle"
				:label="planLabel ?? subscription.plan"
			/>
			<UBadge
				v-if="subscription.module_1_enabled"
				color="neutral"
				variant="outline"
				:label="t('subscription.module1')"
			/>
			<UBadge
				v-if="subscription.module_2_enabled"
				color="neutral"
				variant="outline"
				:label="t('subscription.module2')"
			/>
		</div>

		<SubscriptionExpiryBanner :subscription="subscription" />

		<SubscriptionUsageBars :subscription="subscription" />

		<div class="flex flex-wrap items-center gap-3 pt-1">
			<p class="text-sm text-muted">
				Лимиты, срок действия и способы оплаты — на отдельной странице.
			</p>
			<UButton
				:to="subscriptionPlansPath()"
				variant="soft"
				color="primary"
				size="sm"
				trailing-icon="i-lucide-arrow-right"
				:label="t('subscription.moreAboutPlans')"
			/>
		</div>
	</div>

	<div v-else class="space-y-6">
		<div class="flex flex-col items-center justify-center py-10 gap-3">
			<UIcon name="i-lucide-credit-card" class="w-10 h-10 text-muted opacity-40" />
			<p class="text-muted">{{ t('subscription.notAssigned') }}</p>
		</div>
		<UButton
			:to="subscriptionPlansPath()"
			variant="soft"
			color="primary"
			trailing-icon="i-lucide-arrow-right"
			label="Перейти к подписке"
		/>
	</div>
</template>
