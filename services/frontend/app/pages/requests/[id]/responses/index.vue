<template>
	<div class="w-full">
		<div class="fixed inset-x-0 bottom-0 top-20 z-10 flex flex-col overflow-hidden bg-default">
			<UContainer class="max-w-[1600px] py-0 flex flex-1 flex-col min-h-0 h-full w-full">
				<div
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
					</div>

					<div class="flex gap-1 p-0.5 bg-elevated rounded-lg shrink-0">
						<button
							type="button"
							class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
							:class="mainTab === 'thread'
								? 'bg-default text-default shadow-sm'
								: 'text-muted hover:text-default'"
							@click="mainTab = 'thread'"
						>
							Переписка
						</button>
						<button
							type="button"
							class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
							:class="mainTab === 'comparison'
								? 'bg-default text-default shadow-sm'
								: 'text-muted hover:text-default'"
							@click="mainTab = 'comparison'"
						>
							Сравнение
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
						class="shrink-0 border-r border-default flex flex-col min-h-0"
						:class="[isMobile && selectedRsId ? 'hidden' : 'flex', 'w-full md:w-72 lg:w-80 xl:w-96']"
					>

				<div class="px-3 py-2 border-b border-default space-y-2 shrink-0">
					<UInput
v-model="threadSearch" placeholder="Поиск..." icon="i-lucide-search" size="sm"
						class="w-full" />
					<USelect v-model="threadSort" :items="threadSortOptions" size="sm" class="w-full" />
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
							{{ threadSearch ? 'Ничего не найдено' : 'Ответов пока нет' }}
						</p>
					</div>

					<div
						v-for="thread in sortedThreads"
						:key="thread.rs_id"
						class="flex items-stretch border-b border-default/50"
						:class="selectedRsId === thread.rs_id ? 'bg-elevated border-l-2 border-l-primary' : ''">
						<button
							type="button"
							class="flex-1 min-w-0 text-left px-4 py-4 hover:bg-elevated/50 transition-colors cursor-pointer"
							@click="selectThread(thread.rs_id)">
						<div class="flex items-start gap-3">
							<div
								class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
								<UIcon name="i-lucide-building-2" class="w-5 h-5 text-primary" />
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between gap-2 mb-1">
									<p class="text-sm font-semibold leading-snug line-clamp-3 min-w-0 break-words">
										{{ thread.supplier.company_name }}
									</p>
									<span v-if="thread.unread" class="w-2 h-2 rounded-full bg-primary shrink-0" />
								</div>
								<p class="text-xs text-muted truncate mb-2">
									{{ thread.last_message?.body
										? thread.last_message.body.slice(0, 60)
										: 'Нет сообщений' }}
								</p>
								<div class="flex items-center justify-between gap-2">
									<span
										class="text-xs text-primary/80 tabular-nums"
										:title="incomingCountLabel(thread.message_count)"
										:aria-label="incomingCountLabel(thread.message_count)"
									>
										{{ incomingCountLabel(thread.message_count) }}
									</span>
									<span class="text-xs text-muted whitespace-nowrap shrink-0">
										{{ thread.last_message?.received_at
											? formatDateShort(thread.last_message.received_at)
											: '—' }}
									</span>
								</div>
							</div>
						</div>
						</button>
						<div class="flex items-center px-2 shrink-0">
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
class="flex-1 flex flex-col min-w-0 min-h-0"
				:class="isMobile && !selectedRsId && mainTab !== 'comparison' ? 'hidden' : 'flex'">

				<template v-if="mainTab === 'comparison'">
					<div class="flex-1 flex flex-col min-h-0 min-w-0">
						<div class="flex-1 overflow-x-auto overflow-y-auto px-3 md:px-5 py-4 min-h-0 min-w-0">
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
							<div v-else class="min-w-0 overflow-x-auto rounded-xl border border-default">
								<div
									v-if="priceRequirements.length"
									class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-default bg-elevated/30"
								>
									<span class="text-xs text-muted">Сортировка по цене:</span>
									<UButton
										v-for="req in priceRequirements"
										:key="`sort-${req}`"
										size="xs"
										:variant="comparisonSortBy === req ? 'soft' : 'ghost'"
										:color="comparisonSortBy === req ? 'primary' : 'neutral'"
										@click="toggleComparisonSort(req)"
									>
										{{ req }}
										<UIcon
											v-if="comparisonSortBy === req"
											:name="comparisonSortAsc
												? 'i-lucide-arrow-up-narrow-wide'
												: 'i-lucide-arrow-down-wide-narrow'"
											class="w-3.5 h-3.5 ml-1"
										/>
									</UButton>
								</div>
								<table class="w-max min-w-full text-sm">
									<thead>
										<tr class="border-b border-default bg-elevated/50">
											<th
												class="sticky left-0 z-10 bg-elevated/95 px-3 py-2.5 text-left text-xs font-semibold min-w-40 max-w-56 wrap-break-word whitespace-normal align-top">
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
												class="sticky left-0 z-10 bg-default px-3 py-2.5 text-xs font-medium align-top wrap-break-word whitespace-normal max-w-56">
												<button
													v-if="isPriceRequirement(req)"
													type="button"
													class="text-left hover:text-primary transition-colors"
													@click="toggleComparisonSort(req)"
												>
													{{ req }}
												</button>
												<span v-else>{{ req }}</span>
											</td>
											<td
