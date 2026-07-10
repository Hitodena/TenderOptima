<template>
	<div>
		<BaseSection tone="elevated" max-width="5xl">
			<div class="text-center">
				<p class="landing-section-headline mb-2">
					Кейсы
				</p>
				<h1 class="landing-section-title mb-4">
					Типовые сценарии использования
				</h1>
				<p class="landing-section-description mx-auto">
					Реальные задачи закупочных команд — без выдуманных названий компаний. Описываем, как TenderOptima
					закрывает конкретные этапы: от поиска поставщиков до экспорта таблицы соответствия.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="6xl">
			<div class="grid gap-6 lg:grid-cols-3">
				<CaseStudyCard v-for="study in caseStudies" :key="study.id" :study="study" />
			</div>
		</BaseSection>

		<BaseSection tone="elevated" max-width="5xl">
			<div class="landing-card p-8 text-center sm:p-10">
				<UIcon name="i-lucide-message-square-quote" class="mx-auto mb-4 size-9 text-primary" />
				<h2 class="mb-3 text-xl font-semibold text-highlighted sm:text-2xl">
					Хотите увидеть похожий сценарий на ваших данных?
				</h2>
				<p class="mx-auto mb-6 max-w-2xl leading-relaxed text-muted">
					Оставьте заявку — покажем TenderOptima на вашем техническом задании или типовой закупке. Без
					обязательств и спама.
				</p>
				<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
					<BaseButton leading-icon="i-lucide-messages-square" @click="consultation.open()">
						{{ landingCtaLabel }}
					</BaseButton>
					<BaseButton variant="secondary" to="/product" leading-icon="i-lucide-layout-grid">
						Обзор модулей
					</BaseButton>
				</div>
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseButton from '~/components/landing/BaseButton.vue'
import BaseSection from '~/components/landing/BaseSection.vue'
import CaseStudyCard from '~/components/landing/CaseStudyCard.vue'
import { CASE_STUDIES, LANDING_CTA_LABEL } from '#shared/constants/landing'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Кейсы — TenderOptima',
	description: 'Сценарии использования TenderOptima: сравнение КП с ТЗ, поиск поставщиков, рассылка запросов и экспорт отчётов для команд закупок.',
})

const consultation = useConsultationModal()
const landingCtaLabel = LANDING_CTA_LABEL
const caseStudies = CASE_STUDIES
</script>
