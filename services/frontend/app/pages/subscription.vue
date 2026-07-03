<script lang="ts" setup>
import type { UserResponse } from '#shared/types'
import {
	subscriptionProfilePath,
} from '#shared/utils/subscriptionDisplay'

definePageMeta({ layout: 'default' })

const { get } = useApi()
const toast = useToast()

const user = ref<UserResponse | null>(null)

try {
	user.value = await get<UserResponse>('/auth/me')
} catch {
	user.value = null
}

function showCardPaymentStub() {
	toast.add({
		title: 'Оплата картой',
		description: 'Скоро будет доступно.',
		color: 'neutral',
		icon: 'i-lucide-credit-card',
	})
}
</script>

<template>
	<UContainer class="py-6 sm:py-8 max-w-7xl">
		<div class="mb-8 space-y-2">
			<h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
				Тарифы и подписка
			</h1>
			<p class="text-sm sm:text-base text-muted max-w-3xl">
				Сравните возможности каждого тарифа и выберите способ оплаты.
				После оплаты доступ активируется администратором.
			</p>
		</div>

		<section class="mb-10 sm:mb-12">
			<h2 class="text-lg font-semibold text-highlighted mb-1">
				Тарифы TenderOptima
			</h2>
			<p class="text-sm text-muted mb-5">
				Подробное описание лимитов и модулей по каждому плану
			</p>
			<SubscriptionPlansOverview :subscription="user?.subscription" />
		</section>

		<section class="space-y-4">
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
						<li>Заполните реквизиты организации в личном кабинете</li>
						<li>При необходимости извлеките поля нейросетью из документов</li>
						<li>Сформируйте счёт и акт — мы отправим документы на email</li>
						<li>После поступления оплаты администратор активирует тариф</li>
					</ol>
					<UButton
						color="primary"
						leading-icon="i-lucide-arrow-right"
						:to="subscriptionProfilePath()"
					>
						Перейти к оформлению счёта
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
								Оплатить картой на сайте
							</h3>
							<p class="text-sm text-muted">
								Быстрая оплата банковской картой без выставления счёта
							</p>
						</div>
					</div>
					<p class="text-sm text-muted">
						Онлайн-оплата картой будет доступна в ближайшее время.
						Пока воспользуйтесь оплатой по безналичному расчёту.
					</p>
					<UButton
						variant="outline"
						color="neutral"
						leading-icon="i-lucide-credit-card"
						@click="showCardPaymentStub"
					>
						Оплатить картой
					</UButton>
				</UCard>
			</div>
		</section>
	</UContainer>
</template>
