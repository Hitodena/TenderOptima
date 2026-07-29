<script lang="ts" setup>
import type { SubscriptionResponse } from '#shared/types'
import {
	daysUntilExpiry,
	formatDaysRemaining,
	formatExpiryDate,
	subscriptionExpiryStatus,
	subscriptionPlansPath,
} from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'

const props = withDefaults(defineProps<{
	subscription: SubscriptionResponse | null | undefined
	compact?: boolean
}>(), {
	compact: false,
})

const status = computed(() => subscriptionExpiryStatus(props.subscription))
const days = computed(() => daysUntilExpiry(props.subscription))
const startLabel = computed(() => formatExpiryDate(props.subscription?.starts_at))
const expiryLabel = computed(() => formatExpiryDate(props.subscription?.expires_at))

const message = computed(() => {
	switch (status.value) {
		case 'none':
			return t('subscription.notAssigned')
		case 'unlimited':
			return t('subscription.noExpiry')
		case 'starts_only':
			return t('subscription.activeFromNoEnd').replace(
				'{date}',
				startLabel.value,
			)
		case 'active':
			if (startLabel.value && expiryLabel.value) {
				return t('subscription.activeFromUntil')
					.replace('{start}', startLabel.value)
					.replace('{end}', expiryLabel.value)
			}
			return t('subscription.activeUntil').replace('{date}', expiryLabel.value)
		case 'warning':
			return t('subscription.expiresIn').replace(
				'{days}',
				formatDaysRemaining(days.value ?? 0),
			)
		case 'expired':
			return t('subscription.expired')
		default: {
			const _exhaustive: never = status.value
			return _exhaustive
		}
	}
})

const showRenew = computed(
	() => status.value === 'warning' || status.value === 'expired',
)

const alertColor = computed(() => {
	if (status.value === 'expired') return 'error' as const
	if (status.value === 'warning') return 'warning' as const
	return 'neutral' as const
})
</script>

<template>
	<div v-if="status === 'warning' || status === 'expired'">
		<UAlert
			:color="alertColor"
			variant="soft"
			:icon="status === 'expired' ? 'i-lucide-circle-alert' : 'i-lucide-clock'"
			:title="message"
			:ui="compact ? { root: 'p-3' } : undefined"
		>
			<template v-if="showRenew" #actions>
				<slot name="action">
					<UButton
						:to="subscriptionPlansPath()"
						:color="alertColor"
						variant="soft"
						size="xs"
						trailing-icon="i-lucide-arrow-right"
					>
						{{ t('subscription.renew') }}
					</UButton>
				</slot>
			</template>
		</UAlert>
		<p
			v-if="status === 'warning' && (startLabel || expiryLabel)"
			class="mt-1.5 text-xs text-muted"
		>
			<template v-if="startLabel && expiryLabel">
				{{
					t('subscription.activeFromUntil')
						.replace('{start}', startLabel)
						.replace('{end}', expiryLabel)
				}}
			</template>
			<template v-else>
				{{ t('subscription.activeUntil').replace('{date}', expiryLabel) }}
			</template>
		</p>
	</div>

	<p
		v-else
		:class="compact ? 'text-xs text-muted' : 'text-sm text-muted'"
	>
		{{ message }}
	</p>
</template>
