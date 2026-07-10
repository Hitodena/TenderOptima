<!--
  Блок «Поиск и рассылка запросов» с лендинга TenderOptima.

  Источник в проекте:
  - services/frontend/app/components/landing/HowItWorksBrand.vue
  - services/frontend/app/pages/index.vue (supplierFlowSteps)

  Изменения в этой версии:
  - Правая панель: реальные скриншоты (gif/png) заменены на анимированные
    воссозданные UI-моки тех же процессов. Без реальных названий компаний,
    email и контактов (маски). Анимации перезапускаются при смене шага
    благодаря :key="currentStep.id" на <article>.
  - Структура блока, таймлайн, автопереключение и meta — без изменений.

  Интеграция обратно: заменить HowItWorksBrand + :steps="supplierFlowSteps"
  на этот компонент или перенести правки в HowItWorksBrand.vue.
-->
<template>
	<section
		id="supplier-search"
		ref="sectionRef"
		class="landing-hiw reveal bg-elevated/25 py-[var(--landing-section-py)] px-4 sm:px-6 lg:px-8"
		:class="{ 'is-inview': isVisible, 'is-visible': hasRevealed }"
		@mouseenter="pauseAutoplay"
		@mouseleave="resumeAutoplay"
	>
		<div class="landing-hiw__container mx-auto max-w-7xl">
			<header class="mb-8 text-center sm:mb-10">
				<p class="landing-section-headline mb-2">
					Модуль 1. Поиск поставщиков
				</p>
				<h2 class="landing-section-title mb-4">
					Поиск поставщиков и рассылка запросов
				</h2>
				<p class="landing-section-description mx-auto">
					От запроса до сравнения предложений — четыре шага без ручной подготовки писем и таблиц.
				</p>
			</header>

			<div class="landing-hiw__grid">
				<ol class="landing-hiw__timeline" role="list">
					<li
						v-for="(step, stepIndex) in steps"
						:key="step.id"
						class="landing-hiw-step"
						:class="{
							'is-active': isStepActive(stepIndex),
							'is-complete': isStepComplete(stepIndex),
						}"
					>
						<button
							class="landing-hiw-step__button"
							type="button"
							:aria-expanded="String(isStepActive(stepIndex))"
							:aria-controls="`landing-hiw-panel-${step.id}`"
							@click="activate(stepIndex)"
							@mouseenter="activate(stepIndex)"
							@focus="activate(stepIndex)"
						>
							<span class="landing-hiw-step__marker" aria-hidden="true">
								<span class="landing-hiw-step__index">{{ formatStepNumber(stepIndex) }}</span>
							</span>
							<span class="landing-hiw-step__content">
								<span class="landing-hiw-step__title">{{ step.title }}</span>
								<span class="landing-hiw-step__text">{{ step.text }}</span>
							</span>
						</button>
					</li>
				</ol>

				<div class="landing-hiw__sticky">
					<Transition name="landing-hiw-fade" mode="out-in">
						<article
							:id="`landing-hiw-panel-${currentStep.id}`"
							:key="currentStep.id"
							class="landing-hiw__panel landing-card"
							:aria-label="currentStep.title"
						>
							<!-- ====== Анимированный мок-экран (замена скриншотов) ====== -->
							<div class="mock-window">
								<!-- Шапка окна -->
								<div class="mock-window__chrome">
									<span class="mock-window__dots" aria-hidden="true">
										<i></i><i></i><i></i>
									</span>
									<span class="mock-window__url">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mock-window__lock"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
										{{ LANDING_MOCKUP_BROWSER_TITLE }}
									</span>
									<span class="mock-window__live">LIVE</span>
								</div>

								<!-- Тело окна -->
								<div class="mock-window__body">
									<!-- ====== Шаг 01 — Поиск поставщиков ====== -->
									<div v-if="currentStep.id === 'supplier-search'" class="mock-search">
										<div class="mock-search__form">
											<div class="mock-field">
												<span class="mock-field__label">Запрос на закупку</span>
												<span class="mock-field__input">
													<span class="mock-typewriter">Кабель ВВГнг(А)-LSLTx 3×2,5</span>
													<span class="mock-caret" aria-hidden="true"></span>
												</span>
											</div>
											<div class="mock-field mock-field--sm">
												<span class="mock-field__label">Регион</span>
												<span class="mock-field__input mock-field__input--select">Москва и область</span>
											</div>
											<button class="mock-cta" type="button" tabindex="-1">
												Найти поставщиков
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
											</button>
										</div>

										<div class="mock-search__results">
											<div class="mock-search__results-head">
												<span>Найдено <b>18</b> поставщиков</span>
												<span class="mock-pill mock-pill--ok">Проверено</span>
											</div>
											<ul class="mock-search__list">
												<li class="mock-supplier" style="--i:0">
													<span class="mock-supplier__avatar">О</span>
													<span class="mock-supplier__info">
														<span class="mock-supplier__name">ООО «ОптиТорг»</span>
														<span class="mock-supplier__meta">ID: SUP-024 · рейтинг 4.8 · +7 ••• •••-••-••</span>
													</span>
													<span class="mock-supplier__add">+ в рассылку</span>
												</li>
												<li class="mock-supplier" style="--i:1">
													<span class="mock-supplier__avatar mock-supplier__avatar--b">П</span>
													<span class="mock-supplier__info">
														<span class="mock-supplier__name">ОАО «Просонит»</span>
														<span class="mock-supplier__meta">ID: SUP-031 · рейтинг 4.6 · contact@••••••.ru</span>
													</span>
													<span class="mock-supplier__add mock-supplier__add--on">✓ выбран</span>
												</li>
												<li class="mock-supplier" style="--i:2">
													<span class="mock-supplier__avatar mock-supplier__avatar--g">С</span>
													<span class="mock-supplier__info">
														<span class="mock-supplier__name">ООО «Синергия»</span>
														<span class="mock-supplier__meta">ID: SUP-042 · рейтинг 4.9 · +7 ••• •••-••-••</span>
													</span>
													<span class="mock-supplier__add mock-supplier__add--on">✓ выбран</span>
												</li>
											</ul>
										</div>
									</div>

									<!-- ====== Шаг 02 — Переписка с поставщиками ====== -->
									<div v-else-if="currentStep.id === 'supplier-correspondence'" class="mock-mail">
										<div class="mock-mail__sidebar">
											<span class="mock-mail__sidebar-title">Поставщики</span>
											<ul class="mock-mail__list">
												<li class="mock-mail__item mock-mail__item--active" style="--i:0">
													<span class="mock-mail__avatar">О</span>
													<span class="mock-mail__row">
														<span class="mock-mail__name">ООО «ОптиТорг»</span>
														<span class="mock-mail__preview">КП готово, отправляю…</span>
													</span>
													<span class="mock-mail__badge">2</span>
												</li>
												<li class="mock-mail__item" style="--i:1">
													<span class="mock-mail__avatar mock-mail__avatar--b">П</span>
													<span class="mock-mail__row">
														<span class="mock-mail__name">ОАО «Просонит»</span>
														<span class="mock-mail__preview">Уточняем сроки…</span>
													</span>
												</li>
												<li class="mock-mail__item" style="--i:2">
													<span class="mock-mail__avatar mock-mail__avatar--g">С</span>
													<span class="mock-mail__row">
														<span class="mock-mail__name">ООО «Синергия»</span>
														<span class="mock-mail__preview">Цена зафиксирована</span>
													</span>
													<span class="mock-mail__badge">1</span>
												</li>
											</ul>
										</div>

										<div class="mock-mail__thread">
											<div class="mock-mail__bubble mock-mail__bubble--in" style="--i:0">
												<span class="mock-mail__bubble-from">ООО «ОптиТорг» · КП</span>
												<p>Добрый день! Направляем коммерческое предложение по запросу. Срок поставки — 14 дней, цена 412 ₽/м.</p>
												<span class="mock-mail__bubble-attach">📎 КП_ОптиТорг.pdf</span>
											</div>
										</div>

										<div class="mock-mail__extract">
											<span class="mock-mail__extract-title">Извлечённые параметры</span>
											<ul class="mock-mail__params">
												<li class="mock-param" style="--i:0"><span>Цена</span><b>412 ₽/м</b></li>
												<li class="mock-param" style="--i:1"><span>Срок поставки</span><b>14 дней</b></li>
												<li class="mock-param" style="--i:2"><span>Условия оплаты</span><b>30 дней</b></li>
												<li class="mock-param" style="--i:3"><span>Наличие</span><b>на складе</b></li>
											</ul>
											<span class="mock-mail__scan" aria-hidden="true"></span>
										</div>
									</div>

									<!-- ====== Шаг 03 — Сравнение предложений ====== -->
									<div v-else-if="currentStep.id === 'supplier-compare'" class="mock-compare">
										<div class="mock-compare__hint">
											<span class="mock-pill mock-pill--ok">AI сверка с ТЗ</span>
											<span class="mock-compare__hint-text">3 предложения · 5 критериев</span>
										</div>
										<div class="mock-compare__scroll">
											<table class="mock-table">
												<thead>
													<tr>
														<th>Критерий</th>
														<th>ОптиТорг</th>
														<th>Просонит</th>
														<th class="mock-table__best">Синергия</th>
													</tr>
												</thead>
												<tbody>
													<tr style="--i:0"><td>Цена</td><td>412 ₽</td><td>405 ₽</td><td class="mock-table__best-cell">398 ₽</td></tr>
													<tr style="--i:1"><td>Срок поставки</td><td><span class="mock-status mock-status--ok">14 дн ✓</span></td><td><span class="mock-status mock-status--warn">21 дн ⚠</span></td><td class="mock-table__best-cell"><span class="mock-status mock-status--ok">10 дн ✓</span></td></tr>
													<tr style="--i:2"><td>Условия оплаты</td><td><span class="mock-status mock-status--ok">✓</span></td><td><span class="mock-status mock-status--warn">⚠</span></td><td class="mock-table__best-cell"><span class="mock-status mock-status--ok">✓</span></td></tr>
													<tr style="--i:3"><td>Соответствие ТЗ</td><td><span class="mock-status mock-status--warn">частично</span></td><td><span class="mock-status mock-status--err">✕</span></td><td class="mock-table__best-cell"><span class="mock-status mock-status--ok">полное</span></td></tr>
													<tr style="--i:4"><td>Гарантия</td><td>12 мес</td><td>6 мес</td><td class="mock-table__best-cell">24 мес</td></tr>
												</tbody>
											</table>
										</div>
										<div class="mock-compare__recommend" style="--i:5">
											<span class="mock-recommend__chip">★ Рекомендовано</span>
											<span class="mock-recommend__text">ООО «Синергия» — лучшее соответствие ТЗ и цене</span>
										</div>
									</div>

									<!-- ====== Шаг 04 — Выгрузка в Excel ====== -->
									<div v-else-if="currentStep.id === 'supplier-export'" class="mock-export">
										<div class="mock-export__hint">
											<span class="mock-pill mock-pill--ok">XLSX готов</span>
											<span class="mock-export__hint-text">параметры · статусы · пояснения</span>
										</div>
										<div class="mock-export__grid">
											<div class="mock-export__sheet">
												<div class="mock-export__rowhead">№</div>
												<div class="mock-export__rowhead">Критерий</div>
												<div class="mock-export__rowhead">ОптиТорг</div>
												<div class="mock-export__rowhead">Просонит</div>
												<div class="mock-export__rowhead">Синергия</div>

												<div class="mock-export__cell mock-export__cell--num">1</div>
												<div class="mock-export__cell">Цена</div>
												<div class="mock-export__cell mock-export__cell--fill" style="--i:0">412 ₽</div>
												<div class="mock-export__cell mock-export__cell--fill" style="--i:1">405 ₽</div>
												<div class="mock-export__cell mock-export__cell--fill mock-export__cell--best" style="--i:2">398 ₽</div>

												<div class="mock-export__cell mock-export__cell--num">2</div>
												<div class="mock-export__cell">Срок</div>
												<div class="mock-export__cell mock-export__cell--fill" style="--i:3">14 дн</div>
												<div class="mock-export__cell mock-export__cell--fill" style="--i:4">21 дн</div>
												<div class="mock-export__cell mock-export__cell--fill mock-export__cell--best" style="--i:5">10 дн</div>

												<div class="mock-export__cell mock-export__cell--num">3</div>
												<div class="mock-export__cell">ТЗ</div>
												<div class="mock-export__cell mock-export__cell--fill" style="--i:6"><span class="mock-status mock-status--warn">⚠</span></div>
												<div class="mock-export__cell mock-export__cell--fill" style="--i:7"><span class="mock-status mock-status--err">✕</span></div>
												<div class="mock-export__cell mock-export__cell--fill mock-export__cell--best" style="--i:8"><span class="mock-status mock-status--ok">✓</span></div>
											</div>
										</div>
										<div class="mock-export__actions">
											<button class="mock-cta mock-cta--xl" type="button" tabindex="-1">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
												Выгрузить .xlsx
											</button>
											<div class="mock-export__file" style="--i:9">
												<span class="mock-export__file-icon">XLSX</span>
												<span class="mock-export__file-name">Сравнение_КП_2026-07-07.xlsx</span>
												<span class="mock-status mock-status--ok">готов</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div class="landing-hiw__panel-meta">
								<p class="landing-hiw__panel-kicker">
									Шаг {{ formatStepNumber(activeIndex) }}
								</p>
								<h3 class="landing-hiw__panel-title">{{ currentStep.title }}</h3>
								<p class="landing-hiw__panel-description">{{ currentStep.visualText }}</p>
							</div>
						</article>
					</Transition>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { LANDING_MOCKUP_BROWSER_TITLE } from '#shared/constants/landing'
