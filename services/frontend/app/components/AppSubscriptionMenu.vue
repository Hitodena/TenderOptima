<script lang="ts" setup>
import type { SubscriptionResponse } from '#shared/types'
import {
	subscriptionPlansPath,
	subscriptionPlanLabel,
} from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'

const props = withDefaults(defineProps<{
	subscription?: SubscriptionResponse | null
}>(), {
	subscription: null,
})

const planLabel = computed(() =>
	props.subscription
		? subscriptionPlanLabel(props.subscription.plan)
		: t('subscription.notAssigned'),
)
</script>

<template>
	<div class="w-full space-y-4 p-3 sm:w-80">
		<div class="space-y-1">
			<p class="text-sm font-semibold text-highlighted">
				{{ planLabel }}
			</p>
			<SubscriptionExpiryBanner :subscription="subscription" compact />
		</div>

		<SubscriptionUsageBars
			v-if="subscription"
			:subscription="subscription"
			compact
		/>

		<UButton
			:to="subscriptionPlansPath()"
			variant="soft"
			color="primary"
			size="sm"
			block
			trailing-icon="i-lucide-arrow-right"
		>
			{{ t('subscription.moreAboutPlans') }}
		</UButton>
	</div>
</template>
