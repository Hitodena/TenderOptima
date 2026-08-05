<script lang="ts" setup>
import type { RadioGroupItem } from '@nuxt/ui'
import type {
	PaymentCheckoutResponse,
	SubscriptionPaymentMethod,
	UserResponse,
} from '#shared/types'
import {
	PLAN_LABELS,
	subscriptionPlanLabel,
} from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'

definePageMeta({ layout: 'default' })

const { get, post } = useApi()
const toast = useToast()

const user = ref<UserResponse | null>(null)
const showBillingModal = ref(false)
const selectedMethod = ref<SubscriptionPaymentMethod>('card')
const paying = ref(false)

try {
	user.value = await get<UserResponse>('/auth/me')
} catch {
	user.value = null
}

const subscription = computed(() => user.value?.subscription ?? null)

const planLabel = computed(() =>
	subscription.value
		? PLAN_LABELS[subscription.value.plan] ?? subscriptionPlanLabel(subscription.value.plan)
		: t('subscription.notAssigned'),
)

const payableAmount = computed(() => {
	const sub = subscription.value
	if (!sub) return null
	const p1 = sub.price_module_1_monthly ? Number(sub.price_module_1_monthly) : null
	const p2 = sub.price_module_2_monthly ? Number(sub.price_module_2_monthly) : null
	const bundle = sub.price_bundle_monthly ? Number(sub.price_bundle_monthly) : null
	if (sub.module_1_enabled && sub.module_2_enabled && bundle != null) {
		return bundle
	}
	let total = 0
	let hasPrice = false
	if (sub.module_1_enabled && p1 != null) {
		total += p1
		hasPrice = true
	}
	if (sub.module_2_enabled && p2 != null) {
		total += p2
		hasPrice = true
	}
	return hasPrice ? total : null
})

const amountLabel = computed(() => {
	if (payableAmount.value == null || !subscription.value) return null
	const currency = subscription.value.currency_code || 'BYN'
	return `${payableAmount.value.toFixed(2)} ${currency}`
})

const paymentMethods = computed<RadioGroupItem[]>(() => [
	{
		label: 'Банковская карта',
		description: 'Visa, Mastercard, Белкарт и другие',
		value: 'card',
		icon: 'i-lucide-credit-card',
	},
	{
		label: 'СБП',
		description: 'Система быстрых платежей по QR',
		value: 'sbp',
		icon: 'i-lucide-smartphone',
	},
	{
		label: 'E-POS',
		description: 'Оплата через E-POS в мобильном банке',
		value: 'epos',
		icon: 'i-lucide-qr-code',
	},
	{
		label: 'ЕРИП',
		description: 'Оплата через систему «Расчёт» (ЕРИП)',
		value: 'erip',
		icon: 'i-lucide-landmark',
	},
])

async function startOnlinePayment() {
	if (!subscription.value || payableAmount.value == null) {
		toast.add({
			title: 'Нельзя начать оплату',
			description: 'Для текущего тарифа не задана сумма.',
			color: 'warning',
			icon: 'i-lucide-alert-circle',
		})
		return
	}
	paying.value = true
	try {
		const result = await post<PaymentCheckoutResponse>(
			'/billing/payments/checkout',
			{ method: selectedMethod.value },
		)
		await navigateTo(result.redirect_url, { external: true })
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		toast.add({
			title: 'Ошибка оплаты',
			description: typeof detail === 'string'
				? detail
				: 'Не удалось создать сессию оплаты',
			color: 'error',
			icon: 'i-lucide-circle-x',
		})
	} finally {
		paying.value = false
	}
}

const { target: heroReveal } = useScrollReveal()
const { target: limitsReveal } = useScrollReveal()
const { target: paymentReveal } = useScrollReveal()
</script>

