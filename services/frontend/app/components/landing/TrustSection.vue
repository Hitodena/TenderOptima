<template>
	<section
		:id="sectionId"
		ref="sectionRef"
		class="reveal px-4 py-[var(--landing-section-py)] sm:px-6 lg:px-8"
		:class="tone === 'dark' ? 'landing-trust-band-dark' : tone === 'elevated' ? 'bg-elevated/25' : ''"
	>
		<div class="mx-auto max-w-6xl">
			<header class="mb-10 text-center sm:mb-12">
				<p class="landing-section-headline mb-2" :class="{ 'landing-on-dark-accent': tone === 'dark' }">
					{{ eyebrow }}
				</p>
				<h2 class="landing-section-title mb-4" :class="{ 'text-white': tone === 'dark' }">
					{{ title }}
				</h2>
				<p class="landing-section-description mx-auto" :class="{ 'landing-on-dark-muted': tone === 'dark' }">
					{{ description }}
				</p>
			</header>

			<div class="grid gap-5 sm:grid-cols-2">
				<article
					v-for="(block, index) in blocks"
					:key="block.title"
					class="landing-trust-block-card reveal"
					:class="[`stagger-${index + 1}`, { 'is-visible': isVisible }]"
				>
					<div class="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
						<UIcon :name="block.icon" class="size-6 text-primary" />
					</div>
					<h3 class="mb-2 text-lg font-semibold text-highlighted">
						{{ block.title }}
					</h3>
					<p class="mb-4 flex-1 text-sm leading-relaxed text-muted">
						{{ block.description }}
					</p>
					<NuxtLink
						v-if="block.link"
						:to="block.link"
						class="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:opacity-80"
					>
						{{ block.linkLabel ?? 'Подробнее' }}
						<UIcon name="i-lucide-arrow-right" class="size-4" />
					</NuxtLink>
				</article>
			</div>

			<div v-if="showIndustries" class="mt-12 text-center">
				<p class="mb-4 text-sm font-medium" :class="tone === 'dark' ? 'landing-on-dark-muted' : 'text-muted'">
					Работаем с командами закупок в отраслях
				</p>
				<div class="landing-industry-strip">
					<span
						v-for="segment in industries"
						:key="segment.label"
						class="landing-industry-pill"
						:class="{ 'landing-industry-pill--on-dark': tone === 'dark' }"
					>
						<UIcon :name="segment.icon" class="landing-industry-pill-icon size-4" />
						{{ segment.label }}
					</span>
				</div>
			</div>
		</div>
	</section>
</template>

<script lang="ts" setup>
import type { IndustrySegment, TrustBlock } from '#shared/constants/landing'
import { INDUSTRY_SEGMENTS, TRUST_BLOCKS } from '#shared/constants/landing'

withDefaults(
	defineProps<{
		sectionId?: string
		eyebrow?: string
		title?: string
		description?: string
		blocks?: TrustBlock[]
		industries?: IndustrySegment[]
		showIndustries?: boolean
		tone?: 'default' | 'elevated' | 'dark'
	}>(),
	{
		sectionId: 'trust',
		eyebrow: 'Доверие',
		title: 'Почему B2B-команды выбирают TenderOptima',
		description: 'Безопасность данных, прозрачное подключение почты и возможность развёртывания в вашем контуре — без обещаний, которые мы не можем подтвердить.',
		blocks: () => TRUST_BLOCKS,
		industries: () => INDUSTRY_SEGMENTS,
		showIndustries: true,
		tone: 'elevated',
	},
)

const { target: sectionRef, isVisible } = useScrollReveal()
</script>
