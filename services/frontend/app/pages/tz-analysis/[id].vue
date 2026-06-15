<template>
	<UContainer class="py-8">
		<template v-if="loading">
			<div class="space-y-4">
				<USkeleton class="h-10 w-72" />
				<USkeleton class="h-6 w-48" />
				<USkeleton class="h-64 w-full" />
			</div>
		</template>

		<template v-else-if="analysis">
			<div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
				<div class="min-w-0">
					<UButton to="/tz-analysis/history" variant="ghost" color="neutral" size="sm"
						leading-icon="i-lucide-arrow-left" class="-ml-1 mb-2">
						К анализам
					</UButton>
					<div class="flex items-center gap-3 mb-1 flex-wrap">
						<h1 class="text-2xl font-bold text-highlighted truncate">
							{{ analysis.title || 'Анализ ТЗ' }}
						</h1>
						<UBadge :color="statusColor" variant="subtle" size="lg">{{ statusLabel }}</UBadge>
					</div>
					<div class="flex items-center gap-3 text-sm text-muted flex-wrap">
						<span v-if="analysis.created_at" class="flex items-center gap-1">
							<UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
							{{ formatDate(analysis.created_at) }}
						</span>
						<span v-if="analysis.tz_filename || displayKpFilenames.length"
							class="flex items-center gap-1 min-w-0 flex-wrap">
							<UIcon name="i-lucide-files" class="w-3.5 h-3.5 shrink-0" />
							<template v-if="analysis.tz_filename">
								<button type="button" class="truncate max-w-full text-primary hover:underline text-left"
									@click="openTzFile()">
									{{ analysis.tz_filename }}
								</button>
							</template>

						</span>
					</div>
				</div>

				<UButton v-if="isDraft" size="lg" leading-icon="i-lucide-scan-search" :loading="tzAnalyzing"
					:disabled="!tzFile" @click="runTzAnalysis">
					Анализировать ТЗ
				</UButton>
			</div>

			<template v-if="isDraft">
				<UAlert color="info" variant="soft" icon="i-lucide-info" class="mb-6"
					description="Загрузите техническое задание и запустите анализ. После извлечения требований вы сможете проверить их и загрузить коммерческие предложения." />

				<UCard class="shadow-sm">
					<UFormField label="Техническое задание" required>
						<UFileUpload :model-value="tzFile" :accept="fileAccept" :interactive="true"
							:description="uploadDescription" layout="list" class="w-full min-h-32" position="inside"
							@update:model-value="onTzFileChange">
							<template #actions="{ open }">
								<UButton type="button" variant="outline" size="sm" @click="open()">
									<UIcon name="i-lucide-file-text" class="w-4 h-4" />
									Выбрать ТЗ
								</UButton>
							</template>
						</UFileUpload>
					</UFormField>

					<UProgress v-if="tzAnalyzing" animation="carousel" size="sm" class="mt-5" />
				</UCard>
			</template>

			<template v-else-if="analysis.status === TZAnalysisRunStatus.PROCESSING">
				<UCard class="shadow-sm">
					<div class="flex flex-col items-center justify-center py-20 gap-4 text-muted">
						<UIcon name="i-lucide-loader" class="w-10 h-10 animate-spin text-warning" />
						<p class="text-sm font-medium text-center">{{ processingStatusLabel }}</p>
						<p class="text-xs text-center max-w-md">
							{{ processingWaitHint }}
						</p>
						<UProgress animation="carousel" size="sm" class="w-full max-w-md" />
					</div>
				</UCard>
			</template>

			<template v-else-if="analysis.status === TZAnalysisRunStatus.FAILED">
				<UAlert color="error" variant="soft" icon="i-lucide-circle-alert"
					description="Не удалось выполнить анализ. Создайте новый анализ и попробуйте снова." />
			</template>

			<template v-else-if="isTzReviewPhase || needsRequirementsReview || hasConfirmedResults">
				<UTabs v-model="activeContentTab" :items="contentTabItems" :ui="{ list: 'mb-6' }">
					<template #tz>
						<div v-if="isTzReviewPhase || needsRequirementsReview"
							class="mb-6 rounded-xl border border-warning/25 bg-warning/10 p-4 sm:p-5">
							<div class="flex gap-3 min-w-0">
								<UIcon name="i-lucide-info" class="w-5 h-5 shrink-0 text-warning mt-0.5" />
								<div class="min-w-0 space-y-1">
									<p class="text-sm font-semibold text-highlighted">
										Проверьте извлечённые требования
									</p>
									<p class="text-sm text-muted">
										<template v-if="isTzReviewPhase">
											Система извлекла требования из ТЗ. Удалите лишние пункты,
											добавьте недостающие, затем добавьте поставщиков с КП
											для сравнения.
										</template>
										<template v-else>
											Система извлекла требования из ТЗ и предложения из КП.
											Удалите лишние пункты, добавьте недостающие, затем подтвердите
											для запуска сравнения.
										</template>
									</p>
								</div>
							</div>
						</div>

						<UCard class="shadow-sm">
							<template #header>
								<div class="flex items-center justify-between gap-2">
									<p class="font-semibold text-sm">Требования из ТЗ</p>
									<UBadge color="neutral" variant="subtle" size="xs">
										{{ editableTzCount }}
										{{ requirementWord(editableTzCount) }}
									</UBadge>
								</div>
							</template>

							<div class="max-h-[65vh] overflow-y-auto pr-1">
								<RequirementTreeEditor v-if="editableTzCount > 0" :rows="editableRequirementsTz"
									:scope-id="hasConfirmedResults ? 'tz-results' : 'tz-review'"
									:readonly="hasConfirmedResults" show-heading-hint @remove="removeTzRequirement" />
								<p v-else class="text-sm text-muted text-center py-4">
									Нет извлечённых требований
								</p>
							</div>

							<template v-if="!hasConfirmedResults" #footer>
								<UButton type="button" variant="outline" size="sm" leading-icon="i-lucide-plus"
									@click="addTzRequirement">
									Добавить требование
								</UButton>
							</template>
						</UCard>
					</template>

					<template #kp>
						<div class="grid grid-cols-1 gap-6" :class="showSuppliersSidebar && !isTzReviewPhase
							? 'xl:grid-cols-[16rem_minmax(0,1fr)]'
							: ''">
							<TzAnalysisSuppliersPanel v-if="showSuppliersSidebar && analysis?.id"
								:analysis-id="analysis.id" :suppliers="suppliers" :file-accept="fileAccept"
								:readonly="hasConfirmedResults || needsRequirementsReview"
								:selected-supplier-id="selectedSupplierId" :compact="!isTzReviewPhase"
								@select="selectedSupplierId = $event"
								@open-kp="({ supplierId, filename }) => openKpFile(filename, supplierId)"
								@updated="refreshAnalysis" />

							<div class="min-w-0 space-y-6">
								<template v-if="isTzReviewPhase">
									<div class="flex flex-wrap items-center gap-2">
										<UButton variant="outline" :loading="savingRequirements"
											@click="saveTzRequirements">
											Сохранить требования
										</UButton>
										<UButton color="warning" variant="solid" :loading="kpAnalyzing"
											:disabled="!canRunKpAnalysis" @click="runKpAnalysis">
											Запустить анализ КП
										</UButton>
									</div>
								</template>

								<template v-else-if="needsRequirementsReview">
									<div class="space-y-4">
										<UCard v-for="group in kpRequirementsGroups" :key="`review-kp-${group.id}`"
											class="shadow-sm">
											<template #header>
												<button type="button"
													class="flex w-full items-center justify-between gap-2 text-left"
													:aria-expanded="isReviewKpExpanded(group.id)"
													@click.stop="toggleReviewKpExpand(group.id)">
													<div class="flex items-center gap-2 min-w-0">
														<UIcon :name="isReviewKpExpanded(group.id)
															? 'i-lucide-chevron-down'
															: 'i-lucide-chevron-right'" class="w-4 h-4 shrink-0 text-muted" />
														<div class="min-w-0">
															<p class="font-semibold text-sm">{{ group.label }}</p>
															<button v-if="group.filename" type="button"
																class="text-xs text-primary hover:underline truncate mt-0.5 text-left max-w-full"
																@click.stop="openKpFileForGroup(group)">
																{{ group.filename }}
															</button>
														</div>
													</div>
													<UBadge color="neutral" variant="subtle" size="xs" class="shrink-0">
														{{ countRequirementRows(group.items) }}
														{{ requirementWord(countRequirementRows(group.items)) }}
													</UBadge>
												</button>
											</template>

											<template v-if="isReviewKpExpanded(group.id)" #footer>
												<UButton type="button" variant="outline" size="sm"
													leading-icon="i-lucide-plus" @click="addKpRequirement(group.key)">
													Добавить предложение
												</UButton>
											</template>

											<div v-show="isReviewKpExpanded(group.id)"
												class="max-h-[50vh] overflow-y-auto pr-1">
												<RequirementTreeEditor v-if="countRequirementRows(group.items) > 0"
													:rows="group.items" :scope-id="`review-kp-${group.id}`"
													@remove="(idx: number) => removeKpRequirement(group.key, idx)" />
												<p v-else class="text-sm text-muted text-center py-4">
													Нет извлечённых предложений
												</p>
											</div>
										</UCard>
									</div>

									<div class="flex flex-wrap items-center gap-2">
										<UButton variant="outline" :loading="savingRequirements"
											@click="saveRequirements">
											Сохранить изменения
										</UButton>
										<UButton color="warning" variant="solid" :loading="confirming"
											:disabled="!canConfirmRequirements" @click="confirmAnalysis">
											Подтвердить и запустить сравнение
										</UButton>
									</div>
								</template>

								<template v-else-if="hasConfirmedResults">
									<div class="flex flex-wrap items-end justify-between gap-4">
										<UFormField v-if="hasMultipleLetterKps" label="Основное КП" class="mb-0">
											<USelect
												:model-value="analysis.kp_filename ?? undefined"
												:items="primaryKpOptions"
												:loading="primaryKpSaving"
												size="sm"
												class="min-w-56"
												@update:model-value="setPrimaryKp"
											/>
										</UFormField>
										<div class="flex flex-wrap items-center gap-2">
											<UBadge color="primary" variant="subtle" size="lg">
												{{ primaryStatsSummary.match_score }}% соответствия
												<span v-if="hasMultipleLetterKps" class="opacity-80">· основное КП</span>
											</UBadge>
											<UBadge color="success" variant="subtle">
												{{ primaryStatsSummary.met_count }} ок
											</UBadge>
											<UBadge color="warning" variant="subtle">
												{{ primaryStatsSummary.partial_count }} частично
											</UBadge>
											<UBadge color="error" variant="subtle">
												{{ primaryStatsSummary.missing_count }} нет
											</UBadge>
											<UBadge color="neutral" variant="subtle">
												{{ primaryStatsSummary.not_found_count }} не найдено
											</UBadge>
										</div>
									</div>

									<UCard class="shadow-sm w-full">
										<template #header>
											<div class="flex items-center justify-between gap-2 w-full flex-wrap">
												<p class="font-semibold text-sm">Соответствия и несоответствия</p>
												<UFormField label="Фильтр" class="mb-0">
													<USelect v-model="tzStatusFilter" :items="tzFilterOptions" size="sm"
														class="min-w-40" />
												</UFormField>
											</div>
										</template>

										<div class="max-h-[70vh] overflow-y-auto pr-1 space-y-8">
											<section v-for="group in visibleKpItemGroups"
												:key="`results-kp-${group.id}`" class="space-y-4">
												<button type="button" class="sticky top-0 z-10 -mx-1 px-1 py-2 w-full text-left
														bg-default/95 backdrop-blur-sm border-b border-default" :aria-expanded="isResultsKpExpanded(group.id)"
													@click.stop="toggleResultsKpExpand(group.id)">
													<div class="flex flex-wrap items-center gap-2">
														<UIcon :name="isResultsKpExpanded(group.id)
															? 'i-lucide-chevron-down'
															: 'i-lucide-chevron-right'" class="w-4 h-4 shrink-0 text-muted" />
														<p class="text-sm font-semibold text-highlighted">{{ group.label
															}}</p>
														<UBadge v-if="analysis.kp_filename === group.key"
															color="primary" variant="subtle" size="xs">
															Основное
														</UBadge>
														<UBadge color="neutral" variant="subtle" size="xs">
															{{ group.items.length }} {{
																requirementWord(group.items.length) }}
														</UBadge>
														<UBadge
															v-if="getKpStats(group.key)"
															color="primary"
															variant="outline"
															size="xs"
														>
															{{ getKpStats(group.key)?.match_score }}%
														</UBadge>
													</div>
												</button>

												<div v-show="isResultsKpExpanded(group.id)">
													<RequirementResultsTree
														:sections="getResultTreeForGroup(group).sections"
														:unmapped="getResultTreeForGroup(group).unmapped"
														:scope-id="`results-kp-${group.id}`"
														:default-kp-filename="group.filename"
														:is-item-expanded="isItemExpanded"
														:toggle-item-expand="toggleItemExpand"
														:tz-selected-indices="tzSelectedIndices"
														:belongs-to-primary-kp="belongsToPrimaryKp"
														@toggle-select="toggleTzSelect" />
												</div>
											</section>

											<p v-if="visibleKpItemGroups.length === 0"
												class="text-sm text-muted text-center py-8">
												Нет пунктов по выбранному фильтру
											</p>
										</div>

										<template #footer>
											<div class="flex flex-wrap items-center gap-2">
												<UButton size="sm" variant="outline" leading-icon="i-lucide-download"
													@click="exportTzCsv">
													Экспорт CSV
												</UButton>
												<UButton size="sm" leading-icon="i-lucide-file-text"
													:disabled="tzSelectedIndices.length === 0" @click="openLetterModal">
													Письмо поставщику
												</UButton>
												<UBadge v-if="tzSelectedIndices.length > 0" color="neutral"
													variant="subtle">
													{{ tzSelectedIndices.length }} в письме
												</UBadge>
											</div>
										</template>
									</UCard>
								</template>
							</div>
						</div>
					</template>
				</UTabs>
			</template>
		</template>

		<UModal v-model:open="showQueueModal" :title="processingQueueTitle" :description="processingModalDescription">
			<template #footer>
				<UButton block @click="showQueueModal = false">Понятно</UButton>
			</template>
		</UModal>

		<UModal v-model:open="showLetterModal" title="Письмо поставщику"
			description="Письмо формируется по основному КП. Снимите галочки у пунктов, которые не нужно включать."
			:ui="{ content: 'sm:max-w-4xl' }">
			<template #body>
				<div v-if="previewLoading" class="flex justify-center py-12">
					<UIcon name="i-lucide-loader" class="w-7 h-7 animate-spin text-muted" />
				</div>

				<template v-else>
					<div class="grid grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)] gap-5 min-h-0">
						<aside class="flex flex-col gap-4 min-h-0 md:max-h-[62vh]">
							<div class="space-y-3 shrink-0">
								<p v-if="primaryKpLabel" class="text-xs text-muted">
									Основное КП:
									<button v-if="analysis?.kp_filename" type="button"
										class="text-primary hover:underline font-medium"
										@click="openKpFile(analysis.kp_filename)">
										{{ primaryKpLabel }}
									</button>
									<span v-else class="text-default font-medium">{{ primaryKpLabel }}</span>
								</p>
								<UFormField label="Организация" required>
									<UInput ref="docxOrganizationInput" v-model="docxOrganization"
										placeholder="Наименование организации" size="md" />
								</UFormField>
								<UFormField label="Срок ответа">
									<UInput v-model="docxDeadline" placeholder="7 июня 2026 г." size="md" />
								</UFormField>
								<p v-if="!docxOrganization.trim()" class="text-xs text-muted">
									Укажите организацию для предпросмотра
								</p>
							</div>

							<div class="border-t border-default shrink-0" />

							<div class="flex flex-col gap-2 shrink-0">
								<p class="text-xs font-semibold uppercase tracking-wide text-muted px-0.5">
									Разделы письма
								</p>
								<UButton v-for="tab in letterPreviewTabs" :key="tab.value" type="button" block
									:variant="letterPreviewTab === tab.value ? 'soft' : 'ghost'"
									:color="letterPreviewTab === tab.value ? tab.color : 'neutral'" size="sm"
									class="justify-start text-left whitespace-normal h-auto py-2"
									:disabled="tab.disabled" @click="scrollToLetterSection(
										tab.value === 'partial' ? 'partial' : 'mismatch',
									)">
									{{ tab.label }}
								</UButton>
							</div>

							<div class="flex-1 min-h-0 overflow-y-auto space-y-4 pr-0.5">
								<div v-if="letterModalMismatchItems.length" class="space-y-2">
									<p class="text-xs font-semibold text-error px-0.5">
										Не совпадает
										<span v-if="primaryKpLabel" class="text-muted font-normal">
											· {{ primaryKpLabel }}
										</span>
									</p>
									<label v-for="item in letterModalMismatchItems" :key="item._index" class="flex items-start gap-2 rounded-lg border border-default/60
											bg-elevated/30 px-2 py-2 cursor-pointer hover:bg-elevated/50">
										<UCheckbox :model-value="tzSelectedIndices.includes(item._index)"
											:color="getTzItemStatusColor(item.status)" class="shrink-0 mt-0.5"
											@update:model-value="(v) => toggleTzSelect(item._index, v === true)"
											@click.stop />
										<span class="text-xs leading-relaxed whitespace-pre-wrap min-w-0">
											{{ item.requirement }}
										</span>
									</label>
								</div>

								<div v-if="letterModalPartialItems.length" class="space-y-2">
									<p class="text-xs font-semibold text-warning px-0.5">
										Частично совпадает
										<span v-if="primaryKpLabel" class="text-muted font-normal">
											· {{ primaryKpLabel }}
										</span>
									</p>
									<label v-for="item in letterModalPartialItems" :key="item._index" class="flex items-start gap-2 rounded-lg border border-default/60
											bg-elevated/30 px-2 py-2 cursor-pointer hover:bg-elevated/50">
										<UCheckbox :model-value="tzSelectedIndices.includes(item._index)"
											:color="getTzItemStatusColor(item.status)" class="shrink-0 mt-0.5"
											@update:model-value="(v) => toggleTzSelect(item._index, v === true)"
											@click.stop />
										<span class="text-xs leading-relaxed whitespace-pre-wrap min-w-0">
											{{ item.requirement }}
										</span>
									</label>
								</div>
							</div>
						</aside>

						<div ref="letterDocumentRef" class="rounded-xl border border-default bg-elevated/30 px-5 py-6
									max-h-[58vh] overflow-y-auto shadow-inner">
							<template v-if="fullLetterBlocks.length">
								<div v-for="(block, bIdx) in fullLetterBlocks" :key="bIdx" :id="block.sectionId"
									:class="block.sectionId ? 'scroll-mt-4' : undefined">
									<p v-for="(paragraph, pIdx) in block.paragraphs" :key="`${bIdx}-${pIdx}`"
										class="text-sm whitespace-pre-wrap mb-2.5 last:mb-0 leading-relaxed"
										:class="letterParagraphClass(paragraph, block.isTitle)">
										{{ paragraph || '\u00A0' }}
									</p>
								</div>
							</template>
							<p v-else class="text-sm text-muted text-center py-10">
								Выберите пункты для формирования письма
							</p>
						</div>
					</div>
				</template>
			</template>
			<template #footer>
				<div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
					<UButton variant="outline" color="neutral" @click="showLetterModal = false">
						Закрыть
					</UButton>
					<UButton leading-icon="i-lucide-download" :loading="docxGenerating"
						:disabled="tzSelectedIndices.length === 0 || !docxOrganization.trim()" @click="generateDocx">
						Скачать DOCX
						<span v-if="tzSelectedIndices.length > 0" class="ml-1 opacity-80">
							({{ tzSelectedIndices.length }})
						</span>
					</UButton>
				</div>
			</template>
		</UModal>
	</UContainer>