import { useScrollReveal } from '~/composables/useScrollReveal'

export interface SupplierFlowStep {
	id: string
	idLabel: string
	title: string
	text: string
	visualText: string
	image: string
	imageAlt: string
	imageCompact?: boolean
}

const steps: SupplierFlowStep[] = [
	{
		id: 'supplier-search',
		idLabel: 'поиск поставщиков',
		title: 'Поиск поставщиков',
		text: 'Опишите закупку и регион — сервис находит компании с контактами и добавляет их в список для рассылки.',
		visualText: 'Форма поиска: запрос, регион и кнопка «Найти поставщиков» — результаты появляются автоматически.',
		image: '/landing/supplier_flow.gif',
		imageAlt: 'Анимация поиска поставщиков по запросу и региону',
	},
	{
		id: 'supplier-correspondence',
		idLabel: 'переписка и извлечение',
		title: 'Переписка с поставщиками',
		text: 'Письма уходят выбранным поставщикам, ответы собираются во входящих — переписка и извлечение данных в одном окне.',
		visualText: 'Список поставщиков слева, переписка по центру и панель соответствия требованиям справа.',
		image: '/landing/email_chat.png',
		imageAlt: 'Экран переписки с поставщиками и извлечения параметров из ответов',
	},
	{
		id: 'supplier-compare',
		idLabel: 'сравнение предложений',
		title: 'Сравнение предложений',
		text: 'Ответы сверяются по каждому параметру запроса — цена, сроки, условия — с сортировкой и статусами по пунктам.',
		visualText: 'Таблица сравнения: требования в строках, предложение поставщика и статус «Выполнено» / «Частично».',
		image: '/landing/supplier_table.png',
		imageAlt: 'Таблица сравнения коммерческих предложений поставщиков',
		imageCompact: true,
	},
	{
		id: 'supplier-export',
		idLabel: 'выгрузка в Excel',
		title: 'Выгрузка в Excel',
		text: 'Готовая таблица соответствия выгружается в XLSX — для согласования, архива или передачи коллегам.',
		visualText: 'Экспорт с теми же параметрами, статусами и пояснениями — без ручной сборки таблицы.',
		image: '/landing/excel.png',
		imageAlt: 'Таблица сравнения предложений в формате Excel',
		imageCompact: true,
	},
]

