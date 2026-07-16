<script setup lang="ts">
type Metric = { value: number, prefix?: string, suffix?: string, label: string }
type Compare = { label: string, before: string, after: string, ratio: number }
type Accent = 'indigo' | 'sky' | 'emerald' | 'amber'
type Role = {
	id: string
	title: string
	short: string
	pain: string
	trigger: string
	bullets: string[]
	metrics: Metric[]
	compare: Compare
	accent: Accent
	icon: string
}

/** Tailwind-safe accent class literals (v4 scanner). */
const accentMap: Record<Accent, {
	iconActive: string
	check: string
	metric: string
	bar: string
	topBar: string
	ring: string
}> = {
	indigo: {
		iconActive: 'bg-sky-700 text-white',
		check: 'bg-sky-100 text-sky-700',
		metric: 'text-sky-700',
		bar: 'bg-gradient-to-r from-sky-600 to-sky-400',
		topBar: 'bg-gradient-to-r from-sky-700 via-sky-600 to-sky-400',
		ring: 'border-sky-300 ring-1 ring-sky-200 shadow-lg shadow-sky-600/10',
	},
	sky: {
		iconActive: 'bg-sky-600 text-white',
		check: 'bg-sky-100 text-sky-700',
		metric: 'text-sky-600',
		bar: 'bg-gradient-to-r from-sky-500 to-cyan-400',
		topBar: 'bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-300',
		ring: 'border-sky-300 ring-1 ring-sky-200 shadow-lg shadow-sky-500/10',
	},
	emerald: {
		iconActive: 'bg-emerald-600 text-white',
		check: 'bg-emerald-100 text-emerald-700',
		metric: 'text-emerald-600',
		bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
		topBar: 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-300',
		ring: 'border-emerald-300 ring-1 ring-emerald-200 shadow-lg shadow-emerald-500/10',
	},
	amber: {
		iconActive: 'bg-amber-600 text-white',
		check: 'bg-amber-100 text-amber-700',
		metric: 'text-amber-600',
		bar: 'bg-gradient-to-r from-amber-500 to-orange-400',
		topBar: 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-300',
		ring: 'border-amber-300 ring-1 ring-amber-200 shadow-lg shadow-amber-500/10',
	},
}

const roles: Role[] = [
	{
		id: 'exec',
		title: 'Руководителям и собственникам бизнеса',
		short: 'Прозрачность и контроль бюджета',
		pain: 'Закупки — «чёрный ящик»: непонятно, где зависли деньги и не переплачиваете ли вы поставщикам.',
		trigger: 'Контроль бюджетов и прозрачность без микроменеджмента.',
		bullets: [
			'Единый дашборд: статус каждой закупки, срывы сроков и риски — как на ладони.',
			'Исключение человеческого фактора при выборе поставщика (снижение рисков аффилированности).',
			'Автоматические отчёты XLSX/DOCX для мгновенных управленческих решений.',
		],
		metrics: [
			{ value: 40, prefix: '−', suffix: '%', label: 'времени на совещания и отчёты' },
			{ value: 15, prefix: 'до ', suffix: '%', label: 'экономии бюджета' },
		],
		compare: { label: 'Сбор управленческого отчёта', before: 'несколько часов', after: '5 минут', ratio: 0.02 },
		accent: 'indigo',
		icon: 'i-lucide-briefcase-business',
	},
	{
		id: 'head',
		title: 'Руководителям отделов закупок',
		short: 'Скорость цикла и контроль KPI',
		pain: 'Команда перегружена рутиной, процессы непрозрачны, письма и история теряются.',
		trigger: 'Ускорение цикла закупки и объективный контроль KPI команды.',
		bullets: [
			'Полный контроль цепочки: кто из менеджеров на каком этапе и где узкие места.',
			'Вся коммуникация с поставщиками и история изменений — в одном окне.',
			'Балансировка нагрузки между специалистами на основе реальных данных.',
		],
		metrics: [
			{ value: 2, prefix: '×', suffix: '', label: 'быстрее цикл от ТЗ до договора' },
			{ value: 100, prefix: '', suffix: '%', label: 'прозрачность воронки' },
		],
		compare: { label: 'Цикл закупки от ТЗ до договора', before: '30 дней', after: '15 дней', ratio: 0.5 },
		accent: 'sky',
		icon: 'i-lucide-users-round',
	},
	{
		id: 'spec',
		title: 'Специалистам отдела закупок',
		short: 'Минус рутина, плюс результат',
		pain: 'Бесконечный ручной поиск, сотни писем и сверка десятков КП с ТЗ вручную.',
		trigger: 'Избавление от рутины, снижение стресса, KPI без переработок.',
		bullets: [
			'Автоматический анализ ТЗ и извлечение требований.',
			'Автоподбор поставщиков и рассылка запросов в несколько кликов.',
			'Авто-сравнение полученных КП с исходным техническим заданием.',
		],
		metrics: [
			{ value: 70, prefix: '−', suffix: '%', label: 'рутины на каждую закупку' },
			{ value: 10, prefix: '×', suffix: '', label: 'быстрее рутина' },
		],
		compare: { label: 'Сверка КП с ТЗ', before: 'несколько дней', after: '10 минут', ratio: 0.003 },
		accent: 'emerald',
		icon: 'i-lucide-clipboard-check',
	},
	{
		id: 'tech',
		title: 'Техническим специалистам',
		short: 'Возврат к основной работе',
		pain: 'Технологи, инженеры, энергетики, механики отрываются от производства на ручную сверку КП с ТЗ.',
		trigger: 'Возврат к прямым обязанностям, снятие бюрократической нагрузки.',
		bullets: [
			'Система сама извлекает техпараметры из ТЗ и сопоставляет с КП поставщика.',
			'Подсветка несоответствий — специалист проверяет только спорные моменты.',
			'Риск закупки неподходящего оборудования сведён к минимуму.',
		],
		metrics: [
			{ value: 10, prefix: '×', suffix: '', label: 'быстрее анализ спецификаций' },
			{ value: 90, prefix: '−', suffix: '%', label: 'ручной вычитки документов' },
		],
		compare: { label: 'Анализ технической спецификации', before: '14–30 дней', after: '1–2 часа', ratio: 0.004 },
		accent: 'amber',
		icon: 'i-lucide-wrench',
	},
]

