<template>
	<UContainer class="py-8 max-w-7xl" :class="{ 'pb-28': showTzConfirmBar }">
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
					<UButton
to="/tz-analysis/history" variant="ghost" color="neutral" size="sm"
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
						<span
v-if="analysis.tz_filename || displayKpFilenames.length"
							class="flex items-center gap-1 min-w-0 flex-wrap">
							<UIcon name="i-lucide-files" class="w-3.5 h-3.5 shrink-0" />
							<template v-if="analysis.tz_filename">
								<button
type="button" class="truncate max-w-full text-primary hover:underline text-left"
									@click="openTzFile()">
									{{ analysis.tz_filename }}
								</button>
							</template>

						</span>
					</div>
				</div>
			</div>

			<template v-if="isDraft">
				<UAlert
color="info" variant="soft" icon="i-lucide-info" class="mb-4"
					description="Загрузите техническое задание и запустите анализ. После извлечения требований вы сможете проверить их и загрузить коммерческие предложения." />

				<UAlert
					v-if="isTestPlan(user?.subscription)"
					color="info"
					variant="soft"
					icon="i-lucide-credit-card"
					title="Лимит загрузки по подписке"
					:description="uploadLimitHint"
					class="mb-6"
				/>

				<UCard class="shadow-sm">
					<UFormField label="Техническое задание" required>
						<UFileUpload
:model-value="tzFile" :accept="fileAccept" :interactive="false"
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

					<UButton
						block
						size="lg"
						class="mt-5"
						leading-icon="i-lucide-scan-search"
						:loading="tzAnalyzing"
						:disabled="!tzFile || !canRunTzAnalysis"
						@click="runTzAnalysis"
					>
						Анализировать ТЗ
					</UButton>
					<p v-if="module2BlockReason" class="text-xs text-muted mt-2">
						{{ module2BlockReason }}
						<ULink
							:to="subscriptionProfilePath()"
							class="text-primary hover:underline underline-offset-2 ml-1"
						>
							Подписка
						</ULink>
					</p>
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
				<UAlert
color="error" variant="soft" icon="i-lucide-circle-alert"
					description="Не удалось выполнить анализ. Создайте новый анализ и попробуйте снова." />
			</template>

			<template v-else-if="isTzReviewPhase || isTzConfirmed || kpAnalysisStarted">
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
					v-model="activeContentTab"
					:items="visibleContentTabItems"
					:ui="{ list: 'mb-6' }"
					@update:model-value="onUserTabPick"
				>
					<template #tz>
						<div
v-if="isTzReviewPhase && !isAnalysisClosed"
							class="mb-6 rounded-xl border border-warning/25 bg-warning/10 p-4 sm:p-5">
							<div class="flex gap-3 min-w-0">
								<UIcon name="i-lucide-info" class="w-5 h-5 shrink-0 text-warning mt-0.5" />
								<div class="min-w-0 space-y-1">
									<p class="text-sm font-semibold text-highlighted">
										Проверьте извлечённые требования
									</p>
									<p class="text-sm text-muted">
										Система извлекла требования из ТЗ. Удалите лишние пункты,
										добавьте недостающие, затем подтвердите список —
										после этого станет доступна загрузка КП.
									</p>
								</div>
							</div>
						</div>

						<UCard class="shadow-sm">
							<template #header>
								<div class="flex items-center justify-between gap-2">
									<p class="font-semibold text-sm">Требования из ТЗ</p>
									<UBadge color="neutral" variant="subtle" size="xs">
										{{ displayedTzCount }}
										{{ requirementWord(displayedTzCount) }}
									</UBadge>
								</div>
							</template>

							<div
								class="overflow-y-auto pr-1"
								:class="!isTzConfirmed && !isCompleted
									? 'max-h-[min(58vh,calc(100dvh-18rem))]'
									: ''"
							>
								<RequirementTreeEditor
									v-if="displayedTzCount > 0"
									:rows="displayedTzRequirementsRows"
									:scope-id="isTzConfirmed ? 'tz-results' : 'tz-review'"
									:readonly="isTzConfirmed || isCompleted"
									@remove="removeTzRequirement"
									@add-child="addTzChildRequirement"
									@add-heading="addTzHeadingRequirement"
									@add-sibling="addTzSiblingRequirement"
									@reorder="reorderTzRequirement"
								/>
								<div
									v-else-if="!isTzConfirmed && !isCompleted"
									class="flex flex-col items-center gap-3 py-4"
								>
									<p class="text-sm text-muted text-center">
										Нет извлечённых требований
									</p>
									<UButton
										type="button"
										variant="soft"
										color="primary"
										size="sm"
										icon="i-lucide-plus"
										label="Добавить требование"
										@click="addTzRequirement()"
									/>
								</div>
								<p v-else class="text-sm text-muted text-center py-4">
									Нет извлечённых требований
								</p>
							</div>
						</UCard>
					</template>

					<template #kp>
						<div
							class="grid grid-cols-1 gap-4 items-start"
							:class="showSuppliersSidebar
								? 'xl:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]'
								: ''"
						>
							<div
								v-if="showSuppliersSidebar && analysis?.id"
								class="order-1 xl:order-1 min-w-0 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto"
							>
								<TzAnalysisSuppliersPanel
									:analysis-id="analysis.id"
									:suppliers="suppliers"
									:file-accept="fileAccept"
									:max-upload-size="maxUploadSize"
									:show-upload-limit-alert="isTestPlan(user?.subscription)"
									:readonly="isCompleted || isAnalysisClosed"
									:hide-kp-files="false"
									:selected-supplier-id="selectedSupplierId"
									compact
									rail
									@select="onSelectSupplier"
									@open-kp="({ supplierId, filename }) => openKpFile(filename, supplierId)"
									@updated="refreshAnalysis"
								>
									<template v-if="selectedSupplier?.kp_filenames.length" #after-suppliers>
										<div class="space-y-4">
											<div class="space-y-2">
												<p class="text-xs font-semibold text-muted uppercase tracking-wide">
													Файлы КП
												</p>
												<div class="space-y-2">
													<button
														v-for="filename in selectedSupplier.kp_filenames"
														:key="`${selectedSupplier.id}-${filename}`"
														type="button"
														class="flex items-center gap-2 w-full rounded-lg border border-default/60 bg-default/50 px-3 py-2.5 text-sm text-primary hover:bg-elevated/60 transition-colors text-left cursor-pointer"
														@click="openKpFile(filename, selectedSupplier.id)"
													>
														<UIcon name="i-lucide-file-spreadsheet" class="w-4 h-4 shrink-0" />
														<span class="truncate">{{ filename }}</span>
													</button>
												</div>
											</div>

											<UFormField
												v-if="hasMultipleSelectedSupplierKps"
												label="Основное КП для сравнения"
												class="mb-0"
											>
												<USelect
													:model-value="selectedSupplierPrimaryKp ?? undefined"
													:items="selectedSupplierKpOptions"
													:loading="primaryKpSaving"
													size="sm"
													class="w-full"
													@update:model-value="setPrimaryKp"
												/>
											</UFormField>
										</div>
									</template>
									<template v-if="showComparisonResultsCard" #actions>
										<UButton
											block
											size="md"
											variant="outline"
											leading-icon="i-lucide-download"
											class="mt-1"
											@click="exportTzXlsx"
										>
											Экспорт XLSX
										</UButton>
									</template>
								</TzAnalysisSuppliersPanel>
							</div>

							<div class="min-w-0 space-y-4 order-2 xl:order-2">
								<div
									v-if="kpPanelLoading || supplierResultsLoading"
									class="flex flex-col items-center justify-center gap-3 min-h-[40vh] text-muted rounded-xl border border-default/60 bg-elevated/20"
								>
									<UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin text-primary" />
									<p class="text-sm">Загрузка данных поставщика…</p>
								</div>
								<template v-else>
								<UCard
									v-if="showKpProcessingBanner"
									class="shadow-sm"
								>
									<div class="flex flex-col gap-1 py-4 text-muted">
										<div class="flex items-center gap-3">
											<UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin text-warning shrink-0" />
											<p class="text-sm">
												Анализ коммерческих предложений выполняется. Раздел ТЗ доступен для просмотра.
											</p>
										</div>
										<p class="text-xs pl-8">
											Ожидайте до 2 часов. Страница обновится автоматически.
										</p>
									</div>
								</UCard>

								<template v-if="isAnalysisClosed">
									<UAlert