const props = withDefaults(
	defineProps<{
		autoplay?: boolean
		intervalMs?: number
		initialStep?: number
	}>(),
	{
		autoplay: true,
		intervalMs: 5000,
		initialStep: 0,
	},
)

const { target: sectionRef, isVisible } = useScrollReveal({
	once: false,
	threshold: 0.12,
})

const activeIndex = ref(props.initialStep)
const currentStep = computed(
	() => steps[activeIndex.value] ?? steps[0],
)

let timer: ReturnType<typeof setInterval> | null = null
const isPausedByHover = ref(false)
const hasRevealed = ref(false)

function toStepIndex(index: number | string): number {
	return typeof index === 'number' ? index : Number(index)
}

function formatStepNumber(index: number | string): string {
	return String(toStepIndex(index) + 1).padStart(2, '0')
}

function isStepActive(index: number | string): boolean {
	return toStepIndex(index) === activeIndex.value
}

function isStepComplete(index: number | string): boolean {
	return toStepIndex(index) < activeIndex.value
}

function activate(index: number | string) {
	activeIndex.value = toStepIndex(index)
	if (!isPausedByHover.value) {
		restartAutoplay()
	}
}

function pauseAutoplay() {
	isPausedByHover.value = true
	stopAutoplay()
}

function resumeAutoplay() {
	isPausedByHover.value = false
	if (isVisible.value) {
		startAutoplay()
	}
}

