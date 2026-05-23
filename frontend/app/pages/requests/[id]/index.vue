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
					</div>
				</div>

				<UButton v-if="request.status === RequestStatus.QUEUED || request.status === RequestStatus.COMPLETED" variant="outline" color="neutral"
					leading-icon="i-lucide-inbox" :to="`/requests/${id}/responses`" class="shrink-0">
					Ответы поставщиков
				</UButton>
			</div>

			<UAlert v-if="actionError" color="error" variant="soft" icon="i-lucide-circle-alert"
				:description="actionError" class="mb-6" />

			<template v-if="suppliers.length || loadingSuppliers">

				<div class="flex items-start justify-between mb-4 gap-4 flex-wrap">
					<div>
						<h2 class="text-lg font-semibold">Найденные поставщики</h2>
						<p class="text-sm text-muted mt-0.5">Включите нужных и нажмите «Отправить запрос»</p>
					</div>
					<div class="flex items-center gap-4 shrink-0">
						<div class="flex gap-4">
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
				</div>

				<UAlert color="info" variant="soft" icon="i-lucide-info" class="mb-4"
					description="Отправляйте запросы только подходящим компаниям. Нерелевантные письма могут негативно влиять на репутацию вашей компании." />

				<UCard class="mb-4">
					<UTable :data="suppliers" :columns="supplierColumns" :loading="loadingSuppliers">
						<template #is_enabled-cell="{ row }">
							<USwitch :model-value="row.original.is_enabled" size="sm"
								:disabled="updatingToggle || request.status === RequestStatus.QUEUED"
								@update:model-value="(val: any) => handleToggle(row.original, Boolean(val))" />
						</template>

						<template #company_name-cell="{ row }">
							<div class="flex items-center gap-2">
								<div class="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center shrink-0">
									<UIcon name="i-lucide-building-2" class="w-3.5 h-3.5 text-muted" />
								</div>
								<span class="font-medium truncate max-w-50">{{ row.original.supplier?.company_name
								}}</span>
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
							<UBadge :color="getSupplierStatusColor(row.original.status)" variant="subtle" size="sm">
								{{ getSupplierStatusLabel(row.original.status) }}
							</UBadge>
						</template>
					</UTable>

					<div class="px-4 py-3 border-t border-default flex items-center justify-between gap-3 flex-wrap">
						<p class="text-sm text-muted">
							Выбрано <span class="font-semibold text-highlighted">{{ enabledCount }}</span> из {{
								suppliers.length }}
						</p>
						<div class="flex items-center gap-2">
							<UButton v-if="request.status !== 'queued'" size="sm" variant="outline" color="neutral"
								leading-icon="i-lucide-user-plus" @click="showAddSupplier = true">
								Добавить поставщика
							</UButton>

							<UButton size="xs" variant="ghost" color="neutral"
								:disabled="updatingToggle || request.status === RequestStatus.QUEUED || enabledCount === 0"
								@click="deselectAll">
								Снять все
							</UButton>
							<UButton size="xs" variant="ghost" color="primary"
								:disabled="updatingToggle || request.status === RequestStatus.QUEUED || enabledCount === suppliers.length"
								@click="selectAll">
								Выбрать все
							</UButton>
						</div>
					</div>
				</UCard>

				<div v-if="request.status !== RequestStatus.QUEUED" class="flex items-center gap-3">
					<UButton size="lg" leading-icon="i-lucide-send" :disabled="enabledCount === 0" :loading="launching"
						@click="showParamsModal = true">
						Отправить запрос поставщикам
					</UButton>
					<p v-if="enabledCount === 0" class="text-xs text-muted">Включите хотя бы одного поставщика</p>
				</div>

				<div v-if="request.status === RequestStatus.QUEUED" class="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
					<UIcon name="i-lucide-clock" class="w-5 h-5 text-warning shrink-0" />
					<div>
						<p class="text-sm font-medium">Рассылка в очереди</p>
						<p class="text-xs text-muted">Письма отправляются в фоновом режиме</p>
					</div>
					<UButton size="sm" variant="ghost" :to="`/requests/${id}/responses`" class="ml-auto"
						trailing-icon="i-lucide-arrow-right">
						Смотреть ответы
					</UButton>
				</div>

			</template>

			<template v-else>
				<div class="flex flex-col items-center justify-center py-20 gap-4">
					<div class="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center">
						<UIcon name="i-lucide-search-x" class="w-8 h-8 text-muted" />
					</div>
					<div class="text-center">
						<p class="font-medium text-highlighted">Поставщики не найдены</p>
						<p class="text-sm text-muted mt-1">Попробуйте изменить формулировку запроса или регион</p>
					</div>
					<UButton variant="outline" to="/requests">Новый поиск</UButton>
				</div>
			</template>

			<RequestParamsModal v-model:open="showParamsModal" :request="request" @launched="onLaunched" />
			<AddSupplierModal v-model:open="showAddSupplier" :request-id="id" @added="fetchSuppliers" />

		</template>

		<template v-else>
			<div class="flex flex-col items-center justify-center py-24 gap-3">
				<UIcon name="i-lucide-file-x" class="w-12 h-12 text-muted" />
				<p class="text-muted">Запрос не найден</p>
				<UButton to="/requests" variant="outline">Вернуться к поиску</UButton>
			</div>
		</template>

	</UContainer>
</template>

<script lang="ts" setup>
import {
	getRequestStatusColor,
	getRequestStatusLabel,
	getSupplierStatusColor,
	getSupplierStatusLabel,
	RequestStatus,
} from '#shared/types'
import type { TableColumn } from '@nuxt/ui'

const route = useRoute()
const id = route.params.id as string
const { get, patch } = useApi()

const request = ref<RequestResponse | null>(null)
const suppliers = ref<RequestSupplierResponse[]>([])
const loading = ref(true)
const loadingSuppliers = ref(false)
const launching = ref(false)
const updatingToggle = ref(false)
const actionError = ref('')
const showParamsModal = ref(false)
const showAddSupplier = ref(false)

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

	if (request.value?.status === RequestStatus.QUEUED) {
		await navigateTo(`/requests/${id}/responses`)
	}

if (request.value) await fetchSuppliers()

const enabledCount = computed(() => suppliers.value.filter(s => s.is_enabled).length)

const statusColor = computed(() => getRequestStatusColor(request.value?.status ?? ''))
const statusLabel = computed(() => getRequestStatusLabel(request.value?.status ?? ""))

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
		if (request.value?.status === RequestStatus.QUEUED) return
		const toToggle = suppliers.value.filter(s => s.is_enabled !== enabled)
	updatingToggle.value = true
	actionError.value = ''
	try {
		await Promise.all(toToggle.map(s => patch(`/requests/${id}/suppliers/${s.id}`, { is_enabled: enabled })))
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

	function onLaunched() {
		if (request.value) request.value.status = RequestStatus.QUEUED
	}
</script>
