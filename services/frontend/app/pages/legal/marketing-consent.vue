<template>
	<div>
		<BaseSection tone="elevated" max-width="5xl">
			<div class="text-center">
				<h1 class="landing-section-title">
					{{ doc.title }}
				</h1>
			</div>
		</BaseSection>

		<BaseSection max-width="5xl">
			<LegalDocumentCard
				:title="doc.title"
				:href="doc.href"
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
