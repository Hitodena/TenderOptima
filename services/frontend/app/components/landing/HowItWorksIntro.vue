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
					Два модуля — один инструмент
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
					class="landing-service-direction reveal landing-card group relative block overflow-hidden p-5 sm:p-6"
					:class="[`stagger-${index + 1}`, { 'is-visible': isVisible }]"
				>
					<span
						class="landing-service-direction__index pointer-events-none absolute select-none"
						aria-hidden="true"
					>
						{{ direction.index }}
					</span>
					<div class="relative z-10">
						<h3 class="mb-2 pr-16 text-lg font-semibold text-highlighted sm:pr-20 sm:text-xl">
							{{ direction.title }}
						</h3>
						<p class="max-w-[18rem] text-sm leading-relaxed text-muted sm:max-w-[20rem]">
							{{ direction.description }}
						</p>
					</div>
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
