<template>
	<div
		class="flex flex-col h-full min-h-0"
		:class="mode === 'select' ? '' : 'border-l border-default pl-4'"
	>
		<div class="flex items-center justify-between gap-2 mb-3 shrink-0">
			<p class="text-sm font-semibold">{{ sidebarTitle }}</p>
			<div v-if="mode === 'manage'" class="flex items-center gap-1">
				<UButton
					size="xs"
					variant="outline"
					leading-icon="i-lucide-plus"
					@click="openCreate"
				>
					{{ t('inbox.templatesAdd') }}
				</UButton>
				<UButton
					size="xs"
					variant="ghost"
					color="neutral"
					icon="i-lucide-refresh-cw"
					:loading="loading"
					@click="fetchTemplates"
				/>
			</div>
			<UButton
				v-else
				size="xs"
				variant="ghost"
				color="neutral"
				icon="i-lucide-refresh-cw"
				:loading="loading"
				@click="fetchTemplates"
			/>
		</div>

		<div class="flex-1 min-h-0 overflow-y-auto space-y-2">
			<div v-if="loading && !templates.length" class="space-y-2">
				<USkeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-lg" />
			</div>
			<div
				v-else-if="!templates.length"
				class="text-xs text-muted text-center py-6"
			>
				{{ t('inbox.templatesEmpty') }}
			</div>
			<button
				v-for="template in templates"
				:key="template.id"
				type="button"
				class="w-full text-left rounded-lg border p-3 transition-colors cursor-pointer"
				:class="selectedId === template.id
					? 'border-primary bg-primary/5'
					: 'border-default hover:bg-elevated/50'"
				@click="selectTemplate(template)"
			>
				<div class="flex items-start justify-between gap-2 mb-1">
					<p class="text-sm font-medium truncate flex-1">
						{{ template.title }}
						<UBadge
							v-if="template.is_global"
							color="info"
							variant="subtle"
							size="sm"
							class="ml-1"
						>
							{{ t('inbox.templatesGlobal') }}
						</UBadge>
					</p>
					<div
						v-if="mode === 'manage'"
						class="flex items-center gap-0.5 shrink-0"
					>
						<UButton
							v-if="canEdit(template)"
							size="xs"
							variant="ghost"
							color="neutral"
							icon="i-lucide-pencil"
							@click.stop="startEdit(template)"
						/>
						<UButton
							v-if="canEdit(template)"
							size="xs"
							variant="ghost"
							color="error"
							icon="i-lucide-trash-2"
							:loading="deletingId === template.id"
							@click.stop="removeTemplate(template.id)"
						/>
					</div>
				</div>
				<p
					v-if="category === EmailTemplateCategory.LETTER"
					class="text-xs text-muted truncate"
				>
					{{ template.subject }}
				</p>
				<p class="text-xs text-muted line-clamp-2 mt-0.5">{{ template.body }}</p>
			</button>
		</div>

		<UModal
			v-model:open="formOpen"
			:title="formMode === 'create'
				? t('inbox.templatesCreateTitle')
				: t('inbox.templatesEditTitle')"
			:ui="EMAIL_LETTER_MODAL_UI"
		>
			<template #body>
				<div class="space-y-4">
					<UFormField :label="t('inbox.templatesFormTitle')">
						<UInput
							v-model="formTitle"
							:placeholder="t('inbox.templatesFormTitlePlaceholder')"
							class="w-full"
						/>
					</UFormField>
					<UFormField
						v-if="category === EmailTemplateCategory.LETTER"
						:label="t('inbox.templatesFormSubject')"
					>
						<UInput
							v-model="formSubject"
							:placeholder="t('inbox.templatesFormSubjectPlaceholder')"
							class="w-full"
						/>
					</UFormField>
					<UFormField :label="t('inbox.templatesFormBody')">
						<UTextarea
							v-model="formBody"
							:rows="16"
							class="w-full"
							autoresize
							:placeholder="t('inbox.templatesFormBodyPlaceholder')"
						/>
					</UFormField>
					<div class="flex justify-end gap-2 pt-2">
						<UButton variant="outline" color="neutral" @click="closeForm">
							{{ t('inbox.cancel') }}
						</UButton>
						<UButton
							:loading="saving"
							:disabled="!canSaveForm"
							@click="saveForm"
						>
							{{ formMode === 'create'
								? t('inbox.templatesSave')
								: t('inbox.templatesSaveChanges') }}
						</UButton>
					</div>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script lang="ts" setup>
