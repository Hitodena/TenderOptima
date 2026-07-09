<template>
	<component
		:is="compact ? 'aside' : 'section'"
		class="@container rounded-xl border border-default bg-elevated/20 w-full min-w-0"
		:class="[
			rail ? 'p-3.5 space-y-4' : compact ? 'p-2.5 space-y-2.5' : 'p-4 space-y-4',
			rail ? 'shadow-sm' : '',
		]"
	>
		<div class="flex items-center justify-between gap-2">
			<p class="text-sm font-semibold text-highlighted">Поставщики</p>
			<UButton
				v-if="!readonly"
				type="button"
				variant="outline"
				:size="compact ? 'xs' : 'sm'"
				leading-icon="i-lucide-plus"
				:disabled="adding"
				@click="showAddForm = true"
			>
				Добавить
			</UButton>
		</div>

		<div v-if="suppliers.length === 0" class="text-sm text-muted py-2">
			Добавьте поставщиков и загрузите их КП перед запуском анализа.
		</div>

		<div
			v-else
			class="gap-3"
			:class="compact
				? 'flex flex-col'
				: 'grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-3'"
		>
			<div
				v-for="supplier in suppliers"
				:key="supplier.id"
				class="rounded-lg border transition-colors min-w-0 w-full"
				:class="[
					supplierCardClass(supplier),
					rail ? 'p-3 space-y-2' : compact ? 'p-2 space-y-1.5' : 'p-3 space-y-2',
				]"
			>
				<div class="flex items-start justify-between gap-2">
					<button
						type="button"
						class="text-left min-w-0 flex-1"
						@click="emit('select', supplier.id)"
					>
						<p class="text-sm font-medium text-highlighted truncate">
							{{ supplier.name }}
						</p>
						<p class="text-xs text-muted mt-0.5">
							{{ supplier.kp_filenames.length }}
							{{ kpFileWord(supplier.kp_filenames.length) }}
						</p>
					</button>
					<div v-if="!readonly" class="flex items-center shrink-0 gap-0.5">
						<UButton
							v-if="canRunSupplierAnalysis(supplier)"
							type="button"
							variant="ghost"
							color="warning"
							size="xs"
							icon="i-lucide-play"
							title="Запустить анализ"
							:loading="runningId === supplier.id"
							:disabled="supplier.status === TZAnalysisSupplierStatus.PROCESSING"
							@click="runSupplierAnalysis(supplier.id)"
						/>
						<UButton
							type="button"
							variant="ghost"
							color="neutral"
							size="xs"
							icon="i-lucide-trash-2"
							:disabled="supplier.status === TZAnalysisSupplierStatus.PROCESSING"
							:loading="deletingId === supplier.id"
							@click="removeSupplier(supplier.id)"
						/>
					</div>
				</div>

				<UBadge
					:color="getTzSupplierStatusColor(supplier.status ?? TZAnalysisSupplierStatus.PENDING)"
					variant="subtle"
					size="sm"
					class="w-full justify-center py-1"
				>
					{{ getTzSupplierStatusLabel(supplier.status ?? TZAnalysisSupplierStatus.PENDING) }}
				</UBadge>

				<div
					v-if="supplier.kp_filenames.length && showKpFilesInCard(supplier)"
					class="space-y-1.5"
				>
					<button
						v-for="filename in supplier.kp_filenames"
						:key="`${supplier.id}-${filename}`"
						type="button"
						class="flex items-center gap-1.5 text-xs text-primary hover:underline truncate max-w-full text-left cursor-pointer"
						@click="emit('open-kp', { supplierId: supplier.id, filename })"
					>
						<UIcon name="i-lucide-file-spreadsheet" class="w-3.5 h-3.5 shrink-0" />
						<span class="truncate">{{ filename }}</span>
					</button>
				</div>
			</div>
		</div>

		<div
			v-if="$slots['after-suppliers'] || $slots.actions"
			class="space-y-4 border-t border-default/60 pt-4"
		>
			<div v-if="$slots['after-suppliers']" class="space-y-4">
				<slot name="after-suppliers" />
			</div>
			<div v-if="$slots.actions" class="pt-1">
				<slot name="actions" />
			</div>
		</div>

		<UModal
			v-model:open="showAddForm"
			title="Добавить поставщика"
			description="Укажите название поставщика и загрузите файлы КП."
		>
			<template #body>
				<div class="space-y-4">
					<UAlert
						v-if="showUploadLimitAlert"
						color="info"
						variant="soft"
						icon="i-lucide-credit-card"
						title="Лимит загрузки по подписке"
						:description="kpUploadHint"
					/>
					<UFormField label="Название поставщика" required>
						<UInput
							v-model="newSupplierName"
							placeholder="ООО «Поставщик»"
							size="md"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Файлы КП" required>
						<UFileUpload
							:model-value="[]"
							:accept="fileAccept"
							:interactive="false"
							:preview="false"
							multiple
							layout="list"
							position="inside"
							class="w-full min-h-24"
							@update:model-value="onNewSupplierFileChange"
						>
							<template #actions="{ open }">
								<UButton type="button" variant="outline" size="sm" @click="open()">
									<UIcon name="i-lucide-file-spreadsheet" class="w-4 h-4" />
									Выбрать файлы КП
								</UButton>
							</template>
						</UFileUpload>
						<ul
							v-if="newSupplierFiles.length"
							class="mt-3 space-y-1.5 rounded-lg border border-default/60 p-2"
						>
							<li
								v-for="(file, index) in newSupplierFiles"
								:key="`${file.name}-${file.size}-${file.lastModified}`"
								class="flex items-center gap-2 min-w-0"
							>
								<UIcon name="i-lucide-file-spreadsheet" class="w-4 h-4 shrink-0 text-muted" />
								<span class="text-sm text-default truncate flex-1 min-w-0">{{ file.name }}</span>
								<span class="text-xs text-muted shrink-0">{{ formatFileSize(file.size) }}</span>
								<UButton
									type="button"
									variant="ghost"
									color="neutral"
									size="xs"
									icon="i-lucide-x"
									:aria-label="`Удалить ${file.name}`"
									@click="removeNewSupplierFile(index)"
								/>
							</li>
						</ul>
						<p v-else class="mt-2 text-xs text-muted">
							Можно выбрать несколько файлов по одному или сразу несколько.
						</p>
					</UFormField>
				</div>
			</template>
			<template #footer>
				<div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
					<UButton variant="ghost" color="neutral" @click="resetAddForm">
						Отмена
					</UButton>
					<UButton :loading="adding" :disabled="!canAddSupplier" @click="createSupplier">
						Сохранить
					</UButton>
				</div>
			</template>
		</UModal>
	</component>
