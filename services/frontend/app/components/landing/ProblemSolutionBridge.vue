<script setup lang="ts">
import type { JtbdBridgePanel } from '#shared/constants/landing'
import { JTBD_BRIDGE_PANELS } from '#shared/constants/landing'
import { useScrollReveal } from '~/composables/useScrollReveal'

const panels = JTBD_BRIDGE_PANELS

/** Sky - vibrant; orange - restrained B2B. */
const accentMap = {
	sky: {
		tabActive:
			'border-sky-300 bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800',
		tabIcon: 'text-sky-600 dark:text-sky-400',
		headline: 'text-sky-700 dark:text-sky-300',
		trigger:
			'bg-sky-50 text-sky-900 ring-1 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-800/60',
		metric: 'text-sky-700 dark:text-sky-300',
		metricSize: 'text-2xl sm:text-3xl',
		visualGlow: 'from-sky-400/20 via-cyan-400/10 to-transparent',
		visualBg: 'bg-elevated/30',
	},
	orange: {
		tabActive: 'border-default border-l-[3px] border-l-amber-600 bg-default text-highlighted shadow-sm',
		tabIcon: 'text-amber-700 dark:text-amber-500',
		headline: 'text-highlighted',
		trigger: 'border-default border-l-[3px] border-l-amber-600 bg-elevated/30 text-default',
		metric: 'text-highlighted',
		metricSize: 'text-xl sm:text-2xl',
		visualGlow: '',
		visualBg: 'bg-elevated/20',
		visualLine: 'via-slate-400 dark:via-slate-500',
	},
} as const satisfies Record<JtbdBridgePanel['accent'], Record<string, string>>

const activeId = ref<JtbdBridgePanel['id']>(panels[0].id)
const activePanel = computed(() => panels.find((p) => p.id === activeId.value)!)
const activeAccent = computed(() => accentMap[activePanel.value.accent])

const { target: sectionRef, isVisible } = useScrollReveal({ threshold: 0.1 })

const AUTO_SWITCH_DELAY_MS = 5000
/** Section entered viewport while user was still scrolling (not already parked on the block). */
const SCROLL_RECENT_MS = 800

const userPickedTab = ref(false)
const hasAutoSwitched = ref(false)
const lastScrollAt = ref(0)
let autoSwitchTimer: ReturnType<typeof setTimeout> | null = null

function clearAutoSwitch() {
	if (autoSwitchTimer) {
		clearTimeout(autoSwitchTimer)
		autoSwitchTimer = null
	}
}

function onWindowScroll() {
	lastScrollAt.value = Date.now()
}

function wasRecentlyScrolling() {
	return Date.now() - lastScrollAt.value < SCROLL_RECENT_MS
}

function scheduleAutoSwitch() {
	clearAutoSwitch()

	if (userPickedTab.value || hasAutoSwitched.value || !import.meta.client) {
		return
	}

	const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
	if (prefersReduced) {
		return
	}

	// Секция появилась, пока пользователь уже читает (скролл остановился) - не переключаем.
	if (!wasRecentlyScrolling()) {
		return
	}

	autoSwitchTimer = setTimeout(() => {
		if (userPickedTab.value || hasAutoSwitched.value) {
			return
		}
		hasAutoSwitched.value = true
		const idx = panels.findIndex((p) => p.id === activeId.value)
		activate(panels[(idx + 1) % panels.length].id, { auto: true })
	}, AUTO_SWITCH_DELAY_MS)
}

watch(isVisible, (visible) => {
	if (visible) {
		scheduleAutoSwitch()
	}
	else {
		clearAutoSwitch()
	}
})

onMounted(() => {
	if (!import.meta.client) {
		return
	}
	window.addEventListener('scroll', onWindowScroll, { passive: true })
})

onUnmounted(() => {
	clearAutoSwitch()
	if (import.meta.client) {
		window.removeEventListener('scroll', onWindowScroll)
	}
})

function activate(id: JtbdBridgePanel['id'], options?: { auto?: boolean }) {
	if (!options?.auto) {
		userPickedTab.value = true
		clearAutoSwitch()
	}
	activeId.value = id
}

function onTabKeydown(e: KeyboardEvent) {
	const idx = panels.findIndex((p) => p.id === activeId.value)
	if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
		e.preventDefault()
		activate(panels[(idx + 1) % panels.length].id)
	}
	else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
		e.preventDefault()
		activate(panels[(idx - 1 + panels.length) % panels.length].id)
	}
}
</script>

