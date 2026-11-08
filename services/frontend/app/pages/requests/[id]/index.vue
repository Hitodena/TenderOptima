<template>
	<UContainer class="py-4 sm:py-8" :class="mobileBarVisible ? 'pb-28 sm:pb-8' : ''">

		<template v-if="loading">
			<div class="space-y-4">
				<USkeleton class="h-10 w-72" />
				<USkeleton class="h-6 w-48" />
				<USkeleton class="h-64 w-full" />
			</div>
		</template>

		<template v-else-if="request">

			<div class="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
				<div class="min-w-0">
					<UButton
to="/requests/history" variant="ghost" color="neutral" size="sm"
						leading-icon="i-lucide-arrow-left" class="-ml-1 mb-2">
						К запросам
					</UButton>
					<div class="flex items-center gap-x-3 gap-y-1.5 mb-1 flex-wrap">
						<h1 class="text-xl font-bold leading-tight text-highlighted break-words sm:text-2xl sm:truncate">{{ request.query }}</h1>
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
					size="lg" class="shrink-0 justify-center max-sm:min-h-12">
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
						class="text-sm text-muted mt-0.5"
						:class="isCompletedStatus ? 'hidden sm:block' : ''">
						{{ supplierActionHint }}
					</p>
				</div>

				<div class="hidden items-center gap-2 shrink-0 sm:flex">
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
								@click="openMailing">
								Сформировать запрос поставщикам
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

				<!-- phones: one card per supplier instead of a five-column table -->
				<div class="sm:hidden" data-tour="suppliers" :data-ready="String(!loadingSuppliers)">
					<div v-if="loadingSuppliers" class="space-y-2">
						<USkeleton v-for="i in 4" :key="i" class="h-16 w-full rounded-xl" />
					</div>
					<div v-else-if="!filteredSuppliers.length" class="flex flex-col items-center justify-center gap-3 py-10">
						<UIcon name="i-lucide-users" class="w-10 h-10 text-muted" />
						<p class="text-muted">Поставщики не найдены</p>
					</div>
					<ul v-else class="-mx-4 divide-y divide-default/70 border-y border-default/70">
						<li
							v-for="rs in filteredSuppliers"
							:key="rs.id"
							class="flex items-center gap-2 px-4 py-2.5"
						>
							<button
								type="button"
								class="min-w-0 flex-1 text-left"
								:class="lockedRowContentClass(rs)"
								:disabled="rs.sent_status !== RequestSupplierStatus.REPLIED"
								@click="openSupplierThread(rs)"
							>
								<span class="supplier-company-title block text-[15px] font-semibold leading-snug">
									{{ rs.supplier?.company_name }}
								</span>
								<span class="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
									<span class="size-2 shrink-0 rounded-full" :class="statusDotClass(rs.sent_status)" />
									<span class="shrink-0">{{ getSupplierStatusLabel(rs.sent_status) }}</span>
									<span v-if="rs.supplier?.main_email" class="truncate">· {{ rs.supplier.main_email }}</span>
								</span>
							</button>
							<UDropdownMenu
								v-if="supplierCardMenu(rs).length"
								:items="supplierCardMenu(rs)"
							>
								<UButton
									color="neutral"
									variant="ghost"
									icon="i-lucide-ellipsis-vertical"
									size="lg"
									aria-label="Действия с поставщиком"
									:loading="deletingSupplierIds.has(rs.id)"
								/>
							</UDropdownMenu>
							<USwitch
								v-if="canManageMailingSelection"
								:model-value="rs.is_enabled"
								:disabled="updatingToggle || !canToggleSupplier(rs) || isSupplierRowLocked(rs)"
								:aria-label="`Включить в рассылку: ${rs.supplier?.company_name}`"
								@update:model-value="(val: any) => handleToggle(rs, Boolean(val))"
							/>
						</li>
					</ul>
				</div>

				<div class="hidden border border-default rounded-md overflow-hidden sm:block" data-tour="suppliers" :data-ready="String(!loadingSuppliers)">
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
									<template v-if="row.original.supplier?.domain">
										<span
											v-if="isSupplierRowLocked(row.original)"
											class="text-sm text-muted"
										>
											{{ formatDomainLabel(row.original.supplier.domain) }}
										</span>
										<a
											v-else
											:href="toExternalUrl(row.original.supplier.domain)"
											target="_blank"
											class="text-primary hover:underline text-sm"
											@click.stop
										>
											{{ formatDomainLabel(row.original.supplier.domain) }}
										</a>
									</template>
									<span v-else class="text-sm text-muted">—</span>
								</div>
							</template>

							<template #email-cell="{ row }">
								<div class="flex items-center gap-2 min-w-0" :class="lockedRowContentClass(row.original)">
									<template v-if="row.original.supplier.main_email">
										<span
											v-if="isSupplierRowLocked(row.original)"
											class="text-sm text-muted truncate max-w-48 block"
											:title="row.original.supplier.main_email"
										>
											{{ row.original.supplier.main_email }}
										</span>
										<a
											v-else
											target="blank"
											:href="`mailto:${row.original.supplier.main_email}`"
											class="text-sm text-muted hover:text-primary hover:underline truncate max-w-48 block"
											:title="row.original.supplier.main_email"
											@click.stop
										>
											{{ row.original.supplier.main_email }}
										</a>
									</template>
									<span v-else class="text-sm text-muted">—</span>

									<UButton
										v-if="canManageSuppliers && !isSupplierRowLocked(row.original) && row.original.supplier.extra_emails?.length > 1"
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
										v-if="row.original.supplier && !isSupplierRowLocked(row.original)"
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

			<!-- phones: the main action is always at hand -->
			<div
				v-if="mobileBarVisible"
				class="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2.5 border-t border-default bg-default/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
			>
				<UDropdownMenu v-if="canManageSuppliers" :items="addSupplierMenu">
					<UButton
						color="neutral"
						variant="outline"
						icon="i-lucide-user-plus"
						size="xl"
						class="size-13 justify-center rounded-xl"
						aria-label="Добавить поставщика"
						:disabled="!canStartModule1"
					/>
				</UDropdownMenu>
				<UButton
					v-if="request.status == RequestStatus.DRAFT"
					size="xl"
					leading-icon="i-lucide-search"
					block
					class="min-h-13 flex-1 justify-center rounded-xl"
					:loading="searching"
					:disabled="!canStartModule1"
					@click="runSearch"
				>
					Найти поставщиков
				</UButton>
				<UButton
					v-else-if="showSendButton"
					size="xl"
					leading-icon="i-lucide-send"
					block
					class="min-h-13 flex-1 justify-center rounded-xl"
					:disabled="!canLaunchMailing"
					@click="openMailing"
				>
					Отправить запрос{{ pendingEnabledCount ? ` · ${pendingEnabledCount}` : '' }}
				</UButton>
			</div>

			<RequestParamsModal
				v-model:open="showParamsModal"
				:request="request"
				:supplier-count="pendingEnabledCount"
				:subscription="subscription"
				:is-first-request="Boolean(request.is_first_request)"
				@launched="onLaunched"
			/>
			<AddSupplierModal
				v-model:open="showAddSupplier"
				:request-id="id"
				:subscription="subscription"
				:manual-supplier-count="manualSupplierCount"
				:existing-emails="requestSupplierEmails"
				@added="fetchSuppliersAndEnforceQuota"
			/>
			<EditSupplierEmailModal v-model:open="showEditEmail" :supplier="emailSupplier" @saved="onEmailSaved" />
			<SupplierBookmarkModal v-model:open="showBookmarkModal" :request-id="id" @added="fetchSuppliersAndEnforceQuota" />
			<AddSupplierModal
				v-model:open="showSaveToBookmarkModal"
				:source-supplier="saveToBookmarkSupplier"
			/>
			<BusinessCardHintModal v-model:open="showBusinessCardHint" />

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
	canStartTrial,
	mailingBlockMessage,
	mailingNeedsTrial,
	module1WorkBlockMessage,
	testPlanLockedSuppliersMessage,
	testPlanMaxSelectableSuppliers,
	testPlanVisibleSupplierLimit,
	TEST_PLAN_MANUAL_SUPPLIER_BONUS,
} from '#shared/utils/subscriptionAccess'
import { subscriptionPlansPath } from '#shared/utils/subscriptionDisplay'
import { isPendingRequestSupplier, supplierIdsOverQuota } from '#shared/utils/supplierQuota'
import { t } from '~/constants/translations'
import type { TableColumn, TableRow } from '@nuxt/ui'
import SupplierBookmarkModal from '~/components/SupplierBookmarkModal.vue'
import BusinessCardHintModal from '~/components/BusinessCardHintModal.vue'

