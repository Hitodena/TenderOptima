<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">

			<div class="mb-12">
				<div class="text-center mb-8">
					<h1 class="text-3xl font-bold text-highlighted mb-2">Поиск поставщиков</h1>
					<p class="text-muted text-sm">Найдите подходящих поставщиков. Поиск занимает 10–30 секунд.</p>
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

						<div v-if="loading" class="flex flex-col items-center gap-3 py-4">
							<div class="relative">
								<div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
									<UIcon name="i-lucide-search" class="w-5 h-5 text-primary animate-pulse" />
								</div>
								<div class="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
							</div>
							<div class="text-center">
								<p class="text-sm font-medium">{{ searchStep }}</p>
								<p class="text-xs text-muted mt-0.5">Это займёт 10–30 секунд</p>
							</div>
						</div>

						<UButton v-else type="submit" block size="lg" leading-icon="i-lucide-search">
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
const searchStep = ref('Создаём запрос...')

async function handleSearch() {
	if (loading.value) return
	error.value = null
	loading.value = true
	try {
		searchStep.value = 'Создаём запрос...'
		const created = await post<RequestResponse>('/requests/', {
			query: form.query.trim(),
			delivery_region: form.delivery_region.trim(),
		})
		searchStep.value = 'Ищем поставщиков...'
		await post(`/requests/${created.id}/search`)
		await navigateTo(`/requests/${created.id}`)
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		error.value = typeof detail === 'string' && detail.trim()
			? detail
			: 'Не удалось запустить поиск. Попробуйте ещё раз.'
	} finally {
		loading.value = false
		searchStep.value = 'Создаём запрос...'
	}
}
</script>
