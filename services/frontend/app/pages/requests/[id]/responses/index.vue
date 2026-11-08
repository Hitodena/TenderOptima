<template>
	<div class="w-full">
		<div class="fixed inset-x-0 bottom-0 top-0 md:top-14 lg:top-20 z-10 flex flex-col overflow-hidden bg-default">
			<UContainer class="max-w-[1600px] py-0 flex flex-1 flex-col min-h-0 h-full w-full">
				<div
					v-if="isMobile && !(selectedRsId && mainTab === 'thread')"
					class="shrink-0 space-y-2.5 border-b border-default bg-default px-2 pt-1 pb-3"
				>
					<div class="flex items-center gap-1">
						<UButton
							variant="ghost"
							color="neutral"
							size="xl"
							icon="i-lucide-chevron-left"
							class="shrink-0"
							:to="`/requests/${id}`"
							aria-label="К заявке"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold">
								{{ requestQuery || 'Ответы поставщиков' }}
								<UBadge v-if="isDemo" color="warning" variant="subtle" size="sm" class="ml-1 align-middle">Пример запроса</UBadge>
							</p>
							<p class="truncate text-xs text-muted">{{ mobileThreadsSummary }}</p>
						</div>
						<UButton
							variant="ghost"
							color="neutral"
							size="xl"
							icon="i-lucide-refresh-cw"
							class="shrink-0"
							:loading="refreshingAll"
							aria-label="Обновить анализ по всем поставщикам"
							@click="refreshAll"
						/>
					</div>
					<div role="tablist" class="mx-2 grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1">
						<button
							type="button"
							role="tab"
							:aria-selected="mainTab === 'thread'"
							class="h-9 rounded-lg text-sm transition-colors"
							:class="mainTab === 'thread' ? 'bg-default font-semibold shadow-sm' : 'font-medium text-muted'"
							@click="mainTab = 'thread'"
						>
							{{ t('inbox.threadTab') }}
						</button>
						<button
							type="button"
							role="tab"
							:aria-selected="mainTab === 'comparison'"
							class="h-9 rounded-lg text-sm transition-colors"
							:class="mainTab === 'comparison' ? 'bg-default font-semibold shadow-sm' : 'font-medium text-muted'"
							@click="mainTab = 'comparison'"
						>
							{{ t('inbox.comparisonTab') }}
						</button>
					</div>
				</div>
				<div
					v-if="!isMobile"
					class="shrink-0 flex items-center justify-between gap-2 px-3 md:px-4 py-2 border-b border-default bg-default/95 backdrop-blur supports-backdrop-filter:bg-default/80"
				>
					<div class="flex items-center gap-1 min-w-0">
						<UButton
							v-if="isMobile && selectedRsId && mainTab === 'thread'"
							variant="ghost"
							color="neutral"
							size="xs"
							icon="i-lucide-arrow-left"
							class="shrink-0"
							@click="selectedRsId = null"
						/>
						<UButton
							variant="ghost"
							color="neutral"
							size="xs"
							leading-icon="i-lucide-arrow-left"
							to="/requests/history"
						>
							<span class="hidden sm:inline">К запросам</span>
						</UButton>
						<UButton
							variant="ghost"
							color="neutral"
							size="xs"
							leading-icon="i-lucide-users"
							:to="`/requests/${id}`"
						>
							<span class="hidden sm:inline">К запросу</span>
						</UButton>
						<UBadge v-if="isDemo" color="warning" variant="subtle" size="sm" class="ml-1">Пример запроса</UBadge>
					</div>

					<div class="flex gap-1 rounded-xl bg-elevated p-1 shadow-inner shrink-0">
						<button
							type="button"
							class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
							:class="mainTab === 'thread'
								? 'bg-primary text-inverted shadow-sm'
								: 'text-muted hover:bg-default hover:text-default'"
							@click="mainTab = 'thread'"
						>
							{{ t('inbox.threadTab') }}
						</button>
						<button
							type="button"
							class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
							:class="mainTab === 'comparison'
								? 'bg-primary text-inverted shadow-sm'
								: 'text-muted hover:bg-default hover:text-default'"
							@click="mainTab = 'comparison'"
						>
							{{ t('inbox.comparisonTab') }}
						</button>
					</div>

					<UButton
						variant="ghost"
						color="neutral"
						size="xs"
						icon="i-lucide-refresh-cw"
						class="shrink-0"
						:loading="refreshingAll"
						title="Обновить анализ по всем поставщикам"
						@click="refreshAll"
					/>
				</div>

				<div class="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
					<div
						v-show="mainTab !== 'comparison'"
						class="shrink-0 border-r border-default flex flex-col min-h-0"
						:class="[isMobile && selectedRsId ? 'hidden' : 'flex', 'w-full md:w-72 lg:w-80 xl:w-96']"
					>

				<div class="px-3 py-2 border-b border-default space-y-2 shrink-0">
					<UInput
v-model="threadSearch" placeholder="Поиск по поставщику или email" icon="i-lucide-search" :size="isMobile ? 'lg' : 'sm'"
						class="w-full" />
					<div class="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:gap-1 md:px-0" role="group" aria-label="Фильтр поставщиков">
						<button
							v-for="f in threadFilterOptions"
							:key="f.value"
							type="button"
							class="shrink-0 text-sm px-3 py-1.5 md:text-[11px] md:px-2 md:py-0.5 rounded-full border transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
							:class="threadFilter === f.value
								? 'bg-inverted text-inverted border-inverted'
								: 'border-default text-muted hover:text-default hover:border-accented'"
							:aria-pressed="threadFilter === f.value"
							@click="threadFilter = f.value"
						>
							{{ f.label }} <span class="font-semibold tabular-nums">{{ threadFilterCounts[f.value] }}</span>
						</button>
					</div>
					<USelect v-model="threadSort" :items="threadSortOptions" :size="isMobile ? 'md' : 'sm'" class="w-full" />
				</div>

				<div class="flex-1 overflow-y-auto">
					<div v-if="loadingThreads" class="space-y-2 p-3">
						<USkeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-xl" />
					</div>

					<div
v-else-if="sortedThreads.length === 0"
						class="flex flex-col items-center justify-center py-12 gap-2 px-4">
						<UIcon name="i-lucide-mail-open" class="w-8 h-8 text-muted opacity-40" />
						<p class="text-sm text-muted text-center">
							{{ threadSearch || threadFilter !== 'all' ? 'Ничего не найдено' : 'Ответов пока нет' }}
						</p>
					</div>

					<div
						v-for="thread in sortedThreads"
						:key="thread.rs_id"
						class="relative flex items-stretch border-b border-default/50"
						:class="selectedRsId === thread.rs_id ? 'bg-primary/5' : ''">
						<span
							v-if="selectedRsId === thread.rs_id"
							class="absolute inset-y-0 left-0 w-0.5 bg-primary"
							aria-hidden="true"
						/>
						<button
							type="button"
							class="flex-1 min-w-0 text-left pl-4 pr-1 py-3 hover:bg-elevated/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
							:aria-current="selectedRsId === thread.rs_id ? 'true' : undefined"
							@click="selectThread(thread.rs_id)">
						<div class="flex items-start gap-3">
							<span
								class="w-9 h-9 rounded-lg grid place-items-center shrink-0 text-xs font-bold"
								:class="thread.message_count > 0 ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
								aria-hidden="true"
							>{{ companyInitials(thread.supplier.company_name) }}</span>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-1.5 min-w-0">
									<span v-if="thread.unread" class="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Не прочитано" />
									<p
										class="text-[15px] md:text-[13px] leading-snug truncate min-w-0"
										:class="thread.unread ? 'font-bold' : 'font-semibold'"
										:title="thread.supplier.company_name"
									>
										{{ thread.supplier.company_name }}
									</p>
									<UBadge v-if="isDemo" color="warning" variant="subtle" size="sm" class="shrink-0">Пример ответа</UBadge>
									<span class="ml-auto text-[11px] text-dimmed whitespace-nowrap shrink-0 tabular-nums">
										{{ thread.last_message?.received_at
											? formatDateShort(thread.last_message.received_at)
											: '' }}
									</span>
								</div>
								<p class="text-sm md:text-xs mt-0.5 line-clamp-2 break-words" :class="thread.last_message ? 'text-default' : 'text-muted'">
									<span v-if="thread.last_message?.direction === 'outgoing'" class="text-muted">Вы: </span>{{ threadPreview(thread) }}
								</p>
								<div class="flex items-center gap-2 mt-1.5 text-[11px] text-muted">
									<span
										v-if="threadState(thread) !== 'awaiting'"
										class="font-semibold px-1.5 py-px rounded"
										:class="threadStateClass(threadState(thread))"
									>{{ THREAD_STATE_LABEL[threadState(thread)] }}</span>
									<span
										v-if="thread.message_count > 0"
										class="tabular-nums"
										:title="incomingCountLabel(thread.message_count)"
									>{{ incomingLettersLabel(thread.message_count) }}</span>
								</div>
							</div>
						</div>
						</button>
						<div class="hidden md:flex items-center px-2 shrink-0">
							<UButton
								size="xs"
								color="neutral"
								variant="ghost"
								icon="i-lucide-database"
								:title="t('inbox.saveToDatabase')"
								:aria-label="t('inbox.saveToDatabase')"
								@click.stop="openSaveToBookmarkModal(thread.supplier)"
							/>
						</div>
					</div>
				</div>
			</div>

			<div
				class="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden"
				:class="isMobile && !selectedRsId && mainTab !== 'comparison' ? 'hidden' : 'flex'">

				<template v-if="mainTab === 'comparison'">
					<div class="flex-1 flex flex-col min-h-0 min-w-0">
						<div class="flex-1 flex flex-col min-h-0 min-w-0 px-3 md:px-5 py-4">
							<div v-if="loadingComparison" class="space-y-3">
								<USkeleton v-for="i in 6" :key="i" class="h-10 w-full rounded-lg" />
							</div>
							<div
v-else-if="!comparison?.requirements.length"
								class="flex flex-col items-center justify-center py-16 gap-2 text-muted">
								<UIcon name="i-lucide-table" class="w-10 h-10 opacity-20" />
								<p class="text-sm">Нет требований для сравнения</p>
							</div>
							<div