<template>
	<UContainer class="py-6 sm:py-8 max-w-7xl">
		<div
			ref="heroReveal"
			class="reveal mb-8 sm:mb-10"
		>
			<div class="mb-6 space-y-2">
				<h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
					Подписка
				</h1>
				<p class="text-sm sm:text-base text-muted max-w-3xl">
					Текущие лимиты, срок действия и способы оплаты.
					Онлайн-оплата продлевает доступ автоматически; безнал активирует администратор.
				</p>
			</div>

			<UCard :ui="{ body: 'p-5 sm:p-6 space-y-5' }">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="space-y-3 min-w-0">
						<p class="text-xs font-semibold uppercase tracking-widest text-muted">
							{{ t('subscription.currentPlan') }}
						</p>
						<h2 class="text-2xl sm:text-3xl font-bold text-highlighted">
							{{ planLabel }}
						</h2>
						<div
							v-if="subscription"
							class="flex flex-wrap items-center gap-2"
						>
							<UBadge
								:color="subscription.is_active ? 'success' : 'neutral'"
								variant="subtle"
								:label="subscription.is_active ? t('subscription.active') : t('subscription.inactive')"
							/>
							<UBadge
								v-if="subscription.module_1_enabled"
								color="neutral"
								variant="outline"
								:label="t('subscription.module1')"
							/>
							<UBadge
								v-if="subscription.module_2_enabled"
								color="neutral"
								variant="outline"
								:label="t('subscription.module2')"
							/>
						</div>
					</div>
				</div>

				<SubscriptionExpiryBanner :subscription="subscription">
					<template #action>
						<UButton
							color="warning"
							variant="soft"
							size="xs"
							trailing-icon="i-lucide-receipt"
							@click="showBillingModal = true"
						>
							{{ t('subscription.renew') }}
						</UButton>
					</template>
				</SubscriptionExpiryBanner>
			</UCard>
		</div>

		<section
			v-if="subscription"
			ref="limitsReveal"
			class="reveal mb-10 sm:mb-12"
		>
			<h2 class="text-lg font-semibold text-highlighted mb-1">
				{{ t('subscription.allLimits') }}
			</h2>
			<p class="text-sm text-muted mb-5">
				Использование лимитов в текущем месяце
			</p>
			<UCard :ui="{ body: 'p-5 sm:p-6' }">
				<SubscriptionUsageBars :subscription="subscription" />
			</UCard>
		</section>

		<section
			ref="paymentReveal"
			class="reveal space-y-4"
		>
			<h2 class="text-lg font-semibold text-highlighted">
				Способы оплаты
			</h2>
			<div class="grid gap-4 sm:gap-6 lg:grid-cols-2">
				<UCard :ui="{ body: 'p-5 sm:p-6 space-y-4' }">
					<div class="flex items-start gap-3">
						<div
							class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"
						>
							<UIcon name="i-lucide-file-text" class="w-5 h-5 text-primary" />
						</div>
						<div class="space-y-1 min-w-0">
							<h3 class="text-base font-semibold text-highlighted">
								Выставить счёт на оплату по б/н
							</h3>
							<p class="text-sm text-muted">
								Безналичная оплата по счёту-фактуре для юридических лиц
							</p>
						</div>
					</div>
					<ol class="text-sm text-muted space-y-2 list-decimal list-inside">
						<li>Заполните реквизиты организации в форме выставления счёта</li>
						<li>При необходимости извлеките поля нейросетью из документов</li>
						<li>Сформируйте счёт — мы отправим документы на email</li>
						<li>После поступления оплаты администратор активирует тариф</li>
					</ol>
					<UButton
						color="primary"
						leading-icon="i-lucide-receipt"
						class="cursor-pointer"
						@click="showBillingModal = true"
					>
						Выставить счёт
					</UButton>
				</UCard>

				<UCard :ui="{ body: 'p-5 sm:p-6 space-y-4' }">
					<div class="flex items-start gap-3">
						<div
							class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"
						>
							<UIcon name="i-lucide-credit-card" class="w-5 h-5 text-primary" />
						</div>
						<div class="space-y-1 min-w-0">
							<h3 class="text-base font-semibold text-highlighted">
								Онлайн-оплата
							</h3>
							<p class="text-sm text-muted">
								Карты, СБП, E-POS и ЕРИП через bePaid. Доступ продлевается сразу после успешной оплаты.
							</p>
						</div>
					</div>

					<p
						v-if="amountLabel"
						class="text-sm text-highlighted"
					>
						К оплате:
						<span class="font-semibold">{{ amountLabel }}</span>
					</p>
					<p
						v-else
						class="text-sm text-muted"
					>
						Для текущего тарифа сумма онлайн-оплаты не задана. Воспользуйтесь счётом или обратитесь к администратору.
					</p>

					<URadioGroup
						v-model="selectedMethod"
						:items="paymentMethods"
						variant="card"
						indicator="start"
						:disabled="paying || payableAmount == null"
						class="w-full"
					/>

					<UButton
						color="primary"
						leading-icon="i-lucide-wallet"
						class="cursor-pointer"
						:loading="paying"
						:disabled="payableAmount == null"
						@click="startOnlinePayment"
					>
						Перейти к оплате
					</UButton>
				</UCard>
			</div>
		</section>

		<BillingInvoiceModal
			v-model:open="showBillingModal"
			:subscription="subscription"
		/>
	</UContainer>
</template>
