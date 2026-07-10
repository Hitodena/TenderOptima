<template>
	<UContainer class="py-8">
		<div class="max-w-6xl mx-auto space-y-4">

			<UCard>
				<template #header>
					<div class="flex items-center gap-3">
						<div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
							<UIcon name="i-lucide-settings" class="w-4.5 h-4.5 text-primary" />
						</div>
						<div>
							<h1 class="text-lg font-bold text-highlighted leading-tight">Настройки</h1>
							<p class="text-xs text-muted">Настройте параметры вашей учетной записи</p>
						</div>
					</div>
				</template>

				<UTabs v-model="activeTab" :items="tabs" :ui="{ list: 'mb-6' }">

				<template #acts>
					<div class="space-y-8">
						<ProfileBillingPanel />
					</div>
				</template>

					<template #business_card>
						<div>
							<h2 class="text-base font-semibold mb-0.5">{{ t('profile.businessCardTitle') }}</h2>
							<p class="text-sm text-muted mb-5">
								{{ t('profile.businessCardDescription') }}
							</p>

							<UCard :ui="{ body: 'p-5' }">
								<h3 class="font-semibold text-highlighted mb-1">
									{{ t('profile.businessCardSettingsTitle') }}
								</h3>
								<p class="text-sm text-muted mb-5">
									{{ t('profile.businessCardSettingsDescription') }}
								</p>

								<UFormField :label="t('profile.businessCardTextLabel')" class="mb-2">
									<UTextarea
										v-model="form.business_info"
										:rows="5"
										:maxrows="14"
										class="w-full"
										:placeholder="t('profile.businessCardPlaceholder')"
										autoresize
									/>
								</UFormField>

								<p class="text-xs text-primary mb-5">
									{{ t('profile.businessCardHint') }}
								</p>

								<UAlert
v-if="cardError" color="error" variant="soft" icon="i-lucide-circle-alert"
									:description="cardError" class="mb-4" />

								<UAlert
v-if="cardSuccess" color="success" variant="soft" icon="i-lucide-check"
									:description="t('profile.businessCardSaved')" class="mb-4" />

								<UButton
block :loading="savingCard" leading-icon="i-lucide-save"
									@click="saveBusinessCard">
									{{ t('profile.save') }}
								</UButton>
							</UCard>
						</div>
					</template>

					<template #profile>
						<div>
							<h2 class="text-base font-semibold mb-0.5">Профиль</h2>
							<p class="text-sm text-muted mb-5">Обновите личные данные</p>

							<div class="space-y-4">
								<UFormField label="Полное имя" name="full_name">
									<UInput
v-model="form.full_name" placeholder="Иван Иванов" icon="i-lucide-user"
										class="w-full" />
								</UFormField>

								<UFormField label="Название компании" name="company_name">
									<UInput
v-model="form.company_name" placeholder="ООО «Ваша компания»"
										icon="i-lucide-building-2" class="w-full" />
								</UFormField>

								<UFormField label="Контактный email" name="contact_email">
									<UInput
v-model="form.contact_email" type="email" placeholder="sales@company.ru"
										icon="i-lucide-mail" class="w-full" />
								</UFormField>

								<UFormField
label="Телефон" name="phone"
									hint="Указан при регистрации, изменить нельзя">
									<UInput
:model-value="user?.phone || 'Не указан'" icon="i-lucide-phone"
										class="w-full" disabled />
								</UFormField>

								<UAlert
v-if="profileError" color="error" variant="soft" icon="i-lucide-circle-alert"
									:description="profileError" />

								<UAlert
