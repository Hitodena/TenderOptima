<template>
	<UContainer class="py-8">
		<template v-if="loading">
			<div class="space-y-4">
				<USkeleton class="h-10 w-72" />
				<USkeleton class="h-6 w-48" />
				<USkeleton class="h-64 w-full" />
			</div>
		</template>

		<template v-else-if="analysis">
			<div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
				<div class="min-w-0">
					<UButton to="/tz-analysis/history" variant="ghost" color="neutral" size="sm"
						leading-icon="i-lucide-arrow-left" class="-ml-1 mb-2">
						К анализам
					</UButton>
					<div class="flex items-center gap-3 mb-1 flex-wrap">
						<h1 class="text-2xl font-bold text-highlighted truncate">
							{{ analysis.title || 'Анализ ТЗ' }}
						</h1>
						<UBadge :color="statusColor" variant="subtle" size="lg">{{ statusLabel }}</UBadge>
					</div>
					<div class="flex items-center gap-3 text-sm text-muted flex-wrap">
						<span v-if="analysis.created_at" class="flex items-center gap-1">
							<UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
							{{ formatDate(analysis.created_at) }}
						</span>
						<span v-if="analysis.tz_filename && analysis.kp_filename"
							class="flex items-center gap-1 min-w-0">
							<UIcon name="i-lucide-files" class="w-3.5 h-3.5 shrink-0" />
							<span class="truncate">{{ analysis.tz_filename }} · {{ analysis.kp_filename }}</span>
						</span>
					</div>
				</div>

				<UButton v-if="isDraft" size="lg" leading-icon="i-lucide-scan-search" :loading="tzAnalyzing"
					:disabled="!tzFile || !kpFile" @click="runTzAnalysis">
					Анализировать
				</UButton>
			</div>

			<template v-if="isDraft">
				<UAlert color="info" variant="soft" icon="i-lucide-info" class="mb-6"
					description="Загрузите техническое задание и коммерческое предложение, затем запустите анализ." />

				<UCard class="shadow-sm">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<UFormField label="Техническое задание" required>
							<UFileUpload :model-value="tzFile" :accept="fileAccept" :interactive="true"
								:description="uploadDescription" layout="list" class="w-full min-h-32"
								position="inside" @update:model-value="onTzFileChange">
								<template #actions="{ open }">
									<UButton type="button" variant="outline" size="sm" @click="open()">
										<UIcon name="i-lucide-file-text" class="w-4 h-4" />
										Выбрать ТЗ
									</UButton>
								</template>
							</UFileUpload>
						</UFormField>

						<UFormField label="Коммерческое предложение" required>
							<UFileUpload :model-value="kpFile" :accept="fileAccept" :interactive="true"
								:description="uploadDescription" layout="list" class="w-full min-h-32"
								position="inside" @update:model-value="onKpFileChange">
								<template #actions="{ open }">
									<UButton type="button" variant="outline" size="sm" @click="open()">
										<UIcon name="i-lucide-file-spreadsheet" class="w-4 h-4" />
										Выбрать КП
									</UButton>
								</template>
							</UFileUpload>
						</UFormField>
					</div>

					<UProgress v-if="tzAnalyzing" animation="carousel" size="sm" class="mt-5" />
				</UCard>
			</template>

			<template v-else-if="analysis.status === TZAnalysisRunStatus.PROCESSING">
				<UCard class="shadow-sm">
					<div class="flex flex-col items-center justify-center py-20 gap-4 text-muted">
						<UIcon name="i-lucide-loader" class="w-10 h-10 animate-spin text-warning" />
						<p class="text-sm font-medium text-center">Анализ ТЗ выполняется</p>
						<p class="text-xs text-center max-w-md">Результаты появятся автоматически</p>
						<UProgress animation="carousel" size="sm" class="w-full max-w-md" />
					</div>
				</UCard>
			</template>

			<template v-else-if="analysis.status === TZAnalysisRunStatus.FAILED">
				<UAlert color="error" variant="soft" icon="i-lucide-circle-alert"
					description="Не удалось выполнить анализ. Создайте новый анализ и попробуйте снова." />
			</template>

			<template v-else-if="hasResults">
				<div class="flex flex-wrap items-center gap-2 mb-4">
					<UBadge color="primary" variant="subtle" size="lg">
						{{ analysis.match_score }}% соответствия
					</UBadge>
					<UBadge color="success" variant="subtle">{{ analysis.met_count }} ок</UBadge>
					<UBadge color="warning" variant="subtle">{{ analysis.partial_count }} частично</UBadge>
					<UBadge color="error" variant="subtle">{{ analysis.missing_count }} нет</UBadge>
					<UBadge color="neutral" variant="subtle">{{ analysis.not_found_count }} не найдено</UBadge>
				</div>

				<div class="space-y-6">
					<UCard class="shadow-sm w-full">
						<template #header>
							<div class="flex items-center justify-between gap-2 w-full flex-wrap">
								<p class="font-semibold text-sm">Соответствия и несоответствия</p>
								<UFormField label="Фильтр" class="mb-0">
									<USelect v-model="tzStatusFilter" :items="tzFilterOptions" size="sm"
										class="min-w-40" />
								</UFormField>
							</div>
						</template>

						<div class="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
							<UCard v-for="(item, idx) in filteredTzItems" :key="idx" variant="subtle"
								:ui="{ body: 'p-3 sm:p-3' }">
								<div class="space-y-1.5">
									<div class="flex items-start gap-2">
										<UCheckbox v-if="isTzSelectable(item.status)"
											:model-value="tzSelectedIndices.includes(item._index)"
											@update:model-value="(v) => toggleTzSelect(item._index, v === true)" />
										<UIcon :name="matchStatusIcon(item.status)"
											class="w-4 h-4 shrink-0 mt-0.5"
											:class="matchStatusClass(item.status)" />
										<p class="text-sm font-medium flex-1">{{ item.requirement }}</p>
									</div>
									<p v-if="item.requirement_ref" class="text-xs text-muted pl-6">
										{{ item.requirement_ref }}
									</p>
									<p v-if="item.offer_value" class="text-sm pl-6">
										<span class="text-muted">КП:</span> {{ item.offer_value }}
									</p>
									<p v-if="item.offer_ref" class="text-xs text-muted pl-6">{{ item.offer_ref }}
									</p>
									<p class="text-sm text-default/80 pl-6">{{ item.explanation }}</p>
								</div>
							</UCard>
						</div>

						<template #footer>
							<div class="flex flex-wrap gap-2">
								<UButton size="sm" variant="outline" leading-icon="i-lucide-download"
									@click="exportTzCsv">
									Экспорт CSV
								</UButton>
								<UButton size="sm" leading-icon="i-lucide-file-text"
									:disabled="tzSelectedIndices.length === 0" @click="showDocxModal = true">
									Скачать письмо ({{ tzSelectedIndices.length }})
								</UButton>
							</div>
						</template>
					</UCard>

					<UCard v-if="showLetterPreview" class="shadow-sm w-full">
						<template #header>
							<div class="space-y-1">
								<p class="font-semibold text-sm">Предпросмотр письма</p>
								<p class="text-xs text-muted">
									Документ для отправки поставщику при несоответствиях
								</p>
							</div>
						</template>

						<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
							<UFormField label="Организация" required>
								<UInput v-model="docxOrganization" placeholder="Наименование организации"
									size="md" />
							</UFormField>
							<UFormField label="Срок ответа">
								<UInput v-model="docxDeadline" placeholder="7 июня 2026 г." size="md" />
							</UFormField>
						</div>

						<div v-if="previewLoading" class="flex justify-center py-8">
							<UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin text-muted" />
						</div>

						<div v-else-if="letterPreview"
							class="rounded-lg border border-default bg-elevated/40 p-4 max-h-[50vh] overflow-y-auto">
							<p v-for="(paragraph, idx) in letterPreview.paragraphs" :key="idx"
								class="text-sm whitespace-pre-wrap mb-2 last:mb-0"
								:class="paragraph === letterPreview.title ? 'font-semibold text-center' : ''">
								{{ paragraph || '\u00A0' }}
							</p>
						</div>

						<p v-else-if="!docxOrganization.trim()" class="text-xs text-muted">
							Укажите организацию для предпросмотра письма
						</p>
					</UCard>
				</div>
			</template>
		</template>

		<UModal v-model:open="showDocxModal" title="Письмо поставщику"
			description="Уточнения по выбранным пунктам анализа">
			<template #body>
				<div class="space-y-4">
					<UFormField label="Организация" required>
						<UInput v-model="docxOrganization" placeholder="Наименование организации" size="lg" />
					</UFormField>
					<UFormField label="Срок ответа">
						<UInput v-model="docxDeadline" placeholder="7 июня 2026 г." size="lg" />
					</UFormField>
					<UButton class="w-full" size="lg" :loading="docxGenerating" leading-icon="i-lucide-download"
						@click="generateDocx">
						Скачать DOCX
					</UButton>
				</div>
			</template>
		</UModal>
	</UContainer>
