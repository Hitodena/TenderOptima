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
							<h1 class="text-lg font-bold text-highlighted leading-tight">
								{{ t('profile.settingsTitle') }}
							</h1>
							<p class="text-xs text-muted">{{ t('profile.settingsDescription') }}</p>
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
							<h2 class="text-base font-semibold mb-0.5">{{ t('profile.profileTitle') }}</h2>
							<p class="text-sm text-muted mb-5">{{ t('profile.profileDescription') }}</p>

							<div class="space-y-4">
								<UFormField :label="t('profile.fullNameLabel')" name="full_name">
									<UInput
v-model="form.full_name" placeholder="Иван Иванов" icon="i-lucide-user"
										class="w-full" />
								</UFormField>

								<UFormField :label="t('profile.companyNameLabel')" name="company_name">
									<UInput
v-model="form.company_name" placeholder="ООО «Ваша компания»"
										icon="i-lucide-building-2" class="w-full" />
								</UFormField>

								<UFormField :label="t('profile.contactEmailLabel')" name="contact_email">
									<UInput
v-model="form.contact_email" type="email" placeholder="sales@company.ru"
										icon="i-lucide-mail" class="w-full" />
								</UFormField>

								<UFormField
									:label="t('profile.phoneLabel')" name="phone"
									:hint="t('profile.phoneLockedHint')">
									<UInput
:model-value="user?.phone || t('profile.phoneMissing')" icon="i-lucide-phone"
										class="w-full" disabled />
								</UFormField>

								<UAlert
v-if="profileError" color="error" variant="soft" icon="i-lucide-circle-alert"
									:description="profileError" />

								<UAlert
v-if="profileSuccess" color="success" variant="soft" icon="i-lucide-check"
									:description="t('profile.profileSaved')" />

								<div class="flex justify-end">
									<UButton :loading="savingProfile" leading-icon="i-lucide-save" @click="saveProfile">
										{{ t('profile.save') }}
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
							<h2 class="text-base font-semibold mb-0.5">{{ t('profile.contactTitle') }}</h2>
							<p class="text-sm text-muted mb-5">{{ t('profile.contactDescription') }}</p>

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
						<h2 class="font-semibold">{{ t('profile.accountTitle') }}</h2>
					</div>
				</template>

				<div class="space-y-4">
					<div>
						<p class="text-sm text-muted">
							{{ t('profile.signedInAs') }}
							<span class="text-primary font-medium">{{ user?.email }}</span>
						</p>
					</div>

					<p class="text-sm text-muted">
						{{ t('profile.logoutDescription') }}
					</p>

					<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
						<UButton color="error" variant="soft" leading-icon="i-lucide-log-out" @click="handleLogout">
							{{ t('profile.logout') }}
						</UButton>
					</div>

					<USeparator />

					<div class="space-y-3 rounded-xl border border-error/20 bg-error/5 p-4">
						<div>
							<h3 class="text-sm font-semibold text-highlighted">
								{{ t('profile.consentActionsTitle') }}
							</h3>
							<p class="mt-1 text-sm text-muted">
								{{ t('profile.consentActionsDescription') }}
							</p>
						</div>
						<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
							<UButton
								color="warning"
								variant="soft"
								leading-icon="i-lucide-file-x"
								@click="openDestructiveAction('revoke')"
							>
								{{ t('profile.revokeConsent') }}
							</UButton>
							<UButton
								color="error"
								variant="solid"
								leading-icon="i-lucide-trash-2"
								@click="openDestructiveAction('delete')"
							>
								{{ t('profile.deleteAccount') }}
							</UButton>
						</div>
					</div>
				</div>
			</UCard>

			<div
				v-if="destructiveModalOpen"
				class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
				role="dialog"
				aria-modal="true"
				:aria-label="destructiveTitle"
				@click.self="handleDestructiveOverlayClose"
			>
				<div class="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-default bg-default shadow-2xl">
					<div class="flex items-start justify-between gap-3 border-b border-default p-4 sm:p-5">
						<div>
							<h2 class="text-base font-semibold text-highlighted">
								{{ destructiveTitle }}
							</h2>
							<p class="mt-1 text-sm text-muted">
								{{ destructiveDescription }}
							</p>
						</div>
						<button
							type="button"
							class="rounded-md p-1 text-muted transition-colors hover:bg-elevated hover:text-default disabled:cursor-not-allowed disabled:opacity-50"
							:aria-label="t('profile.destructiveCancel')"
							:disabled="destructiveLoading"
							@click="handleDestructiveBack"
						>
							<UIcon name="i-lucide-x" class="size-5" />
						</button>
					</div>

					<div class="space-y-4 overflow-y-auto p-4 sm:p-5">
						<UAlert
							color="warning"
							variant="soft"
							icon="i-lucide-triangle-alert"
							:description="destructiveBody"
						/>

						<UFormField :label="t('profile.destructiveReasonLabel')">
							<UTextarea
								v-model="destructiveReason"
								:placeholder="t('profile.destructiveReasonPlaceholder')"
								:rows="3"
								class="w-full"
							/>
						</UFormField>

						<div v-if="destructiveStep === 'confirm'" class="rounded-xl border border-error/30 p-3">
							<p class="mb-3 text-sm font-medium text-highlighted">
								{{ t('profile.destructiveSecondStep') }}
							</p>
							<UCheckbox v-model="destructiveAcknowledged" :label="t('profile.destructiveAcknowledge')" />
						</div>
					</div>

					<div class="border-t border-default p-4 sm:p-5">
					<div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<button
							type="button"
							class="inline-flex cursor-pointer items-center justify-center rounded-md border border-default px-3 py-2 text-sm font-medium text-default transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
							:disabled="destructiveLoading"
							@click="handleDestructiveBack"
						>
							{{ destructiveStep === 'confirm'
								? t('profile.destructiveBack')
								: t('profile.destructiveCancel') }}
						</button>
						<button
							type="button"
							class="inline-flex cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-inverted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
							:class="destructiveAction === 'delete'
								? 'bg-error hover:bg-error/90'
								: 'bg-warning hover:bg-warning/90'"
							:disabled="destructiveLoading || (destructiveStep === 'confirm' && !destructiveAcknowledged)"
							@click="handleDestructiveContinue"
						>
							<UIcon
								v-if="destructiveLoading"
								name="i-lucide-loader-circle"
								class="mr-2 size-4 animate-spin"
							/>
							{{ destructiveConfirmLabel }}
						</button>
					</div>
					</div>
				</div>
			</div>

		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type {
	ConsentActionResponse,
	UserEmailSettingsResponse,
	UserEmailSettingsUpdate,
	UserResponse,
	UserUpdate,
} from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { t } from '~/constants/translations'