v-else-if="comparison.suppliers.length === 0"
								class="flex flex-col items-center justify-center py-16 gap-2 text-muted">
								<UIcon name="i-lucide-users" class="w-10 h-10 opacity-20" />
								<p class="text-sm">Нет проанализированных ответов</p>
							</div>
							<InboxComparisonMobile
								v-else-if="isMobile"
								data-tour="comparison"
								class="-mx-3 -my-4"
								:requirements="comparison.requirements"
								:price-requirements="priceRequirements"
								:price-units="comparison.price_units ?? {}"
								:suppliers="comparison.suppliers"
								:has-confirmed-winner="hasConfirmedWinner"
								:exporting="exportingComparison"
								:unit-price-label="UNIT_PRICE_REQUIREMENT"
								:position-title="positionPriceTitle"
								:display-value="comparisonDisplayValue"
								:percent="formatPercentVsMin"
								:compliance="complianceForSupplier"
								:has-mismatches="supplierHasLetterMismatches"
								@open-thread="(s) => { mainTab = 'thread'; selectThread(s.rs_id) }"
								@letter="openLetterModal"
								@improve="openImproveModal"
								@winner="openWinnerModal"
								@clear-winner="openClearWinnerConfirm"
								@export="exportComparisonXlsx"
							/>
							<div
								v-else
								data-tour="comparison"
								class="min-w-0 flex-1 min-h-0 flex flex-col rounded-xl border border-default overflow-hidden"
							>
								<div
									v-if="priceRequirements.length"
									class="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-default bg-elevated/30"
								>
									<span class="text-xs text-muted">Сортировка по цене:</span>
									<UButton
										v-for="req in priceRequirements"
										:key="`sort-${req}`"
										size="xs"
										:variant="comparisonSortBy === req ? 'soft' : 'ghost'"
										:color="comparisonSortBy === req ? 'primary' : 'neutral'"
										class="max-w-56"
										@click="toggleComparisonSort(req)"
									>
										<span class="text-left leading-tight">
											<template v-if="positionPriceTitle(req)">
												<span class="block">{{ UNIT_PRICE_REQUIREMENT }}</span>
												<span class="block text-[10px] font-normal opacity-80">
													{{ positionPriceTitle(req) }}
												</span>
											</template>
											<template v-else>
												{{ req }}
											</template>
										</span>
										<UIcon
											v-if="comparisonSortBy === req"
											:name="comparisonSortAsc
												? 'i-lucide-arrow-up-narrow-wide'
												: 'i-lucide-arrow-down-wide-narrow'"
											class="w-3.5 h-3.5 ml-1 shrink-0"
										/>
									</UButton>
								</div>
								<div
									class="inbox-comparison-scroll flex-1 min-h-0 min-w-0 w-full max-w-full overflow-auto overscroll-contain"
									role="region"
									aria-label="Таблица сравнения поставщиков"
									tabindex="0"
								>
								<table class="w-max min-w-full text-sm">
									<thead>
										<tr class="border-b border-default bg-elevated/50">
											<th
												class="sticky left-0 z-10 bg-elevated/95 px-2 sm:px-3 py-2.5 text-left text-xs font-semibold w-28 min-w-28 max-w-28 sm:w-auto sm:min-w-40 sm:max-w-56 wrap-break-word whitespace-normal align-top">
												Требование
											</th>
											<th
v-for="supplier in sortedComparisonSuppliers" :key="supplier.rs_id"
												class="px-3 py-2.5 text-left text-xs font-semibold min-w-36 max-w-52 wrap-break-word whitespace-normal align-top">
												<button
													type="button"
													class="text-left w-full rounded-md -mx-1 px-1 py-0.5 hover:bg-elevated/80 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary transition-colors cursor-pointer"
													:title="t('inbox.openSupplierThread')"
													@click="selectThread(supplier.rs_id)"
												>
													<p class="wrap-break-word whitespace-normal">{{ supplier.company_name }}</p>
													<p class="text-[10px] text-muted font-normal wrap-break-word whitespace-normal">
														{{ supplier.main_email }}
													</p>
												</button>
											</th>
										</tr>
									</thead>
									<tbody>
										<tr
v-for="req in comparison.requirements" :key="req"
											class="border-b border-default/50 last:border-0">
											<td
												class="sticky left-0 z-10 bg-default px-2 sm:px-3 py-2.5 text-xs font-medium align-top wrap-break-word whitespace-normal w-28 min-w-28 max-w-28 sm:w-auto sm:min-w-0 sm:max-w-56">
												<button
													v-if="isPriceRequirement(req)"
													type="button"
													class="text-left hover:text-primary transition-colors"
													@click="toggleComparisonSort(req)"
												>
													<template v-if="positionPriceTitle(req)">
														<span class="block">{{ UNIT_PRICE_REQUIREMENT }}</span>
														<span class="block text-[10px] font-normal text-muted mt-0.5">
															{{ positionPriceTitle(req) }}
														</span>
													</template>
													<template v-else>
														{{ req }}
													</template>
												</button>
												<template v-else-if="positionPriceTitle(req)">
													<span class="block">{{ UNIT_PRICE_REQUIREMENT }}</span>
													<span class="block text-[10px] font-normal text-muted mt-0.5">
														{{ positionPriceTitle(req) }}
													</span>
												</template>
												<template v-else-if="shortRequirement(req) !== req">
													<span class="sm:hidden">{{ shortRequirement(req) }}</span>
													<span class="hidden sm:inline">{{ req }}</span>
												</template>
												<span v-else>{{ req }}</span>
												<span
													v-if="comparison.price_units?.[req]"
													class="block text-[10px] font-normal text-muted mt-0.5"
												>сравниваем за {{ comparison.price_units[req] }}</span>
											</td>
											<td
v-for="supplier in sortedComparisonSuppliers" :key="supplier.rs_id"
												class="px-3 py-2.5 align-top wrap-break-word whitespace-normal max-w-52">
												<div class="flex items-start gap-2">
													<div class="flex-1 min-w-0 space-y-1">
														<button
															v-if="comparisonDisplayValue(supplier, req) !== '—'"
															type="button"
															class="text-left text-xs wrap-break-word whitespace-normal rounded-md -mx-1 px-1 py-0.5 hover:bg-elevated/80 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary transition-colors cursor-pointer"
															:title="t('inbox.openSourceEmail')"
															@click="openSourceEmail(supplier, req)"
														>
															{{ comparisonDisplayValue(supplier, req) }}
														</button>
														<p
															v-else
															class="text-xs wrap-break-word whitespace-normal"
														>
															—
														</p>
														<p
															v-if="supplier.price_notes?.[req]"
															class="text-[10px] leading-snug wrap-break-word whitespace-normal"
															:class="supplier.percent_vs_min?.[req] == null ? 'text-warning' : 'text-muted'"
														>
															{{ supplier.price_notes[req] }}
														</p>
														<p
															v-if="formatPercentVsMin(supplier, req)"
															class="text-[10px] font-medium tabular-nums"
															:class="(supplier.percent_vs_min?.[req] ?? 0) <= 0
																? 'text-success'
																: 'text-warning'"
														>
															{{ formatPercentVsMin(supplier, req) }}
														</p>
														<p
															v-if="comparisonValueCalculated(supplier, req)"
															class="text-[10px] text-muted"
														>
															{{ t('inbox.calculatedValue') }}
														</p>
														<p
v-if="comparisonUserCorrected(supplier, req)"
															class="text-[10px] text-muted wrap-break-word whitespace-normal">
															<span class="line-through">{{
																supplier.corrected_from?.[req]
															}}</span>
															→ {{ supplier.values[req] }}
															<span class="text-primary/80">{{ t('inbox.correctedManually') }}</span>
														</p>
														<p
v-else-if="getOfferValueTrend(supplier.values[req], supplier.previous_values?.[req])"
															class="text-[10px] text-muted line-through wrap-break-word whitespace-normal">
															{{ supplier.previous_values?.[req] }}
														</p>
														<div
															v-if="comparisonShowStatusBadge(supplier, req)"
															class="flex items-center gap-1"
														>
															<UTooltip
v-if="comparisonExplanationTooltip(supplier, req)"
																:text="supplier.explanations?.[req] || ''">
																<UBadge
																	:color="comparisonStatusColor(supplier.statuses[req]!)"
																	variant="subtle" size="sm"
																	class="cursor-help">
																	{{ comparisonStatusLabel(supplier.statuses[req]!) }}
																</UBadge>
															</UTooltip>
															<UBadge
v-else
																:color="comparisonStatusColor(supplier.statuses[req]!)"
																variant="subtle" size="sm">
																{{ comparisonStatusLabel(supplier.statuses[req]!) }}
															</UBadge>
														</div>
													</div>
													<UIcon
														v-if="getOfferValueTrend(supplier.values[req], supplier.previous_values?.[req]) === 'up'"
														name="i-lucide-arrow-up" class="w-5 h-5 shrink-0 text-error mt-0.5"
														title="Значение выросло" />
													<UIcon
														v-else-if="getOfferValueTrend(supplier.values[req], supplier.previous_values?.[req]) === 'down'"
														name="i-lucide-arrow-down" class="w-5 h-5 shrink-0 text-primary mt-0.5"
														title="Значение снизилось" />
												</div>
											</td>
										</tr>
									</tbody>
									<tfoot>
										<tr class="border-t border-default bg-elevated/30">
											<td
												class="sticky left-0 z-10 bg-elevated/95 px-3 py-3 text-xs font-semibold align-middle">
												Проверка соответствия
											</td>
											<td
v-for="supplier in sortedComparisonSuppliers"
												:key="`compliance-${supplier.rs_id}`" class="px-3 py-3 align-middle">
												<UIcon
:name="complianceForSupplier(supplier).passed
													? 'i-lucide-circle-check'
													: 'i-lucide-circle-x'" class="w-5 h-5 shrink-0" :class="complianceForSupplier(supplier).passed
														? 'text-success'
														: 'text-error'" />
											</td>
										</tr>
										<tr class="border-t border-default/50 bg-elevated/20">
											<td
												class="sticky left-0 z-10 bg-elevated/95 px-3 py-3 text-xs font-semibold align-middle">
												<span class="sm:hidden">Запрос параметров</span>
												<span class="hidden sm:inline">Запросить отсутствующие параметры</span>
											</td>
											<td
v-for="supplier in sortedComparisonSuppliers"
												:key="`letter-${supplier.rs_id}`" class="px-3 py-3 align-middle">
												<UButton
v-if="supplierHasLetterMismatches(supplier)" size="xs"
													variant="outline" leading-icon="i-lucide-mail"
													@click="openLetterModal(supplier)">
													Запрос
												</UButton>
												<span v-else class="text-xs text-muted">—</span>
											</td>
										</tr>
										<tr class="border-t border-default/50 bg-elevated/20">
											<td
												class="sticky left-0 z-10 bg-elevated/95 px-3 py-3 text-xs font-semibold align-middle">
												Улучшить условия
											</td>
											<td
v-for="supplier in sortedComparisonSuppliers"
												:key="`improve-${supplier.rs_id}`" class="px-3 py-3 align-middle">
												<UButton
size="xs" variant="outline" leading-icon="i-lucide-sparkles"
													@click="openImproveModal(supplier)">
													Улучшить условия
												</UButton>
											</td>
										</tr>
										<tr class="border-t border-default/50 bg-elevated/20">
											<td
												class="sticky left-0 z-10 bg-elevated/95 px-3 py-3 text-xs font-semibold align-middle">
												Выбрать победителем
											</td>
											<td
v-for="supplier in sortedComparisonSuppliers"
												:key="`winner-${supplier.rs_id}`" class="px-3 py-3 align-middle">
												<UButton
													v-if="!hasConfirmedWinner"
													size="xs"
													color="primary"
													variant="soft"
													leading-icon="i-lucide-trophy"
													@click="openWinnerModal(supplier)"
												>
													Выбрать победителем
												</UButton>
												<div
													v-else-if="supplier.is_winner"
													class="flex flex-col items-start gap-1.5"
												>
													<UBadge
														color="primary"
														variant="subtle"
														size="sm"
														class="whitespace-nowrap"
													>
														Победитель
													</UBadge>
													<UButton
														size="xs"
														color="neutral"
														variant="ghost"
														leading-icon="i-lucide-x"
														@click="openClearWinnerConfirm"
													>
														Снять выбор
													</UButton>
												</div>
												<span v-else class="text-xs text-muted">—</span>
											</td>
										</tr>
									</tfoot>
								</table>
								</div>
							</div>
						</div>
						<div
v-if="!isMobile && comparison?.requirements.length && comparison?.suppliers.length"
							class="shrink-0 border-t border-default px-3 md:px-5 py-3 flex justify-end">
							<UButton
