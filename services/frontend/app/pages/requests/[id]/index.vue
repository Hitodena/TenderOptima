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
					<UButton
to="/requests/history" variant="ghost" color="neutral" size="sm"
						leading-icon="i-lucide-arrow-left" class="-ml-1 mb-2">
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
							{{ titleCaseWords(request.delivery_region) }}
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

			<UAlert
v-if="actionError" color="error" variant="soft" icon="i-lucide-circle-alert"
				:description="actionError" class="mb-6" />

			<UAlert
				v-if="module1BlockReason && !isLockedStatus"
				color="warning"
				variant="soft"
				icon="i-lucide-triangle-alert"
				class="mb-6"
			>
				<template #description>
					<div class="space-y-2">
						<p>{{ module1BlockReason }}</p>
						<NuxtLink
							:to="subscriptionPlansPath()"
							class="text-sm font-medium text-primary hover:underline underline-offset-2"
						>
							{{ t('subscription.upgradeCta') }}
						</NuxtLink>
					</div>
				</template>
			</UAlert>

			<div class="flex items-start justify-between mb-4 gap-4 flex-wrap">
				<div>
					<h2 class="text-lg font-semibold">Найденные поставщики</h2>
					<p
						v-if="supplierActionHint"
						class="text-sm text-muted mt-0.5">
						{{ supplierActionHint }}
					</p>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					<UButton
v-if="request.status == RequestStatus.DRAFT" size="lg" variant="outline" color="neutral"
						leading-icon="i-lucide-search" :loading="searching" :disabled="!canStartModule1"
						@click="runSearch">
						Поиск поставщиков
					</UButton>

					<UTooltip
						v-if="showSendButton"
						:text="sendButtonTooltip"
						:disabled="!sendButtonTooltip"
					>
						<span class="inline-flex">
							<UButton
								size="lg"
								leading-icon="i-lucide-send"
								:disabled="!canLaunchMailing"
								@click="showParamsModal = true">
								Отправить запрос поставщикам
							</UButton>
						</span>
					</UTooltip>

					<UButton
						v-if="canManageSuppliers"
						size="lg" variant="outline" color="neutral" leading-icon="i-lucide-user-plus"
						:disabled="!canStartModule1"
						@click="showAddSupplier = true">
						Добавить поставщика
					</UButton>

					<UButton
						v-if="canManageSuppliers && !isTestPlan(subscription)"
						size="lg" variant="outline" color="neutral" leading-icon="i-lucide-database"
						@click="showBookmarkModal = true">
						Из базы поставщиков
					</UButton>
				</div>
			</div>

			<div>
				<div
v-if="request.status === RequestStatus.QUEUED"
					class="flex items-center gap-3 p-4 rounded-xl bg-warning/10">
					<UIcon name="i-lucide-clock" class="w-5 h-5 text-warning shrink-0" />
					<div>
						<p class="text-sm font-medium">Рассылка в очереди</p>
						<p class="text-xs text-muted">Письма отправляются в фоновом режиме</p>
					</div>
					<UButton
size="sm" variant="ghost" :to="`/requests/${id}/responses`" class="ml-auto" color="warning"
						trailing-icon="i-lucide-arrow-right">
						Смотреть ответы
					</UButton>
				</div>
				<div v-else-if="request.status === RequestStatus.COMPLETED">
					<UAlert
						color="primary"
						variant="soft"
						icon="i-lucide-check"
						class="mb-4"
						:title="t('requests.mailingCompletedHint')"
						:description="t('requests.mailingCompletedSubhint')"
					/>
				</div>
				<div v-else-if="request.status === RequestStatus.CLOSED">
					<UAlert
color="neutral" variant="soft" icon="i-lucide-lock" class="mb-4"
						description="Запрос закрыт" />
				</div>
				<div v-else-if="request.status === RequestStatus.DRAFT || request.status === RequestStatus.ACTIVE">
					<UAlert
