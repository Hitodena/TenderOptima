<script lang="ts" setup>
import { appendBusinessInfoToBody } from '#shared/utils/businessInfo'
import { t } from '~/constants/translations'

const body = defineModel<string>({ required: true })

const emit = defineEmits<{ inserted: [] }>()

const { ensureLoaded } = useBusinessInfo()
const toast = useToast()
const loading = ref(false)

async function handleInsert() {
	loading.value = true
	try {
		const businessText = (await ensureLoaded()).trim()
		if (!businessText) {
			toast.add({
				title: t('inbox.businessCardMissing'),
				description: t('inbox.businessCardMissingHint'),
				color: 'warning',
				actions: [{
					label: t('inbox.profileLink'),
					onClick: () => { navigateTo('/profile?tab=business_card') },
				}],
			})
			return
		}

		const parts = [
			t('inbox.receiptIntro'),
			'',
			businessText,
		]
		const template = parts.join('\n')
		body.value = appendBusinessInfoToBody(body.value, template)
		emit('inserted')
	} finally {
		loading.value = false
	}
}
</script>

<template>
	<UButton
		type="button"
		color="neutral"
		variant="outline"
		size="sm"
		leading-icon="i-lucide-mail-check"
		:loading="loading"
		@click="handleInsert"
	>
		{{ t('inbox.receiptAcknowledgement') }}
	</UButton>
</template>