v-for="supplier in sortedComparisonSuppliers" :key="supplier.rs_id"
												class="px-3 py-2.5 align-top wrap-break-word whitespace-normal max-w-52">
												<div class="flex items-start gap-2">
													<div class="flex-1 min-w-0 space-y-1">
														<p class="text-xs wrap-break-word whitespace-normal">
															{{ comparisonDisplayValue(supplier, req) }}
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
												Запросить отсутствующие параметры
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
						<div
v-if="comparison?.requirements.length && comparison?.suppliers.length"
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
						<div class="px-3 md:px-5 py-2.5 border-b border-default flex items-center gap-2 shrink-0">
							<div class="min-w-0 flex-1">
								<p class="font-semibold truncate text-sm">
									{{ selectedThread?.supplier.company_name }}
								</p>
								<p
v-if="selectedThread?.supplier.main_email"
									class="text-[11px] md:text-xs text-muted truncate">
									{{ selectedThread.supplier.main_email }}
								</p>
							</div>
							<div class="flex items-center gap-1.5 shrink-0">
								<UButton
v-if="!showParamsPanel" size="xs" variant="ghost" color="neutral"
									icon="i-lucide-cpu" :disabled="!latestIncomingId"
									:class="latestIncomingId ? '' : 'opacity-40'" @click="showParamsPanel = true" />
							</div>
						</div>

						<div ref="messagesContainer" class="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-4">
							<div v-if="loadingMessages" class="space-y-4">
								<USkeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-xl" />
							</div>

							<template v-else-if="messages.length">
								<div
									v-for="msg in messages"
									:key="msg.id"
									class="flex gap-2 md:gap-3"
									:class="msg.direction === 'outgoing' ? 'flex-row-reverse' : ''"
								>
									<div
										class="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
										:class="msg.direction === 'outgoing'
											? 'bg-primary text-inverted'
											: 'bg-primary/10'"
									>
										<UIcon
											:name="msg.direction === 'outgoing'
												? 'i-lucide-send'
												: 'i-lucide-building-2'"
											class="w-3.5 h-3.5 md:w-4 md:h-4"
											:class="msg.direction === 'outgoing' ? '' : 'text-primary'"
										/>
									</div>

									<div
										class="flex-1 min-w-0 max-w-[85%] md:max-w-[75%]"
										:class="msg.direction === 'outgoing' ? 'flex flex-col items-end' : ''"
									>
										<div
											class="flex items-center gap-2 mb-1"
											:class="msg.direction === 'outgoing' ? 'flex-row-reverse' : ''"
										>
											<span class="text-xs font-medium">
												{{ msg.direction === 'outgoing'
													? t('inbox.you')
													: selectedThread?.supplier.company_name }}
											</span>
											<span class="text-xs text-muted">
												{{ msg.received_at ? formatDateTime(msg.received_at) : '' }}
											</span>
										</div>

										<div
											class="rounded-xl px-3.5 py-2.5 text-sm shadow-sm border"
											:class="msg.direction === 'outgoing'
												? 'rounded-tr-md bg-primary/10 border-primary/20'
												: 'rounded-tl-md bg-elevated border-default/60'"
										>
											<p
												v-if="msg.subject"
												class="text-[10px] text-muted mb-1.5 font-medium tracking-tight"
											>
												{{ msg.subject }}
											</p>
											<pre
												class="whitespace-pre-wrap font-sans text-[13px] md:text-sm leading-relaxed"
											>{{ msg.raw_body }}</pre>
										</div>

										<div
											v-if="msg.attachments?.length"
											class="flex flex-wrap gap-2 mt-2"
											:class="msg.direction === 'outgoing' ? 'justify-end' : ''"
										>
											<button
												v-for="att in msg.attachments"
												:key="att.filename"
												type="button"
												class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-default transition-colors text-xs"
												:class="att.path
													? 'hover:bg-elevated cursor-pointer'
													: 'opacity-50 cursor-not-allowed'"
												:disabled="!att.path"
												@click="downloadAttachment(att)"
											>
												<UIcon
													:name="fileIcon(att.content_type)"
													class="w-3.5 h-3.5 text-primary"
												/>
												<span class="truncate max-w-28 md:max-w-36">{{ att.filename }}</span>
												<span v-if="att.size" class="text-muted shrink-0">{{
													formatBytes(att.size) }}</span>
											</button>
										</div>
									</div>
								</div>
							</template>

							<div v-else class="flex flex-col items-center justify-center py-16 gap-2 text-muted">
								<UIcon name="i-lucide-inbox" class="w-10 h-10 opacity-20" />
								<p class="text-sm">Сообщений нет</p>
							</div>
						</div>

						<div class="border-t border-default px-3 md:px-5 py-4 shrink-0">
							<div class="flex flex-wrap items-center justify-end gap-2 mb-2">
								<p class="text-xs text-muted font-medium mr-auto">Ответить на письмо</p>
								<ReceiptAcknowledgementButton v-model="replyBody" />
								<InsertBusinessInfoButton v-model="replyBody" />
							</div>
							<p class="text-xs sm:text-sm text-muted mb-2">
								{{ t('inbox.requisitesHint') }}
							</p>
							<UTextarea
								v-model="replyBody"
								:placeholder="t('inbox.replyPlaceholder')"
								:rows="2"
								autoresize
								:maxrows="16"
								class="w-full mb-3"
								:ui="{ base: 'min-h-[3.25rem] resize-none' }"
							/>
							<div class="flex items-center justify-between gap-2">
								<p class="text-xs text-muted hidden md:block">Ответ придёт поставщику на его email</p>
								<UButton
