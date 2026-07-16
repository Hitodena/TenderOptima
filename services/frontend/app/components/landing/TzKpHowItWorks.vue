<!--
  Блок «Анализ требований и сравнение с коммерческими предложениями» с лендинга TenderOptima.

  Источник в проекте:
  - services/frontend/app/components/landing/HowItWorksBrand.vue (fallbackSteps)
  - services/frontend/app/pages/index.vue → <HowItWorksBrand section-id="tz-analysis" />

  Изменения в этой версии:
  - Правая панель: реальные скриншоты (png) заменены на анимированные
    воссозданные UI-моки тех же процессов. Без реальных названий компаний,
    email и контактов (маски). Анимации перезапускаются при смене шага
    благодаря :key="currentStep.id" на <article>.
  - Структура блока, таймлайн, автопереключение и meta — без изменений.

  Интеграция обратно: заменить <HowItWorksBrand section-id="tz-analysis" />
  на этот компонент или перенести правки в HowItWorksBrand.vue.
-->
<template>
	<section
		id="tz-analysis"
		ref="sectionRef"
		class="landing-hiw reveal bg-elevated/25 px-4 py-12 sm:px-6 md:py-24 lg:px-8"
	>
		<div class="landing-hiw__container mx-auto max-w-7xl">
			<header class="mb-8 text-center sm:mb-10">
				<p class="landing-section-headline mb-2">Модуль 2. ТЗ / КП</p>
				<h2 class="landing-section-title mb-4">Анализ требований и сравнение с коммерческими предложениями</h2>
				<p class="landing-section-description mx-auto">Вы проверяете требования, сверяете с КП поставщика и отправляете письмо с расхождениями — пять шагов без ручных таблиц.</p>
			</header>

			<div class="landing-hiw__grid">
				<ol class="landing-hiw__timeline" role="list">
					<li
						v-for="(step, stepIndex) in steps"
						:key="step.id"
						class="landing-hiw-step"
						:class="{ 'is-active': isStepActive(stepIndex), 'is-complete': isStepComplete(stepIndex) }"
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
							<div class="mock-window">
								<div class="mock-window__chrome">
									<span class="mock-window__url">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mock-window__lock"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
										{{ LANDING_MOCKUP_BROWSER_TITLE }}
									</span>
									<span class="mock-window__status">{{ currentStepStatus }}</span>
								</div>

								<div class="mock-window__body">
									<!-- 01 Создайте анализ и загрузите ТЗ -->
									<div v-if="currentStep.id === 'upload-area'" class="mock-tz-draft">
										<button class="mock-tz-draft__back" type="button" tabindex="-1">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
											К анализам
										</button>

										<div class="mock-tz-draft__header" style="--i:0">
											<h4 class="mock-tz-draft__title">Сравнение КП ООО «Поставщик» с ТЗ №12</h4>
											<span class="mock-tz-draft__badge">Черновик</span>
										</div>

										<div class="mock-tz-draft__meta" style="--i:1">
											<span class="mock-tz-draft__meta-item">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
												12 июл 2026
											</span>
											<span class="mock-tz-draft__meta-item mock-tz-draft__meta-item--file">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
												ТЗ_Оборудование_2026.pdf
											</span>
										</div>

										<div class="mock-tz-draft__alert" style="--i:2">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
											<span>Загрузите техническое задание и запустите анализ. После извлечения требований вы сможете проверить их и загрузить коммерческие предложения.</span>
										</div>

										<div class="mock-tz-draft__card" style="--i:3">
											<label class="mock-tz-draft__label">
												Техническое задание
												<span class="mock-tz-draft__required">*</span>
											</label>

											<div class="mock-tz-draft__upload">
												<div class="mock-tz-draft__file" style="--i:4">
													<span class="mock-tz-draft__file-icon">PDF</span>
													<span class="mock-tz-draft__file-info">
														<span class="mock-tz-draft__file-name">ТЗ_Оборудование_2026.pdf</span>
														<span class="mock-tz-draft__file-meta">14 стр · 2.3 МБ · загружено</span>
													</span>
													<span class="mock-status mock-status--ok">✓ готово</span>
												</div>
												<button class="mock-tz-draft__pick" type="button" tabindex="-1">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
													Выбрать ТЗ
												</button>
												<p class="mock-tz-draft__formats">PDF, DOCX · до 25 МБ</p>
											</div>

											<button class="mock-cta mock-cta--block" type="button" tabindex="-1">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m12 9 1.5 1.5"/></svg>
												Анализировать ТЗ
											</button>
										</div>
									</div>

									<!-- 02 Извлечение требований -->
									<div v-else-if="currentStep.id === 'analysis-progress'" class="mock-extract">
										<div class="mock-extract__head">
											<span class="mock-pill mock-pill--work">Техническая проверка</span>
											<span class="mock-extract__count">проверено <b>12</b>/12 параметров</span>
										</div>
										<div class="mock-extract__preview">
											<span class="mock-extract__scan" aria-hidden="true"></span>
											<span class="mock-docline" style="--i:0"></span>
											<span class="mock-docline mock-docline--w70" style="--i:1"></span>
											<span class="mock-docline mock-docline--w90" style="--i:2"></span>
											<span class="mock-docline mock-docline--w60" style="--i:3"></span>
											<span class="mock-docline mock-docline--w80" style="--i:4"></span>
											<span class="mock-docline mock-docline--w50" style="--i:5"></span>
											<span class="mock-docline mock-docline--w85" style="--i:6"></span>
										</div>
										<div class="mock-extract__progress"><span class="mock-extract__bar"></span></div>
										<ul class="mock-extract__items">
											<li class="mock-extract-item" style="--i:0"><span class="mock-extract-item__tag">Технические</span><span class="mock-extract-item__text">Мощность, кВт</span><span class="mock-status mock-status--ok">✓</span></li>
											<li class="mock-extract-item" style="--i:1"><span class="mock-extract-item__tag">Технические</span><span class="mock-extract-item__text">Класс защиты IP</span><span class="mock-status mock-status--ok">✓</span></li>
											<li class="mock-extract-item" style="--i:2"><span class="mock-extract-item__tag">Технические</span><span class="mock-extract-item__text">Напряжение, В</span><span class="mock-status mock-status--ok">✓</span></li>
											<li class="mock-extract-item" style="--i:3"><span class="mock-extract-item__tag">Технические</span><span class="mock-extract-item__text">Срок службы, лет</span><span class="mock-status mock-status--ok">✓</span></li>
										</ul>
									</div>

									<!-- 03 Вы проверяете список -->
									<div v-else-if="currentStep.id === 'edit-requirements'" class="mock-req">
										<div class="mock-req__head">
											<span class="mock-pill mock-pill--ok">12 технических параметров</span>
											<span class="mock-req__edit">✎ вы проверяете перед КП</span>
										</div>
										<div class="mock-req__groups">
											<div class="mock-req__group" style="--i:0">
												<span class="mock-req__group-title">Технические · 12</span>
												<ul class="mock-req__list">
													<li class="mock-req-item"><span class="mock-req-item__check">✓</span><span class="mock-req-item__text">Мощность — 5.5 кВт</span><span class="mock-req-item__edit">✎</span></li>
													<li class="mock-req-item mock-req-item--edited"><span class="mock-req-item__check">✓</span><span class="mock-req-item__text">Напряжение — 380 В</span><span class="mock-req-item__edit">✎ изменено</span></li>
													<li class="mock-req-item"><span class="mock-req-item__check">✓</span><span class="mock-req-item__text">Класс защиты — IP54</span><span class="mock-req-item__edit">✎</span></li>
													<li class="mock-req-item"><span class="mock-req-item__check">✓</span><span class="mock-req-item__text">Срок службы — от 10 лет</span><span class="mock-req-item__edit">✎</span></li>
												</ul>
											</div>
										</div>
										<button class="mock-cta" type="button" tabindex="-1">
											Загрузить КП поставщика
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
										</button>
									</div>

									<!-- 04 Сопоставление с КП -->
									<div v-else-if="currentStep.id === 'kp-compare'" class="mock-match">
										<div class="mock-match__gauge" style="--i:0">
											<span class="mock-match__gauge-ring" style="--gauge-pct: 65"><span class="mock-match__gauge-value">65%</span></span>
											<span class="mock-match__gauge-label">соответствие КП и ТЗ</span>
										</div>
										<div class="mock-match__filters" style="--i:1">
											<span class="mock-chip mock-chip--ok">Совпадения · 7</span>
											<span class="mock-chip mock-chip--warn">Частичные · 2</span>
											<span class="mock-chip mock-chip--err">Несоответствия · 1</span>
											<span class="mock-chip mock-chip--muted">Не найдено · 2</span>
										</div>
										<ul class="mock-match__list">
											<li class="mock-match-row" style="--i:2"><span class="mock-match-row__req">Мощность — 5.5 кВт</span><span class="mock-match-row__kp">5.5 кВт</span><span class="mock-status mock-status--ok">полное</span></li>
											<li class="mock-match-row" style="--i:3"><span class="mock-match-row__req">Напряжение — 380 В</span><span class="mock-match-row__kp">380 В</span><span class="mock-status mock-status--ok">полное</span></li>
											<li class="mock-match-row" style="--i:4"><span class="mock-match-row__req">Класс защиты — IP54</span><span class="mock-match-row__kp">IP44</span><span class="mock-status mock-status--warn">частичное</span></li>
											<li class="mock-match-row" style="--i:5"><span class="mock-match-row__req">Срок службы — от 10 лет</span><span class="mock-match-row__kp">8 лет</span><span class="mock-status mock-status--err">несоответствие</span></li>
											<li class="mock-match-row" style="--i:6"><span class="mock-match-row__req">Гарантия — от 24 мес</span><span class="mock-match-row__kp mock-match-row__kp--empty">—</span><span class="mock-status mock-status--muted">не найдено</span></li>
										</ul>
									</div>

									<!-- 05 Письмо поставщику -->
									<div v-else-if="currentStep.id === 'supplier-letter'" class="mock-letter">
										<div class="mock-letter__nav">
											<span class="mock-letter__nav-title">Разделы</span>
											<ul class="mock-letter__nav-list">
												<li class="mock-letter__nav-item mock-letter__nav-item--active" style="--i:0">Несоответствия</li>
												<li class="mock-letter__nav-item" style="--i:1">Запрос уточнения</li>
												<li class="mock-letter__nav-item" style="--i:2">Подпись</li>
											</ul>
										</div>
										<div class="mock-letter__editor">
											<div class="mock-letter__head">
												<span class="mock-letter__to">Кому: Поставщик Alpha</span>
												<span class="mock-letter__subj">Тема: Уточнение по КП — несоответствия ТЗ</span>
											</div>
											<div class="mock-letter__body">
												<p class="mock-letter__line" style="--i:0">Добрый день!</p>
												<p class="mock-letter__line" style="--i:1">Благодарим за КП. Просим уточнить по пунктам:</p>
												<div class="mock-letter__autoitem" style="--i:2"><span class="mock-letter__autoitem-tag">авто · КП</span><span>Класс защиты — в ТЗ IP54, в КП IP44</span></div>
												<div class="mock-letter__autoitem" style="--i:3"><span class="mock-letter__autoitem-tag">авто · КП</span><span>Срок службы — в ТЗ от 10 лет, в КП 8 лет</span></div>
												<p class="mock-letter__line mock-letter__line--muted" style="--i:4">…возможность приведения к требованиям ТЗ.</p>
											</div>
											<div class="mock-letter__actions">
												<button class="mock-cta" type="button" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>Скачать DOCX</button>
												<button class="mock-cta mock-cta--ghost" type="button" tabindex="-1">Отправить</button>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div class="landing-hiw__panel-meta">
								<p class="landing-hiw__panel-kicker">Шаг {{ formatStepNumber(activeIndex) }}</p>
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

