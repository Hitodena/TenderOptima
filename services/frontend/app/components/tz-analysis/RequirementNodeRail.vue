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

const props = withDefaults(
	defineProps<{
		showRemove?: boolean
	}>(),
	{ showRemove: true },
)

const emit = defineEmits<{
	'add-child': []
	'add-sibling': []
	remove: []
}>()

const menuItems = computed((): DropdownMenuItem[][] => {
	const items: DropdownMenuItem[] = [
		{
			label: 'Подпункт',
			icon: 'i-lucide-list-plus',
			onSelect: () => emit('add-child'),
		},
		{
			label: 'Добавить пункт',
			icon: 'i-lucide-plus',
			onSelect: () => emit('add-sibling'),
		},
	]
	if (props.showRemove) {
		items.push({
			label: 'Удалить',
			icon: 'i-lucide-trash-2',
			color: 'error',
			onSelect: () => emit('remove'),
		})
	}
	return [items]
})
</script>
