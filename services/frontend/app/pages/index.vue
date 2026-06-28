<template>
	<div class="landing-page">
		<!-- Hero -->
		<section class="landing-hero py-(--landing-section-py) px-4 sm:px-6 lg:px-8">
			<div class="landing-hero-shape landing-hero-shape-1" aria-hidden="true" />
			<div class="landing-hero-shape landing-hero-shape-2" aria-hidden="true" />
			<div ref="heroReveal" class="reveal is-visible relative z-10 mx-auto max-w-5xl text-center">

				<p class="landing-hero-eyebrow mb-4 text-sm font-semibold uppercase tracking-widest">
					TenderOptima
				</p>
				<h1
					class="landing-hero-title mb-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
					AI-сервис для автоматизации закупок и анализа предложений поставщиков
				</h1>
				<p class="landing-hero-subtitle mx-auto mb-10 max-w-3xl text-lg leading-relaxed sm:text-xl">
					Поиск поставщиков, рассылка запросов, входящие ответы и сравнение КП с ТЗ - в одном браузерном
					интерфейсе. Без ручной сверки таблиц.
				</p>
				<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
					<UButton :to="registerPath" size="xl" leading-icon="i-lucide-user-plus"
						class="cursor-pointer landing-cta-shadow">
						Регистрация
					</UButton>
					<UButton to="#tz-analysis" size="xl" color="neutral" variant="outline"
						trailing-icon="i-lucide-arrow-right" class="cursor-pointer landing-hero-secondary-btn">
						Как это работает
					</UButton>
				</div>
			</div>
		</section>

		<!-- Metrics -->
		<section id="metrics" ref="metricsReveal"
			class="landing-metrics-band reveal py-(--landing-section-py) px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-6xl">
				<div class="mb-12 text-center">
					<p class="landing-section-headline mb-2">
						Результаты
					</p>
					<h2 class="landing-section-title mb-4">
						Измеримый эффект для закупок
					</h2>
					<p class="landing-section-description mx-auto">
						Конкретные показатели, которые получают команды закупок.
					</p>
				</div>

				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
					<div v-for="(metric, index) in metrics" :key="metric.label"
						class="landing-metric-card reveal rounded-2xl p-6 text-center backdrop-blur-sm"
						:class="[`stagger-${index + 1}`, { 'is-visible': metricsVisible }]">
						<UIcon :name="metric.icon" class="landing-metric-icon mx-auto mb-4 size-8" />
						<p class="landing-metric-value mb-2">
							{{ metricCounters[index]?.display || metric.value }}
						</p>
						<p class="text-sm leading-relaxed landing-metric-label">
							{{ metric.label }}
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Features -->
		<section id="features" ref="featuresReveal"
			class="reveal bg-default py-(--landing-section-py) px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-6xl">
				<div class="mb-12 text-center">
					<h2 class="landing-section-title mb-4">
						Всё для работы с поставщиками - в одном инструменте
					</h2>
					<p class="landing-section-description mx-auto">
						TenderOptima автоматизирует поиск, переписку и технический анализ предложений.
					</p>
				</div>

				<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					<article v-for="(feature, index) in features" :key="feature.title"
						class="landing-card landing-card-feature reveal cursor-pointer"
						:class="[`stagger-${(index % 6) + 1}`, { 'is-visible': featuresVisible }]">
						<div class="mb-4 flex items-start justify-between gap-3">
							<div class="flex size-11 items-center justify-center rounded-xl bg-primary/10">
								<UIcon :name="feature.icon" class="size-5 text-primary" />
							</div>
							<span class="text-xs font-semibold tabular-nums text-muted">
								{{ String(index + 1).padStart(2, '0') }}
							</span>
						</div>
						<h3 class="mb-2 text-lg font-semibold text-highlighted">
							{{ feature.title }}
						</h3>
						<p class="text-sm leading-relaxed text-muted">
							{{ feature.description }}
						</p>
					</article>
				</div>
			</div>
		</section>

		<!-- Pain points
		<section
			id="pain"
			ref="painReveal"
			class="reveal bg-elevated/25 py-[var(--landing-section-py)] px-4 sm:px-6 lg:px-8"
		>
			<div class="mx-auto max-w-6xl">
				<div class="mb-12 text-center">
					<p class="landing-section-headline mb-2">
						Проблема
					</p>
					<h2 class="landing-section-title mb-4">
						Ручная обработка заявок отнимает время и повышает риски
					</h2>
					<p class="landing-section-description mx-auto">
						TenderOptima берёт на себя рутину, чтобы команда фокусировалась на решениях.
					</p>
				</div>

				<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					<article
						v-for="(pain, index) in painPoints"
						:key="pain.title"
						class="landing-card landing-card-pain reveal cursor-pointer"
						:class="[`stagger-${index + 1}`, { 'is-visible': painVisible }]"
					>
						<div class="mb-4 flex size-11 items-center justify-center rounded-xl bg-error/10">
							<UIcon :name="pain.icon" class="size-5 text-error" />
						</div>
						<h3 class="mb-2 text-lg font-semibold text-highlighted">
							{{ pain.title }}
						</h3>
						<p class="text-sm leading-relaxed text-muted">
							{{ pain.description }}
						</p>
					</article>
				</div>
			</div>
		</section> -->

		<!-- TZ / KP analysis -->
		<HowItWorksBrand section-id="tz-analysis" />

		<!-- Testimonials -->
		<section id="testimonials" ref="testimonialsReveal"
			class="reveal py-(--landing-section-py) px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-6xl">
				<div class="mb-12 text-center">
					<p class="landing-section-headline mb-2">
						Отзывы
					</p>
					<h2 class="landing-section-title">
						Что говорят команды закупок
					</h2>
				</div>

				<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					<article v-for="(item, index) in testimonials" :key="item.name"
						class="landing-card landing-card-testimonial reveal cursor-pointer"
						:class="[`stagger-${index + 1}`, { 'is-visible': testimonialsVisible }]">
						<div class="mb-3 flex gap-0.5 text-warning" aria-label="5 из 5">
							<svg v-for="i in 5" :key="i" viewBox="0 0 24 24" class="size-4 shrink-0 fill-current"
								aria-hidden="true">
								<path
									d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
							</svg>
						</div>
						<p class="mb-5 text-sm leading-relaxed text-default">
							«{{ item.quote }}»
						</p>
						<div class="flex items-center gap-3">
							<div
								class="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
								{{ item.initials }}
							</div>
							<div>
								<p class="text-sm font-medium text-highlighted">{{ item.name }}</p>
								<p class="text-xs text-muted">{{ item.role }}</p>
							</div>
						</div>
					</article>
				</div>
			</div>
		</section>

		<!-- Requests -->
		<section id="requests" ref="requestsReveal"
			class="reveal bg-elevated/25 py-(--landing-section-py) px-4 sm:px-6 lg:px-8">
			<div class="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
				<div :class="{ 'is-visible': requestsVisible }" class="reveal">
					<h2 class="landing-section-title mb-4">
						Ускорьте подготовку дополнительных запросов участникам
					</h2>
					<p class="landing-section-description">
						Составление текста запросов и рассылка - в несколько кликов.
					</p>
				</div>

				<div class="landing-card p-6 lg:p-8">
					<div v-for="(item, index) in requestHighlights" :key="item"
						class="reveal flex items-start gap-3 py-3 text-muted first:pt-0 last:pb-0"
						:class="[`stagger-${index + 1}`, { 'is-visible': requestsVisible }]">
						<UIcon name="i-lucide-check-circle" class="mt-0.5 size-5 shrink-0 text-primary" />
						<span class="leading-relaxed">{{ item }}</span>
					</div>
				</div>
			</div>
		</section>

		<!-- Subscription -->
		<section id="subscription" ref="subscriptionReveal"
			class="reveal py-(--landing-section-py) px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-6xl">
				<div class="mb-12 text-center">
					<p class="landing-section-headline mb-2">
						Подписка
					</p>
					<h2 class="landing-section-title mb-4">
						Оформление доступа
					</h2>
					<p class="landing-section-description mx-auto">
						Прозрачный процесс от регистрации до работы в системе.
					</p>
				</div>

				<div class="landing-subscription-grid">
					<article v-for="(step, index) in subscriptionSteps" :key="step.title"
						class="landing-card landing-subscription-step cursor-pointer" :class="{
							'is-visible': isSubscriptionStepVisible(index),
							'is-active': subscriptionVisibleCount === index + 1,
						}">
						<div
							class="landing-subscription-icon mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10">
							<UIcon :name="step.icon" class="size-5 text-primary" />
						</div>
						<h3 class="mb-2 font-semibold text-highlighted">{{ step.title }}</h3>
						<p class="text-sm leading-relaxed text-muted">{{ step.description }}</p>
					</article>
				</div>
			</div>
		</section>

		<!-- FAQ -->
		<section id="faq" ref="faqReveal"
			class="reveal bg-elevated/25 py-(--landing-section-py) px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-3xl">
				<div class="mb-10 text-center">
					<p class="landing-section-headline mb-2">
						FAQ
					</p>
					<h2 class="landing-section-title">
						Частые вопросы
					</h2>
				</div>

				<UAccordion type="multiple" :unmount-on-hide="false" :items="faqAccordionItems"
					class="rounded-xl border border-default bg-default px-4 sm:px-5" :ui="{
						trigger: 'py-4 text-base font-medium cursor-pointer',
						body: 'text-sm text-muted pb-4 leading-relaxed',
						content: 'overflow-hidden',
					}" />
			</div>
		</section>

		<!-- CTA -->
		<section ref="ctaReveal" class="landing-cta-band reveal py-(--landing-section-py) px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-3xl text-center" :class="{ 'is-visible': ctaVisible }">
				<h2 class="landing-cta-title mb-4 text-3xl font-bold sm:text-4xl">
					AI + аналитика = лучшие контракты
				</h2>
				<p class="landing-cta-description mb-8 text-lg">
					Автоматизируйте закупки уже сегодня. Работает в браузере - без установки.
				</p>
				<UButton :to="registerPath" size="xl" color="neutral" variant="solid" leading-icon="i-lucide-user-plus"
					class="cursor-pointer landing-cta-button">
					Регистрация
				</UButton>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui'