export interface TzKpFlowStep {
	id: string
	idLabel: string
	title: string
	text: string
	visualText: string
	image: string
	imageAlt: string
	imageCompact?: boolean
}

const steps: TzKpFlowStep[] = [
	{ id: 'upload-area', idLabel: 'создание анализа', title: 'Создайте анализ и загрузите ТЗ', text: 'Задайте название сессии, прикрепите техническое задание и запустите извлечение требований.', visualText: 'Экран анализа в статусе «Черновик»: карточка с файлом ТЗ и кнопка «Анализировать ТЗ».', image: '/landing/upload_area_analyze.png', imageAlt: 'Экран создания анализа и загрузки технического задания' },
	{ id: 'analysis-progress', idLabel: 'извлечение требований', title: 'Извлечение требований', text: 'Система обрабатывает документ и показывает прогресс извлечения пунктов ТЗ.', visualText: 'Индикатор обработки и статус анализа до появления структурированного списка.', image: '/landing/analyze_load.png', imageAlt: 'Экран процесса анализа технического задания' },
	{ id: 'edit-requirements', idLabel: 'проверка требований', title: 'Вы проверяете список', text: 'Просмотрите и отредактируйте извлечённые пункты — только после вашего подтверждения откроется загрузка КП.', visualText: 'Дерево требований с правкой и подтверждением перед сверкой с коммерческим предложением.', image: '/landing/edit_refs_analyze.png', imageAlt: 'Экран проверки извлечённых требований' },
	{ id: 'kp-compare', idLabel: 'сверка с КП', title: 'Сверка с КП поставщика', text: 'Процент соответствия, группировка совпадений, расхождений и пунктов «не найдено», фильтры по статусам.', visualText: 'Метрики соответствия ТЗ и КП: полные, частичные совпадения, несоответствия и не найденные пункты.', image: '/landing/tz_kp_compare.png', imageAlt: 'Экран сверки коммерческого предложения с требованиями ТЗ' },
	{ id: 'supplier-letter', idLabel: 'письмо с расхождениями', title: 'Письмо с расхождениями', text: 'Готовая форма письма с автоматически собранными несоответствиями и выгрузкой в DOCX.', visualText: 'Отправка поставщику: текст с расхождениями формируется из результатов сверки.', image: '/landing/letter.png', imageAlt: 'Форма письма поставщику с расхождениями' },
]