color="info" variant="soft" icon="i-lucide-info" class="mb-4"
						description="Отправляйте запросы только подходящим компаниям. Нерелевантные письма могут негативно влиять на репутацию вашей компании." />
				</div>
			</div>

			<UCard
				v-if="request.status === RequestStatus.SEARCHING || finalizing"
				class="mb-4 mt-4 shadow-sm"
			>
				<div class="flex flex-col items-center justify-center py-20 gap-4 text-muted">
					<UIcon name="i-lucide-loader" class="w-10 h-10 animate-spin text-warning" />
					<p class="text-sm font-medium text-center">Поиск поставщиков</p>
					<p class="text-xs text-center max-w-md">
						Ожидайте результатов до 2 минут. Страница обновится автоматически.
					</p>
				</div>
			</UCard>

		<UCard v-else class="mb-4 mt-4">
			<div class="flex items-center gap-2 mb-3 flex-wrap">
				<UInput
					v-model="supplierSearch"
					placeholder="Поиск поставщиков..."
					icon="i-lucide-search"
					class="flex-1 min-w-40 sm:max-w-64"
					size="lg"
				/>
				<template v-if="canManageMailingSelection">
					<UButton
						size="sm"
						variant="ghost"
						color="neutral"
						:disabled="updatingToggle || enabledCount === 0"
						@click="deselectAll"
					>
						Снять все
					</UButton>
					<UButton
						size="sm"
						variant="ghost"
						color="primary"
						:disabled="updatingToggle || !canSelectMoreSuppliers"
						@click="selectAll"
					>
						Выбрать все
					</UButton>
				</template>
			</div>

				<UAlert
					v-if="testPlanLockedCount > 0 && canManageMailingSelection"
					color="warning"
					variant="soft"
					icon="i-lucide-lock"
					class="mb-3"
					:description="testPlanLockedMessage"
				/>

				<div class="border border-default rounded-md overflow-hidden">
					<div class="max-h-105 overflow-auto">
						<UTable
:data="filteredSuppliers" :columns="supplierColumns" :loading="loadingSuppliers"
							:meta="{ class: { tr: getRowClass } }" @select="onRowSelect">
							<template #empty>
								<div class="flex flex-col items-center justify-center py-12 gap-3">
									<UIcon name="i-lucide-users" class="w-10 h-10 text-muted" />
									<p class="text-muted">Поставщики не найдены</p>
									<UButton
										v-if="canManageSuppliers"
										size="sm" variant="outline" color="primary"
										leading-icon="i-lucide-user-plus" @click="showAddSupplier = true">
										Добавить поставщика
									</UButton>
								</div>
							</template>

							<template #is_enabled-cell="{ row }">
								<USwitch
									:model-value="row.original.is_enabled"
									size="sm"
									:disabled="updatingToggle || !canToggleSupplier(row.original) || isSupplierRowLocked(row.original)"
									@update:model-value="(val: any) => handleToggle(row.original, Boolean(val))" />
							</template>

							<template #company_name-cell="{ row }">
								<div
									class="min-w-0 max-w-full py-0.5"
									:class="lockedRowContentClass(row.original)">
									<span
										class="supplier-company-title text-sm font-medium leading-snug break-words"
										:title="row.original.supplier?.company_name ?? undefined">
										{{ row.original.supplier?.company_name }}
									</span>
								</div>
							</template>

							<template #domain-cell="{ row }">
								<div :class="lockedRowContentClass(row.original)">
									<a
v-if="row.original.supplier?.domain"
										:href="toExternalUrl(row.original.supplier.domain)" target="_blank"
										class="text-primary hover:underline text-sm" @click.stop>
										{{ formatDomainLabel(row.original.supplier.domain) }}
									</a>
									<span v-else class="text-sm text-muted">—</span>
								</div>
							</template>

							<template #email-cell="{ row }">
								<div class="flex items-center gap-2 min-w-0" :class="lockedRowContentClass(row.original)">
									<a
v-if="row.original.supplier.main_email" target="blank"
										:href="`mailto:${row.original.supplier.main_email}`"
										class="text-sm text-muted hover:text-primary hover:underline truncate max-w-48 block"
										:title="row.original.supplier.main_email" @click.stop>
										{{ row.original.supplier.main_email }}
									</a>
									<span v-else class="text-sm text-muted">—</span>

									<UButton
										v-if="canManageSuppliers && row.original.supplier.extra_emails?.length > 1"
										size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil"
										@click.stop="openEditEmailModal(row.original.supplier)" />
								</div>
							</template>

							<template #status-cell="{ row }">
								<UBadge
:color="getSupplierStatusColor(row.original.sent_status)" variant="subtle"
									size="sm">
									{{ getSupplierStatusLabel(row.original.sent_status) }}
								</UBadge>
							</template>

							<template #actions-cell="{ row }">
								<div class="flex items-center justify-end gap-1 shrink-0 whitespace-nowrap">
									<UButton
										v-if="row.original.supplier"
										size="sm"
										color="neutral"
										variant="ghost"
										icon="i-lucide-database"
										:title="t('inbox.saveToDatabase')"
										:aria-label="t('inbox.saveToDatabase')"
										@click.stop="openSaveToBookmarkModal(row.original.supplier)"
									/>
									<template v-if="canDeleteSupplier(row.original)">
										<template v-if="confirmDeleteSupplierId === row.original.id">
											<UButton
