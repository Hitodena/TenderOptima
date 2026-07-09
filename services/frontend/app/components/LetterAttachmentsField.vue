<template>
	<div
		ref="rootEl"
		class="min-w-0 max-w-full overflow-hidden rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 sm:p-4 space-y-3"
	>
		<div class="flex items-start gap-3 min-w-0">
			<div
				class="rounded-lg bg-primary/10 text-primary p-2 shrink-0"
				aria-hidden="true"
			>
				<UIcon name="i-lucide-paperclip" class="w-4 h-4" />
			</div>
			<div class="min-w-0 flex-1 space-y-1">
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-sm font-semibold text-highlighted">
						{{ t('inbox.letterAttachmentsTitle') }}
					</p>
					<UBadge
						v-if="files.length"
						color="primary"
						variant="subtle"
						size="sm"
					>
						{{
							t('inbox.letterAttachmentsCount').replace(
								'{count}',
								String(files.length),
							)
						}}
					</UBadge>
				</div>
				<p class="text-xs text-muted wrap-break-word">
					{{ t('inbox.letterAttachmentsHint') }}
				</p>
			</div>
		</div>

		<input
			ref="fileInput"
			type="file"
			class="hidden"
			multiple
			accept=".pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
			@change="onNativeFilesSelected"
		>

		<div class="min-w-0 max-w-full overflow-hidden">
			<UFileUpload
				:model-value="files"
				multiple
				accept=".pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
				:interactive="false"
				highlight
				color="primary"
				variant="area"
				layout="list"
				position="outside"
				icon="i-lucide-upload"
				:label="t('inbox.letterAttachmentsDropLabel')"
				:description="t('inbox.letterAttachmentsDropDescription')"
				class="w-full min-w-0 max-w-full"
				:ui="{
					root: 'min-w-0 max-w-full',
					base: 'min-w-0 max-w-full overflow-hidden',
					wrapper: 'min-w-0 max-w-full',
					files: 'min-w-0 max-w-full overflow-hidden',
					file: 'min-w-0 max-w-full overflow-hidden',
					fileWrapper: 'min-w-0 overflow-hidden',
					fileName: 'truncate min-w-0',
				}"
				@update:model-value="onFilesUpdate"
			>
				<template #actions="{ open }">
					<UButton
						type="button"
						variant="soft"
						color="primary"
						size="sm"
						leading-icon="i-lucide-paperclip"
						@click="open()"
					>
						{{ t('inbox.letterAttachmentsAdd') }}
					</UButton>
				</template>
			</UFileUpload>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { t } from '~/constants/translations'

const files = defineModel<File[]>({ default: () => [] })

const rootEl = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function onFilesUpdate(newFiles: File[] | null | undefined) {
	files.value = newFiles ?? []
}

function onNativeFilesSelected(event: Event) {
	const input = event.target as HTMLInputElement
	const selected = Array.from(input.files ?? [])
	if (selected.length) {
		files.value = [...files.value, ...selected]
	}
	input.value = ''
}

function open() {
	rootEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
	fileInput.value?.click()
}

defineExpose({ open })
</script>