const route = useRoute()
const id = route.params.id as string
const { get, post } = useApi()
const toast = useToast()
const { formatDate } = useFormatDate()
const { hasSeen: businessCardHintSeen, markSeen: markBusinessCardHintSeen } = useBusinessCardHint()

const subscription = ref<SubscriptionResponse | null>(null)
const showBusinessCardHint = ref(false)
const businessCardHintChecked = ref(false)

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

const isPendingSupplier = isPendingRequestSupplier

// A supplier that already got the letter keeps its thread: never toggled or removed.
function canToggleSupplier(rs: RequestSupplierResponse): boolean {
	if (isLockedStatus.value) return false
	return isPendingSupplier(rs)
}

function canDeleteSupplier(rs: RequestSupplierResponse): boolean {
	if (isLockedStatus.value) return false
	return isPendingSupplier(rs)
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
	if (pendingEnabledCount.value === 0) return 'Выберите хотя бы одного поставщика для отправки'
	if (mailingNeedsTrial(subscription.value) && !canStartTrial(subscription.value)) {
		return mailingBlockMessage(subscription.value, pendingEnabledCount.value) ?? ''
	}
	return ''
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
		&& canSendEmail(subscription.value, pendingEnabledCount.value)
		// the test plan sends during the trial; before it the button offers the trial
		&& (!mailingNeedsTrial(subscription.value) || canStartTrial(subscription.value)),
)

const tour = useOnboardingTour()