size="sm" color="error" variant="soft" icon="i-lucide-check"
												:loading="deletingSupplierIds.has(row.original.id)"
												@click.stop="confirmDeleteSupplier(row.original.id)" />
											<UButton
size="sm" color="neutral" variant="ghost" icon="i-lucide-x"
												@click.stop="confirmDeleteSupplierId = null" />
										</template>
										<UButton
v-else size="sm" color="error" variant="ghost" icon="i-lucide-trash-2"
											:loading="deletingSupplierIds.has(row.original.id)"
											@click.stop="confirmDeleteSupplierId = row.original.id" />
									</template>
								</div>
							</template>
						</UTable>
					</div>
				</div>

			<div
				v-if="canManageMailingSelection"
				class="px-4 py-3 border-t border-default">
				<p class="text-sm text-muted">
					<template v-if="isCompletedStatus">
						К отправке
						<span class="font-semibold text-highlighted">{{ pendingEnabledCount }}</span>
						из {{ filteredSuppliers.length }}
					</template>
					<template v-else>
						Выбрано
						<span class="font-semibold text-highlighted">{{ enabledCount }}</span>
						из {{ filteredSuppliers.length }}
					</template>
					<template v-if="emailQuotaFooter">
						<span> · {{ emailQuotaFooter }}</span>
					</template>
				</p>
			</div>
			</UCard>

			<RequestParamsModal
				v-model:open="showParamsModal"
				:request="request"
				:supplier-count="pendingEnabledCount"
				:subscription="subscription"
				@launched="onLaunched"
			/>
			<AddSupplierModal
				v-model:open="showAddSupplier"
				:request-id="id"
				:subscription="subscription"
				:manual-supplier-count="manualSupplierCount"
				@added="fetchSuppliersAndEnforceQuota"
			/>
			<EditSupplierEmailModal v-model:open="showEditEmail" :supplier="emailSupplier" @saved="onEmailSaved" />
			<SupplierBookmarkModal v-model:open="showBookmarkModal" :request-id="id" @added="fetchSuppliersAndEnforceQuota" />
			<AddSupplierModal
				v-model:open="showSaveToBookmarkModal"
				:source-supplier="saveToBookmarkSupplier"
			/>

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
import type { RequestSupplierResponse, SubscriptionResponse, Supplier, UserResponse } from '#shared/types'
import {
	getRequestStatusColor,
	getRequestStatusLabel,
	getSupplierStatusColor,
	getSupplierStatusLabel,
	RequestStatus,
	RequestSupplierStatus,
} from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { titleCaseWords } from '#shared/utils/textFormat'
import {
	canSendEmail,
	canStartModule1Work,
	effectiveEmailLimit,
	emailQuotaBlockMessage,
	emailQuotaRemaining,
	isManualSupplierSource,
	isTestPlan,
	module1WorkBlockMessage,
	testPlanLockedSuppliersMessage,
	testPlanMaxSelectableSuppliers,
	testPlanVisibleSupplierLimit,
	TEST_PLAN_MANUAL_SUPPLIER_BONUS,
} from '#shared/utils/subscriptionAccess'
import { subscriptionPlansPath } from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'
import type { TableColumn, TableRow } from '@nuxt/ui'
import SupplierBookmarkModal from '~/components/SupplierBookmarkModal.vue'

const route = useRoute()
const id = route.params.id as string
const { get, post } = useApi()
const toast = useToast()
const { formatDate } = useFormatDate()

const subscription = ref<SubscriptionResponse | null>(null)

const canStartModule1 = computed(() => canStartModule1Work(subscription.value))
const module1BlockReason = computed(() => module1WorkBlockMessage(subscription.value))

const {
	request,
	suppliers,
	loading,
	loadingSuppliers,
	updatingToggle,
	suppressToggleEvents,
	actionError,
	fetchRequest,
	fetchSuppliers,
	updateSuppliersEnabled,
	removeSupplier,
} = useRequestDetail(id)

const { finalizing } = useSearchPolling(
	id,
	request,
	suppliers,
	() => fetchSuppliersAndEnforceQuota(),
)

