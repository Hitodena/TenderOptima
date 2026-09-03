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

						<div class="flex items-center justify-between gap-3">
							<div class="flex items-center gap-2 min-w-0">
								<USwitch
									v-model="dynamicSearch"
									label="Динамический поиск"
									:disabled="!canStartSearch"
								/>
								<UTooltip
									:text="dynamicSearchHint"
									:content="{ side: 'bottom', align: 'start', sideOffset: 8 }"
								>
									<button
										type="button"
										class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-elevated text-muted transition-colors hover:bg-accented hover:text-default cursor-pointer"
										aria-label="О динамическом поиске"
										@click.stop
									>
										<UIcon name="i-lucide-info" class="size-4" />
									</button>
								</UTooltip>
							</div>
						</div>

						<template v-if="!dynamicSearch">
							<UFormField label="Что ищете?" name="query" required>
								<UInput
									v-model="form.query"
									placeholder="Промышленные насосы, картонные коробки..."
									icon="i-lucide-search"
									size="lg"
									class="w-full"
									:disabled="!canStartSearch"
								>
									<template #trailing>
										<SearchQueryRulesHint />
									</template>
								</UInput>
							</UFormField>
						</template>

						<template v-else>
							<div class="space-y-3">
								<div class="flex items-center justify-between gap-2">
									<p class="text-sm font-medium text-default">
										Позиции закупки
									</p>
									<SearchQueryRulesHint />
								</div>
								<p class="text-xs text-muted">
									Укажите не менее двух позиций. Каждая позиция ищется отдельно, затем результаты объединяются.
								</p>
								<div
									v-for="(_, idx) in form.items"
									:key="idx"
									class="flex items-start gap-2"
								>
									<UFormField
										:label="`Позиция ${idx + 1}`"
										:name="`items.${idx}`"
										required
										class="flex-1 min-w-0"
									>
										<UInput
											v-model="form.items[idx]"
											:placeholder="itemPlaceholder(idx)"
											icon="i-lucide-search"
											size="lg"
											class="w-full"
											:disabled="!canStartSearch"
										/>
									</UFormField>
									<UButton
										type="button"
										variant="ghost"
										color="neutral"
										icon="i-lucide-trash-2"
										size="lg"
										class="mt-6 shrink-0"
										:disabled="!canStartSearch || form.items.length <= MIN_ITEMS"
										:aria-label="`Удалить позицию ${idx + 1}`"
										@click="removeItem(idx)"
									/>
								</div>
								<UButton
									type="button"
									variant="outline"
									color="neutral"
									leading-icon="i-lucide-plus"
									size="sm"
									:disabled="!canStartSearch || form.items.length >= MAX_ITEMS"
									@click="addItem"
								>
									Добавить позицию
								</UButton>
							</div>
						</template>

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
import type { RequestCreate, RequestResponse } from '#shared/types'
import { z } from 'zod'
import { titleCaseWords } from '#shared/utils/textFormat'
import {
	canStartModule1Work,
	module1WorkBlockMessage,
} from '#shared/utils/subscriptionAccess'
import { subscriptionPlansPath } from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'
import SearchQueryRulesHint from '~/components/requests/SearchQueryRulesHint.vue'

const MIN_ITEMS = 2
const MAX_ITEMS = 8
const ITEM_MIN_LEN = 3
const ITEM_MAX_LEN = 500

const { post } = useApi()
const { user, loaded, ensureLoaded } = useCurrentUser()

const dynamicSearch = ref(false)
const dynamicSearchHint
	= 'Если нужно найти поставщиков сразу по нескольким позициям закупки, а не по одной — включите динамический поиск. Каждая позиция вводится отдельно.'

const itemSchema = z
	.string()
	.trim()
	.min(ITEM_MIN_LEN, `Минимум ${ITEM_MIN_LEN} символа`)
	.max(ITEM_MAX_LEN, `Максимум ${ITEM_MAX_LEN} символов`)

const schema = computed(() => {
	if (dynamicSearch.value) {
		return z.object({
			items: z
				.array(z.string())
				.transform((items) => items.map((item) => item.trim()).filter(Boolean))
				.pipe(
					z
						.array(itemSchema)
						.min(MIN_ITEMS, `Укажите не менее ${MIN_ITEMS} позиций`)
						.max(MAX_ITEMS, `Не более ${MAX_ITEMS} позиций`),
				),
			delivery_region: z.string().min(2, 'Укажите регион').max(100),
		})
	}
	return z.object({
		query: z.string().min(3, 'Минимум 3 символа').max(500, 'Максимум 500 символов'),
		delivery_region: z.string().min(2, 'Укажите регион').max(100),
	})
})

const form = reactive({
	query: '',
	items: ['', ''] as string[],
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

function itemPlaceholder(idx: number): string {
	const samples = ['Картонные коробки', 'Флаконы']
	return samples[idx] ?? `Позиция ${idx + 1}`
}

function addItem() {
	if (form.items.length >= MAX_ITEMS) return
	form.items.push('')
}

function removeItem(idx: number) {
	if (form.items.length <= MIN_ITEMS) return
	form.items.splice(idx, 1)
}

watch(dynamicSearch, (enabled) => {
	if (enabled && form.items.length < MIN_ITEMS) {
		form.items = ['', '']
	}
})

async function handleSearch() {
	if (loading.value || !canStartSearch.value) return
	searchError.value = null
	loading.value = true
	try {
		const payload: RequestCreate = dynamicSearch.value
			? {
					items: form.items.map((item) => item.trim()).filter(Boolean),
					delivery_region: titleCaseWords(form.delivery_region),
				}
			: {
					query: form.query.trim(),
					delivery_region: titleCaseWords(form.delivery_region),
				}
		const created = await post<RequestResponse>('/requests/', payload)
		await post(`/requests/${created.id}/search`)
		await navigateTo(`/requests/${created.id}`)
	} catch (e: unknown) {
		searchError.value = e
	} finally {
		loading.value = false
	}
}
</script>
