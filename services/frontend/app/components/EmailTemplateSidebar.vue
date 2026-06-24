<template>
	<div class="flex flex-col h-full min-h-0 border-l border-default pl-4">
		<div class="flex items-center justify-between gap-2 mb-3 shrink-0">
			<p class="text-sm font-semibold">Шаблоны</p>
			<div class="flex items-center gap-1">
				<UButton
					size="xs"
					variant="outline"
					leading-icon="i-lucide-plus"
					@click="openCreate"
				>
					Добавить
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
		</div>

		<div class="flex-1 min-h-0 overflow-y-auto space-y-2">
			<div v-if="loading && !templates.length" class="space-y-2">
				<USkeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-lg" />
			</div>
			<div v-else-if="!templates.length"
				class="text-xs text-muted text-center py-6">
				Нет шаблонов
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
						<UBadge v-if="template.is_global" color="info" variant="subtle" size="sm" class="ml-1">
							Общий
						</UBadge>
					</p>
					<div class="flex items-center gap-0.5 shrink-0">
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
				<p class="text-xs text-muted truncate">{{ template.subject }}</p>
				<p class="text-xs text-muted line-clamp-2 mt-0.5">{{ template.body }}</p>
			</button>
		</div>

		<UModal
			v-model:open="formOpen"
			:title="formMode === 'create' ? 'Новый шаблон' : 'Редактировать шаблон'"
			:ui="EMAIL_LETTER_MODAL_UI"
		>
			<template #body>
				<div class="space-y-4">
					<UFormField label="Заголовок">
						<UInput v-model="formTitle" placeholder="Например: Запрос на улучшение условий" class="w-full" />
					</UFormField>
					<UFormField label="Тема письма">
						<UInput v-model="formSubject" placeholder="Тема письма" class="w-full" />
					</UFormField>
					<UFormField label="Текст письма">
						<UTextarea
							v-model="formBody"
							:rows="16"
							class="w-full"
							autoresize
							placeholder="Текст письма. Можно использовать {company_name} для подстановки названия компании."
						/>
					</UFormField>
					<div class="flex justify-end gap-2 pt-2">
						<UButton variant="outline" color="neutral" @click="closeForm">
							Отмена
						</UButton>
						<UButton :loading="saving" :disabled="!formTitle.trim() || !formSubject.trim() || !formBody.trim()" @click="saveForm">
							{{ formMode === 'create' ? 'Сохранить шаблон' : 'Сохранить изменения' }}
						</UButton>
					</div>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script lang="ts" setup>
import type { EmailTemplate } from '#shared/types'
import { EMAIL_LETTER_MODAL_UI } from '#shared/constants/emailModal'

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

async function fetchTemplates() {
	loading.value = true
	try {
		templates.value = await get<EmailTemplate[]>('/email-templates')
	} catch {
		templates.value = []
		toast.add({ title: 'Не удалось загрузить шаблоны', color: 'error' })
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
	if (!formTitle.value.trim() || !formSubject.value.trim() || !formBody.value.trim()) {
		toast.add({ title: 'Заполните все поля шаблона', color: 'warning' })
		return
	}
	saving.value = true
	try {
		if (formMode.value === 'create') {
			const created = await post<EmailTemplate>('/email-templates', {
				title: formTitle.value.trim(),
				subject: formSubject.value.trim(),
				body: formBody.value.trim(),
				is_global: false,
			})
			templates.value = [created, ...templates.value]
			toast.add({ title: 'Шаблон сохранён', color: 'success' })
		} else if (editingId.value) {
			const updated = await patch<EmailTemplate>(`/email-templates/${editingId.value}`, {
				title: formTitle.value.trim(),
				subject: formSubject.value.trim(),
				body: formBody.value.trim(),
			})
			templates.value = templates.value.map((t) =>
				t.id === updated.id ? updated : t,
			)
			toast.add({ title: 'Шаблон обновлён', color: 'success' })
		}
		closeForm()
	} catch {
		toast.add({
			title: formMode.value === 'create'
				? 'Не удалось сохранить шаблон'
				: 'Не удалось обновить шаблон',
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
		templates.value = templates.value.filter((t) => t.id !== templateId)
		if (selectedId.value === templateId) selectedId.value = null
		toast.add({ title: 'Шаблон удалён', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось удалить шаблон', color: 'error' })
	} finally {
		deletingId.value = null
	}
}

onMounted(fetchTemplates)
</script>
