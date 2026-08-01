<template>
	<div>
		<BaseSection tone="elevated" max-width="3xl">
			<div class="text-center">
				<h1 class="landing-section-title mb-4">
					{{ doc.title }}
				</h1>
				<p class="landing-section-description mx-auto">
					Условия использования сервиса TenderOptima. Полный текст документа доступен для скачивания.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="3xl">
			<LegalDocumentCard
				:title="doc.title"
				:href="doc.href"
				:download-name="doc.fileName"
				description="Скачайте актуальную версию пользовательского соглашения в формате PDF."
			/>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'
import LegalDocumentCard from '~/components/landing/LegalDocumentCard.vue'
import { LEGAL_DOCUMENTS } from '#shared/constants/landing'

definePageMeta({ layout: 'default' })

const doc = LEGAL_DOCUMENTS.termsOfUse

useSeoMeta({
	title: `${doc.title} — TenderOptima`,
	description: 'Пользовательское соглашение сервиса TenderOptima.',
})
</script>
