<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">

			<div class="mb-12">
				<div class="text-center mb-8">
					<h1 class="text-3xl font-bold text-highlighted mb-2">Поиск поставщиков</h1>
					<p class="text-muted text-sm">Найдите подходящих поставщиков. Поиск может занять до нескольких минут.</p>
				</div>

				<UCard class="shadow-sm mb-4">
					<UForm :schema="schema" :state="form" @submit="handleSearch" class="space-y-5">
						<UFormField label="Что ищете?" name="query" required hint="Минимум 3 символа">
							<UInput v-model="form.query" placeholder="Промышленные насосы, картонные коробки..."
								icon="i-lucide-search" size="lg" class="w-full" />
						</UFormField>

						<UFormField label="Регион доставки" name="delivery_region" required>
							<UInput v-model="form.delivery_region" placeholder="Минск" icon="i-lucide-map-pin" size="lg"
								class="w-full" />
						</UFormField>

						<UButton type="submit" block size="lg" leading-icon="i-lucide-search" :disabled="loading">
							Найти поставщиков
						</UButton>

						<UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert"
							:description="error" />
					</UForm>
				</UCard>

				<p class="text-xs text-muted text-center">
					Результаты сохранятся в истории. Вы сможете выбрать каким поставщикам отправить запрос.
				</p>
			</div>

			<div class="text-center">
				<UButton to="/requests/history" size="lg" variant="outline" color="neutral" leading-icon="i-lucide-history">
					Открыть полную историю запросов
				</UButton>
				<p class="text-xs text-muted mt-2">Все запросы, статусы и ответы поставщиков</p>
			</div>

		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { RequestResponse } from '#shared/types'
import { z } from 'zod'

const { post } = useApi()

const schema = z.object({
	query: z.string().min(3, 'Минимум 3 символа').max(500, 'Максимум 500 символов'),
	delivery_region: z.string().min(2, 'Укажите регион').max(100),
})

const form = reactive({ query: '', delivery_region: '' })
const loading = ref(false)
const error = ref<string | null>(null)
const toast = useToast()

async function handleSearch() {
	if (loading.value) return
	error.value = null
	loading.value = true
	try {
		const created = await post<RequestResponse>('/requests/', {
			query: form.query.trim(),
			delivery_region: form.delivery_region.trim(),
		})
		await post(`/requests/${created.id}/search`)
		toast.add({
			title: 'Поиск в процессе',
			description: 'Запущен поиск поставщиков. Результаты появятся в запросе через некоторое время.',
			color: 'warning',
			icon: 'i-lucide-search',
		})
		await navigateTo(`/requests/${created.id}`)
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		error.value = typeof detail === 'string' && detail.trim()
			? detail
			: 'Не удалось запустить поиск. Попробуйте ещё раз.'
	} finally {
		loading.value = false
	}
}
</script>
