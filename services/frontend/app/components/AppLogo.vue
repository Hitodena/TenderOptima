<template>
	<ULink
		to="/"
		class="flex items-center hover:opacity-80 transition-opacity"
		style="font-family: 'Satoshi', sans-serif; letter-spacing: -0.02em;"
		aria-label="TenderOptima — на главную"
	>
		<span :class="['font-black text-slate-900 dark:text-highlighted', textSizeClass]">Tender</span>
		<span :class="['font-medium text-[var(--color-cta)]', textSizeClass]">Optima</span>
	</ULink>
</template>

<script lang="ts" setup>
const props = withDefaults(
	defineProps<{
		size?: 'default' | 'large' | 'display'
	}>(),
	{ size: 'default' },
)

const textSizeClass = computed(() => {
	switch (props.size) {
		case 'display':
			return 'text-[clamp(2.25rem,5vw,7.5rem)] leading-none'
		case 'large':
			return 'text-4xl'
		default:
			return 'text-2xl'
	}
})
</script>
