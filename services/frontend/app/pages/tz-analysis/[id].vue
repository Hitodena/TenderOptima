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

			<template v-else-if="analysis.status === TZAnalysisRunStatus.PROCESSING && processingPhase === 'tz'">
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

			<template v-else-if="isTzReviewPhase || hasConfirmedResults || kpAnalysisStarted">
				<UAlert
					v-if="isCompleted && hasKpContent && !hasSuppliersProcessing"
					color="neutral"
					variant="soft"
					icon="i-lucide-archive"
					class="mb-6"
					title="Анализ завершён"
					description="Просмотр результатов доступен. Добавление и удаление поставщиков недоступны."
				/>
				<UAlert
					v-else-if="isAnalysisClosed"
					color="neutral"
					variant="soft"
					icon="i-lucide-lock"
					class="mb-6"
					title="Анализ завершён"
					description="Сравнение с КП не выполнялось. Добавление поставщиков и запуск анализа КП недоступны."
				/>

				<UTabs
					:model-value="activeContentTab"
					:items="visibleContentTabItems"
					:ui="{ list: 'mb-6' }"
					@update:model-value="onContentTabChange"
				>
					<template #tz>
						<div v-if="contentTabLoading" class="space-y-4 min-h-[40vh]">
							<USkeleton class="h-24 w-full" />
							<USkeleton class="h-64 w-full" />
						</div>
						<div v-else>
						<div v-if="isTzReviewPhase && !isAnalysisClosed"
							class="mb-6 rounded-xl border border-warning/25 bg-warning/10 p-4 sm:p-5">
							<div class="flex gap-3 min-w-0">
								<UIcon name="i-lucide-info" class="w-5 h-5 shrink-0 text-warning mt-0.5" />
								<div class="min-w-0 space-y-1">
									<p class="text-sm font-semibold text-highlighted">
										Проверьте извлечённые требования
									</p>
									<p class="text-sm text-muted">
										Система извлекла требования из ТЗ. Удалите лишние пункты,
										добавьте недостающие, затем добавьте поставщиков с КП
										для сравнения.
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

							<div class="overflow-y-auto pr-1">
								<RequirementTreeEditor v-if="editableTzCount > 0" :rows="editableRequirementsTz"
									:scope-id="hasConfirmedResults ? 'tz-results' : 'tz-review'"
									:readonly="hasConfirmedResults || isCompleted" show-heading-hint
									@remove="removeTzRequirement"
									@add-child="addTzChildRequirement"
									@add-heading="addTzHeadingRequirement" />
								<p v-else class="text-sm text-muted text-center py-4">
									Нет извлечённых требований
								</p>
							</div>

							<template v-if="!hasConfirmedResults && !isCompleted" #footer>
								<UButton type="button" variant="outline" size="sm" leading-icon="i-lucide-plus"
									@click="addTzRequirement">
									Добавить требование
								</UButton>
							</template>
						</UCard>
						</div>
					</template>

					<template #kp>
						<div v-if="contentTabLoading" class="space-y-4 min-h-[40vh]">
							<USkeleton class="h-24 w-full" />
							<USkeleton class="h-64 w-full" />
							<USkeleton class="h-48 w-full" />
						</div>
						<div v-else class="grid grid-cols-1 gap-6" :class="showSuppliersSidebar && !isTzReviewPhase
							? 'xl:grid-cols-[16rem_minmax(0,1fr)]'
							: ''">
							<TzAnalysisSuppliersPanel v-if="showSuppliersSidebar && analysis?.id"
								:analysis-id="analysis.id" :suppliers="suppliers" :file-accept="fileAccept"
								:readonly="isCompleted || isAnalysisClosed"
								:selected-supplier-id="selectedSupplierId" :compact="!isTzReviewPhase"
								@select="selectedSupplierId = $event"
								@open-kp="({ supplierId, filename }) => openKpFile(filename, supplierId)"
								@updated="refreshAnalysis" />

							<div class="min-w-0 space-y-6">
								<UCard
									v-if="hasSuppliersProcessing && !isTzReviewPhase"
									class="shadow-sm"
								>
									<div class="flex items-center gap-3 py-4 text-muted">
										<UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin text-warning shrink-0" />
										<p class="text-sm">
											Анализ коммерческих предложений выполняется. Раздел ТЗ доступен для просмотра.
										</p>
									</div>
								</UCard>

								<UCard
									v-if="selectedSupplier && !hasConfirmedResults && !isAnalysisClosed"
									class="shadow-sm"
								>
									<template #header>
										<div class="flex items-center justify-between gap-2">
											<p class="font-semibold text-sm">
												КП — {{ selectedSupplier.name }}
											</p>
											<UBadge
												v-if="selectedSupplier.status === TZAnalysisSupplierStatus.PROCESSING"
												color="warning"
												variant="subtle"
												size="xs"
											>
												Обрабатывается
											</UBadge>
										</div>
									</template>
									<div
										v-if="selectedSupplier.kp_filenames.length"
										class="space-y-2"
									>
										<button
											v-for="filename in selectedSupplier.kp_filenames"
											:key="`${selectedSupplier.id}-${filename}`"
											type="button"
											class="flex items-center gap-2 text-sm text-primary hover:underline text-left"
											@click="openKpFile(filename, selectedSupplier.id)"
										>
											<UIcon name="i-lucide-file-spreadsheet" class="w-4 h-4 shrink-0" />
											<span class="truncate">{{ filename }}</span>
										</button>
									</div>
									<p v-else class="text-sm text-muted">
										Нет загруженных файлов КП
									</p>
								</UCard>

								<template v-if="isAnalysisClosed">
									<UAlert color="neutral" variant="soft" icon="i-lucide-lock"
										description="Анализ завершён без сравнения с КП. Этот раздел недоступен." />
								</template>

								<template v-else-if="isTzReviewPhase && !isCompleted">
									<div class="flex flex-wrap items-center gap-2">
										<UButton color="warning" variant="solid" :loading="kpAnalyzing"
											:disabled="!canRunKpAnalysis" @click="runKpAnalysis">
											Запустить анализ КП
										</UButton>
										<p v-if="!canRunKpAnalysis" class="text-xs text-muted">
											Добавьте хотя бы одного поставщика с файлами КП
										</p>
									</div>
								</template>

								<template v-else-if="isCompleted && isTzReviewPhase">
									<UAlert color="neutral" variant="soft" icon="i-lucide-archive"
										description="Сравнение с КП не выполнялось. Анализ завершён — запуск сравнения недоступен." />
								</template>

								<template v-else-if="hasConfirmedResults">
									<div
										v-if="hasPendingSuppliers && !isCompleted"
										class="flex flex-wrap items-center gap-2"
									>
										<UButton
											color="warning"
											variant="solid"
											:loading="kpAnalyzing"
											:disabled="!canRunKpAnalysis"
											@click="runKpAnalysis"
										>
											Запустить анализ КП для новых поставщиков
										</UButton>
									</div>

									<div class="flex flex-wrap items-end justify-between gap-4">
										<div class="space-y-2">
											<p
												v-if="selectedSupplier"
												class="text-sm text-muted"
											>
												Поставщик:
												<span class="font-medium text-default">
													{{ selectedSupplier.name }}
												</span>
											</p>
											<UFormField
												v-if="selectedSupplier?.kp_filenames.length"
												label="Основное КП"
												class="mb-0"
											>
												<USelect
													v-if="hasMultipleSelectedSupplierKps"
													:model-value="selectedSupplierPrimaryKp ?? undefined"
													:items="selectedSupplierKpOptions"
													:loading="primaryKpSaving"
													size="sm"
													class="min-w-56"
													@update:model-value="setPrimaryKp"
												/>
												<button
													v-else-if="selectedSupplierPrimaryKpLabel && selectedSupplier"
													type="button"
													class="text-sm text-primary hover:underline text-left"
													@click="openKpFile(
														selectedSupplierPrimaryKpLabel,
														selectedSupplier.id,
													)"
												>
													{{ selectedSupplierPrimaryKpLabel }}
												</button>
											</UFormField>
										</div>
										<div class="flex flex-wrap items-center gap-2">
											<UBadge color="primary" variant="subtle" size="lg">
												{{ selectedSupplierStats.match_score }}% соответствия
												<span
													v-if="hasMultipleSelectedSupplierKps"
													class="opacity-80"
												>· основное КП</span>
											</UBadge>
											<UBadge color="success" variant="subtle">
												{{ selectedSupplierStats.met_count }} ок
											</UBadge>
											<UBadge color="warning" variant="subtle">
												{{ selectedSupplierStats.partial_count }} частично
											</UBadge>
											<UBadge color="error" variant="subtle">
												{{ selectedSupplierStats.missing_count }} нет
											</UBadge>
											<UBadge color="neutral" variant="subtle">
												{{ selectedSupplierStats.not_found_count }} не найдено
											</UBadge>
										</div>
									</div>

									<UCard class="shadow-sm w-full">
										<template #header>
											<div class="flex flex-col gap-3 w-full">
												<div class="flex flex-wrap items-center justify-between gap-3 w-full">
													<p class="font-semibold text-sm">Соответствия и несоответствия</p>
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
												</div>
												<UFormField label="Фильтр" class="mb-0">
													<USelect v-model="tzStatusFilter" :items="tzFilterOptions" size="sm"
														class="min-w-40" />
												</UFormField>
											</div>
										</template>

										<div class="min-h-[55vh] max-h-[85vh] overflow-y-auto pr-1 space-y-8">
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
														:editable="canEditItemStatuses"
														:is-item-overridden="isItemOverridden"
														@toggle-select="toggleTzSelect"
														@status-change="updateItemStatus" />
												</div>
											</section>

											<p v-if="visibleKpItemGroups.length === 0"
												class="text-sm text-muted text-center py-8">
												<template v-if="selectedSupplier">
													Нет результатов для поставщика «{{ selectedSupplier.name }}»
												</template>
												<template v-else>
													Выберите поставщика в списке слева
												</template>
											</p>
										</div>
									</UCard>
								</template>
							</div>
						</div>
					</template>
				</UTabs>
			</template>
		</template>

		<UModal v-model:open="showLetterModal" title="Письмо поставщику"
			description="Письмо формируется по основному КП. Снимите галочки у пунктов, которые не нужно включать."
			:ui="{ content: 'sm:max-w-4xl' }">
			<template #body>
				<div class="grid grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)] gap-5 min-h-0">
					<aside class="flex flex-col gap-4 min-h-0 md:max-h-[62vh]">
						<div class="space-y-3 shrink-0">
							<p v-if="selectedSupplier" class="text-xs text-muted">
									Поставщик:
									<span class="text-default font-medium">{{ selectedSupplier.name }}</span>
									<span v-if="primaryKpLabel"> · КП: </span>
									<button
										v-if="selectedSupplierPrimaryKp"
										type="button"
										class="text-primary hover:underline font-medium"
										@click="openKpFile(
											kpDisplayLabel(selectedSupplierPrimaryKp),
											selectedSupplier.id,
										)"
									>
										{{ primaryKpLabel }}
									</button>
								</p>
								<p v-else-if="primaryKpLabel" class="text-xs text-muted">
									Основное КП:
									<button v-if="analysis?.kp_filename" type="button"
										class="text-primary hover:underline font-medium"
										@click="openKpFile(analysis.kp_filename)">
										{{ primaryKpLabel }}
									</button>
									<span v-else class="text-default font-medium">{{ primaryKpLabel }}</span>
								</p>
								<UFormField label="Срок ответа">
									<UInput v-model="docxDeadline" placeholder="7 июня 2026 г." size="md" />
								</UFormField>
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
								<div v-if="letterModalMismatchItems.length" id="letter-sidebar-mismatch" class="space-y-2">
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

								<div v-if="letterModalPartialItems.length" id="letter-sidebar-partial" class="space-y-2">
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

						<div ref="letterDocumentRef" class="relative min-h-[58vh]">
							<UTextarea
								v-if="tzSelectedIndices.length > 0"
								ref="letterTextareaRef"
								v-model="letterEditorText"
								class="w-full"
								:ui="{ base: 'h-[58vh] resize-none overflow-y-auto font-[inherit] leading-relaxed' }"
								size="md"
								:rows="20"
								@update:model-value="onLetterEditorInput"
							/>
							<p v-else class="text-sm text-muted text-center py-10 rounded-xl border border-default bg-elevated/30">
								Выберите пункты для формирования письма
							</p>
						</div>
					</div>
			</template>
			<template #footer>
				<div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
					<UButton variant="outline" color="neutral" @click="showLetterModal = false">
						Закрыть
					</UButton>
					<UButton leading-icon="i-lucide-download" :loading="docxGenerating"
						:disabled="tzSelectedIndices.length === 0 || !letterEditorText.trim()" @click="generateDocx">
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
	TZAnalysisItem,
	TZAnalysisKpStats,
	TZAnalysisSession,
	TZAnalysisStatus,
	TZAnalysisSupplierItem,
} from '#shared/types'
import {
	getTzItemStatusColor,
	getTzRunStatusColor,
	getTzRunStatusLabel,
	TZAnalysisRunStatus,
	TZAnalysisSupplierStatus,
} from '#shared/types'
import {
	isKpScopedToSupplier,
	kpDisplayLabel,
	parseScopedKpName,
	scopedKpDisplayName,
	supplierKpScopedPrefix,
} from '#shared/utils/kpDisplay'
import {
	buildResultTree,
	countRequirementRows,
	flattenRequirementsToRows,
	nextChildKey,
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
const { formatDate, formatLetterDate } = useFormatDate()
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
const contentTabLoading = ref(false)
const userPickedContentTab = ref(false)
const selectedSupplierId = ref<string | null>(null)
const contentTabItems = [
	{ label: 'ТЗ', value: 'tz', slot: 'tz', icon: 'i-lucide-file-text' },
	{ label: 'КП / Результаты', value: 'kp', slot: 'kp', icon: 'i-lucide-file-spreadsheet' },
]
const tzFile = ref<File | null>(null)
const kpSlots = ref<KpSlot[]>([{ id: ++kpSlotCounter, file: null }])
const tzAnalyzing = ref(false)
const kpAnalyzing = ref(false)
const tzPolling = ref(false)
const tzSelectedIndices = ref<number[]>([])
const tzStatusFilter = ref('all')
const showLetterModal = ref(false)
const letterPreviewTab = ref('mismatch')
const processingPhase = ref<'tz' | 'kp'>('tz')
const itemsOverrides = ref<Record<string, { status: TZAnalysisStatus }>>({})
const primaryKpSaving = ref(false)
const editableRequirementsTz = ref<EditableRequirementRow[]>([])
const editableRequirementsKp = ref<Record<string, EditableRequirementRow[]>>({})
const docxDeadline = ref('')
const docxGenerating = ref(false)
const letterEditorText = ref('')
const letterEditorDirty = ref(false)
const letterDocumentRef = ref<HTMLElement | null>(null)
const letterTextareaRef = ref<{ $el?: HTMLElement } | null>(null)

const LETTER_MISMATCH_HEADER = 'Несоответствующие параметры:'
const LETTER_PARTIAL_HEADER = 'Требуют уточнения/дополнения:'
const LETTER_DEADLINE_PREFIX =
	'Просим предоставить дополненное/уточненное предложение не позже '

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
const resultsKpExpanded = ref<Record<number, boolean>>({})

let resultsKpKeysSignature = ''

const KP_GROUPS_DEFAULT_EXPANDED = 2

function buildKpExpandedState(count: number): Record<number, boolean> {
	const next: Record<number, boolean> = {}
	for (let idx = 0; idx < count; idx++) {
		next[idx] = count <= KP_GROUPS_DEFAULT_EXPANDED || idx < KP_GROUPS_DEFAULT_EXPANDED
	}
	return next
}

function ensureResultsKpExpanded(keys: string[]) {
	const signature = keys.map((key, idx) => `${idx}:${key}`).join('|')
	if (signature === resultsKpKeysSignature) return
	resultsKpKeysSignature = signature
	resultsKpExpanded.value = buildKpExpandedState(keys.length)
}

function isResultsKpExpanded(id: number) {
	return resultsKpExpanded.value[id] ?? true
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
const processingStatusLabel = computed(() => 'Извлечение требований из ТЗ')
const processingWaitHint = computed(() =>
	'Ожидайте результатов до 15 минут. Страница обновится автоматически.',
)
const hasResults = computed(() =>
	analysis.value?.status === TZAnalysisRunStatus.ACTIVE
	|| analysis.value?.status === TZAnalysisRunStatus.COMPLETED,
)
const suppliers = computed(() => analysis.value?.suppliers ?? [])
const hasSuppliersProcessing = computed(() =>
	suppliers.value.some(
		(supplier) => supplier.status === TZAnalysisSupplierStatus.PROCESSING,
	),
)
const kpAnalysisStarted = computed(() =>
	hasSuppliersProcessing.value
	|| suppliers.value.some(
		(supplier) =>
			supplier.status === TZAnalysisSupplierStatus.COMPLETED
			|| supplier.status === TZAnalysisSupplierStatus.FAILED,
	)
	|| (analysis.value?.items?.length ?? 0) > 0,
)
const isTzReviewPhase = computed(() =>
	hasResults.value
	&& !analysis.value?.confirmed
	&& Object.keys(analysis.value?.requirements_kp ?? {}).length === 0
	&& !kpAnalysisStarted.value,
)
const hasConfirmedResults = computed(() =>
	hasResults.value && Boolean(analysis.value?.confirmed),
)
const isCompleted = computed(() =>
	analysis.value?.status === TZAnalysisRunStatus.COMPLETED,
)
const hasSuppliersWithFiles = computed(() =>
	suppliers.value.some((supplier) => supplier.kp_filenames.length > 0),
)

const hasPendingSuppliers = computed(() =>
	suppliers.value.some(
		(supplier) =>
			(supplier.status === TZAnalysisSupplierStatus.PENDING
				|| supplier.status === TZAnalysisSupplierStatus.FAILED)
			&& supplier.kp_filenames.length > 0,
	),
)

const selectedSupplier = computed(() =>
	suppliers.value.find((entry) => entry.id === selectedSupplierId.value) ?? null,
)

const selectedSupplierKpKeys = computed(() => {
	const supplier = selectedSupplier.value
	if (!supplier) return [] as string[]
	const prefix = supplierKpScopedPrefix(supplier.name)
	return displayKpFilenames.value.filter((name) => name.startsWith(prefix))
})

const selectedSupplierKpOptions = computed(() => {
	const supplier = selectedSupplier.value
	if (!supplier) return []
	return supplier.kp_filenames.map((filename) => ({
		label: filename,
		value: scopedKpDisplayName(supplier.name, filename),
	}))
})

function selectedSupplierRawPrimaryFilename(supplier: TZAnalysisSupplierItem) {
	if (supplier.primary_kp_filename
		&& supplier.kp_filenames.includes(supplier.primary_kp_filename)) {
		return supplier.primary_kp_filename
	}
	return supplier.kp_filenames[0] ?? null
}

const selectedSupplierPrimaryKp = computed(() => {
	const supplier = selectedSupplier.value
	if (!supplier) return null
	const filename = selectedSupplierRawPrimaryFilename(supplier)
	if (!filename) return null
	return scopedKpDisplayName(supplier.name, filename)
})

const selectedSupplierPrimaryKpLabel = computed(() => {
	const supplier = selectedSupplier.value
	if (!supplier) return null
	return selectedSupplierRawPrimaryFilename(supplier)
})

const hasMultipleSelectedSupplierKps = computed(() =>
	(selectedSupplier.value?.kp_filenames.length ?? 0) > 1,
)

function ensureSelectedSupplier() {
	const list = suppliers.value
	if (list.length === 0) {
		selectedSupplierId.value = null
		return
	}
	if (
		!selectedSupplierId.value
		|| !list.some((entry) => entry.id === selectedSupplierId.value)
	) {
		selectedSupplierId.value = list[0]!.id
	}
}

const hasKpContent = computed(() => {
	if (!analysis.value) return false
	if (analysis.value.confirmed && (analysis.value.items?.length ?? 0) > 0) {
		return true
	}
	if (analysis.value.kp_filenames?.length || analysis.value.kp_filename) {
		return true
	}
	if (hasSuppliersWithFiles.value) return true
	return Object.values(analysis.value.requirements_kp ?? {}).some(
		(items) => requirementsNonempty(items),
	)
})
const isAnalysisClosed = computed(() =>
	isCompleted.value && !hasKpContent.value,
)
const visibleContentTabItems = computed(() =>
	isAnalysisClosed.value
		? contentTabItems.filter((item) => item.value === 'tz')
		: contentTabItems,
)
const showSuppliersSidebar = computed(() =>
	(isTzReviewPhase.value
		|| hasConfirmedResults.value
		|| kpAnalysisStarted.value)
	&& !isAnalysisClosed.value,
)
const selectedSupplierStats = computed(() => {
	const primary = selectedSupplierPrimaryKp.value
	const stats = primary ? analysis.value?.kp_stats?.[primary] : null
	if (stats) return stats
	const items = visibleKpItemGroups.value.flatMap((group) => group.items)
	return {
		match_score: 0,
		met_count: items.filter((item) => item.status === 'met').length,
		partial_count: items.filter((item) => item.status === 'partial').length,
		missing_count: items.filter((item) => item.status === 'missing').length,
		not_found_count: items.filter((item) => item.status === 'not_found').length,
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
	const parsed = parseScopedKpName(displayName)
	if (parsed) {
		const supplier = suppliers.value.find(
			(entry) => entry.name === parsed.supplierName,
		)
		if (supplier) {
			return { supplier, filename: parsed.filename }
		}
	}
	const flatIndex = displayKpFilenames.value.indexOf(displayName)
	if (flatIndex < 0) return null
	return findSupplierKpFileByFlatIndex(flatIndex)
}

const visibleKpItemGroups = computed(() => {
	if (suppliers.value.length === 0) {
		return kpItemGroups.value
	}
	const supplier = selectedSupplier.value
	if (!supplier) return []
	const prefix = supplierKpScopedPrefix(supplier.name)
	return kpItemGroups.value.filter((group) => group.key.startsWith(prefix))
})
const statusColor = computed(() =>
	getTzRunStatusColor(analysis.value?.status ?? TZAnalysisRunStatus.DRAFT),
)
const statusLabel = computed(() =>
	getTzRunStatusLabel(analysis.value?.status ?? TZAnalysisRunStatus.DRAFT),
)

const overrideSaving = ref(false)
const canEditItemStatuses = computed(() => hasConfirmedResults.value)

function applyItemOverrides(items: TZAnalysisItem[]): TZAnalysisItem[] {
	return items.map((item, index) => {
		const override = itemsOverrides.value[String(index)]
		if (!override?.status) return item
		return { ...item, status: override.status }
	})
}

function isItemOverridden(index: number) {
	return Boolean(itemsOverrides.value[String(index)]?.status)
}

const letterItemsView = computed((): TZItemView[] => {
	if (!analysis.value) return []
	return applyItemOverrides(analysis.value.items)
		.map((item, index) => ({ ...item, _index: index }))
})

function letterSelectionStorageKey() {
	const analysisId = analysis.value?.id
	const supplierId = selectedSupplierId.value
	if (!analysisId || !supplierId) return null
	return `tz-letter-selection:${analysisId}:${supplierId}`
}

function saveLetterSelection() {
	if (!import.meta.client) return
	const key = letterSelectionStorageKey()
	if (!key) return
	sessionStorage.setItem(key, JSON.stringify(tzSelectedIndices.value))
}

function loadLetterSelection(): number[] | null {
	if (!import.meta.client) return null
	const key = letterSelectionStorageKey()
	if (!key) return null
	try {
		const raw = sessionStorage.getItem(key)
		if (!raw) return null
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed)
			? parsed.filter((value): value is number => typeof value === 'number')
			: null
	} catch {
		return null
	}
}

function restoreOrInitLetterSelection() {
	const selectable = new Set(
		letterItemsView.value
			.filter((item) => belongsToPrimaryKp(item) && isTzSelectable(item.status))
			.map((item) => item._index),
	)
	const saved = loadLetterSelection()
	if (saved?.length) {
		const restored = saved.filter((index) => selectable.has(index))
		if (restored.length) {
			tzSelectedIndices.value = restored
			return
		}
	}
	selectPrimaryKpLetterItems(selectedSupplierPrimaryKp.value)
}

function letterMismatchReason(item: TZAnalysisItem) {
	if (item.status === 'not_found') {
		return `Параметр не найден: ${item.explanation}`
	}
	return `Причина отклонения: ${item.explanation}`
}

const filteredTzItems = computed((): TZItemView[] => {
	if (!analysis.value) return []
	return applyItemOverrides(analysis.value.items)
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
			: kpDisplayLabel(key),
		filename: key === '_default' ? null : kpDisplayLabel(key),
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

const hasMultipleLetterKps = computed(() => hasMultipleSelectedSupplierKps.value)

const primaryKpOptions = computed(() => selectedSupplierKpOptions.value)

const primaryKpLabel = computed(() => selectedSupplierPrimaryKpLabel.value)

async function setPrimaryKp(scopedKpFilename: string | null) {
	if (!analysis.value?.id || !scopedKpFilename || primaryKpSaving.value) return
	const supplier = selectedSupplier.value
	if (!supplier) return
	const parsed = parseScopedKpName(scopedKpFilename)
	const kpFilename = parsed?.filename ?? scopedKpFilename
	if (kpFilename === supplier.primary_kp_filename) return
	primaryKpSaving.value = true
	try {
		const updated = await patch<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/suppliers/${supplier.id}/primary-kp`,
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

function belongsToSelectedSupplier(item: TZAnalysisItem): boolean {
	const supplier = selectedSupplier.value
	if (!supplier) return true
	return isKpScopedToSupplier(getItemKpKey(item), supplier.name)
}

function belongsToPrimaryKp(item: TZAnalysisItem): boolean {
	if (!belongsToSelectedSupplier(item)) return false
	const primary = selectedSupplierPrimaryKp.value
	if (!primary || !hasMultipleSelectedSupplierKps.value) return true
	return getItemKpKey(item) === primary
}

function getKpStats(kpKey: string): TZAnalysisKpStats | null {
	return analysis.value?.kp_stats?.[kpKey] ?? null
}

function selectPrimaryKpLetterItems(kpFilename: string | null | undefined) {
	if (!analysis.value || !kpFilename) return
	tzSelectedIndices.value = letterItemsView.value
		.filter((item) => getItemKpKey(item) === kpFilename && isTzSelectable(item.status))
		.map((item) => item._index)
	saveLetterSelection()
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

function addTzChildRequirement(parentKey: string) {
	editableRequirementsTz.value = [
		...editableRequirementsTz.value,
		{
			key: nextChildKey(parentKey, editableRequirementsTz.value),
			text: '',
		},
	]
}

function addTzHeadingRequirement(parentKey: string) {
	editableRequirementsTz.value = [
		...editableRequirementsTz.value,
		{
			key: nextChildKey(parentKey, editableRequirementsTz.value),
			text: '',
			isHeading: true,
		},
	]
}

function removeTzRequirement(index: number) {
	editableRequirementsTz.value = editableRequirementsTz.value.filter(
		(_, idx) => idx !== index,
	)
}

const hasAnyKpFile = computed(() =>
	kpSlots.value.some((slot) => slot.file !== null),
)

const canRunKpAnalysis = computed(() =>
	!isCompleted.value
	&& requirementsRowsNonempty(editableRequirementsTz.value)
	&& (
		(isTzReviewPhase.value && hasSuppliersWithFiles.value)
		|| (hasConfirmedResults.value && hasPendingSuppliers.value)
	),
)

async function refreshAnalysis() {
	if (!analysis.value?.id) return
	try {
		const data = await get<TZAnalysisSession>(`/tz-analysis/${analysis.value.id}`)
		applyAnalysis(data)
	} catch {
		toast.add({ title: 'Не удалось обновить анализ', color: 'error' })
	}
}

const selectedLetterItems = computed((): TZItemView[] =>
	letterItemsView.value.filter((item) =>
		tzSelectedIndices.value.includes(item._index) && isTzSelectable(item.status),
	),
)

const letterModalMismatchItems = computed((): TZItemView[] =>
	letterItemsView.value.filter((item) =>
		belongsToPrimaryKp(item)
		&& (item.status === 'missing' || item.status === 'not_found'),
	),
)

const letterModalPartialItems = computed((): TZItemView[] =>
	letterItemsView.value.filter((item) =>
		belongsToPrimaryKp(item) && item.status === 'partial',
	),
)

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
			lines.push(letterMismatchReason(item))
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
		formatLetterDate(),
	)
	return lines
}

function paragraphsToLetterText(paragraphs: string[]): string {
	return paragraphs.join('\n\n')
}

function letterTextToParagraphs(text: string): string[] {
	if (!text.trim()) return []
	return text.split('\n\n')
}

function getLetterTextarea(): HTMLTextAreaElement | null {
	const root = letterTextareaRef.value?.$el ?? letterTextareaRef.value
	if (root instanceof HTMLTextAreaElement) return root
	const el = root?.querySelector('textarea')
	return el instanceof HTMLTextAreaElement ? el : null
}

function withLetterEditorScrollPreserved(update: () => void) {
	const textarea = getLetterTextarea()
	const scrollTop = textarea?.scrollTop ?? 0
	const selectionStart = textarea?.selectionStart ?? null
	const selectionEnd = textarea?.selectionEnd ?? null
	update()
	nextTick(() => {
		const ta = getLetterTextarea()
		if (!ta) return
		ta.scrollTop = scrollTop
		if (selectionStart != null && selectionEnd != null) {
			ta.setSelectionRange(selectionStart, selectionEnd)
		}
	})
}

function currentLetterParagraphs(): string[] {
	return buildDraftLetterParagraphs()
}

function letterClosingText(): string {
	const deadline = docxDeadline.value.trim() || '7 дней'
	return [
		`${LETTER_DEADLINE_PREFIX}${deadline}.`,
		'',
		'С уважением,',
		'',
		formatLetterDate(),
	].join('\n\n')
}

function patchLetterClosingInEditor() {
	if (!showLetterModal.value || tzSelectedIndices.value.length === 0) return
	const closing = letterClosingText()
	const markerIdx = letterEditorText.value.indexOf(LETTER_DEADLINE_PREFIX)
	if (markerIdx < 0 && !letterEditorDirty.value) {
		syncLetterEditor(true)
		return
	}
	withLetterEditorScrollPreserved(() => {
		skipLetterEditorDirty = true
		if (markerIdx >= 0) {
			letterEditorText.value = letterEditorText.value.slice(0, markerIdx) + closing
		} else {
			letterEditorText.value = `${letterEditorText.value.trim()}\n\n${closing}`
		}
		nextTick(() => {
			skipLetterEditorDirty = false
		})
	})
}

function syncLetterEditor(force = false) {
	if (letterEditorDirty.value && !force) return
	const paragraphs = currentLetterParagraphs()
	withLetterEditorScrollPreserved(() => {
		skipLetterEditorDirty = true
		letterEditorText.value = paragraphs.length
			? paragraphsToLetterText(paragraphs)
			: ''
		nextTick(() => {
			skipLetterEditorDirty = false
		})
	})
}

function onLetterEditorInput() {
	if (skipLetterEditorDirty) return
	letterEditorDirty.value = true
}

function scrollToLetterSection(section: 'mismatch' | 'partial') {
	const tab = letterPreviewTabs.value.find((t) => t.value === section)
	if (tab?.disabled) return
	letterPreviewTab.value = section
	const header = section === 'mismatch'
		? LETTER_MISMATCH_HEADER
		: LETTER_PARTIAL_HEADER
	nextTick(() => {
		const textarea = getLetterTextarea()
		if (textarea) {
			const idx = letterEditorText.value.indexOf(header)
			if (idx >= 0) {
				textarea.focus()
				textarea.setSelectionRange(idx, idx + header.length)
				const lineCount = letterEditorText.value.slice(0, idx).split('\n').length
				textarea.scrollTop = Math.max(0, (lineCount - 2) * 22)
				return
			}
		}
		document.getElementById(`letter-sidebar-${section}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
	})
}

function applyAnalysis(data: TZAnalysisSession) {
	analysis.value = data
	itemsOverrides.value = { ...(data.items_overrides ?? {}) }
	syncEditableRequirements(data)
	ensureSelectedSupplier()
	if (
		(data.suppliers?.length ?? 0) > 0
		&& !userPickedContentTab.value
		&& !isAnalysisClosed.value
	) {
		activeContentTab.value = 'kp'
	}
	if (data.status === TZAnalysisRunStatus.PROCESSING) {
		processingPhase.value = inferProcessingPhase(data)
		tzPolling.value = true
	} else if (
		data.suppliers?.some(
			(supplier) => supplier.status === TZAnalysisSupplierStatus.PROCESSING,
		)
	) {
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
		ensureResultsKpExpanded(
			collectResultsKpKeys(data).filter((key) => {
				const supplier = selectedSupplier.value
				if (!supplier) return true
				return isKpScopedToSupplier(key, supplier.name)
			}),
		)
		restoreOrInitLetterSelection()
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
			: hasSuppliersProcessing.value
				? 'Анализ КП завершён'
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
	(data) =>
		data.suppliers?.some(
			(supplier) => supplier.status === TZAnalysisSupplierStatus.PROCESSING,
		) ?? false,
)

let skipLetterEditorDirty = false

function scheduleLetterPreview() {
	if (!showLetterModal.value || !analysis.value?.id) return
	if (tzSelectedIndices.value.length === 0) {
		letterEditorText.value = ''
		letterEditorDirty.value = false
		return
	}
	letterEditorDirty.value = false
	syncLetterEditor(true)
}

watch(selectedSupplierId, () => {
	restoreOrInitLetterSelection()
	scheduleLetterPreview()
})

async function onContentTabChange(tab: string) {
	if (tab === activeContentTab.value) return
	userPickedContentTab.value = true
	activeContentTab.value = tab
	contentTabLoading.value = true
	await nextTick()
	requestAnimationFrame(() => {
		contentTabLoading.value = false
	})
}

watch(isAnalysisClosed, (closed) => {
	if (closed) activeContentTab.value = 'tz'
})

watch(showLetterModal, (open) => {
	if (!open) {
		letterEditorDirty.value = false
		return
	}
	const { mismatch, partial } = letterItemsByTab.value
	if (mismatch.length > 0) letterPreviewTab.value = 'mismatch'
	else if (partial.length > 0) letterPreviewTab.value = 'partial'
	letterEditorDirty.value = false
	syncLetterEditor(true)
	scheduleLetterPreview()
})

watch(docxDeadline, () => {
	if (!showLetterModal.value) return
	patchLetterClosingInEditor()
})

watch(
	[tzSelectedIndices, itemsOverrides],
	() => {
		if (!showLetterModal.value) return
		saveLetterSelection()
		scheduleLetterPreview()
	},
	{ deep: true },
)

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

onMounted(() => {
	fetchAnalysis()
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

		if (!analysis.value.confirmed) {
			await patch<TZAnalysisSession>(
				`/tz-analysis/${analysis.value.id}/requirements`,
				{ requirements_tz: rowsToHierarchy(editableRequirementsTz.value) },
			)
		}

		let result: TZAnalysisSession
		result = await post<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/run-kp`,
			new FormData(),
		)
		tzSelectedIndices.value = []
		processingPhase.value = 'kp'
		applyAnalysis(result)
		if (
			result.status === TZAnalysisRunStatus.PROCESSING
			|| result.suppliers?.some(
				(s) => s.status === TZAnalysisSupplierStatus.PROCESSING,
			)
		) {
			tzPolling.value = true
		}
		toast.add({
			title: 'Анализ КП запущен',
			description: 'Обработка выполняется по каждому поставщику отдельно.',
			color: 'success',
			icon: 'i-lucide-check',
		})
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
}

function isTzSelectable(status: TZAnalysisStatus) {
	return status === 'partial' || status === 'missing' || status === 'not_found'
}

async function updateItemStatus(index: number, status: TZAnalysisStatus) {
	if (!analysis.value?.id || overrideSaving.value) return
	overrideSaving.value = true
	const nextOverrides = {
		...itemsOverrides.value,
		[String(index)]: { status },
	}
	try {
		const updated = await patch<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/items-overrides`,
			{ overrides: nextOverrides },
		)
		applyAnalysis(updated)
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось сохранить статус',
			color: 'error',
		})
	} finally {
		overrideSaving.value = false
	}
}

function toggleTzSelect(index: number, checked: boolean) {
	if (checked) {
		if (!tzSelectedIndices.value.includes(index)) {
			tzSelectedIndices.value = [...tzSelectedIndices.value, index]
		}
	} else {
		tzSelectedIndices.value = tzSelectedIndices.value.filter((i) => i !== index)
	}
	saveLetterSelection()
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
	if (!analysis.value?.id || !letterEditorText.value.trim()) return
	patchLetterClosingInEditor()
	docxGenerating.value = true
	try {
		const res = await $axios.post(
			`/tz-analysis/${analysis.value.id}/docx`,
			{
				selected_indices: tzSelectedIndices.value,
				deadline_date: docxDeadline.value.trim() || null,
				paragraphs: letterTextToParagraphs(letterEditorText.value),
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
