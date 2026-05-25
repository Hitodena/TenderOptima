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
				<UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-refresh-cw" :loading="loadingThreads"
					@click="fetchThreads" />
			</div>

			<div class="px-3 py-2 border-b border-default">
				<UInput v-model="threadSearch" placeholder="Поиск..." icon="i-lucide-search" size="sm" class="w-full" />
			</div>

			<div class="flex-1 overflow-y-auto">
				<div v-if="loadingThreads" class="space-y-2 p-3">
					<USkeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-xl" />
				</div>

				<div v-else-if="filteredThreads.length === 0"
					class="flex flex-col items-center justify-center py-12 gap-2 px-4">
					<UIcon name="i-lucide-mail-open" class="w-8 h-8 text-muted opacity-40" />
					<p class="text-sm text-muted text-center">
						{{ threadSearch ? 'Ничего не найдено' : 'Ответов пока нет' }}
					</p>
				</div>

				<button v-for="thread in filteredThreads" :key="thread.rs_id" type="button"
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

		<div class="flex-1 flex flex-col min-w-0" :class="isMobile && !selectedRsId ? 'hidden' : 'flex'">

			<div v-if="!selectedRsId" class="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
				<UIcon name="i-lucide-mail" class="w-12 h-12 opacity-20" />
				<p class="text-sm">Выберите поставщика из списка</p>
			</div>

			<template v-else>
				<div class="px-3 md:px-5 py-2.5 border-b border-default flex items-center gap-2 shrink-0">
					<UButton v-if="isMobile" variant="ghost" size="sm" icon="i-lucide-arrow-left" class="mr-1"
						@click="selectedRsId = null" />
					<div class="min-w-0 flex-1">
						<p class="font-semibold truncate text-sm md:text-base">
							{{ selectedThread?.supplier.company_name }}
						</p>
						<p v-if="selectedThread?.supplier.main_email" class="text-[11px] md:text-xs text-muted truncate">
							{{ selectedThread.supplier.main_email }}
						</p>
					</div>
					<div class="flex items-center gap-1.5 shrink-0">
						<UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-refresh-cw"
							:loading="loadingMessages" @click="fetchMessages(selectedRsId!)" />
						<UButton v-if="!showParamsPanel" size="xs" variant="ghost" color="neutral" icon="i-lucide-cpu"
							:disabled="!latestIncomingId" :class="latestIncomingId ? '' : 'opacity-40'"
							@click="showParamsPanel = true" />
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
										{{ msg.received_at ? formatDate(msg.received_at) : '' }}
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
										<UIcon :name="fileIcon(att.content_type)" class="w-3.5 h-3.5 text-primary" />
										<span class="truncate max-w-28 md:max-w-36">{{ att.filename }}</span>
										<span v-if="att.size" class="text-muted shrink-0">{{ formatBytes(att.size)
										}}</span>
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
		</div>

		<div v-if="showParamsPanel" class="shrink-0 border-l border-default flex flex-col" :class="isMobile
			? 'absolute inset-0 z-20 w-full bg-default'
			: 'w-64'">

			<div class="px-4 py-3 border-b border-default flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<UButton v-if="isMobile" variant="ghost" color="neutral" size="xs" icon="i-lucide-arrow-left"
						@click="showParamsPanel = false" />
					<p class="text-sm font-semibold">Извлечённые параметры</p>
				</div>
				<div class="flex items-center gap-1">
					<UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-refresh-cw" :loading="extracting"
						:disabled="!latestIncomingId" @click="reExtract" />
					<UButton v-if="paramsDirty" size="xs" variant="ghost" color="primary" icon="i-lucide-save"
						:loading="savingParams" @click="saveParams" />
					<UButton v-if="!isMobile" size="xs" variant="ghost" color="neutral" icon="i-lucide-x"
						@click="showParamsPanel = false" />
				</div>
			</div>

			<div class="flex-1 overflow-y-auto px-3 py-3">
				<div v-if="!selectedRsId" class="flex flex-col items-center justify-center h-full gap-2 text-muted">
					<UIcon name="i-lucide-file-search" class="w-7 h-7 opacity-20" />
					<p class="text-xs text-center">Выберите тред</p>
				</div>

				<div v-else-if="loadingAnalysis" class="space-y-3">
					<USkeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-lg" />
				</div>

				<div v-else class="space-y-2.5">
					<div v-if="extracting" class="flex items-center gap-2 text-xs text-muted mb-3">
						<UIcon name="i-lucide-loader" class="w-3 h-3 animate-spin" />
						AI извлекает параметры...
					</div>

					<div v-for="(value, label) in extractedParams" :key="label" class="space-y-0.5">
						<p class="text-[11px] text-muted font-medium leading-tight">{{ label }}</p>
						<div class="flex items-center gap-1">
							<template v-if="editingParam === label">
								<UInput v-model="editingValue" size="xs" class="flex-1" @keyup.enter="commitEdit(label)"
									@keyup.escape="editingParam = null" />
								<UButton size="xs" variant="ghost" color="primary" icon="i-lucide-check"
									@click="commitEdit(label)" />
								<UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x"
									@click="editingParam = null" />
							</template>
							<template v-else>
								<p class="text-xs flex-1 min-w-0 truncate"
									:class="value ? 'text-default' : 'text-muted italic'">
									{{ value ?? 'Не указано' }}
								</p>
								<button type="button"
									class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer"
									@click="startEdit(label, value)">
									<UIcon name="i-lucide-pencil" class="w-3 h-3" />
								</button>
							</template>
						</div>
					</div>

					<div v-if="Object.keys(extractedParams).length === 0"
						class="flex flex-col items-center justify-center py-8 gap-2 text-muted">
						<UIcon name="i-lucide-file-x" class="w-7 h-7 opacity-20" />
						<p class="text-xs text-center">Параметры не извлечены</p>
						<UButton size="xs" variant="outline" leading-icon="i-lucide-zap" :disabled="!latestIncomingId"
							@click="reExtract">
							Извлечь
						</UButton>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { Attachment, Message, ThreadSummary } from '#shared/types'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const { get, post } = useApi()
