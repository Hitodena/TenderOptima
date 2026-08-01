<template>
	<div>
		<BaseSection tone="elevated" max-width="3xl">
			<div class="flex flex-col items-center gap-4 text-center">
				<LegalDocumentCard
					:title="doc.title"
					:href="doc.href"
				/>
				<LegalDocumentCard
					title="Реестр cookie-файлов"
					href="/legal/cookies-inventory.pdf"
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
