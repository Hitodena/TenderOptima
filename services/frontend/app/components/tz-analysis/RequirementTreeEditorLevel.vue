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
						'flex items-start gap-3',
						node.isHeading && 'rounded-lg border border-default/60 bg-elevated/40 p-3',
					]"
				>
				<UButton
					type="button"
					variant="ghost"
					color="neutral"
					size="xs"
					class="shrink-0 mt-3"
					:leading-icon="editor.isSectionExpanded(node.key)
						? 'i-lucide-chevron-down'
						: 'i-lucide-chevron-right'"
					:aria-expanded="editor.isSectionExpanded(node.key)"
					@click="emit('toggle-section', node.key)"
				/>
					<span
						class="text-sm text-muted font-medium tabular-nums pt-3 min-w-10 shrink-0 text-right"
					>
						<template v-if="!node.key.startsWith('__row_')">{{ node.key }}.</template>
					</span>
					<div v-if="node.rowIndex !== undefined" class="flex-1 min-w-0 space-y-1">
						<p
							v-if="node.isHeading && showHeadingHint"
							class="text-xs font-medium text-muted uppercase tracking-wide"
						>
							Заголовок раздела · не анализируется в КП
						</p>
						<UTextarea
							v-if="node.rowIndex !== undefined && rowsRef[node.rowIndex]"
							v-model="rowsRef[node.rowIndex]!.text"
							class="w-full whitespace-pre-wrap"
							size="md"
							:rows="rowsForText(rowsRef[node.rowIndex]!.text, node.isHeading)"
							:maxrows="node.isHeading ? 4 : 12"
							:placeholder="node.isHeading ? 'Название раздела (необязательно)' : undefined"
							:readonly="readonly"
							autoresize
						/>
					</div>
					<div v-else class="flex-1 min-w-0 pt-2">
						<p class="text-sm font-semibold text-highlighted">
							<span v-if="node.text">{{ node.text }}</span>
							<span v-else class="text-muted font-normal">Раздел</span>
						</p>
					</div>
				<UButton
					v-if="node.rowIndex !== undefined && !readonly"
					type="button"
					variant="ghost"
					color="neutral"
					size="sm"
					class="mt-3 shrink-0"
					icon="i-lucide-x"
					@click="emit('remove', node.rowIndex)"
				/>
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
						@toggle-section="(key) => emit('toggle-section', key)"
					/>
					<div v-if="!readonly" class="flex flex-wrap items-center gap-2">
						<UButton
							type="button"
							variant="ghost"
							color="neutral"
							size="xs"
							leading-icon="i-lucide-plus"
							@click="emit('add-child', node.key)"
						>
							Добавить пункт
						</UButton>
						<UButton
							type="button"
							variant="ghost"
							color="neutral"
							size="xs"
							leading-icon="i-lucide-heading"
							@click="emit('add-heading', node.key)"
						>
							Добавить заголовок
						</UButton>
					</div>
				</div>
			</template>

		<template v-else-if="node.rowIndex !== undefined">
			<div class="flex items-center gap-3">
				<span class="w-7 shrink-0" aria-hidden="true" />
				<span
					class="text-sm text-muted font-medium tabular-nums min-w-10 shrink-0 text-right"
				>
					<template v-if="!node.key.startsWith('__row_')">{{ node.key }}.</template>
				</span>
				<div class="flex-1 min-w-0">
					<UTextarea
						v-if="node.rowIndex !== undefined && rowsRef[node.rowIndex]"
						v-model="rowsRef[node.rowIndex]!.text"
						class="w-full whitespace-pre-wrap"
						size="md"
						:rows="textareaRowsFromText(rowsRef[node.rowIndex]!.text)"
						:maxrows="12"
						:readonly="readonly"
						autoresize
					/>
				</div>
				<div v-if="!readonly" class="flex items-center gap-1 shrink-0">
					<UButton
						type="button"
						variant="ghost"
						color="neutral"
						size="sm"
						icon="i-lucide-plus"
						title="Добавить подпункт"
						@click="emit('add-child', node.key)"
					/>
					<UButton
						type="button"
						variant="ghost"
						color="neutral"
						size="sm"
						icon="i-lucide-x"
						@click="emit('remove', node.rowIndex)"
					/>
				</div>
			</div>
		</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {
	textareaRowsFromText,
	type EditableRequirementRow,
	type RequirementTreeNode,
} from '#shared/utils/requirementsStruct'
import RequirementTreeEditorLevel from '~/components/tz-analysis/RequirementTreeEditorLevel.vue'

function rowsForText(text: string, isHeading?: boolean) {
	return isHeading ? 1 : textareaRowsFromText(text)
}

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
	'toggle-section': [key: string]
}>()

const rowsRef = inject<Ref<EditableRequirementRow[]>>('editableRequirementRows')!

const editor = inject<{
	isSectionExpanded: (key: string) => boolean
}>('requirementTreeEditor')!
</script>