function startAutoplay() {
	if (
		!props.autoplay
		|| steps.length < 2
		|| isPausedByHover.value
		|| !isVisible.value
	) {
		return
	}
	timer = setInterval(() => {
		activeIndex.value = (activeIndex.value + 1) % steps.length
	}, props.intervalMs)
}

function stopAutoplay() {
	if (timer) clearInterval(timer)
	timer = null
}

function restartAutoplay() {
	stopAutoplay()
	startAutoplay()
}

watch(isVisible, (visible) => {
	if (visible) {
		hasRevealed.value = true
	}
	if (visible && !isPausedByHover.value) {
		startAutoplay()
	}
	else {
		stopAutoplay()
	}
})

onBeforeUnmount(stopAutoplay)
</script>

<style scoped>
/* ====================== Заголовки секции (без изменений) ====================== */
.landing-section-headline {
	font-size: 0.8125rem;
	font-weight: 600;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--ui-primary);
}

.landing-section-title {
	font-size: clamp(1.75rem, 3.5vw, 2.5rem);
	font-weight: 700;
	line-height: 1.2;
	letter-spacing: -0.02em;
	color: var(--ui-text-highlighted);
}

.landing-section-description {
	max-width: 42rem;
	font-size: 1.0625rem;
	line-height: 1.65;
	color: var(--ui-text-muted);
}

.landing-card {
	border: 1px solid var(--ui-border);
	border-radius: 1rem;
	background: var(--ui-bg);
	transition:
		box-shadow 0.25s ease,
		transform 0.25s ease,
		border-color 0.25s ease;
}

.landing-hiw__grid {
	display: grid;
	grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
	gap: clamp(1.25rem, 3vw, 2.5rem);
	align-items: start;
}

.landing-hiw__timeline {
	display: grid;
	gap: 0;
	list-style: none;
	margin: 0;
	padding: 0;
}

.landing-hiw-step {
	position: relative;
	padding-left: 0;
}

.landing-hiw-step:not(:last-child)::after {
	content: '';
	position: absolute;
	left: 19px;
	top: 40px;
	bottom: 0;
	width: 2px;
	background: color-mix(in oklab, var(--ui-primary) 22%, var(--ui-border));
	transform: translateX(-50%);
	pointer-events: none;
}

.landing-hiw-step.is-complete:not(:last-child)::after {
	background: color-mix(in oklab, var(--ui-primary) 55%, var(--ui-border));
}

.landing-hiw-step__button {
	position: relative;
	z-index: 1;
	width: 100%;
	display: grid;
	grid-template-columns: 40px minmax(0, 1fr);
	gap: 0.875rem;
	padding: 0 0 1.25rem;
	text-align: left;
	border: 0;
	background: transparent;
	color: inherit;
	cursor: pointer;
}

.landing-hiw-step:last-child .landing-hiw-step__button {
	padding-bottom: 0;
}

.landing-hiw-step__marker {
	position: relative;
	display: flex;
	justify-content: center;
	width: 40px;
	flex-shrink: 0;
}

