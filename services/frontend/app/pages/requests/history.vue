<template>
	<UContainer class="pb-6 md:py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">
			<AppMobileBar
				v-model:search="search"
				title="Запросы"
				searchable
				search-placeholder="Поиск по запросам"
			>
				<template #actions>
					<UButton
						to="/requests"
						color="neutral"
						variant="ghost"
						size="lg"
						icon="i-lucide-plus"
						class="shrink-0"
						aria-label="Новый поиск"
					/>
				</template>
			</AppMobileBar>

			<div class="mb-4 hidden flex-row items-center justify-between gap-3 sm:mb-6 md:flex">
				<div>
					<h1 class="text-2xl font-bold text-highlighted sm:text-3xl">
						<span class="lg:hidden">Запросы</span>
						<span class="hidden lg:inline">История запросов</span>
					</h1>
					<p class="mt-1 text-sm text-muted">Все ваши поисковые запросы и статусы</p>
				</div>
				<div class="flex items-center gap-3">
					<UInput
						v-model="search"
						placeholder="Поиск по запросам"
						icon="i-lucide-search"
						class="w-56"
						size="xl"
						type="search"
					/>
					<UButton
						to="/requests"
						variant="outline"
						color="neutral"
						leading-icon="i-lucide-search"
						size="lg"
						class="hidden shrink-0 lg:inline-flex"
					>
						Новый поиск
					</UButton>
				</div>
			</div>

			<UTabs v-model="activeTab" :items="tabs" :content="false" class="hidden md:block" :ui="{ list: 'mb-4' }" />
			<AppSegmented v-model="activeTab" :items="mobileTabs" class="mb-3 md:hidden" />

			<div v-if="loadingHistory" class="space-y-3">
				<USkeleton v-for="i in 8" :key="i" class="h-18 w-full rounded-xl" />
			</div>

			<template v-else-if="items.length">
				<!-- phones: a compact grouped list, two lines per request -->
				<ul class="-mx-4 divide-y divide-default/60 border-y border-default/60 md:hidden">
					<li
						v-for="req in items"
						:key="req.id"
						class="flex items-center gap-1 active:bg-elevated/60"
					>
						<button type="button" class="min-w-0 flex-1 py-2.5 pl-4 text-left" @click="openRequest(req)">
							<span class="flex items-center gap-2">
								<span
									class="min-w-0 flex-1 truncate text-[15px] leading-snug"
									:class="hasUnreadMessages(req) ? 'font-semibold text-highlighted' : 'font-medium'"
								>{{ req.query }}</span>
								<span class="shrink-0 text-xs text-dimmed tabular-nums">{{ formatShortDate(req.created_at) }}</span>
							</span>
							<span class="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
								<span class="size-1.5 shrink-0 rounded-full" :class="statusDotClass(req.status)" />
								<span class="shrink-0">{{ getRequestStatusLabel(req.status) }}</span>
								<span v-if="showMessageStats(req)" class="truncate">· {{ compactStatsLabel(req) }}</span>
								<span
									v-if="hasUnreadMessages(req)"
									class="ml-auto shrink-0 rounded-full bg-orange-700 px-1.5 text-[11px] leading-[18px] font-bold text-white"
								>{{ unreadLabel(req) }}</span>
							</span>
						</button>
						<UDropdownMenu
							v-if="req.status !== RequestStatus.CLOSED"
							:items="mobileCardMenu(req)"
						>
							<UButton
								color="neutral"
								variant="ghost"
								icon="i-lucide-ellipsis-vertical"
								size="md"
								class="mr-1 shrink-0 text-dimmed"
								aria-label="Действия с запросом"
								:loading="closingId === req.id"
								@click.stop
							/>
						</UDropdownMenu>
						<UIcon v-else name="i-lucide-chevron-right" class="mr-3 size-4 shrink-0 text-dimmed" />
					</li>
				</ul>

				<div class="hidden space-y-2 md:block">
					<UCard
						v-for="req in items"
						:key="req.id"
						class="group cursor-pointer hover:shadow-md transition-all hover:-translate-y-px"
						@click="openRequest(req)"
					>
						<div class="flex items-center gap-3 sm:gap-4">
							<div
								class="w-10 h-10 rounded-xl bg-primary/10 hidden sm:flex items-center justify-center shrink-0 relative"
							>
								<UIcon name="i-lucide-package-search" class="w-5 h-5 text-primary" />
								<span
									v-if="hasUnreadMessages(req)"
									class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-default"
								/>
							</div>
							<div class="flex-1 min-w-0">
								<div class="mb-1 flex items-start gap-2 sm:mb-0.5 sm:items-center">
									<p class="min-w-0 flex-1 font-semibold leading-snug line-clamp-2 sm:flex-none sm:truncate">{{ req.query }}</p>
									<span
										v-if="hasUnreadMessages(req)"
										class="shrink-0 rounded-full bg-orange-700 px-2 py-0.5 text-xs font-bold text-white sm:hidden"
									>{{ unreadLabel(req) }}</span>
									<UBadge
										:color="getRequestStatusColor(req.status)"
										variant="subtle"
										size="sm"
										class="hidden shrink-0 sm:inline-flex"
									>
										{{ getRequestStatusLabel(req.status) }}
									</UBadge>
								</div>
								<UBadge
									:color="getRequestStatusColor(req.status)"
									variant="subtle"
									size="sm"
									class="mb-1 sm:hidden"
								>
									{{ getRequestStatusLabel(req.status) }}
								</UBadge>
								<p class="text-xs text-muted flex items-center gap-2 flex-wrap">
									<span class="flex items-center gap-1">
										<UIcon name="i-lucide-map-pin" class="w-3 h-3" />
										{{ titleCaseWords(req.delivery_region) }}
									</span>
									<span>·</span>
									<span class="flex items-center gap-1">
										<UIcon name="i-lucide-calendar" class="w-3 h-3" />
										{{ formatDate(req.created_at) }}
									</span>
									<template v-if="showMessageStats(req)">
										<span>·</span>
										<span class="flex items-center gap-1 text-primary">
											<UIcon name="i-lucide-inbox" class="w-3 h-3" />
											{{ requestMessageStatsLabel(req) }}
										</span>
									</template>
								</p>
							</div>
							<!-- phones: no hover, so "Завершить" lives in an always visible menu -->
							<UDropdownMenu
								v-if="req.status !== RequestStatus.CLOSED"
								:items="mobileCardMenu(req)"
								class="sm:hidden"
							>
								<UButton
									color="neutral"
									variant="ghost"
									icon="i-lucide-ellipsis-vertical"
									size="lg"
									class="-mr-2 sm:hidden"
									aria-label="Действия с запросом"
									:loading="closingId === req.id"
									@click.stop
								/>
							</UDropdownMenu>
							<div class="hidden items-center gap-1 shrink-0 sm:flex">
								<template v-if="req.status !== RequestStatus.CLOSED">
									<UButton
										:color="confirmCloseId === req.id ? 'warning' : 'neutral'"
										variant="ghost"
										size="md"
										:leading-icon="confirmCloseId === req.id ? 'i-lucide-check' : 'i-lucide-lock'"
										:label="confirmCloseId === req.id ? 'Подтвердить' : 'Завершить'"
										:loading="closingId === req.id"
										class="opacity-0 group-hover:opacity-100"
										:class="confirmCloseId === req.id ? 'opacity-100' : ''"
										@click.stop="handleCloseClick(req.id)"
									/>
									<UIcon
										v-if="confirmCloseId !== req.id"
										name="i-lucide-chevron-right"
										class="w-4 h-4 text-muted"
									/>
									<UButton
										v-if="confirmCloseId === req.id"
										color="neutral"
										variant="ghost"
										size="xs"
										icon="i-lucide-x"
										@click.stop="confirmCloseId = null"
									/>
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


				<p v-if="!hasMore && items.length > PAGE_SIZE" class="text-center text-xs text-muted py-4">
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
import type { RequestHistoryPageResponse, RequestResponse } from '#shared/types'
import {
	getRequestStatusColor,
	getRequestStatusLabel,
	RequestHistoryGroup,
	RequestStatus,
} from '#shared/types'
import { pluralizeLetters, pluralizeSuppliersGenitive, titleCaseWords } from '#shared/utils/textFormat'
import { t } from '~/constants/translations'

