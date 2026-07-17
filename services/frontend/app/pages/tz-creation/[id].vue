<template>
	<UContainer class="py-8 max-w-7xl">
		<template v-if="loading">
			<div class="space-y-4">
				<USkeleton class="h-10 w-72" />
				<USkeleton class="h-6 w-48" />
				<USkeleton class="h-64 w-full" />
			</div>
		</template>

		<template v-else-if="notFound">
			<div class="text-center py-16">
				<UIcon name="i-lucide-file-question" class="w-12 h-12 mx-auto mb-3 text-muted opacity-40" />
				<p class="text-muted">Сессия конструктора ТЗ не найдена</p>
				<UButton to="/tz-creation" variant="outline" size="sm" class="mt-3">
					К конструктору ТЗ
				</UButton>
			</div>
		</template>

		<template v-else-if="session">
			<div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
				<div class="min-w-0">
					<UButton
						to="/tz-creation/history"
						variant="ghost"
						color="neutral"
						size="sm"
						leading-icon="i-lucide-arrow-left"
						class="-ml-1 mb-2"
					>
						К истории
					</UButton>
					<div class="flex items-center gap-3 mb-1 flex-wrap">
						<h1 class="text-2xl font-bold text-highlighted truncate">
							{{ session.title || 'Тендер на закупку' }}
						</h1>
						<UBadge :color="getTzCreationStatusColor(session.status)" variant="subtle" size="lg">
							{{ getTzCreationStatusLabel(session.status) }}
						</UBadge>
						<UBadge color="neutral" variant="outline" size="lg">
							{{ session.mode === 'from_scratch' ? 'С нуля' : 'Дополнение ТЗ' }}
						</UBadge>
					</div>
					<div class="flex items-center gap-3 text-sm text-muted flex-wrap">
						<span v-if="session.created_at" class="flex items-center gap-1">
							<UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
							{{ formatDate(session.created_at) }}
						</span>
						<span class="flex items-center gap-1">
							<UIcon name="i-lucide-tag" class="w-3.5 h-3.5" />
							{{ domainLabel(session.context.domain) }}
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					<UButton
						variant="outline"
						color="neutral"
						leading-icon="i-lucide-file-down"
						:disabled="!hasAnyRequirement"
						@click="exportDocx"
					>
						Экспорт .docx
					</UButton>
					<UButton
						v-if="session.resulting_tz_analysis_id"
						color="primary"
						variant="solid"
						leading-icon="i-lucide-scale"
						:to="`/tz-analysis/${session.resulting_tz_analysis_id}`"
					>
						Открыть сравнение с КП
					</UButton>
					<UButton
						v-else-if="session.status === 'active'"
						color="primary"
						variant="solid"
						leading-icon="i-lucide-check"
						:loading="finalizing"
						:disabled="!canFinalize"
						@click="finalizeSession"
					>
						Готово → сравнить с КП
					</UButton>
				</div>
			</div>

			<template v-if="showUploadForm">
				<UAlert
					v-if="session.status === 'failed'"
					color="error"
					variant="soft"
					icon="i-lucide-circle-alert"
					class="mb-4"
					description="Не удалось обработать загруженное ТЗ. Проверьте файл и попробуйте снова."
				/>
				<UAlert
					color="info"
					variant="soft"
					icon="i-lucide-info"
					class="mb-4"
					description="Загрузите техническое задание — ИИ извлечёт структуру, найдёт пробелы и подводные камни с учётом выбранного типа закупки, и начнёт диалог с уточняющими вопросами."
				/>
				<UCard class="shadow-sm max-w-2xl">
					<UFormField label="Техническое задание" required>
						<UFileUpload
							:model-value="uploadFile"
							:accept="fileAccept"
							:interactive="false"
							description="PDF, DOCX, XLSX, TXT, изображения"
							layout="list"
							class="w-full min-h-32"
							position="inside"
							@update:model-value="onUploadFileChange"
						>
							<template #actions="{ open }">
								<UButton type="button" variant="outline" size="sm" @click="open()">
									<UIcon name="i-lucide-file-text" class="w-4 h-4" />
									Выбрать файл
								</UButton>
							</template>
						</UFileUpload>
					</UFormField>

					<UButton
						block
						size="lg"
						class="mt-5"
						leading-icon="i-lucide-scan-search"
						:loading="uploading"
						:disabled="!uploadFile"
						@click="submitUpload"
					>
						Загрузить и начать анализ
					</UButton>

					<SubscriptionErrorAlert
						v-if="uploadError"
						:error="uploadError"
						fallback="Не удалось загрузить файл. Попробуйте ещё раз."
						class="mt-4"
					/>
				</UCard>
			</template>

			<template v-else-if="session.status === 'processing'">
				<UCard class="shadow-sm max-w-2xl">
					<div class="flex flex-col items-center justify-center gap-3 py-8 text-muted">
						<UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin text-primary" />
						<p class="text-sm text-center">
							Извлекаем требования и анализируем пробелы в загруженном ТЗ…
						</p>
						<UProgress animation="carousel" size="sm" class="w-full max-w-xs" />
					</div>
				</UCard>
			</template>

			<template v-else>
				<UTabs
					v-model="activePanel"
					:items="mobilePanelTabs"
					:content="false"
					class="mb-4 xl:hidden"
				/>

				<div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_20rem] gap-4 items-start">
					<UCard
						class="shadow-sm flex flex-col overflow-hidden"
						:class="activePanel === 'chat' ? 'block' : 'hidden xl:block'"
						style="height: min(72vh, 680px)"
						:ui="{ body: 'flex-1 flex flex-col p-0 overflow-hidden' }"
					>
						<template #header>
							<div class="flex items-center justify-between gap-2">
								<p class="font-semibold text-sm">Диалог с ИИ</p>
								<UBadge :color="quotaBadgeColor" variant="subtle" size="xs">
									{{ messagesRemaining }} / {{ session.messages_limit }} сообщений
								</UBadge>
							</div>
						</template>

						<div ref="chatScrollRef" class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
							<div
								v-if="!session.messages.length"
								class="text-sm text-muted text-center py-10"
							>
								{{ emptyChatHint }}
							</div>
							<div
								v-for="(message, index) in session.messages"
								:key="index"
								class="flex"
								:class="message.role === 'user' ? 'justify-end' : 'justify-start'"
							>
								<div
									class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words"
									:class="message.role === 'user'
										? 'bg-primary/10 border border-primary/20 rounded-tr-md text-highlighted'
										: 'bg-elevated rounded-tl-md text-default'"
								>
									{{ message.content }}
								</div>
							</div>
							<div v-if="sending" class="flex justify-start">
								<div class="rounded-2xl rounded-tl-md bg-elevated px-3.5 py-2.5">
									<UIcon name="i-lucide-loader" class="w-4 h-4 animate-spin text-muted" />
								</div>
							</div>
						</div>

						<div class="border-t border-default p-3 space-y-2 shrink-0">
							<UAlert
								v-if="session.status === 'active' && messagesRemaining <= 5"
								color="warning"
								variant="soft"
								icon="i-lucide-message-circle-warning"
								:description="messagesRemaining > 0
									? `Осталось ${messagesRemaining} сообщений в этой сессии`
									: 'Лимит сообщений в этой сессии исчерпан'"
							/>
							<div class="flex gap-2">
								<UTextarea
									v-model="messageText"
									:rows="1"
									autoresize
									:maxrows="5"
									placeholder="Опишите требования или ответьте на вопрос ИИ..."
									class="flex-1"
									:disabled="!canChat || sending"
									@keydown.enter.exact.prevent="sendMessage"
								/>
								<UButton
									icon="i-lucide-send"
									:loading="sending"
									:disabled="!canChat || !messageText.trim()"
									@click="sendMessage"
								/>
							</div>
							<SubscriptionErrorAlert
								v-if="sendError"
								:error="sendError"
								fallback="Не удалось отправить сообщение"
							/>
						</div>
					</UCard>

					<UCard
						class="shadow-sm"
						:class="activePanel === 'structure' ? 'block' : 'hidden xl:block'"
					>
						<template #header>
							<div class="flex items-center justify-between gap-2 flex-wrap">
								<div class="flex items-center gap-2">
									<p class="font-semibold text-sm">Структура ТЗ</p>
									<UBadge color="neutral" variant="subtle" size="xs">
										{{ requirementsCount }} {{ requirementWord(requirementsCount) }}
									</UBadge>
								</div>
								<div v-if="structureDirty" class="flex items-center gap-1.5">
									<UButton
										size="xs"
										variant="ghost"
										color="neutral"
										@click="discardStructureEdits"
									>
										Отменить
									</UButton>
									<UButton
										size="xs"
										color="primary"
										:loading="savingStructure"
										@click="saveStructure"
									>
										Сохранить
									</UButton>
								</div>
							</div>
						</template>

						<div class="max-h-[min(60vh,640px)] overflow-y-auto pr-1">
							<RequirementTreeEditor
								v-if="editableRows.length"
								:rows="editableRows"
								scope-id="tz-creation"
								@remove="removeRequirement"
								@add-child="addChildRequirement"
								@add-heading="addHeadingRequirement"
								@add-sibling="addSiblingRequirement"
								@reorder="reorderRequirement"
							/>
							<div v-else class="flex flex-col items-center gap-3 py-6">
								<p class="text-sm text-muted text-center">
									Структура пока пуста — она заполнится по ходу диалога,
									либо добавьте раздел вручную
								</p>
								<UButton
									type="button"
									variant="soft"
									color="primary"
									size="sm"
									icon="i-lucide-plus"
									label="Добавить раздел"
									@click="addRequirement"
								/>
							</div>
						</div>
					</UCard>

					<UCard
						class="shadow-sm"
						:class="activePanel === 'fields' ? 'block' : 'hidden xl:block'"
					>
						<template #header>
							<div class="flex items-center justify-between gap-2">
								<p class="font-semibold text-sm">Параметры ТЗ</p>
								<UButton
									v-if="fieldsDirty"
									size="xs"
									color="primary"
									:loading="savingFields"
									@click="saveFields"
								>
									Сохранить
								</UButton>
							</div>
						</template>

						<div class="max-h-[min(60vh,640px)] overflow-y-auto pr-1 space-y-3">
							<p v-if="!editableFields.length" class="text-sm text-muted text-center py-6">
								Параметры появятся по ходу диалога с ИИ
							</p>
							<div
								v-for="field in editableFields"
								:key="field.key"
								class="space-y-1.5"
							>
								<div class="flex items-center justify-between gap-2">
									<p class="text-xs font-medium text-muted">{{ field.label }}</p>
									<UBadge :color="fieldStatusColor(field.status)" variant="subtle" size="xs">
										{{ fieldStatusLabel(field.status) }}
									</UBadge>
								</div>
								<UInput
									v-model="field.value"
									size="sm"
									class="w-full"
									placeholder="Значение не указано"
									@update:model-value="fieldsDirty = true"
								/>
							</div>
						</div>
					</UCard>
				</div>
			</template>
		</template>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TZCreationField, TZCreationSession } from '#shared/types'
