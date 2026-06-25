<template>
	<div class="space-y-4">
		<div v-for="node in nodes" :key="`${scopeId}-${node.key}`" class="space-y-3">
			<template
				v-if="(node.isHeading || node.children.length > 0) && sectionItemCount(node) > 0"
			>
				<button
					type="button"
					class="flex w-full items-start gap-2 text-left rounded-lg border border-default/60
						bg-elevated/20 px-3 py-2 hover:bg-elevated/40"
					:aria-expanded="resultsTree.isSectionExpanded(node.key)"
					@click="emit('toggle-section', node.key)"
				>
					<UIcon
						:name="resultsTree.isSectionExpanded(node.key)
							? 'i-lucide-chevron-down'
							: 'i-lucide-chevron-right'"
						class="w-4 h-4 shrink-0 text-muted mt-0.5"
					/>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold text-highlighted">
							<span class="text-muted font-medium tabular-nums">{{ node.key }}.</span>
							<span v-if="node.text" class="ml-1">{{ node.text }}</span>
							<span v-else class="ml-1 text-muted font-normal">Раздел</span>
						</p>
					</div>
					<UBadge v-if="sectionItemCount(node) > 0" color="neutral" variant="subtle" size="xs">
						{{ sectionItemCount(node) }}
					</UBadge>
				</button>

				<div
					v-show="resultsTree.isSectionExpanded(node.key)"
					class="ml-4 pl-4 border-l border-default/50 space-y-4"
				>
					<RequirementResultsTreeLevel
						:nodes="node.children"
						:scope-id="scopeId"
						:default-kp-filename="defaultKpFilename"
						:is-item-expanded="isItemExpanded"
						:toggle-item-expand="toggleItemExpand"
						:editable="editable"
						:is-item-overridden="isItemOverridden"
						@toggle-section="(key) => emit('toggle-section', key)"
						@status-change="(index, status) => emit('status-change', index, status)"
					/>

					<div v-if="node.items.length > 0" class="space-y-3">
						<TzAnalysisResultItemCard
							v-for="item in node.items"
							:key="item._index"
							:item="item"
							:default-kp-filename="defaultKpFilename"
							:is-expanded="isItemExpanded(item._index)"
							:editable="editable"
							:is-overridden="isItemOverridden(item._index)"
							@toggle-expand="toggleItemExpand(item._index)"
							@status-change="(status) => emit('status-change', item._index, status)"
						/>
					</div>
				</div>
			</template>

			<template v-else-if="node.items.length > 0">
				<div class="space-y-3">
					<TzAnalysisResultItemCard
						v-for="item in node.items"
						:key="item._index"
						:item="item"
						:default-kp-filename="defaultKpFilename"
						:is-expanded="isItemExpanded(item._index)"
						:editable="editable"
						:is-overridden="isItemOverridden(item._index)"
						@toggle-expand="toggleItemExpand(item._index)"
						@status-change="(status) => emit('status-change', item._index, status)"
					/>
				</div>
			</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { TZAnalysisStatus } from '#shared/types'
import type { ResultTreeNode } from '#shared/utils/requirementsStruct'
import RequirementResultsTreeLevel from '~/components/tz-analysis/RequirementResultsTreeLevel.vue'

defineProps<{
	nodes: ResultTreeNode[]
	scopeId: string
	defaultKpFilename?: string | null
	isItemExpanded: (index: number) => boolean
	toggleItemExpand: (index: number) => void
	editable?: boolean
	isItemOverridden: (index: number) => boolean
}>()

const emit = defineEmits<{
	'toggle-section': [key: string]
	'status-change': [index: number, status: TZAnalysisStatus]
}>()

const resultsTree = inject<{
	isSectionExpanded: (key: string) => boolean
}>('requirementResultsTree')!

function sectionItemCount(node: ResultTreeNode): number {
	let count = node.items.length
	for (const child of node.children) count += sectionItemCount(child)
	return count
}
</script>
