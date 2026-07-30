<template>
	<UModal v-model:open="isOpen" :ui="{ content: 'max-w-lg' }">
		<template #header>
			<div class="flex items-center gap-2.5">
				<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
					<UIcon name="i-lucide-lightbulb" class="w-4 h-4 text-primary" />
				</div>
				<div>
					<p class="font-semibold text-highlighted">Идея или проблема</p>
					<p class="text-xs text-muted">
						Поделитесь идеей по улучшению сервиса или сообщите о проблеме в его работе
					</p>
				</div>
			</div>
		</template>

		<template #body>
			<div class="space-y-4">
				<UFormField label="Сообщение">
					<UTextarea
						v-model="message"
						:rows="5"
						class="w-full"
						placeholder="Опишите идею или проблему, с которой столкнулись..."
						:disabled="submitting"
					/>
				</UFormField>

				<UFormField
					:label="`Вложения (${files.length}/${maxFiles})`"
					:hint="`До ${maxFiles} файлов, до ${maxSizeMb} МБ каждый. Можно вставить из буфера (Ctrl+V)`"
				>
					<UFileUpload
						:model-value="files"
						:accept="fileAccept"
						:interactive="false"
						multiple
						layout="list"
						position="inside"
						class="w-full min-h-28"
						@update:model-value="onFilesChange"
					>
						<template #actions="{ open }">
							<UButton
								type="button"
								variant="outline"
								size="sm"
								:disabled="submitting"
								@click="open()"
							>
								<UIcon name="i-lucide-paperclip" class="w-4 h-4" />
								Выбрать файлы
							</UButton>
						</template>
					</UFileUpload>
				</UFormField>

				<UAlert
					v-if="error"
					color="error"
					variant="soft"
					icon="i-lucide-circle-alert"
					:description="error"
				/>

				<UAlert
					v-if="success"
					color="success"
					variant="soft"
					icon="i-lucide-check"
					description="Сообщение отправлено. Спасибо!"
				/>

				<div class="flex justify-end gap-2 pt-2">
					<UButton color="neutral" variant="outline" :disabled="submitting" @click="close">
						Отмена
					</UButton>
					<UButton
						:loading="submitting"
						:disabled="!message.trim()"
						leading-icon="i-lucide-send"
						@click="submit"
					>
						Отправить
					</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import { getApiErrorDetail } from '#shared/utils/apiError'

const isOpen = defineModel<boolean>('open', { default: false })

const { post } = useApi()
const toast = useToast()
const { public: publicConfig } = useRuntimeConfig()

const maxFiles = Number(publicConfig.maxIdeaUploadFiles) || 10
const maxSize = Number(publicConfig.maxIdeaUploadSize) || 5 * 1024 * 1024
const maxSizeMb = Math.round(maxSize / (1024 * 1024))
const fileAccept = '.pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp'
const acceptedExtensions = new Set(
	fileAccept.split(',').map((ext) => ext.trim().replace(/^\./, '').toLowerCase()),
)
const acceptedMimeByExt: Record<string, string> = {
	pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	txt: 'text/plain',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
}
const mimeToExtension: Record<string, string> = {
	'application/pdf': 'pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
	'application/vnd.ms-excel': 'xls',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
	'text/plain': 'txt',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
}

const message = ref('')
const files = ref<File[]>([])
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

function close() {
	isOpen.value = false
}

function fileExtension(file: File): string | null {
	const fromName = file.name.split('.').pop()?.toLowerCase()
	if (fromName && fromName !== file.name.toLowerCase()) return fromName
	return mimeToExtension[file.type] ?? null
}

function isAcceptedFile(file: File): boolean {
	const ext = fileExtension(file)
	if (ext && acceptedExtensions.has(ext)) return true
	return Boolean(file.type && mimeToExtension[file.type])
}

function normalizeClipboardFile(file: File, index: number): File {
	const ext = fileExtension(file)
	if (!ext) return file
	const hasKnownExt = acceptedExtensions.has(
		file.name.split('.').pop()?.toLowerCase() ?? '',
	)
	if (hasKnownExt && file.name.trim()) return file
	const mime = acceptedMimeByExt[ext] || file.type || 'application/octet-stream'
	return new File([file], `paste-${Date.now()}-${index + 1}.${ext}`, { type: mime })
}

function filesFromClipboard(data: DataTransfer | null): File[] {
	if (!data) return []
	const collected: File[] = []
	const seen = new Set<string>()

	const pushUnique = (file: File | null, index: number) => {
		if (!file || !isAcceptedFile(file)) return
		const normalized = normalizeClipboardFile(file, index)
		const key = `${normalized.name}:${normalized.size}:${normalized.type}:${normalized.lastModified}`
		if (seen.has(key)) return
		seen.add(key)
		collected.push(normalized)
	}

	if (data.items?.length) {
		Array.from(data.items).forEach((item, index) => {
			if (item.kind !== 'file') return
			pushUnique(item.getAsFile(), index)
		})
	}

	if (collected.length === 0 && data.files?.length) {
		Array.from(data.files).forEach((file, index) => {
			pushUnique(file, index)
		})
	}

	return collected
}

function onFilesChange(value: File | File[] | null | undefined) {
	const next = !value ? [] : Array.isArray(value) ? value : [value]
	if (next.length > maxFiles) {
		toast.add({
			title: `Можно прикрепить не более ${maxFiles} файлов`,
			color: 'warning',
		})
		files.value = next.slice(0, maxFiles)
		return
	}
	const oversized = next.filter((file) => file.size > maxSize)
	if (oversized.length > 0) {
		toast.add({
			title: `Файл превышает ${maxSizeMb} МБ`,
			description: oversized.map((f) => f.name).join(', '),
			color: 'warning',
		})
		files.value = next.filter((file) => file.size <= maxSize)
		return
	}
	files.value = next
}

function onPaste(event: ClipboardEvent) {
	if (!isOpen.value || submitting.value) return
	const pasted = filesFromClipboard(event.clipboardData)
	if (pasted.length === 0) return
	event.preventDefault()
	onFilesChange([...files.value, ...pasted])
	toast.add({
		title: pasted.length === 1
			? 'Файл добавлен из буфера'
			: `Добавлено файлов из буфера: ${pasted.length}`,
		color: 'success',
		icon: 'i-lucide-clipboard-paste',
	})
}

watch(isOpen, (val) => {
	if (import.meta.client) {
		if (val) {
			window.addEventListener('paste', onPaste)
		} else {
			window.removeEventListener('paste', onPaste)
		}
	}
	if (!val) {
		message.value = ''
		files.value = []
		error.value = null
		success.value = false
	}
})

onBeforeUnmount(() => {
	if (import.meta.client) {
		window.removeEventListener('paste', onPaste)
	}
})

async function submit() {
	if (!message.value.trim() || submitting.value) return
	submitting.value = true
	error.value = null
	success.value = false
	try {
		const formData = new FormData()
		formData.append('message', message.value.trim())
		for (const file of files.value) {
			formData.append('files', file)
		}
		await post('/feedback/ideas', formData)
		success.value = true
		message.value = ''
		files.value = []
		setTimeout(() => {
			isOpen.value = false
		}, 1500)
	} catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Не удалось отправить сообщение'
	} finally {
		submitting.value = false
	}
}
</script>
