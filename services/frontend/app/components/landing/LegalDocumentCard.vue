<template>
	<a
		:href="href"
		class="landing-section-title text-primary underline underline-offset-4 transition-opacity hover:opacity-80"
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
