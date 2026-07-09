<template>
	<div class="w-full select-none pt-1">
		<div class="border-t border-default w-full" aria-hidden="true" />

		<div class="flex justify-center pt-2 pb-1">
			<UDropdownMenu :items="menuItems" :ui="{ content: 'min-w-40' }">
				<button
					type="button"
					class="inline-flex size-6 items-center justify-center rounded text-muted hover:text-default hover:bg-elevated/60 transition-colors"
					aria-label="Добавить"
					@click.stop
				>
					<UIcon name="i-lucide-plus" class="size-4" />
				</button>
			</UDropdownMenu>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'

const emit = defineEmits<{
	'add-child': []
	'add-heading': []
	'add-sibling': []
}>()

const menuItems = computed((): DropdownMenuItem[][] => [
	[
		{
			label: 'Раздел',
			icon: 'i-lucide-folder-plus',
			onSelect: () => emit('add-sibling'),
		},
		{
			label: 'Подпункт',
			icon: 'i-lucide-list-plus',
			onSelect: () => emit('add-child'),
		},
	],
])
</script>
