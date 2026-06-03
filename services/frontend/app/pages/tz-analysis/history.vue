<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
				<div>
					<h1 class="text-3xl font-bold text-highlighted">История анализа ТЗ</h1>
					<p class="text-muted text-sm mt-1">
						Активные, в обработке и завершённые сравнения ТЗ с КП
					</p>
				</div>
				<UButton to="/tz-analysis" variant="outline" color="neutral"
					leading-icon="i-lucide-scan-search" size="lg" class="shrink-0">
					Новый анализ
				</UButton>
			</div>

			<div class="flex flex-col sm:flex-row gap-3 mb-4">
				<UInput v-model="search" placeholder="Поиск по названию или файлам..." icon="i-lucide-search"
					size="lg" class="flex-1" />
			</div>

			<UTabs v-model="activeTab" :items="tabs" :content="false" :ui="{ list: 'mb-4' }" />

			<div v-if="loadingHistory" class="space-y-3">
				<USkeleton v-for="i in 8" :key="i" class="h-18 w-full rounded-xl" />
			</div>

			<template v-else-if="historyItems.length">
				<div class="space-y-2">
					<UCard v-for="item in historyItems" :key="item.id"
						class="group cursor-pointer hover:shadow-md transition-all hover:-translate-y-px"
						@click="openAnalysis(item)">
						<div class="flex items-center gap-4">
							<div
								class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
								<UIcon name="i-lucide-file-search" class="w-5 h-5 text-primary" />
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-0.5">
									<p class="font-semibold truncate">{{ item.title || item.tz_filename || 'Анализ ТЗ' }}</p>
									<UBadge :color="getTzRunStatusColor(item.status)" variant="subtle"
										size="sm" class="shrink-0">
										{{ getTzRunStatusLabel(item.status) }}
									</UBadge>
								</div>
								<p class="text-xs text-muted flex items-center gap-2 flex-wrap">
									<span v-if="item.tz_filename && item.kp_filename" class="truncate">
										{{ item.tz_filename }} · {{ item.kp_filename }}
									</span>
									<span v-else-if="item.status === TZAnalysisRunStatus.DRAFT" class="truncate">
										Файлы не загружены
									</span>
									<UBadge v-if="item.status === TZAnalysisRunStatus.ACTIVE"
										color="primary" variant="subtle" size="sm">
										{{ item.match_score }}%
									</UBadge>
									<span class="flex items-center gap-1 shrink-0">
										<UIcon name="i-lucide-calendar" class="w-3 h-3" />
										{{ formatDate(item.created_at) }}
									</span>
								</p>
							</div>
							<div class="flex items-center gap-1 shrink-0">
								<template v-if="canComplete(item.status)">
									<UButton :color="confirmCompleteId === item.id ? 'warning' : 'neutral'"
										variant="ghost" size="md"
										:leading-icon="confirmCompleteId === item.id ? 'i-lucide-check' : 'i-lucide-archive'"
										:label="confirmCompleteId === item.id ? 'Подтвердить' : 'Завершить'"
										:loading="completingId === item.id"
										class="opacity-0 group-hover:opacity-100"
										:class="confirmCompleteId === item.id ? 'opacity-100' : ''"
										@click.stop="handleCompleteClick(item.id)" />
									<UIcon v-if="confirmCompleteId !== item.id" name="i-lucide-chevron-right"
										class="w-4 h-4 text-muted" />
									<UButton v-if="confirmCompleteId === item.id" color="neutral"
										variant="ghost" size="xs" icon="i-lucide-x"
										@click.stop="confirmCompleteId = null" />
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

				<p v-if="!hasMore && historyItems.length > 0" class="text-center text-xs text-muted py-4">
					Все записи загружены
				</p>
			</template>

			<div v-else class="text-center py-16">
				<UIcon name="i-lucide-inbox" class="w-12 h-12 mx-auto mb-3 text-muted opacity-40" />
				<p class="text-muted">{{ emptyMessage }}</p>
				<UButton v-if="!search" to="/tz-analysis" variant="outline" size="sm" class="mt-3">
					Новый анализ
				</UButton>
			</div>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TZAnalysisHistoryPageResponse, TZAnalysisListItem } from '#shared/types'
import {
	getTzRunStatusColor,
	getTzRunStatusLabel,
	TZAnalysisHistoryGroup,
	TZAnalysisRunStatus,
} from '#shared/types'