import type { EmailTemplate } from '#shared/types'
import { EmailTemplateCategory } from '#shared/types'
import { EMAIL_LETTER_MODAL_UI } from '#shared/constants/emailModal'
import { t } from '~/constants/translations'

const props = withDefaults(
	defineProps<{
		category: EmailTemplateCategory
		mode?: 'select' | 'manage'
	}>(),
	{
		mode: 'select',
	},
)

const emit = defineEmits<{
	select: [template: EmailTemplate]
}>()

const { get, post, patch, del } = useApi()
const toast = useToast()

const templates = ref<EmailTemplate[]>([])
const loading = ref(false)
const saving = ref(false)
const deletingId = ref<string | null>(null)
const selectedId = ref<string | null>(null)

const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const formTitle = ref('')
const formSubject = ref('')
const formBody = ref('')

const sidebarTitle = computed(() =>
	props.category === EmailTemplateCategory.QUICK_REPLY
		? t('inbox.quickReplyTemplates')
		: t('inbox.letterTemplates'),
)

const requiresSubject = computed(
	() => props.category === EmailTemplateCategory.LETTER,
)

const canSaveForm = computed(() => {
	if (!formTitle.value.trim() || !formBody.value.trim()) return false
	if (requiresSubject.value && !formSubject.value.trim()) return false
	return true
})

async function fetchTemplates() {
	loading.value = true
	try {
		templates.value = await get<EmailTemplate[]>(
			`/email-templates?category=${props.category}`,
		)
	} catch {
		templates.value = []
		toast.add({ title: t('inbox.templatesLoadError'), color: 'error' })
	} finally {
		loading.value = false
	}
}

function canEdit(template: EmailTemplate): boolean {
	return !template.is_global
}

function selectTemplate(template: EmailTemplate) {
	selectedId.value = template.id
	emit('select', template)
}

function resetForm() {
	formTitle.value = ''
	formSubject.value = ''
	formBody.value = ''
	editingId.value = null
}

function openCreate() {
	formMode.value = 'create'
	resetForm()
	formOpen.value = true
}

function closeForm() {
	formOpen.value = false
	resetForm()
}

function startEdit(template: EmailTemplate) {
	formMode.value = 'edit'
	editingId.value = template.id
	formTitle.value = template.title
	formSubject.value = template.subject
	formBody.value = template.body
	formOpen.value = true
}

async function saveForm() {
	if (!canSaveForm.value) {
		toast.add({ title: t('inbox.templatesFormIncomplete'), color: 'warning' })
		return
	}
	saving.value = true
	try {
		const subject = requiresSubject.value
			? formSubject.value.trim()
			: formTitle.value.trim()
		if (formMode.value === 'create') {
			const created = await post<EmailTemplate>('/email-templates', {
				title: formTitle.value.trim(),
				subject,
				body: formBody.value.trim(),
				is_global: false,
				category: props.category,
			})
			templates.value = [created, ...templates.value]
			toast.add({ title: t('inbox.templatesSaved'), color: 'success' })
		} else if (editingId.value) {
			const updated = await patch<EmailTemplate>(
				`/email-templates/${editingId.value}`,
				{
					title: formTitle.value.trim(),
					subject,
					body: formBody.value.trim(),
				},
			)
			templates.value = templates.value.map((item) =>
				item.id === updated.id ? updated : item,
			)
			toast.add({ title: t('inbox.templatesUpdated'), color: 'success' })
		}
		closeForm()
	} catch {
		toast.add({
			title: formMode.value === 'create'
				? t('inbox.templatesSaveError')
				: t('inbox.templatesUpdateError'),
			color: 'error',
		})
	} finally {
		saving.value = false
	}
}

async function removeTemplate(templateId: string) {
	deletingId.value = templateId
	try {
		await del(`/email-templates/${templateId}`)
		templates.value = templates.value.filter((item) => item.id !== templateId)
		if (selectedId.value === templateId) selectedId.value = null
		toast.add({ title: t('inbox.templatesDeleted'), color: 'success' })
	} catch {
		toast.add({ title: t('inbox.templatesDeleteError'), color: 'error' })
	} finally {
		deletingId.value = null
	}
}

watch(
	() => props.category,
	() => {
		selectedId.value = null
		void fetchTemplates()
	},
	{ immediate: true },
)

defineExpose({ fetchTemplates })
</script>
