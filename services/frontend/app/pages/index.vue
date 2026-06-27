<template>
	<UPage>
		<UPageHero title="AI-сервис для автоматизации закупок и анализа предложений поставщиков"
			description="Поиск поставщиков, рассылка запросов, входящие ответы и сравнение КП с ТЗ - в одном браузерном интерфейсе. Без ручной сверки таблиц."
			:links="heroLinks" />

		<UPageSection id="metrics" class="bg-elevated/25" headline="Результаты" title="Измеримый эффект для закупок"
			description="Конкретные показатели, которые получают команды закупок.">
			<UPageGrid class="gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<UPageCard v-for="metric in metrics" :key="metric.label" spotlight :title="metric.value"
					:description="metric.label" :icon="metric.icon" />
			</UPageGrid>
		</UPageSection>

		<UPageSection id="features" title="Всё для работы с поставщиками - в одном инструменте"
			description="TenderOptima автоматизирует поиск, переписку и технический анализ предложений.">
			<UPageGrid class="gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<UPageCard v-for="(feature, index) in features" :key="feature.title" spotlight
					:title="`${String(index + 1).padStart(2, '0')}. ${feature.title}`"
					:description="feature.description" :icon="feature.icon" />
			</UPageGrid>
		</UPageSection>

		<UPageSection id="pain" class="bg-elevated/25" headline="Проблема"
			title="Ручная обработка заявок отнимает время и повышает риски"
			description="TenderOptima берёт на себя рутину, чтобы команда фокусировалась на решениях.">
			<UPageGrid class="gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<UPageCard v-for="pain in painPoints" :key="pain.title" :title="pain.title"
					:description="pain.description" :icon="pain.icon" />
			</UPageGrid>
		</UPageSection>

		<UPageSection id="how-it-works" headline="Процесс" title="Как это работает в браузере"
			description="Полный цикл от поиска поставщиков до готового сравнения - без установки программ."
			orientation="horizontal">
			<div class="space-y-6">
				<ol class="space-y-4">
					<li v-for="(step, index) in browserFlowSteps" :key="step.title"
						class="flex gap-4 rounded-xl border border-default bg-elevated/40 p-4 lg:p-5">
						<span
							class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
							{{ index + 1 }}
						</span>
						<div class="min-w-0 space-y-1">
							<p class="font-semibold text-highlighted">{{ step.title }}</p>
							<p class="text-sm text-muted">{{ step.description }}</p>
						</div>
					</li>
				</ol>

			</div>
		</UPageSection>

		<UPageSection id="tz-analysis" class="bg-elevated/25" headline="ТЗ / КП"
			title="Анализ требований и сравнение с коммерческими предложениями"
			description="Система извлекает пункты из технического задания, затем сверяет каждое требование с КП поставщика.">
			<div class="grid gap-8 lg:grid-cols-2 max-w-6xl mx-auto">
				<figure class="space-y-3">
					<figcaption class="space-y-1">
						<p class="font-semibold text-highlighted">Требования из ТЗ</p>
						<p class="text-sm text-muted">
							Проверка и редактирование извлечённых пунктов перед загрузкой КП.
						</p>
					</figcaption>
					<div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
						<img src="/landing/tz_refs.png" alt="Экран подтверждения требований из технического задания"
							class="w-full h-auto" loading="lazy">
					</div>
				</figure>

				<figure class="space-y-3">
					<figcaption class="space-y-1">
						<p class="font-semibold text-highlighted">Сравнение с КП</p>
						<p class="text-sm text-muted">
							Таблица соответствий по каждому пункту, фильтры и экспорт результата.
						</p>
					</figcaption>
					<div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
						<img src="/landing/tz_analyzis.png"
							alt="Экран сравнения коммерческого предложения с требованиями ТЗ" class="w-full h-auto"
							loading="lazy">
					</div>
				</figure>
			</div>

			<div class="flex justify-center mt-8">
				<UButton to="/auth" size="lg" leading-icon="i-lucide-user-plus">
					Регистрация
				</UButton>
			</div>
		</UPageSection>

		<UPageSection id="testimonials" class="bg-elevated/25" headline="Отзывы" title="Что говорят команды закупок">
			<UPageGrid class="gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<UCard v-for="item in testimonials" :key="item.name" class="h-full">
					<div class="flex gap-0.5 mb-3 text-warning" aria-label="5 из 5">
						<svg v-for="i in 5" :key="i" viewBox="0 0 24 24" class="size-4 shrink-0 fill-current"
							aria-hidden="true">
							<path
								d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
						</svg>
					</div>
					<p class="text-sm text-default mb-4">«{{ item.quote }}»</p>
					<div class="flex items-center gap-3">
						<div
							class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
							{{ item.initials }}
						</div>
						<div>
							<p class="text-sm font-medium">{{ item.name }}</p>
							<p class="text-xs text-muted">{{ item.role }}</p>
						</div>
					</div>
				</UCard>
			</UPageGrid>
		</UPageSection>

		<UPageSection id="requests" title="Ускорьте подготовку дополнительных запросов участникам"
			description="Составление текста запросов и рассылка - в несколько кликов." orientation="horizontal" reverse>
			<div class="flex flex-col gap-4 rounded-xl border border-default bg-elevated p-6 lg:p-8">
				<div v-for="item in requestHighlights" :key="item" class="flex items-start gap-3 text-muted">
					<UIcon name="i-lucide-check-circle" class="mt-0.5 size-5 shrink-0 text-primary" />
					<span>{{ item }}</span>
				</div>
			</div>
		</UPageSection>

		<UPageSection id="subscription" headline="Подписка" title="Оформление доступа"
			description="Прозрачный процесс от регистрации до работы в системе.">
			<UPageGrid>
				<UPageCard v-for="(step, index) in subscriptionSteps" :key="index" spotlight :title="step.title"
					:description="step.description" :icon="step.icon" />
			</UPageGrid>
		</UPageSection>

		<UPageSection id="faq" class="bg-elevated/25" headline="FAQ" title="Частые вопросы">
			<UAccordion type="multiple" :unmount-on-hide="false" :items="faqAccordionItems"
				class="max-w-3xl mx-auto rounded-xl border border-default bg-default px-4 sm:px-5" :ui="{
					trigger: 'py-4 text-base font-medium',
					body: 'text-sm text-muted pb-4 leading-relaxed',
					content: 'overflow-hidden',
				}" />
		</UPageSection>

		<UPageCTA title="AI + аналитика = лучшие контракты"
			description="Автоматизируйте закупки уже сегодня. Работает в браузере - без установки." :links="ctaLinks" />
	</UPage>