size="sm" variant="outline" leading-icon="i-lucide-download"
								:loading="exportingComparison" @click="exportComparisonXlsx">
								Экспорт XLSX
							</UButton>
						</div>
					</div>
				</template>

				<template v-else>
					<div v-if="!selectedRsId" class="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
						<UIcon name="i-lucide-mail" class="w-12 h-12 opacity-20" />
						<p class="text-sm">Выберите поставщика из списка</p>
					</div>

					<template v-else>
						<div
							class="px-3 md:px-5 py-2.5 flex items-center gap-3 shrink-0"
							:class="isMobile ? '' : 'border-b border-default'"
						>
							<UButton
								v-if="isMobile"
								size="xl"
								color="neutral"
								variant="ghost"
								icon="i-lucide-chevron-left"
								class="-ml-2 shrink-0"
								aria-label="К списку поставщиков"
								@click="() => { selectedRsId = null }"
							/>
							<span
								class="hidden sm:grid w-9 h-9 rounded-lg place-items-center shrink-0 text-xs font-bold bg-primary/10 text-primary"
								aria-hidden="true"
							>{{ companyInitials(selectedThread?.supplier.company_name || '') }}</span>
							<div class="min-w-0 flex-1">
								<p class="font-semibold truncate text-[15px] md:text-sm">
									{{ selectedThread?.supplier.company_name }}
								</p>
								<p class="text-xs text-muted truncate">
									<span v-if="selectedThread?.supplier.main_email">{{ selectedThread.supplier.main_email }}</span>
									<span v-if="selectedThread?.supplier.main_email && threadStatsLabel"> · </span>
									<span class="tabular-nums">{{ threadStatsLabel }}</span>
								</p>
							</div>
							<div class="flex items-center gap-1.5 shrink-0">
								<UButton
									v-if="threadFileCount"
									:size="isMobile ? 'xl' : 'xs'"
									:variant="isMobile ? 'ghost' : 'outline'"
									color="neutral"
									icon="i-lucide-paperclip"
									:aria-label="`Все файлы: ${threadFileCount}`"
									@click="() => { filesOpen = true }"
								>
									<span class="hidden md:inline">Все файлы · {{ threadFileCount }}</span>

								</UButton>
								<UButton
									v-if="!showParamsPanel"
									:size="isMobile ? 'xl' : 'xs'"
									:variant="isMobile ? 'ghost' : 'outline'"
									color="neutral"
									icon="i-lucide-list-checks"
									aria-label="Соответствие ТЗ"
									:disabled="!latestIncomingId"
									@click="showParamsPanel = true"
								>
									<span class="hidden md:inline">Соответствие ТЗ</span>
								</UButton>
							</div>
						</div>
						<div v-if="isMobile" class="shrink-0 border-b border-default px-3 pb-2.5">
							<div role="tablist" class="grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1">
								<button
									v-for="tab in mainTabs"
									:key="tab.value"
									type="button"
									role="tab"
									:aria-selected="mainTab === tab.value"
									class="h-9 rounded-lg text-sm transition-colors"
									:class="mainTab === tab.value ? 'bg-default font-semibold shadow-sm' : 'font-medium text-muted'"
									@click="mainTab = tab.value"
								>
									{{ tab.label }}
								</button>
							</div>
						</div>

						<div ref="messagesContainer" class="flex-1 overflow-y-auto px-3 md:px-5 py-4 bg-elevated/40">
							<div v-if="loadingMessages" class="space-y-3">
								<USkeleton v-for="i in 2" :key="i" class="h-11 w-full rounded-xl" />
								<USkeleton class="h-48 w-full rounded-xl" />
							</div>

							<div v-else-if="messages.length" class="flex flex-col gap-2 max-w-4xl mx-auto">
								<template v-for="group in messageGroups" :key="group.key">
									<div class="flex items-center gap-3 text-[11px] uppercase tracking-wider text-dimmed mt-2 first:mt-0">
										<span class="flex-1 h-px bg-default" />
										<span>{{ group.label }}</span>
										<span class="flex-1 h-px bg-default" />
									</div>
									<template v-for="msg in group.messages" :key="msg.id">
										<div
											v-if="msg.id === newDividerMessageId"
											class="flex items-center gap-3 text-[11px] font-semibold text-primary my-1"
										>
											<span class="flex-1 h-px bg-primary/40" />
											<span>{{ newDividerLabel }}</span>
											<span class="flex-1 h-px bg-primary/40" />
										</div>
										<div
											:data-message-id="msg.id"
											:data-tour="msg.id === latestIncomingId ? 'latest-letter' : undefined"
											:data-ready="msg.id === latestIncomingId ? String(tourLetterReady) : undefined"
											:class="msg.id === newDividerMessageId ? 'scroll-mt-10' : 'scroll-mt-3'"
										>
											<InboxMessageCard
												:message="msg"
												:sender-name="selectedThread?.supplier.company_name || 'Поставщик'"
												:sender-initials="companyInitials(selectedThread?.supplier.company_name || '')"
												:sender-email="selectedThread?.supplier.main_email"
												:expanded="isMessageExpanded(msg)"
												:collapsible="msg.id !== lastLetterId"
												:highlighted="highlightedMessageId === msg.id"
												@toggle="toggleMessage(msg.id)"
												@download="downloadAttachment"
												@preview="openPreview"
												@forward="openForward(msg)"
												@zip="downloadZip(msg.id)"
												@fix-address="goFixAddress"
											/>
										</div>
									</template>
								</template>
							</div>

							<div v-else class="flex flex-col items-center justify-center py-16 gap-2 text-muted">
								<UIcon name="i-lucide-inbox" class="w-10 h-10 opacity-20" />
								<p class="text-sm">Сообщений нет</p>
							</div>
						</div>

						<input
							ref="replyFileInput"
							type="file"
							class="hidden"
							multiple
							accept=".pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
							@change="onReplyFilesSelected"
						>
						<!-- phones: one line [+] [text] [send]; the rest of the actions live behind «+» -->
						<div
							v-if="isMobile"
							class="shrink-0 min-w-0 space-y-2 border-t border-default px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
						>
							<UButton
								v-if="mismatchChip === 'request'"
								data-tour="request-missing"
								color="primary"
								variant="soft"
								size="md"
								leading-icon="i-lucide-mail-question"
								class="rounded-full"
								@click="openThreadLetterModal"
							>
								Запросить недостающее
								<template #trailing>
									<span class="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-inverted tabular-nums">
										{{ threadLetterMismatches.length }}
									</span>
								</template>
							</UButton>
							<p
								v-else-if="mismatchChip === 'waiting'"
								class="inline-flex h-8 items-center gap-1.5 rounded-full bg-elevated px-3 text-sm text-muted"
							>
								<UIcon name="i-lucide-clock" class="size-4 shrink-0" />
								Запрошено · ждём ответа
							</p>
							<div v-if="replyFiles.length" class="flex flex-wrap gap-2 min-w-0">
								<div
									v-for="(file, idx) in replyFiles"
									:key="`${file.name}-${file.size}-${file.lastModified}`"
									class="flex h-9 max-w-full items-center gap-1.5 rounded-full bg-elevated pl-3 pr-1 text-sm"
								>
									<UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-primary" />
									<span class="min-w-0 truncate" :title="file.name">{{ file.name }}</span>
									<UButton
										size="sm"
										color="neutral"
										variant="ghost"
										icon="i-lucide-x"
										class="rounded-full"
										:aria-label="`${t('inbox.attachFileRemove')}: ${file.name}`"
										:disabled="sendingReply"
										@click="removeReplyFile(idx)"
									/>
								</div>
							</div>
							<div class="flex items-end gap-2">
								<UButton
									color="neutral"
									variant="outline"
									size="xl"
									icon="i-lucide-plus"
									class="shrink-0 rounded-full"
									aria-label="Действия: быстрые ответы, реквизиты, файл"
									@click="replyActionsOpen = true"
								/>
								<UTextarea
									v-model="replyBody"
									placeholder="Ответ поставщику…"
									aria-label="Текст ответа поставщику"
									:rows="1"
									autoresize
									:maxrows="6"
									class="min-w-0 flex-1"
									:ui="{ base: 'min-h-11 resize-none rounded-3xl px-4 py-2.5 text-base' }"
								/>
								<UButton
									icon="i-lucide-send"
									size="xl"
									class="shrink-0 rounded-full"
									aria-label="Отправить ответ"
									:loading="sendingReply"
									:disabled="!replyBody.trim() || !canSendReplyEmail"
									@click="sendReply"
								/>
							</div>
							<UAlert
								v-if="replyQuotaMessage && !canSendReplyEmail"
								color="warning" variant="soft" icon="i-lucide-mail" :description="replyQuotaMessage" />
							<UAlert
								v-if="replyError" color="error" variant="soft" icon="i-lucide-circle-alert"
								:description="replyError" />
							<!-- the existing buttons keep their logic; the «+» sheet calls them -->
							<span class="hidden">
								<ReceiptAcknowledgementButton
									ref="quickReplyButton"
									v-model="replyBody"
									:company-name="selectedThread?.supplier.company_name"
								/>
								<InsertBusinessInfoButton ref="businessInfoButton" v-model="replyBody" />
							</span>
							<UDrawer v-model:open="replyActionsOpen" title="Ответ поставщику">
								<template #body>
									<div class="flex flex-col overflow-hidden rounded-2xl border border-default mb-4">
										<button
											v-if="threadLetterMismatches.length"
											type="button"
											class="flex min-h-14 items-center gap-3 px-4 text-left"
											@click="runReplyAction(openThreadLetterModal)"
										>
											<UIcon name="i-lucide-mail-question" class="size-5 text-primary" />
											<span class="flex-1">Запросить недостающее</span>
											<span class="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-inverted tabular-nums">
												{{ threadLetterMismatches.length }}
											</span>
										</button>
										<button
											type="button"
											class="flex min-h-14 items-center gap-3 border-t border-default/60 px-4 text-left first:border-t-0"
											@click="runReplyAction(() => quickReplyButton?.insertDefault())"
										>
											<UIcon name="i-lucide-mail-check" class="size-5 text-primary" />
											<span class="flex-1">{{ t('inbox.quickReplyTemplates') }}</span>
										</button>
										<button
											type="button"
											class="flex min-h-14 items-center gap-3 border-t border-default/60 px-4 text-left"
											@click="runReplyAction(() => businessInfoButton?.insert())"
										>
											<UIcon name="i-lucide-id-card" class="size-5 text-primary" />
											<span class="flex-1">{{ t('inbox.insertBusinessInfo') }}</span>
										</button>
										<button
											type="button"
											class="flex min-h-14 items-center gap-3 border-t border-default/60 px-4 text-left disabled:opacity-50"
											:disabled="sendingReply || replyFiles.length >= maxReplyUploadFiles"
											@click="runReplyAction(() => replyFileInput?.click())"
										>
											<UIcon name="i-lucide-paperclip" class="size-5 text-primary" />
											<span class="flex min-w-0 flex-1 flex-col">
												<span>{{ t('inbox.attachFile') }}</span>
												<span class="text-sm text-muted">Файлы, камера, галерея</span>
											</span>
										</button>
									</div>
									<div class="flex flex-col overflow-hidden rounded-2xl border border-default mb-4">
										<button
											type="button"
											class="flex min-h-13 items-center gap-3 px-4 text-left"
											@click="runReplyAction(() => quickReplyButton?.openSettings())"
										>
											<UIcon name="i-lucide-settings" class="size-5 text-muted" />
											<span class="flex-1">{{ t('inbox.quickReplyTemplatesSettings') }}</span>
										</button>
									</div>
								</template>
							</UDrawer>
						</div>
						<div v-else class="border-t border-default px-3 md:px-5 py-4 shrink-0 min-w-0">
							<div class="flex flex-col gap-2 mb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
								<div class="flex items-center gap-2 sm:mr-auto">
									<p class="min-w-0 flex-1 truncate text-xs text-muted font-medium">
										Ответить {{ selectedThread?.supplier.company_name }}
									</p>
								</div>
								<div class="flex flex-wrap items-center gap-2 min-w-0">
									<UButton
										v-if="threadLetterMismatches.length"
										data-tour="request-missing"
										size="xs"
										variant="outline"
										color="primary"
										leading-icon="i-lucide-mail-question"
										@click="openThreadLetterModal"
									>
										Запросить недостающее · {{ threadLetterMismatches.length }}
									</UButton>
									<ReceiptAcknowledgementButton
										v-model="replyBody"
										:company-name="selectedThread?.supplier.company_name"
									/>
									<InsertBusinessInfoButton v-model="replyBody" />
								</div>
							</div>
							<UTextarea
								v-model="replyBody"
								:placeholder="t('inbox.replyPlaceholder')"
								:rows="2"
								autoresize
								:maxrows="16"
								class="w-full mb-3 min-w-0"
								:ui="{ base: 'min-h-[3.25rem] resize-none' }"
							/>
							<div
								v-if="replyFiles.length"
								class="flex flex-wrap gap-2 mb-3 min-w-0"
							>
								<div
									v-for="(file, idx) in replyFiles"
									:key="`${file.name}-${file.size}-${file.lastModified}`"
									class="flex items-center gap-1.5 max-w-full rounded-lg border border-default px-2 py-1.5 text-xs"
								>
									<UIcon name="i-lucide-paperclip" class="w-3.5 h-3.5 text-muted shrink-0" />
									<span class="truncate min-w-0" :title="file.name">{{ file.name }}</span>
									<span class="text-muted shrink-0">{{ formatBytes(file.size) }}</span>
									<UButton
										size="xs"
										color="neutral"
										variant="ghost"
										icon="i-lucide-x"
										:title="t('inbox.attachFileRemove')"
										:aria-label="t('inbox.attachFileRemove')"
										:disabled="sendingReply"
										@click="removeReplyFile(idx)"
									/>
								</div>
							</div>
							<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0">
								<p class="text-xs text-muted hidden md:block">Ответ придёт поставщику на его email</p>
								<div class="flex items-center gap-1.5 w-full sm:w-auto justify-end min-w-0">
									<UButton
										size="sm"
										color="neutral"
										variant="ghost"
										icon="i-lucide-paperclip"
										:title="t('inbox.attachFile')"
										:aria-label="t('inbox.attachFile')"
										:disabled="sendingReply || replyFiles.length >= maxReplyUploadFiles"
										@click="replyFileInput?.click()"
									/>
									<UButton
										leading-icon="i-lucide-send"
										:loading="sendingReply"
										:disabled="!replyBody.trim() || !canSendReplyEmail"
										class="flex-1 sm:flex-none"
										@click="sendReply"
									>
										Отправить ответ
									</UButton>
								</div>
							</div>
							<UAlert
