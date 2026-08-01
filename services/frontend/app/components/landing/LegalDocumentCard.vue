<template>
	<div class="space-y-3">
		<h2
			v-if="showTitle"
			class="text-base font-semibold text-highlighted sm:text-lg"
		>
			{{ title }}
		</h2>
		<iframe
			:src="href"
			:title="title"
			class="h-[min(80vh,56rem)] w-full rounded-xl border border-default bg-default"
		/>
	</div>
</template>

<script lang="ts" setup>
withDefaults(
	defineProps<{
		title: string
		href: string
		showTitle?: boolean
	}>(),
	{
		showTitle: false,
	},
)
</script>