const stepStatusLabels: Record<string, string> = {
	'upload-area': 'Черновик',
	'analysis-progress': 'Обработка',
	'edit-requirements': 'Проверка',
	'kp-compare': 'Сверка',
	'supplier-letter': 'Письмо',
}

const props = withDefaults(defineProps<{ autoplay?: boolean; intervalMs?: number; initialStep?: number }>(), { autoplay: true, intervalMs: 5000, initialStep: 0 })

const { target: sectionRef, isVisible } = useScrollReveal({
	once: false,
	threshold: 0.12,
})

const activeIndex = ref(props.initialStep)
const currentStep = computed(() => steps[activeIndex.value] ?? steps[0])
const currentStepStatus = computed(
	() => stepStatusLabels[currentStep.value.id] ?? 'Анализ',
)
let timer: ReturnType<typeof setInterval> | null = null

function toStepIndex(index: number | string): number { return typeof index === 'number' ? index : Number(index) }
function formatStepNumber(index: number | string): string { return String(toStepIndex(index) + 1) }
function isStepActive(index: number | string): boolean { return toStepIndex(index) === activeIndex.value }
function isStepComplete(index: number | string): boolean { return toStepIndex(index) < activeIndex.value }
function activate(index: number | string) { activeIndex.value = toStepIndex(index); restartAutoplay() }
function startAutoplay() {
	if (!props.autoplay || steps.length < 2 || !isVisible.value) {
		return
	}
	timer = setInterval(() => {
		activeIndex.value = (activeIndex.value + 1) % steps.length
	}, props.intervalMs)
}
function stopAutoplay() { if (timer) clearInterval(timer); timer = null }
function restartAutoplay() { stopAutoplay(); startAutoplay() }