</template>

<script setup lang="ts">
import type { AccordionItem, ButtonProps } from '@nuxt/ui'

definePageMeta({
	layout: 'default',
})

const registerPath = '/auth?tab=register'

const heroLinks = ref<ButtonProps[]>([
	{
		label: 'Регистрация',
		to: registerPath,
		icon: 'i-lucide-user-plus',
		size: 'lg',
	},
	{
		label: 'Как это работает',
		color: 'neutral',
		variant: 'subtle',
		trailingIcon: 'i-lucide-arrow-right',
		to: '#how-it-works',
		size: 'lg',
	},
])

const ctaLinks = ref<ButtonProps[]>([
	{
		label: 'Регистрация',
		to: registerPath,
		icon: 'i-lucide-user-plus',
	},
])

const metrics = [
	{
		value: '×10',
		label: 'Быстрее анализ объёмных технических предложений',
		icon: 'i-lucide-zap',
	},
	{
		value: 'до 95%',
		label: 'Точность проверки по заданным параметрам',
		icon: 'i-lucide-target',
	},
	{
		value: '-80%',
		label: 'Снижение закупочных рисков за счёт системной проверки',
		icon: 'i-lucide-shield-check',
	},
	{
		value: '0',
		label: 'Установок - всё работает в браузере',
		icon: 'i-lucide-globe',
	},
]

const features = [
	{
		title: 'Поиск поставщиков',
		description: 'Автоматический поиск компаний по запросу и региону поставки.',
		icon: 'i-lucide-search',
	},
	{
		title: 'Рассылка запросов',
		description: 'Выбор поставщиков, параметры письма и отправка из одного экрана.',
		icon: 'i-lucide-send',
	},
	{
		title: 'Входящие ответы',
		description: 'Переписка с поставщиками, индикаторы новых сообщений и сравнение.',
		icon: 'i-lucide-inbox',
	},
	{
		title: 'Анализ ТЗ и КП',
		description: 'Извлечение требований из ТЗ и сверка с коммерческими предложениями.',
		icon: 'i-lucide-file-search',
	},
	{
		title: 'Готовые отчёты',
		description: 'Таблица соответствия, экспорт в XLSX/DOCX и письма поставщикам.',
		icon: 'i-lucide-file-check',
	},
	{
		title: 'Меньше рутины',
		description: 'Специалисты занимаются стратегией, а не ручной сверкой таблиц.',
		icon: 'i-lucide-sparkles',
	},
]

