<template>
	<div class="space-y-8">
		<section class="space-y-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p class="font-semibold text-highlighted">
						Заявки на сотрудничество
					</p>
					<p class="text-sm text-muted mt-0.5">
						Входящие приглашения поставщиков. Approve создаёт запись в verified-базе.
					</p>
				</div>
				<UFormField label="Статус" class="sm:w-48">
					<USelect
						v-model="leadStatusFilter"
						:items="leadStatusOptions"
						class="w-full"
						@update:model-value="reloadLeadsFirstPage"
					/>
				</UFormField>
			</div>

			<UAlert
				v-if="leadsError"
				color="error"
				variant="soft"
				icon="i-lucide-circle-alert"
				:description="leadsError"
			/>

			<div class="overflow-x-auto rounded-lg border border-default">
				<UTable
					:data="leads"
					:columns="leadColumns"
					:loading="loadingLeads"
					class="min-w-[980px]"
					:ui="{ td: 'align-top py-3', th: 'whitespace-nowrap' }"
				>
					<template #empty>
						<div class="flex flex-col items-center justify-center gap-3 py-12">
							<UIcon name="i-lucide-inbox" class="size-10 text-muted opacity-40" />
							<p class="text-muted">Заявок пока нет</p>
						</div>
					</template>

					<template #created_at-cell="{ row }">
						<span class="text-xs text-muted whitespace-nowrap">
							{{ formatDate(row.original.created_at) }}
						</span>
					</template>

					<template #status-cell="{ row }">
						<UBadge :color="leadStatusColor(row.original.status)" variant="soft">
							{{ leadStatusLabel(row.original.status) }}
						</UBadge>
					</template>

					<template #contact-cell="{ row }">
						<div class="min-w-0 max-w-56">
							<p class="text-sm font-medium truncate">{{ row.original.name }}</p>
							<p class="text-xs text-muted truncate">{{ row.original.email }}</p>
							<p class="text-xs text-muted truncate">{{ row.original.phone }}</p>
						</div>
					</template>

					<template #company-cell="{ row }">
						<div class="min-w-0 max-w-48">
							<p class="text-sm truncate" :title="row.original.company">
								{{ row.original.company }}
							</p>
							<p class="text-xs text-muted truncate" :title="row.original.industry">
								{{ row.original.industry }}
							</p>
						</div>
					</template>

					<template #comment-cell="{ row }">
						<p class="text-xs text-muted max-w-56 line-clamp-3 whitespace-pre-wrap">
							{{ row.original.comment || '—' }}
						</p>
					</template>

					<template #actions-cell="{ row }">
						<div class="flex justify-end gap-1.5">
							<UButton
								v-if="row.original.status === CooperationLeadStatus.NEW"
								size="xs"
								color="success"
								variant="soft"
								leading-icon="i-lucide-check"
								:loading="actingLeadId === row.original.id && actingLeadAction === 'approve'"
								:disabled="!!actingLeadId"
								@click="approveLead(row.original.id)"
							>
								Approve
							</UButton>
							<UButton
								v-if="row.original.status === CooperationLeadStatus.NEW"
								size="xs"
								color="error"
								variant="ghost"
								leading-icon="i-lucide-x"
								:loading="actingLeadId === row.original.id && actingLeadAction === 'cancel'"
								:disabled="!!actingLeadId"
								@click="cancelLead(row.original.id)"
							>
								Cancel
							</UButton>
						</div>
					</template>
				</UTable>
			</div>

			<div v-if="leadsTotal > PAGE_SIZE" class="flex justify-center">
				<UPagination
					v-model:page="leadsPage"
					:total="leadsTotal"
					:items-per-page="PAGE_SIZE"
					size="sm"
				/>
			</div>
		</section>

		<section class="space-y-4">
			<div>
				<p class="font-semibold text-highlighted">
					Проверенные поставщики
				</p>
				<p class="text-sm text-muted mt-0.5">
					Записи, попавшие в verified-базу после approve.
				</p>
			</div>

			<div class="overflow-x-auto rounded-lg border border-default">
				<UTable
					:data="verified"
					:columns="verifiedColumns"
					:loading="loadingVerified"
					class="min-w-[760px]"
				>
					<template #empty>
						<div class="flex flex-col items-center justify-center gap-3 py-12">
							<UIcon name="i-lucide-badge-check" class="size-10 text-muted opacity-40" />
							<p class="text-muted">Проверенных поставщиков пока нет</p>
						</div>
					</template>

					<template #created_at-cell="{ row }">
						<span class="text-xs text-muted whitespace-nowrap">
							{{ formatDate(row.original.created_at) }}
						</span>
					</template>
				</UTable>
			</div>

			<div v-if="verifiedTotal > PAGE_SIZE" class="flex justify-center">
				<UPagination
					v-model:page="verifiedPage"
					:total="verifiedTotal"
					:items-per-page="PAGE_SIZE"
					size="sm"
				/>
			</div>
		</section>

		<section class="space-y-6 border-t border-default pt-6">
			<div class="space-y-1.5">
				<div class="flex items-center gap-2">
					<p class="font-semibold text-highlighted">
						Рассылка ответившим поставщикам
					</p>
					<UPopover
						mode="click"
						:content="{ side: 'bottom', align: 'start', sideOffset: 8 }"
						class="inline-flex items-center justify-center"
					>
						<button
							type="button"
							class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-elevated text-muted transition-colors hover:bg-accented hover:text-default"
							aria-label="Справка по предложениям о сотрудничестве"
							@click.stop
						>
							<UIcon name="i-lucide-info" class="size-4" />
						</button>
						<template #content>
							<div class="max-w-sm p-4 space-y-3 text-sm">
								<p class="font-semibold text-highlighted">
									Предложения о сотрудничестве
								</p>
								<p class="text-muted">
									Список поставщиков, которые хотя бы раз ответили. Можно выбрать
									нескольких и отправить одно письмо всем выбранным.
								</p>
							</div>
						</template>
					</UPopover>
				</div>
				<p class="text-sm text-muted">
					Форма сотрудничества:
					<ULink
						:to="cooperationFormUrl"
						target="_blank"
						class="text-primary underline underline-offset-2 break-all"
					>
						{{ cooperationFormUrl }}
					</ULink>
				</p>
			</div>

			<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
				<UFormField label="Поиск" class="flex-1 min-w-0">
					<UInput
						v-model="search"
						icon="i-lucide-search"
						placeholder="Компания, домен или email"
						class="w-full"
						@keyup.enter="reloadFirstPage"
					/>
				</UFormField>
				<div class="flex gap-2 shrink-0">
					<UButton
						color="neutral"
						variant="soft"
						leading-icon="i-lucide-search"
						:loading="loading"
						@click="reloadFirstPage"
					>
						Найти
					</UButton>
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="!selectedIds.size"
						@click="clearSelection"
					>
						Сбросить выбор ({{ selectedIds.size }})
					</UButton>
				</div>
			</div>

			<UAlert
				v-if="loadError"
				color="error"
				variant="soft"
				icon="i-lucide-circle-alert"
				:description="loadError"
			/>

			<div class="overflow-x-auto rounded-lg border border-default">
				<UTable
					:data="suppliers"
					:columns="columns"
					:loading="loading"
					class="min-w-[860px] w-full table-fixed"
					:ui="{
						td: 'align-middle py-3 overflow-hidden',
						th: 'whitespace-nowrap',
					}"
				>
					<template #empty>
						<div class="flex flex-col items-center justify-center gap-3 py-12">
							<UIcon name="i-lucide-building-2" class="size-10 text-muted opacity-40" />
							<p class="text-muted">Нет поставщиков с ответами</p>
						</div>
					</template>

					<template #select-cell="{ row }">
						<UCheckbox
							:model-value="selectedIds.has(row.original.id)"
							@update:model-value="(v: boolean | 'indeterminate') => toggleRow(row.original.id, v === true)"
						/>
					</template>

					<template #company_name-cell="{ row }">
						<div class="flex items-center gap-2 min-w-0">
							<div class="min-w-0 flex-1">
								<p
									class="text-sm font-medium truncate"
									:title="row.original.company_name"
								>
									{{ row.original.company_name }}
								</p>
								<p
									v-if="row.original.domain"
									class="text-xs text-muted truncate mt-0.5"
									:title="row.original.domain"
								>
									{{ row.original.domain }}
								</p>
							</div>
						</div>
					</template>

					<template #main_email-cell="{ row }">
						<span
							class="text-xs text-muted truncate block"
							:title="row.original.main_email"
						>
							{{ row.original.main_email }}
						</span>
					</template>

					<template #queries-cell="{ row }">
						<p
							v-if="row.original.queries.length"
							class="text-xs text-muted truncate"
							:title="row.original.queries.join('; ')"
						>
							{{ row.original.queries.join('; ') }}
						</p>
					</template>
				</UTable>
			</div>

			<div v-if="total > PAGE_SIZE" class="flex justify-center">
				<UPagination
					v-model:page="page"
					:total="total"
					:items-per-page="PAGE_SIZE"
					size="sm"
				/>
			</div>

			<div class="grid gap-4 lg:grid-cols-2">
				<UFormField label="Тема">
					<UInput v-model="subject" class="w-full" />
				</UFormField>
				<div class="hidden lg:block" />
				<UFormField label="Сообщение" class="lg:col-span-2">
					<UTextarea
						v-model="body"
						:rows="12"
						class="w-full"
						autoresize
						:ui="{ base: 'min-h-48 resize-y' }"
					/>
				</UFormField>
			</div>

			<LetterAttachmentsField v-model="filesToUpload" />

			<div class="space-y-3 rounded-lg border border-default p-4">
				<div>
					<p class="text-sm font-semibold">SMTP</p>
					<p class="text-xs text-muted mt-0.5">
						По умолчанию из .env. Можно переопределить только для этой отправки.
						Пустой пароль — пароль из окружения.
					</p>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<UFormField label="SMTP host">
						<UInput v-model="smtpForm.smtp_host" class="w-full" placeholder="smtp.example.com" />
					</UFormField>
					<UFormField label="SMTP user">
						<UInput v-model="smtpForm.smtp_user" class="w-full" />
					</UFormField>
					<UFormField
						label="SMTP password"
						class="sm:col-span-2"
						:hint="smtpPasswordConfigured ? 'Пароль из .env настроен' : undefined"
					>
						<UInput
							v-model="smtpForm.smtp_password"
							type="password"
							class="w-full"
							autocomplete="new-password"
							placeholder="Оставьте пустым, чтобы использовать .env"
						/>
					</UFormField>
				</div>
			</div>

			<UAlert
				v-if="sendError"
				color="error"
				variant="soft"
				icon="i-lucide-circle-alert"
				:description="sendError"
			/>

			<div class="flex justify-end">
				<UButton
					leading-icon="i-lucide-send"
					:loading="sending"
					:disabled="!canSend"
					@click="send"
				>
					Отправить выбранным ({{ selectedIds.size }})
				</UButton>
			</div>
		</section>
	</div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type {
	AdminCooperationSendResponse,
	AdminCooperationSupplierItem,
	AdminCooperationSupplierPage,
	AdminSmtpDefaultsResponse,
	Attachment,
	CooperationLeadPageResponse,
	CooperationLeadResponse,
	VerifiedSupplierPageResponse,
	VerifiedSupplierResponse,
} from '#shared/types'
import { CooperationLeadStatus } from '#shared/types/enums'
import { getApiErrorDetail } from '#shared/utils/apiError'
import LetterAttachmentsField from '~/components/LetterAttachmentsField.vue'