leading-icon="i-lucide-send" :loading="sendingReply"
									:disabled="!replyBody.trim() || !canSendReplyEmail" class="w-full md:w-auto" @click="sendReply">
									Отправить ответ
								</UButton>
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
				:class="isMobile
					? 'absolute inset-0 z-20 w-full bg-default'
					: 'w-72 md:w-80 lg:w-96'">

				<div class="px-4 py-3 border-b border-default flex items-center gap-2">
					<UButton
v-if="isMobile" variant="ghost" color="neutral" size="xs" icon="i-lucide-arrow-left"
						@click="showParamsPanel = false" />
					<p class="text-sm font-semibold truncate">Соответствие требованиям</p>
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

		<AddSupplierModal
			v-model:open="showSaveToBookmarkModal"
			:source-supplier="saveToBookmarkSupplier"
		/>
		<ImproveConditionsModal
v-if="modalSupplier" v-model:open="improveModalOpen" :request-id="id"
			:supplier="modalSupplier" :subscription="subscription" />
		<ResponseMismatchLetterModal
v-if="letterModalSupplier" v-model:open="letterModalOpen" :request-id="id"
			:supplier="letterModalSupplier" :initial-body="letterModalBody" :subscription="subscription" />
		<WinnerNotificationModal
			v-if="winnerModalSupplier"
			v-model:open="winnerModalOpen"
			:request-id="id"
			:supplier="winnerModalSupplier"
			:subscription="subscription"
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
import { pluralizeSuppliers } from '#shared/utils/textFormat'
import {
	canSendEmail,
	emailQuotaBlockMessage,
} from '#shared/utils/subscriptionAccess'
import { useIntervalFn } from '@vueuse/core'
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
const canSendReplyEmail = computed(() => canSendEmail(subscription.value, 1))
const replyQuotaMessage = computed(() => emailQuotaBlockMessage(subscription.value, 1))

