<script lang="ts" setup>
import type { RadioGroupItem } from '@nuxt/ui'
import type {
	PaymentCheckoutResponse,
	PaymentStatusResponse,
	SubscriptionPaymentMethod,
	UserResponse,
} from '#shared/types'
import {
	PLAN_LABELS,
	formatExpiryDate,
	subscriptionPlanLabel,
} from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'

definePageMeta({ layout: 'default' })

const { get, post } = useApi()
const toast = useToast()
const { formatDate } = useFormatDate()

const user = ref<UserResponse | null>(null)
const latestPayment = ref<PaymentStatusResponse | null>(null)
const showBillingModal = ref(false)
const selectedMethod = ref<SubscriptionPaymentMethod>('card')
const paying = ref(false)
const cancellingRenew = ref(false)

const [userResult, paymentResult] = await Promise.allSettled([
	get<UserResponse>('/auth/me'),
	get<PaymentStatusResponse | null>('/billing/payments/latest'),
])
user.value = userResult.status === 'fulfilled' ? userResult.value : null
latestPayment.value = paymentResult.status === 'fulfilled'
	? paymentResult.value
	: null

const subscription = computed(() => user.value?.subscription ?? null)

const planLabel = computed(() =>
	subscription.value
		? PLAN_LABELS[subscription.value.plan] ?? subscriptionPlanLabel(subscription.value.plan)
		: t('subscription.notAssigned'),
)

const isPaidPeriod = computed(() => {
	const sub = subscription.value
	if (!sub?.is_active || !sub.expires_at) return false
	const expires = new Date(sub.expires_at)
	if (Number.isNaN(expires.getTime())) return false
	return expires.getTime() > Date.now()
})

const paidUntilLabel = computed(() =>
	formatExpiryDate(subscription.value?.expires_at),
)

const autoRenew = computed(() => Boolean(subscription.value?.auto_renew))

const nextChargeLabel = computed(() => {
	const raw = subscription.value?.bepaid_renew_at
	if (!raw) return null
	return formatDate(raw)
})

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

const methodLabels: Record<SubscriptionPaymentMethod, string> = {
	card: 'карта',
	sbp: 'СБП',
	epos: 'E-POS',
	erip: 'ЕРИП',
}

const latestPaymentLabel = computed(() => {
	const payment = latestPayment.value
	if (!payment) return null
	const method = methodLabels[payment.method] ?? payment.method
	const amount = `${Number(payment.amount).toFixed(2)} ${payment.currency_code}`
	return `${amount} · ${method} · ${formatDate(payment.created_at)}`
})

const paymentMethods = computed<RadioGroupItem[]>(() => [
	{
		label: 'Банковская карта',
		description: 'Ежемесячное автопродление: Visa, Mastercard, Белкарт',
		value: 'card',
		icon: 'i-lucide-credit-card',
	},
	{
		label: 'СБП',
		description: 'Разовая оплата за 1 месяц по QR',
		value: 'sbp',
		icon: 'i-lucide-smartphone',
	},
	{
		label: 'E-POS',
		description: 'Разовая оплата за 1 месяц через E-POS',
		value: 'epos',
		icon: 'i-lucide-qr-code',
	},
	{
		label: 'ЕРИП',
		description: 'Разовая оплата за 1 месяц через систему «Расчёт»',
		value: 'erip',
		icon: 'i-lucide-landmark',
	},
])

const onlinePayHint = computed(() => {
	if (selectedMethod.value === 'card') {
		return 'Карта: после оплаты bePaid будет списывать сумму каждый месяц, пока не отключите автопродление.'
	}
	return 'СБП, E-POS и ЕРИП — разовая оплата за один месяц без повторного списания.'
})

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

async function cancelAutoRenew() {
	cancellingRenew.value = true
	try {
		await post('/billing/payments/subscription/cancel', {})
		user.value = await get<UserResponse>('/auth/me')
		toast.add({
			title: 'Автопродление отключено',
			description: paidUntilLabel.value
				? `Доступ сохранится до ${paidUntilLabel.value}.`
				: 'Повторные списания остановлены.',
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		toast.add({
			title: 'Не удалось отменить',
			description: typeof detail === 'string'
				? detail
				: 'Попробуйте позже или обратитесь в поддержку.',
			color: 'error',
			icon: 'i-lucide-circle-x',
		})
	} finally {
		cancellingRenew.value = false
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
					Оплата картой включает ежемесячное автопродление; СБП, E-POS и ЕРИП — разовая оплата за месяц.
					Безнал активирует администратор.
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
								v-if="isPaidPeriod && paidUntilLabel"
								color="success"
								variant="outline"
								:label="`Оплачена до ${paidUntilLabel}`"
							/>
							<UBadge
								v-if="autoRenew"
								color="primary"
								variant="subtle"
								label="Автопродление"
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
								Карта — ежемесячное автопродление через bePaid.
								СБП, E-POS и ЕРИП — разовая оплата за месяц; доступ продлевается сразу после успешной оплаты.
							</p>
						</div>
					</div>

					<UAlert
						v-if="isPaidPeriod"
						color="success"
						variant="soft"
						icon="i-lucide-circle-check"
						:title="paidUntilLabel ? `Подписка оплачена до ${paidUntilLabel}` : 'Подписка оплачена'"
						:description="autoRenew
							? (nextChargeLabel
								? `Автопродление включено. Следующее списание: ${nextChargeLabel}.`
								: 'Автопродление включено. Можно оплатить снова картой, чтобы обновить сумму или карту.')
							: 'Можно оплатить снова, чтобы продлить срок.'"
					/>

					<div
						v-if="autoRenew"
						class="flex flex-wrap items-center gap-3"
					>
						<UButton
							color="neutral"
							variant="outline"
							leading-icon="i-lucide-ban"
							class="cursor-pointer"
							:loading="cancellingRenew"
							@click="cancelAutoRenew"
						>
							Отменить автопродление
						</UButton>
					</div>

					<p
						v-if="latestPaymentLabel"
						class="text-sm text-muted"
					>
						Последняя оплата: {{ latestPaymentLabel }}
					</p>

					<p
						v-if="amountLabel"
						class="text-sm text-highlighted"
					>
						{{ selectedMethod === 'card'
							? (isPaidPeriod ? 'Сумма ежемесячного списания:' : 'К оплате ежемесячно:')
							: (isPaidPeriod ? 'Стоимость продления на 1 месяц:' : 'К оплате за 1 месяц:')
						}}
						<span class="font-semibold">{{ amountLabel }}</span>
					</p>
					<p
						v-else
						class="text-sm text-muted"
					>
						Для текущего тарифа сумма онлайн-оплаты не задана. Воспользуйтесь счётом или обратитесь к администратору.
					</p>

					<p class="text-xs text-muted">
						{{ onlinePayHint }}
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
						:leading-icon="isPaidPeriod ? 'i-lucide-refresh-cw' : 'i-lucide-wallet'"
						class="cursor-pointer"
						:loading="paying"
						:disabled="payableAmount == null"
						@click="startOnlinePayment"
					>
						{{ selectedMethod === 'card'
							? (isPaidPeriod ? 'Подключить карту снова' : 'Оплатить картой')
							: (isPaidPeriod ? 'Оплатить снова' : 'Перейти к оплате')
						}}
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
