<template>
	<article
		ref="bannerRef"
		class="landing-cases-cta-banner reveal flex flex-col gap-6 rounded-2xl p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:gap-10"
		:class="{ 'is-visible': isVisible }"
	>
		<div class="min-w-0 text-center lg:flex-1 lg:text-left">
			<h3 class="text-xl font-semibold leading-snug text-highlighted sm:text-2xl">
				{{ title }}
			</h3>
			<p class="mt-3 text-sm leading-relaxed text-muted sm:text-base">
				{{ subtitle }}
			</p>
		</div>

		<div class="flex w-full shrink-0 flex-col items-center gap-2 lg:w-auto lg:items-end">
			<BaseButton
				class="w-auto max-w-full"
				leading-icon="i-lucide-messages-square"
				@click="consultation.open()"
			>
				{{ buttonLabel }}
			</BaseButton>
			<p class="text-center text-xs text-muted lg:text-right">
				{{ trustText }}
			</p>
		</div>
	</article>
</template>

<script lang="ts" setup>
import { CASES_CTA_BANNER } from '#shared/constants/landing'
import BaseButton from '~/components/landing/BaseButton.vue'
import { useScrollReveal } from '~/composables/useScrollReveal'

withDefaults(
	defineProps<{
		title?: string
		subtitle?: string
		buttonLabel?: string
		trustText?: string
	}>(),
	{
		title: CASES_CTA_BANNER.title,
		subtitle: CASES_CTA_BANNER.subtitle,
		buttonLabel: CASES_CTA_BANNER.buttonLabel,
		trustText: CASES_CTA_BANNER.trustText,
	},
)

const consultation = useConsultationModal()
const { target: bannerRef, isVisible } = useScrollReveal({ threshold: 0.15 })
</script>