v-if="profileSuccess" color="success" variant="soft" icon="i-lucide-check"
									description="Профиль обновлён" />

								<div class="flex justify-end">
									<UButton :loading="savingProfile" leading-icon="i-lucide-save" @click="saveProfile">
										Сохранить
									</UButton>
								</div>
							</div>
						</div>
					</template>

					<template #mail>
						<div>
							<h2 class="text-base font-semibold mb-0.5">{{ t('profile.mailTitle') }}</h2>
							<p class="text-sm text-muted mb-5">{{ t('profile.mailDescription') }}</p>

							<UAlert
								v-if="mailLoadError"
								color="error"
								variant="soft"
								icon="i-lucide-circle-alert"
								:description="mailLoadError"
								class="mb-4"
							/>

							<UCard v-else :ui="{ body: 'p-5 space-y-6' }">
								<UFormField
									:label="t('profile.currentSenderEmail')"
									:hint="t('profile.currentSenderHint')"
								>
									<UInput
										:model-value="mailSettings?.current_sender_email ?? '—'"
										class="w-full"
										icon="i-lucide-mail"
										disabled
										readonly
									/>
								</UFormField>

								<div class="border-t border-default pt-4">
									<div class="flex items-center justify-between gap-3 mb-3">
										<h3 class="text-sm font-semibold">{{ t('profile.customMailboxSection') }}</h3>
										<UButton
											size="xs"
											variant="ghost"
											color="neutral"
											:icon="customMailboxOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
											@click="customMailboxOpen = !customMailboxOpen"
										>
											{{ customMailboxOpen
												? t('profile.customMailboxCollapse')
												: t('profile.customMailboxExpand') }}
										</UButton>
									</div>

									<div v-show="customMailboxOpen" class="space-y-6">
								<p class="text-sm text-muted">{{ t('profile.mailManual') }}</p>

								<div>
									<h3 class="text-sm font-semibold mb-3">{{ t('profile.smtpSection') }}</h3>
									<div class="grid gap-3 sm:grid-cols-2">
										<UFormField :label="t('profile.smtpHost')">
											<UInput v-model="mailForm.smtp_host" class="w-full" placeholder="smtp.example.com" />
										</UFormField>
										<UFormField :label="t('profile.smtpUser')">
											<UInput v-model="mailForm.smtp_user" class="w-full" />
										</UFormField>
										<UFormField
											:label="t('profile.smtpPassword')"
											class="sm:col-span-2"
											:hint="mailSettings?.smtp_password_configured ? t('profile.passwordConfiguredHint') : undefined"
										>
											<UInput
												v-model="mailForm.smtp_password"
												type="password"
												class="w-full"
												autocomplete="new-password"
											/>
										</UFormField>
										<UCheckbox
											v-if="mailSettings?.smtp_password_configured"
											v-model="mailForm.clear_smtp_password"
											:label="t('profile.clearPassword')"
											class="sm:col-span-2"
										/>
									</div>
								</div>

								<div>
									<h3 class="text-sm font-semibold mb-3">{{ t('profile.imapSection') }}</h3>
									<div class="grid gap-3 sm:grid-cols-2">
										<UFormField :label="t('profile.imapHost')">
											<UInput v-model="mailForm.imap_host" class="w-full" placeholder="imap.example.com" />
										</UFormField>
										<UFormField :label="t('profile.imapUser')">
											<UInput v-model="mailForm.imap_user" class="w-full" />
										</UFormField>
										<UFormField
											:label="t('profile.imapPassword')"
											class="sm:col-span-2"
											:hint="mailSettings?.imap_password_configured ? t('profile.passwordConfiguredHint') : undefined"
										>
											<UInput
												v-model="mailForm.imap_password"
												type="password"
												class="w-full"
												autocomplete="new-password"
											/>
										</UFormField>
										<UCheckbox
											v-if="mailSettings?.imap_password_configured"
											v-model="mailForm.clear_imap_password"
											:label="t('profile.clearPassword')"
											class="sm:col-span-2"
										/>
									</div>
								</div>

								<UAlert
									v-if="mailError"
									color="error"
									variant="soft"
									icon="i-lucide-circle-alert"
									:description="mailError"
								/>
								<UAlert
									v-if="mailSuccess"
									color="success"
									variant="soft"
									icon="i-lucide-check"
									:description="t('profile.mailSaved')"
								/>

								<UButton
									block
									:loading="savingMail"
									leading-icon="i-lucide-save"
									@click="saveMailSettings"
								>
									{{ t('profile.saveMail') }}
								</UButton>
									</div>
								</div>
							</UCard>
						</div>
					</template>

					<template #contact>
						<div>
							<h2 class="text-base font-semibold mb-0.5">Контактная информация</h2>
							<p class="text-sm text-muted mb-5">Служба поддержки</p>

							<div class="space-y-3">
								<div class="flex items-center gap-3 p-3 rounded-xl bg-elevated/50">
									<div
										class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
										<UIcon name="i-lucide-mail" class="w-4 h-4 text-primary" />
									</div>
									<div>
										<p class="text-xs text-muted mb-0.5">Email</p>
										<a
