<template>
	<div class="landing-metric-card rounded-2xl p-6 text-center sm:p-8">
		<UIcon :name="icon" class="landing-metric-icon mb-3 size-7" />
		<p class="landing-metric-value">
			{{ value }}
		</p>
		<p class="landing-metric-label mt-2 text-sm">
			{{ label }}
		</p>
	</div>
</template>

<script lang="ts" setup>
defineProps<{
	icon: string
	value: string
	label: string
}>()
</script>
