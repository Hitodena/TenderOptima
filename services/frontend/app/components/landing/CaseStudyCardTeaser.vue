<template>
	<article
		class="landing-case-teaser landing-card flex h-full min-h-[9.5rem] flex-col justify-between p-5 text-left sm:p-6"
	>
		<div>
			<span class="landing-industry-pill mb-3 inline-flex">
				<UIcon :name="study.industryIcon" class="landing-industry-pill-icon size-4" />
				{{ study.industry }}
			</span>

			<h3 class="text-base font-semibold leading-snug text-highlighted sm:text-lg">
				{{ study.title }}
			</h3>
		</div>

		<p class="mt-3 text-xs font-medium leading-snug text-primary sm:mt-4 sm:text-sm sm:font-semibold">
			{{ study.metric }}
		</p>
	</article>
</template>

<script lang="ts" setup>
import type { CaseStudy } from '#shared/constants/landing'

defineProps<{
	study: CaseStudy
}>()
</script>
