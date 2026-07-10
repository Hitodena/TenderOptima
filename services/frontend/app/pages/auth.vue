<template>
	<div class="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
		<div class="w-full max-w-md">

			<div class="text-center mb-8">
				<div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
					<UIcon name="i-lucide-package-search" class="w-6 h-6 text-white" />
				</div>
				<h1 class="text-2xl font-bold text-highlighted">TenderOptima</h1>
				<p class="text-sm text-muted mt-1">{{ t('auth.subtitle') }}</p>
			</div>

			<UCard class="shadow-lg">
				<UTabs v-model="activeTab" :items="tabs" class="w-full" :ui="{ list: 'mb-4' }">

					<template #login>
						<UForm :schema="loginSchema" :state="loginForm" class="space-y-4" @submit="handleLogin">

							<UFormField label="Email" name="email" required>
								<UInput
v-model="loginForm.email" type="email" placeholder="you@company.com"
									icon="i-lucide-mail" class="w-full" autocomplete="email" />
							</UFormField>

							<UFormField :label="t('auth.passwordLabel')" name="password" required>
								<UInput
v-model="loginForm.password" :type="showLoginPassword ? 'text' : 'password'"
									:placeholder="t('auth.passwordPlaceholder')" icon="i-lucide-lock" class="w-full"
									autocomplete="current-password" @keydown.enter="handleLogin">
									<template #trailing>
										<button
type="button"
											class="flex items-center text-muted hover:text-default cursor-pointer transition-colors"
											@click="showLoginPassword = !showLoginPassword">
											<UIcon
:name="showLoginPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
												class="w-4 h-4" />
										</button>
									</template>
								</UInput>
							</UFormField>

							<UAlert
v-if="loginError" color="error" variant="soft" icon="i-lucide-circle-alert"
								:description="loginError" />

							<UButton type="submit" class="w-full justify-center" size="lg" :loading="loginLoading">
								{{ t('auth.loginSubmit') }}
							</UButton>

						</UForm>
					</template>

					<template #register>
						<UForm
:schema="registerSchema" :state="registerForm" class="space-y-4"
							@submit="handleRegister">
							<UAlert
								color="info"
								variant="soft"
								icon="i-lucide-ticket"
								:description="t('auth.inviteHint')"
							/>

							<UFormField label="Email" name="email" required>
								<UInput
v-model="registerForm.email" type="email" placeholder="you@company.com"
									icon="i-lucide-mail" class="w-full" autocomplete="email" />
							</UFormField>

							<div class="grid grid-cols-2 gap-3">
								<UFormField :label="t('auth.fullNameLabel')" name="full_name" required>
									<UInput
v-model="registerForm.full_name" :placeholder="t('auth.fullNamePlaceholder')"
										icon="i-lucide-user" class="w-full" autocomplete="name" />
								</UFormField>

								<UFormField :label="t('auth.companyLabel')" name="company_name">
									<UInput
v-model="registerForm.company_name" :placeholder="t('auth.companyPlaceholder')"
										icon="i-lucide-building-2" class="w-full" autocomplete="organization" />
								</UFormField>
							</div>

							<UFormField :label="t('auth.phoneLabel')" name="phone" required>
								<PhoneNumberInput v-model="registerForm.phone" default-country="BY" />
							</UFormField>

							<UFormField :label="t('auth.passwordLabel')" name="password" required :hint="t('auth.passwordHint')">
								<UInput
v-model="registerForm.password"
									:type="showRegisterPassword ? 'text' : 'password'" :placeholder="t('auth.passwordPlaceholder')"
									icon="i-lucide-lock" class="w-full" autocomplete="new-password"
									@keydown.enter="handleRegister">
									<template #trailing>
										<button
type="button"
											class="flex items-center text-muted hover:text-default cursor-pointer transition-colors"
											@click="showRegisterPassword = !showRegisterPassword">
											<UIcon
:name="showRegisterPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
												class="w-4 h-4" />
										</button>
									</template>
								</UInput>
							</UFormField>

							<div class="space-y-3 pt-1">
								<UFormField name="agree_terms">
									<UCheckbox v-model="registerForm.agree_terms" required>
										<template #label>
											<span class="text-sm">
												{{ t('auth.termsPrefix') }}
												<ULink
to="#"
													class="text-primary underline underline-offset-2 hover:opacity-80">
													{{ t('auth.termsLink') }}
												</ULink>
												{{ t('auth.termsAnd') }}
												<ULink