import { getTzCreationStatusColor, getTzCreationStatusLabel } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'
import {
	flattenRequirementsToEditableRows,
	insertChildAfterParentRow,
	insertSiblingAfterRow,
	moveRequirementRowBlock,
	nextTopLevelKey,
	renumberRequirementRows,
	requirementsRowsNonempty,
	rowsToHierarchy,
	type EditableRequirementRow,
} from '#shared/utils/requirementsStruct'
import RequirementTreeEditor from '~/components/tz-analysis/RequirementTreeEditor.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const sessionId = route.params.id as string

const { get, post, patch } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()
const { formatDate } = useFormatDate()

const session = ref<TZCreationSession | null>(null)
const loading = ref(true)
const notFound = ref(false)
const polling = ref(false)

const DOMAIN_LABELS: Record<string, string> = {
	equipment: 'Оборудование',
	food: 'Пищевая продукция',
	services: 'Услуги',
	other: 'Другое',
}

function domainLabel(domain: string): string {
	return DOMAIN_LABELS[domain] ?? domain
}

function requirementWord(count: number): string {
	const mod10 = count % 10
	const mod100 = count % 100
	if (mod100 >= 11 && mod100 <= 14) return 'пунктов'
	if (mod10 === 1) return 'пункт'
	if (mod10 >= 2 && mod10 <= 4) return 'пункта'
	return 'пунктов'
}

