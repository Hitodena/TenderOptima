<template>
	<div class="relative flex overflow-hidden mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
		style="height: calc(100dvh - 80px)">

		<div class="shrink-0 border-r border-default flex flex-col"
			:class="[isMobile && selectedRsId ? 'hidden' : 'flex', 'w-full md:w-64 lg:w-72']">

			<div class="px-4 py-3 border-b border-default flex items-center justify-between gap-2">
				<UButton variant="ghost" color="neutral" size="xs" leading-icon="i-lucide-arrow-left"
					:to="`/requests/${id}`">
					К запросу
				</UButton>
				<UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-refresh-cw"
					:loading="refreshingAll" title="Обновить анализ по всем поставщикам" @click="refreshAll" />
			</div>

			<div class="px-3 py-2 border-b border-default space-y-2">
				<UInput v-model="threadSearch" placeholder="Поиск..." icon="i-lucide-search" size="sm"
					class="w-full" />
				<USelect v-model="threadSort" :items="threadSortOptions" size="sm" class="w-full" />
			</div>

			<div class="flex-1 overflow-y-auto">
				<div v-if="loadingThreads" class="space-y-2 p-3">
					<USkeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-xl" />
				</div>

				<div v-else-if="sortedThreads.length === 0"
					class="flex flex-col items-center justify-center py-12 gap-2 px-4">
					<UIcon name="i-lucide-mail-open" class="w-8 h-8 text-muted opacity-40" />
					<p class="text-sm text-muted text-center">
						{{ threadSearch ? 'Ничего не найдено' : 'Ответов пока нет' }}
					</p>
				</div>

				<button v-for="thread in sortedThreads" :key="thread.rs_id" type="button"
					class="w-full text-left px-4 py-4 border-b border-default/50 hover:bg-elevated/50 transition-colors cursor-pointer"
					:class="selectedRsId === thread.rs_id ? 'bg-elevated border-l-2 border-l-primary' : ''"
					@click="selectThread(thread.rs_id)">
					<div class="flex items-start gap-3">
						<div
							class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
							<UIcon name="i-lucide-building-2" class="w-5 h-5 text-primary" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between gap-2 mb-1">
								<p class="text-sm font-semibold truncate">{{ thread.supplier.company_name }}</p>
								<span v-if="thread.unread" class="w-2 h-2 rounded-full bg-primary shrink-0" />
							</div>
							<p class="text-xs text-muted truncate mb-2">
								{{ thread.last_message?.body
									? thread.last_message.body.slice(0, 60)
									: 'Нет сообщений' }}
							</p>
							<div class="flex items-center justify-between gap-2">
								<UBadge :color="thread.last_message?.direction === 'incoming' ? 'success' : 'neutral'"
									variant="subtle" size="sm">
									{{ thread.message_count }} {{ messageCountLabel(thread.message_count) }}
								</UBadge>
								<span class="text-xs text-muted whitespace-nowrap shrink-0">
									{{ thread.last_message?.received_at
										? formatDateShort(thread.last_message.received_at)
										: '—' }}
								</span>
							</div>
						</div>
					</div>
				</button>
			</div>
		</div>

		<div class="flex-1 flex flex-col min-w-0"
			:class="isMobile && !selectedRsId && mainTab !== 'comparison' ? 'hidden' : 'flex'">

			<div class="px-3 md:px-5 py-2 border-b border-default flex items-center gap-2 shrink-0">
				<UButton v-if="isMobile && selectedRsId && mainTab === 'thread'" variant="ghost" size="sm"
					icon="i-lucide-arrow-left" class="mr-1 shrink-0" @click="selectedRsId = null" />
				<div class="flex gap-1 p-0.5 bg-elevated rounded-lg">
					<button type="button" class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
						:class="mainTab === 'thread'
							? 'bg-default text-default shadow-sm'
							: 'text-muted hover:text-default'"
						@click="mainTab = 'thread'">
						Переписка
					</button>
					<button type="button" class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
						:class="mainTab === 'comparison'
							? 'bg-default text-default shadow-sm'
							: 'text-muted hover:text-default'"
						@click="mainTab = 'comparison'">
						Сравнение
					</button>
				</div>
			</div>

			<template v-if="mainTab === 'comparison'">
				<div class="flex-1 flex flex-col min-h-0">
					<div class="flex-1 overflow-auto px-3 md:px-5 py-4 min-h-0">
						<div v-if="loadingComparison" class="space-y-3">
							<USkeleton v-for="i in 6" :key="i" class="h-10 w-full rounded-lg" />
						</div>
						<div v-else-if="!comparison?.requirements.length"
							class="flex flex-col items-center justify-center py-16 gap-2 text-muted">
							<UIcon name="i-lucide-table" class="w-10 h-10 opacity-20" />
							<p class="text-sm">Нет требований для сравнения</p>
						</div>
						<div v-else-if="comparison.suppliers.length === 0"
							class="flex flex-col items-center justify-center py-16 gap-2 text-muted">
							<UIcon name="i-lucide-users" class="w-10 h-10 opacity-20" />
							<p class="text-sm">Нет проанализированных ответов</p>
						</div>
						<div v-else class="overflow-x-auto rounded-xl border border-default">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-default bg-elevated/50">
										<th
											class="sticky left-0 z-10 bg-elevated/95 px-3 py-2.5 text-left text-xs font-semibold min-w-40">
											Требование
										</th>
										<th v-for="supplier in comparison.suppliers" :key="supplier.rs_id"
											class="px-3 py-2.5 text-left text-xs font-semibold min-w-36">
											<p class="truncate">{{ supplier.company_name }}</p>
											<p class="text-[10px] text-muted font-normal truncate">
												{{ supplier.main_email }}
											</p>
										</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="req in comparison.requirements" :key="req"
										class="border-b border-default/50 last:border-0">
										<td
											class="sticky left-0 z-10 bg-default px-3 py-2.5 text-xs font-medium align-top">
											{{ req }}
										</td>
										<td v-for="supplier in comparison.suppliers" :key="supplier.rs_id"
											class="px-3 py-2.5 align-middle">
											<div class="flex items-center gap-2">
												<div class="flex-1 min-w-0 space-y-1">
													<p class="text-xs">
														{{ supplier.values[req] || '—' }}
													</p>
													<p v-if="getOfferValueTrend(supplier.values[req], supplier.previous_values?.[req])"
														class="text-[10px] text-muted line-through">
														{{ supplier.previous_values?.[req] }}
													</p>
													<UBadge v-if="supplier.statuses[req]"
														:color="comparisonStatusColor(supplier.statuses[req]!)"
														variant="subtle" size="sm">
														{{ comparisonStatusLabel(supplier.statuses[req]!) }}
													</UBadge>
												</div>
												<UIcon
													v-if="getOfferValueTrend(supplier.values[req], supplier.previous_values?.[req]) === 'up'"
													name="i-lucide-arrow-up"
													class="w-5 h-5 shrink-0 text-error"
													title="Значение выросло" />
												<UIcon
													v-else-if="getOfferValueTrend(supplier.values[req], supplier.previous_values?.[req]) === 'down'"
													name="i-lucide-arrow-down"
													class="w-5 h-5 shrink-0 text-success"
													title="Значение снизилось" />
											</div>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
					<div v-if="comparison?.requirements.length && comparison?.suppliers.length"
						class="shrink-0 border-t border-default px-3 md:px-5 py-3 flex justify-end">
						<UButton size="sm" variant="outline" leading-icon="i-lucide-download"
							:loading="exportingComparison" @click="exportComparisonCsv">
							Экспорт CSV
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
							<p class="font-semibold truncate text-sm md:text-base">
								{{ selectedThread?.supplier.company_name }}
							</p>
							<p v-if="selectedThread?.supplier.main_email"
								class="text-[11px] md:text-xs text-muted truncate">
								{{ selectedThread.supplier.main_email }}
							</p>
						</div>
						<div class="flex items-center gap-1.5 shrink-0">
							<UButton v-if="!showParamsPanel" size="xs" variant="ghost" color="neutral"
								icon="i-lucide-cpu" :disabled="!latestIncomingId"
								:class="latestIncomingId ? '' : 'opacity-40'" @click="showParamsPanel = true" />
						</div>
					</div>

					<div ref="messagesContainer" class="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-4">
						<div v-if="loadingMessages" class="space-y-4">
							<USkeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-xl" />
						</div>

						<template v-else-if="messages.length">
							<div v-for="msg in messages" :key="msg.id" class="flex gap-2 md:gap-3"
								:class="msg.direction === 'outgoing' ? 'flex-row-reverse' : ''">

								<div class="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
									:class="msg.direction === 'incoming' ? 'bg-primary/10' : 'bg-elevated'">
									<UIcon :name="msg.direction === 'incoming' ? 'i-lucide-building-2' : 'i-lucide-user'"
										class="w-3.5 h-3.5 md:w-4 md:h-4"
										:class="msg.direction === 'incoming' ? 'text-primary' : 'text-muted'" />
								</div>

								<div class="flex-1 min-w-0 max-w-[85%] md:max-w-[75%]">
									<div class="flex items-center gap-2 mb-1"
										:class="msg.direction === 'outgoing' ? 'flex-row-reverse' : ''">
										<span class="text-xs font-medium">
											{{ msg.direction === 'incoming'
												? selectedThread?.supplier.company_name
												: 'Вы' }}
										</span>
										<span class="text-xs text-muted">
											{{ msg.received_at ? formatDateTime(msg.received_at) : '' }}
										</span>
									</div>

									<div class="rounded-xl px-3.5 py-2.5 text-sm shadow-sm" :class="msg.direction === 'incoming'
										? 'bg-elevated border border-default/60 rounded-tl-md'
										: 'bg-primary/10 rounded-tr-md'">
										<p v-if="msg.subject"
											class="text-[10px] text-muted mb-1.5 font-medium tracking-tight">
											{{ msg.subject }}
										</p>
										<pre
											class="whitespace-pre-wrap font-sans text-[13px] md:text-sm leading-relaxed">{{ msg.raw_body }}</pre>
									</div>

									<div v-if="msg.attachments?.length" class="flex flex-wrap gap-2 mt-2">
										<button v-for="att in msg.attachments" :key="att.filename" type="button"
											class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-default hover:bg-elevated transition-colors text-xs cursor-pointer"
											@click="downloadAttachment(att)">
											<UIcon :name="fileIcon(att.content_type)"
												class="w-3.5 h-3.5 text-primary" />
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
						<p class="text-xs text-muted font-medium mb-2">Ответить на письмо</p>
						<UTextarea v-model="replyBody" placeholder="Текст сообщения..." :rows="isMobile ? 3 : 4"
							class="w-full mb-3" />
						<div class="flex items-center justify-between gap-2">
							<p class="text-xs text-muted hidden md:block">Ответ придёт поставщику на его email</p>
							<UButton leading-icon="i-lucide-send" :loading="sendingReply" :disabled="!replyBody.trim()"
								class="w-full md:w-auto" @click="sendReply">
								Отправить ответ
							</UButton>
						</div>
						<UAlert v-if="replyError" color="error" variant="soft" icon="i-lucide-circle-alert"
							:description="replyError" class="mt-2" />
					</div>
				</template>
			</template>
		</div>

		<div v-if="showParamsPanel && mainTab === 'thread'" class="shrink-0 border-l border-default flex flex-col"
			:class="isMobile
				? 'absolute inset-0 z-20 w-full bg-default'
				: 'w-64 md:w-72'">

			<div class="px-4 py-3 border-b border-default flex items-center justify-between gap-2">
				<div class="flex items-center gap-2 min-w-0">
					<UButton v-if="isMobile" variant="ghost" color="neutral" size="xs" icon="i-lucide-arrow-left"
						@click="showParamsPanel = false" />
					<p class="text-sm font-semibold truncate">Соответствие требованиям</p>
				</div>
				<div class="flex items-center gap-1 shrink-0">
					<UButton v-if="!isMobile" size="xs" variant="ghost" color="neutral" icon="i-lucide-x"
						@click="showParamsPanel = false" />
				</div>
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
					<div v-if="extracting || analysisPolling"
						class="flex items-center gap-2 text-xs text-muted">
						<UIcon name="i-lucide-loader" class="w-3 h-3 animate-spin" />
						AI анализирует ответ...
					</div>
					<div v-if="requirementMatches.length" class="space-y-2">
						<div v-for="(m, idx) in requirementMatches" :key="idx"
							class="rounded-lg border border-default/60 p-2 space-y-1.5">
							<div class="flex items-start gap-2">
								<UIcon :name="matchStatusIcon(m.status)" class="w-4 h-4 shrink-0 mt-0.5"
									:class="matchStatusClass(m.status)" />
								<p class="text-xs font-medium flex-1">{{ m.requirement }}</p>
							</div>
							<div class="pl-6 space-y-1">
								<template v-if="editingMatchIdx === idx">
									<UTextarea v-model="editingMatchValue" size="xs" :rows="2" class="w-full" />
									<div class="flex gap-1">
										<UButton size="xs" variant="ghost" color="primary" icon="i-lucide-check"
											:loading="savingParams" @click="commitMatchEdit(idx)" />
										<UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x"
											@click="editingMatchIdx = null" />
									</div>
								</template>
								<template v-else>
									<div class="flex items-start gap-1">
										<div class="flex-1 min-w-0">
											<p class="text-[11px] text-muted">Предложение</p>
											<p class="text-xs"
												:class="m.offer_value ? 'text-default' : 'text-muted italic'">
												{{ m.offer_value ?? 'Не указано' }}
											</p>
											<p v-if="matchOfferChanged(m)" class="text-[10px] text-muted mt-0.5">
												<span class="line-through">{{ previousMatchValues[m.requirement]
												}}</span>
												→ {{ m.offer_value }}
											</p>
										</div>
										<button type="button"
											class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer mt-3"
											@click="startMatchEdit(idx, m.offer_value)">
											<UIcon name="i-lucide-pencil" class="w-3 h-3" />
										</button>
									</div>
								</template>
								<p v-if="m.explanation" class="text-[11px] text-default/80">
									{{ m.explanation }}
								</p>
							</div>
						</div>
					</div>
					<div v-else-if="!extracting && !analysisPolling"
						class="flex flex-col items-center justify-center py-8 gap-2 text-muted">
						<UIcon name="i-lucide-file-x" class="w-7 h-7 opacity-20" />
						<p class="text-xs text-center">Данные не извлечены</p>
						<p class="text-[10px] text-center">Анализ запустится автоматически</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type {
	Attachment,
	ComparisonResponse,
	EmailAnalysisResponse,
	Message,
	RefreshAllResponse,
	RequirementMatch,
	ThreadSummary,
	TZAnalysisStatus,
} from '#shared/types'
import { getOfferValueTrend } from '#shared/utils/offerValue'
import { TZAnalysisRunStatus } from '#shared/types'
import { useRunStatusPolling } from '~/composables/useRunStatusPolling'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const { get, post, patch } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()
const { formatDateTime, formatDateShort } = useFormatDate()