</template>

<script lang="ts" setup>
import type {
	TZAnalysisConfirmRequest,
	TZAnalysisItem,
	TZAnalysisKpStats,
	TZAnalysisPreviewResponse,
	TZAnalysisSession,
	TZAnalysisStatus,
	TZRequirementsUpdateRequest,
	UserResponse,
} from '#shared/types'
import {
	getTzItemStatusColor,
	getTzRunStatusColor,
	getTzRunStatusLabel,
	TZAnalysisRunStatus
} from '#shared/types'
import {
	buildResultTree,
	countRequirementRows,
	flattenRequirementsToRows,
	requirementsNonempty,
	requirementsRowsNonempty,
	rowsToHierarchy,
	type EditableRequirementRow,
} from '#shared/utils/requirementsStruct'
import RequirementResultsTree from '~/components/tz-analysis/RequirementResultsTree.vue'
import RequirementTreeEditor from '~/components/tz-analysis/RequirementTreeEditor.vue'
import TzAnalysisSuppliersPanel from '~/components/tz-analysis/TzAnalysisSuppliersPanel.vue'
import { useRunStatusPolling } from '~/composables/useRunStatusPolling'
import { useTzAnalysisFiles } from '~/composables/useTzAnalysisFiles'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => route.params.id as string)