<template>
	<section
		id="jtbd"
		ref="sectionRef"
		class="reveal bg-default px-4 py-12 sm:px-6 md:py-24 lg:px-8"
		:class="{ 'is-visible': isVisible }"
	>
		<div class="mx-auto max-w-6xl">
			<header class="mb-12 text-center sm:mb-10">
				<p class="landing-section-headline mb-2">
					Сценарии окупаемости
				</p>
				<h2 class="landing-section-title mb-4">
					Два сценария окупаемости
				</h2>
				<p class="landing-section-description mx-auto">
					Выберите задачу - покажем, где платформа экономит время и бюджет на вашей закупке.
				</p>
			</header>

			<div
				role="tablist"
				aria-label="Сценарии окупаемости TenderOptima"
				class="jtbd-tabs mb-8 flex gap-3 overflow-x-auto pb-1 max-md:px-0.5 sm:mb-8 sm:gap-2 sm:justify-center"
				@keydown="onTabKeydown"
			>
				<button
					v-for="panel in panels"
					:id="`jtbd-tab-${panel.id}`"
					:key="panel.id"
					type="button"
					role="tab"
					:aria-selected="panel.id === activeId"
					:aria-controls="`jtbd-panel-${panel.id}`"
					:tabindex="panel.id === activeId ? 0 : -1"
					class="jtbd-tab flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-left text-sm transition-all duration-300 sm:px-5 sm:py-3"
					:class="[
						panel.id === activeId
							? accentMap[panel.accent].tabActive
							: 'border-transparent bg-transparent text-muted hover:border-default hover:bg-elevated/50 hover:text-default',
						panel.id === activeId && panel.accent === 'sky' ? 'font-medium sm:font-semibold' : 'font-medium',
					]"
					@click="activate(panel.id)"
				>
					<UIcon
						:name="panel.icon"
						class="size-4 shrink-0"
						:class="panel.id === activeId ? accentMap[panel.accent].tabIcon : 'text-muted'"
					/>
					<span class="whitespace-nowrap">{{ panel.tabLabel }}</span>
				</button>
			</div>

			<div class="landing-card overflow-hidden shadow-none">
				<Transition name="jtbd-panel" mode="out-in">
					<div
						:id="`jtbd-panel-${activePanel.id}`"
						:key="activePanel.id"
						role="tabpanel"
						:aria-labelledby="`jtbd-tab-${activePanel.id}`"
						class="grid grid-cols-1 gap-0 md:grid-cols-2"
					>
						<!-- Left: JTBD copy -->
						<div class="flex flex-col justify-center p-7 max-md:py-8 md:p-8">
							<h3
								class="text-2xl font-normal leading-tight tracking-tight sm:text-3xl sm:font-extrabold lg:text-[2rem]"
								:class="activeAccent.headline"
							>
								{{ activePanel.headline }}
							</h3>

							<p class="mt-4 text-sm leading-relaxed text-muted sm:text-base">
								{{ activePanel.description }}
							</p>

							<div
								class="mt-5 rounded-xl px-4 py-3.5 text-sm leading-snug sm:px-5 sm:py-4"
								:class="[
									activeAccent.trigger,
									activePanel.accent === 'sky' ? 'font-normal sm:font-semibold' : 'font-normal',
								]"
							>
								<UIcon
									v-if="activePanel.accent === 'sky'"
									name="i-lucide-zap"
									class="mr-1.5 inline-block size-4 -translate-y-px align-middle opacity-80"
								/>
								{{ activePanel.trigger }}
							</div>

							<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
								<div
									v-for="(metric, i) in activePanel.metrics"
									:key="i"
									class="rounded-xl border border-default px-3 py-3 sm:px-4 sm:py-4"
									:class="activePanel.accent === 'sky' ? 'bg-elevated/40' : 'bg-elevated/25'"
								>
									<p
										class="font-normal tracking-tight sm:font-extrabold"
										:class="[activeAccent.metric, activeAccent.metricSize]"
									>
										{{ metric.value }}
									</p>
									<p class="mt-0.5 text-xs leading-snug text-muted sm:text-sm">
										{{ metric.label }}
									</p>
								</div>
							</div>
						</div>

						<!-- Right: abstract visual -->
						<div
							class="relative flex min-h-[260px] items-center justify-center overflow-hidden border-t border-default p-6 md:min-h-[300px] md:border-l md:border-t-0 md:p-8"
							:class="activeAccent.visualBg"
						>
							<div
								v-if="activePanel.accent === 'sky'"
								class="pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80"
								:class="activeAccent.visualGlow"
								aria-hidden="true"
							/>

							<Transition name="jtbd-visual" mode="out-in">
								<!-- Visual 1: email chaos → discount badge (vibrant) -->
								<div
									v-if="activePanel.id === 'price-push'"
									key="price-push"
									class="jtbd-visual relative z-10 w-full max-w-sm"
								>
									<div class="jtbd-chaos jtbd-chaos-vivid absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
										<div
											v-for="n in 8"
											:key="n"
											class="absolute left-0 right-0 flex gap-2 px-3"
											:style="{ top: `${(n - 1) * 14}%`, opacity: 0.35 + (n % 3) * 0.1 }"
										>
											<span class="h-2 w-2 shrink-0 rounded-full bg-slate-400/60" />
											<span
												class="h-2 flex-1 rounded bg-slate-300/50 dark:bg-slate-600/40"
												:style="{ maxWidth: `${40 + (n * 7) % 45}%` }"
											/>
										</div>
									</div>

									<div
										class="relative mx-auto mt-8 rounded-2xl border border-default bg-default/95 p-5 shadow-xl shadow-sky-900/10 backdrop-blur-sm sm:mt-10 sm:p-6"
									>
										<div class="mb-3 flex items-center gap-2">
											<span
												class="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
											>
												<UIcon name="i-lucide-badge-check" class="size-5" />
											</span>
											<div>
												<p class="text-xs font-medium uppercase tracking-wide text-muted">
													Умный дожим
												</p>
												<p class="text-sm font-bold text-highlighted sm:text-base">
													Скидка запрошена  
												</p>
											</div>
										</div>
										<div class="flex items-center gap-2">
											<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
												<div class="jtbd-progress h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" />
											</div>
											<span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">−12%</span>
										</div>
										<p class="mt-3 text-center text-[11px] text-muted">
											Ответы собраны в единую таблицу
										</p>
									</div>
								</div>

								<!-- Visual 2: documents + scan + mismatch table -->
								<div
									v-else
									key="tz-kp"
									class="jtbd-visual relative z-10 w-full max-w-sm"
								>
									<div class="flex items-center justify-center gap-3 sm:gap-4">
										<div class="rounded-lg border border-default bg-default p-3">
											<UIcon name="i-lucide-file-text" class="size-7 text-muted sm:size-8" />
											<p class="mt-1 text-[10px] font-medium text-muted">ТЗ.pdf</p>
										</div>

										<div class="relative flex h-14 w-8 items-center justify-center sm:h-16 sm:w-10">
											<div
												class="jtbd-laser absolute left-0 right-0 h-px rounded-full bg-gradient-to-r from-transparent to-transparent"
												:class="activeAccent.visualLine"
											/>
											<UIcon name="i-lucide-arrow-left-right" class="relative z-10 size-4 text-muted" />
										</div>

										<div class="rounded-lg border border-default bg-default p-3">
											<UIcon name="i-lucide-file-type" class="size-7 text-muted sm:size-8" />
											<p class="mt-1 text-[10px] font-medium text-muted">КП.docx</p>
										</div>
									</div>

									<div class="mt-5 overflow-hidden rounded-lg border border-default bg-default sm:mt-6">
										<div class="grid grid-cols-[1fr_auto] bg-elevated/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
											<span>Параметр</span>
											<span>Статус</span>
										</div>
										<div class="grid grid-cols-[1fr_auto] items-center border-t border-default px-3 py-2 text-[11px]">
											<span class="text-default">Мощность, кВт</span>
											<span class="text-[10px] font-medium text-error">
												Несоответствие
											</span>
										</div>
										<div class="grid grid-cols-[1fr_auto] items-center border-t border-default px-3 py-2 text-[11px]">
											<span class="text-muted">Напряжение, В</span>
											<span class="text-[10px] text-muted">Совпадает</span>
										</div>
										<div class="grid grid-cols-[1fr_auto] items-center border-t border-default px-3 py-2 text-[11px]">
											<span class="text-muted">Класс защиты IP</span>
											<span class="text-[10px] text-muted">Совпадает</span>
										</div>
									</div>

									<p class="jtbd-letter-hint mt-3 text-center text-[11px] text-muted">
										Письмо с замечаниями сгенерировано
									</p>
								</div>
							</Transition>
						</div>
					</div>
				</Transition>
			</div>
		</div>
	</section>