v-if="replyQuotaMessage && !canSendReplyEmail"
								color="warning" variant="soft" icon="i-lucide-mail" :description="replyQuotaMessage"
								class="mt-2" />
							<UAlert
v-if="replyError" color="error" variant="soft" icon="i-lucide-circle-alert"
								:description="replyError" class="mt-2" />
						</div>
					</template>
				</template>
			</div>

			<div
v-if="showParamsPanel && mainTab === 'thread'" class="shrink-0 border-l border-default flex flex-col"
				data-tour="compliance" :data-ready="String(requirementMatches.length > 0)"
				:class="isMobile
					? 'absolute inset-0 z-20 w-full bg-default'
					: 'w-72 md:w-80 lg:w-96'">

				<div class="px-4 py-3 border-b border-default flex items-center gap-2">
					<UButton
v-if="isMobile" variant="ghost" color="neutral" size="xs" icon="i-lucide-arrow-left"
						@click="showParamsPanel = false" />
					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold truncate">Соответствие требованиям</p>
						<button
							v-if="latestIncomingMessage?.received_at"
							type="button"
							class="text-[11px] text-muted hover:text-primary cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
							title="Показать это письмо в переписке"
							@click="showAnalysedLetter"
						>
							По письму от <span class="underline decoration-dotted underline-offset-2 tabular-nums">{{ formatDateTime(latestIncomingMessage.received_at) }}</span>
						</button>
					</div>
					<UButton
						v-if="!isMobile"
						variant="ghost"
						color="neutral"
						size="xs"
						icon="i-lucide-panel-right-close"
						aria-label="Скрыть панель соответствия"
						title="Скрыть панель"
						@click="() => { showParamsPanel = false }"
					/>
				</div>

				<div class="flex-1 overflow-y-auto px-3 py-3">
					<div v-if="!selectedRsId" class="flex flex-col items-center justify-center h-full gap-2 text-muted">
						<UIcon name="i-lucide-file-search" class="w-7 h-7 opacity-20" />
						<p class="text-xs text-center">Выберите тред</p>
					</div>
					<div v-else-if="loadingAnalysis || analysisPolling" class="space-y-3">
						<USkeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-lg" />
					</div>
					<div v-else class="space-y-3">
						<div v-if="extracting || analysisPolling" class="flex items-center gap-2 text-xs text-muted">
							<UIcon name="i-lucide-loader" class="w-3 h-3 animate-spin" />
							AI анализирует ответ...
						</div>
						<div v-if="requirementMatches.length" class="space-y-2">
							<div
v-for="(m, idx) in requirementMatches" :key="idx"
								class="rounded-lg border border-default/60 p-2 space-y-1.5">
								<div class="flex items-start gap-2">
									<UTooltip v-if="matchExplanationTooltip(m)" :text="m.explanation || ''">
										<UIcon
											:name="matchStatusIcon(m.status)"
											class="w-4 h-4 shrink-0 mt-0.5 cursor-help"
											:class="matchStatusClass(m.status)" />
									</UTooltip>
									<UIcon
v-else
										:name="matchStatusIcon(m.status)"
										class="w-4 h-4 shrink-0 mt-0.5"
										:class="matchStatusClass(m.status)" />
									<p class="text-xs font-medium flex-1">{{ m.requirement }}</p>
								</div>
								<div class="pl-6 space-y-1">
									<template v-if="editingMatchIdx === idx">
										<UTextarea v-model="editingMatchValue" size="xs" :rows="2" class="w-full" />
										<div class="flex gap-1">
											<UButton
size="xs" variant="ghost" color="primary" icon="i-lucide-check"
												:loading="savingParams" @click="commitMatchEdit(idx)" />
											<UButton
size="xs" variant="ghost" color="neutral" icon="i-lucide-x"
												@click="editingMatchIdx = null" />
										</div>
									</template>
									<template v-else>
										<div class="flex items-start gap-1">
											<div class="flex-1 min-w-0">
												<p class="text-[11px] text-muted">Предложение</p>
												<p
class="text-xs"
													:class="m.status === 'not_found' || !m.offer_value?.trim()
														? 'text-muted'
														: 'text-default'">
													{{ matchDisplayValue(m) }}
												</p>
												<p v-if="matchUserCorrected(m)" class="text-[10px] text-muted mt-0.5">
													<span class="line-through">{{ m.corrected_from }}</span>
													→ {{ m.offer_value }}
													<span class="text-primary/80">{{ t('inbox.correctedManually') }}</span>
												</p>
												<p
v-else-if="matchOfferChanged(m)"
													class="text-[10px] text-muted mt-0.5">
													<span class="line-through">{{ previousMatchValues[m.requirement]
													}}</span>
													→ {{ m.offer_value }}
												</p>
											</div>
											<button
type="button"
												class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer mt-3"
												@click="startMatchEdit(idx, m.offer_value)">
												<UIcon name="i-lucide-pencil" class="w-3 h-3" />
											</button>
										</div>
									</template>
								</div>
							</div>
						</div>
						<div
v-else-if="!hasRequirements"
							class="flex flex-col items-center justify-center py-8 gap-2 text-muted">
							<UIcon name="i-lucide-list-checks" class="w-7 h-7 opacity-20" />
							<p class="text-xs text-center">
								В запросе нет обязательных параметров — сравнивать нечего
							</p>
							<UButton size="xs" variant="link" :to="`/requests/${id}`">
								Добавить параметры
							</UButton>
						</div>
						<div
v-else-if="analysisNotReady && !extracting && !analysisPolling"
							class="flex flex-col items-center justify-center py-8 gap-3 text-muted">
							<UIcon name="i-lucide-loader" class="w-7 h-7 animate-spin opacity-50" />
							<p class="text-xs text-center">
								Анализ выполняется автоматически при получении письма
							</p>
							<UButton size="xs" variant="outline" :loading="extracting" @click="reExtract()">
								Запустить вручную
							</UButton>
						</div>
						<div
v-else-if="!extracting && !analysisPolling"
							class="flex flex-col items-center justify-center py-8 gap-2 text-muted">
							<UIcon name="i-lucide-file-x" class="w-7 h-7 opacity-20" />
							<p class="text-xs text-center">Данные не извлечены</p>
							<UButton size="xs" variant="outline" :loading="extracting" @click="reExtract()">
								Запустить анализ
							</UButton>
						</div>
						<div v-if="threadLetterMismatches.length" class="pt-1">
							<UButton
block size="sm" variant="outline" leading-icon="i-lucide-mail"
								@click="openThreadLetterModal">
								Запрос
							</UButton>
						</div>
					</div>
				</div>
			</div>
				</div>
			</UContainer>
		</div>

		<InboxFilesSlideover
			v-model:open="filesOpen"
			:messages="messages"
			:supplier-name="selectedThread?.supplier.company_name || 'поставщик'"
			:zipping="zipping"
			@preview="openPreview"
			@download="downloadAttachment"
			@zip="downloadZip()"
			@show-message="showMessageFromFiles"
		/>
		<InboxFilePreviewModal
			v-model:open="previewOpen"
			:attachment="previewAttachment"
			@download="downloadAttachment"
		/>
		<InboxForwardModal
			v-model:open="forwardOpen"
			:request-id="id"
			:rs-id="selectedRsId"
			:message="forwardMessage"
			:supplier-name="selectedThread?.supplier.company_name || 'поставщика'"
			:quota-message="canSendReplyEmail ? null : replyQuotaMessage"
			@sent="onForwardSent"
		/>
		<AddSupplierModal
			v-model:open="showSaveToBookmarkModal"
			:source-supplier="saveToBookmarkSupplier"
		/>
		<ImproveConditionsModal
v-if="modalSupplier" v-model:open="improveModalOpen" :request-id="id"
			:supplier="modalSupplier" :subscription="subscription" :demo="isDemo" />
		<ResponseMismatchLetterModal
