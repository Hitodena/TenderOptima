<template>
	<div class="rounded-xl border border-default bg-elevated/30 p-4 sm:p-5">
		<p class="mb-1 text-sm font-semibold text-highlighted">
			{{ title }}
		</p>
		<p
			v-if="description"
			class="mb-4 text-sm leading-relaxed text-muted"
		>
			{{ description }}
		</p>
		<a
			:href="href"
			class="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-2 transition-opacity hover:opacity-80"
			:download="downloadName"
			target="_blank"
			rel="noopener noreferrer"
		>
			<UIcon
				name="i-lucide-file-down"
				class="size-4 shrink-0"
				aria-hidden="true"
			/>
			{{ linkLabel }}
		</a>
	</div>
</template>

<script lang="ts" setup>
withDefaults(
	defineProps<{
		title: string
		href: string
		description?: string
		linkLabel?: string
		downloadName?: string
	}>(),
	{
		description: undefined,
		linkLabel: 'Скачать документ (DOCX)',
		downloadName: undefined,
	},
)
</script>