:href="`mailto:${publicConfig.contactEmail}`"
											class="text-sm font-medium text-primary hover:underline underline-offset-2 transition-opacity hover:opacity-80">
											{{ publicConfig.contactEmail }}
										</a>
									</div>
								</div>

								<div class="flex items-center gap-3 p-3 rounded-xl bg-elevated/50">
									<div
										class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
										<UIcon name="i-lucide-phone" class="w-4 h-4 text-primary" />
									</div>
									<div>
										<p class="text-xs text-muted mb-0.5">Телефон</p>
										<a
:href="`tel:${contactPhoneHref}`"
											class="text-sm font-medium text-primary hover:underline underline-offset-2 transition-opacity hover:opacity-80">
											{{ publicConfig.contactPhone }}
										</a>
									</div>
								</div>
							</div>
						</div>
					</template>

			</UTabs>
			</UCard>

			<UCard>
				<template #header>
					<div class="flex items-center gap-2">
						<UIcon name="i-lucide-log-out" class="w-4.5 h-4.5 text-muted" />
						<h2 class="font-semibold">Учетная запись</h2>
					</div>
				</template>

				<div class="space-y-4">
					<div>
						<p class="text-sm text-muted">
							Вы вошли как:
							<span class="text-primary font-medium">{{ user?.email }}</span>
						</p>
					</div>

					<p class="text-sm text-muted">
						Нажмите на кнопку ниже, чтобы выйти из системы и завершить сессию.
					</p>

					<UButton color="error" variant="soft" leading-icon="i-lucide-log-out" @click="handleLogout">
						Выйти
					</UButton>
				</div>
			</UCard>

		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { UserResponse, UserUpdate, UserEmailSettingsResponse, UserEmailSettingsUpdate } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { t } from '~/constants/translations'

definePageMeta({ layout: 'default' })

const { get, patch } = useApi()
const auth = useAuthStore()
const route = useRoute()
const { public: publicConfig } = useRuntimeConfig()
const contactPhoneHref = computed(() =>
	String(publicConfig.contactPhone).replace(/\s/g, ''),
)

const user = ref<UserResponse | null>(null)

try {
	user.value = await get<UserResponse>('/auth/me')
} catch {
	user.value = null
}

const form = reactive({
	business_info: user.value?.business_info ?? '',
	full_name: user.value?.full_name ?? '',
	company_name: user.value?.company_name ?? '',
	contact_email: user.value?.contact_email ?? '',
})

const tabs = computed(() => [
	{ label: 'Акты', slot: 'acts', value: 'acts', icon: 'i-lucide-file-text' },
	{ label: 'Визитная карточка', slot: 'business_card', value: 'business_card', icon: 'i-lucide-id-card' },
	{ label: t('profile.mailTab'), slot: 'mail', value: 'mail', icon: 'i-lucide-mail' },
	{ label: 'Профиль', slot: 'profile', value: 'profile', icon: 'i-lucide-user' },
	{ label: 'Свяжитесь с нами', slot: 'contact', value: 'contact', icon: 'i-lucide-headphones' },
])

const tabFromQuery = computed(() => {
	const raw = route.query.tab
	return typeof raw === 'string' ? raw : null
})

const activeTab = ref('acts')

watch(
	tabFromQuery,
	(tab) => {
		if (tab && tabs.value.some((item) => item.value === tab)) {
			activeTab.value = tab
		}
		if (tab === 'mail') {
			void loadMailSettings()
		}
	},
	{ immediate: true },
)

watch(activeTab, (tab) => {
	if (route.query.tab === tab) return
	navigateTo({ path: '/profile', query: { tab } }, { replace: true })
	if (tab === 'mail' && !mailSettings.value && !mailLoadError.value) {
		void loadMailSettings()
	}
})

