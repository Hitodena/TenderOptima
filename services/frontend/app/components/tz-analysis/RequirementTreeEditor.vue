<template>
	<RequirementTreeEditorLevel
		:nodes="tree"
		:scope-id="scopeId"
		:show-heading-hint="showHeadingHint"
		@remove="(index) => emit('remove', index)"
		@toggle-section="toggleSection"
	/>
</template>

<script lang="ts" setup>
import {
	buildTreeFromRows,
	type EditableRequirementRow,
} from '#shared/utils/requirementsStruct'
import RequirementTreeEditorLevel from '~/components/tz-analysis/RequirementTreeEditorLevel.vue'

const props = withDefaults(
	defineProps<{
		rows: EditableRequirementRow[]
		scopeId: string
		showHeadingHint?: boolean
	}>(),
	{ showHeadingHint: false },
)

const emit = defineEmits<{
	remove: [index: number]
}>()

const tree = computed(() => buildTreeFromRows(props.rows))
const rootKeys = computed(() => new Set(tree.value.map((node) => node.key)))
const sectionExpanded = ref<Record<string, boolean>>({})

function sectionKey(key: string) {
	return `${props.scopeId}:${key}`
}

function isSectionExpanded(key: string) {
	const stored = sectionExpanded.value[sectionKey(key)]
	if (stored !== undefined) return stored
	return rootKeys.value.has(key)
}

function toggleSection(key: string) {
	const k = sectionKey(key)
	sectionExpanded.value = {
		...sectionExpanded.value,
		[k]: !isSectionExpanded(key),
	}
}

provide('requirementTreeEditor', { isSectionExpanded })
provide('editableRequirementRows', toRef(props, 'rows'))
</script>