const painPoints = [
	{
		title: 'Часы на ручную сверку',
		description: 'Десятки страниц ТЗ и КП обрабатываются автоматически за минуты.',
		icon: 'i-lucide-clock',
	},
	{
		title: 'Риск пропустить несоответствие',
		description: 'ИИ проверяет каждый параметр и подсвечивает расхождения.',
		icon: 'i-lucide-circle-alert',
	},
	{
		title: 'Сложно масштабировать команду',
		description: 'Та же команда закрывает больше запросов без найма новых сотрудников.',
		icon: 'i-lucide-users',
	},
]

const browserFlowSteps = [
	{
		title: 'Создайте поиск поставщиков',
		description: 'Укажите товар и регион. Система найдёт компании и сохранит запрос в истории.',
	},
	{
		title: 'Выберите поставщиков и отправьте запрос',
		description: 'Включите нужных участников, настройте письмо и запустите рассылку.',
	},
	{
		title: 'Обработайте входящие ответы',
		description: 'Переписка, сравнение по требованиям и запрос недостающих параметров.',
	},
	{
		title: 'Сравните ТЗ с КП и экспортируйте результат',
		description: 'Загрузите ТЗ и КП, подтвердите требования, получите таблицу и экспорт.',
	},
]

const testimonials = [
	{
		quote: 'Раньше на один тендер уходил весь день. Теперь проверяем за обед, и ошибок стало ноль.',
		name: 'Алексей К.',
		role: 'Руководитель отдела закупок',
		initials: 'А',
	},
	{
		quote: 'Начали участвовать в большем числе закупок - без расширения штата.',
		name: 'Мария С.',
		role: 'Коммерческий директор',
		initials: 'М',
	},
	{
		quote: 'Система нашла критическое несоответствие до дедлайна - спасли контракт.',
		name: 'Дмитрий П.',
		role: 'Главный инженер',
		initials: 'Д',
	},
]

const requestHighlights = [
	'Автоматическое формирование текста запросов участникам',
	'Единый шаблон для дополнительных уточнений',
	'Отправка писем без ручной подготовки каждого документа',
]

const subscriptionSteps = [
	{
		title: 'Регистрация',
		description: 'Создайте аккаунт и подтвердите согласие с условиями использования.',
		icon: 'i-lucide-user-plus',
	},
	{
		title: 'Изучите договор',
		description: 'Ознакомьтесь с публичным договором возмездного оказания услуг.',
		icon: 'i-lucide-file-text',
	},
	{
		title: 'Получите счёт',
		description: 'Счёт на оплату придёт на ваш email.',
		icon: 'i-lucide-receipt',
	},
	{
		title: 'Активируйте доступ',
		description: 'После оплаты доступ активируется - вы получите email с деталями входа.',
		icon: 'i-lucide-key-round',
	},
]

const faqItems = [
	{
		question: 'Нужно ли устанавливать программу?',
		answer: 'Нет. TenderOptima работает в браузере - зарегистрируйтесь и начните работу сразу.',
	},
	{
		question: 'В каком формате должно быть техническое задание?',
		answer: 'Поддерживаются Word (DOC/DOCX), Excel (XLS/XLSX) и PDF. Загружайте файлы в том виде, в котором получили от заказчика.',
	},
	{
		question: 'Сколько времени занимает анализ?',
		answer: 'Извлечение требований из ТЗ - минуты. Полный анализ КП может занять до нескольких часов в зависимости от объёма.',
	},
	{
		question: 'Как отслеживать ответы поставщиков?',
		answer: 'В истории запросов отображаются счётчики «Входящие / Всего». Для завершённых рассылок переход ведёт сразу к переписке.',
	},
]

const faqAccordionItems = computed<AccordionItem[]>(() =>
	faqItems.map((item, index) => ({
		label: item.question,
		content: item.answer,
		value: String(index),
	})),
)
</script>
