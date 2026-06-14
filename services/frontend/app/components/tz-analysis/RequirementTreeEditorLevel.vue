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
						class="shrink-0 mt-2"
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
							:rows="node.isHeading ? 1 : 3"
							:maxrows="node.isHeading ? 4 : 12"
							:placeholder="node.isHeading ? 'Название раздела (необязательно)' : undefined"
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
						v-if="node.rowIndex !== undefined"
						type="button"
						variant="ghost"
						color="neutral"
						size="sm"
						class="mt-2 shrink-0"
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
						@remove="(index) => emit('remove', index)"
						@toggle-section="(key) => emit('toggle-section', key)"
					/>
				</div>
			</template>

			<template v-else-if="node.rowIndex !== undefined">
				<div class="flex items-start gap-3">
					<span class="w-7 shrink-0" aria-hidden="true" />
					<span
						class="text-sm text-muted font-medium tabular-nums pt-3 min-w-10 shrink-0 text-right"
					>
						<template v-if="!node.key.startsWith('__row_')">{{ node.key }}.</template>
					</span>
					<div class="flex-1 min-w-0">
						<UTextarea
							v-if="node.rowIndex !== undefined && rowsRef[node.rowIndex]"
							v-model="rowsRef[node.rowIndex]!.text"
							class="w-full whitespace-pre-wrap"
							size="md"
							:rows="3"
							:maxrows="12"
							autoresize
						/>
					</div>
					<UButton
						type="button"
						variant="ghost"
						color="neutral"
						size="sm"
						class="mt-2 shrink-0"
						icon="i-lucide-x"
						@click="emit('remove', node.rowIndex)"
					/>
				</div>
			</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { EditableRequirementRow, RequirementTreeNode } from '#shared/utils/requirementsStruct'
import RequirementTreeEditorLevel from '~/components/tz-analysis/RequirementTreeEditorLevel.vue'

defineProps<{
	nodes: RequirementTreeNode[]
	scopeId: string
	showHeadingHint?: boolean
}>()

const emit = defineEmits<{
	remove: [index: number]
	'toggle-section': [key: string]
}>()

const rowsRef = inject<Ref<EditableRequirementRow[]>>('editableRequirementRows')!

const editor = inject<{
	isSectionExpanded: (key: string) => boolean
}>('requirementTreeEditor')!
</script>
