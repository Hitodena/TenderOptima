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
					<UButton to="/requests" variant="ghost" color="neutral" size="sm" leading-icon="i-lucide-arrow-left"
						class="-ml-1 mb-2">
						К запросам
					</UButton>
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

				<UButton
					v-if="request.status === RequestStatus.QUEUED || request.status === RequestStatus.COMPLETED || request.status === RequestStatus.CLOSED"
					variant="outline" color="neutral" leading-icon="i-lucide-inbox" :to="`/requests/${id}/responses`"
					size="lg" class="shrink-0">
					Ответы поставщиков
				</UButton>
			</div>

			<UAlert v-if="actionError" color="error" variant="soft" icon="i-lucide-circle-alert"
				:description="actionError" class="mb-6" />

			<div class="flex items-start justify-between mb-4 gap-4 flex-wrap">
				<div>
					<h2 class="text-lg font-semibold">Найденные поставщики</h2>
					<p v-if="request.status !== RequestStatus.QUEUED && request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CLOSED && request.status !== RequestStatus.SEARCHING"
						class="text-sm text-muted mt-0.5">
						{{
							suppliers.length
								? 'Включите нужных и нажмите «Отправить запрос»'
								: 'Добавьте поставщиков для рассылки'
						}}
					</p>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					<UButton v-if="request.status == RequestStatus.DRAFT" size="lg" variant="outline" color="neutral"
						leading-icon="i-lucide-search" :loading="searching" @click="runSearch">
						Поиск поставщиков
					</UButton>

					<UButton v-if="!isTerminalStatus && suppliers.length > 0" size="lg" leading-icon="i-lucide-send"
						:disabled="enabledCount === 0" @click="showParamsModal = true">
						Отправить запрос поставщикам
					</UButton>

					<UButton
						v-if="request.status !== RequestStatus.QUEUED && request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CLOSED && request.status !== RequestStatus.SEARCHING"
						size="lg" variant="outline" color="neutral" leading-icon="i-lucide-user-plus"
						@click="showAddSupplier = true">
						Добавить поставщика
					</UButton>
				</div>
			</div>

			<div>
				<div v-if="request.status === RequestStatus.QUEUED"
					class="flex items-center gap-3 p-4 rounded-xl bg-warning/10">
					<UIcon name="i-lucide-clock" class="w-5 h-5 text-warning shrink-0" />
					<div>
						<p class="text-sm font-medium">Рассылка в очереди</p>
						<p class="text-xs text-muted">Письма отправляются в фоновом режиме</p>
					</div>
					<UButton size="sm" variant="ghost" :to="`/requests/${id}/responses`" class="ml-auto" color="warning"
						trailing-icon="i-lucide-arrow-right">
						Смотреть ответы
					</UButton>
				</div>
				<div v-else-if="request.status === RequestStatus.COMPLETED">
					<UAlert color="success" variant="soft" icon="i-lucide-check" class="mb-4"
						description="Рассылка завершена" />
				</div>
				<div v-else-if="request.status === RequestStatus.CLOSED">
					<UAlert color="neutral" variant="soft" icon="i-lucide-lock" class="mb-4"
						description="Запрос закрыт" />
				</div>
				<div v-else-if="request.status === RequestStatus.SEARCHING"
					class="flex items-center gap-3 p-4 rounded-xl bg-warning/10">
					<UIcon name="i-lucide-search" class="w-5 h-5 text-warning shrink-0" />
					<div>
						<p class="text-sm font-medium">Поиск поставщиков в процессе</p>
						<p class="text-xs text-muted">Это может занять до 5–10 минут. Обновите страницу, чтобы увидеть
							результаты.</p>
					</div>
				</div>
				<div v-else>
					<UAlert color="info" variant="soft" icon="i-lucide-info" class="mb-4"
						description="Отправляйте запросы только подходящим компаниям. Нерелевантные письма могут негативно влиять на репутацию вашей компании." />
				</div>
			</div>

			<UCard class="mb-4 mt-4">
				<UInput v-model="supplierSearch" placeholder="Поиск поставщиков..." icon="i-lucide-search"
					class="w-full sm:w-64 mb-3" size="lg" />

				<div class="border border-default rounded-md overflow-hidden">
					<div class="max-h-105 overflow-auto">
						<UTable :data="filteredSuppliers" :columns="supplierColumns" :loading="loadingSuppliers"
							:meta="{ class: { tr: getRowClass } }" @select="onRowSelect">
							<template #empty>
								<div v-if="request?.status !== RequestStatus.SEARCHING"
									class="flex flex-col items-center justify-center py-12 gap-3">
									<UIcon name="i-lucide-users" class="w-10 h-10 text-muted" />
									<p class="text-muted">Поставщики не найдены</p>
									<UButton size="sm" variant="outline" color="primary"
										leading-icon="i-lucide-user-plus" @click="showAddSupplier = true">
										Добавить поставщика
									</UButton>
								</div>
								<div v-else class="flex flex-col items-center justify-center py-12 gap-3">
									<UIcon name="i-lucide-search" class="w-10 h-10 text-warning" />
									<p class="text-muted">Поиск поставщиков в процессе...</p>
									<p class="text-xs text-muted">Может занять до 5–10 минут. Обновите страницу.</p>
								</div>
							</template>

							<template #is_enabled-cell="{ row }">
								<USwitch :model-value="row.original.is_enabled" size="sm"
									:disabled="updatingToggle || isTerminalStatus"
									@update:model-value="(val: any) => handleToggle(row.original, Boolean(val))" />
							</template>

							<template #company_name-cell="{ row }">
								<div class="flex items-center gap-2">
									<div
										class="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center shrink-0">
										<UIcon name="i-lucide-building-2" class="w-3.5 h-3.5 text-muted" />
									</div>
									<span class="font-medium truncate max-w-50">{{ row.original.supplier?.company_name
										}}</span>
								</div>
							</template>

							<template #domain-cell="{ row }">
								<a v-if="row.original.supplier?.domain"
									:href="`https://${row.original.supplier.domain}`" target="_blank"
									class="text-primary hover:underline text-sm" @click.stop>
									{{ row.original.supplier.domain }}
								</a>
								<span v-else class="text-sm text-muted">—</span>
							</template>

							<template #email-cell="{ row }">
								<div class="flex items-center gap-2 min-w-0">
									<a v-if="row.original.supplier.main_email" target="blank"
										:href="`mailto:${row.original.supplier.main_email}`"
										class="text-sm text-muted hover:text-primary hover:underline truncate max-w-48 block"
										:title="row.original.supplier.main_email" @click.stop>
										{{ row.original.supplier.main_email }}
									</a>
									<span v-else class="text-sm text-muted">—</span>

									<UButton v-if="!isTerminalStatus && row.original.supplier.extra_emails?.length > 1"
										size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil"
										@click.stop="openEditEmailModal(row.original.supplier)" />
								</div>
							</template>

							<template #status-cell="{ row }">
								<UBadge :color="getSupplierStatusColor(row.original.sent_status)" variant="subtle"
									size="sm">
									{{ getSupplierStatusLabel(row.original.sent_status) }}
								</UBadge>
							</template>

							<template #actions-cell="{ row }">
								<div v-if="!isTerminalStatus" class="flex items-center justify-end gap-1">
									<template v-if="confirmDeleteSupplierId === row.original.id">
										<UButton size="md" color="error" variant="soft" icon="i-lucide-check"
											:loading="deletingSupplierIds.has(row.original.id)"
											@click.stop="confirmDeleteSupplier(row.original.id)" />
										<UButton size="md" color="neutral" variant="ghost" icon="i-lucide-x"
											@click.stop="confirmDeleteSupplierId = null" />
									</template>
									<UButton v-else size="md" color="error" variant="ghost" icon="i-lucide-trash-2"
										:loading="deletingSupplierIds.has(row.original.id)"
										@click.stop="confirmDeleteSupplierId = row.original.id" />
								</div>
							</template>
						</UTable>
					</div>
				</div>

				<div v-if="!isTerminalStatus"
					class="px-4 py-3 border-t border-default flex items-center justify-between gap-3 flex-wrap">
					<p class="text-sm text-muted">
						Выбрано <span class="font-semibold text-highlighted">{{ enabledCount }}</span> из
						{{ filteredSuppliers.length }}
					</p>
					<div class="flex items-center gap-2">
						<UButton size="xs" variant="ghost" color="neutral"
							:disabled="updatingToggle || isTerminalStatus || enabledCount === 0" @click="deselectAll">
							Снять все
						</UButton>
						<UButton size="xs" variant="ghost" color="primary"
							:disabled="updatingToggle || isTerminalStatus || enabledCount === suppliers.length"
							@click="selectAll">
							Выбрать все
						</UButton>
					</div>
				</div>
			</UCard>

			<RequestParamsModal v-model:open="showParamsModal" :request="request" :supplier-count="enabledCount"
				@launched="onLaunched" />
			<AddSupplierModal v-model:open="showAddSupplier" :request-id="id" @added="fetchSuppliers" />
			<EditSupplierEmailModal v-model:open="showEditEmail" :supplier="emailSupplier" @saved="onEmailSaved" />

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
import type { RequestResponse, RequestSupplierResponse, Supplier } from '#shared/types'
import {
	getRequestStatusColor,
	getRequestStatusLabel,
	getSupplierStatusColor,
	getSupplierStatusLabel,
	RequestStatus,
	RequestSupplierStatus,
} from '#shared/types'
import type { TableColumn, TableRow } from '@nuxt/ui'

