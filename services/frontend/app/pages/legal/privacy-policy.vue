<template>
	<div>
		<BaseSection tone="elevated" max-width="3xl">
			<div class="text-center">
				<LegalDocumentCard
					:title="doc.title"
					:href="doc.href"
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

const doc = LEGAL_DOCUMENTS.privacyPolicy

useSeoMeta({
	title: `${doc.title} — TenderOptima`,
	description: 'Политика обработки персональных данных сервиса TenderOptima.',
})
</script>
