<template>
	<div class="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
		<div class="w-full max-w-md">

			<div class="text-center mb-8">
				<div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
					<UIcon name="i-lucide-package-search" class="w-6 h-6 text-white" />
				</div>
				<h1 class="text-2xl font-bold text-highlighted">TenderOptima</h1>
				<p class="text-sm text-muted mt-1">Автоматический поиск поставщиков B2B</p>
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

							<UFormField label="Пароль" name="password" required>
								<UInput
v-model="loginForm.password" :type="showLoginPassword ? 'text' : 'password'"
									placeholder="••••••••" icon="i-lucide-lock" class="w-full"
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
								Войти
							</UButton>

						</UForm>
					</template>

					<template #register>
						<UForm
:schema="registerSchema" :state="registerForm" class="space-y-4"
							@submit="handleRegister">

							<UFormField label="Email" name="email" required>
								<UInput
v-model="registerForm.email" type="email" placeholder="you@company.com"
									icon="i-lucide-mail" class="w-full" autocomplete="email" />
							</UFormField>

							<div class="grid grid-cols-2 gap-3">
								<UFormField label="Полное имя" name="full_name" required>
									<UInput
v-model="registerForm.full_name" placeholder="Иван Иванов"
										icon="i-lucide-user" class="w-full" autocomplete="name" />
								</UFormField>

								<UFormField label="Компания" name="company_name">
									<UInput
v-model="registerForm.company_name" placeholder="ООО Ромашка"
										icon="i-lucide-building-2" class="w-full" autocomplete="organization" />
								</UFormField>
							</div>

							<UFormField label="Пароль" name="password" required hint="Минимум 8 символов">
								<UInput
v-model="registerForm.password"
									:type="showRegisterPassword ? 'text' : 'password'" placeholder="••••••••"
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
												Я принимаю
												<ULink
to="#"
													class="text-primary underline underline-offset-2 hover:opacity-80">
													условия использования
												</ULink>
												и
												<ULink
to="#"
													class="text-primary underline underline-offset-2 hover:opacity-80">
													политику конфиденциальности
												</ULink>
											</span>
										</template>
									</UCheckbox>
								</UFormField>

								<UFormField name="agree_marketing">
									<UCheckbox v-model="registerForm.agree_marketing">
										<template #label>
											<span class="text-sm">
												Согласен на получение маркетинговых уведомлений
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
								Создать аккаунт
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
import { z } from 'zod'

definePageMeta({ layout: 'auth' })

const { post } = useApi()
const auth = useAuthStore()

onMounted(() => {
	if (auth.isAuthenticated.value) {
		void navigateTo('/requests')
	}
})

const route = useRoute()
const activeTab = ref(
	route.query.tab === 'register' ? 'register' : 'login',
)

const tabs = [
	{ label: 'Войти', slot: 'login', icon: 'i-lucide-log-in', value: 'login' },
	{ label: 'Регистрация', slot: 'register', icon: 'i-lucide-user-plus', value: 'register' },
]

const loginSchema = z.object({
	email: z.string().email('Неверный формат email'),
	password: z.string().min(8, 'Минимум 8 символов'),
})

const registerSchema = z.object({
	email: z.string().email('Неверный формат email'),
	full_name: z.string().min(2, 'Минимум 2 символа'),
	company_name: z.string().optional(),
	password: z.string().min(8, 'Минимум 8 символов'),
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
		loginError.value = getApiErrorDetail(e) ?? 'Внутренняя ошибка сервера'
	} finally {
		loginLoading.value = false
	}
}

const registerForm = reactive({
	email: '',
	password: '',
	full_name: '',
	company_name: '',
	agree_terms: false,
	agree_marketing: false,
})
const registerError = ref('')
const registerLoading = ref(false)
const showRegisterPassword = ref(false)

async function handleRegister() {
	if (registerLoading.value || !registerForm.agree_terms) return
	registerLoading.value = true
	registerError.value = ''
	try {
		const payload: RegisterCreate = {
			email: registerForm.email,
			password: registerForm.password,
			full_name: registerForm.full_name,
			company_name: registerForm.company_name || null,
			agree_terms: registerForm.agree_terms,
			agree_marketing: registerForm.agree_marketing,
		}
		const data = await post<TokenResponse>('/auth/register', payload)
		auth.setToken(data.access_token)
		await navigateTo('/requests')
	} catch (e: unknown) {
		registerError.value = getApiErrorDetail(e) ?? 'Ошибка регистрации'
	} finally {
		registerLoading.value = false
	}
}
</script>