</template>

<style scoped>
.jtbd-tabs {
	scrollbar-width: none;
	-ms-overflow-style: none;
}

.jtbd-tabs::-webkit-scrollbar {
	display: none;
}

.jtbd-chaos-vivid {
	filter: blur(3px);
	transform: scale(1.05);
}

.jtbd-chaos {
	filter: blur(2px);
}

.jtbd-progress {
	width: 0;
	animation: jtbd-progress-fill 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
}

.jtbd-laser {
	animation: jtbd-laser-sweep 2.5s ease-in-out infinite;
}

.jtbd-letter-hint {
	animation: jtbd-fade-in 0.5s ease 0.6s both;
}

@keyframes jtbd-progress-fill {
	to {
		width: 78%;
	}
}

@keyframes jtbd-laser-sweep {
	0%,
	100% {
		opacity: 0.35;
	}
	50% {
		opacity: 0.7;
	}
}

@keyframes jtbd-fade-in {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}

.jtbd-panel-enter-active {
	transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.jtbd-panel-leave-active {
	transition: opacity 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.jtbd-panel-enter-from,
.jtbd-panel-leave-to {
	opacity: 0;
}

.jtbd-visual-enter-active {
	transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.jtbd-visual-leave-active {
	transition: opacity 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.jtbd-visual-enter-from,
.jtbd-visual-leave-to {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.jtbd-progress,
	.jtbd-laser,
	.jtbd-letter-hint,
	.jtbd-panel-enter-active,
	.jtbd-panel-leave-active,
	.jtbd-visual-enter-active,
	.jtbd-visual-leave-active {
		animation: none;
		transition: none;
	}

	.jtbd-progress {
		width: 78%;
	}
}
</style>
