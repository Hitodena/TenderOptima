<template>
	<div
		v-if="open"
		class="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pointer-events-none sm:bottom-6"
	>
		<div
			class="pointer-events-auto w-full max-w-md rounded-xl border border-default bg-default shadow-lg p-4 space-y-3"
			role="dialog"
			aria-modal="false"
			:aria-label="`Подсказка: ${currentStep.title}`"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0 space-y-1">
					<p class="text-xs font-medium text-muted">
						Шаг {{ stepIndex + 1 }} из {{ steps.length }}
					</p>
					<p class="font-semibold text-highlighted">
						{{ currentStep.title }}
					</p>
					<p class="text-sm text-muted">
						{{ currentStep.description }}
					</p>
				</div>
				<UButton
					color="neutral"
					variant="ghost"
					size="xs"
					icon="i-lucide-x"
					aria-label="Закрыть подсказки"
					@click="finishTour"
				/>
			</div>
			<div class="flex items-center justify-between gap-2">
				<UButton
					color="neutral"
					variant="ghost"
					size="sm"
					label="Пропустить"
					@click="finishTour"
				/>
				<UButton
					color="primary"
					variant="solid"
					size="sm"
					:label="isLast ? 'Понятно' : 'Далее'"
					:trailing-icon="isLast ? 'i-lucide-check' : 'i-lucide-arrow-right'"
					@click="nextStep"
				/>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
export type WorkspaceTourPanel = 'chat' | 'structure' | 'fields'

const TOUR_STORAGE_KEY = 'tz-creation-workspace-tour-v1'

const props = defineProps<{
	enabled: boolean
}>()

const emit = defineEmits<{
	'highlight': [panel: WorkspaceTourPanel | null]
	'set-panel': [panel: WorkspaceTourPanel]
}>()

const steps: Array<{
	panel: WorkspaceTourPanel
	title: string
	description: string
}> = [
	{
		panel: 'chat',
		title: 'Диалог с ИИ',
		description: 'Опишите закупку или ответьте на вопросы — ИИ дополнит структуру и параметры ТЗ.',
	},
	{
		panel: 'structure',
		title: 'Структура ТЗ',
		description: 'Здесь формируется дерево требований. Можно править вручную и сохранять изменения.',
	},
	{
		panel: 'fields',
		title: 'Параметры ТЗ',
		description: 'Ключевые поля закупки. Уточните значения со статусом «Нужно уточнить».',
	},
]

const open = ref(false)
const stepIndex = ref(0)

const currentStep = computed(() => steps[stepIndex.value] ?? steps[0]!)
const isLast = computed(() => stepIndex.value >= steps.length - 1)

function readTourDone(): boolean {
	if (!import.meta.client) return true
	try {
		return localStorage.getItem(TOUR_STORAGE_KEY) === '1'
	} catch {
		return true
	}
}

function persistTourDone() {
	if (!import.meta.client) return
	try {
		localStorage.setItem(TOUR_STORAGE_KEY, '1')
	} catch {
		// ignore quota / private mode
	}
}

function syncHighlight() {
	if (!open.value) {
		emit('highlight', null)
		return
	}
	const panel = currentStep.value.panel
	emit('highlight', panel)
	emit('set-panel', panel)
}

function finishTour() {
	persistTourDone()
	open.value = false
	stepIndex.value = 0
	emit('highlight', null)
}

function nextStep() {
	if (isLast.value) {
		finishTour()
		return
	}
	stepIndex.value += 1
	syncHighlight()
}

function tryStart() {
	if (!props.enabled || readTourDone()) {
		open.value = false
		emit('highlight', null)
		return
	}
	stepIndex.value = 0
	open.value = true
	syncHighlight()
}

watch(
	() => props.enabled,
	(enabled) => {
		if (enabled) tryStart()
		else {
			open.value = false
			emit('highlight', null)
		}
	},
	{ immediate: true },
)

onBeforeUnmount(() => {
	emit('highlight', null)
})
</script>