const { get, post, patch } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()
const { formatDate } = useFormatDate()
const { public: publicConfig } = useRuntimeConfig()

const MAX_UPLOAD_SIZE = publicConfig.maxTzUploadSize as number
const fileAccept = '.pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp'

const uploadDescription = computed(() => {
	const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)
	return `PDF, DOCX, XLSX, TXT, изображения. До ${sizeMb} МБ`
})

type KpSlot = { id: number; file: File | null }

let kpSlotCounter = 0

const loading = ref(true)
const analysis = ref<TZAnalysisSession | null>(null)
const { openTzFile, openKpFile } = useTzAnalysisFiles(
	computed(() => analysis.value?.id),
	computed(() => analysis.value?.tz_filename),
)
provide('tzAnalysisFiles', { openTzFile, openKpFile })

const activeContentTab = ref('tz')
const contentTabItems = [
	{ label: 'ТЗ', value: 'tz', slot: 'tz', icon: 'i-lucide-file-text' },
	{ label: 'КП / Результаты', value: 'kp', slot: 'kp', icon: 'i-lucide-file-spreadsheet' },
]
const selectedSupplierId = ref<string | null>(null)
const tzFile = ref<File | null>(null)
const kpSlots = ref<KpSlot[]>([{ id: ++kpSlotCounter, file: null }])
const tzAnalyzing = ref(false)
const kpAnalyzing = ref(false)
const tzPolling = ref(false)
const tzSelectedIndices = ref<number[]>([])
const tzStatusFilter = ref('all')
const showQueueModal = ref(false)
const processingPhase = ref<'tz' | 'kp'>('tz')
const showLetterModal = ref(false)
const letterPreviewTab = ref('mismatch')
const confirming = ref(false)
const savingRequirements = ref(false)
const primaryKpSaving = ref(false)
const editableRequirementsTz = ref<EditableRequirementRow[]>([])
const editableRequirementsKp = ref<Record<string, EditableRequirementRow[]>>({})
const docxOrganization = ref('')
const docxDeadline = ref('')
const docxGenerating = ref(false)
const letterPreview = ref<TZAnalysisPreviewResponse | null>(null)
const previewLoading = ref(false)
const docxOrganizationInput = ref<{ $el?: HTMLElement } | null>(null)
const letterDocumentRef = ref<HTMLElement | null>(null)