</template>

<script lang="ts" setup>
import type {
	TZAnalysisItem,
	TZAnalysisPreviewResponse,
	TZAnalysisSession,
	TZAnalysisStatus,
} from '#shared/types'
import {
	getTzRunStatusColor,
	getTzRunStatusLabel,
	TZAnalysisRunStatus,
} from '#shared/types'
import { useRunStatusPolling } from '~/composables/useRunStatusPolling'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => route.params.id as string)

const { get, post } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()
const { formatDate } = useFormatDate()
const { public: publicConfig } = useRuntimeConfig()

const MAX_UPLOAD_SIZE = publicConfig.maxUploadSize as number
const fileAccept = '.pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp'

const uploadDescription = computed(() => {
	const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)
	return `PDF, DOCX, XLSX, TXT, изображения. До ${sizeMb} МБ`
})

const loading = ref(true)
const analysis = ref<TZAnalysisSession | null>(null)
const tzFile = ref<File | null>(null)
const kpFile = ref<File | null>(null)
const tzAnalyzing = ref(false)
const tzPolling = ref(false)
const tzSelectedIndices = ref<number[]>([])
const tzStatusFilter = ref('all')
const showDocxModal = ref(false)
const docxOrganization = ref('')
const docxDeadline = ref('')
const docxGenerating = ref(false)
const letterPreview = ref<TZAnalysisPreviewResponse | null>(null)
const previewLoading = ref(false)