const PAGE_SIZE = 20

const { get, post } = useApi()
const toast = useToast()
const { formatDate } = useFormatDate()
const requestUrl = useRequestURL()
const cooperationFormUrl = `${requestUrl.origin}/cooperation`

const leads = ref<CooperationLeadResponse[]>([])
const leadsTotal = ref(0)
const leadsPage = ref(1)
const loadingLeads = ref(false)
const leadsError = ref<string | null>(null)
const leadStatusFilter = ref<string>('all')
const actingLeadId = ref<string | null>(null)
const actingLeadAction = ref<'approve' | 'cancel' | null>(null)

const leadStatusOptions = [
	{ label: 'Все', value: 'all' },
	{ label: 'Новые', value: CooperationLeadStatus.NEW },
	{ label: 'Одобренные', value: CooperationLeadStatus.APPROVED },
	{ label: 'Отклонённые', value: CooperationLeadStatus.CANCELLED },
]

const leadColumns: TableColumn<CooperationLeadResponse>[] = [
	{ accessorKey: 'created_at', header: 'Дата' },
	{ id: 'status', header: 'Статус' },
	{ id: 'contact', header: 'Контакт' },
	{ id: 'company', header: 'Компания / отрасль' },
	{ id: 'comment', header: 'Комментарий' },
	{ id: 'actions', header: '' },
]