const { post, get } = useApi()
const { formatDate } = useFormatDate()

function showMessageStats(req: RequestResponse): boolean {
	return (
		req.status === RequestStatus.QUEUED
		|| req.status === RequestStatus.COMPLETED
		|| req.status === RequestStatus.CLOSED
		|| (req.supplier_messages_incoming ?? 0) > 0
	)
}

// letters sent and the suppliers who answered; several replies from one
// supplier count once
function requestMessageStatsLabel(req: RequestResponse): string {
	const sent = req.supplier_messages_sent ?? 0
	const suppliers = req.supplier_messages_incoming_suppliers ?? 0
	return t(suppliers > 0 ? 'requests.sentLettersStats' : 'requests.sentLettersNoReplies')
		.replace('{sent}', String(sent))
		.replace('{sentLabel}', pluralizeLetters(sent))
		.replace('{suppliers}', String(suppliers))
		.replace('{suppliersLabel}', pluralizeSuppliersGenitive(suppliers))
}

function unreadLabel(req: RequestResponse): string {
	const n = req.supplier_messages_unread ?? 0
	return `${n} ${pluralRu(n, 'новый', 'новых', 'новых')}`
}

function pluralRu(n: number, one: string, few: string, many: string): string {
	const m10 = n % 10
	const m100 = n % 100
	if (m10 === 1 && m100 !== 11) return one
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
	return many
}

