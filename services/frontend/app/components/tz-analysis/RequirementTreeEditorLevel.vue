<template>
	<div class="space-y-4">
		<div
			v-for="node in nodes"
			:key="`${scopeId}-${node.key}-${node.rowIndex ?? 'h'}`"
			class="space-y-3"
		>
			<template v-if="node.isHeading || node.children.length > 0">
				<div
					:class="[
						'rounded-lg transition-colors',
						node.isHeading && 'border border-default/60 bg-elevated/40 p-2',
						isDropTarget(node) && 'ring-2 ring-primary/40',
						isDragging(node) && 'opacity-50',
					]"
					@dragenter.prevent="onDragEnter($event, node)"
					@dragover.prevent="onDragOver($event, node)"
					@dragleave="onDragLeave"
					@drop.prevent="onDrop($event, node)"
				>
					<div class="flex items-start gap-2">
						<UButton
							v-if="!readonly"
							type="button"
							variant="ghost"
							color="neutral"
							size="sm"
							class="shrink-0 mt-2"
							:leading-icon="editor.isSectionExpanded(node.key)
								? 'i-lucide-chevron-down'
								: 'i-lucide-chevron-right'"
							:aria-expanded="editor.isSectionExpanded(node.key)"
							@click="emit('toggle-section', node.key)"
						/>
						<div
							v-else
							class="w-8 shrink-0"
							aria-hidden="true"
						/>
						<span
							class="text-sm text-muted font-medium tabular-nums pt-3 min-w-10 shrink-0 text-right"
						>
							<template v-if="!node.key.startsWith('__row_')">{{ node.key }}.</template>
						</span>
						<div class="flex-1 min-w-0">
							<div v-if="node.rowIndex !== undefined" class="space-y-2">
								<UTextarea
									v-if="rowsRef[node.rowIndex]"
									v-model="rowsRef[node.rowIndex]!.text"
									class="w-full whitespace-pre-wrap min-h-10"
									:ui="{ base: 'resize-none field-sizing-content' }"
									size="md"
									:rows="1"
									:maxrows="20"
									:autoresize-delay="50"
									:readonly="readonly"
									autoresize
								/>
							</div>
							<div v-else class="pt-2">
								<p class="text-sm font-semibold text-highlighted">
									<span v-if="node.text">{{ node.text }}</span>
									<span v-else class="text-muted font-normal">Раздел</span>
								</p>
							</div>
							<RequirementNodeRail
								v-if="!readonly"
								:show-remove="node.rowIndex !== undefined"
								@add-child="emit('add-child', node.key)"
								@add-sibling="onAddSibling(node)"
								@remove="node.rowIndex !== undefined && emit('remove', node.rowIndex)"
							/>
						</div>
						<button
							v-if="!readonly && node.rowIndex !== undefined"
							type="button"
							class="shrink-0 mt-2 p-1 rounded hover:bg-elevated/60 cursor-grab active:cursor-grabbing touch-none"
							draggable="true"
							aria-label="Перетащить пункт"
							@dragstart="onDragStart($event, node.rowIndex!)"
							@dragend="onDragEnd"
						>
							<UIcon
								name="i-lucide-grip-vertical"
								class="w-5 h-5 text-muted"
							/>
						</button>
					</div>
				</div>

				<div
					v-show="editor.isSectionExpanded(node.key)"
					class="ml-4 pl-4 border-l border-default/50 space-y-4"
				>
					<RequirementTreeEditorLevel
						:nodes="node.children"
						:scope-id="scopeId"
						:show-heading-hint="showHeadingHint"
						:readonly="readonly"
						@remove="(index) => emit('remove', index)"
						@add-child="(parentKey) => emit('add-child', parentKey)"
						@add-heading="(parentKey) => emit('add-heading', parentKey)"
						@add-sibling="(index) => emit('add-sibling', index)"
						@reorder="(from, to) => emit('reorder', from, to)"
						@toggle-section="(key) => emit('toggle-section', key)"
					/>
				</div>
			</template>

			<template v-else-if="node.rowIndex !== undefined">
				<div
					:class="[
						'transition-colors',
						isDropTarget(node) && 'ring-2 ring-primary/40 rounded-lg',
						isDragging(node) && 'opacity-50',
					]"
					@dragenter.prevent="onDragEnter($event, node)"
					@dragover.prevent="onDragOver($event, node)"
					@dragleave="onDragLeave"
					@drop.prevent="onDrop($event, node)"
				>
					<div class="flex items-start gap-2">
						<div class="w-8 shrink-0" aria-hidden="true" />
						<span
							class="text-sm text-muted font-medium tabular-nums min-w-10 shrink-0 text-right pt-3"
						>
							<template v-if="!node.key.startsWith('__row_')">{{ node.key }}.</template>
						</span>
						<div class="flex-1 min-w-0">
							<UTextarea
								v-if="rowsRef[node.rowIndex]"
								v-model="rowsRef[node.rowIndex]!.text"
								class="w-full whitespace-pre-wrap min-h-10"
								:ui="{ base: 'resize-none field-sizing-content' }"
								size="md"
								:rows="1"
								:maxrows="20"
								:autoresize-delay="50"
								:readonly="readonly"
								autoresize
							/>
							<RequirementNodeRail
								v-if="!readonly"
								@add-child="emit('add-child', node.key)"
								@add-sibling="onAddSibling(node)"
								@remove="emit('remove', node.rowIndex)"
							/>
						</div>
						<button
							v-if="!readonly"
							type="button"
							class="shrink-0 mt-2 p-1 rounded hover:bg-elevated/60 cursor-grab active:cursor-grabbing touch-none"
							draggable="true"
							aria-label="Перетащить пункт"
							@dragstart="onDragStart($event, node.rowIndex)"
							@dragend="onDragEnd"
						>
							<UIcon
								name="i-lucide-grip-vertical"
								class="w-5 h-5 text-muted"
							/>
						</button>
					</div>
				</div>
			</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { EditableRequirementRow, RequirementTreeNode } from '#shared/utils/requirementsStruct'