color="neutral" variant="soft" icon="i-lucide-lock"
										description="Анализ завершён без сравнения с КП. Этот раздел недоступен." />
								</template>

								<template v-else-if="isTzConfirmed && !hasComparisonResults && !isCompleted && !isKpProcessing">
									<div class="flex flex-wrap items-center gap-2">
										<UButton
color="warning" variant="solid" :loading="kpAnalyzing"
											:disabled="!canRunKpAnalysis" @click="runKpAnalysis">
											Запустить анализ КП
										</UButton>
										<p v-if="!canRunKpAnalysis" class="text-xs text-muted">
											Добавьте хотя бы одного поставщика с файлами КП
										</p>
									</div>
								</template>

								<template v-else-if="isCompleted && !hasComparisonResults">
									<UAlert
color="neutral" variant="soft" icon="i-lucide-archive"
										description="Сравнение с КП не выполнялось. Анализ завершён — запуск сравнения недоступен." />
								</template>

								<template v-else-if="showComparisonResultsCard">
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

									<UCard class="shadow-sm w-full">
										<template #header>
											<div class="flex flex-col gap-3 w-full">
												<div class="flex flex-wrap items-center justify-between gap-3 w-full">
													<p class="font-semibold text-sm">Соответствия и несоответствия</p>
													<UButton
size="sm" leading-icon="i-lucide-file-text"
														:disabled="!hasLetterIssues" @click="openLetterModal">
														Письмо поставщику
													</UButton>
												</div>
												<div class="flex flex-wrap items-end gap-3 w-full">
													<UFormField label="Поиск" class="mb-0 flex-1 min-w-48">
														<UInput
															v-model="tzRequirementSearch"
															placeholder="Поиск по требованиям..."
															icon="i-lucide-search"
															size="sm"
														/>
													</UFormField>
													<UFormField label="Фильтр" class="mb-0">
														<USelect
v-model="tzStatusFilter" :items="tzFilterOptions" size="sm"
															class="min-w-40" />
													</UFormField>
												</div>
											</div>
										</template>

										<div class="min-h-[min(70vh,calc(100dvh-14rem))] max-h-[min(85vh,calc(100dvh-10rem))] overflow-y-auto pr-1 space-y-8">
											<section
v-for="group in visibleKpItemGroups"
												:key="`results-kp-${group.id}`" class="space-y-4">
												<button
type="button" class="sticky top-0 z-10 -mx-1 px-1 py-2 w-full text-left
														bg-default/95 backdrop-blur-sm border-b border-default" :aria-expanded="isResultsKpExpanded(group.id)"
													@click.stop="toggleResultsKpExpand(group.id)">
													<div class="flex flex-wrap items-center gap-2">
														<UIcon
:name="isResultsKpExpanded(group.id)
															? 'i-lucide-chevron-down'
															: 'i-lucide-chevron-right'" class="w-4 h-4 shrink-0 text-muted" />
														<p class="text-sm font-semibold text-highlighted">{{ group.label
															}}</p>
														<UBadge
v-if="analysis.kp_filename === group.key"
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
														:editable="canEditItemStatuses"
														:is-item-overridden="isItemOverridden"
														@status-change="updateItemStatus" />
												</div>
											</section>

											<p
v-if="visibleKpItemGroups.length === 0"
												class="text-sm text-muted text-center py-8">
												<template v-if="tzRequirementSearch.trim() || tzStatusFilter !== 'all'">
													Ничего не найдено по заданным фильтрам
												</template>
												<template v-else-if="selectedSupplier">
													Нет результатов для поставщика «{{ selectedSupplier.name }}»
												</template>
												<template v-else>
													Выберите поставщика в панели слева
												</template>
											</p>
										</div>
									</UCard>
								</template>
								</template>
							</div>
						</div>
					</template>
				</UTabs>
			</template>
		</template>

		<UModal v-model:open="showLetterModal" :ui="EMAIL_LETTER_MODAL_UI">
			<template #header>
				<div class="min-w-0">
					<p class="text-lg font-semibold text-highlighted">Письмо поставщику</p>
					<p class="text-sm text-muted mt-0.5">
						Письмо формируется по основному КП и включает все несоответствия.
					</p>
				</div>
			</template>
			<template #body>
				<div class="flex flex-col min-h-[min(80vh,42rem)]">
					<div class="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
						<div class="grid grid-cols-1 md:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] gap-4 min-h-0">
					<aside class="flex flex-col gap-3 shrink-0 min-h-0 md:max-h-[72vh]">
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
							<button
v-if="analysis?.kp_filename" type="button"
								class="text-primary hover:underline font-medium"
								@click="openKpFile(analysis.kp_filename)">
								{{ primaryKpLabel }}
							</button>
							<span v-else class="text-default font-medium">{{ primaryKpLabel }}</span>
						</p>
						<UFormField label="Срок ответа">
							<UInput v-model="docxDeadline" placeholder="7 июня 2026 г." size="md" />
						</UFormField>
						<div class="flex flex-col gap-1.5 shrink-0">
							<p class="text-xs font-semibold uppercase tracking-wide text-muted px-0.5">
								Разделы письма
							</p>
							<UButton