function mobileCardMenu(req: RequestResponse) {
	return [[
		{
			label: 'Открыть',
			icon: 'i-lucide-arrow-right',
			onSelect: () => openRequest(req),
		},
	], [
		{
			label: 'Завершить запрос',
			icon: 'i-lucide-lock',
			color: 'warning' as const,
			onSelect: () => closeRequest(req.id),
		},
	]]
}

function hasUnreadMessages(req: RequestResponse): boolean {
	return (req.supplier_messages_unread ?? 0) > 0
}

function openRequest(req: RequestResponse) {
	if (
		req.status === RequestStatus.QUEUED
		|| req.status === RequestStatus.COMPLETED
		|| req.status === RequestStatus.CLOSED
	) {
		navigateTo(`/requests/${req.id}/responses`)
	} else {
		navigateTo(`/requests/${req.id}`)
	}
}

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

const items = ref<RequestResponse[]>([])
const loadingHistory = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const hasMore = ref(false)
const search = ref('')
const searchQuery = ref('')
const confirmCloseId = ref<string | null>(null)
const closingId = ref<string | null>(null)
const activeTab = ref<RequestHistoryGroup>(RequestHistoryGroup.ACTIVE)
const sentinel = ref<HTMLElement | null>(null)
let fetchGeneration = 0

const tabs = [
	{ label: 'Активные', icon: 'i-lucide-activity', value: RequestHistoryGroup.ACTIVE },
	{ label: 'Завершённые', icon: 'i-lucide-archive', value: RequestHistoryGroup.CLOSED },
]
const mobileTabs = [
	{ label: 'Активные', value: RequestHistoryGroup.ACTIVE },
	{ label: 'Завершённые', value: RequestHistoryGroup.CLOSED },
]

