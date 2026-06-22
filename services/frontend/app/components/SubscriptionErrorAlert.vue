<script lang="ts" setup>
import { parseApiError } from '#shared/utils/apiError'
import { subscriptionProfilePath } from '#shared/utils/subscriptionDisplay'

const props = defineProps<{
	error: unknown
	fallback?: string
}>()

const parsed = computed(() => parseApiError(props.error))

const message = computed(
	() => parsed.value?.message ?? props.fallback ?? 'Произошла ошибка',
)

const showProfileLink = computed(
	() => parsed.value?.isSubscription ?? false,
)

const profilePath = computed(
	() => parsed.value?.profilePath ?? subscriptionProfilePath(),
)
</script>

<template>
	<UAlert color="error" variant="soft" icon="i-lucide-circle-alert">
		<template #description>
			<div class="space-y-2">
				<p>{{ message }}</p>
				<ULink
					v-if="showProfileLink"
					:to="profilePath"
					class="text-sm font-medium text-primary hover:underline underline-offset-2"
				>
					Открыть подписку в профиле
				</ULink>
			</div>
		</template>
	</UAlert>
</template>
