<template>
	<div class="space-y-1 min-w-0">
		<p
			v-if="primaryText"
			class="text-sm text-default whitespace-pre-wrap leading-relaxed"
			:class="{ 'font-medium': mode === 'results' }"
		>
			{{ primaryText }}
		</p>
		<p
			v-if="secondaryText"
			class="text-sm text-muted whitespace-pre-wrap leading-relaxed"
			:class="{ 'text-xs': compact }"
		>
			{{ secondaryText }}
		</p>
	</div>
</template>

<script lang="ts" setup>
import type { RequirementsHierarchy } from '#shared/utils/requirementsStruct'
import {
	getTzRequirementDisplay,
	shouldShowAnalysisLine,
} from '#shared/utils/tzRequirementDisplay'

const props = withDefaults(defineProps<{
	requirement: string
	requirementRef: string | null
	sourceRef?: string | null
	sourceRefValue?: string | null
	compact?: boolean
	/** results: numbered line from our TZ first; letter: quote from source TZ first */
	mode?: 'results' | 'letter'
}>(), {
	compact: false,
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

const secondaryText = computed(() => {
	const { tzOriginal, analysisText } = display.value
	if (props.mode === 'letter') return null
	if (!shouldShowAnalysisLine(tzOriginal, analysisText)) return null
	return tzOriginal
})
</script>