const LETTER_MISMATCH_HEADER = 'Несоответствующие параметры:'
const LETTER_PARTIAL_HEADER = 'Требуют уточнения/дополнения:'

const tzFilterOptions = [
	{ label: 'Все', value: 'all' },
	{ label: 'Соответствует', value: 'met' },
	{ label: 'Частично', value: 'partial' },
	{ label: 'Не соответствует', value: 'missing' },
	{ label: 'Не найдено', value: 'not_found' },
]

type TZItemView = TZAnalysisItem & { _index: number }

type KpItemGroup = {
	id: number
	key: string
	label: string
	filename: string | null
	items: TZItemView[]
}

const expandedItems = ref<Set<number>>(new Set())
const reviewKpExpanded = ref<Record<number, boolean>>({})
const resultsKpExpanded = ref<Record<number, boolean>>({})

let reviewKpKeysSignature = ''
let resultsKpKeysSignature = ''

const KP_GROUPS_DEFAULT_EXPANDED = 2

function buildKpExpandedState(count: number): Record<number, boolean> {
	const next: Record<number, boolean> = {}
	for (let idx = 0; idx < count; idx++) {
		next[idx] = count <= KP_GROUPS_DEFAULT_EXPANDED || idx < KP_GROUPS_DEFAULT_EXPANDED
	}
	return next
}

function ensureReviewKpExpanded(keys: string[]) {
	const signature = keys.map((key, idx) => `${idx}:${key}`).join('|')
	if (signature === reviewKpKeysSignature) return
	reviewKpKeysSignature = signature
	reviewKpExpanded.value = buildKpExpandedState(keys.length)
}

function ensureResultsKpExpanded(keys: string[]) {
	const signature = keys.map((key, idx) => `${idx}:${key}`).join('|')
	if (signature === resultsKpKeysSignature) return
	resultsKpKeysSignature = signature
	resultsKpExpanded.value = buildKpExpandedState(keys.length)
}

function isReviewKpExpanded(id: number) {
	return reviewKpExpanded.value[id] ?? true
}

function isResultsKpExpanded(id: number) {
	return resultsKpExpanded.value[id] ?? true
}

function toggleReviewKpExpand(id: number) {
	reviewKpExpanded.value = {
		...reviewKpExpanded.value,
		[id]: !isReviewKpExpanded(id),
	}
}

function toggleResultsKpExpand(id: number) {
	resultsKpExpanded.value = {
		...resultsKpExpanded.value,
		[id]: !isResultsKpExpanded(id),
	}
}

function inferProcessingPhase(data: TZAnalysisSession): 'tz' | 'kp' {
	const hasKpFiles = (data.kp_filenames?.length ?? 0) > 0
	const hasKpRequirements = Object.values(data.requirements_kp ?? {}).some(
		(items) => requirementsNonempty(items),
	)
	if (hasKpFiles || hasKpRequirements) return 'kp'
	return 'tz'
}

const isDraft = computed(() => analysis.value?.status === TZAnalysisRunStatus.DRAFT)
const isKpCompareProcessing = computed(() =>
	analysis.value?.status === TZAnalysisRunStatus.PROCESSING
	&& processingPhase.value === 'kp',
)
const processingQueueTitle = computed(() =>
	isKpCompareProcessing.value
		? 'Сравнение с КП поставлено в очередь'
		: 'Извлечение требований поставлено в очередь',
)
const processingStatusLabel = computed(() =>
	isKpCompareProcessing.value
		? 'Сравнение с коммерческими предложениями'
		: 'Извлечение требований из ТЗ',
)
const processingWaitHint = computed(() =>
	isKpCompareProcessing.value
		? 'Ожидайте результатов до 2 часов. Страница обновится автоматически.'
		: 'Ожидайте результатов до 15 минут. Страница обновится автоматически.',
)
const processingModalDescription = computed(() =>
	isKpCompareProcessing.value
		? 'Ожидайте результатов до 2 часов. Вы можете оставаться на этой странице — результаты появятся автоматически.'
		: 'Ожидайте результатов до 15 минут. Вы можете оставаться на этой странице — результаты появятся автоматически.',
)
const hasResults = computed(() =>
	analysis.value?.status === TZAnalysisRunStatus.ACTIVE
	|| analysis.value?.status === TZAnalysisRunStatus.COMPLETED,
)
const isTzReviewPhase = computed(() =>
	hasResults.value
	&& !analysis.value?.confirmed
	&& Object.keys(analysis.value?.requirements_kp ?? {}).length === 0,
)
const needsRequirementsReview = computed(() =>
	hasResults.value && !analysis.value?.confirmed && !isTzReviewPhase.value,
)
const hasConfirmedResults = computed(() =>
	hasResults.value && Boolean(analysis.value?.confirmed),
)
const suppliers = computed(() => analysis.value?.suppliers ?? [])
const showSuppliersSidebar = computed(() =>
	isTzReviewPhase.value
	|| needsRequirementsReview.value
	|| hasConfirmedResults.value,
)
const hasSuppliersWithFiles = computed(() =>
	suppliers.value.some((supplier) => supplier.kp_filenames.length > 0),
)
const primaryStatsSummary = computed(() => {
	const primary = analysis.value?.kp_filename
	const stats = primary && analysis.value?.kp_stats?.[primary]
	if (stats) return stats
	return {
		match_score: analysis.value?.match_score ?? 0,
		met_count: analysis.value?.met_count ?? 0,
		partial_count: analysis.value?.partial_count ?? 0,
		missing_count: analysis.value?.missing_count ?? 0,
		not_found_count: analysis.value?.not_found_count ?? 0,
	}
})
function findSupplierKpFileByFlatIndex(flatIndex: number) {
	let cursor = 0
	for (const supplier of suppliers.value) {
		for (const filename of supplier.kp_filenames) {
			if (cursor === flatIndex) {
				return { supplier, filename }
			}
			cursor++
		}
	}
	return null
}