const route = useRoute()
const id = route.params.id as string
const { get, patch, post, del } = useApi()

const request = ref<RequestResponse | null>(null)
const suppliers = ref<RequestSupplierResponse[]>([])
const loading = ref(true)
const loadingSuppliers = ref(false)
const updatingToggle = ref(false)
const actionError = ref('')
const toast = useToast()
const showParamsModal = ref(false)
const showAddSupplier = ref(false)
const showEditEmail = ref(false)
const emailSupplier = ref<Supplier | null>(null)
const supplierSearch = ref('')
const confirmDeleteSupplierId = ref<string | null>(null)
const deletingSupplierIds = reactive(new Set<string>())

const isTerminalStatus = computed(() =>
	request.value?.status === RequestStatus.QUEUED ||
	request.value?.status === RequestStatus.COMPLETED ||
	request.value?.status === RequestStatus.CLOSED ||
	request.value?.status === RequestStatus.SEARCHING
)

const filteredSuppliers = computed(() => {
	if (!supplierSearch.value) return suppliers.value
	const q = supplierSearch.value.toLowerCase()
	return suppliers.value.filter(s =>
		s.supplier?.company_name?.toLowerCase().includes(q) ||
		s.supplier?.main_email?.toLowerCase().includes(q) ||
		s.supplier?.domain?.toLowerCase().includes(q)
	)
})


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
if (request.value) await fetchSuppliers()

