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

const isOpen = defineModel<boolean>('open', { default: false })

const { get, put, post } = useApi()
const toast = useToast()

const billingProfile = reactive<BillingProfileForm>(emptyBillingProfileForm())
const billingLoading = ref(false)
const billingSaving = ref(false)
const billingExtracting = ref(false)
const billingGenerating = ref(false)
const extractText = ref('')
const extractFiles = ref<File[]>([])

const billingFileAccept = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt'

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

async function loadBillingProfile() {
	billingLoading.value = true
	try {
		const profile = await get<BillingProfileResponse>('/billing/profile')
		applyBillingProfile(profile)
	} catch {
		toast.add({ title: 'Не удалось загрузить реквизиты', color: 'error' })
	} finally {
		billingLoading.value = false
	}
}

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

async function downloadInvoice(doc: BillingDocumentResponse) {
	try {
		const blob = await get<Blob>(`/billing/documents/${doc.id}/download`, {
			params: { type: 'invoice' },
			responseType: 'blob',
		})
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${doc.receipt_id}-invoice.pdf`
		a.click()
		URL.revokeObjectURL(url)
	} catch {
		// document was generated successfully; download failure is non-fatal
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
		await downloadInvoice(result.document)
		toast.add({
			title: result.email_queued
				? 'Документы сформированы и отправлены на email'
				: 'Документы сформированы',
			color: 'success',
		})
		isOpen.value = false
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

function resetForm() {
	Object.assign(billingProfile, emptyBillingProfileForm())
	extractText.value = ''
	extractFiles.value = []
}

watch(isOpen, (open) => {
	if (open) {
		resetForm()
		void loadBillingProfile()
	}
})
</script>

<template>
	<UModal
		v-model:open="isOpen"
		title="Выставить счёт на оплату"
		:ui="{ content: 'max-w-3xl' }"
	>
		<template #body>
			<div v-if="billingLoading" class="flex justify-center py-8">
				<UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-muted" />
			</div>

			<div v-else class="space-y-6">
				<p class="text-sm text-muted">
					Заполните реквизиты организации и сформируйте счёт за услуги.
					Документы будут отправлены на email.
				</p>

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

				<div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-default">
					<UButton color="neutral" variant="ghost" @click="isOpen = false">
						Отмена
					</UButton>
					<UButton
						color="primary"
						leading-icon="i-lucide-receipt"
						:loading="billingGenerating"
						:disabled="!subscription?.is_active"
						@click="generateBillingDocument"
					>
						Получить счёт на оплату
					</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>