definePageMeta({ layout: 'default' })

const { post, get } = useApi()
const { formatDate } = useFormatDate()

const PAGE_SIZE = 10

const historyItems = ref<TZAnalysisListItem[]>([])
const loadingHistory = ref(true)
const loadingMore = ref(false)
const hasMore = ref(false)
const page = ref(1)
const search = ref('')
const confirmCompleteId = ref<string | null>(null)
const completingId = ref<string | null>(null)
const activeTab = ref<TZAnalysisHistoryGroup>(TZAnalysisHistoryGroup.DRAFT)

const tabs = [
	{ label: 'Черновики', icon: 'i-lucide-file-pen', value: TZAnalysisHistoryGroup.DRAFT },
	{ label: 'Активный', icon: 'i-lucide-activity', value: TZAnalysisHistoryGroup.ACTIVE },
	{
		label: 'В очереди на обработку',
		icon: 'i-lucide-loader',
		value: TZAnalysisHistoryGroup.PROCESSING,
	},
	{ label: 'Завершен', icon: 'i-lucide-archive', value: TZAnalysisHistoryGroup.COMPLETED },
]

const emptyMessage = computed(() => {
	if (search.value.trim()) return 'Ничего не найдено'
	if (activeTab.value === TZAnalysisHistoryGroup.DRAFT) {
		return 'Черновиков пока нет'
	}
	if (activeTab.value === TZAnalysisHistoryGroup.ACTIVE) {
		return 'Активных анализов пока нет'
	}
	if (activeTab.value === TZAnalysisHistoryGroup.PROCESSING) {
		return 'Анализов в обработке пока нет'
	}
	return 'Завершённых анализов пока нет'
})

function canComplete(status: string) {
	return status === TZAnalysisRunStatus.ACTIVE
}

function openAnalysis(item: TZAnalysisListItem) {
	navigateTo(`/tz-analysis/${item.id}`)
}

async function fetchHistory(reset = true) {
	if (reset) {
		loadingHistory.value = true
		page.value = 1
	} else {
		loadingMore.value = true
	}
	try {
		const q = search.value.trim()
		const params = new URLSearchParams({
			group: activeTab.value,
			page: String(page.value),
			size: String(PAGE_SIZE),
		})
		if (q) params.set('q', q)
		const data = await get<TZAnalysisHistoryPageResponse>(
			`/tz-analysis/history?${params.toString()}`,
		)
		if (reset) {
			historyItems.value = data.items
		} else {
			historyItems.value = [...historyItems.value, ...data.items]
		}
		hasMore.value = data.has_more
	} catch {
		if (reset) historyItems.value = []
		hasMore.value = false
	} finally {
		loadingHistory.value = false
		loadingMore.value = false
	}
}

onMounted(() => {
	fetchHistory(true)
})

let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
	if (searchDebounce) clearTimeout(searchDebounce)
	searchDebounce = setTimeout(() => fetchHistory(true), 300)
})

watch(activeTab, () => {
	page.value = 1
	confirmCompleteId.value = null
	fetchHistory(true)
})

onMounted(() => {
	const dismissConfirm = () => { confirmCompleteId.value = null }
	document.addEventListener('click', dismissConfirm)
	onUnmounted(() => document.removeEventListener('click', dismissConfirm))
})

async function handleCompleteClick(id: string) {
	if (confirmCompleteId.value !== id) {
		confirmCompleteId.value = id
		return
	}
	completingId.value = id
	confirmCompleteId.value = null
	try {
		await post(`/tz-analysis/${id}/complete`)
		historyItems.value = historyItems.value.filter((r) => r.id !== id)
	} catch {
		// ignore
	} finally {
		completingId.value = null
	}
}

const sentinel = ref<HTMLElement | null>(null)

onMounted(() => {
	const observer = new IntersectionObserver((entries) => {
		const entry = entries[0]
		if (
			entry?.isIntersecting
			&& hasMore.value
			&& !loadingMore.value
			&& !loadingHistory.value
		) {
			page.value++
			fetchHistory(false)
		}
	}, { threshold: 0.1 })

	watch(sentinel, (el, _prev, onCleanup) => {
		if (el) observer.observe(el)
		onCleanup(() => observer.disconnect())
	}, { immediate: true })
})
</script>
