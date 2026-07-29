<template>
	<RequirementTreeEditorLevel
		:nodes="tree"
		:scope-id="scopeId"
		:show-heading-hint="showHeadingHint"
		:readonly="readonly"
		@remove="handleRemove"
		@add-child="handleAddChild"
		@add-heading="handleAddHeading"
		@add-sibling="handleAddSibling"
		@reorder="(from, to) => emit('reorder', from, to)"
		@toggle-section="toggleSection"
		@request-hint="(key) => emit('request-hint', key)"
	/>
</template>

<script lang="ts" setup>
import {
	buildTreeFromRows,
	type EditableRequirementRow,
} from '#shared/utils/requirementsStruct'
import type { TZCreationRequirementHint } from '#shared/types'
import RequirementTreeEditorLevel from '~/components/tz-analysis/RequirementTreeEditorLevel.vue'

const props = withDefaults(
	defineProps<{
		rows: EditableRequirementRow[]
		scopeId: string
		showHeadingHint?: boolean
		readonly?: boolean
		showHints?: boolean
		hints?: Record<string, TZCreationRequirementHint>
		hintLoadingKey?: string | null
		highlightKey?: string | null
		focusKey?: string | null
	}>(),
	{
		showHeadingHint: false,
		readonly: false,
		showHints: false,
		hints: () => ({}),
		hintLoadingKey: null,
		highlightKey: null,
		focusKey: null,
	},
)

const emit = defineEmits<{
	remove: [index: number]
	'add-child': [parentKey: string]
	'add-heading': [parentKey: string]
	'add-sibling': [index: number]
	reorder: [fromIndex: number, toIndex: number]
	'request-hint': [requirementKey: string]
}>()

const tree = computed(() => buildTreeFromRows(props.rows))
const rootKeys = computed(() => new Set(tree.value.map((node) => node.key)))
const sectionExpanded = ref<Record<string, boolean>>({})
const dragFromIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)
const confirmRemoveIndex = ref<number | null>(null)

function sectionKey(key: string) {
	return `${props.scopeId}:${key}`
}

function isSectionExpanded(key: string) {
	if (props.readonly) return true

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

function expandAncestors(key: string) {
	const normalized = key.replace(/\//g, '.').trim()
	const parts = normalized.split('.').filter(Boolean)
	const next = { ...sectionExpanded.value }
	for (let i = 1; i < parts.length; i++) {
		const parent = parts.slice(0, i).join('.')
		next[sectionKey(parent)] = true
	}
	sectionExpanded.value = next
}

function handleRemove(index: number) {
	confirmRemoveIndex.value = null
	emit('remove', index)
}

function handleAddChild(parentKey: string) {
	expandSection(parentKey)
	emit('add-child', parentKey)
}

function handleAddHeading(parentKey: string) {
	expandSection(parentKey)
	emit('add-heading', parentKey)
}

function handleAddSibling(afterIndex: number) {
	const anchorKey = props.rows[afterIndex]?.key ?? ''
	const parentKey = anchorKey.includes('.')
		? anchorKey.replace(/\//g, '.').split('.').slice(0, -1).join('.')
		: null
	if (parentKey) expandSection(parentKey)
	emit('add-sibling', afterIndex)
}

function scrollToFocusKey(key: string) {
	if (!import.meta.client) return
	expandAncestors(key)
	nextTick(() => {
		const el = document.querySelector(
			`[data-row-key="${CSS.escape(`${props.scopeId}:${key}`)}"]`,
		) as HTMLElement | null
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	})
}

watch(
	() => props.focusKey,
	(key) => {
		if (!key) return
		scrollToFocusKey(key)
	},
)

provide('requirementTreeEditor', {
	isSectionExpanded,
	dragFromIndex,
	dropTargetIndex,
	confirmRemoveIndex,
	showHints: computed(() => props.showHints),
	hints: computed(() => props.hints ?? {}),
	hintLoadingKey: computed(() => props.hintLoadingKey),
	highlightKey: computed(() => props.highlightKey),
})
provide('editableRequirementRows', toRef(props, 'rows'))
</script>
