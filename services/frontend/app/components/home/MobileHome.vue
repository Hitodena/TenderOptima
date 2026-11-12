<template>
	<div class="flex flex-col gap-5 px-4 pt-3 pb-6">
		<div class="flex h-12 items-center gap-3">
			<div class="min-w-0 flex-1">
				<p class="text-[13px] text-muted">{{ greeting }}</p>
				<p class="truncate text-xl leading-tight font-bold tracking-tight text-highlighted">{{ displayName }}</p>
			</div>
			<NuxtLink
				v-if="user?.subscription"
				:to="subscriptionPath"
				class="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-muted"
			>{{ subscriptionLabel }}</NuxtLink>
		</div>

		<!-- the one thing to do first: new supplier answers -->
		<USkeleton v-if="loading" class="h-16 w-full rounded-2xl" />
		<NuxtLink
			v-else-if="unreadTotal > 0"
			:to="unreadTarget"
			class="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-inverted"
		>
			<UIcon name="i-lucide-inbox" class="size-6 shrink-0" />
			<span class="min-w-0 flex-1">
				<span class="block font-semibold">{{ unreadTitle }}</span>
				<span class="block truncate text-[13px] opacity-85">{{ unreadSubtitle }}</span>
			</span>
			<UIcon name="i-lucide-chevron-right" class="size-5 shrink-0" />
		</NuxtLink>
		<p v-else class="-mt-2 flex items-center gap-1.5 text-[13px] text-muted">
			<UIcon name="i-lucide-check-circle-2" class="size-4 text-success" />
			Новых ответов нет, мы сообщим, когда поставщики ответят
		</p>

		<UButton
			to="/requests"
			size="lg"
			color="neutral"
			leading-icon="i-lucide-search"
			label="Найти поставщиков"
			block
			class="min-h-12 rounded-xl"
		/>

		<section v-if="!loading && recent.length">
			<div class="mb-1 flex items-center justify-between">
				<h2 class="text-[15px] font-semibold text-highlighted">Последние запросы</h2>
				<NuxtLink to="/requests/history" class="flex min-h-9 items-center text-sm font-medium text-primary">Все</NuxtLink>
			</div>
			<ul class="-mx-4 divide-y divide-default/60 border-y border-default/60">
				<li v-for="req in recent" :key="req.id">
					<NuxtLink :to="requestLink(req)" class="flex items-center gap-2 px-4 py-2.5 active:bg-elevated/60">
						<span class="min-w-0 flex-1">
							<span
								class="block truncate text-[15px] leading-snug"
								:class="(req.supplier_messages_unread ?? 0) > 0 ? 'font-semibold text-highlighted' : 'font-medium'"
							>{{ req.query }}</span>
							<span class="block truncate text-[13px] text-muted">{{ requestMeta(req) }}</span>
						</span>
						<span
							v-if="(req.supplier_messages_unread ?? 0) > 0"
							class="shrink-0 rounded-full bg-orange-700 px-1.5 text-[11px] leading-[18px] font-bold text-white"
						>{{ req.supplier_messages_unread }}</span>
						<UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
					</NuxtLink>
				</li>
			</ul>
		</section>
	</div>
</template>

<script lang="ts" setup>
import type { RequestHistoryPageResponse, RequestResponse, UserResponse } from '#shared/types'
import { getRequestStatusLabel, RequestHistoryGroup, RequestStatus } from '#shared/types'
import {
	subscriptionNavBadge,
	subscriptionPlansPath,
} from '#shared/utils/subscriptionDisplay'

const props = defineProps<{ user: UserResponse | null }>()

const { get } = useApi()

const loading = ref(true)
const active = ref<RequestResponse[]>([])

const subscriptionPath = computed(() => subscriptionPlansPath())
const subscriptionLabel = computed(() => subscriptionNavBadge(props.user?.subscription).label)

// the full name may be a department ("Отдел закупок"): show it whole
const displayName = computed(() => props.user?.full_name?.trim() || props.user?.email || '')

const greeting = computed(() => {
	const h = new Date().getHours()
	if (h < 5) return 'Доброй ночи'
	if (h < 12) return 'Доброе утро'
	if (h < 18) return 'Добрый день'
	return 'Добрый вечер'
})

const withUnread = computed(() => active.value.filter(r => (r.supplier_messages_unread ?? 0) > 0))
const unreadTotal = computed(() => withUnread.value.reduce((s, r) => s + (r.supplier_messages_unread ?? 0), 0))
const unreadTitle = computed(() => {
	const n = unreadTotal.value
	return `${n} ${pluralRu(n, 'новый ответ', 'новых ответа', 'новых ответов')} поставщиков`
})
const unreadSubtitle = computed(() => {
	const list = withUnread.value
	if (list.length === 1) return list[0]!.query
	return `в ${list.length} ${pluralRu(list.length, 'запросе', 'запросах', 'запросах')}`
})
// one request with news → straight to its answers; several → the list
const unreadTarget = computed(() =>
	withUnread.value.length === 1 ? `/requests/${withUnread.value[0]!.id}/responses` : '/requests/history',
)

const recent = computed(() => active.value.slice(0, 5))

function pluralRu(n: number, one: string, few: string, many: string): string {
	const m10 = n % 10
	const m100 = n % 100
	if (m10 === 1 && m100 !== 11) return one
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
	return many
}

function requestLink(req: RequestResponse): string {
	return req.status === RequestStatus.QUEUED
		|| req.status === RequestStatus.COMPLETED
		|| req.status === RequestStatus.CLOSED
		? `/requests/${req.id}/responses`
		: `/requests/${req.id}`
}

// no country here: almost every request goes to the same one
function requestMeta(req: RequestResponse): string {
	const sent = req.supplier_messages_sent ?? 0
	if (sent === 0) return getRequestStatusLabel(req.status)
	const answered = req.supplier_messages_incoming_suppliers ?? 0
	return answered > 0 ? `писем ${sent} · ответили ${answered}` : `писем ${sent} · ответов пока нет`
}

onMounted(async () => {
	try {
		const res = await get<RequestHistoryPageResponse>('/requests/history', {
			params: { group: RequestHistoryGroup.ACTIVE, page: 1, size: 20 },
		})
		active.value = res.items
	} catch {
		active.value = []
	} finally {
		loading.value = false
	}
})
</script>
