<template>
	<section
		:id="id"
		ref="sectionRef"
		class="reveal px-4 py-12 sm:px-6 md:py-24 lg:px-8"
		:class="{ 'bg-elevated/25': tone === 'elevated' }"
	>
		<div class="mx-auto" :class="maxWidthClass">
			<header v-if="eyebrow || title || description" class="mb-10 text-center sm:mb-12">
				<p v-if="eyebrow" class="landing-section-headline mb-2">
					{{ eyebrow }}
				</p>
				<h2 v-if="title" class="landing-section-title mb-4">
					{{ title }}
				</h2>
				<p v-if="description" class="landing-section-description mx-auto">
					{{ description }}
				</p>
			</header>

			<slot />
		</div>
	</section>
</template>

<script lang="ts" setup>
/**
 * Standardized landing section shell: consistent vertical rhythm, container
 * width, optional eyebrow/title/description header, and a scroll-reveal
 * animation applied automatically so every section fades in on scroll.
 */
const props = withDefaults(
	defineProps<{
		id?: string
		eyebrow?: string
		title?: string
		description?: string
		tone?: 'default' | 'elevated'
		maxWidth?: '3xl' | '5xl' | '6xl' | '7xl'
	}>(),
	{
		id: undefined,
		eyebrow: undefined,
		title: undefined,
		description: undefined,
		tone: 'default',
		maxWidth: '6xl',
	},
)

const MAX_WIDTH_CLASSES: Record<NonNullable<typeof props.maxWidth>, string> = {
	'3xl': 'max-w-3xl',
	'5xl': 'max-w-5xl',
	'6xl': 'max-w-6xl',
	'7xl': 'max-w-7xl',
}

const maxWidthClass = computed(() => MAX_WIDTH_CLASSES[props.maxWidth])

const { target: sectionRef } = useScrollReveal()
</script>