function findSupplierKpFile(displayName: string) {
	const flatIndex = displayKpFilenames.value.indexOf(displayName)
	if (flatIndex < 0) return null
	return findSupplierKpFileByFlatIndex(flatIndex)
}

const visibleKpItemGroups = computed(() => {
	if (!selectedSupplierId.value || !hasConfirmedResults.value) {
		return kpItemGroups.value
	}
	let cursor = 0
	const allowedIndices = new Set<number>()
	for (const supplier of suppliers.value) {
		for (const _filename of supplier.kp_filenames) {
			if (supplier.id === selectedSupplierId.value) {
				allowedIndices.add(cursor)
			}
			cursor++
		}
	}
	return kpItemGroups.value.filter((group) => allowedIndices.has(group.id))
})
const statusColor = computed(() =>
	getTzRunStatusColor(analysis.value?.status ?? TZAnalysisRunStatus.DRAFT),
)
const statusLabel = computed(() =>
	getTzRunStatusLabel(analysis.value?.status ?? TZAnalysisRunStatus.DRAFT),
)

const filteredTzItems = computed((): TZItemView[] => {
	if (!analysis.value) return []
	return analysis.value.items
		.map((item, index) => ({ ...item, _index: index }))
		.filter((item) =>
			tzStatusFilter.value === 'all' || item.status === tzStatusFilter.value,
		)
})

const resultTreesByGroupId = computed(() => {
	const map = new Map<number, ReturnType<typeof buildResultTree>>()
	for (const group of kpItemGroups.value) {
		map.set(
			group.id,
			buildResultTree(analysis.value?.requirements_tz, group.items),
		)
	}
	return map
})

function getResultTreeForGroup(group: KpItemGroup) {
	return resultTreesByGroupId.value.get(group.id)
		?? buildResultTree(analysis.value?.requirements_tz, group.items)
}

const kpItemGroups = computed((): KpItemGroup[] => {
	const items = filteredTzItems.value
	if (items.length === 0) return []

	const filenames = displayKpFilenames.value
	const bucket = new Map<string, TZItemView[]>()

	for (const item of items) {
		const key = item.kp_name || filenames[0] || '_default'
		const list = bucket.get(key) ?? []
		list.push(item)
		bucket.set(key, list)
	}

	const orderedKeys: string[] = []
	for (const name of filenames) {
		if (bucket.has(name)) orderedKeys.push(name)
	}
	for (const key of bucket.keys()) {
		if (!orderedKeys.includes(key)) orderedKeys.push(key)
	}

	return orderedKeys.map((key, idx) => ({
		id: idx,
		key,
		label: key === '_default'
			? (filenames.length > 1 || orderedKeys.length > 1 ? `КП ${idx + 1}` : 'КП 1')
			: key,
		filename: key === '_default' ? null : key,
		items: bucket.get(key) ?? [],
	}))
})

function requirementWord(count: number) {
	const mod10 = count % 10
	const mod100 = count % 100
	if (mod10 === 1 && mod100 !== 11) return 'требование'
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
		return 'требования'
	}
	return 'требований'
}

function isItemExpanded(index: number) {
	return expandedItems.value.has(index)
}

function toggleItemExpand(index: number) {
	const next = new Set(expandedItems.value)
	if (next.has(index)) next.delete(index)
	else next.add(index)
	expandedItems.value = next
}

const displayKpFilenames = computed(() => {
	if (!analysis.value) return [] as string[]
	if (analysis.value.kp_filenames?.length) {
		return analysis.value.kp_filenames
	}
	if (analysis.value.kp_filename) {
		return [analysis.value.kp_filename]
	}
	return []
})

type KpRequirementsGroup = {
	id: number
	key: string
	label: string
	filename: string | null
	items: EditableRequirementRow[]
}

const kpRequirementsGroups = computed((): KpRequirementsGroup[] => {
	const filenames = displayKpFilenames.value
	const keys = filenames.length
		? filenames
		: Object.keys(editableRequirementsKp.value)

	return keys.map((key, idx) => ({
		id: idx,
		key,
		label: key === '_default'
			? (keys.length > 1 ? `КП ${idx + 1}` : 'КП 1')
			: key,
		filename: key === '_default' ? null : key,
		items: editableRequirementsKp.value[key] ?? [],
	}))
})

const hasMultipleLetterKps = computed(() => kpItemGroups.value.length > 1)

const primaryKpOptions = computed(() =>
	displayKpFilenames.value.map((filename) => ({
		label: filename,
		value: filename,
	})),
)

const primaryKpLabel = computed(() => {
	const primary = analysis.value?.kp_filename
	if (!primary) return null
	return primaryKpOptions.value.find((option) => option.value === primary)?.label
		?? primary
})

