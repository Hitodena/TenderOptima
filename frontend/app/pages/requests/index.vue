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

			<div>
				<div class="flex items-center justify-between mb-5">
					<div>
						<h2 class="text-xl font-semibold">История запросов</h2>
						<p class="text-sm text-muted mt-0.5">Все ваши поисковые запросы</p>
					</div>
					<UInput v-model="search" placeholder="Поиск..." icon="i-lucide-search" class="w-56" size="sm" />
				</div>

				<div v-if="loadingHistory" class="space-y-3">
					<USkeleton v-for="i in 5" :key="i" class="h-18 w-full rounded-xl" />
				</div>

				<template v-else-if="filteredHistory.length">
					<div class="space-y-2">
						<UCard v-for="req in visibleHistory" :key="req.id"
							class="group cursor-pointer hover:shadow-md transition-all hover:-translate-y-px"
							@click="navigateTo(`/requests/${req.id}`)">
							<div class="flex items-center gap-4">
								<div
									class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
									<UIcon name="i-lucide-package-search" class="w-5 h-5 text-primary" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-0.5">
										<p class="font-semibold truncate">{{ req.query }}</p>
										<UBadge :color="getRequestStatusColor(req.status)" variant="subtle" size="sm"
											class="shrink-0">
											{{ getRequestStatusLabel(req.status) }}
										</UBadge>
									</div>
									<p class="text-xs text-muted flex items-center gap-2">
										<span class="flex items-center gap-1">
											<UIcon name="i-lucide-map-pin" class="w-3 h-3" />
											{{ req.delivery_region }}
										</span>
										<span>·</span>
										<span class="flex items-center gap-1">
											<UIcon name="i-lucide-calendar" class="w-3 h-3" />
											{{ formatDate(req.created_at) }}
										</span>
									</p>
								</div>
								<div class="flex items-center gap-1 shrink-0">
									<UButton color="error" variant="ghost" size="xs"
										:icon="confirmDeleteId === req.id ? 'i-lucide-check' : 'i-lucide-trash-2'"
										:loading="deletingId === req.id" class="opacity-0 group-hover:opacity-100"
										:class="confirmDeleteId === req.id ? 'opacity-100 text-error' : ''"
										@click.stop="handleDeleteClick(req.id)" />
									<UIcon v-if="confirmDeleteId !== req.id" name="i-lucide-chevron-right"
										class="w-4 h-4 text-muted" />
									<UButton v-if="confirmDeleteId === req.id" color="neutral" variant="ghost" size="xs"
										icon="i-lucide-x" @click.stop="confirmDeleteId = null" />
								</div>
							</div>
						</UCard>
					</div>

					<div ref="sentinel" class="h-4 mt-2" />

					<div v-if="loadingMore" class="flex justify-center py-4">
						<UIcon name="i-lucide-loader" class="w-5 h-5 text-muted animate-spin" />
					</div>

					<p v-if="!hasMore && visibleHistory.length > PAGE_SIZE" class="text-center text-xs text-muted py-4">
						Все запросы загружены
					</p>
				</template>

				<div v-else class="text-center py-16">
					<UIcon name="i-lucide-inbox" class="w-12 h-12 mx-auto mb-3 text-muted opacity-40" />
					<p class="text-muted">{{ search ? 'Ничего не найдено' : 'Запросов пока нет' }}</p>
					<p v-if="!search" class="text-xs text-muted mt-1">Создайте первый запрос выше</p>
				</div>
			</div>

		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { RequestResponse } from '#shared/types'
import { getRequestStatusColor, getRequestStatusLabel } from '#shared/types'
import { z } from 'zod'

const { post, get, del } = useApi()

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

const PAGE_SIZE = 10

const allHistory = ref<RequestResponse[]>([])
const loadingHistory = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const search = ref('')
const confirmDeleteId = ref<string | null>(null)
const deletingId = ref<string | null>(null)

const filteredHistory = computed(() => {
	const q = search.value.toLowerCase()
	if (!q) return allHistory.value
	return allHistory.value.filter(r =>
		r.query.toLowerCase().includes(q) ||
		(r.delivery_region?.toLowerCase().includes(q) ?? false)
	)
})

const visibleHistory = computed(() =>
	filteredHistory.value.slice(0, page.value * PAGE_SIZE)
)

const hasMore = computed(() =>
	visibleHistory.value.length < filteredHistory.value.length
)

async function fetchHistory() {
	loadingHistory.value = true
	try {
		const all = await get<RequestResponse[]>('/requests/')
		allHistory.value = [...all].sort((a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		)
	} catch {
		allHistory.value = []
	} finally {
		loadingHistory.value = false
	}
}

await fetchHistory()

watch(search, () => { page.value = 1 })

onMounted(() => {
	document.addEventListener('click', () => { confirmDeleteId.value = null })
})

async function handleDeleteClick(id: string) {
	if (confirmDeleteId.value !== id) {
		confirmDeleteId.value = id
		return
	}
	deletingId.value = id
	confirmDeleteId.value = null
	try {
		await del(`/requests/${id}`)
		allHistory.value = allHistory.value.filter(r => r.id !== id)
	} catch { }
	finally {
		deletingId.value = null
	}
}

const sentinel = ref<HTMLElement | null>(null)

onMounted(() => {
	const observer = new IntersectionObserver(entries => {
		const entry = entries[0]
		if (entry?.isIntersecting && hasMore.value && !loadingMore.value) {
			loadingMore.value = true
			setTimeout(() => {
				page.value++
				loadingMore.value = false
			}, 300)
		}
	}, { threshold: 0.1 })

	if (sentinel.value) observer.observe(sentinel.value)
	onUnmounted(() => observer.disconnect())
})

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric',
	})
}
</script>