v-if="letterModalSupplier" v-model:open="letterModalOpen" :request-id="id"
			:supplier="letterModalSupplier" :initial-body="letterModalBody" :subscription="subscription"
			:demo="isDemo" @sent="onLetterSent" />
		<WinnerNotificationModal
			v-if="winnerModalSupplier"
			v-model:open="winnerModalOpen"
			:request-id="id"
			:supplier="winnerModalSupplier"
			:subscription="subscription"
			:demo="isDemo"
			@sent="fetchComparison"
		/>

		<UModal
			v-model:open="clearWinnerConfirmOpen"
			title="Отменить выбор победителя"
			description="Вы уверены? После этого можно будет выбрать другого поставщика."
			:ui="{ content: 'max-w-md' }"
		>
			<template #footer>
				<div class="flex justify-end gap-2 w-full">
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="clearingWinner"
						@click="clearWinnerConfirmOpen = false"
					>
						Отмена
					</UButton>
					<UButton
						color="error"
						variant="soft"
						:loading="clearingWinner"
						@click="confirmClearWinner"
					>
						Да, снять выбор
					</UButton>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script lang="ts" setup>
import type {
	Attachment,
	ComparisonResponse,
	ComparisonSupplier,
	EmailAnalysisResponse,
	Message,
	RefreshAllResponse,
	ThreadAttachment,
	RequestResponse,
	RequirementMatch,
	SubscriptionResponse,
	Supplier,
	ThreadSummary,
	TZAnalysisStatus,
	UserResponse,
} from '#shared/types'
import { TZAnalysisRunStatus } from '#shared/types'
import {
	buildComparisonSupplierLetterBody,
	buildEmailMismatchLetterBody,
	filterNonMatching,
	supplierHasMismatches,
} from '#shared/utils/mismatchLetter'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { pluralizeLetters, pluralizeRu, pluralizeSuppliersGenitive } from '#shared/utils/textFormat'
import {
	canSendMail,
	mailingBlockMessage,
} from '#shared/utils/subscriptionAccess'
import { useIntervalFn } from '@vueuse/core'
import {
	companyInitials,
	dayKey,
	dayLabel,
	firstUnansweredIncomingId,
	letterPreview,
	threadState,
	THREAD_STATE_LABEL,
	type ThreadState,
} from '#shared/utils/emailThread'
import InboxFilePreviewModal from '~/components/inbox/InboxFilePreviewModal.vue'
import InboxFilesSlideover from '~/components/inbox/InboxFilesSlideover.vue'
import InboxForwardModal from '~/components/inbox/InboxForwardModal.vue'
import InboxMessageCard from '~/components/inbox/InboxMessageCard.vue'
import ImproveConditionsModal from '~/components/ImproveConditionsModal.vue'
import AddSupplierModal from '~/components/AddSupplierModal.vue'
import ResponseMismatchLetterModal from '~/components/ResponseMismatchLetterModal.vue'
import WinnerNotificationModal from '~/components/WinnerNotificationModal.vue'
import { getOfferValueTrend } from '#shared/utils/offerValue'
import { t } from '~/constants/translations'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const { get, post, patch, del } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()
const { formatDateTime, formatDateShort } = useFormatDate()

const subscription = ref<SubscriptionResponse | null>(null)
// sample request: letters stay inside the service, limits and trial do not apply
const isDemo = ref(false)
const canSendReplyEmail = computed(() => isDemo.value || canSendMail(subscription.value, 1))
const replyQuotaMessage = computed(() => (isDemo.value ? null : mailingBlockMessage(subscription.value, 1)))

const isMobile = ref(false)

// phones: quick replies, business card and files sit behind «+»
const replyActionsOpen = ref(false)
const quickReplyButton = ref<{ insertDefault: () => Promise<void>, openSettings: () => void } | null>(null)
const businessInfoButton = ref<{ insert: () => Promise<void> } | null>(null)
function runReplyAction(action: () => unknown) {
	replyActionsOpen.value = false
	void action()
}

const requestQuery = ref('')
onMounted(() => {
	const update = () => { isMobile.value = window.innerWidth < 768 }
	update()
	// on a phone the panel covers the whole thread: open it on demand only
	if (isMobile.value) showParamsPanel.value = false
	window.addEventListener('resize', update)
	document.documentElement.classList.add('overflow-hidden')
	onUnmounted(() => {
		window.removeEventListener('resize', update)
		document.documentElement.classList.remove('overflow-hidden')
	})
	void fetchSubscription()
})

async function fetchSubscription() {
	try {
		const user = await get<UserResponse>('/auth/me')
		subscription.value = user.subscription ?? null
	} catch {
		subscription.value = null
	}
}

function openSaveToBookmarkModal(supplier: Supplier) {
	saveToBookmarkSupplier.value = supplier
	showSaveToBookmarkModal.value = true
}

const showParamsPanel = ref(true)
const mainTab = ref<'thread' | 'comparison'>('thread')
const mainTabs = [
	{ value: 'thread', label: t('inbox.threadTab') },
	{ value: 'comparison', label: t('inbox.comparisonTab') },
] as const
const showSaveToBookmarkModal = ref(false)
const saveToBookmarkSupplier = ref<Supplier | null>(null)

const threads = ref<ThreadSummary[]>([])
const loadingThreads = ref(true)
const refreshingAll = ref(false)
const threadSearch = ref('')
const threadSort = ref('unread_first')
const selectedRsId = ref<string | null>(null)

const threadSortOptions = [
	{ label: 'По дате (новые сверху)', value: 'date_desc' },
	{ label: 'По дате (старые сверху)', value: 'date_asc' },
	{ label: 'По имени А→Я', value: 'name_asc' },
	{ label: 'Непрочитанные сначала', value: 'unread_first' },
]

async function fetchThreads(silent = false) {
	if (!silent) loadingThreads.value = true
	try {
		threads.value = await get<ThreadSummary[]>(`/requests/${id}/threads`)
	} catch {
		if (!silent) threads.value = []
	} finally {
		if (!silent) loadingThreads.value = false
	}
}

function selectDefaultThread() {
	// phones open on the list: the user picks whom to read
	if (selectedRsId.value || isMobile.value) return
	const first = sortedThreads.value[0]
	if (first) selectThread(first.rs_id)
}

const THREAD_POLL_MS = 45_000
const { pause: pauseThreadPoll, resume: resumeThreadPoll } = useIntervalFn(
	async () => {
		const prevLastId = selectedThread.value?.last_message?.id
		await fetchThreads(true)
		const newLastId = selectedThread.value?.last_message?.id
		if (selectedRsId.value && prevLastId !== newLastId) {
			await fetchMessages(selectedRsId.value, { silent: true })
			await fetchAnalysis()
		} else if (analysisNotReady.value && selectedRsId.value) {
			await fetchAnalysis()
		}
	},
	THREAD_POLL_MS,
)

async function refreshAll() {
	refreshingAll.value = true
	try {
		// without required parameters there is nothing to compare: refresh the
		// threads only, instead of asking for an analysis that cannot run
		const result: Pick<RefreshAllResponse, 'queued'> = hasRequirements.value
			? await post<RefreshAllResponse>(`/requests/${id}/analysis/refresh-all`)
			: { queued: 0 }
		await fetchThreads()
		if (selectedRsId.value) {
			await fetchMessages(selectedRsId.value)
			await fetchAnalysis()
		}
		if (mainTab.value === 'comparison') {
			await fetchComparison()
		}
		if (result.queued > 0) {
			toast.add({
				title: `Анализ запущен для ${result.queued} ${pluralizeSuppliersGenitive(result.queued)}`,
				color: 'success',
				icon: 'i-lucide-check',
			})
		}
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Ошибка обновления',
			color: 'error',
		})
	} finally {
		refreshingAll.value = false
	}
}

// the request's required parameters; null until loaded (then assumed present)
const requestParams = ref<string[] | null>(null)
const hasRequirements = computed(
	() => requestParams.value === null || requestParams.value.length > 0,
)

async function fetchRequestParams() {
	try {
		const request = await get<RequestResponse>(`/requests/${id}`)
		requestQuery.value = request.query
		isDemo.value = Boolean(request.is_demo)
		const params = request.additional_params
		requestParams.value = Array.isArray(params)
			? params.filter(p => typeof p === 'string' && p.trim())
			: []
	} catch {
		requestParams.value = null
	}
}

onMounted(async () => {
	void fetchRequestParams()
	await fetchThreads()
	selectDefaultThread()
	resumeThreadPoll()
})

onUnmounted(() => {
	pauseThreadPoll()
})

type ThreadFilter = 'all' | 'new' | 'replied' | 'problems'
const threadFilter = ref<ThreadFilter>('all')
const threadFilterOptions: { value: ThreadFilter, label: string }[] = [
	{ value: 'all', label: 'Все' },
	{ value: 'new', label: 'Новые' },
	{ value: 'replied', label: 'Ответили' },
	{ value: 'problems', label: 'Проблемы' },
]

// phones: the first column is narrow, long requirement names get a short form
function shortRequirement(req: string) {
	return req.replace(/\s*\(страна\)\s*$/i, '')
}

function matchesThreadFilter(thread: ThreadSummary, filter: ThreadFilter) {
	if (filter === 'all') return true
	if (filter === 'new') return threadState(thread) === 'new'
	// "Ответили" — every supplier who wrote at least once
	if (filter === 'replied') return thread.message_count > 0
	// "Проблемы": the letter did not arrive, or the supplier seems to refuse
	return Boolean(thread.delivery_failed || thread.declined)
}

const mobileThreadsSummary = computed(() => {
	const total = threads.value.length
	const replied = threads.value.filter(t => t.message_count > 0).length
	return `${total} ${pluralRu(total, 'поставщик', 'поставщика', 'поставщиков')} · ответили ${replied}`
})

function pluralRu(n: number, one: string, few: string, many: string): string {
	const m10 = n % 10
	const m100 = n % 100
	if (m10 === 1 && m100 !== 11) return one
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
	return many
}


const threadFilterCounts = computed(() => {
	const counts: Record<ThreadFilter, number> = { all: 0, new: 0, replied: 0, problems: 0 }
	for (const thread of threads.value) {
		for (const f of threadFilterOptions) {
			if (matchesThreadFilter(thread, f.value)) counts[f.value]++
		}
	}
	return counts
})

const filteredThreads = computed(() => {
	const q = threadSearch.value.toLowerCase()
	return threads.value.filter(t =>
		matchesThreadFilter(t, threadFilter.value)
		&& (!q
			|| t.supplier.company_name.toLowerCase().includes(q)
			|| t.supplier.main_email.toLowerCase().includes(q)),
	)
})

const sortedThreads = computed(() => {
	const list = [...filteredThreads.value]
	if (threadSort.value === 'name_asc') {
		return list.sort((a, b) =>
			a.supplier.company_name.localeCompare(b.supplier.company_name, 'ru'),
		)
	}
	if (threadSort.value === 'unread_first') {
		return list.sort((a, b) => {
			if (a.unread !== b.unread) return a.unread ? -1 : 1
			const aHasIncoming = a.message_count > 0
			const bHasIncoming = b.message_count > 0
			if (aHasIncoming !== bHasIncoming) return aHasIncoming ? -1 : 1
			const da = a.last_message?.received_at
				? new Date(a.last_message.received_at).getTime()
				: 0
			const db = b.last_message?.received_at
				? new Date(b.last_message.received_at).getTime()
				: 0
			return db - da
		})
	}
	if (threadSort.value === 'date_asc') {
		return list.sort((a, b) => {
			const da = a.last_message?.received_at
				? new Date(a.last_message.received_at).getTime()
				: 0
			const db = b.last_message?.received_at
				? new Date(b.last_message.received_at).getTime()
				: 0
			return da - db
		})
	}
	return list.sort((a, b) => {
		const da = a.last_message?.received_at
			? new Date(a.last_message.received_at).getTime()
			: 0
		const db = b.last_message?.received_at
			? new Date(b.last_message.received_at).getTime()
			: 0
		return db - da
	})
})

