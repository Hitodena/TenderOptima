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
		class="landing-hiw reveal bg-elevated/25 py-[var(--landing-section-py)] px-4 sm:px-6 lg:px-8"
	>
		<div class="landing-hiw__container mx-auto max-w-7xl">
			<header class="mb-8 text-center sm:mb-10">
				<p class="landing-section-headline mb-2">Модуль 2. ТЗ / КП</p>
				<h2 class="landing-section-title mb-4">Анализ требований и сравнение с коммерческими предложениями</h2>
				<p class="landing-section-description mx-auto">Система извлекает пункты из технического задания, затем сверяет каждое требование с КП поставщика.</p>
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
									<span class="mock-window__dots" aria-hidden="true"><i></i><i></i><i></i></span>
									<span class="mock-window__url">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mock-window__lock"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
										{{ LANDING_MOCKUP_BROWSER_TITLE }}
									</span>
									<span class="mock-window__live">LIVE</span>
								</div>

								<div class="mock-window__body">
									<!-- 01 Загрузка ТЗ -->
									<div v-if="currentStep.id === 'upload-area'" class="mock-upload">
										<div class="mock-upload__dropzone">
											<span class="mock-upload__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg></span>
											<span class="mock-upload__title">Перетащите ТЗ сюда</span>
											<span class="mock-upload__hint">PDF · DOCX · до 25 МБ</span>
										</div>
										<div class="mock-upload__file" style="--i:0">
											<span class="mock-upload__file-icon">PDF</span>
											<span class="mock-upload__file-info">
												<span class="mock-upload__file-name">ТЗ_Оборудование_2026.pdf</span>
												<span class="mock-upload__file-meta">14 стр · 2.3 МБ · загружено</span>
											</span>
											<span class="mock-status mock-status--ok">✓ готово</span>
										</div>
										<button class="mock-cta" type="button" tabindex="-1">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
											Анализировать ТЗ
										</button>
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

									<!-- 03 Проверка требований -->
									<div v-else-if="currentStep.id === 'edit-requirements'" class="mock-req">
										<div class="mock-req__head">
											<span class="mock-pill mock-pill--ok">12 технических параметров</span>
											<span class="mock-req__edit">✎ правка перед КП</span>
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
											<span class="mock-match__gauge-ring"><span class="mock-match__gauge-value">87%</span></span>
											<span class="mock-match__gauge-label">соответствие КП и ТЗ</span>
										</div>
										<div class="mock-match__filters" style="--i:1">
											<span class="mock-chip mock-chip--ok">Совпадения · 9</span>
											<span class="mock-chip mock-chip--warn">Частичные · 2</span>
											<span class="mock-chip mock-chip--err">Несоответствия · 1</span>
										</div>
										<ul class="mock-match__list">
											<li class="mock-match-row" style="--i:2"><span class="mock-match-row__req">Мощность — 5.5 кВт</span><span class="mock-match-row__kp">5.5 кВт</span><span class="mock-status mock-status--ok">полное</span></li>
											<li class="mock-match-row" style="--i:3"><span class="mock-match-row__req">Напряжение — 380 В</span><span class="mock-match-row__kp">380 В</span><span class="mock-status mock-status--ok">полное</span></li>
											<li class="mock-match-row" style="--i:4"><span class="mock-match-row__req">Класс защиты — IP54</span><span class="mock-match-row__kp">IP44</span><span class="mock-status mock-status--warn">частичное</span></li>
											<li class="mock-match-row" style="--i:5"><span class="mock-match-row__req">Срок службы — от 10 лет</span><span class="mock-match-row__kp">8 лет</span><span class="mock-status mock-status--err">несоответствие</span></li>
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
	{ id: 'upload-area', idLabel: 'загрузка ТЗ', title: 'Загрузка ТЗ', text: 'Выберите файл технического задания в зоне загрузки и запустите анализ.', visualText: 'Стартовая форма: подсказка по форматам, upload-зона и кнопка «Анализировать ТЗ».', image: '/landing/upload_area_analyze.png', imageAlt: 'Экран загрузки технического задания' },
	{ id: 'analysis-progress', idLabel: 'извлечение требований', title: 'Извлечение требований', text: 'Система обрабатывает документ и показывает прогресс извлечения пунктов ТЗ.', visualText: 'Индикатор обработки и статус анализа до появления структурированного списка.', image: '/landing/analyze_load.png', imageAlt: 'Экран процесса анализа технического задания' },
	{ id: 'edit-requirements', idLabel: 'проверка требований', title: 'Проверка требований', text: 'Просмотрите и при необходимости отредактируйте извлечённые пункты перед загрузкой КП.', visualText: 'Дерево требований с возможностью правки и подтверждения перед сопоставлением.', image: '/landing/edit_refs_analyze.png', imageAlt: 'Экран редактирования извлечённых требований' },
	{ id: 'kp-compare', idLabel: 'сопоставление с КП', title: 'Сопоставление с КП', text: 'Процент соответствия, группировка совпадений и расхождений, фильтры по статусам.', visualText: 'Метрики соответствия, частичные совпадения и найденные несоответствия по пунктам.', image: '/landing/tz_kp_compare.png', imageAlt: 'Экран сравнения коммерческого предложения с требованиями ТЗ' },
	{ id: 'supplier-letter', idLabel: 'письмо поставщику', title: 'Письмо поставщику', text: 'Готовая форма письма с автоматически собранными несоответствиями и выгрузкой в DOCX.', visualText: 'Формирование письма: навигация по разделам и текстовая область справа.', image: '/landing/letter.png', imageAlt: 'Форма письма поставщику по несоответствиям' },
]