to="#"
													class="text-primary underline underline-offset-2 hover:opacity-80">
													{{ t('auth.privacyLink') }}
												</ULink>
											</span>
										</template>
									</UCheckbox>
								</UFormField>

								<UFormField name="agree_marketing">
									<UCheckbox v-model="registerForm.agree_marketing">
										<template #label>
											<span class="text-sm">
												{{ t('auth.marketingConsent') }}
											</span>
										</template>
									</UCheckbox>
								</UFormField>
							</div>

							<UAlert
v-if="registerError" color="error" variant="soft" icon="i-lucide-circle-alert"
								:description="registerError" />

							<UButton
type="submit" class="w-full justify-center" size="lg" :loading="registerLoading"
								:disabled="!registerForm.agree_terms">
								{{ t('auth.registerSubmit') }}
							</UButton>

						</UForm>
					</template>

				</UTabs>
			</UCard>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { RegisterCreate, TokenResponse } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'
import { t } from '~/constants/translations'

definePageMeta({ layout: 'auth' })

const { post } = useApi()
const auth = useAuthStore()

onMounted(() => {
	if (auth.isAuthenticated.value) {
		void navigateTo('/requests')
	}
})

const route = useRoute()
const referralCode = computed(() => {
	const value = route.query.ref
	if (Array.isArray(value)) return value[0]?.trim() ?? ''
	return typeof value === 'string' ? value.trim() : ''
})
const canRegister = computed(() => referralCode.value.length > 0)
const activeTab = ref(
	canRegister.value && route.query.tab === 'register' ? 'register' : 'login',
)

const tabs = computed(() => [
	{ label: t('auth.loginTab'), slot: 'login', icon: 'i-lucide-log-in', value: 'login' },
	...(canRegister.value
		? [{ label: t('auth.registerTab'), slot: 'register', icon: 'i-lucide-user-plus', value: 'register' }]
		: []),
])

watch(canRegister, (available) => {
	if (!available && activeTab.value === 'register') {
		activeTab.value = 'login'
	}
	if (available && route.query.tab === 'register') {
		activeTab.value = 'register'
	}
})

const loginSchema = z.object({
	email: z.string().email(t('auth.emailInvalid')),
	password: z.string().min(8, t('auth.passwordMin')),
})

const registerSchema = z.object({
	email: z.string().email(t('auth.emailInvalid')),
	full_name: z.string().min(2, t('auth.nameMin')),
	company_name: z.string().optional(),
	phone: z
		.string()
		.min(1, t('auth.phoneRequired'))
		.refine((val) => isValidPhoneNumber(val), t('auth.phoneInvalid')),
	password: z.string().min(8, t('auth.passwordMin')),
	agree_terms: z.boolean().optional(),
	agree_marketing: z.boolean().optional(),
})

const loginForm = reactive({ email: '', password: '' })
const loginError = ref('')
const loginLoading = ref(false)
const showLoginPassword = ref(false)

async function handleLogin() {
	if (loginLoading.value) return
	loginLoading.value = true
	loginError.value = ''
	try {
		const params = new URLSearchParams()
		params.append('username', loginForm.email)
		params.append('password', loginForm.password)
		const data = await post<TokenResponse>('/auth/token', params, {
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		})
		auth.setToken(data.access_token)
		await navigateTo('/requests')
	} catch (e: unknown) {
		loginError.value = getApiErrorDetail(e) ?? t('auth.serverError')
	} finally {
		loginLoading.value = false
	}
}

const registerForm = reactive({
	email: '',
	password: '',
	full_name: '',
	company_name: '',
	phone: '',
	agree_terms: false,
	agree_marketing: false,
})
const registerError = ref('')
const registerLoading = ref(false)
const showRegisterPassword = ref(false)

async function handleRegister() {
	if (registerLoading.value || !registerForm.agree_terms || !canRegister.value) return
	registerLoading.value = true
	registerError.value = ''
	try {
		const payload: RegisterCreate = {
			email: registerForm.email,
			password: registerForm.password,
			full_name: registerForm.full_name,
			company_name: registerForm.company_name || null,
			phone: registerForm.phone,
			referral_code: referralCode.value,
			agree_terms: registerForm.agree_terms,
			agree_marketing: registerForm.agree_marketing,
		}
		const data = await post<TokenResponse>('/auth/register', payload)
		auth.setToken(data.access_token)
		await navigateTo('/requests')
	} catch (e: unknown) {
		registerError.value = getApiErrorDetail(e) ?? t('auth.registerError')
	} finally {
		registerLoading.value = false
	}
}
</script>
