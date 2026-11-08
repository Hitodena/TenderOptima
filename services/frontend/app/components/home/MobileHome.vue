<template>
	<div class="flex flex-col gap-4 px-4 pt-4 pb-6">
		<div>
			<p class="text-sm text-muted">{{ greeting }}</p>
			<h1 class="text-2xl font-bold tracking-tight text-highlighted">{{ displayName }}</h1>
		</div>

		<!-- the one thing to do first: new supplier answers -->
		<USkeleton v-if="loading" class="h-20 w-full rounded-2xl" />
		<NuxtLink
			v-else-if="unreadTotal > 0"
			:to="unreadTarget"
			class="flex items-center gap-3.5 rounded-2xl bg-primary p-4 text-inverted"
		>
			<span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
				<UIcon name="i-lucide-inbox" class="size-6" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block text-[17px] font-semibold">{{ unreadTitle }}</span>
				<span class="block truncate text-sm opacity-85">{{ unreadSubtitle }}</span>
			</span>
			<UIcon name="i-lucide-chevron-right" class="size-5" />
		</NuxtLink>
		<div
			v-else
			class="flex items-center gap-3.5 rounded-2xl border border-default bg-default p-4"
		>
			<span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/10">
				<UIcon name="i-lucide-check" class="size-6 text-success" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block font-semibold">Новых ответов нет</span>
				<span class="block text-sm text-muted">Мы сообщим, когда поставщики ответят</span>
			</span>
		</div>

		<div v-if="!loading && recent.length" class="flex flex-col overflow-hidden rounded-2xl border border-default bg-default">
			<div class="flex items-center justify-between px-4 pt-3.5 pb-1.5">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted">Последние запросы</p>
				<NuxtLink to="/requests/history" class="flex min-h-11 items-center text-sm font-medium text-primary">Все</NuxtLink>
			</div>
			<NuxtLink
				v-for="req in recent"
				:key="req.id"
				:to="requestLink(req)"
				class="flex items-center gap-3 border-t border-default/60 px-4 py-3"
			>
				<span class="min-w-0 flex-1">
					<span class="block font-medium leading-snug line-clamp-2">{{ req.query }}</span>
					<span class="block text-sm text-muted">{{ requestMeta(req) }}</span>
				</span>
				<span
					v-if="(req.supplier_messages_unread ?? 0) > 0"
					class="shrink-0 rounded-full bg-orange-700 px-2 py-0.5 text-xs font-bold text-white"
				>{{ req.supplier_messages_unread }}</span>
				<UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
			</NuxtLink>
		</div>

		<UButton
			to="/requests"
			size="xl"
			color="neutral"
			leading-icon="i-lucide-search"
			label="Найти поставщиков"
			block
			class="min-h-13 rounded-2xl"
		/>

		<NuxtLink
			v-if="user?.subscription"
			:to="subscriptionPath"
			class="flex min-h-11 items-center justify-center gap-1 text-center text-sm text-muted"
		>
			Тариф «{{ subscriptionLabel }}» · подробнее
		</NuxtLink>
	</div>
</template>

<script lang="ts" setup>
import type { RequestHistoryPageResponse, RequestResponse, UserResponse } from '#shared/types'
import { RequestHistoryGroup, RequestStatus } from '#shared/types'
import {
	subscriptionNavBadge,
	subscriptionPlansPath,
} from '#shared/utils/subscriptionDisplay'
import { titleCaseWords } from '#shared/utils/textFormat'

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

const recent = computed(() => active.value.slice(0, 3))

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

function requestMeta(req: RequestResponse): string {
	const parts = [titleCaseWords(req.delivery_region)]
	const sent = req.supplier_messages_sent ?? 0
	if (sent > 0) {
		parts.push(`писем ${sent}`)
		parts.push(`ответили ${req.supplier_messages_incoming_suppliers ?? 0}`)
	}
	return parts.filter(Boolean).join(' · ')
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
