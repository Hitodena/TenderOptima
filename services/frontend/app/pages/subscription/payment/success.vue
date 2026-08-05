<script lang="ts" setup>
import type { PaymentStatusResponse } from '#shared/types'

definePageMeta({ layout: 'default' })

const route = useRoute()
const { get } = useApi()
const toast = useToast()

const paymentId = computed(() => {
	const raw = route.query.payment_id
	return typeof raw === 'string' ? raw : null
})

const payment = ref<PaymentStatusResponse | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

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
		if (payment.value.status === 'successful') {
			toast.add({
				title: 'Оплата прошла успешно',
				description: 'Подписка продлена. Лимиты обновятся при следующем запросе профиля.',
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
