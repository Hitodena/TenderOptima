<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'
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

async function onSettingsSelect(template: EmailTemplate) {
	await insertTemplate(template)
}

async function openQuickReplyMenu() {
	await fetchTemplates()
}

const menuItems = computed((): DropdownMenuItem[][] => {
	if (!templates.value.length) {
		return [[{
			label: t('inbox.templatesEmpty'),
			disabled: true,
		}]]
	}
	return [
		templates.value.map((template) => ({
			label: template.is_primary
				? `${template.title} · ${t('inbox.templatesPrimary')}`
				: template.title,
			description: template.body.slice(0, 80),
			onSelect: () => {
				void insertTemplate(template)
			},
		})),
	]
})

watch(settingsOpen, (open) => {
	if (!open) {
		// Refresh list after manage modal closes so new templates appear in the menu.
		void fetchTemplates(true)
	}
})
</script>

<template>
	<div class="inline-flex items-center gap-0.5">
		<UDropdownMenu
			:items="menuItems"
			:ui="{ content: 'min-w-56 max-w-80' }"
			@update:open="(open: boolean) => { if (open) void openQuickReplyMenu() }"
		>
			<UButton
				type="button"
				color="neutral"
				variant="outline"
				size="sm"
				leading-icon="i-lucide-mail-check"
				:loading="loading"
			>
				{{ t('inbox.quickReplyTemplates') }}
			</UButton>
		</UDropdownMenu>
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
