<template>
	<a
		:href="href"
		class="inline-flex max-w-full items-center justify-center text-balance text-xl font-bold text-primary underline underline-offset-4 transition-opacity hover:opacity-80 sm:text-2xl"
		target="_blank"
		rel="noopener noreferrer"
	>
		{{ title }}
	</a>
</template>

<script lang="ts" setup>
defineProps<{
	title: string
	href: string
}>()
</script>