const selectedThread = computed(() =>
	threads.value.find(t => t.rs_id === selectedRsId.value) ?? null,
)

const pendingScrollMessageId = ref<string | null>(null)
const highlightedMessageId = ref<string | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | null = null

function selectThread(rsId: string, messageId?: string | null) {
	// remember whether the thread was unread before opening marks it read:
	// it decides where the "Новое" divider goes
	openedUnread.value = threads.value.find(t => t.rs_id === rsId)?.unread ?? false
	selectedRsId.value = rsId
	mainTab.value = 'thread'
	replyBody.value = ''
	replyError.value = null
	pendingScrollMessageId.value = messageId ?? null
	void openThread(rsId)
}

async function openThread(rsId: string) {
	const loaded = await fetchMessages(rsId)
	if (loaded) {
		await markThreadRead(rsId)
	}
	fetchAnalysis()
}

function openSourceEmail(supplier: ComparisonSupplier, req: string) {
	const messageId
		= supplier.source_message_ids?.[req]
			|| supplier.source_message_id
			|| null
	const hash = messageId
		? `${supplier.rs_id}/${messageId}`
		: supplier.rs_id
	if (typeof window !== 'undefined') {
		window.location.hash = hash
	}
	handledHash = hash
	selectThread(supplier.rs_id, messageId)
}

async function markThreadRead(rsId: string) {
	try {
		await post(`/requests/${id}/suppliers/${rsId}/mark-read`)
		const thread = threads.value.find(t => t.rs_id === rsId)
		if (thread) {
			thread.unread = false
		}
	} catch {
		// keep server state on next threads refresh
	}
}

const messages = ref<Message[]>([])
const loadingMessages = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

// the supplier's latest real letter: delivery reports and auto replies are not analysed
const latestIncomingMessage = computed(() =>
	[...messages.value].reverse().find(m => m.direction === 'incoming' && !m.kind) ?? null,
)
const latestIncomingId = computed(() => latestIncomingMessage.value?.id ?? null)
const lastMessageId = computed(() => messages.value.at(-1)?.id ?? null)
/** latest letter that is not a robot notice or a forward: always shown in full */
const lastLetterId = computed(() => [...messages.value].reverse().find(m => !m.kind)?.id ?? null)

/** Letters shown in full; the rest are one-line rows. */
const expandedMessageIds = ref<Set<string>>(new Set())
const openedUnread = ref(false)
const newDividerMessageId = ref<string | null>(null)

const newDividerLabel = computed(() => {
	const id = newDividerMessageId.value
	if (!id) return ''
	const idx = messages.value.findIndex(m => m.id === id)
	const count = idx < 0 ? 0 : messages.value.length - idx
	return count > 1 ? `Новые · ${count} ${pluralizeLetters(count)}` : 'Новое письмо'
})

function defaultExpandedIds(list: Message[], extra: (string | null | undefined)[] = []) {
	const ids = new Set<string>()
	const last = [...list].reverse().find(m => !m.kind)
	if (last) ids.add(last.id)
	const lastIncoming = [...list].reverse().find(m => m.direction === 'incoming' && !m.kind)
	if (lastIncoming) ids.add(lastIncoming.id)
	// everything that arrived since our last letter, when it was unread
	if (newDividerMessageId.value) {
		const from = list.findIndex(m => m.id === newDividerMessageId.value)
		// robot notices stay folded: they are one-line lines
		if (from >= 0) for (const m of list.slice(from)) if (!m.kind) ids.add(m.id)
	}
	for (const id of extra) if (id) ids.add(id)
	return ids
}

function isMessageExpanded(msg: Message) {
	if (msg.kind) return expandedMessageIds.value.has(msg.id)
	return msg.id === lastLetterId.value || expandedMessageIds.value.has(msg.id)
}

function toggleMessage(messageId: string) {
	const next = new Set(expandedMessageIds.value)
	if (next.has(messageId)) next.delete(messageId)
	else next.add(messageId)
	expandedMessageIds.value = next
}

const messageGroups = computed(() => {
	const groups: { key: string, label: string, messages: Message[] }[] = []
	for (const msg of messages.value) {
		const key = msg.received_at ? dayKey(msg.received_at) : 'unknown'
		let group = groups.at(-1)
		if (!group || group.key !== key) {
			group = {
				key,
				label: msg.received_at ? dayLabel(msg.received_at) : 'Без даты',
				messages: [],
			}
			groups.push(group)
		}
		group.messages.push(msg)
	}
	return groups
})

const threadFileCount = computed(() =>
	messages.value.reduce((n, m) => n + (m.kind ? 0 : (m.attachments?.length ?? 0)), 0),
)

const threadStatsLabel = computed(() => {
	if (!messages.value.length) return ''
	// letters of the dialogue only: robot notices and forwards are not counted
	const letters = messages.value.filter(m => !m.kind).length
	const files = threadFileCount.value
	const parts = [`${letters} ${pluralizeLetters(letters)}`]
	if (files) parts.push(`${files} ${pluralizeRu(files, 'файл', 'файла', 'файлов')}`)
	return parts.join(' · ')
})

function showAnalysedLetter() {
	const msgId = latestIncomingId.value
	if (!msgId) return
	if (isMobile.value) showParamsPanel.value = false
	expandedMessageIds.value = new Set([...expandedMessageIds.value, msgId])
	nextTick(() => scrollToMessage(msgId))
}

async function fetchMessages(rsId: string, options?: { silent?: boolean }): Promise<boolean> {
	const silent = options?.silent ?? false
	if (!silent) {
		loadingMessages.value = true
		messages.value = []
		newDividerMessageId.value = null
		expandedMessageIds.value = new Set()
	}
	const knownIds = new Set(messages.value.map(m => m.id))
	try {
		const list = await get<Message[]>(`/requests/${id}/suppliers/${rsId}/messages`)
		if (selectedRsId.value !== rsId) return false
		messages.value = list
		if (silent) {
			// letters that arrived while the thread was open stay open
			const fresh = list.filter(m => !knownIds.has(m.id)).map(m => m.id)
			if (fresh.length) expandedMessageIds.value = new Set([...expandedMessageIds.value, ...fresh])
		} else {
			newDividerMessageId.value = openedUnread.value ? firstUnansweredIncomingId(list) : null
			expandedMessageIds.value = defaultExpandedIds(list, [pendingScrollMessageId.value])
		}
		return true
	} catch {
		if (!silent) messages.value = []
		return false
	} finally {
		if (!silent) loadingMessages.value = false
		if (!silent) {
			await nextTick()
			const pending = pendingScrollMessageId.value
			pendingScrollMessageId.value = null
			scrollToMessage(pending)
		}
	}
}

function resolveDefaultScrollMessageId(): string | null {
	// start of the new letters, otherwise the latest letter (shown in full at the bottom)
	return newDividerMessageId.value ?? lastMessageId.value
}

function scrollToMessage(messageId?: string | null) {
	const targetId = messageId || resolveDefaultScrollMessageId()
	if (!targetId || !messagesContainer.value) {
		scrollToBottom()
		return
	}
	const el = messagesContainer.value.querySelector(
		`[data-message-id="${CSS.escape(targetId)}"]`,
	) as HTMLElement | null
	if (el) {
		el.scrollIntoView({ block: 'start' })
		if (messageId) {
			highlightedMessageId.value = messageId
			if (highlightTimer) clearTimeout(highlightTimer)
			highlightTimer = setTimeout(() => {
				highlightedMessageId.value = null
				highlightTimer = null
			}, 2500)
		}
		return
	}
	scrollToBottom()
}

function scrollToBottom() {
	if (messagesContainer.value)
		messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}

const replyBody = ref('')
const replyFiles = ref<File[]>([])
const replyFileInput = ref<HTMLInputElement | null>(null)
const sendingReply = ref(false)
const replyError = ref<string | null>(null)

const { public: publicConfig } = useRuntimeConfig()
const maxReplyUploadFiles = publicConfig.maxUploadFiles as number
const maxReplyUploadSize = publicConfig.maxRequestUploadSize as number

function onReplyFilesSelected(event: Event) {
	const input = event.target as HTMLInputElement
	const selected = input.files ? [...input.files] : []
	input.value = ''
	if (!selected.length) return

	const sizeMb = Math.round(maxReplyUploadSize / 1024 / 1024)
	const accepted: File[] = []
	for (const file of selected) {
		if (file.size > maxReplyUploadSize) {
			toast.add({
				title: t('inbox.attachFileTooLarge'),
				description: `${file.name} превышает ${sizeMb} МБ`,
				color: 'error',
			})
			continue
		}
		accepted.push(file)
	}

	const merged = [...replyFiles.value, ...accepted]
	if (merged.length > maxReplyUploadFiles) {
		toast.add({
			title: t('inbox.attachFileLimit'),
			description: `Максимум ${maxReplyUploadFiles} файла`,
			color: 'warning',
		})
		replyFiles.value = merged.slice(0, maxReplyUploadFiles)
		return
	}
	replyFiles.value = merged
}

function removeReplyFile(index: number) {
	replyFiles.value = replyFiles.value.filter((_, i) => i !== index)
}

async function sendReply() {
	if (!selectedRsId.value || !replyBody.value.trim()) return
	if (!canSendReplyEmail.value) {
		const msg = replyQuotaMessage.value
		if (msg) toast.add({ title: msg, color: 'warning' })
		return
	}
	const rsId = selectedRsId.value
	const body = replyBody.value
	sendingReply.value = true
	replyError.value = null
	try {
		let attachmentPaths: string[] | undefined
		if (replyFiles.value.length > 0) {
			const uploadFormData = new FormData()
			for (const file of replyFiles.value) {
				uploadFormData.append('files', file)
			}
			const uploaded = await post<Attachment[]>(
				`/requests/${id}/attachments`,
				uploadFormData,
			)
			attachmentPaths = uploaded
				.map((a) => a.path)
				.filter((p): p is string => Boolean(p))
		}

		await post(`/requests/${id}/suppliers/${rsId}/reply`, {
			body,
			attachment_paths: attachmentPaths ?? null,
		})
		replyBody.value = ''
		replyFiles.value = []
		toast.add({ title: 'Ответ отправлен', color: 'success', icon: 'i-lucide-mail-check' })
		await fetchThreads()
		await fetchMessages(rsId, { silent: true })
		await fetchSubscription()
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		replyError.value = getApiErrorDetail(e) ?? (typeof detail === 'string' ? detail : 'Не удалось отправить ответ')
	} finally {
		sendingReply.value = false
	}
}

const requirementMatches = ref<RequirementMatch[]>([])
const previousMatchValues = ref<Record<string, string>>({})
const loadingAnalysis = ref(false)
const savingParams = ref(false)
const extracting = ref(false)
const analysisPolling = ref(false)
const analysisNotReady = ref(false)
const editingMatchIdx = ref<number | null>(null)
const editingMatchValue = ref('')