.landing-hiw-step__index {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	border-radius: 999px;
	background: var(--ui-bg);
	border: 2px solid var(--ui-border);
	color: var(--ui-text-muted);
	font-size: 0.8125rem;
	font-weight: 700;
	line-height: 1;
	font-variant-numeric: tabular-nums;
	transition:
		background 200ms ease,
		border-color 200ms ease,
		color 200ms ease,
		box-shadow 200ms ease;
}

.landing-hiw-step__content {
	display: grid;
	gap: 0.375rem;
	padding-top: 0.375rem;
}

.landing-hiw-step__title {
	color: var(--ui-text-highlighted);
	font-size: clamp(1rem, 1.6vw, 1.25rem);
	line-height: 1.25;
	font-weight: 600;
	letter-spacing: -0.01em;
	transition: color 200ms ease;
}

.landing-hiw-step__text {
	color: var(--ui-text-muted);
	font-size: 0.875rem;
	line-height: 1.6;
	max-width: 36rem;
}

.landing-hiw-step.is-active .landing-hiw-step__index,
.landing-hiw-step.is-complete .landing-hiw-step__index {
	background: var(--ui-primary);
	border-color: var(--ui-primary);
	color: var(--ui-primary-foreground, white);
	box-shadow: 0 4px 14px color-mix(in oklab, var(--ui-primary) 35%, transparent);
}

.landing-hiw-step.is-active .landing-hiw-step__title {
	color: var(--ui-primary);
}

.landing-hiw__sticky {
	position: sticky;
	top: 5.5rem;
}

.landing-hiw__panel {
	padding: 0.875rem;
	overflow: hidden;
}

.landing-hiw__panel-meta {
	display: grid;
	gap: 0.375rem;
	padding: 0.875rem 0.25rem 0.25rem;
}

.landing-hiw__panel-kicker {
	margin: 0;
	color: var(--ui-primary);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	font-size: 0.6875rem;
	font-weight: 700;
}

.landing-hiw__panel-title {
	margin: 0;
	color: var(--ui-text-highlighted);
	font-size: 1.125rem;
	line-height: 1.3;
	font-weight: 600;
}

.landing-hiw__panel-description {
	margin: 0;
	color: var(--ui-text-muted);
	line-height: 1.6;
	font-size: 0.8125rem;
}

.landing-hiw-fade-enter-active,
.landing-hiw-fade-leave-active {
	transition: opacity 200ms ease, transform 200ms ease;
}

.landing-hiw-fade-enter-from,
.landing-hiw-fade-leave-to {
	opacity: 0;
	transform: translateY(6px);
}

@media (max-width: 960px) {
	.landing-hiw__grid {
		grid-template-columns: 1fr;
	}

	.landing-hiw__sticky {
		position: static;
		order: -1;
	}
}

@media (max-width: 640px) {
	.landing-hiw-step__button {
		grid-template-columns: 36px minmax(0, 1fr);
		gap: 0.75rem;
	}

	.landing-hiw-step__marker {
		width: 36px;
	}

	.landing-hiw-step__index {
		width: 36px;
		height: 36px;
		font-size: 0.75rem;
	}

	.landing-hiw-step:not(:last-child)::after {
		left: 17px;
		top: 36px;
	}

	.landing-hiw__panel {
		padding: 0.625rem;
	}
}

/* ====================== Mock base (окно приложения) ====================== */
.mock-window {
	position: relative;
	overflow: hidden;
	border-radius: 0.75rem;
	border: 1px solid var(--ui-border);
	background:
		radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--ui-primary) 10%, transparent), transparent 60%),
		var(--ui-bg-elevated, var(--ui-bg));
	box-shadow: 0 18px 40px -24px rgba(15, 23, 42, 0.35);
}

.mock-window__chrome {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 0.75rem;
	border-bottom: 1px solid var(--ui-border);
	background: color-mix(in oklab, var(--ui-bg) 60%, var(--ui-bg-elevated));
}

.mock-window__dots {
	display: inline-flex;
	gap: 0.3rem;
}

.mock-window__dots i {
	width: 0.6rem;
	height: 0.6rem;
	border-radius: 999px;
	background: var(--ui-border);
	display: block;
}

