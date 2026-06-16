<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-4xl mx-auto">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
				<div>
					<h1 class="text-3xl font-bold text-highlighted">История анализа технических предложений</h1>
					<p class="text-muted text-sm mt-1">
						Активные и завершённые сравнения коммерческих предложений с техническими заданиями
					</p>
				</div>
				<div class="flex items-center gap-3 shrink-0">
					<UInput v-model="search" placeholder="Поиск по анализам..." icon="i-lucide-search"
						class="w-full sm:w-56" size="lg" />
					<UButton to="/tz-analysis" variant="outline" color="neutral" leading-icon="i-lucide-scan-search"
						size="lg" class="shrink-0">
						Новый анализ
					</UButton>
				</div>
			</div>

			<UTabs v-model="activeTab" :items="tabs" :content="false" :ui="{ list: 'mb-4' }" />

			<div v-if="loadingHistory" class="space-y-3">
				<USkeleton v-for="i in 8" :key="i" class="h-18 w-full rounded-xl" />
			</div>

			<template v-else-if="visibleHistory.length">
				<div class="space-y-2">
					<UCard v-for="item in visibleHistory" :key="item.id"
						class="group cursor-pointer hover:shadow-md transition-all hover:-translate-y-px"
						@click="openAnalysis(item)">
						<div class="flex items-center gap-4">
							<div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
								<UIcon name="i-lucide-file-search" class="w-5 h-5 text-primary" />
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-0.5">
									<p class="font-semibold truncate">{{ item.title || item.tz_filename || 'Анализ ТЗ'
										}}</p>
									<UBadge :color="getTzRunStatusColor(item.status)" variant="subtle" size="sm"
										class="shrink-0">
										{{ getTzRunStatusLabel(item.status) }}
									</UBadge>
								</div>
								<p class="text-xs text-muted flex items-center gap-2 flex-wrap">
									<span v-if="displayFilesLabel(item)" class="truncate">
										{{ displayFilesLabel(item) }}
									</span>
									<span v-else-if="item.status === TZAnalysisRunStatus.DRAFT" class="truncate">
										Файлы не загружены
									</span>
									<UBadge v-if="item.status === TZAnalysisRunStatus.ACTIVE" color="primary"
										variant="subtle" size="sm">
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
										:loading="completingId === item.id" class="opacity-0 group-hover:opacity-100"
										:class="confirmCompleteId === item.id ? 'opacity-100' : ''"
										@click.stop="handleCompleteClick(item.id)" />
									<UIcon v-if="confirmCompleteId !== item.id" name="i-lucide-chevron-right"
										class="w-4 h-4 text-muted" />
									<UButton v-if="confirmCompleteId === item.id" color="neutral" variant="ghost"
										size="xs" icon="i-lucide-x" @click.stop="confirmCompleteId = null" />
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

				<p v-if="!hasMore && visibleHistory.length > 0" class="text-center text-xs text-muted py-4">
					Все записи загружены
				</p>
			</template>

			<div v-else class="text-center py-16">
				<UIcon name="i-lucide-inbox" class="w-12 h-12 mx-auto mb-3 text-muted opacity-40" />
				<p class="text-muted">{{ emptyMessage }}</p>
				<UButton v-if="!search.trim()" to="/tz-analysis" variant="outline" size="sm" class="mt-3">
					Новый анализ
				</UButton>
			</div>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TZAnalysisListItem } from '#shared/types'
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

const allAnalyses = ref<TZAnalysisListItem[]>([])
const loadingHistory = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const search = ref('')
const confirmCompleteId = ref<string | null>(null)
const completingId = ref<string | null>(null)
const activeTab = ref<TZAnalysisHistoryGroup>(TZAnalysisHistoryGroup.ACTIVE)

const tabs = [
	{ label: 'Активный', icon: 'i-lucide-activity', value: TZAnalysisHistoryGroup.ACTIVE },
	{ label: 'Завершен', icon: 'i-lucide-archive', value: TZAnalysisHistoryGroup.COMPLETED },
]

const ACTIVE_STATUSES = new Set<string>([
	TZAnalysisRunStatus.DRAFT,
	TZAnalysisRunStatus.ACTIVE,
	TZAnalysisRunStatus.PROCESSING,
	TZAnalysisRunStatus.FAILED,
])

function matchesTab(item: TZAnalysisListItem): boolean {
	if (activeTab.value === TZAnalysisHistoryGroup.ACTIVE) {
		return ACTIVE_STATUSES.has(item.status)
	}
	return item.status === TZAnalysisRunStatus.COMPLETED
}

function analysisSearchText(item: TZAnalysisListItem): string {
	const parts = [
		item.title,
		item.tz_filename,
		item.kp_filename,
		...(item.kp_filenames ?? []),
		getTzRunStatusLabel(item.status),
	]
	return parts.filter(Boolean).join(' ').toLowerCase()
}

const filteredHistory = computed(() => {
	const q = search.value.trim().toLowerCase()
	let list = allAnalyses.value.filter(matchesTab)
	if (q) {
		list = list.filter((item) => analysisSearchText(item).includes(q))
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
	if (activeTab.value === TZAnalysisHistoryGroup.ACTIVE) {
		return 'Активных анализов пока нет'
	}
	return 'Завершённых анализов пока нет'
})

function displayFilesLabel(item: TZAnalysisListItem): string | null {
	if (!item.tz_filename) return null
	const kpNames = item.kp_filenames?.length
		? item.kp_filenames
		: item.kp_filename
			? [item.kp_filename]
			: []
	if (!kpNames.length) return item.tz_filename
	return `${item.tz_filename} · ${kpNames.join(' · ')}`
}

function canComplete(status: string) {
	return status === TZAnalysisRunStatus.ACTIVE
}

function openAnalysis(item: TZAnalysisListItem) {
	navigateTo(`/tz-analysis/${item.id}`)
}

async function fetchHistory() {
	loadingHistory.value = true
	try {
		const all = await get<TZAnalysisListItem[]>('/tz-analysis/')
		allAnalyses.value = [...all].sort((a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		)
	} catch {
		allAnalyses.value = []
	} finally {
		loadingHistory.value = false
	}
}

onMounted(() => {
	fetchHistory()
})

watch(search, () => { page.value = 1 })
watch(activeTab, () => {
	page.value = 1
	confirmCompleteId.value = null
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
		const idx = allAnalyses.value.findIndex((r) => r.id === id)
		const existing = idx >= 0 ? allAnalyses.value[idx] : undefined
		if (existing) {
			allAnalyses.value[idx] = {
				...existing,
				status: TZAnalysisRunStatus.COMPLETED,
			}
		}
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
