<template>
	<div>
		<BaseSection tone="elevated" max-width="3xl">
			<div class="text-center">
				<p class="landing-section-headline mb-2">
					FAQ
				</p>
				<h1 class="landing-section-title mb-4">
					Частые вопросы
				</h1>
				<p class="landing-section-description mx-auto">
					Не нашли ответ? Задайте вопрос напрямую — оставим заявку на консультацию или напишите нам.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="3xl">
			<UAccordion
				type="single" :unmount-on-hide="false" :items="faqAccordionItems"
				class="rounded-xl border border-default bg-default px-4 sm:px-5" :ui="{
					trigger: 'py-4 text-base font-medium cursor-pointer',
					body: 'text-sm text-muted pb-4 leading-relaxed',
					content: 'overflow-hidden',
				}"
			/>

			<div class="mt-10 text-center">
				<p class="mb-4 text-muted">
					Остались вопросы?
				</p>
				<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
					<BaseButton leading-icon="i-lucide-messages-square" @click="consultation.open()">
						Получить консультацию
					</BaseButton>
					<BaseButton variant="secondary" to="/contacts" leading-icon="i-lucide-mail">
						Написать нам
					</BaseButton>
				</div>
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import type { AccordionItem } from '@nuxt/ui'
import BaseButton from '~/components/landing/BaseButton.vue'
import BaseSection from '~/components/landing/BaseSection.vue'
import { FAQ_ITEMS } from '#shared/constants/landing'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'FAQ — TenderOptima',
	description: 'Ответы на частые вопросы о работе TenderOptima: форматы файлов, скорость анализа, отслеживание ответов поставщиков.',
})

const consultation = useConsultationModal()

const faqAccordionItems = computed<AccordionItem[]>(() =>
	FAQ_ITEMS.map((item, index) => ({
		label: item.question,
		content: item.answer,
		value: String(index),
	})),
)
</script>
