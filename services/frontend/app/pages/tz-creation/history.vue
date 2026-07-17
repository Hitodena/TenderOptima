<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-4xl mx-auto">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
				<div>
					<h1 class="text-3xl font-bold text-highlighted">История конструктора ТЗ</h1>
					<p class="text-muted text-sm mt-1">
						Сессии создания и дополнения технических заданий
					</p>
				</div>
				<div class="flex items-center gap-3 shrink-0">
					<UInput
						v-model="search"
						placeholder="Поиск по названию..."
						icon="i-lucide-search"
						class="w-full sm:w-56"
						size="lg"
					/>
					<UButton
						to="/tz-creation"
						variant="outline"
						color="neutral"
						leading-icon="i-lucide-sparkles"
						size="lg"
						class="shrink-0"
					>
						Новое ТЗ
					</UButton>
				</div>
			</div>

			<UTabs v-model="activeTab" :items="tabs" :content="false" :ui="{ list: 'mb-4' }" />

			<div v-if="loadingHistory" class="space-y-3">
				<USkeleton v-for="i in 8" :key="i" class="h-18 w-full rounded-xl" />
			</div>

			<template v-else-if="visibleHistory.length">
				<div class="space-y-2">
					<UCard
						v-for="item in visibleHistory"
						:key="item.id"
						class="group cursor-pointer hover:shadow-md transition-all hover:-translate-y-px"
						@click="openSession(item)"
					>
						<div class="flex items-center gap-4">
							<div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
								<UIcon
									:name="item.mode === 'from_scratch' ? 'i-lucide-sparkles' : 'i-lucide-upload'"
									class="w-5 h-5 text-primary"
								/>
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-0.5">
									<p class="font-semibold truncate">{{ item.title || 'Тендер на закупку' }}</p>
									<UBadge :color="getTzCreationStatusColor(item.status)" variant="subtle" size="sm" class="shrink-0">
										{{ getTzCreationStatusLabel(item.status) }}
									</UBadge>
								</div>
								<p class="text-xs text-muted flex items-center gap-2 flex-wrap">
									<span class="truncate">
										{{ item.mode === 'from_scratch' ? 'Создано с нуля' : 'Дополнение загруженного ТЗ' }}
									</span>
									<span class="flex items-center gap-1 shrink-0">
										<UIcon name="i-lucide-calendar" class="w-3 h-3" />
										{{ formatDate(item.created_at) }}
									</span>
								</p>
							</div>
							<UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-muted shrink-0" />
						</div>
					</UCard>
				</div>

				<div ref="sentinel" class="h-4 mt-2" />

				<div v-if="loadingMore" class="flex justify-center py-4">
					<UIcon name="i-lucide-loader" class="w-5 h-5 text-muted animate-spin" />
				</div>

				<p v-if="!hasMore && visibleHistory.length > 0" class="text-center text-xs text-muted py-4">
					Все записи загружены
				</p>
			</template>

			<div v-else class="text-center py-16">
				<UIcon name="i-lucide-inbox" class="w-12 h-12 mx-auto mb-3 text-muted opacity-40" />
				<p class="text-muted">{{ emptyMessage }}</p>
				<UButton v-if="!search.trim()" to="/tz-creation" variant="outline" size="sm" class="mt-3">
					Новое ТЗ
				</UButton>
			</div>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TZCreationSessionListItem } from '#shared/types'
import { getTzCreationStatusColor, getTzCreationStatusLabel } from '#shared/types'

definePageMeta({ layout: 'default', middleware: 'admin' })

const { get } = useApi()
const { formatDate } = useFormatDate()

const PAGE_SIZE = 10

const allSessions = ref<TZCreationSessionListItem[]>([])
const loadingHistory = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const search = ref('')
const activeTab = ref<'active' | 'completed'>('active')

const tabs = [
	{ label: 'Активные', icon: 'i-lucide-activity', value: 'active' as const },
	{ label: 'Завершено', icon: 'i-lucide-archive', value: 'completed' as const },
]

function matchesTab(item: TZCreationSessionListItem): boolean {
	return activeTab.value === 'completed'
		? item.status === 'completed'
		: item.status !== 'completed'
}

function sessionSearchText(item: TZCreationSessionListItem): string {
	return [item.title, getTzCreationStatusLabel(item.status)]
		.filter(Boolean)
		.join(' ')
		.toLowerCase()
}

const filteredHistory = computed(() => {
	const q = search.value.trim().toLowerCase()
	let list = allSessions.value.filter(matchesTab)
	if (q) {
		list = list.filter((item) => sessionSearchText(item).includes(q))
	}
	return list
})

const visibleHistory = computed(() =>
	filteredHistory.value.slice(0, page.value * PAGE_SIZE),
)

const hasMore = computed(() =>
	visibleHistory.value.length < filteredHistory.value.length,
)

const emptyMessage = computed(() => {
	if (search.value.trim()) return 'Ничего не найдено'
	return activeTab.value === 'active'
		? 'Активных сессий пока нет'
		: 'Завершённых сессий пока нет'
})

function openSession(item: TZCreationSessionListItem) {
	navigateTo(`/tz-creation/${item.id}`)
}

async function fetchHistory() {
	loadingHistory.value = true
	try {
		const all = await get<TZCreationSessionListItem[]>('/tz-creation/')
		allSessions.value = [...all].sort((a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		)
	} catch {
		allSessions.value = []
	} finally {
		loadingHistory.value = false
	}
}

onMounted(() => {
	fetchHistory()
})

watch(search, () => { page.value = 1 })
watch(activeTab, () => { page.value = 1 })

const sentinel = ref<HTMLElement | null>(null)

onMounted(() => {
	const observer = new IntersectionObserver((entries) => {
		const entry = entries[0]
		if (entry?.isIntersecting && hasMore.value && !loadingMore.value) {
			loadingMore.value = true
			setTimeout(() => {
				page.value++
				loadingMore.value = false
			}, 300)
		}
	}, { threshold: 0.1 })

	watch(sentinel, (el, _prev, onCleanup) => {
		if (el) observer.observe(el)
		onCleanup(() => observer.disconnect())
	}, { immediate: true })
})
</script>