// phones: "12.11" this year, "12.11.25" otherwise
function formatShortDate(value: string): string {
	const d = new Date(value)
	if (Number.isNaN(d.getTime())) return ''
	const dd = String(d.getDate()).padStart(2, '0')
	const mm = String(d.getMonth() + 1).padStart(2, '0')
	return d.getFullYear() === new Date().getFullYear()
		? `${dd}.${mm}`
		: `${dd}.${mm}.${String(d.getFullYear()).slice(2)}`
}

function statusDotClass(status: string): string {
	const color = getRequestStatusColor(status)
	return ({
		success: 'bg-success',
		warning: 'bg-warning',
		error: 'bg-error',
		primary: 'bg-primary',
		info: 'bg-info',
	} as Record<string, string>)[color] ?? 'bg-dimmed'
}

// phones: "писем 3 · ответили 2" in one short line
function compactStatsLabel(req: RequestResponse): string {
	const sent = req.supplier_messages_sent ?? 0
	const answered = req.supplier_messages_incoming_suppliers ?? 0
	return answered > 0 ? `писем ${sent} · ответили ${answered}` : `писем ${sent} · ответов нет`
}

const emptyMessage = computed(() => {
	if (searchQuery.value.trim()) return 'Ничего не найдено'
	if (activeTab.value === RequestHistoryGroup.CLOSED) {
		return 'Завершённых запросов пока нет'
	}
	return 'Активных запросов пока нет'
})

async function fetchPage(nextPage: number, append: boolean) {
	if (append) {
		if (!hasMore.value || loadingMore.value) return
		loadingMore.value = true
	} else {
		fetchGeneration += 1
		loadingMore.value = false
		loadingHistory.value = true
	}
	const generation = fetchGeneration

	try {
		const q = searchQuery.value.trim()
		const res = await get<RequestHistoryPageResponse>('/requests/history', {
			params: {
				group: activeTab.value,
				page: nextPage,
				size: PAGE_SIZE,
				...(q ? { q } : {}),
			},
		})
		if (generation !== fetchGeneration) return
		items.value = append ? [...items.value, ...res.items] : res.items
		page.value = res.page
		hasMore.value = res.has_more
	} catch {
		if (generation !== fetchGeneration) return
		if (!append) {
			items.value = []
			hasMore.value = false
		}
	} finally {
		if (generation === fetchGeneration) {
			loadingHistory.value = false
			loadingMore.value = false
			await nextTick()
			maybeLoadMoreIfSentinelVisible()
		}
	}
}

function maybeLoadMoreIfSentinelVisible() {
	const el = sentinel.value
	if (!el || !hasMore.value || loadingMore.value || loadingHistory.value) return
	const rect = el.getBoundingClientRect()
	const visible = rect.top < window.innerHeight && rect.bottom > 0
	if (visible) {
		void fetchPage(page.value + 1, true)
	}
}

function loadMore() {
	void fetchPage(page.value + 1, true)
}

onMounted(() => {
	void fetchPage(1, false)
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (value) => {
	if (searchTimer) clearTimeout(searchTimer)
	searchTimer = setTimeout(() => {
		searchQuery.value = value
	}, SEARCH_DEBOUNCE_MS)
})

watch(searchQuery, () => {
	void fetchPage(1, false)
})

watch(activeTab, () => {
	confirmCloseId.value = null
	void fetchPage(1, false)
})

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
	await closeRequest(id)
}

async function closeRequest(id: string) {
	closingId.value = id
	confirmCloseId.value = null
	try {
		await post(`/requests/${id}/close`)
		items.value = items.value.filter((r) => r.id !== id)
	} catch {
		// ignore close error
	} finally {
		closingId.value = null
	}
}

onMounted(() => {
	const observer = new IntersectionObserver((entries) => {
		const entry = entries[0]
		if (entry?.isIntersecting && hasMore.value && !loadingMore.value && !loadingHistory.value) {
			loadMore()
		}
	}, { threshold: 0.1 })

	watch(sentinel, (el, _prev, onCleanup) => {
		if (el) observer.observe(el)
		onCleanup(() => observer.disconnect())
	}, { immediate: true })
})
</script>
