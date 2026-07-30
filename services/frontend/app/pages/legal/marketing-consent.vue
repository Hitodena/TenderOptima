<template>
	<div>
		<BaseSection tone="elevated" max-width="3xl">
			<div class="text-center">
				<h1 class="landing-section-title mb-4">
					{{ doc.title }}
				</h1>
				<p class="landing-section-description mx-auto">
					Условия согласия на получение информационных и маркетинговых сообщений от TenderOptima.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="3xl">
			<LegalDocumentCard
				:title="doc.title"
				:href="doc.href"
				:download-name="doc.fileName"
				description="Скачайте актуальную версию согласия на маркетинг в формате DOCX."
			/>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'
import LegalDocumentCard from '~/components/landing/LegalDocumentCard.vue'
import { LEGAL_DOCUMENTS } from '#shared/constants/landing'

definePageMeta({ layout: 'default' })

const doc = LEGAL_DOCUMENTS.marketingConsent

useSeoMeta({
	title: `${doc.title} — TenderOptima`,
	description: 'Согласие на получение маркетинговых уведомлений TenderOptima.',
})
</script>
