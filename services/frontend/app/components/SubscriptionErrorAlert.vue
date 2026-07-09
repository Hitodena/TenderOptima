<script lang="ts" setup>
import { parseApiError } from '#shared/utils/apiError'
import { subscriptionPlansPath } from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'

const props = defineProps<{
	error: unknown
	fallback?: string
}>()

const parsed = computed(() => parseApiError(props.error))

const message = computed(
	() => parsed.value?.message ?? props.fallback ?? 'Произошла ошибка',
)

const showSubscriptionLink = computed(
	() => parsed.value?.isSubscription ?? false,
)

const subscriptionPath = computed(
	() => parsed.value?.subscriptionPath ?? subscriptionPlansPath(),
)
</script>

<template>
	<UAlert color="error" variant="soft" icon="i-lucide-circle-alert">
		<template #description>
			<div class="space-y-2">
				<p>{{ message }}</p>
				<ULink
					v-if="showSubscriptionLink"
					:to="subscriptionPath"
					class="text-sm font-medium text-primary hover:underline underline-offset-2"
				>
					{{ t('subscription.upgradeCta') }}
				</ULink>
			</div>
		</template>
	</UAlert>
</template>