async function setPrimaryKp(kpFilename: string | null) {
	if (!analysis.value?.id || !kpFilename || primaryKpSaving.value) return
	if (kpFilename === analysis.value.kp_filename) return
	primaryKpSaving.value = true
	try {
		const updated = await patch<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/primary-kp`,
			{ kp_filename: kpFilename },
		)
		applyAnalysis(updated)
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось сменить основное КП',
			color: 'error',
		})
	} finally {
		primaryKpSaving.value = false
	}
}

function getItemKpKey(item: TZAnalysisItem): string {
	const filenames = displayKpFilenames.value
	return item.kp_name || filenames[0] || '_default'
}

function belongsToPrimaryKp(item: TZAnalysisItem): boolean {
	const primary = analysis.value?.kp_filename
	if (!primary || !hasMultipleLetterKps.value) return true
	return getItemKpKey(item) === primary
}

function getKpStats(kpKey: string): TZAnalysisKpStats | null {
	return analysis.value?.kp_stats?.[kpKey] ?? null
}

function selectPrimaryKpLetterItems(kpFilename: string | null | undefined) {
	if (!analysis.value || !kpFilename) return
	tzSelectedIndices.value = analysis.value.items
		.map((item, index) => ({ item, index }))
		.filter(({ item }) => getItemKpKey(item) === kpFilename && isTzSelectable(item.status))
		.map(({ index }) => index)
}

function collectResultsKpKeys(data: TZAnalysisSession): string[] {
	const filenames = data.kp_filenames?.length
		? data.kp_filenames
		: data.kp_filename
			? [data.kp_filename]
			: []
	const ordered: string[] = []
	const seen = new Set<string>()
	for (const name of filenames) {
		if (!seen.has(name)) {
			seen.add(name)
			ordered.push(name)
		}
	}
	for (const item of data.items) {
		const key = item.kp_name || filenames[0] || '_default'
		if (!seen.has(key)) {
			seen.add(key)
			ordered.push(key)
		}
	}
	return ordered
}

const editableTzCount = computed(() =>
	countRequirementRows(editableRequirementsTz.value),
)

const canConfirmRequirements = computed(() => {
	if (!requirementsRowsNonempty(editableRequirementsTz.value)) return false
	return kpRequirementsGroups.value.some((group) =>
		requirementsRowsNonempty(group.items),
	)
})

function syncEditableRequirements(data: TZAnalysisSession) {
	editableRequirementsTz.value = flattenRequirementsToRows(data.requirements_tz)
	const kpSource = data.requirements_kp ?? {}
	const filenames = data.kp_filenames?.length
		? data.kp_filenames
		: data.kp_filename
			? [data.kp_filename]
			: Object.keys(kpSource)
	editableRequirementsKp.value = Object.fromEntries(
		filenames.map((name) => [name, flattenRequirementsToRows(kpSource[name])]),
	)
	ensureReviewKpExpanded(filenames.length ? filenames : Object.keys(kpSource))
}

function normalizedRequirementsPayload(): TZRequirementsUpdateRequest {
	const requirements_tz = rowsToHierarchy(editableRequirementsTz.value)
	const requirements_kp = Object.fromEntries(
		Object.entries(editableRequirementsKp.value).map(([key, rows]) => [
			key,
			rowsToHierarchy(rows),
		]),
	)
	return { requirements_tz, requirements_kp }
}

function nextTopLevelKey(rows: EditableRequirementRow[]): string {
	const maxTop = rows.reduce((max, row) => {
		const top = Number(row.key.split(/[./]/)[0])
		return Number.isNaN(top) ? max : Math.max(max, top)
	}, 0)
	return String(maxTop + 1)
}

function addTzRequirement() {
	editableRequirementsTz.value = [
		...editableRequirementsTz.value,
		{ key: nextTopLevelKey(editableRequirementsTz.value), text: '' },
	]
}

function removeTzRequirement(index: number) {
	editableRequirementsTz.value = editableRequirementsTz.value.filter(
		(_, idx) => idx !== index,
	)
}

function addKpRequirement(kpKey: string) {
	const current = editableRequirementsKp.value[kpKey] ?? []
	editableRequirementsKp.value = {
		...editableRequirementsKp.value,
		[kpKey]: [
			...current,
			{ key: nextTopLevelKey(current), text: '' },
		],
	}
}

function removeKpRequirement(kpKey: string, index: number) {
	const current = editableRequirementsKp.value[kpKey] ?? []
	editableRequirementsKp.value = {
		...editableRequirementsKp.value,
		[kpKey]: current.filter((_, idx) => idx !== index),
	}
}

async function saveTzRequirements() {
	if (!analysis.value?.id || savingRequirements.value) return
	if (!requirementsRowsNonempty(editableRequirementsTz.value)) {
		toast.add({
			title: 'Добавьте хотя бы одно требование из ТЗ',
			color: 'warning',
		})
		return
	}

	savingRequirements.value = true
	try {
		const updated = await patch<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/requirements`,
			{ requirements_tz: rowsToHierarchy(editableRequirementsTz.value) },
		)
		syncEditableRequirements(updated)
		applyAnalysis(updated)
		toast.add({
			title: 'Требования сохранены',
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось сохранить',
			color: 'error',
		})
	} finally {
		savingRequirements.value = false
	}
}

