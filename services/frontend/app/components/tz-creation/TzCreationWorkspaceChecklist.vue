<template>
	<UAlert
		:color="allReady ? 'success' : 'info'"
		variant="soft"
		:icon="allReady ? 'i-lucide-circle-check' : 'i-lucide-list-checks'"
		:title="allReady ? 'ТЗ готово к финализации' : 'Как работать с конструктором'"
		:description="allReady
			? 'Проверьте структуру и нажмите «Готово → сравнить с КП» в шапке страницы.'
			: undefined"
	>
		<template v-if="!allReady" #description>
			<ol class="mt-1 space-y-1.5 text-sm">
				<li
					v-for="(step, index) in steps"
					:key="step.id"
					class="flex items-start gap-2"
					:class="step.done
						? 'text-muted'
						: index === currentIndex
							? 'text-highlighted font-medium'
							: 'text-muted'"
				>
					<span
						class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] leading-none"
						:class="step.done
							? 'bg-success/15 text-success'
							: index === currentIndex
								? 'bg-primary/15 text-primary'
								: 'bg-elevated text-muted'"
					>
						<UIcon v-if="step.done" name="i-lucide-check" class="h-3 w-3" />
						<span v-else>{{ index + 1 }}</span>
					</span>
					<span>{{ step.label }}</span>
				</li>
			</ol>
		</template>
	</UAlert>
</template>

<script lang="ts" setup>
export type ChecklistStepInput = {
	hasMessages: boolean
	hasRequirements: boolean
	fieldsReady: boolean
	canFinalize: boolean
}

const props = defineProps<{
	state: ChecklistStepInput
}>()

const steps = computed(() => [
	{
		id: 'chat',
		label: 'Ответьте ИИ в диалоге',
		done: props.state.hasMessages,
	},
	{
		id: 'structure',
		label: 'Проверьте и дополните структуру ТЗ',
		done: props.state.hasRequirements,
	},
	{
		id: 'fields',
		label: 'Уточните параметры ТЗ',
		done: props.state.fieldsReady,
	},
	{
		id: 'finalize',
		label: 'Нажмите «Готово → сравнить с КП»',
		done: props.state.canFinalize,
	},
])

const currentIndex = computed(() => {
	const idx = steps.value.findIndex((step) => !step.done)
	return idx === -1 ? steps.value.length - 1 : idx
})

const allReady = computed(() => props.state.canFinalize)
</script>
