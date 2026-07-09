<template>
	<div class="space-y-6">
		<div>
			<h2 class="text-base font-semibold mb-0.5">Админка</h2>
			<p class="text-sm text-muted mb-5">
				Настройки почты и подписок пользователей
			</p>
		</div>

		<UAlert
			v-if="loadError"
			color="error"
			variant="soft"
			icon="i-lucide-circle-alert"
			:description="loadError"
		/>

		<div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
			<UCard :ui="{ body: 'p-0' }">
				<template #header>
					<p class="font-semibold">Пользователи</p>
				</template>
				<div class="max-h-112 overflow-y-auto divide-y divide-default">
					<button
						v-for="item in users"
						:key="item.id"
						type="button"
						class="w-full px-4 py-3 text-left hover:bg-elevated/60 transition-colors"
						:class="selectedUserId === item.id ? 'bg-elevated/80' : ''"
						@click="selectUser(item.id)"
					>
						<p class="font-medium text-sm truncate">{{ item.email }}</p>
						<p class="text-xs text-muted truncate">
							{{ item.full_name || 'Без имени' }}
							<span v-if="item.company_name"> · {{ item.company_name }}</span>
						</p>
					</button>
				</div>
			</UCard>

			<div v-if="selectedUser" class="space-y-4">
				<UCard>
					<template #header>
						<div>
							<p class="font-semibold">{{ selectedUser.email }}</p>
							<p class="text-xs text-muted">
								{{ selectedUser.full_name || 'Без имени' }}
							</p>
						</div>
					</template>

					<div class="space-y-5">
						<div>
							<h3 class="text-sm font-semibold mb-3">SMTP</h3>
							<div class="grid gap-3 sm:grid-cols-2">
								<UFormField label="SMTP host">
									<UInput v-model="emailForm.smtp_host" class="w-full" />
								</UFormField>
								<UFormField label="SMTP user">
									<UInput v-model="emailForm.smtp_user" class="w-full" />
								</UFormField>
								<UFormField
									label="SMTP password"
									class="sm:col-span-2"
									:hint="selectedUser.email_settings.smtp_password_configured
										? 'Пароль сохранён. Оставьте пустым, чтобы не менять.'
										: undefined"
								>
									<UInput
										v-model="emailForm.smtp_password"
										type="password"
										class="w-full"
										placeholder="Новый пароль"
									/>
								</UFormField>
							</div>
						</div>

						<div>
							<h3 class="text-sm font-semibold mb-3">IMAP</h3>
							<div class="grid gap-3 sm:grid-cols-2">
								<UFormField label="IMAP host">
									<UInput v-model="emailForm.imap_host" class="w-full" />
								</UFormField>
								<UFormField label="IMAP user">
									<UInput v-model="emailForm.imap_user" class="w-full" />
								</UFormField>
								<UFormField
									label="IMAP password"
									class="sm:col-span-2"
									:hint="selectedUser.email_settings.imap_password_configured
										? 'Пароль сохранён. Оставьте пустым, чтобы не менять.'
										: undefined"
								>
									<UInput
										v-model="emailForm.imap_password"
										type="password"
										class="w-full"
										placeholder="Новый пароль"
									/>
								</UFormField>
							</div>
						</div>

						<UAlert
							v-if="emailError"
							color="error"
							variant="soft"
							icon="i-lucide-circle-alert"
							:description="emailError"
						/>
						<UAlert
							v-if="emailSuccess"
							color="success"
							variant="soft"
							icon="i-lucide-check"
							description="Почтовые настройки сохранены"
						/>

						<UButton
							block
							:loading="savingEmail"
							leading-icon="i-lucide-save"
							@click="saveEmailSettings"
						>
							Сохранить почту
						</UButton>
					</div>
				</UCard>

				<UCard>
					<template #header>
						<p class="font-semibold">Подписка</p>
					</template>

					<div class="space-y-4">
						<div class="grid gap-3 sm:grid-cols-2">
							<UFormField label="Тариф">
								<USelect
									v-model="subscriptionForm.plan"
									:items="planOptions"
									class="w-full"
									@update:model-value="onPlanChange"
								/>
							</UFormField>
							<UFormField label="Статус">
								<USelect
									v-model="subscriptionActive"
									:items="activeOptions"
									class="w-full"
								/>
							</UFormField>
						</div>

						<div class="flex flex-wrap gap-4">
							<UCheckbox v-model="subscriptionForm.module_1_enabled" label="Модуль 1" />
							<UCheckbox v-model="subscriptionForm.module_2_enabled" label="Модуль 2" />
							<UCheckbox
								v-model="useCustomLimits"
								label="Кастомные лимиты и цены"
								@update:model-value="onCustomLimitsToggle"
							/>
						</div>

						<div class="grid gap-3 sm:grid-cols-3">
							<UFormField label="Поиски / мес">
								<UInput
									v-model="subscriptionForm.max_searches_per_month"
									type="number"
									class="w-full"
									placeholder="индивидуально"
								/>
							</UFormField>
							<UFormField label="Email / мес">
								<UInput
									v-model="subscriptionForm.max_emails_per_month"
									type="number"
									class="w-full"
									placeholder="индивидуально"
								/>
							</UFormField>
							<UFormField label="КП / мес">
								<UInput
									v-model="subscriptionForm.max_kp_processed_per_month"
									type="number"
									class="w-full"
									placeholder="индивидуально"
								/>
							</UFormField>
						</div>

						<div class="grid gap-3 sm:grid-cols-2">
							<UFormField label="Geo">
								<UInput v-model="subscriptionForm.geo_code" class="w-full" />
							</UFormField>
							<UFormField label="Валюта">
								<UInput v-model="subscriptionForm.currency_code" class="w-full" />
							</UFormField>
						</div>

						<div class="grid gap-3 sm:grid-cols-3">
							<UFormField label="Модуль 1, цена">
								<UInput
									v-model="subscriptionForm.price_module_1_monthly"
									class="w-full"
									placeholder="индивидуально"
								/>
							</UFormField>
							<UFormField label="Модуль 2, цена">
								<UInput
									v-model="subscriptionForm.price_module_2_monthly"
									class="w-full"
									placeholder="индивидуально"
								/>
							</UFormField>
							<UFormField label="М1+М2, цена">
								<UInput
									v-model="subscriptionForm.price_bundle_monthly"
									class="w-full"
									placeholder="индивидуально"
								/>
							</UFormField>
						</div>

						<UAlert
							v-if="subscriptionError"
							color="error"
							variant="soft"
							icon="i-lucide-circle-alert"
							:description="subscriptionError"
						/>
						<UAlert
							v-if="subscriptionSuccess"
							color="success"
							variant="soft"
							icon="i-lucide-check"
							description="Подписка сохранена"
						/>

						<UButton
							block
							:loading="savingSubscription"
							leading-icon="i-lucide-save"
							@click="saveSubscription"
						>
							Сохранить подписку
						</UButton>
					</div>
				</UCard>
			</div>

			<div
				v-else
				class="flex flex-col items-center justify-center py-16 text-muted"
			>
				<UIcon name="i-lucide-users" class="w-10 h-10 opacity-40 mb-3" />
				<p>Выберите пользователя</p>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type {
	AdminUserDetail,
	AdminUserListItem,
	SubscriptionPlan,
	SubscriptionUpdate,
	UserEmailSettingsUpdate,
} from '#shared/types'
import { catalogForPlan } from '#shared/utils/subscriptionDisplay'
import { getApiErrorDetail } from '#shared/utils/apiError'

