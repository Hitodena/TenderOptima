<template>
	<ClientOnly>
		<template v-if="tour.isRunning.value">
			<!-- on its page: dim everything but one element, one button forward -->
			<div v-if="onTourPage && !tour.paused.value" class="onboarding-tour" role="dialog" aria-modal="true" :aria-label="`Обучение, шаг ${tour.step.value} из ${TOUR_STEPS}`">
				<div class="fixed inset-x-0 top-0 z-[92] flex h-10 items-center gap-3 bg-slate-900 px-4 text-sm text-white">
					<span class="font-semibold">Обучение</span>
					<span class="tabular-nums whitespace-nowrap">{{ tour.step.value }} из {{ TOUR_STEPS }}</span>
					<span class="h-1.5 w-24 overflow-hidden rounded-full bg-slate-700 sm:w-40" aria-hidden="true">
						<span class="block h-full rounded-full bg-sky-400 transition-all" :style="{ width: `${progress}%` }" />
					</span>
					<button type="button" class="ml-auto text-slate-300 underline-offset-2 hover:text-white hover:underline" @click="exitOpen = true">
						<span class="sm:hidden">Выйти</span><span class="hidden sm:inline">Выйти из обучения</span>
					</button>
				</div>

				<!-- spotlight: the hole lets the target show through, the blockers keep the path linear -->
				<template v-if="rect">
					<div class="pointer-events-none fixed z-[91] rounded-xl ring-4 ring-sky-400 transition-all duration-200" :style="holeStyle" />
					<div v-for="(b, i) in blockers" :key="i" class="fixed z-[90] bg-slate-900/55" :style="b" />
				</template>
				<div v-else class="fixed inset-0 z-[90] bg-slate-900/55" />

				<div
					ref="tipEl"
					class="fixed z-[93] flex flex-col gap-2.5 bg-default p-4 shadow-2xl sm:p-5"
					:class="isMobile ? 'inset-x-0 bottom-0 rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]' : 'w-[360px] rounded-2xl'"
					:style="isMobile ? undefined : tipStyle"
				>
					<p class="text-xs font-semibold text-primary">Шаг {{ tour.step.value }} из {{ TOUR_STEPS }}</p>
					<template v-if="current && (rect || !current.target)">
						<p class="text-lg font-bold leading-snug text-highlighted">{{ current.title }}</p>
						<p class="text-sm leading-relaxed text-muted">{{ isMobile && current.mobileText ? current.mobileText : current.text }}</p>
						<UButton
							v-if="current.action"
							size="lg"
							block
							:loading="busy"
							:label="current.action"
							@click="onAction"
						/>
					</template>
					<template v-else-if="current">
						<p class="flex items-center gap-2 text-base font-semibold text-highlighted">
							<UIcon name="i-lucide-loader" class="size-4 animate-spin text-primary" />
							{{ current.waiting }}
						</p>
					</template>
					<p v-if="error" class="text-sm text-error">{{ error }}</p>
				</div>
			</div>

			<!-- away from its page: a small way back instead of blocking the app -->
			<div v-else-if="!onTourPage" class="fixed bottom-20 right-4 z-[85] flex items-center gap-2 rounded-full bg-slate-900 py-2 pl-4 pr-2 text-sm text-white shadow-lg lg:bottom-6">
				<NuxtLink :to="tourPath" class="font-medium hover:underline">Продолжить обучение · {{ tour.step.value }}/{{ TOUR_STEPS }}</NuxtLink>
				<button type="button" class="grid size-7 place-items-center rounded-full hover:bg-slate-700" aria-label="Выйти из обучения" @click="exitOpen = true">
					<UIcon name="i-lucide-x" class="size-4" />
				</button>
			</div>

			<UModal v-model:open="exitOpen" title="Выйти из обучения?" description="Его можно будет пройти позже: запрос-пример останется." :ui="{ content: 'max-w-md z-[96]', overlay: 'z-[95]' }">
				<template #footer>
					<div class="flex w-full justify-end gap-2">
						<UButton color="neutral" variant="ghost" label="Продолжить обучение" @click="exitOpen = false" />
						<UButton color="neutral" variant="outline" label="Выйти" @click="exitTour" />
					</div>
				</template>
			</UModal>
		</template>
	</ClientOnly>
</template>