const props = withDefaults(defineProps<{ autoplay?: boolean; intervalMs?: number; initialStep?: number }>(), { autoplay: true, intervalMs: 5000, initialStep: 0 })

const { target: sectionRef, isVisible } = useScrollReveal({
	once: false,
	threshold: 0.12,
})

const activeIndex = ref(props.initialStep)
const currentStep = computed(() => steps[activeIndex.value] ?? steps[0])
let timer: ReturnType<typeof setInterval> | null = null

function toStepIndex(index: number | string): number { return typeof index === 'number' ? index : Number(index) }
function formatStepNumber(index: number | string): string { return String(toStepIndex(index) + 1).padStart(2, '0') }
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
.landing-section-title { font-size: clamp(1.75rem, 3.5vw, 2.5rem); font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; color: var(--ui-text-highlighted); }
.landing-section-description { max-width: 42rem; font-size: 1.0625rem; line-height: 1.65; color: var(--ui-text-muted); }
.landing-card { border: 1px solid var(--ui-border); border-radius: 1rem; background: var(--ui-bg); transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease; }
.landing-hiw__grid { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: clamp(1.25rem, 3vw, 2.5rem); align-items: start; }
.landing-hiw__timeline { display: grid; gap: 0; list-style: none; margin: 0; padding: 0; }
.landing-hiw-step { position: relative; padding-left: 0; }
.landing-hiw-step:not(:last-child)::after { content: ''; position: absolute; left: 19px; top: 40px; bottom: 0; width: 2px; background: color-mix(in oklab, var(--ui-primary) 22%, var(--ui-border)); transform: translateX(-50%); pointer-events: none; }
.landing-hiw-step.is-complete:not(:last-child)::after { background: color-mix(in oklab, var(--ui-primary) 55%, var(--ui-border)); }
.landing-hiw-step__button { position: relative; z-index: 1; width: 100%; display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 0.875rem; padding: 0 0 1.25rem; text-align: left; border: 0; background: transparent; color: inherit; cursor: pointer; }
.landing-hiw-step:last-child .landing-hiw-step__button { padding-bottom: 0; }
.landing-hiw-step__marker { position: relative; display: flex; justify-content: center; width: 40px; flex-shrink: 0; }
.landing-hiw-step__index { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 999px; background: var(--ui-bg); border: 2px solid var(--ui-border); color: var(--ui-text-muted); font-size: 0.8125rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; transition: background 200ms ease, border-color 200ms ease, color 200ms ease, box-shadow 200ms ease; }
.landing-hiw-step__content { display: grid; gap: 0.375rem; padding-top: 0.375rem; }
.landing-hiw-step__title { color: var(--ui-text-highlighted); font-size: clamp(1rem, 1.6vw, 1.25rem); line-height: 1.25; font-weight: 600; letter-spacing: -0.01em; transition: color 200ms ease; }
.landing-hiw-step__text { color: var(--ui-text-muted); font-size: 0.875rem; line-height: 1.6; max-width: 36rem; }
.landing-hiw-step.is-active .landing-hiw-step__index, .landing-hiw-step.is-complete .landing-hiw-step__index { background: var(--ui-primary); border-color: var(--ui-primary); color: var(--ui-primary-foreground, white); box-shadow: 0 4px 14px color-mix(in oklab, var(--ui-primary) 35%, transparent); }
.landing-hiw-step.is-active .landing-hiw-step__title { color: var(--ui-primary); }
.landing-hiw__sticky { position: sticky; top: 5.5rem; }
.landing-hiw__panel { padding: 0.875rem; overflow: hidden; }
.landing-hiw__panel-meta { display: grid; gap: 0.375rem; padding: 0.875rem 0.25rem 0.25rem; }
.landing-hiw__panel-kicker { margin: 0; color: var(--ui-primary); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.6875rem; font-weight: 700; }
.landing-hiw__panel-title { margin: 0; color: var(--ui-text-highlighted); font-size: 1.125rem; line-height: 1.3; font-weight: 600; }
.landing-hiw__panel-description { margin: 0; color: var(--ui-text-muted); line-height: 1.6; font-size: 0.8125rem; }
.landing-hiw-fade-enter-active, .landing-hiw-fade-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.landing-hiw-fade-enter-from, .landing-hiw-fade-leave-to { opacity: 0; transform: translateY(6px); }