const UNIT_PRICE_REQUIREMENT = 'Цена за единицу без НДС'
const TOTAL_WITHOUT_VAT_REQUIREMENT = 'Общая стоимость без НДС'
const DELIVERY_TOTAL_REQUIREMENT = 'Общая цена поставки без НДС'
const DELIVERY_TOTAL_LEGACY = 'Общая цена поставки'
const POSITION_PRICE_PREFIX = 'Цена без НДС:'
const POSITION_TITLE_MAX_WORDS = 5
const PRICE_REQUIREMENT_FALLBACKS = [
	UNIT_PRICE_REQUIREMENT,
	TOTAL_WITHOUT_VAT_REQUIREMENT,
	DELIVERY_TOTAL_REQUIREMENT,
	DELIVERY_TOTAL_LEGACY,
] as const
const PREFERRED_PRICE_ORDER = [
	UNIT_PRICE_REQUIREMENT,
	TOTAL_WITHOUT_VAT_REQUIREMENT,
	DELIVERY_TOTAL_REQUIREMENT,
	DELIVERY_TOTAL_LEGACY,
] as const

const comparison = ref<ComparisonResponse | null>(null)
const loadingComparison = ref(false)
const exportingComparison = ref(false)
const comparisonSortBy = ref<string | null>(UNIT_PRICE_REQUIREMENT)
const comparisonSortAsc = ref(true)

/** Short position name under "Цена за единицу без НДС" (max 5 words). */
function positionPriceTitle(req: string): string | null {
	const text = req.trim()
	if (!text.startsWith(POSITION_PRICE_PREFIX)) return null
	const raw = text.slice(POSITION_PRICE_PREFIX.length).trim()
	if (!raw) return null
	return raw.split(/\s+/).slice(0, POSITION_TITLE_MAX_WORDS).join(' ')
}

function isPriceRequirementLabel(req: string): boolean {
	const text = req.trim()
	return (
		(PRICE_REQUIREMENT_FALLBACKS as readonly string[]).includes(text)
		|| text.startsWith(POSITION_PRICE_PREFIX)
	)
}

function prioritizePriceRequirements(list: string[]): string[] {
	for (const preferred of PREFERRED_PRICE_ORDER) {
		if (list.includes(preferred)) {
			return [preferred, ...list.filter((req) => req !== preferred)]
		}
	}
	return list
}

const priceRequirements = computed(() => {
	const fromApi = comparison.value?.price_requirements ?? []
	const fromRequirements = (comparison.value?.requirements ?? []).filter(
		(req) => isPriceRequirementLabel(req),
	)
	const list = fromApi.length ? [...fromApi] : [...fromRequirements]
	return prioritizePriceRequirements(list)
})

const sortedComparisonSuppliers = computed((): ComparisonSupplier[] => {
	const list = comparison.value?.suppliers ?? []
	const sortKey = comparisonSortBy.value
	if (!sortKey) return list
	const asc = comparisonSortAsc.value
	return [...list].sort((a, b) => {
		const av = a.numeric_values?.[sortKey] ?? null
		const bv = b.numeric_values?.[sortKey] ?? null
		if (av === null && bv === null) return 0
		if (av === null) return 1
		if (bv === null) return -1
		return asc ? av - bv : bv - av
	})
})

function toggleComparisonSort(req: string) {
	if (comparisonSortBy.value === req) {
		comparisonSortAsc.value = !comparisonSortAsc.value
		return
	}
	comparisonSortBy.value = req
	comparisonSortAsc.value = true
}

function isPriceRequirement(req: string): boolean {
	return priceRequirements.value.includes(req)
}

function formatPercentVsMin(
	supplier: ComparisonSupplier,
	req: string,
): string | null {
	const pct = supplier.percent_vs_min?.[req]
	if (pct === null || pct === undefined) return null
	if (pct === 0) return 'мин.'
	const sign = pct > 0 ? '+' : ''
	return `${sign}${pct.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`
}

const hasConfirmedWinner = computed(() =>
	comparison.value?.suppliers.some((supplier) => supplier.is_winner) ?? false,
)

const improveModalOpen = ref(false)
const letterModalOpen = ref(false)
const winnerModalOpen = ref(false)
const clearWinnerConfirmOpen = ref(false)
const clearingWinner = ref(false)
const modalSupplier = ref<ComparisonSupplier | null>(null)
const winnerModalSupplier = ref<ComparisonSupplier | null>(null)
const letterModalSupplier = ref<ComparisonSupplier | null>(null)
const letterModalBody = ref('')

function openImproveModal(supplier: ComparisonSupplier) {
	modalSupplier.value = supplier
	improveModalOpen.value = true
}

function openLetterModal(supplier: ComparisonSupplier) {
	letterModalSupplier.value = supplier
	letterModalBody.value = buildComparisonSupplierLetterBody(
		supplier,
		comparison.value?.requirements ?? [],
	)
	letterModalOpen.value = true
}

function openThreadLetterModal() {
	const thread = selectedThread.value
	const supplier = selectedThreadAsComparisonSupplier.value
	if (!thread || !supplier) return
	letterModalSupplier.value = supplier
	letterModalBody.value = buildEmailMismatchLetterBody(
		thread.supplier.company_name,
		threadLetterMismatches.value,
	)
	letterModalOpen.value = true
}

const threadLetterMismatches = computed(() =>
	filterNonMatching(requirementMatches.value),
)

/**
 * Phones: the "request missing" chip above the reply box.
 * request — the offer came and has gaps; waiting — we already wrote after
 * that letter; null — nothing to ask (no gaps, refusal, winner chosen).
 * The action itself stays in the «+» sheet in every case.
 */
const mismatchChip = computed((): 'request' | 'waiting' | null => {
	if (!threadLetterMismatches.value.length) return null
	if (selectedThread.value?.declined || hasConfirmedWinner.value) return null
	const incoming = latestIncomingMessage.value
	if (!incoming) return null
	const list = messages.value
	const after = list.slice(list.findIndex(m => m.id === incoming.id) + 1)
	return after.some(m => m.direction === 'outgoing' && !m.kind) ? 'waiting' : 'request'
})

const selectedThreadAsComparisonSupplier = computed((): ComparisonSupplier | null => {
	const thread = selectedThread.value
	if (!thread) return null
	const reqs = comparison.value?.requirements
		?? requirementMatches.value.map((item) => item.requirement)
	const values: Record<string, string | null> = {}
	const statuses: Record<string, string | null> = {}
	for (const item of requirementMatches.value) {
		values[item.requirement] = item.offer_value
		statuses[item.requirement] = item.status
	}
	for (const req of reqs) {
		if (!(req in values)) {
			values[req] = null
			statuses[req] = 'not_found'
		}
	}
	return {
		rs_id: thread.rs_id,
		company_name: thread.supplier.company_name,
		main_email: thread.supplier.main_email,
		is_winner: false,
		values,
		previous_values: previousMatchValues.value,
		statuses,
	}
})

function supplierHasLetterMismatches(supplier: ComparisonSupplier) {
	return supplierHasMismatches(
		supplier,
		comparison.value?.requirements ?? [],
	)
}

function openWinnerModal(supplier: ComparisonSupplier) {
	winnerModalSupplier.value = supplier
	winnerModalOpen.value = true
}

function openClearWinnerConfirm() {
	clearWinnerConfirmOpen.value = true
}

async function confirmClearWinner() {
	if (clearingWinner.value) return
	clearingWinner.value = true
	try {
		await del(`/requests/${id}/winner`)
		clearWinnerConfirmOpen.value = false
		await fetchComparison()
		toast.add({
			title: 'Выбор победителя отменён',
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? 'Не удалось снять выбор победителя',
			color: 'error',
		})
	} finally {
		clearingWinner.value = false
	}
}

function complianceForSupplier(supplier: ComparisonSupplier) {
	const requirements = comparison.value?.requirements ?? []
	if (requirements.length === 0) return { passed: false }
	const passed = requirements.every(
		(req) => supplier.statuses[req] === 'met',
	)
	return { passed }
}

function applyEmailAnalysis(data: EmailAnalysisResponse) {
	requirementMatches.value = data.matches || []
	previousMatchValues.value = data.previous_parameters || {}
	analysisNotReady.value = false
	if (data.status === TZAnalysisRunStatus.PROCESSING) {
		analysisPolling.value = true
	} else {
		analysisPolling.value = false
	}
}

function matchOfferChanged(m: RequirementMatch) {
	const prev = previousMatchValues.value[m.requirement]
	return Boolean(prev && m.offer_value && prev !== m.offer_value)
}

function matchUserCorrected(m: RequirementMatch) {
	return Boolean(
		m.corrected_from?.trim()
		&& m.offer_value?.trim()
		&& m.corrected_from !== m.offer_value,
	)
}

function matchExplanationTooltip(m: RequirementMatch) {
	return Boolean(
		m.explanation?.trim()
		&& (m.status === 'partial' || m.status === 'missing'),
	)
}

function comparisonUserCorrected(
	supplier: ComparisonSupplier,
	req: string,
) {
	const from = supplier.corrected_from?.[req]
	const current = supplier.values[req]
	return Boolean(from?.trim() && current?.trim() && from !== current)
}

function comparisonExplanationTooltip(
	supplier: ComparisonSupplier,
	req: string,
) {
	const status = supplier.statuses[req]
	const explanation = supplier.explanations?.[req]
	return Boolean(
		explanation?.trim()
		&& (status === 'partial' || status === 'missing'),
	)
}

async function fetchAnalysis() {
	if (!latestIncomingId.value) {
		requirementMatches.value = []
		previousMatchValues.value = {}
		analysisPolling.value = false
		analysisNotReady.value = false
		return
	}
	loadingAnalysis.value = true
	try {
		const data = await get<EmailAnalysisResponse>(
			`/responses/${latestIncomingId.value}/analysis`,
		)
		applyEmailAnalysis(data)
	} catch (e: unknown) {
		const status = (e as { response?: { status?: number } })?.response?.status
		if (status === 404) {
			analysisNotReady.value = true
			previousMatchValues.value = {}
			requirementMatches.value = []
			analysisPolling.value = false
			return
		}
		analysisNotReady.value = false
		previousMatchValues.value = {}
		requirementMatches.value = []
		analysisPolling.value = false
	} finally {
		loadingAnalysis.value = false
	}
}

useRunStatusPolling(
	analysisPolling,
	async () => {
		if (!latestIncomingId.value) return null
		return get<EmailAnalysisResponse>(
			`/responses/${latestIncomingId.value}/analysis`,
		)
	},
	(data: EmailAnalysisResponse) => { applyEmailAnalysis(data) },
	() => {
		toast.add({
			title: 'Анализ выполнен',
			color: 'success',
			icon: 'i-lucide-check',
		})
		if (mainTab.value === 'comparison') fetchComparison()
	},
	() => {
		toast.add({
			title: 'Ошибка анализа',
			color: 'error',
			icon: 'i-lucide-circle-alert',
		})
	},
)

async function saveParams(showToast = true) {
	if (!latestIncomingId.value) return
	savingParams.value = true
	try {
		const data = await patch<EmailAnalysisResponse>(
			`/responses/${latestIncomingId.value}/analysis`,
			{
				matches: requirementMatches.value.map(m => ({
					requirement: m.requirement,
					offer_value: m.offer_value,
				})),
			},
		)
		applyEmailAnalysis(data)
		if (mainTab.value === 'comparison') fetchComparison()
		if (showToast) {
			toast.add({ title: 'Изменения сохранены', color: 'success', icon: 'i-lucide-check' })
		}
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Ошибка сохранения',
			color: 'error',
		})
	} finally {
		savingParams.value = false
	}
}