watch(isVisible, (visible) => {
	if (visible) {
		startAutoplay()
	}
	else {
		stopAutoplay()
	}
})

onBeforeUnmount(stopAutoplay)
</script>

<style scoped>
.landing-section-headline { font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-primary); }
.landing-section-title { font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; color: var(--ui-text-highlighted); }
.landing-section-description { max-width: 42rem; font-size: 1.0625rem; line-height: 1.65; color: var(--ui-text-muted); }
.landing-card { border: 1px solid var(--ui-border); border-radius: 1rem; background: var(--ui-bg); transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease; }
.landing-hiw__grid { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: clamp(1.25rem, 3vw, 2.5rem); align-items: start; min-width: 0; }
.landing-hiw__timeline { display: grid; gap: 0; min-width: 0; list-style: none; margin: 0; padding: 0; }
.landing-hiw-step { position: relative; padding-left: 0; }
.landing-hiw-step__button { position: relative; z-index: 1; width: 100%; display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); gap: 0.75rem; padding: 0 0 1.5rem; text-align: left; border: 0; background: transparent; color: inherit; cursor: pointer; }
.landing-hiw-step:last-child .landing-hiw-step__button { padding-bottom: 0; }
.landing-hiw-step__marker { position: relative; display: flex; align-items: flex-start; justify-content: flex-start; width: 2.25rem; flex-shrink: 0; padding-top: 0.1rem; }
.landing-hiw-step__index { display: block; font-size: clamp(1.75rem, 2.8vw, 2.25rem); font-weight: 700; line-height: 1; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; color: color-mix(in oklab, var(--ui-primary) 18%, var(--ui-border)); transition: color 200ms ease, opacity 200ms ease; user-select: none; }
.landing-hiw-step__content { display: grid; gap: 0.375rem; padding-top: 0.2rem; }
.landing-hiw-step__title { color: var(--ui-text-highlighted); font-size: clamp(1rem, 1.6vw, 1.25rem); line-height: 1.25; font-weight: 600; letter-spacing: -0.01em; transition: color 200ms ease; }
.landing-hiw-step__text { color: var(--ui-text-muted); font-size: 0.875rem; line-height: 1.6; max-width: 36rem; }
.landing-hiw-step.is-complete .landing-hiw-step__index { color: color-mix(in oklab, var(--ui-primary) 55%, var(--ui-border)); }
.landing-hiw-step.is-active .landing-hiw-step__index { color: var(--ui-primary); }
.landing-hiw-step.is-active .landing-hiw-step__title { color: var(--ui-primary); }
.landing-hiw__sticky { position: sticky; min-width: 0; top: 5.5rem; }
.landing-hiw__panel { padding: 0.875rem; overflow: hidden; }
.landing-hiw__panel-meta { display: grid; gap: 0.375rem; padding: 0.875rem 0.25rem 0.25rem; }
.landing-hiw__panel-kicker { margin: 0; color: var(--ui-primary); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.6875rem; font-weight: 700; }
.landing-hiw__panel-title { margin: 0; color: var(--ui-text-highlighted); font-size: 1.125rem; line-height: 1.3; font-weight: 600; }
.landing-hiw__panel-description { margin: 0; color: var(--ui-text-muted); line-height: 1.6; font-size: 0.8125rem; }
.landing-hiw-fade-enter-active, .landing-hiw-fade-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.landing-hiw-fade-enter-from, .landing-hiw-fade-leave-to { opacity: 0; transform: translateY(6px); }

