<template>
	<div ref="rootEl" class="min-w-0 max-w-full">
		<!-- phones: no drag-and-drop there — a button and the files as chips -->
		<div
			v-if="!hideMobileButton || files.length"
			class="flex flex-wrap items-center gap-2 min-w-0 md:hidden"
		>
			<UButton
				v-if="!hideMobileButton"
				type="button"
				variant="soft"
				color="primary"
				size="md"
				leading-icon="i-lucide-paperclip"
				class="rounded-full"
				@click="fileInput?.click()"
			>
				{{ t('inbox.letterAttachmentsAdd') }}
			</UButton>
			<div
				v-for="(file, idx) in files"
				:key="`${file.name}-${file.size}-${file.lastModified}`"
				class="flex h-9 max-w-full items-center gap-1.5 rounded-full bg-elevated pl-3 pr-1 text-sm"
			>
				<UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-primary" />
				<span class="min-w-0 truncate" :title="file.name">{{ file.name }}</span>
				<UButton
					size="sm"
					color="neutral"
					variant="ghost"
					icon="i-lucide-x"
					class="rounded-full"
					:aria-label="`${t('inbox.attachFileRemove')}: ${file.name}`"
					@click="removeFile(idx)"
				/>
			</div>
		</div>

		<div
			class="relative isolate min-w-0 max-w-full overflow-hidden rounded-2xl border-2 border-dashed border-primary/60 bg-primary/10 p-3 shadow-sm ring-1 ring-primary/15 sm:p-4 space-y-3 max-md:hidden"
		>
			<div class="flex items-start gap-3 min-w-0">
				<div
					class="rounded-xl bg-primary/15 text-primary p-2.5 shrink-0 ring-1 ring-primary/20"
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
						base: 'min-w-0 max-w-full overflow-hidden border-primary/40 bg-default shadow-xs',
						wrapper: 'min-w-0 max-w-full',
						files: 'min-w-0 max-w-full overflow-hidden',
						file: 'min-w-0 max-w-full overflow-hidden bg-default',
						fileWrapper: 'min-w-0 overflow-hidden',
						fileName: 'truncate min-w-0',
					}"
					@update:model-value="onFilesUpdate"
				>
					<template #actions="{ open: openDialog }">
						<UButton
							type="button"
							variant="soft"
							color="primary"
							size="sm"
							leading-icon="i-lucide-paperclip"
							@click="openDialog()"
						>
							{{ t('inbox.letterAttachmentsAdd') }}
						</UButton>
					</template>
				</UFileUpload>
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
	</div>
</template>

<script lang="ts" setup>
import { t } from '~/constants/translations'

withDefaults(defineProps<{
	/** the letter already has its own «attach» button next to the text */
	hideMobileButton?: boolean
}>(), {
	hideMobileButton: false,
})

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

function removeFile(idx: number) {
	files.value = files.value.filter((_, i) => i !== idx)
}

function openAttachments() {
	rootEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
	fileInput.value?.click()
}

defineExpose({ open: openAttachments })
</script>
