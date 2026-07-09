<template>
	<section
		:id="sectionId"
		ref="sectionRef"
		class="reveal bg-default py-8"
		:class="{ 'is-visible': isVisible }"
	>
		<p class="mb-6 px-4 text-center text-sm font-medium uppercase tracking-widest text-gray-500 sm:px-6 lg:px-8">
			{{ title }}
		</p>

		<div class="industry-marquee relative w-full">
			<div
				class="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-default to-transparent sm:w-24 lg:w-32"
				aria-hidden="true"
			/>
			<div
				class="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-default to-transparent sm:w-24 lg:w-32"
				aria-hidden="true"
			/>

			<div class="industry-marquee-row overflow-hidden">
				<div
					class="industry-marquee-track animate-marquee"
					aria-hidden="true"
				>
					<span
						v-for="(segment, index) in marqueeItems"
						:key="`${segment.label}-${index}`"
						class="industry-marquee-pill"
					>
						<UIcon :name="segment.icon" class="size-4 shrink-0 text-primary" />
						{{ segment.label }}
					</span>
				</div>
			</div>

			<ul class="sr-only">
				<li v-for="segment in industries" :key="segment.label">
					{{ segment.label }}
				</li>
			</ul>
		</div>
	</section>
</template>

<script lang="ts" setup>
import type { IndustrySegment } from '#shared/constants/landing'
import { INDUSTRY_SEGMENTS } from '#shared/constants/landing'
import { useScrollReveal } from '~/composables/useScrollReveal'

const props = withDefaults(
	defineProps<{
		sectionId?: string
		title?: string
		industries?: IndustrySegment[]
	}>(),
	{
		sectionId: 'industries',
		title: 'Работаем с командами закупок в отраслях',
		industries: () => INDUSTRY_SEGMENTS,
	},
)

const { target: sectionRef, isVisible } = useScrollReveal({ threshold: 0.2 })

function buildMarqueeItems(
	items: IndustrySegment[],
	copiesPerHalf = 4,
): IndustrySegment[] {
	const half = Array.from({ length: copiesPerHalf }, () => items).flat()
	return [...half, ...half]
}

const marqueeItems = computed(() => buildMarqueeItems(props.industries))
</script>