const enabledCount = computed(() => suppliers.value.filter(s => s.is_enabled).length)
const statusColor = computed(() => getRequestStatusColor(request.value?.status ?? ''))
const statusLabel = computed(() => getRequestStatusLabel(request.value?.status ?? ''))

const supplierColumns = computed<TableColumn<RequestSupplierResponse>[]>(() => {
	const cols: TableColumn<RequestSupplierResponse>[] = []
	if (!isTerminalStatus.value) {
		cols.push({ accessorKey: 'is_enabled', header: 'Рассылка' })
	}
	cols.push({ accessorKey: 'company_name', header: 'Компания' })
	if (!isTerminalStatus.value) {
		cols.push({ accessorKey: 'domain', header: 'Домен' })
	}
	cols.push({ accessorKey: 'email', header: 'Email' })
	cols.push({ accessorKey: 'status', header: 'Статус' })
	cols.push({ id: 'actions', header: '' })
	return cols
})


function formatDate(iso: string) {
	const d = new Date(iso)
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
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

async function confirmDeleteSupplier(rsId: string) {
	confirmDeleteSupplierId.value = null
	deletingSupplierIds.add(rsId)
	actionError.value = ''
	try {
		await del(`/requests/${id}/suppliers/${rsId}`)
		suppliers.value = suppliers.value.filter(s => s.id !== rsId)
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		actionError.value = typeof detail === 'string' ? detail : 'Не удалось удалить поставщика'
	} finally {
		deletingSupplierIds.delete(rsId)
	}
}

async function toggleAll(enabled: boolean) {
	if (isTerminalStatus.value) return
	const toToggle = suppliers.value.filter(s => s.is_enabled !== enabled)
	updatingToggle.value = true
	actionError.value = ''
	try {
		await Promise.all(toToggle.map(s => patch(`/requests/${id}/suppliers/${s.id}`, { is_enabled: enabled })))
		toToggle.forEach(s => { s.is_enabled = enabled })
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		actionError.value = typeof detail === 'string' ? detail : 'Не удалось изменить выбор поставщиков'
	} finally {
		updatingToggle.value = false
	}
}

const selectAll = () => toggleAll(true)
const deselectAll = () => toggleAll(false)

const searching = ref(false)

async function runSearch() {
	if (searching.value || !request.value) return
	searching.value = true
	actionError.value = ''
	try {
		await post(`/requests/${id}/search`)
		if (request.value) request.value.status = RequestStatus.SEARCHING
		toast.add({
			title: 'Поиск в процессе',
			description: 'Запущен поиск поставщиков. Результаты появятся в запросе через некоторое время.',
			color: 'warning',
			icon: 'i-lucide-search',
		})
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		actionError.value = typeof detail === 'string' ? detail : 'Не удалось выполнить поиск поставщиков'
	} finally {
		searching.value = false
	}
}

function onLaunched() {
	if (request.value) request.value.status = RequestStatus.QUEUED
}

function getRowClass(row: TableRow<RequestSupplierResponse>) {
	return row.original.sent_status === RequestSupplierStatus.REPLIED
		? 'cursor-pointer hover:bg-elevated/50 transition-colors'
		: ''
}

function onRowSelect(e: Event, row: TableRow<RequestSupplierResponse>) {
	const rs = row.original
	if (rs.sent_status === RequestSupplierStatus.REPLIED) {
		navigateTo(`/requests/${id}/responses#${rs.id}`)
	}
}

function openEditEmailModal(supplier: Supplier) {
	emailSupplier.value = supplier
	showEditEmail.value = true
}

function onEmailSaved() {
	fetchSuppliers()
}
</script>