async function saveRequirements() {
	if (!analysis.value?.id || savingRequirements.value) return
	const payload = normalizedRequirementsPayload()
	if (!requirementsRowsNonempty(editableRequirementsTz.value)) {
		toast.add({
			title: 'Добавьте хотя бы одно требование из ТЗ',
			color: 'warning',
		})
		return
	}

	savingRequirements.value = true
	try {
		const updated = await patch<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/requirements`,
			payload,
		)
		syncEditableRequirements(updated)
		applyAnalysis(updated)
		toast.add({
			title: 'Изменения сохранены',
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось сохранить',
			color: 'error',
		})
	} finally {
		savingRequirements.value = false
	}
}

const hasAnyKpFile = computed(() =>
	kpSlots.value.some((slot) => slot.file !== null),
)

const canRunKpAnalysis = computed(() =>
	requirementsRowsNonempty(editableRequirementsTz.value)
	&& hasSuppliersWithFiles.value,
)

function openKpFileForGroup(group: KpRequirementsGroup) {
	if (!group.filename) return
	const match = findSupplierKpFile(group.filename)
	if (match) {
		openKpFile(match.filename, match.supplier.id)
		return
	}
	openKpFile(group.filename)
}

async function refreshAnalysis() {
	if (!analysis.value?.id) return
	try {
		const data = await get<TZAnalysisSession>(`/tz-analysis/${analysis.value.id}`)
		applyAnalysis(data)
	} catch {
		toast.add({ title: 'Не удалось обновить анализ', color: 'error' })
	}
}

const selectedLetterItems = computed((): TZItemView[] => {
	if (!analysis.value) return []
	return analysis.value.items
		.map((item, index) => ({ ...item, _index: index }))
		.filter((item) =>
			tzSelectedIndices.value.includes(item._index) && isTzSelectable(item.status),
		)
})

const letterModalMismatchItems = computed((): TZItemView[] => {
	if (!analysis.value) return []
	return analysis.value.items
		.map((item, index) => ({ ...item, _index: index }))
		.filter((item) =>
			belongsToPrimaryKp(item)
			&& (item.status === 'missing' || item.status === 'not_found'),
		)
})

const letterModalPartialItems = computed((): TZItemView[] => {
	if (!analysis.value) return []
	return analysis.value.items
		.map((item, index) => ({ ...item, _index: index }))
		.filter((item) => belongsToPrimaryKp(item) && item.status === 'partial')
})

const letterItemsByTab = computed(() => ({
	mismatch: selectedLetterItems.value.filter((item) =>
		item.status === 'missing' || item.status === 'not_found',
	),
	partial: selectedLetterItems.value.filter((item) => item.status === 'partial'),
}))

const letterPreviewTabs = computed(() => {
	const mismatchSelected = letterItemsByTab.value.mismatch.length
	const partialSelected = letterItemsByTab.value.partial.length
	return [
		{
			label: mismatchSelected
				? `Не совпадает (${mismatchSelected})`
				: 'Не совпадает',
			value: 'mismatch',
			color: 'error' as const,
			disabled: letterModalMismatchItems.value.length === 0,
		},
		{
			label: partialSelected
				? `Частично совпадает (${partialSelected})`
				: 'Частично совпадает',
			value: 'partial',
			color: 'warning' as const,
			disabled: letterModalPartialItems.value.length === 0,
		},
	]
})

type LetterBlock = {
	sectionId?: string
	isTitle?: boolean
	paragraphs: string[]
}

function buildDraftLetterParagraphs(): string[] {
	const { mismatch, partial } = letterItemsByTab.value
	const lines: string[] = [
		'О несоответствии предложения техническим требованиям',
		'',
		'Проведён анализ вашего предложения по соответствию техническому заданию.',
		'Выявлены следующие замечания и требуемые уточнения:',
	]

	if (mismatch.length) {
		lines.push('', LETTER_MISMATCH_HEADER)
		for (const [idx, item] of mismatch.entries()) {
			lines.push(`${idx + 1}. По пункту:`)
			lines.push(
				`Требование: "${item.requirement}"`
				+ (item.requirement_ref ? ` (${item.requirement_ref})` : ''),
			)
			if (item.offer_value) {
				lines.push(
					`Предложено: "${item.offer_value}"`
					+ (item.offer_ref ? ` (${item.offer_ref})` : ''),
				)
			}
			lines.push(`Причина отклонения: ${item.explanation}`)
		}
	}

	if (partial.length) {
		lines.push('', LETTER_PARTIAL_HEADER)
		const start = mismatch.length + 1
		for (const [offset, item] of partial.entries()) {
			const n = start + offset
			lines.push(`${n}. Пункт:`)
			lines.push(
				`Требуется: "${item.requirement}"`
				+ (item.requirement_ref ? ` (${item.requirement_ref})` : ''),
			)
			if (item.offer_value) {
				lines.push(
					`Предложено: "${item.offer_value}"`
					+ (item.offer_ref ? ` (${item.offer_ref})` : ''),
				)
			}
			lines.push(`Необходимо: ${item.explanation}`)
		}
	}

	const deadline = docxDeadline.value.trim() || '7 дней'
	lines.push(
		'',
		`Просим предоставить дополненное/уточненное предложение не позже ${deadline}.`,
		'',
		'С уважением,',
		'',
		docxOrganization.value.trim() || '[Наименование организации]',
	)
	return lines
}

const fullLetterBlocks = computed((): LetterBlock[] => {
	const title = letterPreview.value?.title
		?? 'О несоответствии предложения техническим требованиям'
	const paragraphs = letterPreview.value?.paragraphs.length
		? letterPreview.value.paragraphs
		: buildDraftLetterParagraphs()

	if (!paragraphs.length) return []

	const blocks: LetterBlock[] = []
	let sectionId: string | undefined
	let buffer: string[] = []

	const flush = () => {
		if (!buffer.length) return
		blocks.push({
			sectionId,
			paragraphs: [...buffer],
		})
		buffer = []
	}

	for (const paragraph of paragraphs) {
		if (paragraph === title) {
			flush()
			sectionId = undefined
			blocks.push({ isTitle: true, paragraphs: [paragraph] })
			continue
		}
		if (paragraph === LETTER_MISMATCH_HEADER) {
			flush()
			sectionId = 'letter-section-mismatch'
			buffer = [paragraph]
			continue
		}
		if (paragraph === LETTER_PARTIAL_HEADER) {
			flush()
			sectionId = 'letter-section-partial'
			buffer = [paragraph]
			continue
		}
		if (paragraph.startsWith('Просим предоставить')) {
			flush()
			sectionId = undefined
			buffer = [paragraph]
			continue
		}
		buffer.push(paragraph)
	}
	flush()

	return blocks
})

function letterParagraphClass(paragraph: string, isTitle?: boolean) {
	if (isTitle) return 'font-semibold text-center text-base mb-3 text-highlighted'
	if (paragraph.endsWith(':')) return 'font-semibold mt-4 first:mt-0 text-highlighted'
	return 'text-default/90'
}

function scrollToLetterSection(section: 'mismatch' | 'partial') {
	const tab = letterPreviewTabs.value.find((t) => t.value === section)
	if (tab?.disabled) return
	letterPreviewTab.value = section
	nextTick(() => {
		const root = letterDocumentRef.value
		const target = root?.querySelector(`#letter-section-${section}`)
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	})
}

function applyAnalysis(data: TZAnalysisSession) {
	analysis.value = data
	syncEditableRequirements(data)
	if (data.status === TZAnalysisRunStatus.PROCESSING) {
		processingPhase.value = inferProcessingPhase(data)
		tzPolling.value = true
	}
	if (
		data.status === TZAnalysisRunStatus.ACTIVE
		&& !data.confirmed
		&& Object.keys(data.requirements_kp ?? {}).length === 0
	) {
		kpSlots.value = [{ id: ++kpSlotCounter, file: null }]
	}
	if (data.status === TZAnalysisRunStatus.ACTIVE && data.confirmed) {
		ensureResultsKpExpanded(collectResultsKpKeys(data))
		selectPrimaryKpLetterItems(data.kp_filename)
	}
}

async function fetchAnalysis() {
	loading.value = true
	try {
		const data = await get<TZAnalysisSession>(`/tz-analysis/${id.value}`)
		applyAnalysis(data)
	} catch {
		if (import.meta.client) {
			toast.add({ title: 'Анализ не найден', color: 'error' })
			await navigateTo('/tz-analysis/history')
		}
	} finally {
		loading.value = false
	}
}

