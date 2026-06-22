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

					<template #subscription>
						<div>
							<h2 class="text-base font-semibold mb-0.5">Статус подписки</h2>
							<p class="text-sm text-muted mb-5">
								Текущий тариф и лимиты вашей учётной записи
							</p>
							<ProfileSubscriptionPanel :subscription="user?.subscription" />
						</div>
					</template>

					<template #business_card>
						<div>
							<h2 class="text-base font-semibold mb-0.5">Визитная карточка</h2>
							<p class="text-sm text-muted mb-5">
								Настройте вашу визитную карточку, которая добавляется ко всем письмам
							</p>

							<UCard :ui="{ body: 'p-5' }">
								<h3 class="font-semibold text-highlighted mb-1">Настройка визитной карточки</h3>
								<p class="text-sm text-muted mb-5">
									Добавьте информацию, которая будет отображаться в конце писем, отправляемых
									поставщикам
								</p>

								<UFormField label="Текст визитной карточки" class="mb-2">
									<UTextarea v-model="form.business_info" :rows="5" class="w-full"
										placeholder="С Уважением,&#10;специалист отдела закупок&#10;Иван Иванов&#10;(Email для связи: ivan@corp.ru)" />
								</UFormField>

								<p class="text-xs text-primary mb-5">
									Этот текст будет добавлен в конце писем, отправляемых поставщикам. Включите все
									необходимые контактные данные.
								</p>

								<UAlert v-if="cardError" color="error" variant="soft" icon="i-lucide-circle-alert"
									:description="cardError" class="mb-4" />

								<UAlert v-if="cardSuccess" color="success" variant="soft" icon="i-lucide-check"
									description="Визитная карточка сохранена" class="mb-4" />

								<UButton block :loading="savingCard" leading-icon="i-lucide-save"
									@click="saveBusinessCard">
									Сохранить
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
									<UInput v-model="form.full_name" placeholder="Иван Иванов" icon="i-lucide-user"
										class="w-full" />
								</UFormField>

								<UFormField label="Название компании" name="company_name">
									<UInput v-model="form.company_name" placeholder="ООО «Ваша компания»"
										icon="i-lucide-building-2" class="w-full" />
								</UFormField>

								<UFormField label="Контактный email" name="contact_email">
									<UInput v-model="form.contact_email" type="email" placeholder="sales@company.ru"
										icon="i-lucide-mail" class="w-full" />
								</UFormField>

								<UAlert v-if="profileError" color="error" variant="soft" icon="i-lucide-circle-alert"
									:description="profileError" />

								<UAlert v-if="profileSuccess" color="success" variant="soft" icon="i-lucide-check"
									description="Профиль обновлён" />

								<div class="flex justify-end">
									<UButton :loading="savingProfile" leading-icon="i-lucide-save" @click="saveProfile">
										Сохранить
									</UButton>
								</div>
							</div>
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
										<a :href="`mailto:${publicConfig.contactEmail}`"
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
										<a :href="`tel:${publicConfig.contactPhone}`"
											class="text-sm font-medium text-primary hover:underline underline-offset-2 transition-opacity hover:opacity-80">
											{{ publicConfig.contactPhone }}
										</a>
									</div>
								</div>
							</div>
						</div>
					</template>

					<template v-if="user?.is_admin" #admin>
						<ProfileAdminPanel />
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
import type { UserResponse, UserUpdate } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

definePageMeta({ layout: 'default' })

const { get, patch } = useApi()
const auth = useAuthStore()
const route = useRoute()
const { public: publicConfig } = useRuntimeConfig()

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

const tabs = computed(() => {
	const items = [
		{ label: 'Статус подписки', slot: 'subscription', value: 'subscription', icon: 'i-lucide-credit-card' },
		{ label: 'Визитная карточка', slot: 'business_card', value: 'business_card', icon: 'i-lucide-id-card' },
		{ label: 'Профиль', slot: 'profile', value: 'profile', icon: 'i-lucide-user' },
		{ label: 'Свяжитесь с нами', slot: 'contact', value: 'contact', icon: 'i-lucide-mail' },
	]
	if (user.value?.is_admin) {
		items.push({
			label: 'Админка',
			slot: 'admin',
			value: 'admin',
			icon: 'i-lucide-shield',
		})
	}
	return items
})

const tabFromQuery = computed(() => {
	const raw = route.query.tab
	return typeof raw === 'string' ? raw : null
})

const activeTab = ref('subscription')

watch(
	tabFromQuery,
	(tab) => {
		if (tab && tabs.value.some((item) => item.value === tab)) {
			activeTab.value = tab
		}
	},
	{ immediate: true },
)

watch(activeTab, (tab) => {
	if (route.query.tab === tab) return
	navigateTo({ path: '/profile', query: { tab } }, { replace: true })
})

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
