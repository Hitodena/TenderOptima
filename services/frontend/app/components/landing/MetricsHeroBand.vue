<template>
	<div
		:id="sectionId"
		ref="sectionRef"
		class="reveal"
		:class="$attrs.class"
	>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div
				v-for="(metric, index) in metrics"
				:key="metric.label"
				class="reveal rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm dark:border-gray-800 dark:bg-gray-900/40"
				:class="[`stagger-${index + 1}`, { 'is-visible': isVisible }]"
			>
				<div class="mb-3 flex items-center gap-2.5">
					<span class="flex size-9 shrink-0 items-center justify-center self-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
						<UIcon :name="metric.icon" class="size-4" />
					</span>
					<span class="text-4xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100">
						{{ counters[index]?.display || metric.value }}
					</span>
				</div>
				<p class="text-sm leading-snug text-gray-600 dark:text-gray-400">
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
		value: '10+',
		numericValue: 10,
		prefix: '',
		suffix: '+',
		icon: 'i-lucide-zap',
		label: 'Скорость анализа объёмных технических предложений',
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
		value: '-80%',
		numericValue: 80,
		prefix: '-',
		suffix: '%',
		icon: 'i-lucide-shield-check',
		label: 'Снижение закупочных рисков',
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
