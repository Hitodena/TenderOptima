<template>
	<LegalPageShell>
		<LegalDocumentCard
			:title="doc.title"
			:href="doc.href"
		/>
	</LegalPageShell>
</template>

<script lang="ts" setup>
import LegalDocumentCard from '~/components/landing/LegalDocumentCard.vue'
import LegalPageShell from '~/components/landing/LegalPageShell.vue'
import { LEGAL_DOCUMENTS } from '#shared/constants/landing'

definePageMeta({ layout: 'default' })

const doc = LEGAL_DOCUMENTS.privacyPolicy

useSeoMeta({
	title: `${doc.title} — TenderOptima`,
	description: 'Политика обработки персональных данных сервиса TenderOptima.',
})
</script>