async function reExtract(silent = false) {
	if (!latestIncomingId.value || !hasRequirements.value) return
	extracting.value = true
	try {
		const data = await post<EmailAnalysisResponse>(
			`/responses/${latestIncomingId.value}/analyze`,
		)
		applyEmailAnalysis(data)
		if (!silent && data.status !== TZAnalysisRunStatus.PROCESSING) {
			toast.add({
				title: 'Анализ выполнен',
				color: 'success',
				icon: 'i-lucide-check',
			})
		}
	} catch (e: unknown) {
		if (!silent) {
			const detail = (e as { response?: { data?: { detail?: string } } })
				?.response?.data?.detail
			toast.add({
				title: typeof detail === 'string' ? detail : 'Ошибка анализа',
				color: 'error',
			})
		}
	} finally {
		extracting.value = false
	}
}

async function fetchComparison() {
	loadingComparison.value = true
	try {
		comparison.value = await get<ComparisonResponse>(
			`/requests/${id}/analysis/comparison`,
		)
		const available = priceRequirements.value
		const preferred = PREFERRED_PRICE_ORDER.find((req) => available.includes(req))
		if (preferred) {
			comparisonSortBy.value = preferred
		} else if (
			!comparisonSortBy.value
			|| !available.includes(comparisonSortBy.value)
		) {
			comparisonSortBy.value = available[0] ?? null
		}
	} catch {
		comparison.value = null
	} finally {
		loadingComparison.value = false
	}
}

async function exportComparisonXlsx() {
	exportingComparison.value = true
	try {
		const res = await $axios.get(
			`/requests/${id}/analysis/comparison.xlsx`,
			{ responseType: 'blob' },
		)
		const blob = res.data as Blob
		const objectUrl = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = objectUrl
		a.download = `request_${id}_comparison.xlsx`
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(objectUrl)
	} catch {
		toast.add({ title: 'Не удалось экспортировать XLSX', color: 'error' })
	} finally {
		exportingComparison.value = false
	}
}

function matchDisplayValue(m: RequirementMatch): string {
	if (m.status === 'not_found') return '—'
	return m.offer_value?.trim() || '—'
}

function comparisonDisplayValue(
	supplier: ComparisonSupplier,
	req: string,
): string {
	if (supplier.statuses[req] === 'not_found') return '—'
	const value = supplier.values[req]?.trim()
	return value || '—'
}

function comparisonValueCalculated(
	supplier: ComparisonSupplier,
	req: string,
): boolean {
	return supplier.value_origins?.[req] === 'calculated'
}

function comparisonShowStatusBadge(
	supplier: ComparisonSupplier,
	req: string,
): boolean {
	const status = supplier.statuses[req]
	if (!status || status === 'not_found') return false
	// Empty value shows as "—"; do not show "Выполнено" on a dash.
	if (status === 'met' && comparisonDisplayValue(supplier, req) === '—') {
		return false
	}
	return true
}

function comparisonStatusLabel(status: string) {
	if (status === 'met') return 'Выполнено'
	if (status === 'partial') return 'Частично'
	if (status === 'missing') return 'Не закрыто'
	if (status === 'not_found') return 'Не упомянуто'
	return status
}

function comparisonStatusColor(status: string) {
	if (status === 'met') return 'success'
	if (status === 'partial') return 'warning'
	if (status === 'missing') return 'error'
	return 'neutral'
}

function matchStatusIcon(status: TZAnalysisStatus) {
	if (status === 'met') return 'i-lucide-circle-check'
	if (status === 'partial') return 'i-lucide-circle-alert'
	if (status === 'missing') return 'i-lucide-circle-x'
	return 'i-lucide-circle-help'
}

function matchStatusClass(status: TZAnalysisStatus) {
	if (status === 'met') return 'text-success'
	if (status === 'partial') return 'text-warning'
	if (status === 'missing') return 'text-error'
	return 'text-muted'
}

function startMatchEdit(idx: number, value: string | null) {
	editingMatchIdx.value = idx
	editingMatchValue.value = value ?? ''
}

async function commitMatchEdit(idx: number) {
	const match = requirementMatches.value[idx]
	if (!match) return
	const newValue = editingMatchValue.value.trim() || null
	if (newValue === match.offer_value) {
		editingMatchIdx.value = null
		return
	}
	match.offer_value = newValue
	editingMatchIdx.value = null
	await saveParams()
}

async function downloadAttachment(att: Attachment) {
	if (!att.path) {
		toast.add({
			title: 'Файл недоступен для скачивания',
			color: 'warning',
		})
		return
	}
	try {
		const res = await $axios.get(
			`/requests/attachments/serve?attachment_path=${encodeURIComponent(att.path)}`,
			{ responseType: 'blob' },
		)
		const blob = res.data as Blob
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = att.filename
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(url)
	} catch {
		toast.add({ title: 'Не удалось скачать файл', color: 'error' })
	}
}

// The threads list is re-fetched every 45 s; open the thread from the hash
// once per hash value, so a poll does not reload the open thread and fold
// the letters the user expanded.
let handledHash: string | null = null
watch(threads, () => {
	const hash = window.location.hash.replace(/^#/, '')
	if (!hash || hash === handledHash) return
	handledHash = hash
	const [rsId, messageId] = hash.split('/')
	if (rsId && threads.value.find(t => t.rs_id === rsId)) {
		selectThread(rsId, messageId || null)
	}
}, { immediate: false })

watch(latestIncomingId, (val) => { if (val) fetchAnalysis() })

watch(mainTab, (tab) => {
	if (tab === 'comparison') fetchComparison()
})

function formatBytes(b: number) {
	if (b < 1024) return `${b} Б`
	if (b < 1048576) return `${(b / 1024).toFixed(1)} КБ`
	return `${(b / 1048576).toFixed(1)} МБ`
}

function incomingCountLabel(count: number) {
	return t('inbox.incomingCountLabel').replace('{count}', String(count))
}

function incomingLettersLabel(count: number) {
	return `${count} ${pluralizeRu(count, 'входящее', 'входящих', 'входящих')}`
}

function threadPreview(thread: ThreadSummary) {
	const last = thread.last_message
	if (!last) return 'Нет сообщений'
	// a robot letter says nothing useful: tell what it means instead
	if (last.kind === 'bounce') return 'Письмо не дошло до поставщика: почтовый сервер вернул его'
	if (last.kind === 'auto_reply') return `Автоответ: ${letterPreview(last.body, 100) || 'без текста'}`
	return letterPreview(last.body, 120) || last.subject || 'Письмо без текста'
}

function threadStateClass(state: ThreadState) {
	if (state === 'failed') return 'bg-error/10 text-error'
	if (state === 'new') return 'bg-primary/10 text-primary'
	if (state === 'replied') return 'bg-success/10 text-success'
	if (state === 'declined') return 'bg-warning/10 text-warning'
	return 'bg-elevated text-muted'
}

const filesOpen = ref(false)
const previewOpen = ref(false)
const previewAttachment = ref<ThreadAttachment | null>(null)
const forwardOpen = ref(false)
const forwardMessage = ref<Message | null>(null)
const zipping = ref(false)

function openPreview(att: ThreadAttachment) {
	previewAttachment.value = att
	previewOpen.value = true
}

function openForward(msg: Message) {
	forwardMessage.value = msg
	forwardOpen.value = true
}

function onForwardSent(toEmail: string) {
	toast.add({
		title: 'Письмо отправляется',
		description: `Пересылаем на ${toEmail}. Отметка появится в переписке через минуту.`,
		color: 'success',
		icon: 'i-lucide-forward',
	})
	const rsId = selectedRsId.value
	// the copy is sent in the background; pick up the "переслано" line
	setTimeout(() => {
		if (rsId && selectedRsId.value === rsId) void fetchMessages(rsId, { silent: true })
	}, 8000)
	void fetchSubscription()
}

function goFixAddress() {
	void navigateTo(`/requests/${id}`)
}

function showMessageFromFiles(messageId: string) {
	filesOpen.value = false
	expandedMessageIds.value = new Set([...expandedMessageIds.value, messageId])
	nextTick(() => scrollToMessage(messageId))
}

async function downloadZip(messageId?: string) {
	const rsId = selectedRsId.value
	if (!rsId) return
	zipping.value = true
	try {
		const query = messageId ? `?message_id=${encodeURIComponent(messageId)}` : ''
		const res = await $axios.get(
			`/requests/${id}/suppliers/${rsId}/attachments.zip${query}`,
			{ responseType: 'blob' },
		)
		const url = URL.createObjectURL(res.data as Blob)
		const a = document.createElement('a')
		a.href = url
		const company = selectedThread.value?.supplier.company_name || 'поставщик'
		a.download = `Файлы — ${company}.zip`
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(url)
	} catch (e: unknown) {
		const status = (e as { response?: { status?: number } })?.response?.status
		toast.add({
			title: status === 413
				? 'Файлы слишком большие для одного архива: скачайте их по одному'
				: 'Не удалось собрать архив',
			color: 'error',
		})
	} finally {
		zipping.value = false
	}
}

// ── onboarding tour on the sample request ──────────────────────────────────
const tour = useOnboardingTour()
const tourHere = computed(() => isDemo.value && tour.isRunning.value && tour.state.value.demoRequestId === id)

/** the sample supplier answered the user's letter (step 4) */
const demoReplyArrived = computed(() => {
	const outgoing = messages.value.filter(m => m.direction === 'outgoing').length
	const last = [...messages.value].reverse().find(m => !m.kind)
	return outgoing >= 2 && last?.direction === 'incoming'
})

/** is the latest letter ready to be shown by the current step */
const tourLetterReady = computed(() => {
	if (!tourHere.value) return true
	if (tour.step.value === 2) return requirementMatches.value.length > 0
	if (tour.step.value === 4) return demoReplyArrived.value
	return true
})

const TOUR_SUPPLIER: Record<number, string> = {
	2: 'Поставщик А',
	3: 'Поставщик Б',
	4: 'Поставщик Б',
}

function followTourStep() {
	if (!tourHere.value) return
	const n = tour.step.value
	const name = TOUR_SUPPLIER[n]
	if (name) {
		const thread = threads.value.find(t => t.supplier.company_name === name)
		if (thread && selectedRsId.value !== thread.rs_id) selectThread(thread.rs_id)
		if (mainTab.value !== 'thread') mainTab.value = 'thread'
		// step 2 on a computer lights up the compliance panel
		if (n === 2 && !isMobile.value) showParamsPanel.value = true
	} else if (n === 5 && mainTab.value !== 'comparison') {
		mainTab.value = 'comparison'
		void fetchComparison()
	}
}

watch(() => [tour.step.value, isDemo.value, threads.value.length] as const, followTourStep)

// the tour runs again on another device: the supplier has already answered,
// so there is nothing left to ask — go straight to the answer
watch(() => [tour.step.value, demoReplyArrived.value, selectedThread.value?.supplier.company_name] as const,
	([n, arrived, name]) => {
		if (tourHere.value && n === 3 && arrived && name === TOUR_SUPPLIER[3]) tour.goto(4)
	})

// letters of the sample arrive in seconds: refresh fast while the tour waits
useIntervalFn(async () => {
	if (!tourHere.value || ![2, 3, 4].includes(tour.step.value)) return
	await fetchThreads(true)
	if (selectedRsId.value) {
		await fetchMessages(selectedRsId.value, { silent: true })
		await fetchAnalysis()
	}
}, 3000)

async function onLetterSent() {
	if (selectedRsId.value) await fetchMessages(selectedRsId.value, { silent: true })
	if (tourHere.value && tour.step.value === 3) tour.goto(4)
}

// the letter dialog closed without sending: bring the tour back
watch(letterModalOpen, (open) => {
	if (!open && tourHere.value && tour.step.value === 3 && tour.paused.value) {
		tour.paused.value = false
	}
})
</script>