</template>

<script lang="ts" setup>
import type { TZAnalysisSupplierItem } from '#shared/types'
import {
	getTzSupplierStatusColor,
	getTzSupplierStatusLabel,
	TZAnalysisSupplierStatus,
} from '#shared/types'

import { formatUploadLimitMb } from '#shared/utils/subscriptionAccess'

const props = withDefaults(defineProps<{
	analysisId: string
	suppliers: TZAnalysisSupplierItem[]
	fileAccept: string
	maxUploadSize: number
	readonly?: boolean
	hideKpFiles?: boolean
	selectedSupplierId?: string | null
	compact?: boolean
	rail?: boolean
	showUploadLimitAlert?: boolean
}>(), {
	readonly: false,
	hideKpFiles: false,
	selectedSupplierId: null,
	compact: false,
	rail: false,
	showUploadLimitAlert: false,
})

const emit = defineEmits<{
	select: [supplierId: string]
	'open-kp': [payload: { supplierId: string; filename: string }]
	updated: [supplierId?: string]
}>()

const { post, del: delReq } = useApi()
const toast = useToast()

const showAddForm = ref(false)
const newSupplierName = ref('')
const newSupplierFiles = ref<File[]>([])
const adding = ref(false)
const deletingId = ref<string | null>(null)
const runningId = ref<string | null>(null)

const canAddSupplier = computed(() =>
	newSupplierName.value.trim().length > 0 && newSupplierFiles.value.length > 0,
)

