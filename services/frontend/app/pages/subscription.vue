<script lang="ts" setup>
import type {
	ChangePlanRequest,
	SubscriptionPlan,
	SubscriptionResponse,
	UserResponse,
} from '#shared/types'
import type { PricingModuleTab } from '#shared/constants/pricing'
import {
	PLAN_LABELS,
	subscriptionPlanLabel,
} from '#shared/utils/subscriptionDisplay'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { t } from '~/constants/translations'

definePageMeta({ layout: 'default' })

const { get, post } = useApi()
const toast = useToast()

const user = ref<UserResponse | null>(null)
const showBillingModal = ref(false)
const selectedPlan = ref<SubscriptionPlan | null>(null)
const moduleTab = ref<PricingModuleTab>('module1')
const changingPlan = ref(false)

try {
	user.value = await get<UserResponse>('/auth/me')
} catch {
	user.value = null
}

const subscription = computed(() => user.value?.subscription ?? null)
const currentPlan = computed(() => subscription.value?.plan ?? null)

if (currentPlan.value) {
	selectedPlan.value = currentPlan.value
}

const planLabel = computed(() =>
	subscription.value
		? PLAN_LABELS[subscription.value.plan] ?? subscriptionPlanLabel(subscription.value.plan)
		: t('subscription.notAssigned'),
)

const planChangePending = computed(() =>
	selectedPlan.value != null
	&& currentPlan.value != null
	&& selectedPlan.value !== currentPlan.value,
)

async function confirmPlanChange() {
	if (!selectedPlan.value || !planChangePending.value) return
	changingPlan.value = true
	try {
		const body: ChangePlanRequest = {
			plan: selectedPlan.value,
			module_tab: moduleTab.value,
		}
		const updated = await post<SubscriptionResponse>(
			'/subscriptions/me/change-plan',
			body,
		)
		if (user.value) {
			user.value = { ...user.value, subscription: updated }
		} else {
			user.value = await get<UserResponse>('/auth/me')
		}
		selectedPlan.value = updated.plan
		toast.add({
			title: t('subscription.changePlanSuccess'),
			color: 'success',
			icon: 'i-lucide-check',
		})
		showBillingModal.value = true
	} catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? 'Не удалось сменить тариф',
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	} finally {
		changingPlan.value = false
	}
}

function showCardPaymentStub() {
	toast.add({
		title: 'Оплата картой',
		description: 'Скоро будет доступно.',
		color: 'neutral',
		icon: 'i-lucide-credit-card',
	})
}

const { target: heroReveal } = useScrollReveal()
const { target: limitsReveal } = useScrollReveal()
const { target: plansReveal } = useScrollReveal()
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
					Тарифы и подписка
				</h1>
				<p class="text-sm sm:text-base text-muted max-w-3xl">
					Текущие лимиты, срок действия и сравнение тарифов.
					После оплаты доступ активируется администратором.
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
			ref="plansReveal"
			class="reveal mb-10 sm:mb-12"
		>
			<h2 class="text-lg font-semibold text-highlighted mb-1">
				Тарифы TenderOptima
			</h2>
			<p class="text-sm text-muted mb-5">
				Подробное описание лимитов и модулей по каждому плану
			</p>
			<SubscriptionPlansOverview
				v-model:selected-plan="selectedPlan"
				v-model:module-tab="moduleTab"
				:subscription="subscription"
				selectable
			/>

			<div
				v-if="planChangePending"
				class="mt-5 space-y-3"
			>
				<UAlert
					color="warning"
					variant="soft"
					icon="i-lucide-info"
					:description="t('subscription.changePlanDisclaimer')"
				/>
				<p class="text-sm text-muted">
					{{ t('subscription.invoiceAfterSwitch') }}
				</p>
				<UButton
					color="primary"
					leading-icon="i-lucide-arrow-right-left"
					:loading="changingPlan"
					@click="confirmPlanChange"
				>
					{{ t('subscription.confirmChangePlan') }}
				</UButton>
			</div>
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

		<BillingInvoiceModal
			v-model:open="showBillingModal"
			:subscription="subscription"
		/>
	</UContainer>
</template>
