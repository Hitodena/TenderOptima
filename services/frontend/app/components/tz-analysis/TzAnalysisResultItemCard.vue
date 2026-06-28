<template>
	<UCard variant="subtle" :class="matchBorderClass(item.status)" :ui="{ body: 'p-0 sm:p-0' }">
		<div class="p-3 sm:p-4">
			<div class="flex items-start gap-2">
				<UButton
					type="button"
					variant="ghost"
					color="neutral"
					size="xs"
					class="shrink-0 -ml-1 mt-0.5"
					:leading-icon="isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
					:aria-expanded="isExpanded"
					@click="emit('toggle-expand')"
				/>
				<button type="button" class="flex-1 min-w-0 text-left" @click="emit('toggle-expand')">
					<TzRequirementDualText
						:requirement="item.requirement"
						:requirement-ref="item.requirement_ref"
						:source-ref="item.ref"
						:source-ref-value="item.ref_value"
					/>
				</button>
				<USelect
					v-if="editable"
					:model-value="item.status"
					:items="statusOptions"
					size="xs"
					class="min-w-36 shrink-0"
					@update:model-value="(value) => emit('status-change', value as TZAnalysisStatus)"
					@click.stop
				/>
				<UBadge
					v-else
					:color="getTzItemStatusColor(item.status)"
					variant="subtle"
					size="sm"
					class="shrink-0 max-w-28 sm:max-w-none text-center
						text-[11px] sm:text-xs leading-snug whitespace-normal"
				>
					{{ getTzItemStatusLabel(item.status) }}
				</UBadge>
				<UIcon
					v-if="isOverridden"
					name="i-lucide-pencil"
					class="w-3.5 h-3.5 shrink-0 text-muted"
					title="Изменено вручную"
				/>
			</div>

			<div
				v-show="isExpanded"
				class="mt-4 pt-4 border-t border-default/60 space-y-4 pl-7"
			>
				<div class="space-y-1.5">
					<p class="text-xs font-semibold uppercase tracking-wide text-muted">
						Полное требование
					</p>
					<TzRequirementDualText
						:requirement="item.requirement"
						:requirement-ref="item.requirement_ref"
						:source-ref="item.ref"
						:source-ref-value="item.ref_value"
					/>
					<p v-if="tzSourceRef" class="text-xs text-muted">
						<span class="font-medium text-default/70">Ссылка:</span>
						<button
							v-if="analysisFiles"
							type="button"
							class="ml-1 text-primary hover:underline text-left whitespace-pre-wrap"
							@click.stop="analysisFiles.openTzFile()"
						>
							{{ tzSourceRef }}
						</button>
						<span v-else class="ml-1 whitespace-pre-wrap">{{ tzSourceRef }}</span>
					</p>
				</div>

				<div class="space-y-1.5">
					<p class="text-xs font-semibold uppercase tracking-wide text-muted">
						Значение из предложения
					</p>
					<p v-if="item.offer_value" class="text-sm whitespace-pre-wrap leading-relaxed">
						{{ item.offer_value }}
					</p>
					<p v-else class="text-sm text-muted italic">
						Не указано в КП
					</p>
					<p v-if="item.offer_ref" class="text-xs text-muted">
						<span class="font-medium text-default/70">Ссылка:</span>
						<button
							v-if="analysisFiles && itemKpFilename"
							type="button"
							class="ml-1 text-primary hover:underline text-left"
							@click.stop="analysisFiles.openKpFile(itemKpFilename)"
						>
							{{ item.offer_ref }}
						</button>
						<span v-else class="ml-1">{{ item.offer_ref }}</span>
					</p>
				</div>

				<div class="space-y-1.5">
					<p class="text-xs font-semibold uppercase tracking-wide text-muted">
						Объяснение
					</p>
					<p class="text-sm text-default/80 whitespace-pre-wrap leading-relaxed">
						{{ item.explanation }}
					</p>
				</div>
			</div>
		</div>
	</UCard>
</template>

<script lang="ts" setup>
import type { TZAnalysisItem, TZAnalysisStatus } from '#shared/types'
import { getTzItemStatusColor, getTzItemStatusLabel } from '#shared/types'
import type { RequirementsHierarchy } from '#shared/utils/requirementsStruct'
import { formatTzSourceRefLink } from '#shared/utils/tzRequirementDisplay'
import TzRequirementDualText from '~/components/tz-analysis/TzRequirementDualText.vue'

type TZItemView = TZAnalysisItem & { _index: number }

const props = withDefaults(defineProps<{
	item: TZItemView
	isExpanded: boolean
	defaultKpFilename?: string | null
	editable?: boolean
	isOverridden?: boolean
}>(), {
	defaultKpFilename: null,
	editable: false,
	isOverridden: false,
})

const emit = defineEmits<{
	'toggle-expand': []
	'status-change': [status: TZAnalysisStatus]
}>()

const statusOptions = [
	{ label: 'Соответствует', value: 'met' },
	{ label: 'Частично', value: 'partial' },
	{ label: 'Не соответствует', value: 'missing' },
	{ label: 'Не найдено', value: 'not_found' },
]

const analysisFiles = inject<{
	openTzFile: () => Promise<void>
	openKpFile: (displayName: string) => Promise<void>
} | null>('tzAnalysisFiles', null)

const requirementsTz = inject<Ref<RequirementsHierarchy | null | undefined>>(
	'tzRequirementsHierarchy',
	ref(null),
)

const tzSourceRef = computed(() =>
	formatTzSourceRefLink(props.item, requirementsTz.value),
)

const itemKpFilename = computed(() =>
	props.item.kp_name || props.defaultKpFilename || null,
)

function matchBorderClass(status: TZAnalysisStatus) {
	if (status === 'met') return 'border-l-4 border-primary'
	if (status === 'partial') return 'border-l-4 border-warning'
	if (status === 'missing') return 'border-l-4 border-error'
	return 'border-l-4 border-neutral-300 dark:border-neutral-600'
}
</script>
