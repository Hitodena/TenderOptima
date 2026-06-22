<template>
	<RequirementTreeEditorLevel
		:nodes="tree"
		:scope-id="scopeId"
		:show-heading-hint="showHeadingHint"
		:readonly="readonly"
		@remove="(index) => emit('remove', index)"
		@add-child="handleAddChild"
		@add-heading="(parentKey) => emit('add-heading', parentKey)"
		@add-sibling="(index) => emit('add-sibling', index)"
		@reorder="(from, to) => emit('reorder', from, to)"
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
		readonly?: boolean
	}>(),
	{ showHeadingHint: false, readonly: false },
)

const emit = defineEmits<{
	remove: [index: number]
	'add-child': [parentKey: string]
	'add-heading': [parentKey: string]
	'add-sibling': [index: number]
	reorder: [fromIndex: number, toIndex: number]
}>()

const tree = computed(() => buildTreeFromRows(props.rows))
const rootKeys = computed(() => new Set(tree.value.map((node) => node.key)))
const sectionExpanded = ref<Record<string, boolean>>({})
const dragFromIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)

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

function expandSection(key: string) {
	sectionExpanded.value = {
		...sectionExpanded.value,
		[sectionKey(key)]: true,
	}
}

function handleAddChild(parentKey: string) {
	expandSection(parentKey)
	emit('add-child', parentKey)
}

provide('requirementTreeEditor', {
	isSectionExpanded,
	dragFromIndex,
	dropTargetIndex,
})
provide('editableRequirementRows', toRef(props, 'rows'))
</script>
