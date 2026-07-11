<template>
	<div>
		<BaseSection tone="elevated" max-width="5xl">
			<div class="text-center">
				<p class="landing-section-headline mb-2">
					Продукт
				</p>
				<h1 class="landing-section-title mb-4">
					Все модули TenderOptima — от поиска поставщиков до готового отчёта
				</h1>
				<p class="landing-section-description mx-auto mb-8">
					Поиск, рассылка, переписка и AI-сравнение предложений с требованиями ТЗ — в одном браузерном
					интерфейсе, без переключения между сервисами и ручной сверки таблиц.
				</p>
				<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
					<BaseButton to="/auth?tab=register" leading-icon="i-lucide-user-plus">
						Начать бесплатно
					</BaseButton>
					<BaseButton variant="secondary" leading-icon="i-lucide-messages-square" @click="consultation.open()">
						Получить консультацию
					</BaseButton>
				</div>
			</div>
		</BaseSection>

		<BaseSection
			v-for="(group, groupIndex) in moduleGroups" :id="group.id" :key="group.id"
			:tone="groupIndex % 2 === 1 ? 'elevated' : 'default'"
		>
			<div class="space-y-16">
				<div
					v-for="(module, moduleIndex) in group.modules" :key="module.title"
					class="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
				>
					<div :class="{ 'lg:order-2': moduleIndex % 2 === 1 }">
						<div class="landing-browser-frame">
							<div class="landing-browser-chrome">
								<span class="landing-browser-dot" />
								<span class="landing-browser-dot" />
								<span class="landing-browser-dot" />
								<span class="landing-browser-url">{{ LANDING_MOCKUP_BROWSER_TITLE }}</span>
							</div>
							<img
								:src="module.image"
								:alt="module.imageAlt"
								class="block h-auto w-full"
								width="960"
								height="600"
								loading="lazy"
								decoding="async"
							>
						</div>
					</div>
					<div :class="{ 'lg:order-1': moduleIndex % 2 === 1 }">
						<div class="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
							<UIcon :name="module.icon" class="size-6 text-primary" />
						</div>
						<h2 class="mb-3 text-2xl font-bold text-highlighted">
							{{ module.title }}
						</h2>
						<p class="mb-4 leading-relaxed text-muted">
							{{ module.description }}
						</p>
						<span class="landing-trust-badge">
							<UIcon name="i-lucide-sparkles" class="landing-trust-badge-icon size-4" />
							{{ module.highlight }}
						</span>
					</div>
				</div>
			</div>
		</BaseSection>

		<BaseSection tone="elevated" max-width="5xl">
			<div class="grid items-start gap-10 lg:grid-cols-2">
				<div class="text-center lg:text-left">
					<h2 class="landing-section-title mb-4">
						Хотите увидеть продукт на своём сценарии закупки?
					</h2>
					<p class="landing-section-description mx-auto mb-6 lg:mx-0">
						Оставьте заявку — менеджер свяжется с вами и покажет, как TenderOptima закроет ваши задачи.
					</p>
				</div>
				<div class="landing-card bg-default p-6 sm:p-8">
					<ConsultationForm />
				</div>
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseButton from '~/components/landing/BaseButton.vue'
import BaseSection from '~/components/landing/BaseSection.vue'
import {
	LANDING_MOCKUP_BROWSER_TITLE,
	PRODUCT_MODULES,
} from '#shared/constants/landing'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Продукт — TenderOptima',
	description: 'Модули TenderOptima: поиск поставщиков, рассылка запросов, переписка, извлечение требований из ТЗ и AI-сравнение с коммерческими предложениями.',
})

const consultation = useConsultationModal()

const moduleGroups = (['supplier-search', 'correspondence', 'tz-kp'] as const).map((id) => ({
	id,
	modules: PRODUCT_MODULES.filter((module) => module.group === id),
}))
</script>