const { get, patch } = useApi()

const users = ref<AdminUserListItem[]>([])
const selectedUserId = ref<string | null>(null)
const selectedUser = ref<AdminUserDetail | null>(null)
const loadError = ref<string | null>(null)

const emailForm = reactive({
	smtp_host: '',
	smtp_user: '',
	smtp_password: '',
	imap_host: '',
	imap_user: '',
	imap_password: '',
})

const subscriptionForm = reactive({
	plan: 'basic' as SubscriptionPlan,
	module_1_enabled: true,
	module_2_enabled: false,
	max_searches_per_month: '',
	max_emails_per_month: '',
	max_kp_processed_per_month: '',
	geo_code: 'BY',
	currency_code: 'BYN',
	price_module_1_monthly: '',
	price_module_2_monthly: '',
	price_bundle_monthly: '',
})

const subscriptionActive = ref<'active' | 'inactive'>('active')
const useCustomLimits = ref(false)

function applyCatalogToForm(plan: SubscriptionPlan) {
	const catalog = catalogForPlan(plan)
	subscriptionForm.max_searches_per_month = catalog.max_searches_per_month?.toString() ?? ''
	subscriptionForm.max_emails_per_month = catalog.max_emails_per_month?.toString() ?? ''
	subscriptionForm.max_kp_processed_per_month = catalog.max_kp_processed_per_month?.toString() ?? ''
	subscriptionForm.price_module_1_monthly = catalog.price_module_1_monthly ?? ''
	subscriptionForm.price_module_2_monthly = catalog.price_module_2_monthly ?? ''
	subscriptionForm.price_bundle_monthly = catalog.price_bundle_monthly ?? ''
	subscriptionForm.module_1_enabled = catalog.module_1_enabled
	subscriptionForm.module_2_enabled = catalog.module_2_enabled
}

