<template>
	<div class="flex flex-wrap items-center gap-1">
		<UButton
			type="button"
			variant="ghost"
			color="neutral"
			size="xs"
			leading-icon="i-lucide-plus"
			@click="emit('add-child')"
		>
			Подпункт
		</UButton>
		<UButton
			type="button"
			variant="ghost"
			color="neutral"
			size="xs"
			leading-icon="i-lucide-heading"
			@click="emit('add-heading')"
		>
			Заголовок
		</UButton>
		<UButton
			v-if="showRemove"
			type="button"
			variant="ghost"
			color="neutral"
			size="xs"
			icon="i-lucide-x"
			@click="emit('remove')"
		/>
	</div>
</template>

<script lang="ts" setup>
withDefaults(
	defineProps<{
		showRemove?: boolean
	}>(),
	{ showRemove: true },
)

const emit = defineEmits<{
	'add-child': []
	'add-heading': []
	remove: []
}>()
</script>
