<template>
	<div>
		<BaseSection tone="elevated" max-width="3xl">
			<div class="text-center">
				<h1 class="landing-section-title mb-4">
					Политика обработки персональных данных
				</h1>
				<p class="landing-section-description mx-auto">
					Политика описывает цели, состав и порядок обработки персональных данных пользователей
					сервиса TenderOptima.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="3xl">
			<div class="prose prose-sm max-w-none text-default">
				<p>
					Персональные данные обрабатываются для предоставления доступа к сервису, обратной связи,
					технической поддержки и исполнения договорных обязательств.
				</p>
				<p>
					Данные могут храниться в защищённом облаке или на серверах заказчика — по согласованию.
					По запросам субъектов персональных данных:
					<a href="mailto:dpo@tenderoptima.by" class="text-primary underline underline-offset-2">
						dpo@tenderoptima.by
					</a>
				</p>
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Политика обработки персональных данных — TenderOptima',
	description: 'Политика обработки персональных данных сервиса TenderOptima.',
})
</script>
