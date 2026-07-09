<template>
	<UButton
		type="button"
		color="neutral"
		variant="outline"
		size="sm"
		leading-icon="i-lucide-id-card"
		:loading="loading"
		@click="handleInsert"
	>
		Вставить реквизиты
	</UButton>
</template>

<script lang="ts" setup>
const body = defineModel<string>({ required: true })

const emit = defineEmits<{ inserted: [] }>()

const { ensureLoaded, insertIntoBody } = useBusinessInfo()
const loading = ref(false)

async function handleInsert() {
	loading.value = true
	try {
		await ensureLoaded()
		insertIntoBody(body)
		emit('inserted')
	} finally {
		loading.value = false
	}
}
</script>