@media (max-width: 960px) { .landing-hiw__grid { grid-template-columns: 1fr; } .landing-hiw__sticky { position: static; order: -1; } }
@media (max-width: 640px) {
	.landing-hiw-step__button { grid-template-columns: 36px minmax(0, 1fr); gap: 0.75rem; }
	.landing-hiw-step__marker { width: 36px; }
	.landing-hiw-step__index { width: 36px; height: 36px; font-size: 0.75rem; }
	.landing-hiw-step:not(:last-child)::after { left: 17px; top: 36px; }
	.landing-hiw__panel { padding: 0.625rem; }
}

/* ===== Mock base ===== */
.mock-window { position: relative; overflow: hidden; border-radius: 0.75rem; border: 1px solid var(--ui-border); background: radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--ui-primary) 10%, transparent), transparent 60%), var(--ui-bg-elevated, var(--ui-bg)); box-shadow: 0 18px 40px -24px rgba(15, 23, 42, 0.35); }
.mock-window__chrome { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--ui-border); background: color-mix(in oklab, var(--ui-bg) 60%, var(--ui-bg-elevated)); }
.mock-window__dots { display: inline-flex; gap: 0.3rem; }
.mock-window__dots i { width: 0.6rem; height: 0.6rem; border-radius: 999px; display: block; }
.mock-window__dots i:nth-child(1) { background: #f87171; }
.mock-window__dots i:nth-child(2) { background: #fbbf24; }
.mock-window__dots i:nth-child(3) { background: #34d399; }
.mock-window__url { display: inline-flex; align-items: center; gap: 0.35rem; flex: 1; min-width: 0; margin-inline: auto; padding: 0.2rem 0.6rem; border-radius: 999px; background: var(--ui-bg); border: 1px solid var(--ui-border); color: var(--ui-text-dimmed, var(--ui-text-muted)); font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mock-window__lock { width: 0.75rem; height: 0.75rem; flex: none; opacity: 0.7; }
.mock-window__crumb { color: var(--ui-text-muted); }
.mock-window__live { flex: none; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; color: #10b981; padding: 0.15rem 0.4rem; border-radius: 999px; background: color-mix(in oklab, #10b981 14%, transparent); border: 1px solid color-mix(in oklab, #10b981 35%, transparent); animation: mock-live 1.6s ease-in-out infinite; }
@keyframes mock-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.mock-window__body { padding: 0.875rem; min-height: 16rem; }

.mock-pill { display: inline-flex; align-items: center; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.02em; padding: 0.15rem 0.45rem; border-radius: 999px; }
.mock-pill--ok { color: #047857; background: color-mix(in oklab, #10b981 16%, transparent); }
.mock-pill--work { color: var(--ui-primary); background: color-mix(in oklab, var(--ui-primary) 14%, transparent); }
.mock-status { display: inline-flex; align-items: center; font-size: 0.66rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 0.35rem; white-space: nowrap; }
.mock-status--ok { color: #047857; background: color-mix(in oklab, #10b981 16%, transparent); }
.mock-status--warn { color: #b45309; background: color-mix(in oklab, #f59e0b 18%, transparent); }
.mock-status--err { color: #b91c1c; background: color-mix(in oklab, #ef4444 16%, transparent); }
.mock-cta { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.9rem; border-radius: 0.55rem; border: 0; font-size: 0.78rem; font-weight: 600; color: var(--ui-primary-foreground, #fff); background: var(--ui-primary); box-shadow: 0 8px 20px -8px color-mix(in oklab, var(--ui-primary) 70%, transparent); animation: mock-cta-pulse 2.4s ease-in-out infinite; }
.mock-cta svg { width: 0.9rem; height: 0.9rem; }
.mock-cta--ghost { color: var(--ui-primary); background: color-mix(in oklab, var(--ui-primary) 10%, transparent); box-shadow: none; border: 1px solid color-mix(in oklab, var(--ui-primary) 35%, var(--ui-border)); }
@keyframes mock-cta-pulse { 0%, 100% { transform: none; box-shadow: 0 8px 20px -8px color-mix(in oklab, var(--ui-primary) 70%, transparent); } 50% { transform: translateY(-1px); box-shadow: 0 14px 28px -10px color-mix(in oklab, var(--ui-primary) 80%, transparent); } }
.mock-window__body [style*="--i"] { animation: mock-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards; animation-delay: calc(var(--i, 0) * 0.1s + 0.12s); }
@keyframes mock-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* 01 Загрузка */
.mock-upload { display: grid; gap: 0.7rem; }
.mock-upload__dropzone { display: grid; justify-items: center; gap: 0.4rem; padding: 1.1rem 0.75rem; border-radius: 0.6rem; border: 1.5px dashed color-mix(in oklab, var(--ui-primary) 45%, var(--ui-border)); background: color-mix(in oklab, var(--ui-primary) 6%, var(--ui-bg)); }
.mock-upload__icon { display: inline-flex; align-items: center; justify-content: center; width: 2.2rem; height: 2.2rem; border-radius: 0.6rem; background: color-mix(in oklab, var(--ui-primary) 14%, transparent); color: var(--ui-primary); }
.mock-upload__icon svg { width: 1.1rem; height: 1.1rem; }
.mock-upload__title { font-size: 0.82rem; font-weight: 600; color: var(--ui-text-highlighted); }
.mock-upload__hint { font-size: 0.66rem; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
.mock-upload__file { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.6rem; padding: 0.55rem 0.6rem; border-radius: 0.55rem; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-upload__file-icon { font-size: 0.58rem; font-weight: 700; color: #fff; background: #ef4444; padding: 0.15rem 0.35rem; border-radius: 0.3rem; }
.mock-upload__file-info { display: grid; gap: 0.1rem; min-width: 0; }
.mock-upload__file-name { font-size: 0.76rem; font-weight: 600; color: var(--ui-text-highlighted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mock-upload__file-meta { font-size: 0.62rem; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
.mock-upload .mock-cta { justify-self: start; }

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
.mock-match__gauge-ring { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 4.5rem; height: 4.5rem; border-radius: 999px; background: conic-gradient(color-mix(in oklab, #10b981 80%, var(--ui-primary)) 0% 87%, color-mix(in oklab, var(--ui-text-muted) 18%, var(--ui-border)) 87% 100%); }
.mock-match__gauge-ring::before { content: ''; position: absolute; inset: 0.4rem; border-radius: 999px; background: var(--ui-bg); }
.mock-match__gauge-value { position: relative; font-size: 1.15rem; font-weight: 800; color: var(--ui-text-highlighted); }
.mock-match__gauge-label { font-size: 0.66rem; color: var(--ui-text-muted); }
.mock-match__filters { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.mock-chip { font-size: 0.64rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 999px; border: 1px solid var(--ui-border); background: var(--ui-bg); }
.mock-chip--ok { color: #047857; border-color: color-mix(in oklab, #10b981 40%, var(--ui-border)); background: color-mix(in oklab, #10b981 8%, transparent); }
.mock-chip--warn { color: #b45309; border-color: color-mix(in oklab, #f59e0b 40%, var(--ui-border)); background: color-mix(in oklab, #f59e0b 8%, transparent); }
.mock-chip--err { color: #b91c1c; border-color: color-mix(in oklab, #ef4444 40%, var(--ui-border)); background: color-mix(in oklab, #ef4444 8%, transparent); }
.mock-match__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
.mock-match-row { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: 0.45rem; border: 1px solid var(--ui-border); background: var(--ui-bg); font-size: 0.66rem; }
.mock-match-row__req { color: var(--ui-text-highlighted); font-weight: 500; }
.mock-match-row__kp { color: var(--ui-text-muted); }

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
	.mock-letter { grid-template-columns: 1fr; min-height: auto; }
	.mock-letter__nav { order: 1; }
	.mock-letter__editor { order: 2; }
	.mock-match-row { grid-template-columns: 1fr; gap: 0.2rem; }
	.mock-match-row__kp::before { content: 'КП: '; color: var(--ui-text-dimmed, var(--ui-text-muted)); }
	.mock-upload .mock-cta, .mock-req .mock-cta, .mock-cta { width: 100%; justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
	.mock-window__body [style*="--i"], .mock-window__live, .mock-cta, .mock-extract__scan, .mock-extract__bar, .mock-match__gauge-ring { animation: none !important; }
	.mock-extract__bar { width: 75% !important; }
}
</style>