async function fetchSession(): Promise<TZCreationSession | null> {
	try {
		return await get<TZCreationSession>(`/tz-creation/${sessionId}`)
	} catch {
		return null
	}
}

onMounted(async () => {
	loading.value = true
	const data = await fetchSession()
	if (!data) {
		notFound.value = true
	} else {
		session.value = data
		if (data.status === 'processing') polling.value = true
	}
	loading.value = false
})

useRunStatusPolling(
	polling,
	fetchSession,
	(data) => { session.value = data },
	async () => {
		toast.add({
			title: 'Анализ загруженного ТЗ завершён',
			description: 'ИИ нашёл первые вопросы и подсказки — продолжите диалог',
			color: 'success',
			icon: 'i-lucide-check',
		})
	},
	async () => {
		toast.add({
			title: 'Не удалось обработать загруженное ТЗ',
			color: 'error',
		})
	},
)

const showUploadForm = computed(() =>
	session.value?.mode === 'refine_existing'
	&& (session.value.status === 'draft' || session.value.status === 'failed'),
)

const activePanel = ref<'chat' | 'structure' | 'fields'>('chat')
const mobilePanelTabs = [
	{ label: 'Чат', icon: 'i-lucide-message-circle', value: 'chat' as const },
	{ label: 'Структура', icon: 'i-lucide-list-tree', value: 'structure' as const },
	{ label: 'Параметры', icon: 'i-lucide-sliders-horizontal', value: 'fields' as const },
]

