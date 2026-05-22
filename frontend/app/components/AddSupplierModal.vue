<template>
	<UModal v-model:open="isOpen" title="Добавить поставщика" :ui="{ content: 'max-w-md' }">
		<template #body>
			<UForm :schema="schema" :state="form" @submit="handleAdd" class="space-y-4">

				<UFormField label="Домен" name="domain" required hint="example.com">
					<UInput v-model="form.domain" placeholder="supplier.ru" icon="i-lucide-globe" class="w-full" />
				</UFormField>

				<UFormField label="Название компании" name="company_name" required>
					<UInput v-model="form.company_name" placeholder="ООО ПромПоставка" icon="i-lucide-building-2"
						class="w-full" />
				</UFormField>

				<UFormField label="Email" name="email" required>
					<UInput v-model="form.email" type="email" placeholder="sales@supplier.ru" icon="i-lucide-mail"
						class="w-full" />
				</UFormField>

				<UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />

				<div class="flex justify-end gap-2 pt-2">
					<UButton color="neutral" variant="ghost" @click="close">Отмена</UButton>
					<UButton type="submit" :loading="loading" leading-icon="i-lucide-plus">Добавить</UButton>
				</div>
			</UForm>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import { z } from 'zod'

const props = defineProps<{ requestId: string }>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [] }>()

const { post } = useApi()

const schema = z.object({
	domain: z.string().min(3, 'Минимум 3 символа').max(255),
	company_name: z.string().min(1, 'Обязательное поле').max(200),
	email: z.string().email('Неверный формат email'),
})

const form = reactive({ domain: '', company_name: '', email: '' })
const loading = ref(false)
const error = ref<string | null>(null)

function close() {
	isOpen.value = false
	form.domain = ''
	form.company_name = ''
	form.email = ''
	error.value = null
}

async function handleAdd() {
	if (loading.value) return
	loading.value = true
	error.value = null
	try {
		await post('/suppliers/', {
			domain: form.domain.trim(),
			company_name: form.company_name.trim(),
			email: form.email.trim(),
			source: 'manual',
			request_id: props.requestId,
		})
		emit('added')
		close()
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		error.value = typeof detail === 'string' ? detail : 'Ошибка при добавлении поставщика'
	} finally {
		loading.value = false
	}
}
</script>