const showParamsModal = ref(false)
const showAddSupplier = ref(false)
const showEditEmail = ref(false)
const showBookmarkModal = ref(false)
const showSaveToBookmarkModal = ref(false)
const saveToBookmarkSupplier = ref<Supplier | null>(null)
const emailSupplier = ref<Supplier | null>(null)
const supplierSearch = ref('')
const confirmDeleteSupplierId = ref<string | null>(null)
const deletingSupplierIds = reactive(new Set<string>())

const isLockedStatus = computed(() =>
	request.value?.status === RequestStatus.QUEUED ||
	request.value?.status === RequestStatus.CLOSED ||
	request.value?.status === RequestStatus.SEARCHING,
)

const isCompletedStatus = computed(() =>
	request.value?.status === RequestStatus.COMPLETED,
)

const canManageSuppliers = computed(() => !isLockedStatus.value)

const canManageMailingSelection = computed(() =>
	canManageSuppliers.value || isCompletedStatus.value,
)

function isPendingSupplier(rs: RequestSupplierResponse): boolean {
	return rs.sent_status === RequestSupplierStatus.PENDING
}

function canToggleSupplier(rs: RequestSupplierResponse): boolean {
	if (isLockedStatus.value) return false
	if (isCompletedStatus.value) return isPendingSupplier(rs)
	return true
}

function canDeleteSupplier(rs: RequestSupplierResponse): boolean {
	if (isLockedStatus.value) return false
	if (isCompletedStatus.value) return isPendingSupplier(rs)
	return true
}

const supplierActionHint = computed(() => {
	if (isLockedStatus.value) return null
	if (isCompletedStatus.value) {
		return pendingEnabledCount.value > 0
			? t('requests.mailingPendingHint')
			: t('requests.mailingCompletedSubhint')
	}
	return suppliers.value.length
		? 'Включите нужных и нажмите «Отправить запрос»'
		: 'Добавьте поставщиков для рассылки'
})

const pendingEnabledCount = computed(() =>
	suppliers.value.filter(s => s.is_enabled && isPendingSupplier(s)).length,
)

const showSendButton = computed(() => {
	if (isLockedStatus.value || suppliers.value.length === 0) return false
	return true
})

const sendButtonTooltip = computed(() => {
	if (pendingEnabledCount.value > 0) return ''
	return 'Выберите хотя бы одного поставщика для отправки'
})

const filteredSuppliers = computed(() => {
	if (!supplierSearch.value) return suppliers.value
	const q = supplierSearch.value.toLowerCase()
	return suppliers.value.filter(s =>
		s.supplier?.company_name?.toLowerCase().includes(q) ||
		s.supplier?.main_email?.toLowerCase().includes(q) ||
		s.supplier?.domain?.toLowerCase().includes(q)
	)
})

const enabledCount = computed(() => suppliers.value.filter(s => s.is_enabled).length)
const emailRemaining = computed(() => emailQuotaRemaining(subscription.value))
const canLaunchMailing = computed(() =>
	pendingEnabledCount.value > 0
		&& canSendEmail(subscription.value, pendingEnabledCount.value),
)
const manualSupplierCount = computed(() =>
	suppliers.value.filter((s) => isManualSupplierSource(s.supplier?.from_source)).length,
)

const testPlanSelectableLimit = computed(() =>
	testPlanMaxSelectableSuppliers(subscription.value, manualSupplierCount.value),
)

const canSelectMoreSuppliers = computed(() => {
	if (emailRemaining.value === 0) return false
	const hasUnlockable = filteredSuppliers.value.some(
		(s) => !s.is_enabled && !isSupplierRowLocked(s),
	)
	if (!hasUnlockable) return false
	if (emailRemaining.value != null && enabledCount.value >= emailRemaining.value) {
		return false
	}
	const selectableLimit = testPlanSelectableLimit.value
	if (selectableLimit != null && enabledCount.value >= selectableLimit) {
		return false
	}
	return true
})
const emailQuotaFooter = computed(() => {
	const sub = subscription.value
	const limit = effectiveEmailLimit(sub)
	if (limit == null) return null
	const remaining = emailRemaining.value
	if (remaining == null) return null
	return `можно отправить ещё ${remaining.toLocaleString('ru-RU')} из ${limit.toLocaleString('ru-RU')} в этом месяце`
})
const testPlanLockedCount = computed(() => {
	const searchLimit = testPlanVisibleSupplierLimit(subscription.value)
	if (searchLimit == null) return 0
	const nonManual = filteredSuppliers.value.filter(
		(s) => !isManualSupplierSource(s.supplier?.from_source),
	)
	const searchLocked = Math.max(0, nonManual.length - searchLimit)
	const manuals = filteredSuppliers.value.filter((s) =>
		isManualSupplierSource(s.supplier?.from_source),
	)
	const manualLocked = Math.max(0, manuals.length - TEST_PLAN_MANUAL_SUPPLIER_BONUS)
	return searchLocked + manualLocked
})
const testPlanLockedMessage = computed(() =>
	testPlanLockedSuppliersMessage(subscription.value, testPlanLockedCount.value),
)
const statusColor = computed(() => getRequestStatusColor(request.value?.status ?? ''))
const statusLabel = computed(() => getRequestStatusLabel(request.value?.status ?? ''))

