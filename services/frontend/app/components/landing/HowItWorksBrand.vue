<template>
	<section
		:id="sectionId"
		ref="sectionRef"
		class="landing-hiw reveal bg-elevated/25 py-[var(--landing-section-py)] px-4 sm:px-6 lg:px-8"
		:class="{ 'is-inview': isVisible }"
	>
		<div class="landing-hiw__container mx-auto max-w-7xl">
			<header class="mb-8 text-center sm:mb-10">
				<p class="landing-section-headline mb-2">
					{{ eyebrow }}
				</p>
				<h2 class="landing-section-title mb-4">
					{{ title }}
				</h2>
				<p class="landing-section-description mx-auto">
					{{ lead }}
				</p>
			</header>

			<div class="landing-hiw__grid">
				<ol class="landing-hiw__timeline" role="list">
					<li
						v-for="(step, stepIndex) in normalizedSteps"
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
							<div
								class="landing-hiw__panel-screen"
								:class="{ 'landing-hiw__panel-screen--compact': currentStep.imageCompact }"
							>
								<img
									:src="currentStep.image"
									:alt="currentStep.imageAlt"
									class="landing-hiw__panel-image"
									:class="{ 'landing-hiw__panel-image--compact': currentStep.imageCompact }"
									loading="lazy"
									decoding="async"
								>
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
import { useScrollReveal } from '~/composables/useScrollReveal'

export interface BrandHowItWorksStep {
	id: string
	title: string
	text: string
	visualText: string
	image: string
	imageAlt: string
	imageCompact?: boolean
}

const fallbackSteps: BrandHowItWorksStep[] = [
	{
		id: 'upload-area',
		title: 'Загрузка ТЗ',
		text: 'Выберите файл технического задания в зоне загрузки и запустите анализ.',
		visualText: 'Стартовая форма: подсказка по форматам, upload-зона и кнопка «Анализировать ТЗ».',
		image: '/landing/upload_area_analyze.png',
		imageAlt: 'Экран загрузки технического задания',
	},
	{
		id: 'analysis-progress',
		title: 'Извлечение требований',
		text: 'Система обрабатывает документ и показывает прогресс извлечения пунктов ТЗ.',
		visualText: 'Индикатор обработки и статус анализа до появления структурированного списка.',
		image: '/landing/analyze_load.png',
		imageAlt: 'Экран процесса анализа технического задания',
	},
	{
		id: 'edit-requirements',
		title: 'Проверка требований',
		text: 'Просмотрите и при необходимости отредактируйте извлечённые пункты перед загрузкой КП.',
		visualText: 'Дерево требований с возможностью правки и подтверждения перед сопоставлением.',
		image: '/landing/edit_refs_analyze.png',
		imageAlt: 'Экран редактирования извлечённых требований',
	},
	{
		id: 'kp-compare',
		title: 'Сопоставление с КП',
		text: 'Процент соответствия, группировка совпадений и расхождений, фильтры по статусам.',
		visualText: 'Метрики соответствия, частичные совпадения и найденные несоответствия по пунктам.',
		image: '/landing/tz_kp_compare.png',
		imageAlt: 'Экран сравнения коммерческого предложения с требованиями ТЗ',
	},
	{
		id: 'supplier-letter',
		title: 'Письмо поставщику',
		text: 'Готовая форма письма с автоматически собранными несоответствиями и выгрузкой в DOCX.',
		visualText: 'Формирование письма: навигация по разделам и текстовая область справа.',
		image: '/landing/letter.png',
		imageAlt: 'Форма письма поставщику по несоответствиям',
	},
]

const props = withDefaults(
	defineProps<{
		sectionId?: string
		eyebrow?: string
		title?: string
		lead?: string
		steps?: BrandHowItWorksStep[]
		autoplay?: boolean
		intervalMs?: number
	}>(),
	{
		sectionId: 'tz-analysis',
		eyebrow: 'ТЗ / КП',
		title: 'Анализ требований и сравнение с коммерческими предложениями',
		lead: 'Система извлекает пункты из технического задания, затем сверяет каждое требование с КП поставщика.',
		steps: undefined,
		autoplay: true,
		intervalMs: 4200,
	},
)

const { target: sectionRef, isVisible } = useScrollReveal({
	once: false,
	threshold: 0.12,
})

const normalizedSteps = computed(() =>
	props.steps?.length ? props.steps : fallbackSteps,
)
const activeIndex = ref(0)
const currentStep = computed(
	() => normalizedSteps.value[activeIndex.value] || normalizedSteps.value[0],
)

let timer: ReturnType<typeof setInterval> | null = null

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
	restartAutoplay()
}

function startAutoplay() {
	if (
		!props.autoplay
		|| normalizedSteps.value.length < 2
		|| !isVisible.value
	) {
		return
	}
	timer = setInterval(() => {
		activeIndex.value = (activeIndex.value + 1) % normalizedSteps.value.length
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

watch(() => props.steps, () => {
	if (activeIndex.value >= normalizedSteps.value.length) activeIndex.value = 0
	restartAutoplay()
})

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

.landing-hiw__panel-screen {
	overflow: hidden;
	border-radius: 0.75rem;
	background: var(--ui-bg-elevated);
	border: 1px solid var(--ui-border);
	line-height: 0;
}

.landing-hiw__panel-image {
	display: block;
	width: 100%;
	height: auto;
}

.landing-hiw__panel-screen--compact {
	height: min(20rem, 38vh);
	overflow: hidden;
}

.landing-hiw__panel-image--compact {
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: top center;
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

@media (prefers-reduced-motion: reduce) {
	.landing-hiw-step__index,
	.landing-hiw-fade-enter-active,
	.landing-hiw-fade-leave-active {
		transition: none;
	}
}
</style>
