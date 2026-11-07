<template>
	<UModal
		v-model:open="isOpen"
		:title="attachment?.filename || 'Файл'"
		:ui="{ content: 'max-w-5xl w-[calc(100vw-2rem)]', body: 'p-0 sm:p-0' }"
	>
		<template #body>
			<div class="h-[75vh] min-h-80 bg-elevated flex items-center justify-center">
				<div v-if="loading" class="flex items-center gap-2 text-sm text-muted">
					<UIcon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
					Загружаем файл…
				</div>
				<div v-else-if="error" class="flex flex-col items-center gap-3 text-sm text-muted px-6 text-center">
					<UIcon name="i-lucide-file-x" class="w-8 h-8 opacity-50" />
					{{ error }}
				</div>
				<iframe
					v-else-if="objectUrl && isPdf"
					:src="objectUrl"
					class="w-full h-full border-0 bg-white"
					:title="attachment?.filename || 'PDF'"
				/>
				<img
					v-else-if="objectUrl"
					:src="objectUrl"
					:alt="attachment?.filename || ''"
					class="max-w-full max-h-full object-contain"
				>
			</div>
		</template>
		<template #footer>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="text-xs text-muted truncate">
					<template v-if="attachment?.doc_label && attachment.doc_type !== 'other'">{{ attachment.doc_label }}<template v-if="attachment.version"> · версия {{ attachment.version }}</template> · </template>
					{{ attachment?.size ? formatBytes(attachment.size) : '' }}
				</span>
				<div class="flex gap-2">
					<UButton color="neutral" variant="ghost" @click="() => { isOpen = false }">Закрыть</UButton>
					<UButton
						v-if="attachment"
						leading-icon="i-lucide-download"
						@click="attachment && emit('download', attachment)"
					>
						Скачать
					</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import type { ThreadAttachment } from '#shared/types'
import { fileKind } from '#shared/utils/emailThread'

const props = defineProps<{
	attachment: ThreadAttachment | null
}>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ download: [att: ThreadAttachment] }>()

const { $axios } = useNuxtApp()
const loading = ref(false)
const error = ref<string | null>(null)
const objectUrl = ref<string | null>(null)

const isPdf = computed(() =>
	props.attachment ? fileKind(props.attachment.filename, props.attachment.content_type).tone === 'pdf' : false,
)

function revoke() {
	if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
	objectUrl.value = null
}

async function load() {
	revoke()
	error.value = null
	const att = props.attachment
	if (!att?.path) {
		error.value = 'Файл не сохранился на сервере'
		return
	}
	loading.value = true
	try {
		const res = await $axios.get(
			`/requests/attachments/serve?attachment_path=${encodeURIComponent(att.path)}`,
			{ responseType: 'blob' },
		)
		const blob = res.data as Blob
		// the browser shows a PDF only when the blob says it is one
		const type = isPdf.value ? 'application/pdf' : (blob.type || att.content_type || '')
		objectUrl.value = URL.createObjectURL(new Blob([blob], { type }))
	} catch {
		error.value = 'Не удалось открыть файл. Попробуйте скачать его.'
	} finally {
		loading.value = false
	}
}

watch([isOpen, () => props.attachment?.path], ([open]) => {
	if (open) void load()
	else revoke()
})

onBeforeUnmount(revoke)

function formatBytes(b: number) {
	if (b < 1024) return `${b} Б`
	if (b < 1048576) return `${(b / 1024).toFixed(1)} КБ`
	return `${(b / 1048576).toFixed(1)} МБ`
}
</script>