function priceEquals(
	stored: string | number | null | undefined,
	catalog: string | null,
): boolean {
	const left = stored == null || stored === '' ? null : Number(stored)
	const right = catalog == null || catalog === '' ? null : Number(catalog)
	if (left == null && right == null) return true
	if (left == null || right == null) return false
	return left === right
}

function limitsDifferFromCatalog(
	sub: NonNullable<AdminUserDetail['subscription']>,
): boolean {
	const catalog = catalogForPlan(sub.plan)
	return sub.max_searches_per_month !== catalog.max_searches_per_month
		|| sub.max_emails_per_month !== catalog.max_emails_per_month
		|| sub.max_kp_processed_per_month !== catalog.max_kp_processed_per_month
		|| !priceEquals(sub.price_module_1_monthly, catalog.price_module_1_monthly)
		|| !priceEquals(sub.price_module_2_monthly, catalog.price_module_2_monthly)
		|| !priceEquals(sub.price_bundle_monthly, catalog.price_bundle_monthly)
}

function onPlanChange(plan: SubscriptionPlan) {
	useCustomLimits.value = false
	applyCatalogToForm(plan)
}

function onCustomLimitsToggle(enabled: boolean | 'indeterminate') {
	if (enabled === true) return
	const plan = subscriptionForm.plan
	applyCatalogToForm(plan)
}

const planOptions = [
	{ label: 'Тестовый', value: 'test' },
	{ label: 'Базовый', value: 'basic' },
	{ label: 'Расширенный', value: 'advanced' },
	{ label: 'Корпоративный', value: 'corporate' },
]

const activeOptions = [
	{ label: 'Активна', value: 'active' },
	{ label: 'Неактивна', value: 'inactive' },
]

const savingEmail = ref(false)
const savingSubscription = ref(false)
const emailError = ref<string | null>(null)
const emailSuccess = ref(false)
const subscriptionError = ref<string | null>(null)
const subscriptionSuccess = ref(false)

