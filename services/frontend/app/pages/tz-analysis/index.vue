<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">
			<div class="mb-12">
				<div class="text-center mb-6">
					<h1 class="text-3xl font-bold text-highlighted mb-2">Анализ технических предложений</h1>
					<p class="text-muted text-sm">
						Сравните техническое задание с коммерческим предложением поставщика
					</p>
				</div>

				<div class="flex justify-end mb-4">
					<UButton to="/tz-analysis/history" size="lg" variant="outline" color="neutral"
						leading-icon="i-lucide-history">
						История анализов
					</UButton>
				</div>

				<UCard class="shadow-sm mb-4">
					<UForm :schema="schema" :state="form" @submit="handleCreate" class="space-y-5">
						<UFormField label="Название" name="title" required>
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
			</div>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TZAnalysisSession } from '#shared/types'
import { z } from 'zod'

definePageMeta({ layout: 'default' })

const { post } = useApi()

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