const emptyChatHint = computed(() =>
	session.value?.mode === 'from_scratch'
		? 'Опишите абстрактно, что нужно закупить — ИИ предложит структуру ТЗ и уточнит детали'
		: 'ИИ проанализирует загруженное ТЗ и напишет первым',
)

/* --- Chat --- */

const messageText = ref('')
const sending = ref(false)
const sendError = ref<unknown | null>(null)
const chatScrollRef = ref<HTMLElement | null>(null)

const messagesRemaining = computed(() => {
	if (!session.value) return 0
	return Math.max(0, session.value.messages_limit - session.value.messages_used)
})

const quotaBadgeColor = computed(() => {
	if (messagesRemaining.value <= 3) return 'error' as const
	if (messagesRemaining.value <= 10) return 'warning' as const
	return 'neutral' as const
})

const canChat = computed(() =>
	session.value?.status === 'active' && messagesRemaining.value > 0,
)

function scrollChatToBottom() {
	nextTick(() => {
		const el = chatScrollRef.value
		if (el) el.scrollTop = el.scrollHeight
	})
}

async function sendMessage() {
	const text = messageText.value.trim()
	if (!text || !session.value || sending.value || !canChat.value) return
	sending.value = true
	sendError.value = null
	try {
		const updated = await post<TZCreationSession>(
			`/tz-creation/${session.value.id}/messages`,
			{ message: text },
		)
		session.value = updated
		messageText.value = ''
		scrollChatToBottom()
	} catch (e) {
		sendError.value = e
	} finally {
		sending.value = false
	}
}

watch(() => session.value?.messages.length, () => scrollChatToBottom())

/* --- Structure (draft outline) --- */

const editableRows = ref<EditableRequirementRow[]>([])
const structureDirty = ref(false)
const savingStructure = ref(false)

watch(
	() => session.value?.draft_hierarchy,
	(hierarchy) => {
		if (structureDirty.value) return
		editableRows.value = flattenRequirementsToEditableRows(hierarchy ?? {})
	},
	{ immediate: true, deep: true },
)

const requirementsCount = computed(() =>
	editableRows.value.filter((row) => !row.isHeading && row.text.trim()).length,
)
const hasAnyRequirement = computed(() => requirementsRowsNonempty(editableRows.value))

function updateEditableRows(
	mutator: (rows: EditableRequirementRow[]) => EditableRequirementRow[],
) {
	editableRows.value = renumberRequirementRows(mutator(editableRows.value))
	structureDirty.value = true
}

function addRequirement() {
	updateEditableRows((rows) => [...rows, { key: nextTopLevelKey(rows), text: '' }])
}

