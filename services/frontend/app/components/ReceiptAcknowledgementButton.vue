<script lang="ts" setup>
import type { EmailTemplate } from '#shared/types'
import { EmailTemplateCategory } from '#shared/types'
import { EMAIL_LETTER_MODAL_UI } from '#shared/constants/emailModal'
import { appendBusinessInfoToBody } from '#shared/utils/businessInfo'
import { t } from '~/constants/translations'
import EmailTemplateSidebar from '~/components/EmailTemplateSidebar.vue'

const body = defineModel<string>({ required: true })

const emit = defineEmits<{ inserted: [] }>()

const { get } = useApi()
const { ensureLoaded } = useBusinessInfo()
const toast = useToast()

const settingsOpen = ref(false)
const loading = ref(false)
const quickReplyBody = ref<string | null>(null)

const RECEIPT_TEMPLATE_TITLE = 'Ответ о получении'

async function resolveQuickReplyBody(): Promise<string> {
	if (quickReplyBody.value !== null) return quickReplyBody.value
	try {
		const templates = await get<EmailTemplate[]>(
			`/email-templates?category=${EmailTemplateCategory.QUICK_REPLY}`,
		)
		const preferred = templates.find(
			(item) => item.title === RECEIPT_TEMPLATE_TITLE,
		) ?? templates[0]
		quickReplyBody.value = preferred?.body ?? t('inbox.receiptIntro')
	} catch {
		quickReplyBody.value = t('inbox.receiptIntro')
	}
	return quickReplyBody.value
}

function invalidateQuickReplyCache() {
	quickReplyBody.value = null
}

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

		const text = (await resolveQuickReplyBody()).trim()
		const parts = [text, '', businessText]
		body.value = appendBusinessInfoToBody(body.value, parts.join('\n'))
		emit('inserted')
	} finally {
		loading.value = false
	}
}

watch(settingsOpen, (open) => {
	if (!open) invalidateQuickReplyCache()
})
</script>

<template>
	<div class="inline-flex items-center gap-0.5">
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
		<UButton
			type="button"
			color="neutral"
			variant="ghost"
			size="sm"
			icon="i-lucide-settings"
			:title="t('inbox.quickReplyTemplatesSettings')"
			:aria-label="t('inbox.quickReplyTemplatesSettings')"
			@click="settingsOpen = true"
		/>
	</div>

	<UModal
		v-model:open="settingsOpen"
		:title="t('inbox.quickReplyTemplatesSettings')"
		:ui="EMAIL_LETTER_MODAL_UI"
	>
		<template #body>
			<div class="min-h-[min(60vh,32rem)]">
				<EmailTemplateSidebar
					:category="EmailTemplateCategory.QUICK_REPLY"
					mode="manage"
				/>
			</div>
		</template>
	</UModal>
</template>
