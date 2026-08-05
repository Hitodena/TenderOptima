<script lang="ts" setup>
import type { PaymentStatusResponse } from '#shared/types'

definePageMeta({ layout: 'default' })

const route = useRoute()
const { get } = useApi()

const paymentId = computed(() => {
	const raw = route.query.payment_id
	return typeof raw === 'string' ? raw : null
})

const payment = ref<PaymentStatusResponse | null>(null)
const loading = ref(Boolean(paymentId.value))

if (paymentId.value) {
	try {
		payment.value = await get<PaymentStatusResponse>(
			`/billing/payments/${paymentId.value}`,
		)
	} catch {
		payment.value = null
	} finally {
		loading.value = false
	}
}
</script>

<template>
	<UContainer class="py-10 sm:py-14 max-w-xl">
		<UCard :ui="{ body: 'p-6 sm:p-8 space-y-5 text-center' }">
			<div
				class="mx-auto w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center"
			>
				<UIcon
					name="i-lucide-circle-x"
					class="w-6 h-6 text-error"
				/>
			</div>
			<div class="space-y-2">
				<h1 class="text-2xl font-bold text-highlighted">
					Оплата не завершена
				</h1>
				<p class="text-sm text-muted">
					Платёж отменён, отклонён или не был подтверждён.
					Можно вернуться и выбрать другой способ оплаты.
				</p>
			</div>

			<p
				v-if="loading"
				class="text-sm text-muted"
			>
				Загружаем детали…
			</p>
			<p
				v-else-if="payment"
				class="text-sm text-muted"
			>
				Статус: {{ payment.status }}
				· {{ payment.amount }} {{ payment.currency_code }}
			</p>

			<div class="flex flex-wrap justify-center gap-3 pt-2">
				<UButton
					to="/subscription"
					color="primary"
					class="cursor-pointer"
				>
					Попробовать снова
				</UButton>
			</div>
		</UCard>
	</UContainer>
</template>
