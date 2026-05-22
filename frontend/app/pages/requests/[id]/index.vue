<template>
	<UContainer class="py-8">

		<template v-if="loading">
			<div class="space-y-4">
				<USkeleton class="h-10 w-72" />
				<USkeleton class="h-6 w-48" />
				<USkeleton class="h-64 w-full" />
			</div>
		</template>

		<template v-else-if="request">

			<div class="flex items-start justify-between mb-6 gap-4">
				<div class="min-w-0">
					<div class="flex items-center gap-3 mb-1 flex-wrap">
						<h1 class="text-2xl font-bold text-highlighted truncate">{{ request.query }}</h1>
						<UBadge :color="statusColor" variant="subtle" size="lg">{{ statusLabel }}</UBadge>
					</div>
					<div class="flex items-center gap-3 text-sm text-muted flex-wrap">
						<span class="flex items-center gap-1">
							<UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
							{{ formatDate(request.created_at) }}
						</span>
						<span v-if="request.delivery_region" class="flex items-center gap-1">
							<UIcon name="i-lucide-map-pin" class="w-3.5 h-3.5" />
							{{ request.delivery_region }}
						</span>
						<span v-if="request.currency" class="flex items-center gap-1">
							<UIcon name="i-lucide-coins" class="w-3.5 h-3.5" />
							{{ request.currency }}
						</span>
					</div>
				</div>

				<UButton v-if="request.status !== 'draft'" variant="outline" color="neutral"
					leading-icon="i-lucide-inbox" :to="`/requests/${id}/responses`" class="shrink-0">
					Ответы поставщиков
				</UButton>
			</div>

			<UAlert v-if="actionError" color="error" variant="soft" icon="i-lucide-circle-alert"
				:description="actionError" class="mb-6" />

			<UAlert v-if="launchResult" color="success" variant="soft" icon="i-lucide-mail-check"
				title="Рассылка запущена"
				:description="`Письма поставлены в очередь для ${launchResult.pending} поставщиков. Ответы появятся в разделе «Ответы поставщиков».`"
				class="mb-6" />

			<template v-if="suppliers.length || loadingSuppliers">

				<div class="flex items-start justify-between mb-4 gap-4">
					<div>
						<h2 class="text-lg font-semibold">Найденные поставщики</h2>
						<p class="text-sm text-muted mt-0.5">
							Включите нужных и нажмите «Отправить запрос»
						</p>
					</div>

					<div class="flex gap-3 shrink-0">
						<div class="text-center">
							<p class="text-xl font-bold text-highlighted">{{ suppliers.length }}</p>
							<p class="text-xs text-muted">Найдено</p>
						</div>
						<USeparator orientation="vertical" />
						<div class="text-center">
							<p class="text-xl font-bold text-primary">{{ enabledCount }}</p>
							<p class="text-xs text-muted">Выбрано</p>
						</div>
					</div>
				</div>

				<UAlert color="info" variant="soft" icon="i-lucide-info" class="mb-4"
					description="Отправляйте запросы только подходящим компаниям. Нерелевантные письма могут негативно влиять на репутацию вашей компании." />

				<UCard class="mb-4">
					<UTable :data="suppliers" :columns="supplierColumns" :loading="loadingSuppliers">
						<template #is_enabled-cell="{ row }">
							<USwitch :model-value="row.original.is_enabled" size="sm"
								:disabled="updatingToggle || request.status === 'queued'"
								@update:model-value="val => handleToggle(row.original, Boolean(val))" />
						</template>

						<template #company_name-cell="{ row }">
							<div class="flex items-center gap-2">
								<div class="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center shrink-0">
									<UIcon name="i-lucide-building-2" class="w-3.5 h-3.5 text-muted" />
								</div>
								<span class="font-medium truncate max-w-50">
									{{ row.original.supplier?.company_name }}
								</span>
							</div>
						</template>

						<template #domain-cell="{ row }">
							<a :href="`https://${row.original.supplier?.domain}`" target="_blank"
								class="text-primary hover:underline text-sm" @click.stop>
								{{ row.original.supplier?.domain }}
							</a>
						</template>

						<template #email-cell="{ row }">
							<span class="text-sm text-muted">{{ row.original.supplier?.email }}</span>
						</template>

						<template #status-cell="{ row }">
							<UBadge :color="supplierStatusColor(row.original.status)" variant="subtle" size="sm">
								{{ supplierStatusLabel(row.original.status) }}
							</UBadge>
						</template>
					</UTable>

					<div class="px-4 py-3 border-t border-default flex items-center justify-between">
						<p class="text-sm text-muted">
							Выбрано
							<span class="font-semibold text-highlighted">{{ enabledCount }}</span>
							из {{ suppliers.length }}
						</p>
						<div class="flex gap-2">
							<UButton size="xs" variant="ghost" color="neutral"
								:disabled="updatingToggle || request.status === 'queued' || enabledCount === 0"
								@click="deselectAll">
								Снять все
							</UButton>
							<UButton size="xs" variant="ghost" color="primary"
								:disabled="updatingToggle || request.status === 'queued' || enabledCount === suppliers.length"
								@click="selectAll">
								Выбрать все
							</UButton>
						</div>
					</div>
				</UCard>

				<div v-if="request.status !== 'queued'" class="flex items-center gap-3">
					<UButton size="lg" leading-icon="i-lucide-send" :disabled="enabledCount === 0" :loading="launching"
						@click="openParamsModal">
						Отправить запрос поставщикам
					</UButton>
					<p v-if="enabledCount === 0" class="text-xs text-muted">
						Включите хотя бы одного поставщика
					</p>
				</div>

				<div v-else class="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
					<UIcon name="i-lucide-clock" class="w-5 h-5 text-warning shrink-0" />
					<div>
						<p class="text-sm font-medium">Рассылка в очереди</p>
						<p class="text-xs text-muted">Письма отправляются в фоновом режиме</p>
					</div>
				</div>

			</template>

			<template v-else>
				<div class="flex flex-col items-center justify-center py-20 gap-4">
					<div class="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center">
						<UIcon name="i-lucide-search-x" class="w-8 h-8 text-muted" />
					</div>
					<div class="text-center">
						<p class="font-medium text-highlighted">Поставщики не найдены</p>
						<p class="text-sm text-muted mt-1">
							Попробуйте изменить формулировку запроса или регион
						</p>
					</div>
					<UButton variant="outline" to="/requests/new">Новый поиск</UButton>
				</div>
			</template>

			<AdditionalParamsModal v-model:open="showParamsModal" :request="request" @saved="handleLaunchAfterParams" />

		</template>

		<template v-else>
			<div class="flex flex-col items-center justify-center py-24 gap-3">
				<UIcon name="i-lucide-file-x" class="w-12 h-12 text-muted" />
				<p class="text-muted">Запрос не найден</p>
				<UButton to="/requests/new" variant="outline">Вернуться к поиску</UButton>
			</div>
		</template>

	</UContainer>
