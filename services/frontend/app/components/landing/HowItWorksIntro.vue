<template>
	<section
		id="how-it-works"
		ref="sectionRef"
		class="reveal bg-elevated/25 px-4 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-14 lg:px-8"
		:class="{ 'is-visible': isVisible }"
	>
		<div class="mx-auto max-w-6xl">
			<header class="mb-8 text-center sm:mb-10">
				<p class="landing-section-headline mb-2">
					Как работает сервис
				</p>
				<h2 class="landing-section-title mb-4">
					Два направления — один инструмент
				</h2>
				<p class="landing-section-description mx-auto">
					TenderOptima закрывает весь цикл закупки: от поиска поставщиков и рассылки запросов
					до технической проверки коммерческих предложений.
				</p>
			</header>

			<div class="grid gap-4 sm:grid-cols-2">
				<NuxtLink
					v-for="(direction, index) in directions"
					:key="direction.id"
					:to="direction.anchor"
					class="landing-service-direction reveal landing-card group block p-5 sm:p-6"
					:class="[`stagger-${index + 1}`, { 'is-visible': isVisible }]"
				>
					<div class="mb-4 flex items-start justify-between gap-3">
						<div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
							<UIcon :name="direction.icon" class="size-5 text-primary" />
						</div>
						<span class="text-xs font-semibold tabular-nums text-muted">
							{{ direction.index }}
						</span>
					</div>
					<h3 class="mb-2 text-lg font-semibold text-highlighted">
						{{ direction.title }}
					</h3>
					<p class="text-sm leading-relaxed text-muted">
						{{ direction.description }}
					</p>
					 
				</NuxtLink>
			</div>
		</div>
	</section>
</template>

<script lang="ts" setup>
import type { ServiceDirection } from '#shared/constants/landing'
import { SERVICE_DIRECTIONS } from '#shared/constants/landing'
import { useScrollReveal } from '~/composables/useScrollReveal'

withDefaults(
	defineProps<{
		directions?: ServiceDirection[]
	}>(),
	{ directions: () => SERVICE_DIRECTIONS },
)

const { target: sectionRef, isVisible } = useScrollReveal({ threshold: 0.12 })
</script>
