<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">

			<div class="mb-12">
				<div class="text-center mb-6">
					<h1 class="text-3xl font-bold text-highlighted mb-2">Поиск поставщиков</h1>
					<p class="text-muted text-sm">Найдите подходящих поставщиков. Поиск может занять до нескольких
						минут.</p>
				</div>

				<div class="flex justify-end mb-4">
					<UButton
to="/requests/history" size="lg" variant="outline" color="neutral"
						leading-icon="i-lucide-history">
						История запросов
					</UButton>
				</div>

				<UCard class="shadow-sm mb-4">
					<UForm :schema="schema" :state="form" class="space-y-5" @submit="handleSearch">
						<UAlert
							v-if="module1BlockReason"
							color="warning"
							variant="soft"
							icon="i-lucide-triangle-alert"
							class="mb-1"
						>
							<template #description>
								<div class="space-y-2">
									<p>{{ module1BlockReason }}</p>
									<NuxtLink
										:to="subscriptionPlansPath()"
										class="text-sm font-medium text-primary hover:underline underline-offset-2"
									>
										{{ t('subscription.upgradeCta') }}
									</NuxtLink>
								</div>
							</template>
						</UAlert>

						<UFormField label="Что ищете?" name="query" required>
							<UInput
v-model="form.query" placeholder="Промышленные насосы, картонные коробки..."
								icon="i-lucide-search" size="lg" class="w-full" :disabled="!canStartSearch">
								<template #trailing>
									<SearchQueryRulesHint />
								</template>
							</UInput>
						</UFormField>

						<UFormField label="Регион поиска" name="delivery_region" required>
							<UInput
								v-model="form.delivery_region" icon="i-lucide-map-pin"
								size="lg" class="w-full" :disabled="!canStartSearch" />
						</UFormField>

						<UButton
type="submit" block size="lg" leading-icon="i-lucide-search"
							:disabled="loading || !canStartSearch">
							Найти поставщиков
						</UButton>

						<SubscriptionErrorAlert
v-if="searchError" :error="searchError"
							fallback="Не удалось запустить поиск. Попробуйте ещё раз." />
					</UForm>
				</UCard>
			</div>

		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { RequestResponse } from '#shared/types'
import { z } from 'zod'
import { titleCaseWords } from '#shared/utils/textFormat'
import {
	canStartModule1Work,
	module1WorkBlockMessage,
} from '#shared/utils/subscriptionAccess'
import { subscriptionPlansPath } from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'
import SearchQueryRulesHint from '~/components/requests/SearchQueryRulesHint.vue'

const { post } = useApi()
const { user, loaded, ensureLoaded } = useCurrentUser()

const schema = z.object({
	query: z.string().min(3, 'Минимум 3 символа').max(500, 'Максимум 500 символов'),
	delivery_region: z.string().min(2, 'Укажите регион').max(100),
})

const form = reactive({
	query: '',
	delivery_region: t('requests.defaultDeliveryRegion'),
})
const loading = ref(false)
const searchError = ref<unknown | null>(null)

onMounted(() => ensureLoaded())

const canStartSearch = computed(() =>
	canStartModule1Work(user.value?.subscription),
)

const module1BlockReason = computed(() =>
	loaded.value ? module1WorkBlockMessage(user.value?.subscription) : null,
)

async function handleSearch() {
	if (loading.value || !canStartSearch.value) return
	searchError.value = null
	loading.value = true
	try {
		const created = await post<RequestResponse>('/requests/', {
			query: form.query.trim(),
			delivery_region: titleCaseWords(form.delivery_region),
		})
		await post(`/requests/${created.id}/search`)
		await navigateTo(`/requests/${created.id}`)
	} catch (e: unknown) {
		searchError.value = e
	} finally {
		loading.value = false
	}
}
</script>
