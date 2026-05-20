<template>
	<UPage>
		<UPageHero title="TenderOptima - поиск поставщиков для тендеров"
			description="Автоматизированный поиск надёжных поставщиков по вашим ТЗ. Экономьте время и деньги." :links="links"/>

		<UPageSection id="features" class="bg-elevated/25" title="Всё необходимое для эффективного поиска"
			description="Полный набор инструментов для автоматизации работы с поставщиками в тендерах.">
			<UPageGrid>
				<UPageCard v-for="(feature, index) in features" :key="index" spotlight v-bind="feature">
				</UPageCard>
			</UPageGrid>
		</UPageSection>

		<UPageSection id="how-it-works" title="Как это работает"
			description="Три простых шага - и вы получаете подходящих поставщиков.">
			<UPageGrid>
				<UPageCard v-for="(step, index) in steps" :key="index" :title="step.title"
					:description="step.description" spotlight>
				</UPageCard>
			</UPageGrid>
		</UPageSection>

		<UPageSection id="benefits" class="bg-elevated/25" title="Надёжность и результаты"
			description="Показатели, которые говорят сами за себя - проверенные пользователями платформы.">
			<UPageGrid>
				<UPageCard v-for="(metric, index) in metrics" :key="index" spotlight v-bind="metric">
				</UPageCard>
			</UPageGrid>
		</UPageSection>

		<UPageCTA title="Готовы ускорить поиск поставщиков?"
			description="Зарегистрируйтесь бесплатно и попробуйте все возможности уже сегодня." :links="[
				{ label: 'Начать бесплатно', to: '/auth', icon: 'i-lucide-rocket' },
			]" />
	</UPage>
</template>

<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

definePageMeta({
	layout: 'default',
})

const features = [
	{
		title: 'Умный поиск поставщиков',
		description: 'Автоматический подбор надёжных компаний по описанию вашего ТЗ и ключевым параметрам.',
		icon: 'i-lucide-search'
	},
	{
		title: 'Отправка сообщений по почте',
		description: 'Автоматическая рассылка по вашему ТЗ найденным поставщика.',
		icon: 'i-lucide-send'
	},
	{
		title: 'История запросов',
		description: 'Сохраняйте и просматривайте все предыдущие поисковые запросы в удобной таблице.',
		icon: 'i-lucide-history'
	},
	{
		title: 'Чёрный список',
		description: 'Исключайте ненадёжные домены и компании из будущих результатов поиска.',
		icon: 'i-lucide-shield-off'
	},
	{
		title: 'Email-уведомления',
		description: 'Получайте мгновенные оповещения о новых подходящих поставщиках на почту.',
		icon: 'i-lucide-mail'
	},
	{
		title: 'Анализ ТЗ',
		description: 'Автоматический разбор технического задания и извлечение ключевых требований.',
		icon: 'i-lucide-file-search'
	}
]

const steps = [
	{
		title: 'Создайте запрос',
		description: 'Опишите требования к поставщику или загрузите ТЗ. Укажите ключевые параметры и бюджет.',
	},
	{
		title: 'Получите результаты',
		description: 'Система автоматически находит и ранжирует подходящих поставщиков из базы и внешних источников.',
	},
	{
		title: 'Свяжитесь и отслеживайте',
		description: 'Получите контакты, добавьте в чёрный список при необходимости и получайте уведомления.'
	}
]


const metrics = [
	{
		title: 'Экономия времени',
		description: 'Сокращайте время на поиск и обработку поставщиков за счёт автоматизации процессов',
		icon: 'i-lucide-clock-3'
	},
	{
		title: 'Надежные поставщики',
		description: 'Доступ к проверенной базе поставщиков с актуальной и достоверной информацией',
		icon: 'i-lucide-users'
	},
	{
		title: 'Автоматический поиск',
		description: 'Система самостоятельно подбирает релевантных поставщиков под ваши запросы',
		icon: 'i-lucide-activity'
	}
]

const links = ref<ButtonProps[]>([
	{ label: 'Начать бесплатно', to: '/auth', icon: 'i-lucide-rocket' },
	{
		label: 'Узнать больше',
		color: 'neutral',
		variant: 'subtle',
		trailingIcon: 'i-lucide-arrow-right',
		to: '#features',
	},
])
</script>
