<script lang="ts" setup>
import type { EmailTemplate } from '#shared/types'
import {
	EMAIL_LETTER_MODAL_FOOTER_CLASS,
	EMAIL_LETTER_MODAL_UI,
} from '#shared/constants/emailModal'
import { appendBusinessInfoToBody } from '#shared/utils/businessInfo'
import { t } from '~/constants/translations'
import EmailTemplateSidebar from '~/components/EmailTemplateSidebar.vue'

const body = defineModel<string>({ required: true })

const emit = defineEmits<{ inserted: [] }>()

const { ensureLoaded } = useBusinessInfo()
const toast = useToast()

const isOpen = ref(false)
const draftBody = ref('')
const loading = ref(false)

function defaultBody(): string {
	return t('inbox.receiptIntro')
}

function resetDraft() {
	draftBody.value = defaultBody()
}

function openModal() {
	resetDraft()
	isOpen.value = true
}

function closeModal() {
	isOpen.value = false
}

function applyTemplate(template: EmailTemplate) {
	draftBody.value = template.body
}

async function insertIntoReply() {
	const text = draftBody.value.trim()
	if (!text) return
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

		const parts = [text, '', businessText]
		const template = parts.join('\n')
		body.value = appendBusinessInfoToBody(body.value, template)
		emit('inserted')
		closeModal()
	} finally {
		loading.value = false
	}
}

watch(isOpen, (open) => {
	if (open) resetDraft()
})
</script>

<template>
	<UButton
		type="button"
		color="neutral"
		variant="outline"
		size="sm"
		leading-icon="i-lucide-mail-check"
		@click="openModal"
	>
		{{ t('inbox.receiptAcknowledgement') }}
	</UButton>

	<UModal
		v-model:open="isOpen"
		:title="t('inbox.receiptModalTitle')"
		:ui="EMAIL_LETTER_MODAL_UI"
	>
		<template #body>
			<div class="flex flex-col min-h-[min(70vh,40rem)]">
				<div class="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
					<div class="flex flex-col md:flex-row gap-4">
						<div class="flex-1 min-w-0 flex flex-col gap-4">
							<UFormField :label="t('inbox.receiptModalTitle')">
								<UTextarea
									v-model="draftBody"
									:rows="12"
									class="w-full"
									autoresize
									:maxrows="20"
									:ui="{ base: 'min-h-[min(36vh,20rem)] resize-y' }"
								/>
							</UFormField>
						</div>
						<div class="w-full md:w-72 shrink-0 min-h-64 md:min-h-0">
							<EmailTemplateSidebar @select="applyTemplate" />
						</div>
					</div>
				</div>

				<div :class="EMAIL_LETTER_MODAL_FOOTER_CLASS">
					<UButton color="neutral" variant="ghost" @click="closeModal">
						{{ t('inbox.cancel') }}
					</UButton>
					<UButton
						leading-icon="i-lucide-check"
						:loading="loading"
						:disabled="!draftBody.trim()"
						@click="insertIntoReply"
					>
						{{ t('inbox.insertIntoReply') }}
					</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>
