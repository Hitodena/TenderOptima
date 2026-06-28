<template>
	<UPopover
		mode="click"
		:content="{ side: 'bottom', align: 'start', sideOffset: 8 }"
		class="inline-flex shrink-0"
	>
		<button
			type="button"
			class="inline-flex size-6 items-center justify-center rounded-full bg-elevated text-muted transition-colors hover:bg-accented hover:text-default"
			aria-label="Фрагмент оригинального ТЗ"
			@click.stop
		>
			<UIcon name="i-lucide-info" class="size-3.5" />
		</button>

		<template #content>
			<div class="max-w-md p-4 space-y-3 text-sm">
				<p class="text-muted leading-relaxed">
					Для качественного анализа система может вносить более детальную нумерацию, чем в ТЗ.
				</p>
				<div class="space-y-1.5">
					<p class="font-medium text-default leading-snug">
						Данный пункт соотносится к следующему блоку оригинального ТЗ:
					</p>
					<p
						class="text-muted whitespace-pre-wrap leading-relaxed rounded-md bg-elevated/60 px-3 py-2"
					>
						{{ text }}
					</p>
				</div>
			</div>
		</template>
	</UPopover>
</template>

<script lang="ts" setup>
defineProps<{
	text: string
}>()
</script>
