<script lang="ts" setup>
import type { EmailTemplate } from '#shared/types'
import { EmailTemplateCategory } from '#shared/types'
import { EMAIL_LETTER_MODAL_UI } from '#shared/constants/emailModal'
import { appendBusinessInfoToBody } from '#shared/utils/businessInfo'
import { t } from '~/constants/translations'
import EmailTemplateSidebar from '~/components/EmailTemplateSidebar.vue'

const body = defineModel<string>({ required: true })

const props = withDefaults(defineProps<{
	companyName?: string | null
}>(), {
	companyName: null,
})

const emit = defineEmits<{ inserted: [] }>()

const { get } = useApi()
const { ensureLoaded } = useBusinessInfo()
const toast = useToast()

const settingsOpen = ref(false)
const loading = ref(false)
const templates = ref<EmailTemplate[]>([])
const templatesLoaded = ref(false)

function applyPlaceholders(text: string): string {
	const company = props.companyName?.trim() || ''
	return text.replace(/\{company_name\}/g, company)
}

async function fetchTemplates(force = false) {
	if (templatesLoaded.value && !force) return
	loading.value = true
	try {
		templates.value = await get<EmailTemplate[]>(
			`/email-templates?category=${EmailTemplateCategory.QUICK_REPLY}`,
		)
		templatesLoaded.value = true
	} catch {
		templates.value = []
		toast.add({ title: t('inbox.templatesLoadError'), color: 'error' })
	} finally {
		loading.value = false
	}
}

function resolveDefaultTemplate(): EmailTemplate | null {
	if (!templates.value.length) return null
	return (
		templates.value.find((item) => item.is_primary)
		?? templates.value[0]
		?? null
	)
}

async function insertTemplate(template: EmailTemplate) {
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

		const text = applyPlaceholders(template.body).trim()
		const parts = [text, '', businessText]
		body.value = appendBusinessInfoToBody(body.value, parts.join('\n'))
		emit('inserted')
		settingsOpen.value = false
	} finally {
		loading.value = false
	}
}

async function insertDefaultQuickReply() {
	await fetchTemplates()
	const template = resolveDefaultTemplate()
	if (!template) {
		toast.add({
			title: t('inbox.templatesEmpty'),
			description: t('inbox.quickReplyTemplatesSettings'),
			color: 'warning',
		})
		return
	}
	await insertTemplate(template)
}

async function onSettingsSelect(template: EmailTemplate) {
	await insertTemplate(template)
}

watch(settingsOpen, (open) => {
	if (open) {
		void fetchTemplates(true)
		return
	}
	// Refresh after manage modal closes so primary changes apply on next insert.
	void fetchTemplates(true)
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
			@click="insertDefaultQuickReply"
		>
			{{ t('inbox.quickReplyTemplates') }}
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
				<p class="text-xs text-muted mb-3">
					{{ t('inbox.quickReplySelectHint') }}
				</p>
				<EmailTemplateSidebar
					:category="EmailTemplateCategory.QUICK_REPLY"
					mode="manage"
					@select="onSettingsSelect"
				/>
			</div>
		</template>
	</UModal>
</template>