const toast = useToast()

const isMobile = ref(false)
onMounted(() => {
	const update = () => { isMobile.value = window.innerWidth < 768 }
	update()
	window.addEventListener('resize', update)
	onUnmounted(() => window.removeEventListener('resize', update))
})


const showParamsPanel = ref(true)


const threads = ref<ThreadSummary[]>([])
const loadingThreads = ref(true)
const threadSearch = ref('')
const selectedRsId = ref<string | null>(null)

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

onMounted(() => {
	fetchThreads()
})

const filteredThreads = computed(() => {
	const q = threadSearch.value.toLowerCase()
	if (!q) return threads.value
	return threads.value.filter(t =>
		t.supplier.company_name.toLowerCase().includes(q) ||
		t.supplier.main_email.toLowerCase().includes(q)
	)
})

const selectedThread = computed(() =>
	threads.value.find(t => t.rs_id === selectedRsId.value) ?? null
)

function selectThread(rsId: string) {
	selectedRsId.value = rsId
	replyBody.value = ''
	replyError.value = null
	fetchMessages(rsId)
	fetchAnalysis()
}

const messages = ref<Message[]>([])
const loadingMessages = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

const latestIncomingId = computed(() =>
	[...messages.value].reverse().find(m => m.direction === 'incoming')?.id ?? null
)

async function fetchMessages(rsId: string) {
	loadingMessages.value = true
	messages.value = []
	try {
		messages.value = await get<Message[]>(`/requests/${id}/suppliers/${rsId}/messages`)
	} catch {
		messages.value = []
	} finally {
		loadingMessages.value = false
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
	sendingReply.value = true
	replyError.value = null
	try {
		await post(`/requests/${id}/suppliers/${selectedRsId.value}/reply`, {
			body: replyBody.value,
		})
		replyBody.value = ''
		toast.add({ title: 'Ответ отправлен', color: 'success', icon: 'i-lucide-mail-check' })
		await fetchMessages(selectedRsId.value)
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		replyError.value = typeof detail === 'string' ? detail : 'Не удалось отправить ответ'
	} finally {
		sendingReply.value = false
	}
}


const extractedParams = ref<Record<string, string | null>>({})
const loadingAnalysis = ref(false)
const savingParams = ref(false)
const extracting = ref(false)
const paramsDirty = ref(false)
const editingParam = ref<string | null>(null)
const editingValue = ref('')

async function fetchAnalysis() {
	if (!latestIncomingId.value) {
		extractedParams.value = {}
		return
	}
	loadingAnalysis.value = true
	paramsDirty.value = false
	try {
		// TODO: GET /responses/{latestIncomingId}/analysis
		// const data = await get<{ params: Record<string, string | null> }>(
		//   `/responses/${latestIncomingId.value}/analysis`
		// )
		// extractedParams.value = data.params
		extractedParams.value = {}
	} catch {
		extractedParams.value = {}
	} finally {
		loadingAnalysis.value = false
	}
}

async function saveParams() {
	if (!latestIncomingId.value) return
	savingParams.value = true
	try {
		// TODO: PATCH /responses/{latestIncomingId}/analysis  body: { params }
		// await patch(`/responses/${latestIncomingId.value}/analysis`, { params: extractedParams.value })
		paramsDirty.value = false
		toast.add({ title: 'Параметры сохранены', color: 'success', icon: 'i-lucide-check' })
	} catch (e: any) {
		toast.add({ title: e?.response?.data?.detail ?? 'Ошибка сохранения', color: 'error' })
	} finally {
		savingParams.value = false
	}
}

async function reExtract() {
	if (!latestIncomingId.value) return
	extracting.value = true
	try {
		// TODO: POST /responses/{latestIncomingId}/extract  → 202 Accepted
		// await post(`/responses/${latestIncomingId.value}/extract`)
		toast.add({ title: 'AI-извлечение пока не реализовано', color: 'info' })
	} finally {
		extracting.value = false
	}
}

function startEdit(label: string, value: string | null) {
	editingParam.value = label
	editingValue.value = value ?? ''
}

function commitEdit(label: string) {
	extractedParams.value[label] = editingValue.value.trim() || null
	editingParam.value = null
	paramsDirty.value = true
}


async function downloadAttachment(att: Attachment) {
	if (!att.path) return
	try {
		const blob = await get<Blob>(
			`/requests/attachments/serve?attachment_path=${encodeURIComponent(att.path)}`,
			{ responseType: 'blob' }
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


function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	})
}

function formatDateShort(iso: string) {
	const d = new Date(iso)
	const now = new Date()
	if (d.toDateString() === now.toDateString())
		return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
	return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

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