import { canReorderRequirementRows } from '#shared/utils/requirementsStruct'
import RequirementNodeRail from '~/components/tz-analysis/RequirementNodeRail.vue'
import RequirementTreeEditorLevel from '~/components/tz-analysis/RequirementTreeEditorLevel.vue'

defineProps<{
	nodes: RequirementTreeNode[]
	scopeId: string
	showHeadingHint?: boolean
	readonly?: boolean
}>()

const emit = defineEmits<{
	remove: [index: number]
	'add-child': [parentKey: string]
	'add-heading': [parentKey: string]
	'add-sibling': [index: number]
	reorder: [fromIndex: number, toIndex: number]
	'toggle-section': [key: string]
}>()

const rowsRef = inject<Ref<EditableRequirementRow[]>>('editableRequirementRows')!

const editor = inject<{
	isSectionExpanded: (key: string) => boolean
	dragFromIndex: Ref<number | null>
	dropTargetIndex: Ref<number | null>
}>('requirementTreeEditor')!

function onAddSibling(node: RequirementTreeNode) {
	if (node.rowIndex === undefined) return
	emit('add-sibling', node.rowIndex)
}

function isDragging(node: RequirementTreeNode) {
	return node.rowIndex !== undefined
		&& editor.dragFromIndex.value === node.rowIndex
}

function isDropTarget(node: RequirementTreeNode) {
	return node.rowIndex !== undefined
		&& editor.dropTargetIndex.value === node.rowIndex
}

function onDragStart(event: DragEvent, rowIndex: number) {
	editor.dragFromIndex.value = rowIndex
	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = 'move'
		event.dataTransfer.setData('application/x-requirement-row', String(rowIndex))
		event.dataTransfer.setData('text/plain', String(rowIndex))
	}
}

function onDragEnd() {
	editor.dragFromIndex.value = null
	editor.dropTargetIndex.value = null
}

function canDropOn(node: RequirementTreeNode) {
	const fromIndex = editor.dragFromIndex.value
	if (fromIndex === null || node.rowIndex === undefined) return false
	return canReorderRequirementRows(rowsRef.value, fromIndex, node.rowIndex)
}

function onDragEnter(event: DragEvent, node: RequirementTreeNode) {
	if (!canDropOn(node)) return
	event.preventDefault()
	editor.dropTargetIndex.value = node.rowIndex!
}

function onDragOver(event: DragEvent, node: RequirementTreeNode) {
	if (!canDropOn(node)) return
	event.dataTransfer!.dropEffect = 'move'
	editor.dropTargetIndex.value = node.rowIndex!
}

function onDragLeave() {
	editor.dropTargetIndex.value = null
}

function onDrop(_event: DragEvent, node: RequirementTreeNode) {
	const fromIndex = editor.dragFromIndex.value
	if (fromIndex === null || node.rowIndex === undefined) return
	if (!canReorderRequirementRows(rowsRef.value, fromIndex, node.rowIndex)) return
	emit('reorder', fromIndex, node.rowIndex)
	onDragEnd()
}
</script>
