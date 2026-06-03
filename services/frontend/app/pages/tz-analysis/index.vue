<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">
			<div class="mb-12">
				<div class="text-center mb-8">
					<h1 class="text-3xl font-bold text-highlighted mb-2">Анализ ТЗ</h1>
					<p class="text-muted text-sm">
						Сравните техническое задание с коммерческим предложением поставщика
					</p>
				</div>

				<UCard class="shadow-sm mb-4">
					<UForm :schema="schema" :state="form" @submit="handleCreate" class="space-y-5">
						<UFormField label="Название анализа" name="title" required hint="Минимум 3 символа">
							<UInput v-model="form.title" placeholder="Сравнение КП ООО «Поставщик» с ТЗ №12..."
								icon="i-lucide-file-search" size="lg" class="w-full" />
						</UFormField>

						<UButton type="submit" block size="lg" leading-icon="i-lucide-plus" :loading="loading">
							Создать анализ
						</UButton>

						<UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert"
							:description="error" />
					</UForm>
				</UCard>

				<p class="text-xs text-muted text-center">
					Сначала создаётся черновик. Затем загрузите файлы ТЗ и КП на странице анализа.
				</p>
			</div>

			<div class="text-center">
				<UButton to="/tz-analysis/history" size="lg" variant="outline" color="neutral"
					leading-icon="i-lucide-history">
					История анализов
				</UButton>
				<p class="text-xs text-muted mt-2">Черновики, активные и завершённые</p>
			</div>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TZAnalysisSession } from '#shared/types'
import { z } from 'zod'

definePageMeta({ layout: 'default' })

const { post } = useApi()
const toast = useToast()

const schema = z.object({
	title: z.string().min(3, 'Минимум 3 символа').max(500, 'Максимум 500 символов'),
})

const form = reactive({ title: '' })
const loading = ref(false)
const error = ref<string | null>(null)

async function handleCreate() {
	if (loading.value) return
	error.value = null
	loading.value = true
	try {
		const created = await post<TZAnalysisSession>('/tz-analysis/', {
			title: form.title.trim(),
		})
		toast.add({
			title: 'Черновик создан',
			description: 'Загрузите файлы ТЗ и КП для запуска анализа.',
			color: 'success',
			icon: 'i-lucide-check',
		})
		await navigateTo(`/tz-analysis/${created.id}`)
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		error.value = typeof detail === 'string' && detail.trim()
			? detail
			: 'Не удалось создать анализ. Попробуйте ещё раз.'
	} finally {
		loading.value = false
	}
}
</script>