v-for="tab in letterPreviewTabs" :key="tab.value" type="button" block
								:variant="letterPreviewTab === tab.value ? 'soft' : 'ghost'"
								:color="letterPreviewTab === tab.value ? tab.color : 'neutral'" size="sm"
								class="justify-start text-left whitespace-normal h-auto py-2"
								:disabled="tab.disabled" @click="scrollToLetterSection(tab.value)">
								{{ tab.label }}
							</UButton>
						</div>
						<div class="flex-1 min-h-0 overflow-y-auto space-y-4 pr-0.5">
							<div
								v-for="section in letterSidebarSections"
								:id="section.id"
								:key="section.id"
								class="space-y-2"
							>
								<p class="text-xs font-semibold px-0.5" :class="section.titleClass">
									{{ section.title }}
								</p>
								<div
									v-for="group in section.groups"
									:key="group.groupKey"
									class="rounded-lg border border-default/60 bg-elevated/30 px-2.5 py-2.5 space-y-2"
								>
									<div class="flex items-start gap-2">
										<UCheckbox
											:model-value="isGroupFullySelected(group)"
											:indeterminate="isGroupPartiallySelected(group)"
											:color="getTzItemStatusColor(group.status)"
											class="shrink-0 mt-0.5"
											@update:model-value="(v) => toggleGroupSelect(group, v === true)"
											@click.stop
										/>
										<p class="flex-1 text-sm font-medium text-default leading-snug min-w-0">
											{{ letterGroupTitle(group) }}
										</p>
										<TzOriginalTzHint
											v-if="letterGroupShowQuote(group) && group.refValue"
											:text="group.refValue"
										/>
									</div>
									<div
										v-if="letterGroupSubLines(group).length"
										class="pl-6 space-y-1"
									>
										<label
											v-for="item in letterGroupSubLines(group)"
											:key="item._index"
											class="flex items-start gap-2 rounded-md px-1 py-0.5
												cursor-pointer hover:bg-elevated/40 transition-colors"
										>
											<UCheckbox
												:model-value="tzSelectedIndices.includes(item._index)"
												:color="getTzItemStatusColor(item.status)"
												class="shrink-0 mt-0.5"
												@update:model-value="(v) => toggleItemSelect(item._index, v === true)"
												@click.stop
											/>
											<span class="text-xs text-default leading-relaxed min-w-0">
												{{ itemAnalysisText(item) }}
											</span>
										</label>
									</div>
								</div>
							</div>
						</div>
					</aside>

					<div ref="letterDocumentRef" class="relative min-h-[min(72vh,40rem)]">
						<InsertBusinessInfoButton
							v-if="hasLetterIssues"
							v-model="letterEditorText"
							class="absolute top-2 right-2 z-10"
							@inserted="letterEditorDirty = true"
						/>
						<UTextarea
							v-if="hasLetterIssues"
							ref="letterTextareaRef"
							v-model="letterEditorText"
							class="w-full"
							:ui="{ base: 'h-[min(72vh,40rem)] resize-none overflow-y-auto font-[inherit] leading-relaxed' }"
							size="md"
							:rows="20"
							@update:model-value="onLetterEditorInput"
						/>
						<p v-else class="text-sm text-muted text-center py-10 rounded-xl border border-default bg-elevated/30">
							Нет несоответствий для формирования письма
						</p>
					</div>
						</div>
					</div>

					<div :class="EMAIL_LETTER_MODAL_FOOTER_CLASS">
						<UButton
							color="neutral"
							variant="ghost"
							leading-icon="i-lucide-arrow-left"
							@click="showLetterModal = false"
						>
							Назад
						</UButton>
						<UButton
							leading-icon="i-lucide-download"
							:loading="docxGenerating"
							:disabled="tzSelectedIndices.length === 0 || !letterEditorText.trim()"
							@click="generateDocx"
						>
							Скачать DOCX
						</UButton>
					</div>
				</div>
			</template>
		</UModal>

		<Teleport to="body">
			<div
				v-if="showTzConfirmBar"
				class="fixed inset-x-0 bottom-0 z-50 pointer-events-none px-4 pb-4 sm:pb-6"
			>
				<UContainer class="max-w-7xl flex justify-center">
					<UButton
						color="primary"
						variant="solid"
						size="xl"
						class="pointer-events-auto min-w-[min(100%,20rem)] shadow-lg ring-1 ring-primary/20 rounded-xl"
						leading-icon="i-lucide-check"
						:loading="confirmingTz"
						:disabled="!requirementsRowsNonempty(editableRequirementsTz)"
						@click="confirmTzRequirements"
					>
						Подтвердить требования
					</UButton>
				</UContainer>
			</div>
		</Teleport>
	</UContainer>
</template>

<script lang="ts" setup>
import type {
	TZAnalysisItem,
	TZAnalysisKpStats,
	TZAnalysisSession,
	TZAnalysisStatus,
	TZAnalysisSupplierItem,
	UserResponse,
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
	insertChildAfterParentRow,
	getRowSubtreeRange,
	renumberRequirementRows,
	insertSiblingAfterRow,
	moveRequirementRowBlock,
	requirementsNonempty,
	requirementsRowsNonempty,
	rowsToHierarchy,
	resolveLetterItemGrouping,
	type EditableRequirementRow,
} from '#shared/utils/requirementsStruct'
import {
	formatLetterRequirementLine,
	formatLetterRequirementRef,
	getTzRequirementDisplay,
} from '#shared/utils/tzRequirementDisplay'
import { getApiErrorDetail, isSubscriptionApiError } from '#shared/utils/apiError'
import { EMAIL_LETTER_MODAL_FOOTER_CLASS, EMAIL_LETTER_MODAL_UI } from '#shared/constants/emailModal'
import {
	canStartModule2Work,
	isTestPlan,
	module2UploadLimitHint,
	module2WorkBlockMessage,
	tzKpUploadLimitBytes,
	formatUploadLimitMb,
} from '#shared/utils/subscriptionAccess'
import { subscriptionProfilePath } from '#shared/utils/subscriptionDisplay'
import RequirementResultsTree from '~/components/tz-analysis/RequirementResultsTree.vue'
import RequirementTreeEditor from '~/components/tz-analysis/RequirementTreeEditor.vue'
import TzAnalysisSuppliersPanel from '~/components/tz-analysis/TzAnalysisSuppliersPanel.vue'
import TzOriginalTzHint from '~/components/tz-analysis/TzOriginalTzHint.vue'
import { useRunStatusPolling } from '~/composables/useRunStatusPolling'
import { useTzAnalysisFiles } from '~/composables/useTzAnalysisFiles'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => route.params.id as string)

const { get, post, patch } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()

function openSubscriptionProfile(): void {
	void navigateTo(subscriptionProfilePath())
}
const { formatDate } = useFormatDate()
const { public: publicConfig } = useRuntimeConfig()

const maxUploadSize = computed(() =>
	tzKpUploadLimitBytes(
		user.value?.subscription,
		publicConfig.maxTzUploadSize as number,
	),
)
const fileAccept = '.pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp'

const uploadDescription = computed(() =>
	`PDF, DOCX, XLSX, TXT, изображения. До ${formatUploadLimitMb(maxUploadSize.value)}`,
)

const uploadLimitHint = computed(() =>
	module2UploadLimitHint(
		user.value?.subscription,
		publicConfig.maxTzUploadSize as number,
	),
)

