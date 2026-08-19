<template>
	<UForm :schema="cooperationInviteSchema" :state="form" class="space-y-4" @submit="submit">
		<UFormField label="Имя" name="name" required>
			<UInput
				v-model="form.name"
				placeholder="Иван Иванов"
				icon="i-lucide-user"
				class="w-full"
				autocomplete="name"
			/>
		</UFormField>

		<UFormField label="Компания" name="company">
			<UInput
				v-model="form.company"
				placeholder="ООО «Поставщик»"
				icon="i-lucide-building-2"
				class="w-full"
				autocomplete="organization"
			/>
		</UFormField>

		<UFormField label="Сфера отрасли" name="industry" required>
			<UInput
				v-model="form.industry"
				placeholder="Например: металлопрокат, ИТ-оборудование"
				icon="i-lucide-factory"
				class="w-full"
			/>
		</UFormField>

		<UFormField label="Телефон" name="phone" required>
			<PhoneNumberInput v-model="form.phone" default-country="BY" />
		</UFormField>

		<UFormField label="Email" name="email" required>
			<UInput
				v-model="form.email"
				type="email"
				placeholder="you@company.com"
				icon="i-lucide-mail"
				class="w-full"
				autocomplete="email"
			/>
		</UFormField>

		<UFormField label="Комментарий" name="comment">
			<UTextarea
				v-model="form.comment"
				:rows="3"
				autoresize
				placeholder="Кратко опишите предложение о сотрудничестве"
				class="w-full"
			/>
		</UFormField>

		<div class="space-y-3">
			<UFormField name="consent">
				<UCheckbox v-model="form.consent" required>
					<template #label>
						<span class="text-sm text-muted">
							Я согласен на
							<ULink
								:to="legalDocuments.termsOfUse.page"
								class="text-primary underline underline-offset-2 hover:opacity-80"
							>
								пользовательское соглашение
							</ULink>
							и принимаю
							<ULink
								:to="legalDocuments.privacyPolicy.page"
								class="text-primary underline underline-offset-2 hover:opacity-80"
							>
								политику обработки персональных данных
							</ULink>
						</span>
					</template>
				</UCheckbox>
			</UFormField>

			<UFormField name="agree_marketing">
				<UCheckbox v-model="form.agree_marketing">
					<template #label>
						<span class="text-sm text-muted">
							Согласен на получение информационных сообщений —
							<ULink
								:to="legalDocuments.marketingConsent.page"
								class="text-primary underline underline-offset-2 hover:opacity-80"
							>
								согласие на маркетинг
							</ULink>
						</span>
					</template>
				</UCheckbox>
			</UFormField>
		</div>

		<input
			v-model="form.honeypot"
			type="text"
			name="company_website"
			tabindex="-1"
			autocomplete="off"
			class="absolute -left-[9999px] h-0 w-0 opacity-0"
			aria-hidden="true"
		>

		<UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />

		<UAlert
			v-if="success"
			color="success"
			variant="soft"
			icon="i-lucide-check"
			description="Заявка отправлена. Мы свяжемся с вами после проверки."
		/>

		<UButton
			type="submit"
			block
			size="lg"
			:loading="submitting"
			leading-icon="i-lucide-send"
			class="cursor-pointer justify-center landing-btn-primary"
		>
			Отправить заявку
		</UButton>
	</UForm>
</template>

<script lang="ts" setup>
import { LEGAL_DOCUMENTS } from '#shared/constants/landing'
import { cooperationInviteSchema } from '#shared/schemas/cooperation'
import type { CooperationLeadCreate } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

const emit = defineEmits<{ success: [] }>()

const legalDocuments = LEGAL_DOCUMENTS
const { post } = useApi()
const utm = useUtmParams()

const form = reactive({
	name: '',
	company: '',
	industry: '',
	email: '',
	phone: '',
	comment: '',
	consent: false,
	agree_marketing: false,
	honeypot: '',
})

const submitting = ref(false)
const error = ref('')
const success = ref(false)

function resetForm() {
	form.name = ''
	form.company = ''
	form.industry = ''
	form.email = ''
	form.phone = ''
	form.comment = ''
	form.consent = false
	form.agree_marketing = false
	form.honeypot = ''
	error.value = ''
	success.value = false
}

async function submit() {
	if (submitting.value) return
	submitting.value = true
	error.value = ''
	success.value = false
	try {
		const utmParams = utm.get()
		const payload: CooperationLeadCreate = {
			name: form.name,
			email: form.email,
			phone: form.phone,
			company: form.company.trim() || 'Не указано',
			industry: form.industry,
			comment: form.comment.trim() || null,
			consent: form.consent,
			agree_marketing: form.agree_marketing,
			page_url: import.meta.client ? window.location.href : null,
			...utmParams,
		}
		await post('/cooperation/leads', payload)
		success.value = true
		emit('success')
	}
	catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Не удалось отправить заявку. Попробуйте ещё раз.'
	}
	finally {
		submitting.value = false
	}
}

defineExpose({ resetForm })
</script>