const supplierColumns = computed<TableColumn<RequestSupplierResponse>[]>(() => {
	const cols: TableColumn<RequestSupplierResponse>[] = []
	if (canManageMailingSelection.value) {
		cols.push({
			accessorKey: 'is_enabled',
			header: 'Рассылка',
			meta: {
				class: {
					th: 'w-20 min-w-20 max-w-24 text-center px-2',
					td: 'w-20 min-w-20 max-w-24 text-center px-2',
				},
			},
		})
	}
	cols.push({
		accessorKey: 'company_name',
		header: 'Компания',
		meta: {
			class: {
				th: 'min-w-80 sm:min-w-96 lg:min-w-[28rem] max-w-[28rem]',
				td: 'min-w-80 sm:min-w-96 lg:min-w-[28rem] max-w-[28rem] whitespace-normal align-top',
			},
		},
	})
	if (canManageSuppliers.value) {
		cols.push({ accessorKey: 'domain', header: 'Домен' })
	}
	cols.push({ accessorKey: 'email', header: 'Email' })
	cols.push({ accessorKey: 'status', header: 'Статус' })
	cols.push({
		id: 'actions',
		header: '',
		meta: {
			class: {
				th: 'sticky right-0 z-10 bg-default w-20 min-w-20',
				td: 'sticky right-0 z-10 bg-default w-20 min-w-20',
			},
		},
	})
	return cols
})

onMounted(async () => {
	await Promise.all([fetchRequest(), fetchSubscription()])
	if (route.query.searching === '1' && request.value?.status === RequestStatus.DRAFT) {
		request.value.status = RequestStatus.SEARCHING
	}
	if (request.value) await fetchSuppliersAndEnforceQuota()
})

async function fetchSuppliersAndEnforceQuota(silent = false) {
	await fetchSuppliers(silent)
	await trimEnabledToQuota()
}

async function trimEnabledToQuota() {
	if (isLockedStatus.value) return

	let maxEnabled = emailRemaining.value
	if (maxEnabled == null) return

	const selectableLimit = testPlanSelectableLimit.value
	if (selectableLimit != null) {
		maxEnabled = Math.min(maxEnabled, selectableLimit)
	}

	let keptSearch = 0
	let keptManual = 0
	const searchLimit = testPlanVisibleSupplierLimit(subscription.value)
	const toDisable: string[] = []

	for (const s of suppliers.value) {
		if (!s.is_enabled) continue
		if (isManualSupplierSource(s.supplier?.from_source)) {
			if (keptManual < 1) {
				keptManual++
				continue
			}
			toDisable.push(s.id)
			continue
		}
		if (searchLimit != null && keptSearch >= searchLimit) {
			toDisable.push(s.id)
			continue
		}
		if (keptSearch + keptManual >= maxEnabled) {
			toDisable.push(s.id)
			continue
		}
		keptSearch++
	}

	if (toDisable.length > 0) {
		await updateSuppliersEnabled(toDisable, false)
	}
}

async function fetchSubscription() {
	try {
		const user = await get<UserResponse>('/auth/me')
		subscription.value = user.subscription ?? null
	} catch {
		subscription.value = null
	}
}

function isSupplierRowLocked(rs: RequestSupplierResponse): boolean {
	const searchLimit = testPlanVisibleSupplierLimit(subscription.value)
	if (searchLimit == null) return false

	if (isManualSupplierSource(rs.supplier?.from_source)) {
		const firstManual = filteredSuppliers.value.find((s) =>
			isManualSupplierSource(s.supplier?.from_source),
		)
		return firstManual?.id !== rs.id
	}

	const nonManual = filteredSuppliers.value.filter(
		(s) => !isManualSupplierSource(s.supplier?.from_source),
	)
	const indexInSearch = nonManual.findIndex((s) => s.id === rs.id)
	return indexInSearch < 0 || indexInSearch >= searchLimit
}

