<template>
	<div class="pricing-feature-cell">
		<template v-if="value === true">
			<UIcon
				name="i-lucide-check"
				class="pricing-feature-cell__check"
				aria-label="Включено"
			/>
		</template>
		<template v-else-if="value === false">
			<UIcon
				name="i-lucide-minus"
				class="pricing-feature-cell__minus"
				aria-label="Не включено"
			/>
		</template>
		<template v-else-if="value == null || value === '—'">
			<span class="pricing-feature-cell__dash" aria-hidden="true">—</span>
		</template>
		<template v-else>
			<span class="pricing-feature-cell__text">{{ value }}</span>
		</template>
	</div>
</template>

<script lang="ts" setup>
import type { FeatureValue } from '#shared/constants/pricing'

defineProps<{
	value: FeatureValue
}>()
</script>
