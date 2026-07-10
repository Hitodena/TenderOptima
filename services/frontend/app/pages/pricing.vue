<template>
	<div>
		<BaseSection tone="elevated" max-width="5xl">
			<div class="text-center">
				<p class="landing-section-headline mb-2">
					Тарифы
				</p>
				<h1 class="landing-section-title mb-4">
					Выберите план под объём закупок
				</h1>
				<p class="landing-section-description mx-auto mb-6">
					Модуль 1 — поиск поставщиков, рассылка и переписка. Модуль 2 — извлечение требований из ТЗ и
					AI-сравнение с коммерческими предложениями. Тарифы можно комбинировать.
				</p>
				<div class="flex flex-wrap items-center justify-center gap-2">
					<span class="landing-industry-pill">
						<UIcon name="i-lucide-mail" class="landing-industry-pill-icon size-4" />
						Модуль 1 — поиск и inbox
					</span>
					<span class="landing-industry-pill">
						<UIcon name="i-lucide-file-search" class="landing-industry-pill-icon size-4" />
						Модуль 2 — анализ ТЗ/КП
					</span>
				</div>
			</div>
		</BaseSection>

		<BaseSection max-width="7xl">
			<SubscriptionPlansOverview />
			<p class="mt-6 text-center text-sm text-muted">
				Все цены указаны без НДС. После выбора тарифа — регистрация, счёт на оплату или консультация с менеджером.
			</p>
		</BaseSection>

		<BaseSection tone="elevated" max-width="6xl">
			<div class="grid gap-5 sm:grid-cols-3">
				<article v-for="step in onboardingSteps" :key="step.title" class="landing-card p-6 text-center">
					<div class="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10">
						<UIcon :name="step.icon" class="size-5 text-primary" />
					</div>
					<h3 class="mb-2 font-semibold text-highlighted">
						{{ step.title }}
					</h3>
					<p class="text-sm leading-relaxed text-muted">
						{{ step.description }}
					</p>
				</article>
			</div>
		</BaseSection>

		<BaseSection max-width="5xl">
			<div class="grid items-start gap-10 lg:grid-cols-2">
				<div class="text-center lg:text-left">
					<h2 class="landing-section-title mb-4">
						Нужен корпоративный тариф или on-premise?
					</h2>
					<p class="landing-section-description mx-auto mb-6 lg:mx-0">
						Обсудим индивидуальные лимиты, развёртывание в вашем контуре и условия NDA. Менеджер подберёт
						конфигурацию под ваш сценарий закупок.
					</p>
					<ul class="space-y-2 text-left text-sm text-muted">
						<li class="flex items-center gap-2">
							<UIcon name="i-lucide-check" class="size-4 shrink-0 text-primary" />
							Индивидуальные лимиты поиска, писем и КП
						</li>
						<li class="flex items-center gap-2">
							<UIcon name="i-lucide-check" class="size-4 shrink-0 text-primary" />
							Развёртывание на базе Docker Compose
						</li>
						<li class="flex items-center gap-2">
							<UIcon name="i-lucide-check" class="size-4 shrink-0 text-primary" />
							Приоритетная поддержка
						</li>
					</ul>
				</div>
				<div class="landing-card bg-default p-6 sm:p-8">
					<ConsultationForm />
				</div>
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'
import SubscriptionPlansOverview from '~/components/SubscriptionPlansOverview.vue'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Тарифы — TenderOptima',
	description: 'Тарифы TenderOptima: тестовый, базовый, расширенный и корпоративный планы. Модуль поиска поставщиков и модуль анализа ТЗ/КП.',
})

const onboardingSteps = [
	{
		icon: 'i-lucide-user-plus',
		title: 'Регистрация',
		description: 'Создайте аккаунт и получите доступ к тестовому периоду или выбранному тарифу.',
	},
	{
		icon: 'i-lucide-receipt',
		title: 'Оплата по счёту',
		description: 'Для юридических лиц — безналичный расчёт. Счёт формируется в личном кабинете.',
	},
	{
		icon: 'i-lucide-key-round',
		title: 'Активация доступа',
		description: 'После оплаты администратор активирует подписку — вы получите уведомление на email.',
	},
]
</script>