import HowItWorksBrand from '~/components/landing/HowItWorksBrand.vue'
import { useCountUp } from '~/composables/useCountUp'
import { useScrollReveal } from '~/composables/useScrollReveal'
import { useSequentialSteps } from '~/composables/useSequentialSteps'

definePageMeta({
	layout: 'default',
})

const registerPath = '/auth?tab=register'

const heroReveal = ref<HTMLElement | null>(null)

onMounted(() => {
	if (!import.meta.client) {
		return
	}

	if (heroReveal.value) {
		heroReveal.value.classList.add('is-visible')
	}

	if (faqReveal.value) {
		faqReveal.value.classList.add('is-visible')
	}
})

const { target: metricsReveal, isVisible: metricsVisible } = useScrollReveal()
const { target: featuresReveal, isVisible: featuresVisible } = useScrollReveal()
const { target: painReveal, isVisible: painVisible } = useScrollReveal()
const { target: testimonialsReveal, isVisible: testimonialsVisible } = useScrollReveal()
const { target: requestsReveal, isVisible: requestsVisible } = useScrollReveal()
const { target: subscriptionReveal, isVisible: subscriptionVisible } = useScrollReveal()
const {
	visibleCount: subscriptionVisibleCount,
	isStepVisible: isSubscriptionStepVisible,
} = useSequentialSteps(4, subscriptionVisible, 180)
const { target: faqReveal } = useScrollReveal()
const { target: ctaReveal, isVisible: ctaVisible } = useScrollReveal()

const metrics = [
	{
		value: '×10',
		numericValue: 10,
		prefix: '×',
		suffix: '',
		label: 'Быстрее анализ объёмных технических предложений',
		icon: 'i-lucide-zap',
	},
	{
		value: 'до 95%',
		numericValue: 95,
		prefix: 'до ',
		suffix: '%',
		label: 'Точность проверки по заданным параметрам',
		icon: 'i-lucide-target',
	},
	{
		value: '-80%',
		numericValue: 80,
		prefix: '-',
		suffix: '%',
		label: 'Снижение закупочных рисков за счёт системной проверки',
		icon: 'i-lucide-shield-check',
	},
	{
		value: '0',
		numericValue: 0,
		prefix: '',
		suffix: '',
		label: 'Установок - всё работает в браузере',
		icon: 'i-lucide-globe',
	},
]

const metricCounters = metrics.map((metric) =>
	useCountUp(metric.numericValue, {
		prefix: metric.prefix,
		suffix: metric.suffix,
	}),
)

watch(metricsVisible, (visible) => {
	if (visible) {
		for (const counter of metricCounters) {
			counter.start()
		}
	}
})

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