function leadStatusLabel(status: CooperationLeadResponse['status']): string {
	switch (status) {
		case CooperationLeadStatus.NEW:
			return 'Новая'
		case CooperationLeadStatus.APPROVED:
			return 'Одобрена'
		case CooperationLeadStatus.CANCELLED:
			return 'Отклонена'
		default: {
			const _exhaustive: never = status
			return _exhaustive
		}
	}
}

function leadStatusColor(
	status: CooperationLeadResponse['status'],
): 'primary' | 'success' | 'error' | 'neutral' {
	switch (status) {
		case CooperationLeadStatus.NEW:
			return 'primary'
		case CooperationLeadStatus.APPROVED:
			return 'success'
		case CooperationLeadStatus.CANCELLED:
			return 'error'
		default: {
			const _exhaustive: never = status
			return _exhaustive
		}
	}
}

async function fetchLeads() {
	loadingLeads.value = true
	leadsError.value = null
	try {
		const params = new URLSearchParams({
			page: String(leadsPage.value),
			size: String(PAGE_SIZE),
		})
		if (leadStatusFilter.value !== 'all') {
			params.set('status', leadStatusFilter.value)
		}
		const data = await get<CooperationLeadPageResponse>(
			`/admin/cooperation/leads?${params.toString()}`,
		)
		leads.value = data.items
		leadsTotal.value = data.total
	}
	catch (e: unknown) {
		leads.value = []
		leadsTotal.value = 0
		leadsError.value = getApiErrorDetail(e) ?? 'Не удалось загрузить заявки'
	}
	finally {
		loadingLeads.value = false
	}
}

