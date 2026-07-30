<template>
	<div>
		<BaseSection tone="elevated" max-width="3xl">
			<div class="text-center">
				<h1 class="landing-section-title mb-4">
					{{ doc.title }}
				</h1>
				<p class="landing-section-description mx-auto">
					Порядок использования файлов cookie на сайте и в сервисе TenderOptima.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="3xl">
			<div class="space-y-4">
				<LegalDocumentCard
					:title="doc.title"
					:href="doc.href"
					:download-name="doc.fileName"
					description="Скачайте актуальную версию политики cookie-файлов в формате DOCX."
				/>
				<LegalDocumentCard
					title="Реестр cookie-файлов"
					href="/legal/cookies-inventory.pdf"
					download-name="Реестр cookie TenderOptima.pdf"
					link-label="Скачать таблицу cookie (PDF)"
					description="Сводка всех cookie приложения: назначение, тип и срок хранения."
				/>
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'
import LegalDocumentCard from '~/components/landing/LegalDocumentCard.vue'
import { LEGAL_DOCUMENTS } from '#shared/constants/landing'

definePageMeta({ layout: 'default' })

const doc = LEGAL_DOCUMENTS.cookiePolicy

useSeoMeta({
	title: `${doc.title} — TenderOptima`,
	description: 'Политика использования cookie-файлов сервиса TenderOptima.',
})
</script>
