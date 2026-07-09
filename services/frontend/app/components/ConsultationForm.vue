<template>
	<UForm :schema="consultationSchema" :state="form" class="space-y-4" @submit="submit">
		<UFormField label="Имя" name="name" required>
			<UInput
				v-model="form.name"
				placeholder="Иван Иванов"
				icon="i-lucide-user"
				class="w-full"
				autocomplete="name"
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

		<div class="space-y-3">
			<UFormField name="consent">
				<UCheckbox v-model="form.consent" required>
					<template #label>
						<span class="text-sm text-muted">
							Я согласен на
							<ULink
								:to="legalLinks[0].to"
								class="text-primary underline underline-offset-2 hover:opacity-80"
							>
								обработку персональных данных
							</ULink>
							и принимаю
							<ULink
								:to="legalLinks[1].to"
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
							Согласен на получение информационных сообщений
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
			:description="activeOption.successMessage"
		/>

		<UButton
			type="submit"
			block
			:size="submitSize"
			:loading="submitting"
			leading-icon="i-lucide-send"
			class="cursor-pointer justify-center landing-btn-primary"
		>
			{{ activeOption.submitLabel }}
		</UButton>
	</UForm>
</template>

<script lang="ts" setup>
import type { ButtonProps } from '@nuxt/ui'
import {
	consultationSchema,
	getConsultationRequestTypeOption,
} from '#shared/schemas/consultation'
import { LEGAL_LINKS } from '#shared/constants/landing'
import type { ConsultationCreate } from '#shared/types'
import type { ConsultationRequestType } from '#shared/types/enums'
import { ConsultationRole } from '#shared/types/enums'
import { getApiErrorDetail } from '#shared/utils/apiError'

const props = withDefaults(
	defineProps<{
		initialRequestType?: ConsultationRequestType
		submitSize?: ButtonProps['size']
	}>(),
	{
		initialRequestType: 'demo',
		submitSize: 'lg',
	},
)

const emit = defineEmits<{ success: [] }>()

const legalLinks = LEGAL_LINKS

const { post } = useApi()
const utm = useUtmParams()

const form = reactive({
	requestType: props.initialRequestType,
	name: '',
	email: '',
	phone: '',
	consent: false,
	agree_marketing: false,
	honeypot: '',
})

const submitting = ref(false)
const error = ref('')
const success = ref(false)

const activeOption = computed(() => getConsultationRequestTypeOption(form.requestType))

function resetForm() {
	form.requestType = props.initialRequestType
	form.name = ''
	form.email = ''
	form.phone = ''
	form.consent = false
	form.agree_marketing = false
	form.honeypot = ''
	error.value = ''
	success.value = false
}

watch(() => props.initialRequestType, (requestType) => {
	form.requestType = requestType
})

async function submit() {
	if (submitting.value) return
	submitting.value = true
	error.value = ''
	success.value = false
	try {
		const utmParams = utm.get()
		const payload: ConsultationCreate = {
			name: form.name,
			email: form.email,
			phone: form.phone,
			request_type: form.requestType,
			role: ConsultationRole.OTHER,
			consent: form.consent,
			agree_marketing: form.agree_marketing,
			page_url: import.meta.client ? window.location.href : null,
			...utmParams,
		}
		await post('/consultations', payload)
		success.value = true
		emit('success')
	} catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Не удалось отправить заявку. Попробуйте ещё раз.'
	} finally {
		submitting.value = false
	}
}

defineExpose({ resetForm })
</script>
