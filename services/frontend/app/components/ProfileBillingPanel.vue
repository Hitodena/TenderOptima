<script lang="ts" setup>
import type {
	BillingDocumentResponse,
	BillingProfileResponse,
	BillingProfileUpdate,
	SubscriptionResponse,
} from '#shared/types'
import {
	BILLING_PROFILE_FIELDS,
	billingProfileSchema,
	emptyBillingProfileForm,
	type BillingProfileForm,
} from '#shared/schemas/billingProfile'

const props = defineProps<{
	subscription: SubscriptionResponse | null | undefined
}>()

const { get, put, post } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()

const billingProfile = reactive<BillingProfileForm>(emptyBillingProfileForm())
const billingDocuments = ref<BillingDocumentResponse[]>([])
const billingLoading = ref(false)
const billingSaving = ref(false)
const billingExtracting = ref(false)
const billingGenerating = ref(false)
const extractText = ref('')
const extractFiles = ref<File[]>([])

const billingFileAccept = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt'

const currentBillingPeriodLabel = computed(() => {
	const now = new Date()
	const month = now.toLocaleDateString('ru-RU', { month: 'long' })
	return `${month} ${now.getFullYear()}`
})

function applyBillingProfile(data: BillingProfileResponse) {
	for (const key of BILLING_PROFILE_FIELDS) {
		billingProfile[key] = data[key] ?? ''
	}
}

function profilePayloadFromForm(): BillingProfileUpdate {
	return Object.fromEntries(
		BILLING_PROFILE_FIELDS.map((key) => [
			key,
			billingProfile[key].trim() === '' ? null : billingProfile[key].trim(),
		]),
	) as BillingProfileUpdate
}

function validateBillingProfile(): boolean {
	const result = billingProfileSchema.safeParse(billingProfile)
	if (result.success) {
		return true
	}
	const firstIssue = result.error.issues[0]
	toast.add({
		title: firstIssue?.message ?? 'Заполните обязательные реквизиты',
		color: 'warning',
	})
	return false
}

async function loadBillingData() {
	billingLoading.value = true
	try {
		const [profile, documents] = await Promise.all([
			get<BillingProfileResponse>('/billing/profile'),
			get<BillingDocumentResponse[]>('/billing/documents'),
		])
		applyBillingProfile(profile)
		billingDocuments.value = documents
	} catch {
		toast.add({ title: 'Не удалось загрузить данные для документов', color: 'error' })
	} finally {
		billingLoading.value = false
	}
}

onMounted(() => {
	void loadBillingData()
})

async function saveBillingProfile() {
	if (!validateBillingProfile()) {
		return
	}
	billingSaving.value = true
	try {
		const payload = profilePayloadFromForm()
		const saved = await put<BillingProfileResponse>('/billing/profile', payload)
		applyBillingProfile(saved)
		toast.add({ title: 'Реквизиты сохранены', color: 'success' })
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось сохранить реквизиты',
			color: 'error',
		})
	} finally {
		billingSaving.value = false
	}
}

function onExtractFilesChange(files: File | File[] | null | undefined) {
	if (!files) {
		extractFiles.value = []
		return
	}
	extractFiles.value = Array.isArray(files) ? files : [files]
}

