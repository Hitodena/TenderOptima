<template>
	<div class="landing-card landing-scenario-card">
		<div class="landing-scenario-number mb-4">
			{{ String(index).padStart(2, '0') }}
		</div>
		<UIcon v-if="icon" :name="icon" class="landing-metric-icon mb-3 size-6" />
		<h3 class="mb-2 text-lg font-semibold text-highlighted">
			{{ title }}
		</h3>
		<p class="mb-4 flex-1 text-sm leading-relaxed text-muted">
			{{ description }}
		</p>
		<slot name="cta" />
	</div>
</template>

<script lang="ts" setup>
defineProps<{
	index: number
	title: string
	description: string
	icon?: string
}>()
</script>