function parseOptionalNumber(value: string | number | null | undefined): number | null {
	const trimmed = String(value ?? '').trim()
	if (!trimmed) return null
	const parsed = Number(trimmed)
	return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalPrice(value: string | number | null | undefined): string | null {
	const trimmed = String(value ?? '').trim()
	return trimmed || null
}

function fillForms(detail: AdminUserDetail) {
	emailForm.smtp_host = detail.email_settings.smtp_host ?? ''
	emailForm.smtp_user = detail.email_settings.smtp_user ?? ''
	emailForm.smtp_password = ''
	emailForm.imap_host = detail.email_settings.imap_host ?? ''
	emailForm.imap_user = detail.email_settings.imap_user ?? ''
	emailForm.imap_password = ''

	const sub = detail.subscription
	subscriptionForm.plan = sub?.plan ?? 'basic'
	subscriptionForm.module_1_enabled = sub?.module_1_enabled ?? true
	subscriptionForm.module_2_enabled = sub?.module_2_enabled ?? false
	subscriptionForm.max_searches_per_month = sub?.max_searches_per_month?.toString() ?? ''
	subscriptionForm.max_emails_per_month = sub?.max_emails_per_month?.toString() ?? ''
	subscriptionForm.max_kp_processed_per_month = sub?.max_kp_processed_per_month?.toString() ?? ''
	subscriptionForm.geo_code = sub?.geo_code ?? 'BY'
	subscriptionForm.currency_code = sub?.currency_code ?? 'BYN'
	subscriptionForm.price_module_1_monthly = sub?.price_module_1_monthly != null
		? String(sub.price_module_1_monthly)
		: ''
	subscriptionForm.price_module_2_monthly = sub?.price_module_2_monthly != null
		? String(sub.price_module_2_monthly)
		: ''
	subscriptionForm.price_bundle_monthly = sub?.price_bundle_monthly != null
		? String(sub.price_bundle_monthly)
		: ''
	subscriptionActive.value = sub?.is_active === false ? 'inactive' : 'active'
	useCustomLimits.value = sub ? limitsDifferFromCatalog(sub) : false
}

async function loadUsers() {
	loadError.value = null
	try {
		users.value = await get<AdminUserListItem[]>('/admin/users')
		if (!selectedUserId.value && users.value.length > 0) {
			await selectUser(users.value[0]!.id)
		}
	} catch (e: unknown) {
		loadError.value = getApiErrorDetail(e) ?? 'Не удалось загрузить пользователей'
	}
}

async function selectUser(userId: string) {
	selectedUserId.value = userId
	emailError.value = null
	subscriptionError.value = null
	emailSuccess.value = false
	subscriptionSuccess.value = false
	try {
		selectedUser.value = await get<AdminUserDetail>(`/admin/users/${userId}`)
		fillForms(selectedUser.value)
	} catch (e: unknown) {
		loadError.value = getApiErrorDetail(e) ?? 'Не удалось загрузить пользователя'
	}
}

async function saveEmailSettings() {
	if (!selectedUserId.value) return
	savingEmail.value = true
	emailError.value = null
	emailSuccess.value = false
	try {
		const payload: UserEmailSettingsUpdate = {
			smtp_host: emailForm.smtp_host || null,
			smtp_user: emailForm.smtp_user || null,
			imap_host: emailForm.imap_host || null,
			imap_user: emailForm.imap_user || null,
		}
		if (emailForm.smtp_password.trim()) {
			payload.smtp_password = emailForm.smtp_password
		}
		if (emailForm.imap_password.trim()) {
			payload.imap_password = emailForm.imap_password
		}
		selectedUser.value = await patch<AdminUserDetail>(
			`/admin/users/${selectedUserId.value}/email-settings`,
			payload,
		)
		fillForms(selectedUser.value)
		await loadUsers()
		emailSuccess.value = true
	} catch (e: unknown) {
		emailError.value = getApiErrorDetail(e) ?? 'Ошибка сохранения почты'
	} finally {
		savingEmail.value = false
	}
}

async function saveSubscription() {
	if (!selectedUserId.value) return
	savingSubscription.value = true
	subscriptionError.value = null
	subscriptionSuccess.value = false
	try {
		const payload: SubscriptionUpdate = {
			plan: subscriptionForm.plan,
			module_1_enabled: subscriptionForm.module_1_enabled,
			module_2_enabled: subscriptionForm.module_2_enabled,
			geo_code: subscriptionForm.geo_code || 'BY',
			currency_code: subscriptionForm.currency_code || 'BYN',
			is_active: subscriptionActive.value === 'active',
		}
		if (useCustomLimits.value) {
			payload.max_searches_per_month = parseOptionalNumber(
				subscriptionForm.max_searches_per_month,
			)
			payload.max_emails_per_month = parseOptionalNumber(
				subscriptionForm.max_emails_per_month,
			)
			payload.max_kp_processed_per_month = parseOptionalNumber(
				subscriptionForm.max_kp_processed_per_month,
			)
			payload.price_module_1_monthly = parseOptionalPrice(
				subscriptionForm.price_module_1_monthly,
			)
			payload.price_module_2_monthly = parseOptionalPrice(
				subscriptionForm.price_module_2_monthly,
			)
			payload.price_bundle_monthly = parseOptionalPrice(
				subscriptionForm.price_bundle_monthly,
			)
		} else {
			const catalog = catalogForPlan(subscriptionForm.plan)
			payload.max_searches_per_month = catalog.max_searches_per_month
			payload.max_emails_per_month = catalog.max_emails_per_month
			payload.max_kp_processed_per_month = catalog.max_kp_processed_per_month
			payload.price_module_1_monthly = catalog.price_module_1_monthly
			payload.price_module_2_monthly = catalog.price_module_2_monthly
			payload.price_bundle_monthly = catalog.price_bundle_monthly
		}
		selectedUser.value = await patch<AdminUserDetail>(
			`/admin/users/${selectedUserId.value}/subscription`,
			payload,
		)
		fillForms(selectedUser.value)
		subscriptionSuccess.value = true
		try {
			await loadUsers()
		} catch (reloadError: unknown) {
			subscriptionError.value = getApiErrorDetail(reloadError)
				?? 'Подписка сохранена, но не удалось обновить список пользователей'
		}
	} catch (e: unknown) {
		subscriptionError.value = getApiErrorDetail(e)
			?? (e instanceof Error ? e.message : 'Ошибка сохранения подписки')
	} finally {
		savingSubscription.value = false
	}
}

onMounted(() => {
	void loadUsers()
})
</script>