const activeId = ref<Role['id']>(roles[0].id)
const activeRole = computed(() => roles.find((r) => r.id === activeId.value)!)
const activeAccent = computed(() => accentMap[activeRole.value.accent])

const prefersReduced = ref(false)
let io: IntersectionObserver | null = null
const inView = ref(false)

function clampRatio(r: number) {
	return Math.max(10, Math.min(70, r * 100))
}

const barWidth = ref(0)
const metricsRootRef = ref<HTMLElement | null>(null)

function triggerBar() {
	barWidth.value = 0
	if (prefersReduced.value) {
		barWidth.value = clampRatio(activeRole.value.compare.ratio)
		return
	}
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			barWidth.value = clampRatio(activeRole.value.compare.ratio)
		})
	})
}

function animateMetrics() {
	const root = metricsRootRef.value
	if (!root) return
	const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-target]'))
	const reduce = prefersReduced.value
	const dur = 1100
	nodes.forEach((el, idx) => {
		const target = Number.parseFloat(el.dataset.target || '0')
		const prefix = el.dataset.prefix || ''
		const suffix = el.dataset.suffix || ''
		if (reduce) {
			el.textContent = prefix + Math.round(target) + suffix
			return
		}
		el.textContent = `${prefix}0${suffix}`
		const start = performance.now()
		const delay = idx * 120
		const tick = (now: number) => {
			const t = Math.min(1, Math.max(0, (now - start - delay) / dur))
			const eased = 1 - (1 - t) ** 3
			el.textContent = prefix + Math.round(target * eased) + suffix
			if (t < 1) requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
	})
}

function runPanelAnimations() {
	triggerBar()
	animateMetrics()
}

function activate(id: Role['id']) {
	if (id === activeId.value) {
		runPanelAnimations()
		return
	}
	activeId.value = id
}

function onKeydown(e: KeyboardEvent) {
	const idx = roles.findIndex((r) => r.id === activeId.value)
	if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
		e.preventDefault()
		activate(roles[(idx + 1) % roles.length].id)
	}
	else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
		e.preventDefault()
		activate(roles[(idx - 1 + roles.length) % roles.length].id)
	}
	else if (e.key === 'Home') {
		e.preventDefault()
		activate(roles[0].id)
	}
	else if (e.key === 'End') {
		e.preventDefault()
		activate(roles[roles.length - 1].id)
	}
}

const blockRef = ref<HTMLElement | null>(null)

function ensureReveal() {
	if (!blockRef.value) {
		inView.value = true
		return
	}
	if (prefersReduced.value) {
		inView.value = true
		return
	}
	io = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					inView.value = true
					io?.disconnect()
				}
			})
		},
		{ threshold: 0.25 },
	)
	io.observe(blockRef.value)
}