const kpUploadHint = computed(() =>
	`По вашей подписке можно загружать коммерческие предложения размером до ${formatUploadLimitMb(props.maxUploadSize)} на каждый файл. Лимит зависит от тарифа.`,
)

function showKpFilesInCard(supplier: TZAnalysisSupplierItem) {
	if (props.hideKpFiles || props.rail) return false
	return supplier.status !== TZAnalysisSupplierStatus.PROCESSING
		&& supplier.kp_filenames.length > 0
}

function supplierCardClass(supplier: TZAnalysisSupplierItem) {
	if (supplier.status === TZAnalysisSupplierStatus.PROCESSING) {
		return 'border-warning/40 bg-warning/5'
	}
	if (props.selectedSupplierId === supplier.id) {
		return 'border-primary/40 bg-primary/5'
	}
	return 'border-default/60'
}

function kpFileWord(count: number) {
	if (count === 1) return 'файл КП'
	if (count >= 2 && count <= 4) return 'файла КП'
	return 'файлов КП'
}

function formatFileSize(bytes: number) {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	const size = bytes / Math.pow(k, i)
	const formattedSize = i === 0 ? size.toString() : size.toFixed(0)
	return `${formattedSize} ${sizes[i]}`
}

function isSameFile(a: File, b: File) {
	return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
}

function resetAddForm() {
	showAddForm.value = false
	newSupplierName.value = ''
	newSupplierFiles.value = []
}

function onNewSupplierFileChange(files: File | File[] | null | undefined) {
	if (!files) return
	const arr = Array.isArray(files) ? files : [files]
	const next = [...newSupplierFiles.value]
	for (const file of arr) {
		if (file.size > props.maxUploadSize) {
			toast.add({
				title: 'Файл слишком большой',
				description: `${file.name} превышает ${formatUploadLimitMb(props.maxUploadSize)}`,
				color: 'error',
			})
			continue
		}
		if (next.some((existing) => isSameFile(existing, file))) continue
		next.push(file)
	}
	newSupplierFiles.value = next
}

function removeNewSupplierFile(index: number) {
	newSupplierFiles.value = newSupplierFiles.value.filter((_, idx) => idx !== index)
}

function canRunSupplierAnalysis(supplier: TZAnalysisSupplierItem) {
	return (
		(supplier.status === TZAnalysisSupplierStatus.PENDING
			|| supplier.status === TZAnalysisSupplierStatus.FAILED)
		&& supplier.kp_filenames.length > 0
	)
}

async function createSupplier() {
	if (!canAddSupplier.value || adding.value || newSupplierFiles.value.length === 0) return
	adding.value = true
	try {
		const fd = new FormData()
		fd.append('name', newSupplierName.value.trim())
		for (const file of newSupplierFiles.value) {
			fd.append('kp_files', file)
		}
		const created = await post<TZAnalysisSupplierItem>(
			`/tz-analysis/${props.analysisId}/suppliers`,
			fd,
		)
		resetAddForm()
		emit('updated', created.id)
		toast.add({
			title: 'Поставщик добавлен',
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось добавить поставщика',
			color: 'error',
		})
	} finally {
		adding.value = false
	}
}

async function runSupplierAnalysis(supplierId: string) {
	if (runningId.value) return
	runningId.value = supplierId
	try {
		await post(
			`/tz-analysis/${props.analysisId}/suppliers/${supplierId}/run-kp`,
			new FormData(),
		)
		emit('updated')
		toast.add({
			title: 'Анализ запущен',
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось запустить анализ',
			color: 'error',
		})
	} finally {
		runningId.value = null
	}
}

async function removeSupplier(supplierId: string) {
	if (deletingId.value) return
	deletingId.value = supplierId
	try {
		await delReq(`/tz-analysis/${props.analysisId}/suppliers/${supplierId}`)
		emit('updated')
		toast.add({
			title: 'Поставщик удалён',
			color: 'success',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось удалить поставщика',
			color: 'error',
		})
	} finally {
		deletingId.value = null
	}
}
</script>
