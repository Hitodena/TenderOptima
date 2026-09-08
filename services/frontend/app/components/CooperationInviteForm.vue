<template>
	<div v-if="token && loading" class="space-y-3">
		<USkeleton class="h-10 w-full rounded-md" />
		<USkeleton class="h-10 w-full rounded-md" />
	</div>

	<UAlert
		v-else-if="token && loadError"
		color="error"
		variant="soft"
		icon="i-lucide-circle-alert"
		:description="loadError"
	/>

	<UForm v-else :schema="schema" :state="form" class="space-y-4" @submit="submit">
		<template v-if="!token">
			<UFormField label="Имя" name="name" required>
				<UInput v-model="form.name" placeholder="Иван Иванов" icon="i-lucide-user" class="w-full" autocomplete="name" />
			</UFormField>
			<UFormField label="Компания" name="company">
				<UInput v-model="form.company" placeholder="ООО «Поставщик»" icon="i-lucide-building-2" class="w-full" autocomplete="organization" />
			</UFormField>
		</template>

		<UFormField :label="token ? 'Категории товаров' : 'Сфера отрасли'" name="industry" required>
			<UInput
				v-model="form.industry"
				:placeholder="token ? 'Насосы, арматура, упаковка' : 'Например: металлопрокат, ИТ-оборудование'"
				icon="i-lucide-factory"
				class="w-full"
			/>
		</UFormField>

		<UFormField v-if="token" label="Регион" name="region" required>
			<UInput v-model="form.region" icon="i-lucide-map-pin" placeholder="Например: Минск" class="w-full" />
		</UFormField>

		<template v-if="!token">
			<UFormField label="Телефон" name="phone" required>
				<PhoneNumberInput v-model="form.phone" default-country="BY" />
			</UFormField>
		</template>

		<UFormField label="Email" name="email" required>
			<UInput
				v-model="form.email"
				type="email"
				placeholder="you@company.com"
				icon="i-lucide-mail"
				class="w-full"
				autocomplete="email"
				:disabled="Boolean(token)"
			/>
		</UFormField>

		<UFormField v-if="!token" label="Комментарий" name="comment">
			<UTextarea v-model="form.comment" :rows="3" autoresize placeholder="Кратко опишите предложение о сотрудничестве" class="w-full" />
		</UFormField>

		<UFormField name="consent">
			<UCheckbox v-model="form.consent" required>
				<template #label>
					<span class="text-sm text-muted">
						Я согласен на
						<ULink :to="legalDocuments.termsOfUse.page" class="text-primary underline underline-offset-2 hover:opacity-80">
							пользовательское соглашение
						</ULink>
						и принимаю
						<ULink :to="legalDocuments.privacyPolicy.page" class="text-primary underline underline-offset-2 hover:opacity-80">
							политику обработки персональных данных
						</ULink>
					</span>
				</template>
			</UCheckbox>
		</UFormField>

		<UFormField name="agree_marketing">
			<UCheckbox v-model="form.agree_marketing" :required="Boolean(token)">
				<template #label>
					<span class="text-sm text-muted">
						{{ token
							? 'Согласен получать похожие запросы по email —'
							: 'Согласен на получение информационных сообщений —' }}
						<ULink :to="legalDocuments.marketingConsent.page" class="text-primary underline underline-offset-2 hover:opacity-80">
							согласие на маркетинг
						</ULink>
					</span>
				</template>
			</UCheckbox>
		</UFormField>

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
		<UAlert v-if="success" color="success" variant="soft" icon="i-lucide-check" :description="successText" />

		<UButton
			type="submit"
			block
			size="lg"
			:loading="submitting"
			:leading-icon="token ? 'i-lucide-check' : 'i-lucide-send'"
			class="cursor-pointer justify-center landing-btn-primary"
		>
			{{ token ? 'Сохранить' : 'Отправить заявку' }}
		</UButton>
	</UForm>
</template>

<script lang="ts" setup>
import { LEGAL_DOCUMENTS } from '#shared/constants/landing'
import { cooperationInviteSchema, cooperationSubscribeSchema } from '#shared/schemas/cooperation'
import type { CooperationLeadCreate, SupplierEmailPreference } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

const props = defineProps<{
	token?: string
}>()

const legalDocuments = LEGAL_DOCUMENTS
const { get, post } = useApi()
const utm = useUtmParams()

const schema = computed(() =>
	props.token ? cooperationSubscribeSchema : cooperationInviteSchema,
)

const form = reactive({
	name: '',
	company: '',
	industry: '',
	region: '',
	email: '',
	phone: '',
	comment: '',
	consent: false,
	agree_marketing: false,
	honeypot: '',
})

const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref(false)

const successText = computed(() =>
	props.token
		? 'Подписка сохранена. Вы будете получать похожие запросы.'
		: 'Заявка отправлена. Мы свяжемся с вами после проверки.',
)

async function loadFromToken() {
	if (!props.token) return
	loading.value = true
	loadError.value = ''
	try {
		const data = await get<SupplierEmailPreference>('/supplier-preferences/', {
			params: { token: props.token },
		})
		form.email = data.email
		form.industry = data.categories.join(', ')
		form.region = data.region || data.suggested_region || ''
	}
	catch (e: unknown) {
		loadError.value = getApiErrorDetail(e) ?? 'Недействительная или устаревшая ссылка.'
	}
	finally {
		loading.value = false
	}
}

async function submit() {
	if (submitting.value) return
	submitting.value = true
	error.value = ''
	success.value = false
	try {
		if (props.token) {
			const categories = form.industry.split(',').map((item) => item.trim()).filter(Boolean)
			await post('/supplier-preferences/subscribe', {
				token: props.token,
				categories,
				region: form.region.trim(),
				consent: form.consent,
				agree_marketing: form.agree_marketing,
			})
		}
		else {
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
				...utm.get(),
			}
			await post('/cooperation/leads', payload)
		}
		success.value = true
	}
	catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Не удалось сохранить. Попробуйте ещё раз.'
	}
	finally {
		submitting.value = false
	}
}

watch(() => props.token, () => {
	void loadFromToken()
}, { immediate: true })
</script>