@media (max-width: 960px) { .landing-hiw__grid { grid-template-columns: 1fr; } .landing-hiw__sticky { position: static; order: -1; } }
@media (max-width: 640px) {
	.landing-hiw-step__button { grid-template-columns: 1.75rem minmax(0, 1fr); gap: 0.625rem; padding-bottom: 1.25rem; }
	.landing-hiw-step__marker { width: 1.75rem; }
	.landing-hiw-step__index { font-size: 1.5rem; }
	.landing-hiw__panel { padding: 0.625rem; }
}

/* ===== Mock base ===== */
.mock-window { position: relative; overflow: hidden; border-radius: 0.75rem; border: 1px solid var(--ui-border); background: radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--ui-primary) 10%, transparent), transparent 60%), var(--ui-bg-elevated, var(--ui-bg)); box-shadow: 0 18px 40px -24px rgba(15, 23, 42, 0.35); }
.mock-window__chrome { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--ui-border); background: color-mix(in oklab, var(--ui-bg) 60%, var(--ui-bg-elevated)); }
.mock-window__url { display: inline-flex; align-items: center; gap: 0.35rem; flex: 1; min-width: 0; margin-inline: auto; padding: 0.2rem 0.6rem; border-radius: 999px; background: var(--ui-bg); border: 1px solid var(--ui-border); color: var(--ui-text-dimmed, var(--ui-text-muted)); font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mock-window__lock { width: 0.75rem; height: 0.75rem; flex: none; opacity: 0.7; }
.mock-window__crumb { color: var(--ui-text-muted); }
.mock-window__status { flex: none; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.04em; color: var(--ui-text-muted); padding: 0.15rem 0.45rem; border-radius: 999px; background: color-mix(in oklab, var(--ui-text-muted) 10%, var(--ui-bg)); border: 1px solid var(--ui-border); }
.mock-window__body { padding: 0.875rem; min-width: 0; min-height: 16rem; }

.mock-pill { display: inline-flex; align-items: center; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.02em; padding: 0.15rem 0.45rem; border-radius: 999px; }
.mock-pill--ok { color: #047857; background: color-mix(in oklab, #10b981 16%, transparent); }
.mock-pill--work { color: var(--ui-primary); background: color-mix(in oklab, var(--ui-primary) 14%, transparent); }
.mock-status { display: inline-flex; align-items: center; font-size: 0.66rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 0.35rem; white-space: nowrap; }
.mock-status--ok { color: #047857; background: color-mix(in oklab, #10b981 16%, transparent); }
.mock-status--warn { color: #b45309; background: color-mix(in oklab, #f59e0b 18%, transparent); }
.mock-status--err { color: #b91c1c; background: color-mix(in oklab, #ef4444 16%, transparent); }
.mock-status--muted { color: var(--ui-text-muted); background: color-mix(in oklab, var(--ui-text-muted) 14%, transparent); }
.mock-cta { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.9rem; border-radius: 0.55rem; border: 0; font-size: 0.78rem; font-weight: 600; color: var(--ui-primary-foreground, #fff); background: var(--ui-primary); box-shadow: 0 8px 20px -8px color-mix(in oklab, var(--ui-primary) 70%, transparent); animation: mock-cta-pulse 2.4s ease-in-out infinite; }
.mock-cta svg { width: 0.9rem; height: 0.9rem; }
.mock-cta--ghost { color: var(--ui-primary); background: color-mix(in oklab, var(--ui-primary) 10%, transparent); box-shadow: none; border: 1px solid color-mix(in oklab, var(--ui-primary) 35%, var(--ui-border)); }
.mock-cta--block { width: 100%; justify-content: center; margin-top: 0.65rem; }
@keyframes mock-cta-pulse { 0%, 100% { transform: none; box-shadow: 0 8px 20px -8px color-mix(in oklab, var(--ui-primary) 70%, transparent); } 50% { transform: translateY(-1px); box-shadow: 0 14px 28px -10px color-mix(in oklab, var(--ui-primary) 80%, transparent); } }
.mock-window__body [style*="--i"] { animation: mock-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards; animation-delay: calc(var(--i, 0) * 0.1s + 0.12s); }
@keyframes mock-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* 01 Создание анализа */
.mock-tz-draft { display: grid; gap: 0.55rem; }
.mock-tz-draft__back { display: inline-flex; align-items: center; gap: 0.25rem; width: fit-content; padding: 0; border: 0; background: transparent; color: var(--ui-text-muted); font-size: 0.66rem; font-weight: 500; cursor: default; }
.mock-tz-draft__back svg { width: 0.8rem; height: 0.8rem; }
.mock-tz-draft__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
.mock-tz-draft__title { margin: 0; font-size: 0.88rem; font-weight: 700; line-height: 1.3; color: var(--ui-text-highlighted); letter-spacing: -0.01em; }
.mock-tz-draft__badge { flex: none; font-size: 0.58rem; font-weight: 600; color: var(--ui-text-muted); padding: 0.12rem 0.4rem; border-radius: 999px; background: color-mix(in oklab, var(--ui-text-muted) 10%, var(--ui-bg)); border: 1px solid var(--ui-border); }
.mock-tz-draft__meta { display: flex; flex-wrap: wrap; gap: 0.55rem 0.85rem; font-size: 0.62rem; color: var(--ui-text-muted); }
.mock-tz-draft__meta-item { display: inline-flex; align-items: center; gap: 0.25rem; min-width: 0; }
.mock-tz-draft__meta-item svg { width: 0.72rem; height: 0.72rem; flex: none; opacity: 0.75; }
.mock-tz-draft__meta-item--file { color: var(--ui-primary); font-weight: 500; }
.mock-tz-draft__alert { display: grid; grid-template-columns: auto 1fr; gap: 0.45rem; align-items: start; padding: 0.5rem 0.55rem; border-radius: 0.5rem; border: 1px solid color-mix(in oklab, #0369a1 22%, var(--ui-border)); background: color-mix(in oklab, #0369a1 8%, var(--ui-bg)); color: var(--ui-text-muted); font-size: 0.62rem; line-height: 1.45; }
.mock-tz-draft__alert svg { width: 0.8rem; height: 0.8rem; margin-top: 0.05rem; color: #0369a1; flex: none; }
.mock-tz-draft__card { padding: 0.65rem; border-radius: 0.6rem; border: 1px solid var(--ui-border); background: var(--ui-bg); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.mock-tz-draft__label { display: block; margin-bottom: 0.4rem; font-size: 0.66rem; font-weight: 600; color: var(--ui-text-highlighted); }
.mock-tz-draft__required { color: #b91c1c; margin-left: 0.1rem; }
.mock-tz-draft__upload { display: grid; gap: 0.45rem; padding: 0.55rem; border-radius: 0.5rem; border: 1px solid var(--ui-border); background: color-mix(in oklab, var(--ui-bg-elevated, var(--ui-bg)) 80%, var(--ui-bg)); min-height: 5.5rem; align-content: start; }
.mock-tz-draft__file { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.55rem; padding: 0.45rem 0.5rem; border-radius: 0.45rem; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-tz-draft__file-icon { font-size: 0.58rem; font-weight: 700; color: #fff; background: #ef4444; padding: 0.15rem 0.35rem; border-radius: 0.3rem; }
.mock-tz-draft__file-info { display: grid; gap: 0.1rem; min-width: 0; }
.mock-tz-draft__file-name { font-size: 0.74rem; font-weight: 600; color: var(--ui-text-highlighted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mock-tz-draft__file-meta { font-size: 0.62rem; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
.mock-tz-draft__pick { display: inline-flex; align-items: center; gap: 0.3rem; width: fit-content; padding: 0.3rem 0.55rem; border-radius: 0.4rem; border: 1px solid var(--ui-border); background: var(--ui-bg); color: var(--ui-text-highlighted); font-size: 0.64rem; font-weight: 600; cursor: default; }
.mock-tz-draft__pick svg { width: 0.75rem; height: 0.75rem; color: var(--ui-text-muted); }
.mock-tz-draft__formats { margin: 0; font-size: 0.58rem; color: var(--ui-text-dimmed, var(--ui-text-muted)); }

/* 02 Извлечение */
.mock-extract { display: grid; gap: 0.6rem; }
.mock-extract__head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.mock-extract__count { font-size: 0.68rem; color: var(--ui-text-muted); }
.mock-extract__count b { color: var(--ui-text-highlighted); }
.mock-extract__preview { position: relative; padding: 0.6rem; border-radius: 0.5rem; border: 1px solid var(--ui-border); background: var(--ui-bg); overflow: hidden; display: grid; gap: 0.4rem; }
.mock-docline { height: 0.45rem; border-radius: 999px; background: color-mix(in oklab, var(--ui-text-muted) 22%, transparent); width: 100%; }
.mock-docline--w50 { width: 50%; } .mock-docline--w60 { width: 60%; } .mock-docline--w70 { width: 70%; } .mock-docline--w80 { width: 80%; } .mock-docline--w85 { width: 85%; } .mock-docline--w90 { width: 90%; }
.mock-extract__scan { position: absolute; left: 0; right: 0; height: 1.5rem; top: 0; background: linear-gradient(180deg, color-mix(in oklab, var(--ui-primary) 22%, transparent), transparent); border-bottom: 2px solid var(--ui-primary); animation: mock-scan-doc 2.6s ease-in-out infinite; pointer-events: none; }
@keyframes mock-scan-doc { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
.mock-extract__progress { height: 0.4rem; border-radius: 999px; background: var(--ui-border); overflow: hidden; }
.mock-extract__bar { display: block; height: 100%; width: 0; border-radius: 999px; background: linear-gradient(90deg, var(--ui-primary), color-mix(in oklab, var(--ui-primary) 50%, #10b981)); animation: mock-progress 2.4s ease-out forwards; }
@keyframes mock-progress { from { width: 0; } to { width: 75%; } }
.mock-extract__items { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
.mock-extract-item { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: 0.45rem; border: 1px solid var(--ui-border); background: var(--ui-bg); font-size: 0.68rem; }
.mock-extract-item__tag { font-size: 0.58rem; font-weight: 700; color: var(--ui-primary); padding: 0.1rem 0.35rem; border-radius: 0.3rem; background: color-mix(in oklab, var(--ui-primary) 12%, transparent); }
.mock-extract-item__text { color: var(--ui-text-highlighted); }

/* 03 Проверка */
.mock-req { display: grid; gap: 0.6rem; }
.mock-req__head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
.mock-req__edit { font-size: 0.66rem; color: var(--ui-text-muted); }
.mock-req__groups { display: grid; gap: 0.5rem; }
.mock-req__group { display: grid; gap: 0.3rem; }
.mock-req__group-title { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
.mock-req__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
.mock-req-item { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: 0.45rem; border: 1px solid var(--ui-border); background: var(--ui-bg); font-size: 0.68rem; }
.mock-req-item--edited { border-color: color-mix(in oklab, var(--ui-primary) 40%, var(--ui-border)); background: color-mix(in oklab, var(--ui-primary) 6%, var(--ui-bg)); }
.mock-req-item__check { color: #10b981; font-weight: 700; }
.mock-req-item__text { color: var(--ui-text-highlighted); }
.mock-req-item__edit { font-size: 0.58rem; color: var(--ui-text-muted); }
.mock-req-item--edited .mock-req-item__edit { color: var(--ui-primary); font-weight: 600; }
.mock-req .mock-cta { justify-self: start; }

/* 04 Сопоставление */
.mock-match { display: grid; gap: 0.6rem; }
.mock-match__gauge { display: grid; justify-items: center; gap: 0.3rem; padding: 0.6rem; border-radius: 0.6rem; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-match__gauge-ring { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 4.5rem; height: 4.5rem; border-radius: 999px; --gauge-pct: 65; background: conic-gradient(color-mix(in oklab, #10b981 80%, var(--ui-primary)) 0% calc(var(--gauge-pct) * 1%), color-mix(in oklab, var(--ui-text-muted) 18%, var(--ui-border)) calc(var(--gauge-pct) * 1%) 100%); }
.mock-match__gauge-ring::before { content: ''; position: absolute; inset: 0.4rem; border-radius: 999px; background: var(--ui-bg); }
.mock-match__gauge-value { position: relative; font-size: 1.15rem; font-weight: 800; color: var(--ui-text-highlighted); }
.mock-match__gauge-label { font-size: 0.66rem; color: var(--ui-text-muted); }
.mock-match__filters { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.mock-chip { font-size: 0.64rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 999px; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-chip--ok { color: #047857; border-color: color-mix(in oklab, #10b981 40%, var(--ui-border)); background: color-mix(in oklab, #10b981 8%, transparent); }
.mock-chip--warn { color: #b45309; border-color: color-mix(in oklab, #f59e0b 40%, var(--ui-border)); background: color-mix(in oklab, #f59e0b 8%, transparent); }
.mock-chip--err { color: #b91c1c; border-color: color-mix(in oklab, #ef4444 40%, var(--ui-border)); background: color-mix(in oklab, #ef4444 8%, transparent); }
.mock-chip--muted { color: var(--ui-text-muted); border-color: color-mix(in oklab, var(--ui-text-muted) 35%, var(--ui-border)); background: color-mix(in oklab, var(--ui-text-muted) 10%, transparent); }
.mock-match__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
.mock-match-row { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: 0.45rem; border: 1px solid var(--ui-border); background: var(--ui-bg); font-size: 0.66rem; }
.mock-match-row__req { color: var(--ui-text-highlighted); font-weight: 500; }
.mock-match-row__kp { color: var(--ui-text-muted); }
.mock-match-row__kp--empty { color: var(--ui-text-dimmed, var(--ui-text-muted)); }

/* 05 Письмо */
.mock-letter { display: grid; grid-template-columns: minmax(0, 0.7fr) minmax(0, 1fr); gap: 0.5rem; min-height: 14rem; }
.mock-letter__nav { display: grid; gap: 0.4rem; align-content: start; }
.mock-letter__nav-title { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
.mock-letter__nav-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
.mock-letter__nav-item { font-size: 0.68rem; color: var(--ui-text-muted); padding: 0.35rem 0.45rem; border-radius: 0.4rem; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-letter__nav-item--active { color: var(--ui-primary); font-weight: 600; border-color: color-mix(in oklab, var(--ui-primary) 45%, var(--ui-border)); background: color-mix(in oklab, var(--ui-primary) 8%, var(--ui-bg)); }
.mock-letter__editor { display: grid; gap: 0.4rem; align-content: start; }
.mock-letter__head { display: grid; gap: 0.2rem; padding: 0.45rem 0.5rem; border-radius: 0.45rem; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-letter__to { font-size: 0.66rem; color: var(--ui-text-highlighted); font-weight: 600; }
.mock-letter__subj { font-size: 0.62rem; color: var(--ui-text-muted); }
.mock-letter__body { padding: 0.45rem 0.5rem; border-radius: 0.45rem; border: 1px solid var(--ui-border); background: var(--ui-bg); display: grid; gap: 0.35rem; align-content: start; }
.mock-letter__line { margin: 0; font-size: 0.68rem; line-height: 1.45; color: var(--ui-text); }
.mock-letter__line--muted { color: var(--ui-text-muted); }
.mock-letter__autoitem { display: grid; grid-template-columns: auto 1fr; gap: 0.4rem; padding: 0.35rem 0.45rem; border-radius: 0.4rem; border: 1px solid color-mix(in oklab, var(--ui-primary) 25%, var(--ui-border)); background: color-mix(in oklab, var(--ui-primary) 6%, var(--ui-bg)); font-size: 0.64rem; color: var(--ui-text-highlighted); }
.mock-letter__autoitem-tag { font-size: 0.54rem; font-weight: 700; color: var(--ui-primary); padding: 0.1rem 0.3rem; border-radius: 0.3rem; background: color-mix(in oklab, var(--ui-primary) 14%, transparent); align-self: start; }
.mock-letter__actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }

@media (max-width: 640px) {
	.mock-window__body { padding: 0.65rem; min-height: 14rem; }
	.mock-window__chrome { padding: 0.45rem 0.55rem; }
	.mock-window__status { display: none; }
	.mock-extract__head { align-items: flex-start; flex-direction: column; }
	.mock-tz-draft__file, .mock-extract-item, .mock-req-item {
		grid-template-columns: auto minmax(0, 1fr);
	}
	.mock-tz-draft__file .mock-status,
	.mock-extract-item .mock-status,
	.mock-req-item__edit {
		grid-column: 2;
		justify-self: start;
	}
	.mock-extract-item__tag {
		justify-self: start;
	}
	.mock-letter { grid-template-columns: 1fr; min-height: auto; }
	.mock-letter__nav { order: 1; }
	.mock-letter__editor { order: 2; }
	.mock-match-row { grid-template-columns: 1fr; gap: 0.2rem; }
	.mock-match-row__kp::before { content: 'КП: '; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
	.mock-tz-draft .mock-cta--block, .mock-req .mock-cta, .mock-cta { width: 100%; justify-content: center; }
	.mock-tz-draft .mock-cta--block {
		color: var(--ui-primary);
		background: transparent;
		border: 1px solid color-mix(in oklab, var(--ui-primary) 35%, var(--ui-border));
		box-shadow: none;
		animation: none;
	}
}

@media (prefers-reduced-motion: reduce) {
	.mock-window__body [style*="--i"], .mock-cta, .mock-extract__scan, .mock-extract__bar, .mock-match__gauge-ring { animation: none !important; }
	.mock-extract__bar { width: 75% !important; }
}
</style>