const loading = ref(true)
const analysis = ref<TZAnalysisSession | null>(null)
const user = ref<UserResponse | null>(null)

const canRunTzAnalysis = computed(() =>
	canStartModule2Work(user.value?.subscription),
)

const module2BlockReason = computed(() =>
	module2WorkBlockMessage(user.value?.subscription),
)
const { openTzFile, openKpFile } = useTzAnalysisFiles(
	computed(() => analysis.value?.id),
	computed(() => analysis.value?.tz_filename),
)
provide('tzAnalysisFiles', { openTzFile, openKpFile })
provide(
	'tzRequirementsHierarchy',
	computed(() => analysis.value?.requirements_tz ?? null),
)

const activeContentTab = ref('tz')
const kpPanelLoading = ref(false)
const supplierResultsLoading = ref(false)
const userPickedContentTab = ref(false)
const selectedSupplierId = ref<string | null>(null)
const displayedSupplierId = ref<string | null>(null)
let skipTabPickHandler = false
const contentTabItems = [
	{ label: 'ТЗ', value: 'tz', slot: 'tz', icon: 'i-lucide-file-text' },
	{ label: 'КП / Результаты', value: 'kp', slot: 'kp', icon: 'i-lucide-file-spreadsheet' },
]
const tzFile = ref<File | null>(null)
const tzAnalyzing = ref(false)
const kpAnalyzing = ref(false)
const confirmingTz = ref(false)
const tzPolling = ref(false)
const tzStatusFilter = ref('all')
const tzRequirementSearch = ref('')
const showLetterModal = ref(false)
const tzSelectedIndices = ref<number[]>([])
const letterPreviewTab = ref<'mismatch' | 'not_found' | 'partial'>('mismatch')
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

const LETTER_MISMATCH_HEADER = 'Не соответствует:'
const LETTER_NOT_FOUND_HEADER = 'Не найдено:'
const LETTER_PARTIAL_HEADER = 'Требуют уточнения/дополнения:'
const LETTER_DEADLINE_PREFIX =
	'Просим предоставить дополненное/уточненное предложение не позднее '

const tzFilterOptions = [
	{ label: 'Все', value: 'all' },
	{ label: 'Соответствует', value: 'met' },
	{ label: 'Частично', value: 'partial' },
	{ label: 'Не соответствует', value: 'missing' },
	{ label: 'Не найдено', value: 'not_found' },
]

type TZItemView = TZAnalysisItem & { _index: number }

