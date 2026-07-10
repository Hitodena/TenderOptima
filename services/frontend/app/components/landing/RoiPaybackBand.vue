<template>
	<section
		:id="sectionId"
		ref="sectionRef"
		class="reveal bg-default px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
		:class="{ 'is-visible': isVisible }"
	>
		<div class="mx-auto max-w-4xl">
			<article class="landing-roi-band landing-card p-6 text-center sm:p-8 lg:text-left">
				<div class="mb-6 lg:mb-8">
					<p class="landing-section-headline mb-2">
						Окупаемость
					</p>
					<h2 class="landing-section-title mb-3 text-2xl sm:text-3xl">
						Одна успешная закупка окупает подписку
					</h2>
					<p class="landing-section-description mx-auto lg:mx-0">
						<template
							v-for="(part, partIndex) in intro"
							:key="`intro-${partIndex}`"
						>
							<span
								v-if="part.accent"
								class="landing-desc-accent"
							>{{ part.text }}</span>
							<template v-else>{{ part.text }}</template>
						</template>
					</p>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div
						v-for="(point, index) in points"
						:key="point.title"
						class="landing-roi-band-point reveal rounded-xl border border-default bg-elevated/30 p-4 sm:p-5"
						:class="[`stagger-${index + 1}`, { 'is-visible': isVisible }]"
					>
						<div class="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
							<UIcon :name="point.icon" class="size-5 text-primary" />
						</div>
						<h3 class="mb-1.5 text-base font-semibold text-highlighted">
							{{ point.title }}
						</h3>
						<p class="text-sm leading-relaxed text-muted">
							<template
								v-for="(part, partIndex) in point.description"
								:key="`${point.title}-${partIndex}`"
							>
								<span
									v-if="part.accent"
									class="landing-desc-accent"
								>{{ part.text }}</span>
								<template v-else>{{ part.text }}</template>
							</template>
						</p>
					</div>
				</div>
			</article>
		</div>
	</section>
</template>

<script lang="ts" setup>
import type { LandingTextPart, RoiPaybackPoint } from '#shared/constants/landing'
import { ROI_PAYBACK_INTRO, ROI_PAYBACK_POINTS } from '#shared/constants/landing'
import { useScrollReveal } from '~/composables/useScrollReveal'

withDefaults(
	defineProps<{
		sectionId?: string
		intro?: LandingTextPart[]
		points?: RoiPaybackPoint[]
	}>(),
	{
		sectionId: 'roi',
		intro: () => ROI_PAYBACK_INTRO,
		points: () => ROI_PAYBACK_POINTS,
	},
)

const { target: sectionRef, isVisible } = useScrollReveal({ threshold: 0.15 })
</script>