function reloadLeadsFirstPage() {
	if (leadsPage.value === 1) {
		void fetchLeads()
		return
	}
	leadsPage.value = 1
}

async function approveLead(id: string) {
	if (actingLeadId.value) return
	actingLeadId.value = id
	actingLeadAction.value = 'approve'
	try {
		await post(`/admin/cooperation/leads/${id}/approve`, {})
		toast.add({ title: 'Заявка одобрена', color: 'success' })
		await Promise.all([fetchLeads(), fetchVerified()])
	}
	catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? 'Не удалось одобрить заявку',
			color: 'error',
		})
	}
	finally {
		actingLeadId.value = null
		actingLeadAction.value = null
	}
}

async function cancelLead(id: string) {
	if (actingLeadId.value) return
	actingLeadId.value = id
	actingLeadAction.value = 'cancel'
	try {
		await post(`/admin/cooperation/leads/${id}/cancel`, {})
		toast.add({ title: 'Заявка отклонена', color: 'neutral' })
		await fetchLeads()
	}
	catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? 'Не удалось отклонить заявку',
			color: 'error',
		})
	}
	finally {
		actingLeadId.value = null
		actingLeadAction.value = null
	}
}

const verified = ref<VerifiedSupplierResponse[]>([])
const verifiedTotal = ref(0)
const verifiedPage = ref(1)
const loadingVerified = ref(false)

const verifiedColumns: TableColumn<VerifiedSupplierResponse>[] = [
	{ accessorKey: 'created_at', header: 'Добавлен' },
	{ accessorKey: 'company_name', header: 'Компания' },
	{ accessorKey: 'industry', header: 'Отрасль' },
	{ accessorKey: 'contact_name', header: 'Контакт' },
	{ accessorKey: 'email', header: 'Email' },
	{ accessorKey: 'phone', header: 'Телефон' },
]

async function fetchVerified() {
	loadingVerified.value = true
	try {
		const params = new URLSearchParams({
			page: String(verifiedPage.value),
			size: String(PAGE_SIZE),
		})
		const data = await get<VerifiedSupplierPageResponse>(
			`/admin/cooperation/verified-suppliers?${params.toString()}`,
		)
		verified.value = data.items
		verifiedTotal.value = data.total
	}
	catch {
		verified.value = []
		verifiedTotal.value = 0
	}
	finally {
		loadingVerified.value = false
	}
}

