<template>
	<LegalPageShell>
		<LegalDocumentCard
			:title="doc.title"
			:href="doc.href"
		/>
		<LegalDocumentCard
			title="Реестр cookie-файлов"
			href="/legal/cookies-inventory.pdf"
		/>
	</LegalPageShell>
</template>

<script lang="ts" setup>
import LegalDocumentCard from '~/components/landing/LegalDocumentCard.vue'
import LegalPageShell from '~/components/landing/LegalPageShell.vue'
import { LEGAL_DOCUMENTS } from '#shared/constants/landing'

definePageMeta({ layout: 'default' })

const doc = LEGAL_DOCUMENTS.cookiePolicy

useSeoMeta({
	title: `${doc.title} — TenderOptima`,
	description: 'Политика использования cookie-файлов сервиса TenderOptima.',
})
</script>
