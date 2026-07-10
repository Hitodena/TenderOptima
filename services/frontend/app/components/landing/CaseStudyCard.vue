<template>
	<CaseStudyCardExpanded :study="study" />
</template>

<script lang="ts" setup>
import type { CaseStudy } from '#shared/constants/landing'
import CaseStudyCardExpanded from '~/components/landing/CaseStudyCardExpanded.vue'

defineProps<{
	study: CaseStudy
}>()
</script>