const tzFilterOptions = [
	{ label: 'Все', value: 'all' },
	{ label: 'Соответствует', value: 'met' },
	{ label: 'Частично', value: 'partial' },
	{ label: 'Не соответствует', value: 'missing' },
	{ label: 'Не найдено', value: 'not_found' },
]

type TZItemView = TZAnalysisItem & { _index: number }

const isDraft = computed(() => analysis.value?.status === TZAnalysisRunStatus.DRAFT)
const hasResults = computed(() =>
	analysis.value?.status === TZAnalysisRunStatus.ACTIVE
	|| analysis.value?.status === TZAnalysisRunStatus.COMPLETED,
)
const statusColor = computed(() =>
	getTzRunStatusColor(analysis.value?.status ?? TZAnalysisRunStatus.DRAFT),
)
const statusLabel = computed(() =>
	getTzRunStatusLabel(analysis.value?.status ?? TZAnalysisRunStatus.DRAFT),
)

const filteredTzItems = computed((): TZItemView[] => {
	if (!analysis.value) return []
	return analysis.value.items
		.map((item, index) => ({ ...item, _index: index }))
		.filter((item) =>
			tzStatusFilter.value === 'all' || item.status === tzStatusFilter.value,
		)
})

const hasIssueItems = computed(() => {
	if (!analysis.value) return false
	return analysis.value.items.some((item) =>
		item.status === 'partial' || item.status === 'missing' || item.status === 'not_found',
	)
})

const showLetterPreview = computed(() =>
	hasResults.value
	&& hasIssueItems.value
	&& analysis.value?.status === TZAnalysisRunStatus.ACTIVE,
)

function applyAnalysis(data: TZAnalysisSession) {
	analysis.value = data
	if (data.status === TZAnalysisRunStatus.PROCESSING) {
		tzPolling.value = true
	}
	if (
		data.status === TZAnalysisRunStatus.ACTIVE
		&& tzSelectedIndices.value.length === 0
	) {
		tzSelectedIndices.value = data.items
			.map((item, index) => ({ item, index }))
			.filter(({ item }) =>
				item.status === 'partial' || item.status === 'missing' || item.status === 'not_found',
			)
			.map(({ index }) => index)
	}
}

async function fetchAnalysis() {
	loading.value = true
	try {
		const data = await get<TZAnalysisSession>(`/tz-analysis/${id.value}`)
		applyAnalysis(data)
	} catch {
		if (import.meta.client) {
			toast.add({ title: 'Анализ не найден', color: 'error' })
			await navigateTo('/tz-analysis/history')
		}
	} finally {
		loading.value = false
	}
}