async function handleToggle(
	rs: RequestSupplierResponse,
	newVal: boolean,
) {
	if (suppressToggleEvents.value || rs.is_enabled === newVal || !canToggleSupplier(rs)) return

	if (newVal) {
		if (isSupplierRowLocked(rs)) {
			toast.add({
				title: testPlanLockedMessage.value || 'Поставщик недоступен на тестовом тарифе',
				color: 'warning',
			})
			return
		}
		const selectableLimit = testPlanSelectableLimit.value
		if (
			selectableLimit != null
			&& enabledCount.value >= selectableLimit
			&& !isManualSupplierSource(rs.supplier?.from_source)
		) {
			toast.add({
				title: testPlanLockedMessage.value || 'Достигнут лимит выбора на тестовом тарифе',
				color: 'warning',
			})
			return
		}
		if (!canSendEmail(subscription.value, enabledCount.value + 1)) {
			const msg = emailQuotaBlockMessage(subscription.value, 1)
			if (msg) {
				toast.add({ title: msg, color: 'warning' })
			}
			return
		}
	}

	await updateSuppliersEnabled([rs.id], newVal)
}

async function confirmDeleteSupplier(rsId: string) {
	confirmDeleteSupplierId.value = null
	deletingSupplierIds.add(rsId)
	try {
		await removeSupplier(rsId)
	} finally {
		deletingSupplierIds.delete(rsId)
	}
}

async function toggleAll(enabled: boolean) {
	if (!canManageMailingSelection.value) return
	if (!enabled) {
		const ids = suppliers.value
			.filter(s => s.is_enabled && canToggleSupplier(s))
			.map(s => s.id)
		if (ids.length) await updateSuppliersEnabled(ids, false)
		return
	}

	const remaining = emailRemaining.value
	const searchLimit = testPlanVisibleSupplierLimit(subscription.value)
	const selectableLimit = testPlanSelectableLimit.value
	let candidates = filteredSuppliers.value.filter(
		(s) => !s.is_enabled && !isSupplierRowLocked(s) && canToggleSupplier(s),
	)
	if (searchLimit != null) {
		const enabledSearch = suppliers.value.filter(
			(s) => s.is_enabled && !isManualSupplierSource(s.supplier?.from_source),
		).length
		const searchSlots = Math.max(0, searchLimit - enabledSearch)
		const searchCandidates = candidates.filter((s) =>
			!isManualSupplierSource(s.supplier?.from_source),
		).slice(0, searchSlots)
		const manualCandidates = candidates.filter((s) =>
			isManualSupplierSource(s.supplier?.from_source),
		).slice(0, Math.max(0, (selectableLimit ?? searchLimit) - searchLimit))
		candidates = [...searchCandidates, ...manualCandidates]
	}
	if (remaining != null) {
		const slots = Math.max(0, remaining - enabledCount.value)
		candidates = candidates.slice(0, slots)
	}
	if (candidates.length === 0) {
		const msg = emailQuotaBlockMessage(subscription.value, 1)
		if (msg) toast.add({ title: msg, color: 'warning' })
		return
	}
	await updateSuppliersEnabled(candidates.map(s => s.id), true)
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
	} catch (e: unknown) {
		actionError.value = getApiErrorDetail(e) ?? 'Не удалось выполнить поиск поставщиков'
	} finally {
		searching.value = false
	}
}

function onLaunched() {
	if (request.value) request.value.status = RequestStatus.QUEUED
}

function getRowClass(row: TableRow<RequestSupplierResponse>) {
	const classes: string[] = []
	if (row.original.sent_status === RequestSupplierStatus.REPLIED) {
		classes.push('cursor-pointer hover:bg-elevated/50 transition-colors')
	}
	return classes.join(' ')
}

function lockedRowContentClass(rs: RequestSupplierResponse): string {
	return isSupplierRowLocked(rs) ? 'blur-[2px] opacity-60 select-none' : ''
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

function openSaveToBookmarkModal(supplier: Supplier) {
	saveToBookmarkSupplier.value = supplier
	showSaveToBookmarkModal.value = true
}

function onEmailSaved() {
	fetchSuppliersAndEnforceQuota()
}
</script>

<style scoped>
.supplier-company-title {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
	white-space: normal;
}
</style>
