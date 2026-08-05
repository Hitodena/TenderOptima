<template>
	<div class="space-y-6">
		<div class="space-y-1">
			<p class="font-semibold text-highlighted">
				Отправка предложений сотрудничества
			</p>
			<p class="text-sm text-muted">
				Поставщики, которые хотя бы раз ответили. Можно выбрать несколько и отправить
				персонализированное письмо. Плейсхолдеры:
				<code class="text-xs">{company_name}</code>,
				<code class="text-xs">{query}</code>.
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
				class="min-w-[860px]"
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
					<div class="min-w-[10rem] max-w-[16rem]">
						<p class="text-sm font-medium break-words">
							{{ row.original.company_name }}
						</p>
						<p class="text-xs text-muted break-all mt-0.5">
							{{ row.original.domain || '—' }}
						</p>
					</div>
				</template>

				<template #main_email-cell="{ row }">
					<span class="text-xs break-all">{{ row.original.main_email }}</span>
				</template>

				<template #queries-cell="{ row }">
					<div class="min-w-[12rem] max-w-[22rem] space-y-1">
						<p
							v-for="(query, idx) in row.original.queries"
							:key="`${row.original.id}-${idx}`"
							class="text-xs text-muted break-words"
						>
							{{ query }}
						</p>
						<span v-if="!row.original.queries.length" class="text-xs text-muted">—</span>
					</div>
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
} from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'
import LetterAttachmentsField from '~/components/LetterAttachmentsField.vue'

const PAGE_SIZE = 20

const { get, post } = useApi()
const toast = useToast()

const suppliers = ref<AdminCooperationSupplierItem[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const loading = ref(false)
const loadError = ref<string | null>(null)
const selectedIds = ref<Set<string>>(new Set())

const subject = ref('Предложение о сотрудничестве')
const body = ref(`Добрый день, {company_name}!

Мы хотели бы предложить вам долгосрочное сотрудничество.

Ранее вы отвечали по запросу: {query}.

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
	{ id: 'select', header: '' },
	{ accessorKey: 'company_name', header: 'Компания' },
	{ accessorKey: 'main_email', header: 'Email' },
	{ accessorKey: 'queries', header: 'Query' },
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

watch(page, () => {
	void fetchSuppliers()
})

onMounted(() => {
	void fetchSuppliers()
	void loadSmtpDefaults()
})
</script>
