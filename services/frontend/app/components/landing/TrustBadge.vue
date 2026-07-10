<template>
	<span
		v-if="compact"
		class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-gray-500 sm:text-sm dark:text-gray-400"
	>
		<UIcon :name="icon" class="size-3.5 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
		<span>{{ label }}</span>
	</span>
	<span
		v-else
		class="landing-trust-badge"
		:class="{ 'landing-trust-badge--prominent': prominent }"
	>
		<span class="landing-trust-badge-icon-wrap" aria-hidden="true">
			<UIcon :name="icon" class="landing-trust-badge-icon" :class="prominent ? 'size-5' : 'size-4'" />
		</span>
		<span class="landing-trust-badge-label">{{ label }}</span>
	</span>
</template>

<script lang="ts" setup>
withDefaults(
	defineProps<{
		icon: string
		label: string
		prominent?: boolean
		compact?: boolean
	}>(),
	{ prominent: false, compact: false },
)
</script>