definePageMeta({ layout: 'default' })

const { get, patch, post, del } = useApi()
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
	{ label: t('profile.actsTab'), slot: 'acts', value: 'acts', icon: 'i-lucide-file-text' },
	{ label: t('profile.businessCardTitle'), slot: 'business_card', value: 'business_card', icon: 'i-lucide-id-card' },
	{ label: t('profile.mailTab'), slot: 'mail', value: 'mail', icon: 'i-lucide-mail' },
	{ label: t('profile.profileTab'), slot: 'profile', value: 'profile', icon: 'i-lucide-user' },
	{ label: t('profile.contactTab'), slot: 'contact', value: 'contact', icon: 'i-lucide-headphones' },
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
		cardError.value = getApiErrorDetail(e) ?? t('profile.saveError')
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
		profileError.value = getApiErrorDetail(e) ?? t('profile.saveError')
	} finally {
		savingProfile.value = false
	}
}

type DestructiveAction = 'revoke' | 'delete'
type DestructiveStep = 'details' | 'confirm'

const destructiveModalOpen = ref(false)
const destructiveAction = ref<DestructiveAction>('revoke')
const destructiveStep = ref<DestructiveStep>('details')
const destructiveReason = ref('')
const destructiveAcknowledged = ref(false)
const destructiveLoading = ref(false)

const destructiveTitle = computed(() =>
	destructiveAction.value === 'delete'
		? t('profile.deleteAccountTitle')
		: t('profile.revokeConsentTitle'),
)
const destructiveDescription = computed(() =>
	destructiveAction.value === 'delete'
		? t('profile.deleteAccountDescription')
		: t('profile.revokeConsentDescription'),
)
const destructiveBody = computed(() =>
	destructiveAction.value === 'delete'
		? t('profile.deleteAccountBody')
		: t('profile.revokeConsentBody'),
)
const destructiveConfirmLabel = computed(() => {
	if (destructiveStep.value === 'details') {
		return t('profile.destructiveSecondStep')
	}
	return destructiveAction.value === 'delete'
		? t('profile.deleteAccountConfirm')
		: t('profile.revokeConsentConfirm')
})

function openDestructiveAction(action: DestructiveAction) {
	destructiveAction.value = action
	destructiveStep.value = 'details'
	destructiveReason.value = ''
	destructiveAcknowledged.value = false
	destructiveModalOpen.value = true
}

function handleDestructiveBack() {
	if (destructiveStep.value === 'confirm') {
		destructiveStep.value = 'details'
		destructiveAcknowledged.value = false
		return
	}
	destructiveModalOpen.value = false
}

function handleDestructiveOverlayClose() {
	if (destructiveLoading.value) return
	handleDestructiveBack()
}

async function handleDestructiveContinue() {
	if (destructiveStep.value === 'details') {
		destructiveStep.value = 'confirm'
		destructiveAcknowledged.value = false
		return
	}
	if (!destructiveAcknowledged.value || destructiveLoading.value) return

	destructiveLoading.value = true
	const payload = {
		acknowledged: true,
		reason: destructiveReason.value.trim() || null,
	}
	try {
		if (destructiveAction.value === 'delete') {
			await del<ConsentActionResponse>('/auth/me', { data: payload })
		} else {
			await post<ConsentActionResponse>('/auth/me/consent/revoke', payload)
		}
		auth.clearToken()
		await navigateTo('/auth')
	} catch (e: unknown) {
		const toast = useToast()
		toast.add({
			title: getApiErrorDetail(e)
				?? (destructiveAction.value === 'delete'
					? t('profile.deleteAccountError')
					: t('profile.revokeConsentError')),
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	} finally {
		destructiveLoading.value = false
	}
}

function handleLogout() {
	auth.clearToken()
	navigateTo('/auth')
}
</script>
