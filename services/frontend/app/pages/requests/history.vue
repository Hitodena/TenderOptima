<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-3xl font-bold text-highlighted">История запросов</h1>
					<p class="text-muted text-sm mt-1">Все ваши поисковые запросы и статусы</p>
				</div>
				<div class="flex items-center gap-3">
					<UInput v-model="search" placeholder="Поиск в истории..." icon="i-lucide-search" class="w-56" size="lg" />
					<UButton to="/requests" variant="outline" color="neutral" leading-icon="i-lucide-search" size="lg">
						Новый поиск
					</UButton>
				</div>
			</div>

			<UTabs v-model="activeTab" :items="tabs" :content="false" :ui="{ list: 'mb-4' }" />

			<div v-if="loadingHistory" class="space-y-3">
				<USkeleton v-for="i in 8" :key="i" class="h-18 w-full rounded-xl" />
			</div>

			<template v-else-if="filteredHistory.length">
				<div class="space-y-2">
					<UCard
v-for="req in visibleHistory" :key="req.id"
						class="group cursor-pointer hover:shadow-md transition-all hover:-translate-y-px"
						@click="openRequest(req)">
						<div class="flex items-center gap-4">
							<div
								class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 relative">
								<UIcon name="i-lucide-package-search" class="w-5 h-5 text-primary" />
								<span
v-if="hasUnreadMessages(req)"
									class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-default" />
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-0.5">
									<p class="font-semibold truncate">{{ req.query }}</p>
									<UBadge
:color="getRequestStatusColor(req.status)" variant="subtle" size="sm"
										class="shrink-0">
										{{ getRequestStatusLabel(req.status) }}
									</UBadge>
								</div>
								<p class="text-xs text-muted flex items-center gap-2 flex-wrap">
									<span class="flex items-center gap-1">
										<UIcon name="i-lucide-map-pin" class="w-3 h-3" />
										{{ req.delivery_region }}
									</span>
									<span>·</span>
									<span class="flex items-center gap-1">
										<UIcon name="i-lucide-calendar" class="w-3 h-3" />
										{{ formatDate(req.created_at) }}
									</span>
									<template v-if="showMessageStats(req)">
										<span>·</span>
										<span class="flex items-center gap-1 text-success">
											<UIcon name="i-lucide-inbox" class="w-3 h-3" />
											Входящие: {{ req.supplier_messages_incoming ?? 0 }} / Всего:
											{{ req.supplier_messages_total ?? 0 }}
										</span>
									</template>
								</p>
							</div>
							<div class="flex items-center gap-1 shrink-0">
								<template v-if="req.status !== RequestStatus.CLOSED">
									<UButton
:color="confirmCloseId === req.id ? 'warning' : 'neutral'" variant="ghost" size="md"
										:leading-icon="confirmCloseId === req.id ? 'i-lucide-check' : 'i-lucide-lock'"
										:label="confirmCloseId === req.id ? 'Подтвердить' : 'Завершить'"
										:loading="closingId === req.id" class="opacity-0 group-hover:opacity-100"
										:class="confirmCloseId === req.id ? 'opacity-100' : ''"
										@click.stop="handleCloseClick(req.id)" />
									<UIcon
v-if="confirmCloseId !== req.id" name="i-lucide-chevron-right"
										class="w-4 h-4 text-muted" />
									<UButton
v-if="confirmCloseId === req.id" color="neutral" variant="ghost" size="xs"
										icon="i-lucide-x" @click.stop="confirmCloseId = null" />
								</template>
								<UIcon v-else name="i-lucide-chevron-right" class="w-4 h-4 text-muted" />
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
				<p class="text-muted">{{ emptyMessage }}</p>
				<p v-if="!search" class="text-xs text-muted mt-1">
					<UButton to="/requests" variant="outline" size="sm" class="mt-2">Создать первый запрос</UButton>
				</p>
			</div>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { RequestResponse } from '#shared/types'
import { getRequestStatusColor, getRequestStatusLabel, RequestStatus } from '#shared/types'

const { post, get } = useApi()
const { formatDate } = useFormatDate()

function showMessageStats(req: RequestResponse): boolean {
	return (
		req.status === RequestStatus.QUEUED
		|| req.status === RequestStatus.COMPLETED
		|| req.status === RequestStatus.CLOSED
		|| (req.supplier_messages_total ?? 0) > 0
	)
}

function hasUnreadMessages(req: RequestResponse): boolean {
	return (req.supplier_messages_unread ?? 0) > 0
}

function openRequest(req: RequestResponse) {
	const isTerminal =
		req.status === RequestStatus.COMPLETED || req.status === RequestStatus.CLOSED
	if (isTerminal) {
		navigateTo(`/requests/${req.id}/responses`)
		return
	}
	navigateTo(`/requests/${req.id}`)
}

const PAGE_SIZE = 10

const allHistory = ref<RequestResponse[]>([])
const loadingHistory = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const search = ref('')
const confirmCloseId = ref<string | null>(null)
const closingId = ref<string | null>(null)
type HistoryTab = 'active' | 'closed'

const activeTab = ref<HistoryTab>('active')
const tabs = [
	{ label: 'Активные', icon: 'i-lucide-activity', value: 'active' as const },
	{ label: 'Завершённые', icon: 'i-lucide-archive', value: 'closed' as const },
]

function matchesTab(status: RequestStatus, tab: HistoryTab): boolean {
	if (tab === 'closed') return status === RequestStatus.CLOSED
	return status !== RequestStatus.CLOSED
}

const filteredHistory = computed(() => {
	const q = search.value.trim().toLowerCase()
	const list = allHistory.value.filter((r) => matchesTab(r.status, activeTab.value))
	if (!q) return list
	return list.filter((r) => {
		const haystack = [
			r.query,
			r.delivery_region,
			getRequestStatusLabel(r.status),
		].filter(Boolean).join(' ').toLowerCase()
		return haystack.includes(q)
	})
})

const visibleHistory = computed(() =>
	filteredHistory.value.slice(0, page.value * PAGE_SIZE)
)

const hasMore = computed(() =>
	visibleHistory.value.length < filteredHistory.value.length
)

const emptyMessage = computed(() => {
	if (search.value.trim()) return 'Ничего не найдено'
	if (activeTab.value === 'closed') {
		return 'Завершённых запросов пока нет'
	}
	return 'Активных запросов пока нет'
})

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

onMounted(() => {
	fetchHistory()
})

watch(search, () => { page.value = 1 })
watch(activeTab, () => { page.value = 1; confirmCloseId.value = null })

onMounted(() => {
	const dismissConfirm = () => { confirmCloseId.value = null }
	document.addEventListener('click', dismissConfirm)
	onUnmounted(() => document.removeEventListener('click', dismissConfirm))
})

async function handleCloseClick(id: string) {
	if (confirmCloseId.value !== id) {
		confirmCloseId.value = id
		return
	}
	closingId.value = id
	confirmCloseId.value = null
	try {
		await post(`/requests/${id}/close`)
		allHistory.value = allHistory.value.map(r => r.id === id ? { ...r, status: 'closed' as const } : r)
	} catch {
		// ignore close error
	} finally {
		closingId.value = null
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

</script>