function addChildRequirement(parentKey: string) {
	const parentNorm = parentKey.trim().replace(/\//g, '.')
	updateEditableRows((rows) => {
		const withHeading = rows.map((row) =>
			row.key.trim().replace(/\//g, '.') === parentNorm
				? { ...row, isHeading: true }
				: row,
		)
		return insertChildAfterParentRow(withHeading, parentKey)
	})
}

function addHeadingRequirement(parentKey: string) {
	updateEditableRows((rows) =>
		insertChildAfterParentRow(rows, parentKey, { isHeading: true }),
	)
}

function removeRequirement(index: number) {
	updateEditableRows((rows) => rows.filter((_, idx) => idx !== index))
}

function addSiblingRequirement(afterIndex: number) {
	updateEditableRows((rows) => insertSiblingAfterRow(rows, afterIndex))
}

function reorderRequirement(fromIndex: number, toIndex: number) {
	updateEditableRows((rows) => moveRequirementRowBlock(rows, fromIndex, toIndex))
}

async function saveStructure() {
	if (!session.value) return
	savingStructure.value = true
	try {
		const hierarchy = rowsToHierarchy(editableRows.value)
		const updated = await patch<TZCreationSession>(
			`/tz-creation/${session.value.id}/hierarchy`,
			{ draft_hierarchy: hierarchy },
		)
		session.value = updated
		structureDirty.value = false
	} catch {
		toast.add({ title: 'Не удалось сохранить структуру ТЗ', color: 'error' })
	} finally {
		savingStructure.value = false
	}
}

function discardStructureEdits() {
	structureDirty.value = false
	editableRows.value = flattenRequirementsToEditableRows(
		session.value?.draft_hierarchy ?? {},
	)
}

/* --- Side panel fields --- */

const editableFields = ref<TZCreationField[]>([])
const fieldsDirty = ref(false)
const savingFields = ref(false)

watch(
	() => session.value?.fields,
	(fields) => {
		if (fieldsDirty.value) return
		editableFields.value = (fields ?? []).map((field) => ({ ...field }))
	},
	{ immediate: true, deep: true },
)

function fieldStatusColor(status: string) {
	if (status === 'answered') return 'success' as const
	if (status === 'suggested') return 'primary' as const
	return 'neutral' as const
}

function fieldStatusLabel(status: string) {
	if (status === 'answered') return 'Уточнено'
	if (status === 'suggested') return 'Предложено ИИ'
	return 'Нужно уточнить'
}

async function saveFields() {
	if (!session.value) return
	savingFields.value = true
	try {
		const payload = editableFields.value.map((field) => ({
			...field,
			status: field.value.trim() ? 'answered' : field.status,
		}))
		const updated = await patch<TZCreationSession>(
			`/tz-creation/${session.value.id}/fields`,
			{ fields: payload },
		)
		session.value = updated
		fieldsDirty.value = false
	} catch {
		toast.add({ title: 'Не удалось сохранить параметры', color: 'error' })
	} finally {
		savingFields.value = false
	}
}

/* --- Upload (refine_existing) --- */

const uploadFile = ref<File | null>(null)
const uploading = ref(false)
const uploadError = ref<unknown | null>(null)
const fileAccept = '.pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp'

function onUploadFileChange(file: File | null | undefined) {
	uploadFile.value = file ?? null
}

async function submitUpload() {
	if (!uploadFile.value || !session.value || uploading.value) return
	uploading.value = true
	uploadError.value = null
	try {
		const fd = new FormData()
		fd.append('tz_file', uploadFile.value)
		const updated = await post<TZCreationSession>(
			`/tz-creation/${session.value.id}/upload`,
			fd,
		)
		session.value = updated
		if (updated.status === 'processing') polling.value = true
	} catch (e) {
		uploadError.value = e
	} finally {
		uploading.value = false
	}
}

/* --- Export / finalize --- */

async function downloadBlob(url: string, filename: string) {
	const res = await $axios.get(url, { responseType: 'blob' })
	const blob = res.data as Blob
	const objectUrl = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = objectUrl
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	URL.revokeObjectURL(objectUrl)
}

async function exportDocx() {
	if (!session.value) return
	try {
		await downloadBlob(
			`/tz-creation/${session.value.id}/export.docx`,
			`tz_creation_${session.value.id}.docx`,
		)
	} catch {
		toast.add({ title: 'Не удалось сформировать .docx', color: 'error' })
	}
}

const finalizing = ref(false)
const canFinalize = computed(() =>
	session.value?.status === 'active' && hasAnyRequirement.value,
)

async function finalizeSession() {
	if (!session.value || finalizing.value || !canFinalize.value) return
	finalizing.value = true
	try {
		if (structureDirty.value) await saveStructure()
		const result = await post<{ tz_analysis_id: string }>(
			`/tz-creation/${session.value.id}/finalize`,
		)
		toast.add({
			title: 'ТЗ готово к сравнению с КП',
			color: 'success',
			icon: 'i-lucide-check',
		})
		await navigateTo(`/tz-analysis/${result.tz_analysis_id}`)
	} catch (e) {
		toast.add({
			title: getApiErrorDetail(e) ?? 'Не удалось завершить конструктор ТЗ',
			color: 'error',
		})
	} finally {
		finalizing.value = false
	}
}
</script>