<script lang="ts" setup>
import type { SubscriptionResponse } from '#shared/types'
import { TOUR_STEPS, useOnboardingTour } from '~/composables/useOnboardingTour'
import { TRIAL_DAYS, canStartTrial } from '#shared/utils/subscriptionAccess'

interface TourStep {
	/** data-tour value of the element to light up; none — a centred card */
	target?: string
	mobileTarget?: string
	title: string
	text: string
	mobileText?: string
	/** shown while the target is not on the page yet */
	waiting: string
	action?: string
}

const tour = useOnboardingTour()
const route = useRoute()
const router = useRouter()
const { post } = useApi()
const { user, invalidate, ensureLoaded } = useCurrentUser()

const subscription = computed<SubscriptionResponse | null>(
	() => (user.value?.subscription as SubscriptionResponse | null | undefined) ?? null,
)

const STEPS: Record<number, TourStep> = {
	1: {
		target: 'suppliers',
		title: 'Это компании по вашему запросу',
		text: 'Мы нашли их сами. Дальше покажем на примере, что будет, когда поставщики ответят на запрос.',
		waiting: 'Загружаем найденные компании…',
		action: 'Показать пример ответов',
	},
	2: {
		target: 'compliance',
		mobileTarget: 'latest-letter',
		title: 'Сервис сам прочитал ответ',
		text: 'Цену, срок и условия он достал из письма и сверил с вашим запросом. Открывать файлы не нужно.',
		waiting: 'Сервис читает письмо поставщика — несколько секунд…',
		action: 'Дальше',
	},
	3: {
		target: 'request-missing',
		title: 'Не хватает данных? Письмо уже готово',
		text: 'Сервис заметил, чего нет в предложении, и составил письмо поставщику. Откройте его и нажмите «Отправить» — в примере ответ придёт через 20 секунд.',
		waiting: 'Сервис проверяет, чего не хватает в предложении…',
		action: 'Открыть письмо',
	},
	4: {
		target: 'latest-letter',
		title: 'Поставщик ответил',
		text: 'Сервис прочитал ответ и дополнил сравнение: недостающие сведения теперь на месте. Если поставщик что-то поменяет, это будет отмечено как «было …». Перечитывать переписку не нужно.',
		waiting: 'Ждём ответа поставщика — обычно около 20 секунд…',
		action: 'Дальше',
	},
	5: {
		target: 'comparison',
		title: 'Все ответы в одной таблице',
		text: 'Строки — ваши требования, столбцы — поставщики. Нажмите на значение — откроется письмо, откуда оно взято.',
		mobileText: 'Выберите параметр — поставщики встанут от лучшего к худшему. Нажмите на предложение — откроется письмо, откуда оно взято.',
		waiting: 'Собираем таблицу сравнения…',
		action: 'Дальше',
	},
	6: {
		title: 'Отправьте запрос настоящим поставщикам',
		text: `${TRIAL_DAYS} дней бесплатно — рассылка найденным компаниям, разбор ответов, сравнение. Письма поставщикам уходят только от подтверждённых компаний: так мы защищаем их от спама, и ваши запросы читают, а не отправляют в корзину. Для связи используем номер телефона из регистрации.`,
		waiting: '',
		action: `Начать ${TRIAL_DAYS} дней бесплатно`,
	},
}

const isMobile = ref(false)
const rect = ref<DOMRect | null>(null)
const tipEl = ref<HTMLElement | null>(null)
const busy = ref(false)
const error = ref('')
const exitOpen = ref(false)

const current = computed<TourStep | null>(() => STEPS[tour.step.value] ?? null)
const progress = computed(() => Math.round((tour.step.value / TOUR_STEPS) * 100))

const tourPath = computed(() => {
	const s = tour.state.value
	if (tour.step.value === 1) return `/requests/${s.sourceRequestId}`
	if (tour.step.value === 6) return route.fullPath
	return `/requests/${s.demoRequestId}/responses`
})
const onTourPage = computed(() => tour.step.value === 6 || route.path === tourPath.value)

const targetKey = computed(() => {
	const c = current.value
	if (!c?.target) return null
	return isMobile.value && c.mobileTarget ? c.mobileTarget : c.target
})

const PAD = 8
const holeStyle = computed(() => {
	const r = rect.value
	if (!r) return {}
	return {
		top: `${r.top - PAD}px`,
		left: `${r.left - PAD}px`,
		width: `${r.width + PAD * 2}px`,
		height: `${r.height + PAD * 2}px`,
	}
})