useRunStatusPolling(
	tzPolling,
	async () => get<TZAnalysisSession>(`/tz-analysis/${id.value}`),
	(data: TZAnalysisSession) => { applyAnalysis(data) },
	() => {
		const title = analysis.value?.confirmed
			? 'Сравнение ТЗ и КП завершено'
			: 'Извлечение требований завершено'
		toast.add({
			title,
			color: 'success',
			icon: 'i-lucide-check',
		})
	},
	() => {
		toast.add({
			title: 'Ошибка анализа ТЗ',
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	},
)

let previewDebounce: ReturnType<typeof setTimeout> | null = null

async function fetchLetterPreview() {
	if (!showLetterModal.value || !analysis.value?.id) {
		letterPreview.value = null
		return
	}
	if (!docxOrganization.value.trim() || tzSelectedIndices.value.length === 0) {
		letterPreview.value = null
		return
	}

	previewLoading.value = true
	try {
		letterPreview.value = await post<TZAnalysisPreviewResponse>(
			`/tz-analysis/${analysis.value.id}/preview`,
			{
				selected_indices: tzSelectedIndices.value,
				organization: docxOrganization.value.trim(),
				deadline_date: docxDeadline.value.trim() || null,
			},
		)
	} catch {
		letterPreview.value = null
	} finally {
		previewLoading.value = false
	}
}

watch(
	[showLetterModal, docxOrganization, docxDeadline, tzSelectedIndices],
	() => {
		if (!showLetterModal.value) return
		if (previewDebounce) clearTimeout(previewDebounce)
		previewDebounce = setTimeout(() => { fetchLetterPreview() }, 300)
	},
	{ deep: true },
)

watch(showLetterModal, (open) => {
	if (!open) {
		letterPreview.value = null
		return
	}
	const { mismatch, partial } = letterItemsByTab.value
	if (mismatch.length > 0) letterPreviewTab.value = 'mismatch'
	else if (partial.length > 0) letterPreviewTab.value = 'partial'
})

watch(tzSelectedIndices, () => {
	if (!showLetterModal.value) return
	const { mismatch, partial } = letterItemsByTab.value
	const onMismatch = letterPreviewTab.value === 'mismatch'
	if (onMismatch && mismatch.length === 0 && partial.length > 0) {
		letterPreviewTab.value = 'partial'
	}
	if (!onMismatch && partial.length === 0 && mismatch.length > 0) {
		letterPreviewTab.value = 'mismatch'
	}
}, { deep: true })

async function loadDefaultOrganization() {
	try {
		const me = await get<UserResponse>('/auth/me')
		const name = me.company_name?.trim()
		if (name && !docxOrganization.value.trim()) {
			docxOrganization.value = name
		}
	} catch {
		// profile optional for letter draft
	}
}

onMounted(() => {
	fetchAnalysis()
	loadDefaultOrganization()
})

function validateAndSetFile(
	file: File | null | undefined,
	target: Ref<File | null>,
) {
	if (!file) {
		target.value = null
		return
	}
	if (file.size > MAX_UPLOAD_SIZE) {
		const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)
		toast.add({
			title: 'Файл слишком большой',
			description: `${file.name} превышает ${sizeMb} МБ`,
			color: 'error',
		})
		target.value = null
		return
	}
	target.value = file
}

function onTzFileChange(file: File | null | undefined) {
	validateAndSetFile(file, tzFile)
}

function addKpSlot() {
	kpSlots.value = [...kpSlots.value, { id: ++kpSlotCounter, file: null }]
}

function removeKpSlot(slotId: number) {
	if (kpSlots.value.length <= 1) return
	kpSlots.value = kpSlots.value.filter((slot) => slot.id !== slotId)
}

function onKpSlotChange(slotId: number, file: File | null | undefined) {
	const slot = kpSlots.value.find((s) => s.id === slotId)
	if (!slot) return
	if (!file) {
		slot.file = null
		return
	}
	if (file.size > MAX_UPLOAD_SIZE) {
		const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)
		toast.add({
			title: 'Файл слишком большой',
			description: `${file.name} превышает ${sizeMb} МБ`,
			color: 'error',
		})
		slot.file = null
		return
	}
	slot.file = file
}

async function confirmAnalysis() {
	if (!analysis.value?.id || confirming.value || !canConfirmRequirements.value) return
	const payload: TZAnalysisConfirmRequest = normalizedRequirementsPayload()
	confirming.value = true
	try {
		const updated = await post<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/confirm`,
			payload,
		)
		applyAnalysis(updated)
		if (updated.status === TZAnalysisRunStatus.PROCESSING) {
			processingPhase.value = 'kp'
			tzPolling.value = true
		}
		toast.add({
			title: 'Сравнение поставлено в очередь',
			description: 'Результаты появятся автоматически после завершения.',
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось подтвердить',
			color: 'error',
		})
	} finally {
		confirming.value = false
	}
}

async function runTzAnalysis() {
	if (!tzFile.value || !analysis.value?.id) return
	tzAnalyzing.value = true
	try {
		const fd = new FormData()
		fd.append('tz_file', tzFile.value)
		const result = await post<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/run`,
			fd,
		)
		tzSelectedIndices.value = []
		processingPhase.value = 'tz'
		applyAnalysis(result)
		if (result.status === TZAnalysisRunStatus.PROCESSING) {
			showQueueModal.value = true
			tzPolling.value = true
		}
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Ошибка запуска анализа',
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	} finally {
		tzAnalyzing.value = false
	}
}

async function runKpAnalysis() {
	if (!analysis.value?.id || kpAnalyzing.value || !canRunKpAnalysis.value) return
	kpAnalyzing.value = true
	try {
		if (!requirementsRowsNonempty(editableRequirementsTz.value)) {
			toast.add({
				title: 'Добавьте хотя бы одно требование из ТЗ',
				color: 'warning',
			})
			return
		}

		await patch<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/requirements`,
			{ requirements_tz: rowsToHierarchy(editableRequirementsTz.value) },
		)

		let result: TZAnalysisSession
		result = await post<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/run-kp`,
			new FormData(),
		)
		tzSelectedIndices.value = []
		processingPhase.value = 'kp'
		applyAnalysis(result)
		if (result.status === TZAnalysisRunStatus.PROCESSING) {
			showQueueModal.value = true
			tzPolling.value = true
		}
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Ошибка запуска анализа КП',
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	} finally {
		kpAnalyzing.value = false
	}
}

function openLetterModal() {
	if (tzSelectedIndices.value.length === 0) {
		toast.add({
			title: 'Выберите пункты',
			description: 'Отметьте галочками несоответствия для письма поставщику.',
			color: 'warning',
		})
		return
	}
	const { mismatch, partial } = letterItemsByTab.value
	letterPreviewTab.value = mismatch.length > 0 ? 'mismatch' : 'partial'
	showLetterModal.value = true
	nextTick(() => {
		if (!docxOrganization.value.trim()) {
			const input = docxOrganizationInput.value?.$el ?? docxOrganizationInput.value
			if (input && 'focus' in input) {
				(input as HTMLElement).focus()
			}
		} else {
			fetchLetterPreview()
		}
	})
}

function isTzSelectable(status: TZAnalysisStatus) {
	return status === 'partial' || status === 'missing' || status === 'not_found'
}

function toggleTzSelect(index: number, checked: boolean) {
	if (checked) {
		if (!tzSelectedIndices.value.includes(index)) {
			tzSelectedIndices.value = [...tzSelectedIndices.value, index]
		}
	} else {
		tzSelectedIndices.value = tzSelectedIndices.value.filter((i) => i !== index)
	}
}

async function downloadBlob(url: string, filename: string) {
	const res = await $axios.get(url, { responseType: 'blob' })
	const blob = res.data as Blob
	const objectUrl = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = objectUrl
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	URL.revokeObjectURL(objectUrl)
}

async function exportTzCsv() {
	if (!analysis.value?.id) return
	await downloadBlob(
		`/tz-analysis/${analysis.value.id}/export.csv`,
		`tz_analysis_${analysis.value.id}.csv`,
	)
}

async function generateDocx() {
	if (!analysis.value?.id || !docxOrganization.value.trim()) return
	docxGenerating.value = true
	try {
		const res = await $axios.post(
			`/tz-analysis/${analysis.value.id}/docx`,
			{
				selected_indices: tzSelectedIndices.value,
				organization: docxOrganization.value.trim(),
				deadline_date: docxDeadline.value.trim() || null,
			},
			{ responseType: 'blob' },
		)
		const blob = res.data as Blob
		const objectUrl = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = objectUrl
		a.download = `clarification_${analysis.value.id}.docx`
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(objectUrl)
		toast.add({ title: 'DOCX сформирован', color: 'success', icon: 'i-lucide-check' })
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Ошибка генерации DOCX',
			color: 'error',
		})
	} finally {
		docxGenerating.value = false
	}
}
</script>