const isMobile = ref(false)
onMounted(() => {
	const update = () => { isMobile.value = window.innerWidth < 768 }
	update()
	window.addEventListener('resize', update)
	onUnmounted(() => window.removeEventListener('resize', update))
})

const showParamsPanel = ref(true)
const mainTab = ref<'thread' | 'comparison'>('thread')

const threads = ref<ThreadSummary[]>([])
const loadingThreads = ref(true)
const refreshingAll = ref(false)
const threadSearch = ref('')
const threadSort = ref('date_desc')
const selectedRsId = ref<string | null>(null)

const threadSortOptions = [
	{ label: 'По дате (новые сверху)', value: 'date_desc' },
	{ label: 'По дате (старые сверху)', value: 'date_asc' },
	{ label: 'По имени А→Я', value: 'name_asc' },
	{ label: 'Непрочитанные сначала', value: 'unread_first' },
]

async function fetchThreads() {
	loadingThreads.value = true
	try {
		threads.value = await get<ThreadSummary[]>(`/requests/${id}/threads`)
	} catch {
		threads.value = []
	} finally {
		loadingThreads.value = false
	}
}

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
				title: `Анализ запущен для ${result.queued} поставщиков`,
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
	fetchMessages(rsId)
	fetchAnalysis()
}

const messages = ref<Message[]>([])
const loadingMessages = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