useRunStatusPolling(
	tzPolling,
	async () => get<TZAnalysisSession>(`/tz-analysis/${id.value}`),
	(data: TZAnalysisSession) => { applyAnalysis(data) },
	() => {
		toast.add({
			title: 'Анализ ТЗ завершён',
			color: 'success',
			icon: 'i-lucide-check',
		})
	},
	() => {
		toast.add({
			title: 'Ошибка анализа ТЗ',
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	},
)

let previewDebounce: ReturnType<typeof setTimeout> | null = null

async function fetchLetterPreview() {
	if (!showLetterPreview.value || !analysis.value?.id) {
		letterPreview.value = null
		return
	}
	if (!docxOrganization.value.trim() || tzSelectedIndices.value.length === 0) {
		letterPreview.value = null
		return
	}

	previewLoading.value = true
	try {
		letterPreview.value = await post<TZAnalysisPreviewResponse>(
			`/tz-analysis/${analysis.value.id}/preview`,
			{
				selected_indices: tzSelectedIndices.value,
				organization: docxOrganization.value.trim(),
				deadline_date: docxDeadline.value.trim() || null,
			},
		)
	} catch {
		letterPreview.value = null
	} finally {
		previewLoading.value = false
	}
}

watch(
	[showLetterPreview, docxOrganization, docxDeadline, tzSelectedIndices],
	() => {
		if (previewDebounce) clearTimeout(previewDebounce)
		previewDebounce = setTimeout(() => { fetchLetterPreview() }, 300)
	},
	{ deep: true },
)

onMounted(() => {
	fetchAnalysis()
})

function validateAndSetFile(
	file: File | null | undefined,
	target: Ref<File | null>,
) {
	if (!file) {
		target.value = null
		return
	}
	if (file.size > MAX_UPLOAD_SIZE) {
		const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)
		toast.add({
			title: 'Файл слишком большой',
			description: `${file.name} превышает ${sizeMb} МБ`,
			color: 'error',
		})
		target.value = null
		return
	}
	target.value = file
}

function onTzFileChange(file: File | null | undefined) {
	validateAndSetFile(file, tzFile)
}

function onKpFileChange(file: File | null | undefined) {
	validateAndSetFile(file, kpFile)
}

async function runTzAnalysis() {
	if (!tzFile.value || !kpFile.value || !analysis.value?.id) return
	tzAnalyzing.value = true
	try {
		const fd = new FormData()
		fd.append('tz_file', tzFile.value)
		fd.append('kp_file', kpFile.value)
		const result = await post<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/run`,
			fd,
		)
		tzSelectedIndices.value = []
		applyAnalysis(result)
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Ошибка запуска анализа',
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	} finally {
		tzAnalyzing.value = false
	}
}

function matchStatusIcon(status: TZAnalysisStatus) {
	if (status === 'met') return 'i-lucide-circle-check'
	if (status === 'partial') return 'i-lucide-circle-alert'
	if (status === 'missing') return 'i-lucide-circle-x'
	return 'i-lucide-circle-help'
}

function matchStatusClass(status: TZAnalysisStatus) {
	if (status === 'met') return 'text-success'
	if (status === 'partial') return 'text-warning'
	if (status === 'missing') return 'text-error'
	return 'text-muted'
}

function isTzSelectable(status: TZAnalysisStatus) {
	return status === 'partial' || status === 'missing' || status === 'not_found'
}

function toggleTzSelect(index: number, checked: boolean) {
	if (checked) {
		if (!tzSelectedIndices.value.includes(index)) {
			tzSelectedIndices.value = [...tzSelectedIndices.value, index]
		}
	} else {
		tzSelectedIndices.value = tzSelectedIndices.value.filter((i) => i !== index)
	}
}

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

async function exportTzCsv() {
	if (!analysis.value?.id) return
	await downloadBlob(
		`/tz-analysis/${analysis.value.id}/export.csv`,
		`tz_analysis_${analysis.value.id}.csv`,
	)
}

async function generateDocx() {
	if (!analysis.value?.id || !docxOrganization.value.trim()) return
	docxGenerating.value = true
	try {
		const res = await $axios.post(
			`/tz-analysis/${analysis.value.id}/docx`,
			{
				selected_indices: tzSelectedIndices.value,
				organization: docxOrganization.value.trim(),
				deadline_date: docxDeadline.value.trim() || null,
			},
			{ responseType: 'blob' },
		)
		const blob = res.data as Blob
		const objectUrl = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = objectUrl
		a.download = `clarification_${analysis.value.id}.docx`
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(objectUrl)
		showDocxModal.value = false
		toast.add({ title: 'DOCX сформирован', color: 'success', icon: 'i-lucide-check' })
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Ошибка генерации DOCX',
			color: 'error',
		})
	} finally {
		docxGenerating.value = false
	}
}
</script>