const suppliers = ref<AdminCooperationSupplierItem[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const loading = ref(false)
const loadError = ref<string | null>(null)
const selectedIds = ref<Set<string>>(new Set())

const subject = ref('Предложение о сотрудничестве')
const body = ref(`Добрый день!

Мы хотели бы предложить вам долгосрочное сотрудничество.

Заполните форму сотрудничества: ${cooperationFormUrl}

Будем рады обсудить детали.`)
const filesToUpload = ref<File[]>([])
const sending = ref(false)
const sendError = ref('')

const smtpForm = reactive({
	smtp_host: '',
	smtp_user: '',
	smtp_password: '',
})
const smtpPasswordConfigured = ref(false)

const columns: TableColumn<AdminCooperationSupplierItem>[] = [
	{ id: 'select', header: '', meta: { class: { th: 'w-12', td: 'w-12' } } },
	{ accessorKey: 'company_name', header: 'Компания', meta: { class: { th: 'w-[32%]', td: 'w-[32%]' } } },
	{ accessorKey: 'main_email', header: 'Email', meta: { class: { th: 'w-[28%]', td: 'w-[28%]' } } },
	{ accessorKey: 'queries', header: 'Query', meta: { class: { th: 'w-[32%]', td: 'w-[32%]' } } },
]

const canSend = computed(
	() =>
		selectedIds.value.size > 0
		&& subject.value.trim().length > 0
		&& body.value.trim().length > 0,
)

function toggleRow(id: string, checked: boolean) {
	const next = new Set(selectedIds.value)
	if (checked) {
		next.add(id)
	}
	else {
		next.delete(id)
	}
	selectedIds.value = next
}

function clearSelection() {
	selectedIds.value = new Set()
}

async function fetchSuppliers() {
	loading.value = true
	loadError.value = null
	try {
		const params = new URLSearchParams({
			page: String(page.value),
			size: String(PAGE_SIZE),
		})
		const q = search.value.trim()
		if (q) {
			params.set('q', q)
		}
		const data = await get<AdminCooperationSupplierPage>(
			`/admin/cooperation/suppliers?${params.toString()}`,
		)
		suppliers.value = data.items
		total.value = data.total
	}
	catch (e: unknown) {
		suppliers.value = []
		total.value = 0
		loadError.value = getApiErrorDetail(e) ?? 'Не удалось загрузить поставщиков'
	}
	finally {
		loading.value = false
	}
}

function reloadFirstPage() {
	if (page.value === 1) {
		void fetchSuppliers()
		return
	}
	page.value = 1
}

async function loadSmtpDefaults() {
	try {
		const data = await get<AdminSmtpDefaultsResponse>('/admin/smtp-defaults')
		smtpForm.smtp_host = data.smtp_host
		smtpForm.smtp_user = data.smtp_user
		smtpForm.smtp_password = ''
		smtpPasswordConfigured.value = data.smtp_password_configured
	}
	catch {
		// Non-blocking: send still falls back to .env on the server.
	}
}

async function send() {
	if (!canSend.value) {
		return
	}
	sending.value = true
	sendError.value = ''
	try {
		let attachmentPaths: string[] | undefined
		if (filesToUpload.value.length > 0) {
			const uploadFormData = new FormData()
			for (const file of filesToUpload.value) {
				uploadFormData.append('files', file)
			}
			const uploaded = await post<Attachment[]>(
				'/admin/cooperation/attachments',
				uploadFormData,
			)
			attachmentPaths = uploaded
				.map(a => a.path)
				.filter((p): p is string => Boolean(p))
		}

		const payload = {
			supplier_ids: [...selectedIds.value],
			subject: subject.value.trim(),
			body: body.value.trim(),
			attachment_paths: attachmentPaths ?? null,
			smtp_host: smtpForm.smtp_host.trim() || null,
			smtp_user: smtpForm.smtp_user.trim() || null,
			smtp_password: smtpForm.smtp_password.trim() || null,
		}

		const result = await post<AdminCooperationSendResponse>(
			'/admin/cooperation/send',
			payload,
		)
		toast.add({
			title: `Письма поставлены в очередь (${result.queued})`,
			color: 'success',
			icon: 'i-lucide-check',
		})
		filesToUpload.value = []
		smtpForm.smtp_password = ''
	}
	catch (e: unknown) {
		sendError.value = getApiErrorDetail(e) ?? 'Не удалось отправить письма'
	}
	finally {
		sending.value = false
	}
}

watch(leadsPage, () => {
	void fetchLeads()
})
watch(verifiedPage, () => {
	void fetchVerified()
})
watch(page, () => {
	void fetchSuppliers()
})

onMounted(() => {
	void fetchLeads()
	void fetchVerified()
	void fetchSuppliers()
	void loadSmtpDefaults()
})
</script>
