<template>
	<UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'max-w-md' }">
		<template #body>
			<UForm :schema="schema" :state="form" class="space-y-4" @submit="handleSubmit">
				<UFormField label="Название компании" name="company_name" required>
					<UInput
						v-model="form.company_name"
						placeholder="ООО ПромПоставка"
						icon="i-lucide-building-2"
						class="w-full"
					/>
				</UFormField>

				<UFormField label="Email" name="email" required>
					<UInput
						v-model="form.email"
						type="email"
						placeholder="sales@supplier.ru"
						icon="i-lucide-mail"
						class="w-full"
						:disabled="isEditMode"
					/>
				</UFormField>

				<div>
					<UButton
						type="button"
						variant="ghost"
						color="neutral"
						size="sm"
						class="px-0"
						:trailing-icon="showOptional ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
						@click="showOptional = !showOptional"
					>
						Дополнительные поля
					</UButton>

					<div v-show="showOptional" class="mt-3 space-y-3">
						<UFormField label="Домен" name="domain" hint="example.com">
							<UInput
								v-model="form.domain"
								placeholder="supplier.ru"
								icon="i-lucide-globe"
								class="w-full"
							/>
						</UFormField>

						<UFormField label="Телефон" name="phone">
							<UInput
								v-model="form.phone"
								placeholder="+7 (495) 123-45-67"
								icon="i-lucide-phone"
								class="w-full"
							/>
						</UFormField>

						<UFormField
							label="Дополнительные email"
							name="extra_emails"
							hint="Через запятую или с новой строки"
						>
							<UTextarea
								v-model="form.extra_emails"
								:rows="3"
								placeholder="info@supplier.ru, zakupki@supplier.ru"
								class="w-full"
							/>
						</UFormField>

						<UFormField label="Иное" name="comments" hint="Комментарий от пользователя">
							<UTextarea
								v-model="form.comments"
								:rows="2"
								placeholder="Любые заметки по поставщику"
								class="w-full"
							/>
						</UFormField>
					</div>
				</div>

				<UAlert
					v-if="testPlanHint"
					color="info"
					variant="soft"
					icon="i-lucide-info"
					:description="testPlanHint"
				/>

				<UAlert
					v-if="error"
					color="error"
					variant="soft"
					icon="i-lucide-circle-alert"
					:description="error"
				/>

				<div class="flex justify-end gap-2 pt-2">
					<UButton color="neutral" variant="ghost" @click="close">Отмена</UButton>
					<UButton
						type="submit"
						:loading="loading"
						:disabled="!isEditMode && testPlanManualLimitReached"
						:leading-icon="isEditMode ? 'i-lucide-save' : 'i-lucide-plus'"
					>
						{{ isEditMode ? 'Сохранить' : 'Добавить' }}
					</UButton>
				</div>
			</UForm>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import { z } from 'zod'
import type { Supplier, SupplierCreate, SupplierUpdate, SubscriptionResponse } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { isTestPlan, TEST_PLAN_MANUAL_SUPPLIER_BONUS } from '#shared/utils/subscriptionAccess'

const props = defineProps<{
	requestId?: string | null
	subscription?: SubscriptionResponse | null
	manualSupplierCount?: number
	supplier?: Supplier | null
}>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: []; updated: [] }>()

const { post, patch } = useApi()

const isEditMode = computed(() => Boolean(props.supplier))
const modalTitle = computed(() => isEditMode.value ? 'Редактировать поставщика' : 'Добавить поставщика')

const schema = z.object({
	domain: z.string().optional(),
	company_name: z.string().min(1, 'Обязательное поле').max(200),
	email: z.string().email('Неверный формат email'),
	phone: z.string().max(50).optional(),
	extra_emails: z.string().optional(),
	comments: z.string().optional(),
})

const form = reactive({
	domain: '',
	company_name: '',
	email: '',
	phone: '',
	extra_emails: '',
	comments: '',
})
const showOptional = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const testPlanHint = computed(() => {
	if (isEditMode.value || !isTestPlan(props.subscription)) return null
	if ((props.manualSupplierCount ?? 0) >= TEST_PLAN_MANUAL_SUPPLIER_BONUS) {
		return 'На тестовом тарифе можно добавить только одного поставщика вручную (сверх 10 из поиска).'
	}
	return 'На тестовом тарифе можно добавить одного поставщика вручную — он появится вверху списка (до 11 писем).'
})

const testPlanManualLimitReached = computed(() =>
	isTestPlan(props.subscription)
	&& (props.manualSupplierCount ?? 0) >= TEST_PLAN_MANUAL_SUPPLIER_BONUS,
)

function parseExtraEmails(raw: string, primaryEmail: string): string[] | null {
	const parts = raw
		.split(/[\n,;]+/)
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean)
	const unique = [...new Set(parts.filter((part) => part !== primaryEmail.trim().toLowerCase()))]
	return unique.length ? unique : null
}

function resetForm() {
	if (props.supplier) {
		form.domain = props.supplier.domain ?? ''
		form.company_name = props.supplier.company_name
		form.email = props.supplier.main_email
		form.phone = props.supplier.phone ?? ''
		form.extra_emails = (props.supplier.extra_emails ?? []).join(', ')
		form.comments = props.supplier.comments ?? ''
		showOptional.value = Boolean(
			form.domain || form.phone || form.extra_emails || form.comments,
		)
	} else {
		form.domain = ''
		form.company_name = ''
		form.email = ''
		form.phone = ''
		form.extra_emails = ''
		form.comments = ''
		showOptional.value = false
	}
	error.value = null
}

function close() {
	isOpen.value = false
}

async function handleSubmit() {
	if (loading.value) return
	loading.value = true
	error.value = null
	try {
		if (isEditMode.value && props.supplier) {
			const updatePayload: SupplierUpdate = {
				company_name: form.company_name.trim() || undefined,
				domain: form.domain.trim() || null,
				phone: form.phone.trim() || null,
				extra_emails: parseExtraEmails(form.extra_emails, props.supplier.main_email) ?? [],
				comments: form.comments.trim() || null,
			}
			await patch(`/suppliers/${props.supplier.id}`, updatePayload)
			emit('updated')
		} else {
			if (testPlanManualLimitReached.value) return
			const email = form.email.trim()
			const payload: SupplierCreate = {
				domain: form.domain.trim() || null,
				company_name: form.company_name.trim(),
				email,
				extra_emails: parseExtraEmails(form.extra_emails, email),
				phone: form.phone.trim() || null,
				comments: form.comments.trim() || null,
				source: 'manual',
				request_id: props.requestId ?? null,
				is_enabled: true,
			}
			await post('/suppliers/', payload)
			emit('added')
		}
		close()
	} catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? (isEditMode.value ? 'Ошибка при сохранении' : 'Ошибка при добавлении поставщика')
	} finally {
		loading.value = false
	}
}

watch(isOpen, (open) => {
	if (open) resetForm()
})
</script>