type LetterGroup = {
	groupKey: string
	parentKey: string | null
	refValue: string | null
	isSplitChild: boolean
	items: TZItemView[]
	status: TZAnalysisStatus
}

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
const isKpProcessing = computed(() =>
	hasSuppliersProcessing.value || kpAnalyzing.value,
)
const showKpProcessingBanner = computed(() =>
	isKpProcessing.value && isTzConfirmed.value,
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
	&& !kpAnalysisStarted.value,
)
const isTzConfirmed = computed(() =>
	Boolean(analysis.value?.confirmed),
)
const hasComparisonResults = computed(() =>
	(analysis.value?.items?.length ?? 0) > 0,
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
	suppliers.value.find((entry) => entry.id === displayedSupplierId.value) ?? null,
)

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
		displayedSupplierId.value = null
		return
	}
	if (
		!selectedSupplierId.value
		|| !list.some((entry) => entry.id === selectedSupplierId.value)
	) {
		const firstId = list[0]!.id
		selectedSupplierId.value = firstId
		displayedSupplierId.value = firstId
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
const showTzConfirmBar = computed(() =>
	isTzReviewPhase.value
	&& !isAnalysisClosed.value
	&& !isTzConfirmed.value
	&& !isCompleted.value
	&& activeContentTab.value === 'tz',
)
const visibleContentTabItems = computed(() => {
	if (isAnalysisClosed.value || !isTzConfirmed.value) {
		return contentTabItems.filter((item) => item.value === 'tz')
	}
	return contentTabItems
})
const showSuppliersSidebar = computed(() =>
	isTzConfirmed.value && !isAnalysisClosed.value,
)
const selectedSupplierStats = computed(() =>
	computeStatsFromItems(
		itemsForSupplier(selectedSupplier.value).filter((item) =>
			belongsToPrimaryKp(item),
		),
	),
)

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
const canEditItemStatuses = computed(() => hasComparisonResults.value)

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

function isTzSelectable(status: TZAnalysisStatus) {
	return status === 'partial' || status === 'missing' || status === 'not_found'
}

const letterSelectableItems = computed((): TZItemView[] =>
	letterItemsView.value.filter(
		(item) => belongsToPrimaryKp(item) && isTzSelectable(item.status),
	),
)

const hasLetterIssues = computed(() => letterSelectableItems.value.length > 0)

const letterModalMismatchItems = computed((): TZItemView[] =>
	letterItemsView.value.filter(
		(item) => belongsToPrimaryKp(item) && item.status === 'missing',
	),
)

const letterModalNotFoundItems = computed((): TZItemView[] =>
	letterItemsView.value.filter(
		(item) => belongsToPrimaryKp(item) && item.status === 'not_found',
	),
)

const letterModalPartialItems = computed((): TZItemView[] =>
	letterItemsView.value.filter(
		(item) => belongsToPrimaryKp(item) && item.status === 'partial',
	),
)

function itemAnalysisText(item: TZItemView): string {
	return getTzRequirementDisplay(
		item,
		analysis.value?.requirements_tz,
	).analysisText
}

function resolveGroupLetterFields(item: TZItemView) {
	const grouping = resolveLetterItemGrouping(
		item,
		analysis.value?.requirements_tz,
		`_u_${item._index}`,
	)
	return {
		...grouping,
		analysisText: itemAnalysisText(item),
	}
}

function groupItemsByRef(items: TZItemView[]): LetterGroup[] {
	const bucket = new Map<string, LetterGroup>()
	const order: string[] = []

	for (const item of items) {
		const {
			groupKey,
			parentKey,
			tzVerbatim,
			isSplitChild,
		} = resolveGroupLetterFields(item)

		if (!bucket.has(groupKey)) {
			bucket.set(groupKey, {
				groupKey,
				parentKey,
				refValue: tzVerbatim,
				isSplitChild,
				items: [item],
				status: item.status,
			})
			order.push(groupKey)
			continue
		}

		const group = bucket.get(groupKey)!
		group.items.push(item)
		if (!group.refValue && tzVerbatim) {
			group.refValue = tzVerbatim
		}
	}

	return order.map((key) => bucket.get(key)!)
}

function groupItemIndices(group: LetterGroup): number[] {
	return group.items.map((item) => item._index)
}

function isGroupFullySelected(group: LetterGroup): boolean {
	const indices = groupItemIndices(group)
	return indices.length > 0
		&& indices.every((index) => tzSelectedIndices.value.includes(index))
}

function isGroupPartiallySelected(group: LetterGroup): boolean {
	const indices = groupItemIndices(group)
	const selectedCount = indices.filter(
		(index) => tzSelectedIndices.value.includes(index),
	).length
	return selectedCount > 0 && selectedCount < indices.length
}

function toggleGroupSelect(group: LetterGroup, checked: boolean) {
	const indices = groupItemIndices(group)
	if (checked) {
		const next = new Set(tzSelectedIndices.value)
		for (const index of indices) next.add(index)
		tzSelectedIndices.value = [...next]
	} else {
		const remove = new Set(indices)
		tzSelectedIndices.value = tzSelectedIndices.value.filter(
			(index) => !remove.has(index),
		)
	}
	saveLetterSelection()
}

function letterGroupTitle(group: LetterGroup): string {
	if (group.isSplitChild && group.parentKey) {
		return group.parentKey
	}
	if (group.items.length > 1 && group.parentKey) {
		return group.parentKey
	}
	return itemAnalysisText(group.items[0]!)
}

function letterGroupSubLines(group: LetterGroup): TZItemView[] {
	if (group.isSplitChild || group.items.length > 1) {
		return group.items
	}
	return []
}

function toggleItemSelect(index: number, checked: boolean) {
	if (checked) {
		if (!tzSelectedIndices.value.includes(index)) {
			tzSelectedIndices.value = [...tzSelectedIndices.value, index]
		}
	} else {
		tzSelectedIndices.value = tzSelectedIndices.value.filter((i) => i !== index)
	}
	saveLetterSelection()
}

function letterGroupShowQuote(group: LetterGroup): boolean {
	if (!group.refValue?.trim()) return false
	return group.isSplitChild || group.items.length > 1
}

const letterGroupedMismatch = computed(() =>
	groupItemsByRef(letterModalMismatchItems.value),
)

const letterGroupedNotFound = computed(() =>
	groupItemsByRef(letterModalNotFoundItems.value),
)

const letterGroupedPartial = computed(() =>
	groupItemsByRef(letterModalPartialItems.value),
)

const letterSidebarSections = computed(() => [
	{
		id: 'letter-sidebar-mismatch',
		title: `Не соответствует (${letterModalMismatchItems.value.length})`,
		titleClass: 'text-error',
		groups: letterGroupedMismatch.value,
	},
	{
		id: 'letter-sidebar-not-found',
		title: `Не найдено (${letterModalNotFoundItems.value.length})`,
		titleClass: 'text-neutral',
		groups: letterGroupedNotFound.value,
	},
	{
		id: 'letter-sidebar-partial',
		title: `Частично (${letterModalPartialItems.value.length})`,
		titleClass: 'text-warning',
		groups: letterGroupedPartial.value,
	},
].filter((section) => section.groups.length > 0))

function letterSelectionStorageKey() {
	const analysisId = analysis.value?.id
	const supplierId = selectedSupplierId.value
	const primaryKp = selectedSupplierPrimaryKp.value ?? analysis.value?.kp_filename
	if (!analysisId) return null
	return `tz-letter-selection:${analysisId}:${supplierId ?? '_'}:${primaryKp ?? '_'}`
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

function selectPrimaryKpLetterItems() {
	if (!analysis.value) return
	tzSelectedIndices.value = letterItemsView.value
		.filter((item) => belongsToPrimaryKp(item) && isTzSelectable(item.status))
		.map((item) => item._index)
	saveLetterSelection()
}

function restoreOrInitLetterSelection() {
	const selectable = new Set(
		letterSelectableItems.value.map((item) => item._index),
	)
	if (selectable.size === 0) {
		tzSelectedIndices.value = []
		return
	}
	const saved = loadLetterSelection()
	if (saved?.length) {
		const restored = saved.filter((index) => selectable.has(index))
		if (restored.length) {
			tzSelectedIndices.value = restored
			return
		}
	}
	selectPrimaryKpLetterItems()
}

function letterMismatchReason(item: TZAnalysisItem) {
	if (item.status === 'not_found') {
		return `Параметр не найден: ${item.explanation}`
	}
	return `Причина отклонения: ${item.explanation}`
}

function itemMatchesRequirementSearch(
	item: TZAnalysisItem,
	query: string,
): boolean {
	const q = query.trim().toLowerCase()
	if (!q) return true
	const haystack = [
		item.requirement,
		item.requirement_ref,
		item.ref,
		item.ref_value,
		item.offer_value,
		item.offer_ref,
		item.explanation,
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase()
	return haystack.includes(q)
}

const filteredTzItems = computed((): TZItemView[] => {
	if (!analysis.value) return []
	const query = tzRequirementSearch.value
	return applyItemOverrides(analysis.value.items)
		.map((item, index) => ({ ...item, _index: index }))
		.filter((item) =>
			(tzStatusFilter.value === 'all' || item.status === tzStatusFilter.value)
			&& itemMatchesRequirementSearch(item, query),
		)
})

const resultTreesByGroupId = computed(() => {
	const map = new Map<number, ReturnType<typeof buildResultTree>>()
	for (const group of visibleKpItemGroups.value) {
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

function allItemViewsWithOverrides(): TZItemView[] {
	if (!analysis.value) return []
	return applyItemOverrides(analysis.value.items)
		.map((item, index) => ({ ...item, _index: index }))
}

function itemsForSupplier(
	supplier: TZAnalysisSupplierItem | null,
): TZItemView[] {
	const items = allItemViewsWithOverrides()
	if (!supplier) return items
	return items.filter((item) =>
		isKpScopedToSupplier(getItemKpKey(item), supplier.name),
	)
}

function computeStatsFromItems(items: TZAnalysisItem[]): TZAnalysisKpStats {
	const met = items.filter((item) => item.status === 'met').length
	const partial = items.filter((item) => item.status === 'partial').length
	const missing = items.filter((item) => item.status === 'missing').length
	const not_found = items.filter((item) => item.status === 'not_found').length
	const total = items.length
	return {
		match_score: total === 0 ? 0 : Math.round((met + 0.5 * partial) / total * 100),
		met_count: met,
		partial_count: partial,
		missing_count: missing,
		not_found_count: not_found,
	}
}

function getItemKpKey(item: TZAnalysisItem): string {
	const filenames = displayKpFilenames.value
	return item.kp_name || filenames[0] || '_default'
}

function resolveItemKpKey(
	item: TZAnalysisItem,
	supplierName?: string | null,
): string {
	const raw = getItemKpKey(item)
	if (!supplierName || parseScopedKpName(raw)) {
		return raw
	}
	return scopedKpDisplayName(supplierName, kpDisplayLabel(raw))
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
	return resolveItemKpKey(item, selectedSupplier.value?.name) === primary
}

function countLetterGroupItems(groups: LetterGroup[]): number {
	return groups.reduce((total, group) => total + group.items.length, 0)
}

function getKpStats(kpKey: string): TZAnalysisKpStats | null {
	const items = allItemViewsWithOverrides().filter(
		(item) => getItemKpKey(item) === kpKey,
	)
	if (items.length === 0) return null
	return computeStatsFromItems(items)
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

const displayedTzRequirementsRows = computed(() =>
	isTzConfirmed.value
		? flattenRequirementsToRows(analysis.value?.requirements_tz)
		: editableRequirementsTz.value,
)
const displayedTzCount = computed(() =>
	countRequirementRows(displayedTzRequirementsRows.value),
)
const showComparisonResultsCard = computed(() =>
	hasComparisonResults.value
	&& !isKpProcessing.value
	&& visibleKpItemGroups.value.length > 0,
)

function requirementRowsSignature(rows: EditableRequirementRow[]): string {
	return JSON.stringify(
		rows.map((row) => ({
			key: row.key,
			text: row.text,
			isHeading: row.isHeading ?? false,
		})),
	)
}

function syncEditableRequirements(data: TZAnalysisSession) {
	const nextTz = flattenRequirementsToRows(data.requirements_tz)
	if (requirementRowsSignature(nextTz) !== requirementRowsSignature(editableRequirementsTz.value)) {
		editableRequirementsTz.value = nextTz
	}
	const kpSource = data.requirements_kp ?? {}
	const filenames = data.kp_filenames?.length
		? data.kp_filenames
		: data.kp_filename
			? [data.kp_filename]
			: Object.keys(kpSource)
	const nextKp = Object.fromEntries(
		filenames.map((name) => [name, flattenRequirementsToRows(kpSource[name])]),
	)
	const kpKeys = [...new Set([...Object.keys(editableRequirementsKp.value), ...filenames])]
	const kpChanged = kpKeys.some((name) => {
		const prev = editableRequirementsKp.value[name] ?? []
		const next = nextKp[name] ?? []
		return requirementRowsSignature(prev) !== requirementRowsSignature(next)
	})
	if (kpChanged) {
		editableRequirementsKp.value = nextKp
	}
}

function buildAnalysisPollSignature(data: TZAnalysisSession): string {
	return JSON.stringify({
		status: data.status,
		confirmed: data.confirmed,
		items: data.items?.length ?? 0,
		requirementsTz: requirementRowsSignature(
			flattenRequirementsToRows(data.requirements_tz),
		),
		suppliers: (data.suppliers ?? []).map((supplier) => ({
			id: supplier.id,
			status: supplier.status,
			kpCount: supplier.kp_filenames.length,
			primary: supplier.primary_kp_filename,
		})),
		kpStats: Object.keys(data.kp_stats ?? {}).sort().join(','),
		overrides: Object.keys(data.items_overrides ?? {}).length,
	})
}

let lastAnalysisPollSignature = ''
let lastAppliedItemsCount = 0

function nextTopLevelKey(rows: EditableRequirementRow[]): string {
	const maxTop = rows.reduce((max, row) => {
		const top = Number(row.key.split(/[./]/)[0])
		return Number.isNaN(top) ? max : Math.max(max, top)
	}, 0)
	return String(maxTop + 1)
}

function updateEditableRequirementsTz(
	mutator: (rows: EditableRequirementRow[]) => EditableRequirementRow[],
) {
	editableRequirementsTz.value = renumberRequirementRows(
		mutator(editableRequirementsTz.value),
	)
}

function addTzRequirement() {
	updateEditableRequirementsTz((rows) => [
		...rows,
		{ key: nextTopLevelKey(rows), text: '' },
	])
}

function addTzChildRequirement(parentKey: string) {
	const parentNorm = parentKey.trim().replace(/\//g, '.')
	updateEditableRequirementsTz((rows) => {
		const withHeading = rows.map((row) =>
			row.key.trim().replace(/\//g, '.') === parentNorm
				? { ...row, isHeading: true }
				: row,
		)
		return insertChildAfterParentRow(withHeading, parentKey)
	})
}

function addTzHeadingRequirement(parentKey: string) {
	updateEditableRequirementsTz((rows) =>
		insertChildAfterParentRow(rows, parentKey, { isHeading: true }),
	)
}

function removeTzRequirement(index: number) {
	updateEditableRequirementsTz((rows) =>
		rows.filter((_, idx) => idx !== index),
	)
}

function addTzSiblingRequirement(afterIndex: number) {
	const [, end] = getRowSubtreeRange(editableRequirementsTz.value, afterIndex)
	const insertIndex = end + 1
	updateEditableRequirementsTz((rows) =>
		insertSiblingAfterRow(rows, afterIndex),
	)
	const inserted = editableRequirementsTz.value[insertIndex]
	const rowKey = inserted?.key ?? ''
	const scopeId = isTzConfirmed.value ? 'tz-results' : 'tz-review'
	const isTopLevel = rowKey.length > 0 && !rowKey.includes('.')
	toast.add({
		title: isTopLevel ? `Добавлен раздел ${rowKey}` : `Добавлен пункт ${rowKey}`,
		color: 'success',
		icon: 'i-lucide-check',
	})
	nextTick(() => {
		const el = document.querySelector(
			`[data-row-key="${scopeId}:${rowKey}"]`,
		)
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	})
}

function reorderTzRequirement(fromIndex: number, toIndex: number) {
	updateEditableRequirementsTz((rows) =>
		moveRequirementRowBlock(rows, fromIndex, toIndex),
	)
}

const canRunKpAnalysis = computed(() =>
	!isCompleted.value
	&& isTzConfirmed.value
	&& requirementsRowsNonempty(editableRequirementsTz.value)
	&& hasSuppliersWithFiles.value
	&& hasPendingSuppliers.value
	&& canRunTzAnalysis.value,
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
		tzSelectedIndices.value.includes(item._index),
	),
)

const selectedLetterGroups = computed(() =>
	groupItemsByRef(selectedLetterItems.value),
)

const letterItemsByTab = computed(() => ({
	mismatch: selectedLetterGroups.value.filter((group) => group.status === 'missing'),
	not_found: selectedLetterGroups.value.filter((group) => group.status === 'not_found'),
	partial: selectedLetterGroups.value.filter((group) => group.status === 'partial'),
}))

const letterPreviewTabs = computed(() => {
	const mismatchSelected = countLetterGroupItems(letterItemsByTab.value.mismatch)
	const notFoundSelected = countLetterGroupItems(letterItemsByTab.value.not_found)
	const partialSelected = countLetterGroupItems(letterItemsByTab.value.partial)
	return [
		{
			label: mismatchSelected
				? `Не соответствует (${mismatchSelected})`
				: 'Не соответствует',
			value: 'mismatch' as const,
			color: 'error' as const,
			disabled: letterGroupedMismatch.value.length === 0,
		},
		{
			label: notFoundSelected
				? `Не найдено (${notFoundSelected})`
				: 'Не найдено',
			value: 'not_found' as const,
			color: 'neutral' as const,
			disabled: letterGroupedNotFound.value.length === 0,
		},
		{
			label: partialSelected
				? `Частично (${partialSelected})`
				: 'Частично',
			value: 'partial' as const,
			color: 'warning' as const,
			disabled: letterGroupedPartial.value.length === 0,
		},
	]
})

function formatGroupRequirementLine(group: LetterGroup): string {
	if (group.refValue?.trim()) {
		return group.refValue.trim()
	}
	return formatLetterRequirementLine(
		group.items[0]!,
		analysis.value?.requirements_tz,
	)
}

function formatGroupRequirementRef(group: LetterGroup): string | null {
	if (group.refValue?.trim()) return null
	return formatLetterRequirementRef(
		group.items[0]!,
		analysis.value?.requirements_tz,
	)
}

function buildDraftLetterParagraphs(): string[] {
	const { mismatch, not_found, partial } = letterItemsByTab.value
	const lines: string[] = [
		'О несоответствии предложения техническим требованиям',
		'',
		'Проведён анализ вашего предложения по соответствию техническому заданию.',
		'Выявлены следующие замечания и требуемые уточнения:',
	]

	let itemNum = 1

	if (mismatch.length) {
		lines.push('', LETTER_MISMATCH_HEADER)
		for (const group of mismatch) {
			const requirementLine = formatGroupRequirementLine(group)
			const requirementRef = formatGroupRequirementRef(group)
			lines.push(`${itemNum}. По пункту:`)
			lines.push(
				`Требование: "${requirementLine}"`
				+ (requirementRef ? ` (${requirementRef})` : ''),
			)
			for (const item of group.items) {
				if (item.offer_value) {
					lines.push(
						`Предложено: "${item.offer_value}"`
						+ (item.offer_ref ? ` (${item.offer_ref})` : ''),
					)
				}
				lines.push(letterMismatchReason(item))
			}
			itemNum += 1
		}
	}

	if (not_found.length) {
		lines.push('', LETTER_NOT_FOUND_HEADER)
		for (const group of not_found) {
			const requirementLine = formatGroupRequirementLine(group)
			const requirementRef = formatGroupRequirementRef(group)
			lines.push(`${itemNum}. По пункту:`)
			lines.push(
				`Требование: "${requirementLine}"`
				+ (requirementRef ? ` (${requirementRef})` : ''),
			)
			for (const item of group.items) {
				lines.push(letterMismatchReason(item))
			}
			itemNum += 1
		}
	}

	if (partial.length) {
		lines.push('', LETTER_PARTIAL_HEADER)
		for (const group of partial) {
			const requirementLine = formatGroupRequirementLine(group)
			const requirementRef = formatGroupRequirementRef(group)
			lines.push(`${itemNum}. Пункт:`)
			lines.push(
				`Требуется: "${requirementLine}"`
				+ (requirementRef ? ` (${requirementRef})` : ''),
			)
			for (const item of group.items) {
				if (item.offer_value) {
					lines.push(
						`Предложено: "${item.offer_value}"`
						+ (item.offer_ref ? ` (${item.offer_ref})` : ''),
					)
				}
				lines.push(`Необходимо: ${item.explanation}`)
			}
			itemNum += 1
		}
	}

	const deadline = docxDeadline.value.trim() || '7 дней'
	lines.push(
		'',
		`${LETTER_DEADLINE_PREFIX}${deadline}.`,
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
	const raw = letterTextareaRef.value
	const root = raw?.$el ?? raw
	if (root instanceof HTMLTextAreaElement) return root
	if (!(root instanceof HTMLElement)) return null
	const el = root.querySelector('textarea')
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
	return `${LETTER_DEADLINE_PREFIX}${deadline}.`
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

function scrollToLetterSection(section: 'mismatch' | 'not_found' | 'partial') {
	const tab = letterPreviewTabs.value.find((t) => t.value === section)
	if (tab?.disabled) return
	letterPreviewTab.value = section
	const headerBySection = {
		mismatch: LETTER_MISMATCH_HEADER,
		not_found: LETTER_NOT_FOUND_HEADER,
		partial: LETTER_PARTIAL_HEADER,
	} as const
	const header = headerBySection[section]
	nextTick(() => {
		const textarea = getLetterTextarea()
		if (textarea) {
			const idx = letterEditorText.value.indexOf(header)
			if (idx >= 0) {
				textarea.focus()
				textarea.setSelectionRange(idx, idx + header.length)
				const lineCount = letterEditorText.value.slice(0, idx).split('\n').length
				textarea.scrollTop = Math.max(0, (lineCount - 2) * 22)
			}
		}
	})
}

type ApplyAnalysisOptions = {
	fromPoll?: boolean
}

function applyAnalysis(
	data: TZAnalysisSession,
	options: ApplyAnalysisOptions = {},
) {
	const fromPoll = options.fromPoll === true
	const pollSignature = buildAnalysisPollSignature(data)

	if (fromPoll) {
		if (pollSignature === lastAnalysisPollSignature) return
		lastAnalysisPollSignature = pollSignature
	} else {
		lastAnalysisPollSignature = pollSignature
	}

	const itemsCount = data.items?.length ?? 0
	const skipRequirementsSync = fromPoll && (
		data.confirmed
		|| data.status === TZAnalysisRunStatus.PROCESSING
	)

	analysis.value = data

	if (skipRequirementsSync) {
		const overrides = data.items_overrides ?? {}
		for (const [key, value] of Object.entries(overrides)) {
			if (!itemsOverrides.value[key]) {
				itemsOverrides.value[key] = value
			}
		}
		if (data.confirmed) {
			syncEditableRequirements(data)
		}
	} else {
		itemsOverrides.value = { ...(data.items_overrides ?? {}) }
		syncEditableRequirements(data)
	}

	ensureSelectedSupplier()
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
		!fromPoll
		&& data.confirmed
		&& !userPickedContentTab.value
		&& !isAnalysisClosed.value
	) {
		skipTabPickHandler = true
		activeContentTab.value = 'kp'
		skipTabPickHandler = false
		deferKpPanelRender()
	}
	if (
		data.status === TZAnalysisRunStatus.ACTIVE
		&& data.confirmed
		&& itemsCount > 0
	) {
		ensureResultsKpExpanded(
			collectResultsKpKeys(data).filter((key) => {
				const supplier = selectedSupplier.value
				if (!supplier) return true
				return isKpScopedToSupplier(key, supplier.name)
			}),
		)
		if (!fromPoll || itemsCount !== lastAppliedItemsCount) {
			restoreOrInitLetterSelection()
			scheduleLetterPreview()
		}
	}
	lastAppliedItemsCount = itemsCount
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
	(data: TZAnalysisSession) => { applyAnalysis(data, { fromPoll: true }) },
	() => {
		const title = (analysis.value?.items?.length ?? 0) > 0
			? 'Сравнение ТЗ и КП завершено'
			: analysis.value?.confirmed
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
	if (showLetterModal.value) scheduleLetterPreview()
})

watch(displayedSupplierId, () => {
	restoreOrInitLetterSelection()
	if (showLetterModal.value) scheduleLetterPreview()
})

function deferKpPanelRender() {
	kpPanelLoading.value = true
	requestAnimationFrame(() => {
		nextTick(() => {
			requestAnimationFrame(() => {
				kpPanelLoading.value = false
			})
		})
	})
}

function onUserTabPick(tab: string | number) {
	if (skipTabPickHandler) return
	userPickedContentTab.value = true
	if (tab === 'kp') {
		deferKpPanelRender()
	}
}

function onSelectSupplier(supplierId: string) {
	if (supplierId === selectedSupplierId.value) return
	selectedSupplierId.value = supplierId
	if (activeContentTab.value !== 'kp') {
		displayedSupplierId.value = supplierId
		return
	}
	supplierResultsLoading.value = true
	requestAnimationFrame(() => {
		displayedSupplierId.value = supplierId
		nextTick(() => {
			requestAnimationFrame(() => {
				supplierResultsLoading.value = false
			})
		})
	})
}

watch(isAnalysisClosed, (closed) => {
	if (closed) {
		skipTabPickHandler = true
		activeContentTab.value = 'tz'
		skipTabPickHandler = false
	}
})

watch(showLetterModal, (open) => {
	if (!open) {
		letterEditorDirty.value = false
		return
	}
	restoreOrInitLetterSelection()
	if (letterModalMismatchItems.value.length > 0) letterPreviewTab.value = 'mismatch'
	else if (letterModalNotFoundItems.value.length > 0) letterPreviewTab.value = 'not_found'
	else if (letterModalPartialItems.value.length > 0) letterPreviewTab.value = 'partial'
	letterEditorDirty.value = false
	syncLetterEditor(true)
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
	const { mismatch, not_found, partial } = letterItemsByTab.value
	if (letterPreviewTab.value === 'mismatch' && mismatch.length === 0) {
		if (not_found.length > 0) letterPreviewTab.value = 'not_found'
		else if (partial.length > 0) letterPreviewTab.value = 'partial'
	} else if (letterPreviewTab.value === 'not_found' && not_found.length === 0) {
		if (mismatch.length > 0) letterPreviewTab.value = 'mismatch'
		else if (partial.length > 0) letterPreviewTab.value = 'partial'
	} else if (letterPreviewTab.value === 'partial' && partial.length === 0) {
		if (mismatch.length > 0) letterPreviewTab.value = 'mismatch'
		else if (not_found.length > 0) letterPreviewTab.value = 'not_found'
	}
}, { deep: true })

onMounted(async () => {
	try {
		user.value = await get<UserResponse>('/auth/me')
	} catch {
		user.value = null
	}
	await fetchAnalysis()
})

function validateAndSetFile(
	file: File | null | undefined,
	target: Ref<File | null>,
) {
	if (!file) {
		target.value = null
		return
	}
	if (file.size > maxUploadSize.value) {
		toast.add({
			title: 'Файл слишком большой',
			description: `${file.name} превышает ${formatUploadLimitMb(maxUploadSize.value)}`,
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

async function runTzAnalysis() {
	if (!tzFile.value || !analysis.value?.id || !canRunTzAnalysis.value) return
	tzAnalyzing.value = true
	try {
		const fd = new FormData()
		fd.append('tz_file', tzFile.value)
		const result = await post<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/run`,
			fd,
		)
		processingPhase.value = 'tz'
		applyAnalysis(result)
		if (result.status === TZAnalysisRunStatus.PROCESSING) {
			tzPolling.value = true
		}
	} catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? 'Ошибка запуска анализа',
			description: isSubscriptionApiError(e)
				? 'Проверьте подключённые модули в разделе «Подписка».'
				: undefined,
			color: 'error',
			icon: 'i-lucide-circle-alert',
			actions: isSubscriptionApiError(e)
				? [{
					label: 'Подписка',
					onClick: openSubscriptionProfile,
				}]
				: undefined,
		})
	} finally {
		tzAnalyzing.value = false
	}
}

async function confirmTzRequirements() {
	if (!analysis.value?.id || confirmingTz.value) return
	if (!requirementsRowsNonempty(editableRequirementsTz.value)) {
		toast.add({
			title: 'Добавьте хотя бы одно требование из ТЗ',
			color: 'warning',
		})
		return
	}
	confirmingTz.value = true
	try {
		const rows = renumberRequirementRows(editableRequirementsTz.value)
		editableRequirementsTz.value = rows
		const hierarchy = rowsToHierarchy(rows)
		await patch<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/requirements`,
			{ requirements_tz: hierarchy },
		)
		const result = await post<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/confirm`,
			{ requirements_tz: hierarchy },
		)
		userPickedContentTab.value = false
		applyAnalysis(result)
		skipTabPickHandler = true
		activeContentTab.value = 'kp'
		skipTabPickHandler = false
		deferKpPanelRender()
		toast.add({
			title: 'Требования подтверждены',
			description: 'Теперь добавьте поставщиков и загрузите КП.',
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? 'Не удалось подтвердить требования',
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	} finally {
		confirmingTz.value = false
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
			toast.add({
				title: 'Сначала подтвердите требования ТЗ',
				color: 'warning',
			})
			return
		}

		const result = await post<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/run-kp`,
			new FormData(),
		)
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
		toast.add({
			title: getApiErrorDetail(e) ?? 'Ошибка запуска анализа КП',
			description: isSubscriptionApiError(e)
				? 'Проверьте лимиты и модули в разделе «Подписка».'
				: undefined,
			color: 'error',
			icon: 'i-lucide-circle-alert',
			actions: isSubscriptionApiError(e)
				? [{
					label: 'Подписка',
					onClick: openSubscriptionProfile,
				}]
				: undefined,
		})
	} finally {
		kpAnalyzing.value = false
	}
}

function openLetterModal() {
	if (!hasLetterIssues.value) {
		toast.add({
			title: 'Нет несоответствий',
			description: 'Для выбранного КП нет пунктов для письма поставщику.',
			color: 'warning',
		})
		return
	}
	if (letterModalMismatchItems.value.length > 0) letterPreviewTab.value = 'mismatch'
	else if (letterModalNotFoundItems.value.length > 0) letterPreviewTab.value = 'not_found'
	else letterPreviewTab.value = 'partial'
	showLetterModal.value = true
}

async function updateItemStatus(index: number, status: TZAnalysisStatus) {
	if (!analysis.value?.id || overrideSaving.value) return
	overrideSaving.value = true
	const prevOverrides = { ...itemsOverrides.value }
	const overrideKey = String(index)
	const nextOverrides = {
		...itemsOverrides.value,
		[overrideKey]: { status },
	}
	itemsOverrides.value = nextOverrides
	try {
		await patch<TZAnalysisSession>(
			`/tz-analysis/${analysis.value.id}/items-overrides`,
			{ overrides: nextOverrides },
		)
		if (analysis.value) {
			analysis.value = {
				...analysis.value,
				items_overrides: { ...nextOverrides },
			}
		}
	} catch (e: unknown) {
		itemsOverrides.value = prevOverrides
		const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось сохранить статус',
			color: 'error',
		})
	} finally {
		overrideSaving.value = false
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

async function exportTzXlsx() {
	if (!analysis.value?.id) return
	await downloadBlob(
		`/tz-analysis/${analysis.value.id}/export.xlsx`,
		`tz_analysis_${analysis.value.id}.xlsx`,
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
