<template>
	<UModal v-model:open="isOpen" title="Новый запрос" description="Заполните параметры поиска поставщиков"
		:ui="{ content: 'max-w-2xl' }">
		<template #body>
			<UForm :schema="schema" :state="form" @submit="handleSubmit" class="space-y-5">

				<UFormField label="Запрос" name="query" required hint="Что ищем? Например: промышленные насосы">
					<UInput v-model="form.query" placeholder="Промышленные насосы" icon="i-lucide-search" size="lg"
						class="w-full" />
				</UFormField>

				<p class="text-xs font-medium text-muted uppercase tracking-wider pt-1">Детали поставки</p>

				<div class="grid grid-cols-2 gap-4">
					<UFormField label="Регион доставки" name="delivery_region">
						<UInput v-model="form.delivery_region" placeholder="Минск" icon="i-lucide-map-pin"
							class="w-full" />
					</UFormField>

					<UFormField label="Срок поставки (до)" name="delivery_deadline">
						<UInput v-model="form.delivery_deadline" type="datetime-local" class="w-full" />
					</UFormField>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<UFormField label="Количество" name="quantity">
						<UInputNumber v-model="form.quantity" placeholder="100" icon="i-lucide-hash" :min="0"
							:increment="false" :decrement="false" class="w-full" :format-options="{
								minimumFractionDigits: 0,
								maximumFractionDigits: 2
							}" :step="0.01" />
					</UFormField>

					<UFormField label="Единица" name="unit">
						<UInput v-model="form.unit" placeholder="шт" class="w-full" />
					</UFormField>

					<UFormField label="Валюта" name="currency">
						<UInput v-model="form.currency" placeholder="BYN" class="w-full" />
					</UFormField>
				</div>

				<UFormField label="Макс. цена за единицу" name="max_price_per_unit">
					<UInputNumber v-model="form.max_price_per_unit" placeholder="1000" :min="0" :increment="false"
						icon="i-lucide-circle-dollar-sign" :decrement="false" class="w-full" :format-options="{
							minimumFractionDigits: 0,
							maximumFractionDigits: 2
						}" :step="0.01" />
				</UFormField>

				<p class="text-xs font-medium text-muted uppercase tracking-wider pt-1">Требования</p>

				<UFormField label="Требования к качеству" name="quality_requirements">
					<UInput v-model="form.quality_requirements" placeholder="ISO 9001, ГОСТ..."
						icon="i-lucide-shield-check" class="w-full" />
				</UFormField>

				<UFormField label="Описание" name="description">
					<UTextarea v-model="form.description" placeholder="Подробное описание требований..." :rows="3"
						class="w-full" />
				</UFormField>

				<UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />

				<div class="flex justify-end gap-2 pt-2">
					<UButton color="neutral" variant="ghost" @click="close">Отмена</UButton>
					<UButton type="submit" :loading="loading" icon="i-lucide-plus">Создать запрос</UButton>
				</div>

			</UForm>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import type { RequestCreate, RequestResponse } from '#shared/types'
import { z } from 'zod'

const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [request: RequestResponse] }>()

const { post } = useApi()

const schema = z.object({
	query: z.string().min(3, 'Минимум 3 символа').max(500),
	delivery_region: z.string().max(100).optional(),
	description: z.string().max(2000).optional(),
	quantity: z.number().gt(0, "Количество не может быть меньше или равно 0").optional(),
	unit: z.string().max(50).optional(),
	quality_requirements: z.string().max(1000).optional(),
	delivery_deadline: z.string().optional(),
	max_price_per_unit: z.number().gt(0, "Цена не может быть меньше или равна 0").optional(),
	currency: z.string().min(2).max(20).optional(),
})

const form = reactive({
	query: '',
	delivery_region: '',
	description: '',
	quantity: undefined,
	unit: '',
	quality_requirements: '',
	delivery_deadline: '',
	max_price_per_unit: undefined,
	currency: 'BYN',
})

const loading = ref(false)
const error = ref('')

function close() {
	isOpen.value = false
	resetForm()
}

function resetForm() {
	form.query = ''
	form.delivery_region = ''
	form.description = ''
	form.quantity = undefined
	form.unit = ''
	form.quality_requirements = ''
	form.delivery_deadline = ''
	form.max_price_per_unit = undefined
	form.currency = 'BYN'
	error.value = ''
}

async function handleSubmit() {
	if (loading.value) return
	loading.value = true
	error.value = ''
	try {
		const payload: RequestCreate = {
			query: form.query,
			delivery_region: form.delivery_region || null,
			description: form.description || null,
			quantity: form.quantity
				? Number(String(form.quantity).replace(',', '.'))
				: null,
			unit: form.unit || null,
			quality_requirements: form.quality_requirements || null,
			delivery_deadline: form.delivery_deadline || null,
			max_price_per_unit: form.max_price_per_unit
				? Number(String(form.max_price_per_unit).replace(',', '.'))
				: null,
			currency: form.currency || 'BYN',
		}
		const created = await post<RequestResponse>('/requests/', payload)
		emit('created', created)
		close()
	} catch (e: any) {
		const detail = e.response?.data?.detail
		if (Array.isArray(detail)) {
			error.value = detail.map((d: any) => d.msg).join(', ')
		} else {
			error.value = typeof detail === 'string' ? detail : 'Ошибка создания запроса'
		}
	} finally {
		loading.value = false
	}
}
</script>
