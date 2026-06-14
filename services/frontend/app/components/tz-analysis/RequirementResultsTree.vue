<template>
	<div class="space-y-4">
		<RequirementResultsTreeLevel
			v-if="sections.length > 0"
			:nodes="sections"
			:scope-id="scopeId"
			:default-kp-filename="defaultKpFilename"
			:is-item-expanded="isItemExpanded"
			:toggle-item-expand="toggleItemExpand"
			:tz-selected-indices="tzSelectedIndices"
			:belongs-to-primary-kp="belongsToPrimaryKp"
			@toggle-section="toggleSection"
			@toggle-select="(index, checked) => emit('toggle-select', index, checked)"
		/>

		<p
			v-if="sections.length === 0 && unmapped.length === 0"
			class="text-sm text-muted text-center py-4"
		>
			Нет пунктов по выбранному фильтру
		</p>

		<section v-if="unmapped.length > 0" class="space-y-3">
			<button
				type="button"
				class="flex w-full items-center gap-2 text-left rounded-lg border border-default/60
					bg-elevated/30 px-3 py-2 hover:bg-elevated/50"
				:aria-expanded="unmappedExpanded"
				@click="unmappedExpanded = !unmappedExpanded"
			>
				<UIcon
					:name="unmappedExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
					class="w-4 h-4 shrink-0 text-muted"
				/>
				<p class="text-sm font-semibold text-highlighted">Без раздела</p>
				<UBadge color="neutral" variant="subtle" size="xs">
					{{ unmapped.length }}
				</UBadge>
			</button>

			<div v-show="unmappedExpanded" class="space-y-3">
				<TzAnalysisResultItemCard
					v-for="item in unmapped"
					:key="item._index"
					:item="item"
					:default-kp-filename="defaultKpFilename"
					:is-expanded="isItemExpanded(item._index)"
					:is-selected="tzSelectedIndices.includes(item._index)"
					:show-checkbox="isTzSelectable(item.status) && belongsToPrimaryKp(item)"
					@toggle-expand="toggleItemExpand(item._index)"
					@toggle-select="(checked) => emit('toggle-select', item._index, checked)"
				/>
			</div>
		</section>
	</div>
</template>

<script lang="ts" setup>
import type { TZAnalysisItem, TZAnalysisStatus } from '#shared/types'
import type { ResultTreeNode } from '#shared/utils/requirementsStruct'
import RequirementResultsTreeLevel from '~/components/tz-analysis/RequirementResultsTreeLevel.vue'

type TZItemView = TZAnalysisItem & { _index: number }

const props = defineProps<{
	sections: ResultTreeNode[]
	unmapped: TZItemView[]
	scopeId: string
	defaultKpFilename?: string | null
	isItemExpanded: (index: number) => boolean
	toggleItemExpand: (index: number) => void
	tzSelectedIndices: number[]
	belongsToPrimaryKp: (item: TZAnalysisItem) => boolean
}>()

const emit = defineEmits<{
	'toggle-select': [index: number, checked: boolean]
}>()

const sectionExpanded = ref<Record<string, boolean>>({})
const unmappedExpanded = ref(true)
const rootKeys = computed(() => new Set(props.sections.map((section) => section.key)))

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

function isTzSelectable(status: TZAnalysisStatus) {
	return status === 'partial' || status === 'missing' || status === 'not_found'
}

provide('requirementResultsTree', { isSectionExpanded })
</script>
