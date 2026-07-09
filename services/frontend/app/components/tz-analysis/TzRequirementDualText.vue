<template>
	<div class="min-w-0">
		<div class="flex items-start gap-2 min-w-0">
			<p
				v-if="primaryText"
				class="flex-1 min-w-0 text-sm text-default whitespace-pre-wrap leading-relaxed"
				:class="{ 'font-medium': mode === 'results' }"
			>
				{{ primaryText }}
			</p>
			<TzOriginalTzHint
				v-if="originalTzHintText"
				:text="originalTzHintText"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { RequirementsHierarchy } from '#shared/utils/requirementsStruct'
import {
	getTzRequirementDisplay,
	shouldShowAnalysisLine,
} from '#shared/utils/tzRequirementDisplay'
import TzOriginalTzHint from '~/components/tz-analysis/TzOriginalTzHint.vue'

const props = withDefaults(defineProps<{
	requirement: string
	requirementRef: string | null
	sourceRef?: string | null
	sourceRefValue?: string | null
	/** results: numbered line from our TZ first; letter: quote from source TZ first */
	mode?: 'results' | 'letter'
}>(), {
	mode: 'results',
	sourceRef: null,
	sourceRefValue: null,
})

const requirementsTz = inject<Ref<RequirementsHierarchy | null | undefined>>(
	'tzRequirementsHierarchy',
	ref(null),
)

const display = computed(() =>
	getTzRequirementDisplay(
		{
			requirement: props.requirement,
			requirement_ref: props.requirementRef,
			ref: props.sourceRef,
			ref_value: props.sourceRefValue,
		},
		requirementsTz.value,
	),
)

const primaryText = computed(() => {
	const { tzOriginal, analysisText } = display.value
	if (props.mode === 'letter') {
		return tzOriginal ?? analysisText
	}
	return analysisText
})

const originalTzHintText = computed(() => {
	const { tzOriginal, analysisText } = display.value
	if (props.mode === 'letter') return null
	if (!shouldShowAnalysisLine(tzOriginal, analysisText) || !tzOriginal) return null
	return tzOriginal
})
</script>
