/**
 * Onboarding tour: one linear path over the real screens.
 *
 * 1 — search results of the user's own request
 * 2 — sample request: AI read the supplier's offer
 * 3 — ask the supplier for the missing data (the letter is ready)
 * 4 — the supplier answered: what changed
 * 5 — comparison of all offers
 * 6 — start the 14-day trial
 *
 * Steps 2–5 run on the sample request (`is_demo`): its letters are generated
 * by the service and nothing leaves it. The state lives in localStorage so a
 * reload continues the tour instead of starting over.
 */

export const TOUR_STEPS = 6

type TourStatus = 'idle' | 'running' | 'done'

interface TourState {
	status: TourStatus
	step: number
	sourceRequestId: string | null
	demoRequestId: string | null
}

const STORAGE_KEY = 'to-onboarding-v1'

function load(): TourState {
	const empty: TourState = {
		status: 'idle',
		step: 0,
		sourceRequestId: null,
		demoRequestId: null,
	}
	if (import.meta.server) return empty
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return empty
		const parsed = JSON.parse(raw) as Partial<TourState>
		return { ...empty, ...parsed }
	} catch {
		return empty
	}
}

function save(state: TourState) {
	if (import.meta.server) return
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
	} catch {
		// private mode: the tour still works for this page view
	}
}

export function useOnboardingTour() {
	const state = useState<TourState>('onboarding-tour', load)
	/** the overlay steps aside while the user works in a dialog it opened */
	const paused = useState<boolean>('onboarding-tour-paused', () => false)

	const step = computed(() => (state.value.status === 'running' ? state.value.step : 0))
	const isRunning = computed(() => state.value.status === 'running')
	const isDone = computed(() => state.value.status === 'done')

	function update(patch: Partial<TourState>) {
		state.value = { ...state.value, ...patch }
		save(state.value)
	}

	function start(sourceRequestId: string) {
		if (state.value.status !== 'idle') return
		update({ status: 'running', step: 1, sourceRequestId })
	}

	/** Only the last card: start the trial before the first real mailing. */
	function offerTrial(sourceRequestId: string) {
		paused.value = false
		update({ status: 'running', step: TOUR_STEPS, sourceRequestId })
	}

	function goto(next: number, patch: Partial<TourState> = {}) {
		paused.value = false
		update({ ...patch, step: Math.min(Math.max(next, 1), TOUR_STEPS) })
	}

	function finish() {
		paused.value = false
		update({ status: 'done', step: 0 })
	}

	/** Is the tour on this step and on the request it is about? */
	function isStepFor(n: number, requestId: string) {
		if (step.value !== n) return false
		return n === 1
			? state.value.sourceRequestId === requestId
			: state.value.demoRequestId === requestId
	}

	return {
		state,
		step,
		paused,
		isRunning,
		isDone,
		start,
		offerTrial,
		goto,
		finish,
		isStepFor,
	}
}
