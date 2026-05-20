<template>
	<UContainer class="py-8">

		<UButton variant="ghost" leading-icon="i-lucide-arrow-left" to="/requests" class="mb-6">
			Все запросы
		</UButton>

		<template v-if="loading">
			<div class="space-y-4">
				<USkeleton class="h-10 w-64" />
				<USkeleton class="h-48 w-full" />
			</div>
		</template>

		<template v-else-if="request">

			<div class="flex items-start justify-between mb-6 gap-4">
				<div>
					<div class="flex items-center gap-3 mb-1">
						<h1 class="text-2xl font-bold text-highlighted">{{ request.query }}</h1>
						<UBadge :color="statusColor" variant="subtle">{{ statusLabel }}</UBadge>
					</div>
					<p class="text-sm text-muted">
						Создан {{ formatDate(request.created_at) }}
						<span v-if="request.delivery_region"> · {{ request.delivery_region }}</span>
					</p>
				</div>

				<div class="flex gap-2 shrink-0">
					<!-- Поиск: только draft -->
					<UButton v-if="request.status === 'draft'" icon="i-lucide-search" :loading="searching"
						@click="handleSearch">
						Запустить поиск
					</UButton>

					<UButton v-if="request.status === 'active'" icon="i-lucide-send" color="success"
						:loading="launching" @click="handleLaunch">
						Запустить рассылку
					</UButton>

					<UButton v-if="request.status !== 'draft'" variant="outline" color="neutral"
						leading-icon="i-lucide-inbox" :to="`/requests/${id}/responses`">
						Ответы поставщиков
					</UButton>
				</div>
			</div>

			<UAlert v-if="searchResult" color="success" variant="soft" icon="i-lucide-check-circle" class="mb-6"
				title="Поиск завершён"
				:description="`Найдено: ${searchResult.saved_suppliers} поставщиков. Пропущено из-за блеклиста: ${searchResult.skipped_blacklisted}. Без email: ${searchResult.skipped_no_email}.`" />

			<UAlert v-if="launchResult" color="info" variant="soft" icon="i-lucide-mail-check" class="mb-6"
				title="Рассылка запущена" :description="`Письма отправляются ${launchResult.pending} поставщикам.`" />

			<UAlert v-if="actionError" color="error" variant="soft" icon="i-lucide-circle-alert" class="mb-6"
				:description="actionError" />

			<UCard>
				<template #header>
					<p class="font-semibold">Параметры запроса</p>
				</template>

				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
					<div v-for="field in fields" :key="field.label">
						<p class="text-xs text-muted mb-0.5">{{ field.label }}</p>
						<p class="text-sm font-medium">{{ field.value ?? '—' }}</p>
					</div>
				</div>

				<template v-if="request.description" #footer>
					<div>
						<p class="text-xs text-muted mb-1">Описание</p>
						<p class="text-sm">{{ request.description }}</p>
					</div>
				</template>
			</UCard>

		</template>

		<template v-else>
			<div class="flex flex-col items-center justify-center py-24 gap-3">
				<UIcon name="i-lucide-file-x" class="w-12 h-12 text-muted" />
				<p class="text-muted">Запрос не найден</p>
				<UButton to="/requests" variant="outline">Вернуться к списку</UButton>
			</div>
		</template>

	</UContainer>
</template>

<script lang="ts" setup>
import type { LaunchMailingResponse, RequestResponse, SearchResult } from '#shared/types'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const { get, post } = useApi()

const request = ref<RequestResponse | null>(null)
const loading = ref(true)
const searching = ref(false)
const launching = ref(false)
const searchResult = ref<SearchResult | null>(null)
const launchResult = ref<LaunchMailingResponse | null>(null)
const actionError = ref('')

async function fetchRequest() {
	loading.value = true
	try {
		request.value = await get<RequestResponse>(`/requests/${id}`)
	} catch {
		request.value = null
	} finally {
		loading.value = false
	}
}

await fetchRequest()

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

const statusColor = computed<BadgeColor>(() =>
	STATUS_COLOR[request.value?.status ?? ''] ?? 'neutral'
)

const statusLabel = computed(() =>
	STATUS_LABEL[request.value?.status ?? ''] ?? request.value?.status ?? ''
)

const fields = computed(() => {
	const r = request.value
	if (!r) return []
	return [
		{ label: 'Статус', value: STATUS_LABEL[r.status] ?? r.status },
		{ label: 'Регион доставки', value: r.delivery_region },
		{ label: 'Количество', value: r.quantity ? `${r.quantity} ${r.unit ?? ''}`.trim() : null },
		{ label: 'Макс. цена за ед.', value: r.max_price_per_unit ? `${r.max_price_per_unit} ${r.currency ?? ''}`.trim() : null },
		{ label: 'Требования к качеству', value: r.quality_requirements },
		{ label: 'Срок поставки', value: r.delivery_deadline ? formatDate(r.delivery_deadline) : null },
		{ label: 'Tracking ID', value: r.tracking_id },
	]
})

async function handleSearch() {
	if (searching.value) return
	searching.value = true
	actionError.value = ''
	searchResult.value = null
	try {
		const result = await post<SearchResult>(`/requests/${id}/search`)
		searchResult.value = result
		if (request.value) request.value.status = 'active'
	} catch (e: any) {
		const detail = e.response?.data?.detail
		actionError.value = typeof detail === 'string' ? detail : 'Ошибка при поиске'
	} finally {
		searching.value = false
	}
}

async function handleLaunch() {
	if (launching.value) return
	launching.value = true
	actionError.value = ''
	launchResult.value = null
	try {
		const result = await post<LaunchMailingResponse>(`/requests/${id}/launch`)
		launchResult.value = result
		if (request.value) request.value.status = 'queued'
	} catch (e: any) {
		const detail = e.response?.data?.detail
		actionError.value = typeof detail === 'string' ? detail : 'Ошибка при запуске рассылки'
	} finally {
		launching.value = false
	}
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric',
	})
}
</script>
