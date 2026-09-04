<script lang="ts" setup>
import type { PaymentStatusResponse, UserResponse } from '#shared/types'
import { formatExpiryDate } from '#shared/utils/subscriptionDisplay'

definePageMeta({ layout: 'default' })

const route = useRoute()
const { get } = useApi()
const toast = useToast()

const paymentId = computed(() => {
	const raw = route.query.payment_id
	return typeof raw === 'string' ? raw : null
})

const payment = ref<PaymentStatusResponse | null>(null)
const user = ref<UserResponse | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const paidUntilLabel = computed(() =>
	formatExpiryDate(user.value?.subscription?.expires_at),
)

const renewAtLabel = computed(() => {
	const raw = user.value?.subscription?.bepaid_renew_at
	if (!raw) return null
	return formatExpiryDate(raw)
})

const isCardAutoRenew = computed(
	() =>
		payment.value?.method === 'card'
		&& Boolean(user.value?.subscription?.auto_renew),
)

async function loadStatus() {
	if (!paymentId.value) {
		error.value = 'Не указан идентификатор платежа'
		loading.value = false
		return
	}
	loading.value = true
	error.value = null
	try {
		payment.value = await get<PaymentStatusResponse>(
			`/billing/payments/${paymentId.value}`,
		)
		try {
			user.value = await get<UserResponse>('/auth/me')
		} catch {
			user.value = null
		}
		if (payment.value.status === 'successful') {
			const until = paidUntilLabel.value
			const renew = renewAtLabel.value
			let description = until
				? `Подписка оплачена до ${until}. Можно вернуться на страницу подписки.`
				: 'Подписка продлена. Можно вернуться на страницу подписки.'
			if (isCardAutoRenew.value && renew) {
				description = until
					? `Подписка оплачена до ${until}. Следующее списание: ${renew}.`
					: `Подписка продлена. Следующее списание: ${renew}.`
			} else if (isCardAutoRenew.value) {
				description = until
					? `Подписка оплачена до ${until}. Включено ежемесячное автопродление.`
					: 'Подписка продлена. Включено ежемесячное автопродление.'
			}
			toast.add({
				title: 'Оплата прошла успешно',
				description,
				color: 'success',
				icon: 'i-lucide-check',
			})
		}
	} catch {
		error.value = 'Не удалось получить статус платежа'
	} finally {
		loading.value = false
	}
}

await loadStatus()

const statusLabel = computed(() => {
	switch (payment.value?.status) {
		case 'successful':
			return 'Оплачено'
		case 'pending':
			return 'Ожидает подтверждения'
		case 'failed':
			return 'Ошибка оплаты'
		case 'expired':
			return 'Сессия истекла'
		default:
			return 'Статус неизвестен'
	}
})
</script>

<template>
	<UContainer class="py-10 sm:py-14 max-w-xl">
		<UCard :ui="{ body: 'p-6 sm:p-8 space-y-5 text-center' }">
			<div
				class="mx-auto w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center"
			>
				<UIcon
					name="i-lucide-circle-check"
					class="w-6 h-6 text-success"
				/>
			</div>
			<div class="space-y-2">
				<h1 class="text-2xl font-bold text-highlighted">
					Возврат из оплаты
				</h1>
				<p class="text-sm text-muted">
					Если платёж ещё обрабатывается, статус обновится в течение минуты.
				</p>
			</div>

			<div
				v-if="loading"
				class="text-sm text-muted"
			>
				Проверяем статус…
			</div>
			<div
				v-else-if="error"
				class="text-sm text-error"
			>
				{{ error }}
			</div>
			<div
				v-else-if="payment"
				class="space-y-1"
			>
				<p class="text-base font-semibold text-highlighted">
					{{ statusLabel }}
				</p>
				<p class="text-sm text-muted">
					{{ payment.amount }} {{ payment.currency_code }}
					· {{ payment.method.toUpperCase() }}
				</p>
				<p
					v-if="payment.status === 'successful' && paidUntilLabel"
					class="text-sm text-success"
				>
					Подписка оплачена до {{ paidUntilLabel }}
				</p>
				<p
					v-if="payment.status === 'successful' && isCardAutoRenew"
					class="text-sm text-muted"
				>
					<template v-if="renewAtLabel">
						Следующее списание: {{ renewAtLabel }}
					</template>
					<template v-else>
						Включено ежемесячное автопродление
					</template>
				</p>
			</div>

			<div class="flex flex-wrap justify-center gap-3 pt-2">
				<UButton
					to="/subscription"
					color="primary"
					class="cursor-pointer"
				>
					К подписке
				</UButton>
				<UButton
					v-if="paymentId"
					variant="outline"
					color="neutral"
					class="cursor-pointer"
					:loading="loading"
					@click="loadStatus"
				>
					Обновить статус
				</UButton>
			</div>
		</UCard>
	</UContainer>
</template>