.mock-window__dots i:nth-child(1) { background: #f87171; }
.mock-window__dots i:nth-child(2) { background: #fbbf24; }
.mock-window__dots i:nth-child(3) { background: #34d399; }

.mock-window__url {
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	flex: 1;
	min-width: 0;
	margin-inline: auto;
	padding: 0.2rem 0.6rem;
	border-radius: 999px;
	background: var(--ui-bg);
	border: 1px solid var(--ui-border);
	color: var(--ui-text-dimmed, var(--ui-text-muted));
	font-size: 0.7rem;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-window__lock { width: 0.75rem; height: 0.75rem; flex: none; opacity: 0.7; }

.mock-window__crumb { color: var(--ui-text-muted); }

.mock-window__live {
	flex: none;
	font-size: 0.6rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	color: #10b981;
	padding: 0.15rem 0.4rem;
	border-radius: 999px;
	background: color-mix(in oklab, #10b981 14%, transparent);
	border: 1px solid color-mix(in oklab, #10b981 35%, transparent);
	animation: mock-live 1.6s ease-in-out infinite;
}

@keyframes mock-live {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.45; }
}

.mock-window__body {
	padding: 0.875rem;
	min-height: 16rem;
}

/* Утилиты моков */
.mock-pill {
	display: inline-flex;
	align-items: center;
	font-size: 0.62rem;
	font-weight: 700;
	letter-spacing: 0.02em;
	padding: 0.15rem 0.45rem;
	border-radius: 999px;
}
.mock-pill--ok { color: #047857; background: color-mix(in oklab, #10b981 16%, transparent); }

.mock-status {
	display: inline-flex;
	align-items: center;
	font-size: 0.66rem;
	font-weight: 600;
	padding: 0.1rem 0.4rem;
	border-radius: 0.35rem;
	white-space: nowrap;
}
.mock-status--ok { color: #047857; background: color-mix(in oklab, #10b981 16%, transparent); }
.mock-status--warn { color: #b45309; background: color-mix(in oklab, #f59e0b 18%, transparent); }
.mock-status--err { color: #b91c1c; background: color-mix(in oklab, #ef4444 16%, transparent); }

.mock-cta {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.55rem 0.9rem;
	border-radius: 0.55rem;
	border: 0;
	font-size: 0.78rem;
	font-weight: 600;
	color: var(--ui-primary-foreground, #fff);
	background: var(--ui-primary);
	box-shadow: 0 8px 20px -8px color-mix(in oklab, var(--ui-primary) 70%, transparent);
	animation: mock-cta-pulse 2.4s ease-in-out infinite;
}
.mock-cta svg { width: 0.9rem; height: 0.9rem; }
.mock-cta--xl { padding: 0.6rem 1rem; }

@keyframes mock-cta-pulse {
	0%, 100% { transform: none; box-shadow: 0 8px 20px -8px color-mix(in oklab, var(--ui-primary) 70%, transparent); }
	50% { transform: translateY(-1px); box-shadow: 0 14px 28px -10px color-mix(in oklab, var(--ui-primary) 80%, transparent); }
}

/* Cascade-анимация появления (используется через --i) */
.mock-window__body [style*="--i"] {
	animation: mock-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
	animation-delay: calc(var(--i, 0) * 0.12s + 0.15s);
}
@keyframes mock-rise {
	from { opacity: 0; transform: translateY(8px); }
	to { opacity: 1; transform: none; }
}

/* ====================== Шаг 01 — Поиск поставщиков ====================== */
.mock-search { display: grid; gap: 0.75rem; }

.mock-search__form {
	display: grid;
	gap: 0.6rem;
	padding: 0.75rem;
	border-radius: 0.6rem;
	border: 1px solid var(--ui-border);
	background: var(--ui-bg);
}

.mock-field { display: grid; gap: 0.3rem; }
.mock-field__label { font-size: 0.66rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
.mock-field__input {
	display: flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.5rem 0.65rem;
	border-radius: 0.5rem;
	border: 1px solid var(--ui-border);
	background: var(--ui-bg-elevated, var(--ui-bg));
	font-size: 0.8rem;
	color: var(--ui-text-highlighted);
	min-width: 0;
}
.mock-field__input--select::after { content: '▾'; margin-left: auto; color: var(--ui-text-muted); font-size: 0.7rem; }
.mock-field--sm { grid-template-columns: 1fr; }

.mock-typewriter {
	white-space: nowrap;
	overflow: hidden;
	border-right: 0;
	max-width: 100%;
}
/* Эффект печати: ширина растёт по шагам */
.mock-search__form .mock-typewriter {
	display: inline-block;
	animation: mock-type 1.6s steps(30, end) both;
}
@keyframes mock-type {
	from { width: 0; }
	to { width: 100%; }
}
.mock-caret {
	display: inline-block;
	width: 2px;
	height: 1em;
	margin-left: 1px;
	background: var(--ui-primary);
	transform: translateY(2px);
	animation: mock-blink 1s steps(1) infinite;
}
@keyframes mock-blink { 50% { opacity: 0; } }

.mock-search__results { display: grid; gap: 0.5rem; }
.mock-search__results-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.72rem;
	color: var(--ui-text-muted);
}
.mock-search__results-head b { color: var(--ui-text-highlighted); }

.mock-search__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }

.mock-supplier {
	display: grid;
	grid-template-columns: auto 1fr auto;
	align-items: center;
	gap: 0.6rem;
	padding: 0.55rem 0.6rem;
	border-radius: 0.55rem;
	border: 1px solid var(--ui-border);
	background: var(--ui-bg);
}
.mock-supplier__avatar {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.8rem; height: 1.8rem;
	border-radius: 0.45rem;
	font-size: 0.75rem; font-weight: 700; color: #fff;
	background: #6366f1;
}
.mock-supplier__avatar--b { background: #0ea5e9; }
.mock-supplier__avatar--g { background: #10b981; }
.mock-supplier__info { display: grid; gap: 0.1rem; min-width: 0; }
.mock-supplier__name { font-size: 0.78rem; font-weight: 600; color: var(--ui-text-highlighted); }
.mock-supplier__meta { font-size: 0.64rem; color: var(--ui-text-dimmed, var(--ui-text-muted)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mock-supplier__add {
	font-size: 0.66rem;
	font-weight: 600;
	color: var(--ui-text-muted);
	padding: 0.25rem 0.5rem;
	border-radius: 0.4rem;
	border: 1px dashed var(--ui-border);
	white-space: nowrap;
}
.mock-supplier__add--on {
	color: #047857;
	border-color: color-mix(in oklab, #10b981 40%, transparent);
	background: color-mix(in oklab, #10b981 12%, transparent);
	border-style: solid;
}

/* ====================== Шаг 02 — Переписка ====================== */
.mock-mail {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr);
	gap: 0.5rem;
	min-height: 14rem;
}

.mock-mail__sidebar { display: grid; gap: 0.4rem; align-content: start; }
.mock-mail__sidebar-title { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
.mock-mail__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
.mock-mail__item {
	display: grid;
	grid-template-columns: auto 1fr auto;
	gap: 0.45rem;
	align-items: center;
	padding: 0.4rem;
	border-radius: 0.45rem;
	border: 1px solid var(--ui-border);
	background: var(--ui-bg);
}
.mock-mail__item--active { border-color: color-mix(in oklab, var(--ui-primary) 50%, var(--ui-border)); box-shadow: 0 0 0 2px color-mix(in oklab, var(--ui-primary) 18%, transparent); }
.mock-mail__avatar { width: 1.5rem; height: 1.5rem; border-radius: 0.4rem; font-size: 0.65rem; font-weight: 700; color: #fff; display: inline-flex; align-items: center; justify-content: center; background: #6366f1; }
.mock-mail__avatar--b { background: #0ea5e9; }
.mock-mail__avatar--g { background: #10b981; }
.mock-mail__row { display: grid; gap: 0.1rem; min-width: 0; }
.mock-mail__name { font-size: 0.68rem; font-weight: 600; color: var(--ui-text-highlighted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mock-mail__preview { font-size: 0.6rem; color: var(--ui-text-dimmed, var(--ui-text-muted)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mock-mail__badge { font-size: 0.58rem; font-weight: 700; color: #fff; background: var(--ui-primary); border-radius: 999px; padding: 0 0.3rem; line-height: 1.1; }

.mock-mail__thread {
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	gap: 0.4rem;
	padding: 0.4rem;
	border-radius: 0.5rem;
	border: 1px solid var(--ui-border);
	background: var(--ui-bg);
}
.mock-mail__bubble {
	border-radius: 0.6rem;
	padding: 0.5rem 0.6rem;
	max-width: 100%;
	font-size: 0.7rem;
	line-height: 1.4;
}
.mock-mail__bubble--in {
	background: color-mix(in oklab, var(--ui-primary) 8%, var(--ui-bg-elevated, var(--ui-bg)));
	border: 1px solid color-mix(in oklab, var(--ui-primary) 20%, var(--ui-border));
	color: var(--ui-text);
}
.mock-mail__bubble p { margin: 0.25rem 0; }
.mock-mail__bubble-from { display: block; font-size: 0.62rem; font-weight: 700; color: var(--ui-primary); }
.mock-mail__bubble-attach { font-size: 0.62rem; color: var(--ui-text-muted); }

.mock-mail__extract {
	position: relative;
	display: grid;
	gap: 0.35rem;
	align-content: start;
	padding: 0.5rem;
	border-radius: 0.5rem;
	border: 1px solid var(--ui-border);
	background: var(--ui-bg);
	overflow: hidden;
}
.mock-mail__extract-title { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
.mock-mail__params { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
.mock-param { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; font-size: 0.68rem; }
.mock-param span { color: var(--ui-text-muted); }
.mock-param b { color: var(--ui-text-highlighted); font-weight: 600; }
/* Scan-линия */
.mock-mail__scan {
	position: absolute;
	left: 0; right: 0;
	height: 2px;
	background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--ui-primary) 70%, transparent), transparent);
	top: 0;
	animation: mock-scan 2.6s ease-in-out infinite;
}
@keyframes mock-scan {
	0% { top: 0; opacity: 0; }
	10% { opacity: 1; }
	90% { opacity: 1; }
	100% { top: 100%; opacity: 0; }
}

/* ====================== Шаг 03 — Сравнение ====================== */
.mock-compare { display: grid; gap: 0.55rem; }
.mock-compare__hint { display: flex; align-items: center; gap: 0.5rem; }
.mock-compare__hint-text { font-size: 0.68rem; color: var(--ui-text-muted); }

.mock-compare__scroll { overflow-x: auto; border-radius: 0.5rem; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-table { width: 100%; border-collapse: collapse; min-width: 26rem; }
.mock-table th, .mock-table td {
	padding: 0.4rem 0.5rem;
	font-size: 0.7rem;
	border-bottom: 1px solid var(--ui-border);
	white-space: nowrap;
}
.mock-table th {
	text-align: left;
	font-weight: 600;
	color: var(--ui-text-dimmed, var(--ui-text-muted));
	background: color-mix(in oklab, var(--ui-bg-elevated, var(--ui-bg)) 70%, var(--ui-bg));
}
.mock-table td { color: var(--ui-text); }
.mock-table tbody tr:last-child td { border-bottom: 0; }
.mock-table__best { position: relative; }
.mock-table__best-cell { background: color-mix(in oklab, #10b981 10%, transparent); }
.mock-table__best::after {
	content: '';
	position: absolute;
	inset: 0;
	box-shadow: inset 0 0 0 2px color-mix(in oklab, #10b981 45%, transparent);
	pointer-events: none;
	animation: mock-glow 2s ease-in-out infinite;
}
@keyframes mock-glow {
	0%, 100% { box-shadow: inset 0 0 0 2px color-mix(in oklab, #10b981 40%, transparent); }
	50% { box-shadow: inset 0 0 14px 0 color-mix(in oklab, #10b981 35%, transparent); }
}

.mock-compare__recommend {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.45rem 0.55rem;
	border-radius: 0.5rem;
	border: 1px solid color-mix(in oklab, #10b981 40%, var(--ui-border));
	background: color-mix(in oklab, #10b981 8%, var(--ui-bg));
}
.mock-recommend__chip { font-size: 0.66rem; font-weight: 700; color: #047857; }
.mock-recommend__text { font-size: 0.68rem; color: var(--ui-text); }

/* ====================== Шаг 04 — Экспорт ====================== */
.mock-export { display: grid; gap: 0.55rem; }
.mock-export__hint { display: flex; align-items: center; gap: 0.5rem; }
.mock-export__hint-text { font-size: 0.68rem; color: var(--ui-text-muted); }

.mock-export__grid { overflow-x: auto; border-radius: 0.5rem; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-export__sheet {
	display: grid;
	grid-template-columns: 2rem minmax(8rem, 1.4fr) repeat(3, minmax(5rem, 1fr));
	min-width: 30rem;
}
.mock-export__rowhead {
	padding: 0.35rem 0.45rem;
	font-size: 0.64rem;
	font-weight: 700;
	color: var(--ui-text-dimmed, var(--ui-text-muted));
	background: color-mix(in oklab, #10b981 8%, var(--ui-bg-elevated, var(--ui-bg)));
	border-bottom: 1px solid var(--ui-border);
}
.mock-export__cell {
	padding: 0.35rem 0.45rem;
	font-size: 0.68rem;
	color: var(--ui-text);
	border-bottom: 1px solid var(--ui-border);
	white-space: nowrap;
}
.mock-export__cell--num { color: var(--ui-text-dimmed, var(--ui-text-muted)); font-variant-numeric: tabular-nums; }
.mock-export__cell--fill {
	color: var(--ui-text-highlighted);
	background: var(--ui-bg-elevated, var(--ui-bg));
	animation: mock-cell 0.5s ease backwards;
	animation-delay: calc(var(--i, 0) * 0.1s + 0.2s);
}
@keyframes mock-cell { from { opacity: 0; background: color-mix(in oklab, #10b981 22%, var(--ui-bg)); } to { opacity: 1; } }
.mock-export__cell--best { background: color-mix(in oklab, #10b981 10%, transparent); font-weight: 600; }

.mock-export__actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.mock-export__file {
	display: inline-flex;
	align-items: center;
	gap: 0.45rem;
	padding: 0.4rem 0.55rem;
	border-radius: 0.5rem;
	border: 1px solid var(--ui-border);
	background: var(--ui-bg);
	font-size: 0.68rem;
	animation: mock-drop 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
	animation-delay: 1.3s;
}
@keyframes mock-drop { from { opacity: 0; transform: translateY(-10px) scale(0.96); } to { opacity: 1; transform: none; } }
.mock-export__file-icon { font-size: 0.58rem; font-weight: 700; color: #fff; background: #10b981; padding: 0.1rem 0.35rem; border-radius: 0.3rem; }
.mock-export__file-name { color: var(--ui-text-highlighted); font-weight: 500; }

/* ====================== Responsive для моков ====================== */
@media (max-width: 640px) {
	.mock-window__body { padding: 0.65rem; min-height: 14rem; }

	.mock-mail { grid-template-columns: 1fr; min-height: auto; }
	.mock-mail__sidebar { order: 1; }
	.mock-mail__thread { order: 2; min-height: 7rem; }
	.mock-mail__extract { order: 3; }

	.mock-search__form { grid-template-columns: 1fr; }

	.mock-supplier__add { font-size: 0.6rem; padding: 0.2rem 0.4rem; }

	.mock-cta { width: 100%; justify-content: center; }
}

.landing-hiw:not(.is-inview) .mock-window *,
.landing-hiw:not(.is-inview) .mock-window *::before,
.landing-hiw:not(.is-inview) .mock-window *::after {
	animation-play-state: paused !important;
}

@media (prefers-reduced-motion: reduce) {
	.mock-window__body [style*="--i"],
	.mock-search__form .mock-typewriter,
	.mock-caret,
	.mock-window__live,
	.mock-cta,
	.mock-mail__scan,
	.mock-table__best::after,
	.mock-export__cell--fill,
	.mock-export__file {
		animation: none !important;
	}
	.mock-typewriter { width: 100% !important; }
}
</style>
