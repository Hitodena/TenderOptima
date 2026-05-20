<template>
	<UContainer class="py-8">

		<div class="flex items-center justify-between mb-6">
			<div>
				<h1 class="text-2xl font-bold text-highlighted">Запросы</h1>
				<p class="text-sm text-muted mt-1">История поиска поставщиков</p>
			</div>
			<UButton icon="i-lucide-plus" @click="showModal = true">
				Новый запрос
			</UButton>
		</div>

		<div class="flex items-center gap-3 mb-4">
			<UInput v-model="search" placeholder="Поиск по запросу..." icon="i-lucide-search" class="max-w-xs" />
			<USelect v-model="statusFilter" :options="availableStatusOptions" class="w-40" />
			<span class="ml-auto text-sm text-muted">{{ filteredRequests.length }} запросов</span>
		</div>

		<UCard>
			<UTable :data="filteredRequests" :columns="columns" :loading="loading" class="cursor-pointer"
				@select="onRowClick">
				<template #status-cell="{ row }">
					<UBadge :color="statusColor(row.original.status)" variant="subtle" size="sm">
						{{ statusLabel(row.original.status) }}
					</UBadge>
				</template>

				<template #created_at-cell="{ row }">
					<span class="text-sm text-muted">{{ formatDate(row.original.created_at) }}</span>
				</template>

				<template #delivery_region-cell="{ row }">
					<span class="text-sm">{{ row.original.delivery_region ?? '—' }}</span>
				</template>

				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 gap-3">
						<UIcon name="i-lucide-inbox" class="w-10 h-10 text-muted" />
						<p class="text-sm text-muted">Запросов пока нет</p>
						<UButton size="sm" variant="outline" icon="i-lucide-plus" @click="showModal = true">
							Создать первый запрос
						</UButton>
					</div>
				</template>
			</UTable>
		</UCard>

		<CreateRequestModal v-model:open="showModal" @created="onCreated" />

	</UContainer>
</template>

<script lang="ts" setup>
import type { RequestResponse } from '#shared/types'
import type { TableColumn, TableRow } from '@nuxt/ui'


definePageMeta({ layout: 'default' })

const { get } = useApi()

const requests = ref<RequestResponse[]>([])
const loading = ref(true)
const showModal = ref(false)
const search = ref('')
const statusFilter = ref('')

async function fetchRequests() {
	loading.value = true
	try {
		requests.value = await get<RequestResponse[]>('/requests/')
	} catch {
		requests.value = []
	} finally {
		loading.value = false
	}
}

await fetchRequests()

type BadgeColor = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary'

const STATUS_COLOR: Record<string, BadgeColor> = {
	draft: 'neutral',
	active: 'success',
	queued: 'warning',
}

const STATUS_LABEL: Record<string, string> = {
	draft: 'Черновик',
	active: 'Активный',
	queued: 'В очереди',
}

const availableStatusOptions = computed(() => {
	const present = [...new Set(requests.value.map(r => r.status))]
	return [
		{ label: 'Все статусы', value: '' },
		...present.map(s => ({ label: STATUS_LABEL[s] ?? s, value: s })),
	]
})

const filteredRequests = computed(() => {
	let list = requests.value

	if (search.value) {
		const q = search.value.toLowerCase()
		list = list.filter(r => r.query.toLowerCase().includes(q))
	}

	if (statusFilter.value) {
		list = list.filter(r => r.status === statusFilter.value)
	}

	return [...list].sort((a, b) =>
		new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	)
})

const columns: TableColumn<RequestResponse>[] = [
	{ accessorKey: 'query', header: 'Запрос' },
	{ accessorKey: 'status', header: 'Статус' },
	{ accessorKey: 'delivery_region', header: 'Регион' },
	{ accessorKey: 'created_at', header: 'Создан' },
]

function statusColor(status: string): BadgeColor {
	return STATUS_COLOR[status] ?? 'neutral'
}

function statusLabel(status: string): string {
	return STATUS_LABEL[status] ?? status
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric',
	})
}

function onCreated(request: RequestResponse) {
	requests.value.unshift(request)
}


function onRowClick(e: Event, row: TableRow<RequestResponse>) {
	const id = row.original.id
	if (id) {
		navigateTo(`/requests/${id}`)
	}
}
</script>