function openMailing() {
	if (mailingNeedsTrial(subscription.value) && canStartTrial(subscription.value)) {
		tour.offerTrial(id)
		return
	}
	showParamsModal.value = true
}

// first finished search of a new account: walk through the onboarding tour
watch(
	() => [request.value?.status, loadingSuppliers.value, suppliers.value.length, subscription.value?.trial_state] as const,
	([status, busy, count]) => {
		if (busy || !count || !request.value || request.value.is_demo) return
		if (status !== RequestStatus.ACTIVE && status !== RequestStatus.COMPLETED) return
		if (!canStartTrial(subscription.value)) return
		tour.start(id)
	},
)
const manualSupplierCount = computed(() =>
	suppliers.value.filter((s) => isManualSupplierSource(s.supplier?.from_source)).length,
)
const requestSupplierEmails = computed(() =>
	suppliers.value
		.map((s) => s.supplier?.main_email || s.sent_to_email || '')
		.filter(Boolean),
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
	if (emailRemaining.value != null && pendingEnabledCount.value >= emailRemaining.value) {
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

async function maybeShowBusinessCardHint() {
	if (businessCardHintChecked.value || businessCardHintSeen.value) return
	if (!request.value?.is_first_request) return
	// ACTIVE = first supplier search finished (COMPLETED means mailing done).
	if (request.value.status !== RequestStatus.ACTIVE) return

	businessCardHintChecked.value = true
	try {
		const user = await get<UserResponse>('/auth/me')
		if (user.business_info?.trim()) {
			markBusinessCardHintSeen()
			return
		}
		showBusinessCardHint.value = true
	} catch {
		// Ignore — hint is optional onboarding UX.
	}
}

watch(
	() => [request.value?.status, request.value?.is_first_request] as const,
	() => { void maybeShowBusinessCardHint() },
	{ immediate: true },
)

async function fetchSuppliersAndEnforceQuota(silent = false) {
	await fetchSuppliers(silent)
	await trimEnabledToQuota()
}

async function trimEnabledToQuota() {
	if (isLockedStatus.value) return

	const trial = isTestPlan(subscription.value)
	const toDisable = supplierIdsOverQuota(suppliers.value, {
		emailRemaining: emailRemaining.value,
		searchLimit: trial ? testPlanVisibleSupplierLimit(subscription.value) : null,
		selectableLimit: trial ? testPlanSelectableLimit.value : null,
		manualLimit: trial ? TEST_PLAN_MANUAL_SUPPLIER_BONUS : null,
	})

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
		if (!canSendEmail(subscription.value, pendingEnabledCount.value + 1)) {
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
		const slots = Math.max(0, remaining - pendingEnabledCount.value)
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
	return isSupplierRowLocked(rs)
		? 'blur-[2px] opacity-60 select-none pointer-events-none'
		: ''
}

const mobileBarVisible = computed(() =>
	Boolean(request.value)
	&& !isLockedStatus.value
	&& (request.value?.status === RequestStatus.DRAFT || showSendButton.value || canManageSuppliers.value),
)

const addSupplierMenu = computed(() => {
	const items = [{
		label: 'Добавить вручную',
		icon: 'i-lucide-user-plus',
		onSelect: () => { showAddSupplier.value = true },
	}]
	if (!isTestPlan(subscription.value)) {
		items.push({
			label: 'Из базы поставщиков',
			icon: 'i-lucide-database',
			onSelect: () => { showBookmarkModal.value = true },
		})
	}
	return [items]
})

function statusDotClass(status: RequestSupplierStatus): string {
	switch (status) {
		case RequestSupplierStatus.REPLIED: return 'bg-success'
		case RequestSupplierStatus.FAILED: return 'bg-error'
		case RequestSupplierStatus.SENT: return 'bg-info'
		default: return 'bg-(--ui-text-dimmed)'
	}
}

function supplierCardMenu(rs: RequestSupplierResponse) {
	const items: { label: string, icon: string, color?: 'error', onSelect: () => void }[] = []
	if (rs.sent_status === RequestSupplierStatus.REPLIED) {
		items.push({ label: 'Открыть переписку', icon: 'i-lucide-messages-square', onSelect: () => openSupplierThread(rs) })
	}
	if (rs.supplier && !isSupplierRowLocked(rs)) {
		items.push({ label: t('inbox.saveToDatabase'), icon: 'i-lucide-database', onSelect: () => openSaveToBookmarkModal(rs.supplier) })
		if (canManageSuppliers.value && (rs.supplier.extra_emails?.length ?? 0) > 1) {
			items.push({ label: 'Сменить адрес', icon: 'i-lucide-pencil', onSelect: () => openEditEmailModal(rs.supplier) })
		}
	}
	if (canDeleteSupplier(rs)) {
		items.push({ label: 'Убрать из списка', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => confirmDeleteSupplier(rs.id) })
	}
	return items.length ? [items] : []
}

function openSupplierThread(rs: RequestSupplierResponse) {
	if (rs.sent_status === RequestSupplierStatus.REPLIED) {
		navigateTo(`/requests/${id}/responses#${rs.id}`)
	}
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