onMounted(() => {
	prefersReduced.value =
		typeof window !== 'undefined'
		&& !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
	ensureReveal()
})

onBeforeUnmount(() => {
	io?.disconnect()
})

type VNode = ReturnType<typeof h>

const Tag = (label: string, cls = '') =>
	h('span', { class: `inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cls}` }, label)

const MiniMock = defineComponent({
	name: 'MiniMock',
	props: { role: { type: String, required: true } },
	setup(props) {
		const Box = (cls: string, children: VNode[]) => h('div', { class: `rounded-lg p-2 ${cls}` }, children)

		const FunnelRow = (label: string, width: string, color: string): VNode =>
			h('div', { class: 'flex items-center gap-2' }, [
				h('span', { class: 'w-16 shrink-0 truncate text-[10px] text-muted' }, label),
				h('div', { class: 'h-2 min-w-0 flex-1 rounded-full bg-elevated' }, [h('div', { class: `h-full rounded-full ${color}`, style: { width } })]),
			])

		const Exec = (): VNode =>
			h('div', { class: 'space-y-3' }, [
				h('div', { class: 'flex items-center justify-between' }, [
					h('span', { class: 'text-[11px] font-semibold text-muted' }, 'Дашборд закупок'),
					Tag('LIVE', 'bg-emerald-50 text-emerald-700'),
				]),
				h('div', { class: 'grid grid-cols-3 gap-2' }, [
					Box('bg-elevated/60', [h('div', { class: 'text-[10px] text-muted' }, 'В работе'), h('div', { class: 'text-sm font-bold text-highlighted' }, '24')]),
					Box('bg-amber-50', [h('div', { class: 'text-[10px] text-amber-500' }, 'Риски'), h('div', { class: 'text-sm font-bold text-amber-700' }, '3')]),
					Box('bg-emerald-50', [h('div', { class: 'text-[10px] text-emerald-500' }, 'Экономия'), h('div', { class: 'text-sm font-bold text-emerald-700' }, '12%')]),
				]),
				h('div', { class: 'space-y-1' }, [
					FunnelRow('В срок', '82%', 'bg-sky-600'),
					FunnelRow('Риск', '38%', 'bg-amber-500'),
					FunnelRow('Ожидают КП', '61%', 'bg-emerald-400'),
				]),
			])

		const Head = (): VNode =>
			h('div', { class: 'space-y-3' }, [
				h('div', { class: 'flex items-center justify-between' }, [
					h('span', { class: 'text-[11px] font-semibold text-muted' }, 'Воронка и команда'),
					Tag('LIVE', 'bg-emerald-50 text-emerald-700'),
				]),
				h('div', { class: 'space-y-1' }, [
					FunnelRow('Поиск', '100%', 'bg-sky-500'),
					FunnelRow('Запросы', '78%', 'bg-indigo-500'),
					FunnelRow('КП', '54%', 'bg-emerald-500'),
					FunnelRow('Договор', '32%', 'bg-slate-500'),
				]),
				h('div', { class: 'flex items-center gap-1.5 text-[10px] text-muted' }, [
					h('span', { class: 'inline-block h-2 w-2 rounded-full bg-emerald-400' }), 'Иванов 4 · Петров 6 · Сидорова 2',
				]),
			])

		const Chip = (label: string, color: string): VNode =>
			h('span', { class: `rounded-md px-2 py-1 text-[10px] font-semibold text-white ${color}` }, label)

		const Spec = (): VNode =>
			h('div', { class: 'space-y-3' }, [
				h('div', { class: 'flex items-center justify-between' }, [
					h('span', { class: 'text-[11px] font-semibold text-muted' }, 'Пайплайн закупки'),
					Tag('AUTO', 'bg-sky-50 text-sky-700'),
				]),
				h('div', { class: 'flex flex-wrap items-center gap-1.5' }, [
					Chip('ТЗ', 'bg-emerald-500'),
					h('span', { class: 'text-muted' }, '→'),
					Chip('Поставщики', 'bg-sky-500'),
					h('span', { class: 'text-muted' }, '→'),
					Chip('КП', 'bg-indigo-500'),
					h('span', { class: 'text-muted' }, '→'),
					Chip('Сравнение', 'bg-slate-700'),
				]),
				Box('border border-default', [
					h('div', { class: 'flex items-center justify-between text-[10px] text-muted' }, [
						h('span', 'Сравнение КП ↔ ТЗ'),
						h('span', { class: 'font-semibold text-emerald-600' }, '95% совпадение'),
					]),
					h('div', { class: 'mt-1.5 h-1.5 rounded-full bg-elevated' }, [
						h('div', { class: 'h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400', style: { width: '95%' } }),
					]),
				]),
			])

		const StatusPill = (st: 'ok' | 'warn' | 'err'): VNode =>
			st === 'ok'
				? h('span', { class: 'rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700' }, '✓ ок')
				: st === 'warn'
					? h('span', { class: 'rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700' }, '⚠ откл.')
					: h('span', { class: 'rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700' }, '✕ нет')

		const Tech = (): VNode =>
			h('div', { class: 'space-y-3' }, [
				h('div', { class: 'flex items-center justify-between' }, [
					h('span', { class: 'text-[11px] font-semibold text-muted' }, 'Сверка ТЗ ↔ КП'),
					Tag('2 расхождения', 'bg-amber-50 text-amber-700'),
				]),
				h('div', { class: 'overflow-hidden rounded-lg border border-default' }, [
					h('div', { class: 'grid grid-cols-[1fr_auto] bg-elevated px-2 py-1 text-[9px] font-semibold uppercase text-muted' }, [
						h('span', 'Параметр'), h('span', 'Статус'),
					]),
					...([
						['Мощность, кВт', 'ok'],
						['Напряжение, В', 'ok'],
						['Класс защиты IP', 'warn'],
						['Материал корпуса', 'ok'],
						['Срок службы, лет', 'err'],
					] as const).map(([p, st]) =>
						h('div', { class: 'grid grid-cols-[1fr_auto] items-center border-t border-default px-2 py-1.5 text-[10px]' }, [
							h('span', { class: 'text-default' }, p),
							StatusPill(st),
						]),
					),
				]),
				h('div', { class: 'text-[10px] text-muted' }, 'Проверяете только подсвеченное — остальное уже сверено.'),
			])

		return () => {
			const map: Record<string, () => VNode> = { exec: Exec, head: Head, spec: Spec, tech: Tech }
			const node = (map[props.role] || Spec)()
			return h('div', { class: 'rounded-2xl border border-default bg-default p-3' }, [node])
		}
	},
})
</script>

