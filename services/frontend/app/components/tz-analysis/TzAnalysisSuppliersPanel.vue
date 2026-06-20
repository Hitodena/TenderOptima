<template>
	<component
		:is="compact ? 'aside' : 'section'"
		class="@container rounded-xl border border-default bg-elevated/20 p-4 space-y-4 w-full min-w-0"
	>
		<div class="flex items-center justify-between gap-2">
			<p class="text-sm font-semibold text-highlighted">Поставщики</p>
			<UButton
				v-if="!readonly"
				type="button"
				variant="outline"
				size="sm"
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
				class="rounded-lg border p-3 space-y-2 transition-colors min-w-0 w-full"
				:class="supplierCardClass(supplier)"
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
					<UButton
						v-if="!readonly"
						type="button"
						variant="ghost"
						color="neutral"
						size="xs"
						icon="i-lucide-trash-2"
						class="shrink-0"
						:disabled="supplier.status === TZAnalysisSupplierStatus.PROCESSING"
						:loading="deletingId === supplier.id"
						@click="removeSupplier(supplier.id)"
					/>
				</div>

				<UBadge
					:color="getTzSupplierStatusColor(supplier.status ?? TZAnalysisSupplierStatus.PENDING)"
					variant="subtle"
					size="sm"
					class="w-full justify-center py-1"
				>
					{{ getTzSupplierStatusLabel(supplier.status ?? TZAnalysisSupplierStatus.PENDING) }}
				</UBadge>

				<div v-if="supplier.kp_filenames.length" class="space-y-1">
					<button
						v-for="filename in supplier.kp_filenames"
						:key="`${supplier.id}-${filename}`"
						type="button"
						class="block text-xs text-primary hover:underline truncate max-w-full text-left"
						@click="emit('open-kp', { supplierId: supplier.id, filename })"
					>
						{{ filename }}
					</button>
				</div>
			</div>
		</div>

		<UModal
			v-model:open="showAddForm"
			title="Добавить поставщика"
			description="Укажите название поставщика и загрузите файлы КП."
		>
			<template #body>
				<div class="space-y-4">
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
							:model-value="newSupplierFiles"
							:accept="fileAccept"
							:interactive="false"
							multiple
							layout="list"
							position="inside"
							class="w-full min-h-32"
							@update:model-value="onNewSupplierFilesChange"
						>
							<template #actions="{ open }">
								<UButton type="button" variant="outline" size="sm" @click="open()">
									<UIcon name="i-lucide-file-spreadsheet" class="w-4 h-4" />
									Выбрать КП
								</UButton>
							</template>
						</UFileUpload>
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

const props = withDefaults(defineProps<{
	analysisId: string
	suppliers: TZAnalysisSupplierItem[]
	fileAccept: string
	readonly?: boolean
	selectedSupplierId?: string | null
	compact?: boolean
}>(), {
	readonly: false,
	selectedSupplierId: null,
	compact: false,
})

const emit = defineEmits<{
	select: [supplierId: string]
	'open-kp': [payload: { supplierId: string; filename: string }]
	updated: []
}>()

const { post, del: delReq } = useApi()
const toast = useToast()
const { public: publicConfig } = useRuntimeConfig()
const MAX_UPLOAD_SIZE = publicConfig.maxTzUploadSize as number

const showAddForm = ref(false)
const newSupplierName = ref('')
const newSupplierFiles = ref<File[]>([])
const adding = ref(false)
const deletingId = ref<string | null>(null)

const canAddSupplier = computed(() =>
	newSupplierName.value.trim().length > 0 && newSupplierFiles.value.length > 0,
)

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

function resetAddForm() {
	showAddForm.value = false
	newSupplierName.value = ''
	newSupplierFiles.value = []
}

function onNewSupplierFilesChange(files: File | File[] | null | undefined) {
	if (!files) {
		newSupplierFiles.value = []
		return
	}
	const list = Array.isArray(files) ? files : [files]
	newSupplierFiles.value = list.filter((file) => {
		if (file.size <= MAX_UPLOAD_SIZE) return true
		toast.add({
			title: 'Файл слишком большой',
			description: `${file.name} превышает лимит`,
			color: 'error',
		})
		return false
	})
}

async function createSupplier() {
	if (!canAddSupplier.value || adding.value) return
	adding.value = true
	try {
		const fd = new FormData()
		fd.append('name', newSupplierName.value.trim())
		for (const file of newSupplierFiles.value) {
			fd.append('kp_files', file)
		}
		await post<TZAnalysisSupplierItem>(
			`/tz-analysis/${props.analysisId}/suppliers`,
			fd,
		)
		resetAddForm()
		emit('updated')
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