async function extractBillingProfile() {
	if (!extractText.value.trim() && extractFiles.value.length === 0) {
		toast.add({ title: 'Добавьте текст или файлы для извлечения', color: 'warning' })
		return
	}
	billingExtracting.value = true
	try {
		const fd = new FormData()
		fd.append('free_text', extractText.value.trim())
		for (const file of extractFiles.value) {
			fd.append('files', file)
		}
		const extracted = await post<BillingProfileResponse>('/billing/profile/extract', fd)
		applyBillingProfile(extracted)
		toast.add({ title: 'Реквизиты извлечены', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось извлечь реквизиты', color: 'error' })
	} finally {
		billingExtracting.value = false
	}
}

async function generateBillingDocument() {
	if (!props.subscription?.is_active) {
		toast.add({ title: 'Нужна активная подписка', color: 'warning' })
		return
	}
	if (!validateBillingProfile()) {
		return
	}
	billingGenerating.value = true
	try {
		const result = await post<{ document: BillingDocumentResponse; email_queued: boolean }>(
			'/billing/documents/generate',
			{ send_email: true },
		)
		billingDocuments.value = [
			result.document,
			...billingDocuments.value.filter((doc) => doc.id !== result.document.id),
		]
		toast.add({
			title: result.email_queued
				? 'Документы сформированы и отправлены на email'
				: 'Документы сформированы',
			color: 'success',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось сформировать документ',
			color: 'error',
		})
	} finally {
		billingGenerating.value = false
	}
}

async function downloadBillingDocument(
	doc: BillingDocumentResponse,
	docType: 'invoice' | 'act',
) {
	try {
		const res = await $axios.get(
			`/billing/documents/${doc.id}/download`,
			{
				params: { type: docType },
				responseType: 'blob',
			},
		)
		const blob = res.data as Blob
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${doc.receipt_id}-${docType}.docx`
		a.click()
		URL.revokeObjectURL(url)
	} catch {
		toast.add({ title: 'Не удалось скачать документ', color: 'error' })
	}
}

function formatDocumentPeriod(doc: BillingDocumentResponse) {
	const start = new Date(doc.period_start).toLocaleDateString('ru-RU')
	const end = new Date(doc.period_end).toLocaleDateString('ru-RU')
	return `${start} — ${end}`
}

function formatDocumentStatus(doc: BillingDocumentResponse) {
	if (doc.email_status === 'sent') return 'Отправлен'
	if (doc.email_status === 'pending') return 'В очереди'
	return doc.email_status
}
</script>

<template>
	<UCard :ui="{ body: 'p-5 space-y-6' }">
		<div class="space-y-1">
			<h3 class="text-lg font-semibold text-highlighted">Документы по подписке</h3>
			<p class="text-sm text-muted">
				Реквизиты плательщика для счёта-фактуры и акта.
			</p>
		</div>

		<div v-if="billingLoading" class="flex justify-center py-8">
			<UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-muted" />
		</div>

		<template v-else>
			<div class="rounded-lg border border-default p-4 space-y-4">
				<p class="text-sm font-semibold">Извлечение реквизитов</p>
				<p class="text-xs text-muted">
					Загрузите документы или вставьте текст — нейросеть заполнит поля формы ниже.
				</p>
				<UFormField label="Текст с реквизитами">
					<UTextarea
						v-model="extractText"
						class="w-full"
						:rows="4"
						placeholder="Вставьте реквизиты из письма, договора или карточки организации"
					/>
				</UFormField>
				<UFormField label="Файлы PDF, DOCX, изображения">
					<UFileUpload
						:model-value="extractFiles"
						:accept="billingFileAccept"
						:interactive="false"
						multiple
						layout="list"
						position="inside"
						class="w-full min-h-28"
						@update:model-value="onExtractFilesChange"
					>
						<template #actions="{ open }">
							<UButton type="button" variant="outline" size="sm" @click="open()">
								<UIcon name="i-lucide-upload" class="w-4 h-4" />
								Выбрать файлы
							</UButton>
						</template>
					</UFileUpload>
				</UFormField>
				<UButton
					variant="soft"
					color="primary"
					leading-icon="i-lucide-sparkles"
					:loading="billingExtracting"
					@click="extractBillingProfile"
				>
					Извлечь поля нейросетью
				</UButton>
			</div>

			<UForm
				:schema="billingProfileSchema"
				:state="billingProfile"
				class="space-y-6"
				@submit="saveBillingProfile"
			>
				<div class="grid gap-4 md:grid-cols-2">
					<UFormField label="Страна" name="country">
						<UInput
							v-model="billingProfile.country"
							class="w-full"
							placeholder="Беларусь"
						/>
					</UFormField>
					<UFormField label="Форма организации" name="organization_form" required>
						<UInput
							v-model="billingProfile.organization_form"
							class="w-full"
							placeholder="Общество с ограниченной ответственностью"
						/>
					</UFormField>
					<UFormField label="УНП" name="inn" required>
						<UInput v-model="billingProfile.inn" class="w-full" />
					</UFormField>
					<UFormField label="Название организации" name="organization_name" required>
						<UInput
							v-model="billingProfile.organization_name"
							class="w-full"
							placeholder="Органик Продакшн"
						/>
					</UFormField>
					<UFormField label="КПП" name="kpp">
						<UInput v-model="billingProfile.kpp" class="w-full" />
					</UFormField>
					<UFormField label="ОКПО" name="ogrn" required>
						<UInput v-model="billingProfile.ogrn" class="w-full" />
					</UFormField>
					<UFormField label="Юридический адрес (вместе с индексом)" name="legal_address" required class="md:col-span-2">
						<UTextarea v-model="billingProfile.legal_address" class="w-full" :rows="2" />
					</UFormField>
					<UFormField label="Почтовый адрес (вместе с индексом)" name="postal_address" class="md:col-span-2">
						<UTextarea v-model="billingProfile.postal_address" class="w-full" :rows="2" />
					</UFormField>
					<UFormField
						label="ФИО директора (или лица, имеющего права подписи)"
						name="director_name"
						class="md:col-span-2"
					>
						<UInput v-model="billingProfile.director_name" class="w-full" />
					</UFormField>
					<UFormField label="БИК" name="bik">
						<UInput v-model="billingProfile.bik" class="w-full" />
					</UFormField>
					<UFormField label="Название банка" name="bank_name" required>
						<UInput v-model="billingProfile.bank_name" class="w-full" />
					</UFormField>
					<UFormField label="Расчётный счёт" name="settlement_account" required>
						<UInput v-model="billingProfile.settlement_account" class="w-full" />
					</UFormField>
					<UFormField label="Корреспондентский счёт" name="correspondent_account">
						<UInput v-model="billingProfile.correspondent_account" class="w-full" />
					</UFormField>
				</div>

				<div class="rounded-lg border border-default p-4 space-y-4">
					<div class="space-y-1">
						<p class="text-sm font-semibold">Контактное лицо</p>
						<p class="text-xs text-muted">Не указывается в документах</p>
					</div>
					<div class="grid gap-4 md:grid-cols-2">
						<UFormField label="ФИО" name="contact_full_name">
							<UInput v-model="billingProfile.contact_full_name" class="w-full" />
						</UFormField>
						<UFormField label="Email" name="contact_email">
							<UInput
								v-model="billingProfile.contact_email"
								type="email"
								class="w-full"
							/>
						</UFormField>
						<UFormField label="Телефон" name="contact_phone">
							<UInput v-model="billingProfile.contact_phone" class="w-full" />
						</UFormField>
					</div>
				</div>

				<div class="flex flex-wrap gap-2">
					<UButton
						type="submit"
						variant="outline"
						color="neutral"
						:loading="billingSaving"
					>
						Сохранить реквизиты
					</UButton>
				</div>
			</UForm>

			<div class="rounded-lg border border-default p-4 space-y-4">
				<div class="space-y-1">
					<p class="text-sm font-semibold">Формирование документов</p>
					<p class="text-sm text-muted">
						За текущий период: {{ currentBillingPeriodLabel }}
					</p>
				</div>
				<UButton
					color="primary"
					leading-icon="i-lucide-file-output"
					:loading="billingGenerating"
					:disabled="!subscription?.is_active"
					@click="generateBillingDocument"
				>
					Сформировать и отправить документы
				</UButton>
			</div>

			<div v-if="billingDocuments.length > 0" class="space-y-3">
				<p class="text-sm font-semibold">История документов</p>
				<div class="overflow-x-auto rounded-lg border border-default">
					<table class="min-w-full text-sm">
						<thead class="bg-elevated/50 text-muted">
							<tr>
								<th class="px-3 py-2 text-left font-medium">Номер</th>
								<th class="px-3 py-2 text-left font-medium">Период</th>
								<th class="px-3 py-2 text-left font-medium">Сумма</th>
								<th class="px-3 py-2 text-left font-medium">Статус</th>
								<th class="px-3 py-2 text-right font-medium">Документы</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="doc in billingDocuments"
								:key="doc.id"
								class="border-t border-default/60"
							>
								<td class="px-3 py-2 font-medium">{{ doc.receipt_id }}</td>
								<td class="px-3 py-2">{{ formatDocumentPeriod(doc) }}</td>
								<td class="px-3 py-2 tabular-nums">
									{{ doc.total_amount }} {{ doc.currency_code }}
								</td>
								<td class="px-3 py-2">{{ formatDocumentStatus(doc) }}</td>
								<td class="px-3 py-2 text-right">
									<div class="flex justify-end gap-1">
										<UButton
											size="xs"
											variant="ghost"
											color="neutral"
											label="Счёт"
											icon="i-lucide-download"
											@click="downloadBillingDocument(doc, 'invoice')"
										/>
										<UButton
											size="xs"
											variant="ghost"
											color="neutral"
											label="Акт"
											icon="i-lucide-download"
											@click="downloadBillingDocument(doc, 'act')"
										/>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>
	</UCard>
</template>