<template>
	<div
		ref="blockRef"
		class="audience-value-block relative overflow-hidden"
		:class="{ 'is-inview': inView }"
	>
		<div
			class="pointer-events-none absolute inset-0 -z-10"
			aria-hidden="true"
		>
			<div class="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
			<div class="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
			<div
				class="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.04)_1px,transparent_0)] [background-size:22px_22px]"
			/>
		</div>

		<div class="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8">
			<div
				role="tablist"
				aria-label="Ценность TenderOptima для разных ролей"
				aria-orientation="vertical"
				class="audience-value-tabs flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
				@keydown="onKeydown"
			>
				<button
					v-for="audienceRole in roles"
					:id="`tab-${audienceRole.id}`"
					:key="audienceRole.id"
					type="button"
					role="tab"
					:aria-selected="audienceRole.id === activeId"
					:aria-controls="`panel-${audienceRole.id}`"
					:tabindex="audienceRole.id === activeId ? 0 : -1"
					class="group relative flex min-w-[230px] flex-1 cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-300 lg:min-w-0 lg:flex-none"
					:class="
						audienceRole.id === activeId
							? `${accentMap[audienceRole.accent].ring} bg-default`
							: 'border-default bg-default/60 hover:border-accent/30 hover:bg-default'
					"
					@click="activate(audienceRole.id)"
				>
					<span
						class="flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300"
						:class="audienceRole.id === activeId ? accentMap[audienceRole.accent].iconActive : 'bg-elevated text-muted group-hover:bg-elevated/80'"
					>
						<UIcon :name="audienceRole.icon" class="size-5" />
					</span>
					<span class="min-w-0">
						<span class="block text-sm font-semibold leading-tight text-highlighted">{{ audienceRole.title }}</span>
						<span class="mt-1 block text-xs leading-snug text-muted">{{ audienceRole.short }}</span>
					</span>
					<UIcon
						v-if="audienceRole.id === activeId"
						name="i-lucide-chevron-right"
						class="absolute right-3 top-1/2 hidden size-4 -translate-y-1/2 text-muted lg:block"
						aria-hidden="true"
					/>
				</button>
			</div>

			<div
				:id="`panel-${activeId}`"
				role="tabpanel"
				:aria-labelledby="`tab-${activeId}`"
				tabindex="0"
				class="focus:outline-none"
			>
				<Transition
					name="audience-panel"
					mode="out-in"
					appear
					@after-enter="runPanelAnimations"
				>
					<div
						:key="activeId"
						class="relative overflow-hidden rounded-3xl border border-default bg-default shadow-xl shadow-slate-900/5"
					>
						<div class="relative h-1.5 w-full" :class="activeAccent.topBar" />

						<div class="grid grid-cols-1 gap-0 md:grid-cols-[1.1fr_0.9fr]">
							<div class="p-6 md:p-8">
								<h3 class="text-xl font-bold tracking-tight text-highlighted sm:text-2xl">
									{{ activeRole.title }}
								</h3>

								<p class="mt-2 text-sm leading-relaxed text-muted">
									{{ activeRole.pain }}
								</p>
								<p class="mt-2 text-sm font-medium text-default">
									{{ activeRole.trigger }}
								</p>

								<ul class="mt-5 space-y-3">
									<li
										v-for="(bullet, i) in activeRole.bullets"
										:key="i"
										class="audience-reveal-item flex items-start gap-3 text-sm leading-snug text-default"
										:style="{ '--i': i }"
									>
										<span
											class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
											:class="activeAccent.check"
										>
											<UIcon name="i-lucide-check" class="size-3" />
										</span>
										<span>{{ bullet }}</span>
									</li>
								</ul>
							</div>

							<div class="border-t border-default bg-elevated/40 p-6 md:border-l md:border-t-0 md:p-8">
								<div ref="metricsRootRef" class="grid grid-cols-1 gap-4 md:grid-cols-2">
									<div
										v-for="(metric, i) in activeRole.metrics"
										:key="i"
										class="rounded-2xl border border-default bg-default p-4"
									>
										<div class="flex items-baseline gap-1">
											<span
												class="text-3xl font-extrabold tracking-tight sm:text-4xl"
												:class="activeAccent.metric"
												:data-target="metric.value"
												:data-prefix="metric.prefix || ''"
												:data-suffix="metric.suffix || ''"
											>0</span>
										</div>
										<p class="mt-1 text-xs leading-snug text-muted">
											{{ metric.label }}
										</p>
									</div>
								</div>

								<div class="mt-5 rounded-2xl border border-default bg-default p-4">
									<div class="flex items-center justify-between text-xs font-medium text-muted">
										<span>{{ activeRole.compare.label }}</span>
										<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">экономия времени</span>
									</div>
									<div class="mt-3 space-y-2">
										<div class="flex items-center gap-2">
											<span class="w-12 text-[11px] text-muted">Было</span>
											<div class="h-2.5 flex-1 rounded-full bg-elevated">
												<div class="h-full w-full rounded-full bg-slate-300" />
											</div>
											<span class="w-20 text-right text-xs font-semibold text-muted">{{ activeRole.compare.before }}</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="w-12 text-[11px] text-muted">Стало</span>
											<div class="h-2.5 flex-1 rounded-full bg-elevated">
												<div
													class="h-full rounded-full transition-[width] duration-1000 ease-out"
													:class="activeAccent.bar"
													:style="{ width: `${barWidth}%` }"
												/>
											</div>
											<span class="w-20 text-right text-xs font-semibold text-highlighted">{{ activeRole.compare.after }}</span>
										</div>
									</div>
								</div>

								<div class="mt-5">
									<MiniMock :role="activeRole.id" />
								</div>
							</div>
						</div>
					</div>
				</Transition>
			</div>
		</div>
	</div>
</template>

<style scoped>
.audience-reveal-item {
	opacity: 0;
	transform: translateY(8px);
	transition: opacity 0.5s ease, transform 0.5s ease;
	transition-delay: calc(var(--i, 0) * 90ms);
}

.audience-value-block.is-inview .audience-reveal-item {
	opacity: 1;
	transform: none;
}

.audience-panel-enter-active {
	transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.audience-panel-leave-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.audience-panel-enter-from {
	opacity: 0;
	transform: translateY(12px);
}

.audience-panel-leave-to {
	opacity: 0;
	transform: translateY(-8px);
}

.audience-value-tabs::-webkit-scrollbar {
	display: none;
}

.audience-value-tabs {
	scrollbar-width: none;
}

@media (prefers-reduced-motion: reduce) {
	.audience-panel-enter-active,
	.audience-panel-leave-active,
	.audience-reveal-item {
		transition: none;
	}
}
</style>