/** four dimmed panes around the hole: clicks outside the target go nowhere */
const blockers = computed(() => {
	const r = rect.value
	if (!r) return []
	const top = Math.max(r.top - PAD, 0)
	const bottom = r.bottom + PAD
	const left = Math.max(r.left - PAD, 0)
	const right = r.right + PAD
	return [
		{ top: '0', left: '0', right: '0', height: `${top}px` },
		{ top: `${bottom}px`, left: '0', right: '0', bottom: '0' },
		{ top: `${top}px`, left: '0', width: `${left}px`, height: `${bottom - top}px` },
		{ top: `${top}px`, left: `${right}px`, right: '0', height: `${bottom - top}px` },
	]
})

const TIP_W = 360
const tipStyle = computed(() => {
	const r = rect.value
	if (!r || typeof window === 'undefined') {
		return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
	}
	const vw = window.innerWidth
	const vh = window.innerHeight
	const gap = 20
	const top = Math.min(Math.max(r.top, 56), vh - 280)
	if (r.right + gap + TIP_W < vw) return { top: `${top}px`, left: `${r.right + gap}px` }
	if (r.left - gap - TIP_W > 0) return { top: `${top}px`, left: `${r.left - gap - TIP_W}px` }
	const below = r.bottom + gap
	if (below + 240 < vh) return { top: `${below}px`, left: `${Math.min(Math.max(r.left, 16), vw - TIP_W - 16)}px` }
	return { top: `${Math.max(r.top - 260, 56)}px`, left: `${Math.min(Math.max(r.left, 16), vw - TIP_W - 16)}px` }
})

function findTarget(): HTMLElement | null {
	if (!targetKey.value) return null
	const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${targetKey.value}"]`)
	for (const el of nodes) {
		if (el.dataset.ready === 'false') continue
		const box = el.getBoundingClientRect()
		if (box.width > 0 && box.height > 0) return el
	}
	return null
}

let scrolledFor = ''
function measure() {
	if (typeof window === 'undefined') return
	isMobile.value = window.innerWidth < 768
	if (!tour.isRunning.value || !onTourPage.value || tour.paused.value) {
		rect.value = null
		return
	}
	const el = findTarget()
	if (!el) {
		rect.value = null
		return
	}
	const key = `${tour.step.value}:${targetKey.value}`
	if (scrolledFor !== key) {
		scrolledFor = key
		el.scrollIntoView({ block: 'center', behavior: 'smooth' })
	}
	// keep the hole inside the screen, a tall table lights up its visible part
	const box = el.getBoundingClientRect()
	const top = Math.max(box.top, 48)
	const bottom = Math.min(box.bottom, window.innerHeight - (isMobile.value ? 280 : 16))
	rect.value = new DOMRect(box.left, top, box.width, Math.max(bottom - top, 40))
}

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
	measure()
	timer = setInterval(measure, 250)
	window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
	if (timer) clearInterval(timer)
	window.removeEventListener('resize', measure)
})

watch(() => tour.step.value, () => {
	error.value = ''
	scrolledFor = ''
})

async function onAction() {
	error.value = ''
	const n = tour.step.value
	if (n === 1) return createDemo()
	if (n === 3) {
		// the dialog is the user's own work: the overlay waits until it is sent
		tour.paused.value = true
		findTarget()?.click()
		return
	}
	if (n === 6) return startTrial()
	tour.goto(n + 1)
}

async function createDemo() {
	const source = tour.state.value.sourceRequestId
	if (!source) return
	busy.value = true
	try {
		const demo = await post<{ id: string }>(`/requests/${source}/demo`)
		tour.goto(2, { demoRequestId: demo.id })
		await router.push(`/requests/${demo.id}/responses`)
	} catch {
		error.value = 'Не получилось создать пример. Попробуйте ещё раз.'
	} finally {
		busy.value = false
	}
}

async function startTrial() {
	busy.value = true
	try {
		if (canStartTrial(subscription.value)) {
			await post('/subscriptions/me/trial')
			invalidate()
			await ensureLoaded()
		}
		const source = tour.state.value.sourceRequestId
		tour.finish()
		if (source) await router.push(`/requests/${source}`)
	} catch {
		error.value = 'Не получилось начать пробный период. Попробуйте ещё раз.'
	} finally {
		busy.value = false
	}
}

function exitTour() {
	exitOpen.value = false
	tour.finish()
}
</script>