const isMobile = ref(false)
onMounted(() => {
	const update = () => { isMobile.value = window.innerWidth < 768 }
	update()
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
		const result = await post<RefreshAllResponse>(
			`/requests/${id}/analysis/refresh-all`,
		)
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
				title: `Анализ запущен для ${result.queued} ${pluralizeSuppliers(result.queued)}`,
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

onMounted(() => {
	fetchThreads()
	resumeThreadPoll()
})

onUnmounted(() => {
	pauseThreadPoll()
})

const filteredThreads = computed(() => {
	const q = threadSearch.value.toLowerCase()
	if (!q) return threads.value
	return threads.value.filter(t =>
		t.supplier.company_name.toLowerCase().includes(q)
		|| t.supplier.main_email.toLowerCase().includes(q),
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

function selectThread(rsId: string) {
	selectedRsId.value = rsId
	mainTab.value = 'thread'
	replyBody.value = ''
	replyError.value = null
	void openThread(rsId)
}

async function openThread(rsId: string) {
	const loaded = await fetchMessages(rsId)
	if (loaded) {
		await markThreadRead(rsId)
	}
	fetchAnalysis()
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

const latestIncomingId = computed(() =>
	[...messages.value].reverse().find(m => m.direction === 'incoming')?.id ?? null,
)

async function fetchMessages(rsId: string, options?: { silent?: boolean }): Promise<boolean> {
	const silent = options?.silent ?? false
	if (!silent) {
		loadingMessages.value = true
		messages.value = []
	}
	try {
		messages.value = await get<Message[]>(`/requests/${id}/suppliers/${rsId}/messages`)
		return true
	} catch {
		if (!silent) messages.value = []
		return false
	} finally {
		if (!silent) loadingMessages.value = false
		await nextTick()
		scrollToBottom()
	}
}

function scrollToBottom() {
	if (messagesContainer.value)
		messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}

const replyBody = ref('')
const sendingReply = ref(false)
const replyError = ref<string | null>(null)

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
		await post(`/requests/${id}/suppliers/${rsId}/reply`, { body })
		replyBody.value = ''
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

const comparison = ref<ComparisonResponse | null>(null)
const loadingComparison = ref(false)
const exportingComparison = ref(false)
const comparisonSortBy = ref<string | null>(null)
const comparisonSortAsc = ref(true)

const priceRequirements = computed(() =>
	comparison.value?.price_requirements?.length
		? comparison.value.price_requirements
		: (comparison.value?.requirements ?? []).filter((req) =>
			['Цена за единицу без НДС'].includes(req),
		),
)

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
	if (!latestIncomingId.value) return
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
		if (
			!comparisonSortBy.value
			&& comparison.value.price_requirements?.length
		) {
			comparisonSortBy.value = comparison.value.price_requirements[0] ?? null
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

function comparisonShowStatusBadge(
	supplier: ComparisonSupplier,
	req: string,
): boolean {
	const status = supplier.statuses[req]
	return Boolean(status && status !== 'not_found')
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

watch(threads, () => {
	const hash = window.location.hash.replace('#', '')
	if (hash && threads.value.find(t => t.rs_id === hash)) {
		selectThread(hash)
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

function fileIcon(t: string | null) {
	if (!t) return 'i-lucide-file'
	if (t.includes('pdf')) return 'i-lucide-file-text'
	if (t.includes('image')) return 'i-lucide-image'
	if (t.includes('sheet') || t.includes('excel')) return 'i-lucide-table'
	if (t.includes('word')) return 'i-lucide-file-text'
	return 'i-lucide-file'
}
</script>