</template>

<script lang="ts" setup>
import type { LaunchMailingResponse, RequestResponse, RequestSupplierResponse } from '#shared/types'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const { get, post, patch } = useApi()

const request = ref<RequestResponse | null>(null)
const suppliers = ref<RequestSupplierResponse[]>([])
const loading = ref(true)
const loadingSuppliers = ref(false)
const launching = ref(false)
const updatingToggle = ref(false)
const launchResult = ref<LaunchMailingResponse | null>(null)
const actionError = ref('')
const showParamsModal = ref(false)

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

async function fetchSuppliers() {
	if (!request.value) return
	loadingSuppliers.value = true
	try {
		suppliers.value = await get<RequestSupplierResponse[]>(`/requests/${id}/suppliers`)
	} catch {
		suppliers.value = []
	} finally {
		loadingSuppliers.value = false
	}
}

await fetchRequest()
if (request.value) await fetchSuppliers()

const enabledCount = computed(() => suppliers.value.filter(s => s.is_enabled).length)

type BadgeColor = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary'

const STATUS_COLOR: Record<string, BadgeColor> = { draft: 'neutral', active: 'success', queued: 'warning' }
const STATUS_LABEL: Record<string, string> = { draft: 'Черновик', active: 'Активный', queued: 'В очереди' }

const statusColor = computed<BadgeColor>(() => STATUS_COLOR[request.value?.status ?? ''] ?? 'neutral')
const statusLabel = computed(() => STATUS_LABEL[request.value?.status ?? ''] ?? request.value?.status ?? '')

const SUPPLIER_STATUS_COLOR: Record<string, BadgeColor> = {
	pending: 'neutral',
	sent: 'primary',
	replied: 'success',
	failed: 'error',
}
const SUPPLIER_STATUS_LABEL: Record<string, string> = {
	pending: 'Ожидает',
	sent: 'Отправлено',
	replied: 'Ответил',
	failed: 'Ошибка',
}

function supplierStatusColor(s: string): BadgeColor { return SUPPLIER_STATUS_COLOR[s] ?? 'neutral' }
function supplierStatusLabel(s: string): string { return SUPPLIER_STATUS_LABEL[s] ?? s }

const supplierColumns: TableColumn<RequestSupplierResponse>[] = [
	{ accessorKey: 'is_enabled', header: 'Рассылка' },
	{ accessorKey: 'company_name', header: 'Компания' },
	{ accessorKey: 'domain', header: 'Домен' },
	{ accessorKey: 'email', header: 'Email' },
	{ accessorKey: 'status', header: 'Статус' },
]

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function handleToggle(rs: RequestSupplierResponse, newVal: boolean) {
	const oldVal = rs.is_enabled
	rs.is_enabled = newVal
	updatingToggle.value = true
	actionError.value = ''
	try {
		await patch(`/requests/${id}/suppliers/${rs.id}`, { is_enabled: newVal })
	} catch (e: any) {
		rs.is_enabled = oldVal
		const detail = e?.response?.data?.detail
		actionError.value = typeof detail === 'string' ? detail : 'Не удалось изменить выбор поставщика'
	} finally {
		updatingToggle.value = false
	}
}

async function toggleAll(enabled: boolean) {
	if (request.value?.status === 'queued') return
	const toToggle = suppliers.value.filter(s => s.is_enabled !== enabled)
	updatingToggle.value = true
	actionError.value = ''
	try {
		await Promise.all(toToggle.map(s =>
			patch(`/requests/${id}/suppliers/${s.id}`, { is_enabled: enabled })
		))
		toToggle.forEach(s => s.is_enabled = enabled)
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		actionError.value = typeof detail === 'string' ? detail : 'Не удалось изменить выбор поставщиков'
	} finally {
		updatingToggle.value = false
	}
}

const selectAll = () => toggleAll(true)
const deselectAll = () => toggleAll(false)

function openParamsModal() { showParamsModal.value = true }

async function handleLaunchAfterParams(payload: any) {
	if (launching.value) return
	launching.value = true
	actionError.value = ''
	launchResult.value = null
	showParamsModal.value = false
	try {
		await patch(`/requests/${id}`, payload)
		const result = await post<LaunchMailingResponse>(`/requests/${id}/launch`)
		launchResult.value = result
		if (request.value) request.value.status = 'queued'
		await fetchSuppliers()
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		actionError.value = typeof detail === 'string' ? detail : 'Ошибка при запуске рассылки'
		showParamsModal.value = true
	} finally {
		launching.value = false
	}
}
</script>