const latestIncomingId = computed(() =>
	[...messages.value].reverse().find(m => m.direction === 'incoming')?.id ?? null,
)

async function fetchMessages(rsId: string, options?: { silent?: boolean }) {
	const silent = options?.silent ?? false
	if (!silent) {
		loadingMessages.value = true
		messages.value = []
	}
	try {
		messages.value = await get<Message[]>(`/requests/${id}/suppliers/${rsId}/messages`)
	} catch {
		if (!silent) messages.value = []
	} finally {
		if (!silent) loadingMessages.value = false
		await nextTick()
		scrollToBottom()
	}
}

async function pollMessagesAfterSend(rsId: string, knownIds: Set<string>) {
	const maxAttempts = 15
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		await fetchMessages(rsId, { silent: true })
		if (messages.value.some(m => !knownIds.has(String(m.id)))) return
		await new Promise(resolve => setTimeout(resolve, 400))
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
	const rsId = selectedRsId.value
	const knownIds = new Set(messages.value.map(m => String(m.id)))
	const body = replyBody.value
	sendingReply.value = true
	replyError.value = null
	try {
		await post(`/requests/${id}/suppliers/${rsId}/reply`, { body })
		replyBody.value = ''
		toast.add({ title: 'Ответ отправлен', color: 'success', icon: 'i-lucide-mail-check' })
		await pollMessagesAfterSend(rsId, knownIds)
		await fetchThreads()
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		replyError.value = typeof detail === 'string' ? detail : 'Не удалось отправить ответ'
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
const editingMatchIdx = ref<number | null>(null)
const editingMatchValue = ref('')

const comparison = ref<ComparisonResponse | null>(null)
const loadingComparison = ref(false)
const exportingComparison = ref(false)

function applyEmailAnalysis(data: EmailAnalysisResponse) {
	requirementMatches.value = data.matches || []
	previousMatchValues.value = data.previous_parameters || {}
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

async function fetchAnalysis() {
	if (!latestIncomingId.value) {
		requirementMatches.value = []
		previousMatchValues.value = {}
		analysisPolling.value = false
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
		if (status === 404 && latestIncomingId.value) {
			await reExtract(true)
			return
		}
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
	} catch {
		comparison.value = null
	} finally {
		loadingComparison.value = false
	}
}

async function exportComparisonCsv() {
	exportingComparison.value = true
	try {
		const res = await $axios.get(
			`/requests/${id}/analysis/comparison.csv`,
			{ responseType: 'blob' },
		)
		const blob = res.data as Blob
		const objectUrl = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = objectUrl
		a.download = `request_${id}_comparison.csv`
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(objectUrl)
	} catch {
		toast.add({ title: 'Не удалось экспортировать CSV', color: 'error' })
	} finally {
		exportingComparison.value = false
	}
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
	if (!att.path) return
	try {
		const blob = await get<Blob>(
			`/requests/attachments/serve?attachment_path=${encodeURIComponent(att.path)}`,
			{ responseType: 'blob' },
		)
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

function messageCountLabel(n: number) {
	if (n % 10 === 1 && n % 100 !== 11) return 'письмо'
	if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'письма'
	return 'писем'
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
