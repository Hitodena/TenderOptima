<template>
	<div
		:id="sectionId"
		ref="sectionRef"
		class="reveal"
		:class="$attrs.class"
	>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
			<div
				v-for="(metric, index) in metrics"
				:key="metric.label"
				class="reveal rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm md:rounded-2xl md:p-5 dark:border-gray-800 dark:bg-gray-900/40"
				:class="[`stagger-${index + 1}`, { 'is-visible': isVisible }]"
			>
				<div class="mb-1.5 flex items-center gap-2 md:mb-2 md:gap-2.5">
					<span class="flex size-8 shrink-0 items-center justify-center self-center rounded-lg bg-orange-50 text-orange-600 md:size-9 dark:bg-orange-950/50 dark:text-orange-400">
						<UIcon :name="metric.icon" class="size-3.5 md:size-4" />
					</span>
					<span class="text-2xl font-bold leading-none tracking-tight text-gray-900 md:text-3xl dark:text-gray-100">
						{{ counters[index]?.display || metric.value }}
					</span>
				</div>
				<p class="text-xs leading-snug text-gray-600 md:text-sm dark:text-gray-400">
					{{ metric.label }}
				</p>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { useCountUp } from '~/composables/useCountUp'
import { useScrollReveal } from '~/composables/useScrollReveal'

defineOptions({ inheritAttrs: false })

withDefaults(
	defineProps<{
		sectionId?: string
	}>(),
	{ sectionId: 'metrics' },
)

const metrics = [
	{
		value: '5+ раз',
		numericValue: 5,
		prefix: '',
		suffix: '+ раз',
		icon: 'i-lucide-users',
		label: 'Скорость взаимодействия с поставщиками',
	},
	{
		value: 'до 95%',
		numericValue: 95,
		prefix: 'до ',
		suffix: '%',
		icon: 'i-lucide-target',
		label: 'Точность проверки по заданным параметрам',
	},
	{
		value: '10+',
		numericValue: 10,
		prefix: '',
		suffix: '+',
		icon: 'i-lucide-zap',
		label: 'Скорость анализа объёмных технических предложений',
	},
]

const { target: sectionRef, isVisible } = useScrollReveal({ threshold: 0.15 })

const counters = metrics.map((metric) =>
	useCountUp(metric.numericValue, {
		prefix: metric.prefix,
		suffix: metric.suffix,
	}),
)

watch(isVisible, (visible) => {
	if (visible) {
		for (const counter of counters) {
			counter.start()
		}
	}
})
</script>