const customMailboxOpen = ref(false)
const mailSettings = ref<UserEmailSettingsResponse | null>(null)
const mailForm = reactive({
	smtp_host: '',
	smtp_user: '',
	smtp_password: '',
	clear_smtp_password: false,
	imap_host: '',
	imap_user: '',
	imap_password: '',
	clear_imap_password: false,
})
const savingMail = ref(false)
const mailError = ref<string | null>(null)
const mailSuccess = ref(false)
const mailLoadError = ref<string | null>(null)

function fillMailForm(settings: UserEmailSettingsResponse) {
	mailForm.smtp_host = settings.smtp_host ?? ''
	mailForm.smtp_user = settings.smtp_user ?? ''
	mailForm.smtp_password = ''
	mailForm.clear_smtp_password = false
	mailForm.imap_host = settings.imap_host ?? ''
	mailForm.imap_user = settings.imap_user ?? ''
	mailForm.imap_password = ''
	mailForm.clear_imap_password = false
}

async function loadMailSettings() {
	mailLoadError.value = null
	try {
		mailSettings.value = await get<UserEmailSettingsResponse>('/auth/me/email-settings')
		fillMailForm(mailSettings.value)
	} catch (e: unknown) {
		mailLoadError.value = getApiErrorDetail(e) ?? t('profile.mailLoadError')
	}
}

async function saveMailSettings() {
	if (savingMail.value) return
	savingMail.value = true
	mailError.value = null
	mailSuccess.value = false
	try {
		const payload: UserEmailSettingsUpdate = {
			smtp_host: mailForm.smtp_host.trim() || null,
			smtp_user: mailForm.smtp_user.trim() || null,
			imap_host: mailForm.imap_host.trim() || null,
			imap_user: mailForm.imap_user.trim() || null,
			clear_smtp_password: mailForm.clear_smtp_password,
			clear_imap_password: mailForm.clear_imap_password,
		}
		if (mailForm.smtp_password.trim()) {
			payload.smtp_password = mailForm.smtp_password
		}
		if (mailForm.imap_password.trim()) {
			payload.imap_password = mailForm.imap_password
		}
		mailSettings.value = await patch<UserEmailSettingsResponse>(
			'/auth/me/email-settings',
			payload,
		)
		fillMailForm(mailSettings.value)
		mailSuccess.value = true
		setTimeout(() => { mailSuccess.value = false }, 3000)
	} catch (e: unknown) {
		mailError.value = getApiErrorDetail(e) ?? t('profile.mailSaveError')
	} finally {
		savingMail.value = false
	}
}

const savingCard = ref(false)
const cardError = ref<string | null>(null)
const cardSuccess = ref(false)

async function saveBusinessCard() {
	if (savingCard.value) return
	savingCard.value = true
	cardError.value = null
	cardSuccess.value = false
	try {
		const payload: UserUpdate = { business_info: form.business_info || null }
		await patch('/auth/me', payload)
		cardSuccess.value = true
		setTimeout(() => { cardSuccess.value = false }, 3000)
	} catch (e: unknown) {
		cardError.value = getApiErrorDetail(e) ?? 'Ошибка при сохранении'
	} finally {
		savingCard.value = false
	}
}

const savingProfile = ref(false)
const profileError = ref<string | null>(null)
const profileSuccess = ref(false)

async function saveProfile() {
	if (savingProfile.value) return
	savingProfile.value = true
	profileError.value = null
	profileSuccess.value = false
	try {
		const payload: UserUpdate = {
			full_name: form.full_name || null,
			company_name: form.company_name.trim() || null,
			contact_email: form.contact_email || null,
		}
		await patch('/auth/me', payload)
		profileSuccess.value = true
		setTimeout(() => { profileSuccess.value = false }, 3000)
	} catch (e: unknown) {
		profileError.value = getApiErrorDetail(e) ?? 'Ошибка при сохранении'
	} finally {
		savingProfile.value = false
	}
}

function handleLogout() {
	auth.clearToken()
	navigateTo('/auth')
}
</script>
