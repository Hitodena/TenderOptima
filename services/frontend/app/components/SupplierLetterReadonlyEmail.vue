<template>
	<UFormField label="Email получателя">
		<div
			class="w-full rounded-md border border-default bg-elevated/60 px-3 py-2 text-sm text-muted break-all select-text"
		>
			{{ email }}
		</div>
	</UFormField>
</template>

<script lang="ts" setup>
defineProps<{
	email: string
}>()
</script>
