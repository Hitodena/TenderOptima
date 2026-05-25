<template>
	<div class="flex overflow-hidden mx-auto w-full max-w-7xl px-2 sm:px-4 lg:px-6" style="height: calc(100dvh - 80px)">

		<div v-show="!(isMobile && selectedRsId)"
			class="w-full md:w-64 lg:w-72 shrink-0 border-r border-default flex flex-col">

			<div class="px-4 py-3 border-b border-default flex items-center justify-between gap-2">
				<div>
					<UButton variant="ghost" color="neutral" size="xs" leading-icon="i-lucide-arrow-left"
						:to="`/requests/${id}`">
						К запросу
					</UButton>
				</div>
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
					<p class="text-sm text-muted text-center">{{ threadSearch ? 'Ничего не найдено' : 'Ответов пока нет'
					}}</p>
				</div>

				<button v-for="thread in filteredThreads" :key="thread.rs_id" type="button"
					class="w-full text-left px-3 py-3 border-b border-default/50 hover:bg-elevated/50 transition-colors cursor-pointer"
					:class="selectedRsId === thread.rs_id ? 'bg-elevated border-l-2 border-l-primary' : ''"
					@click="selectThread(thread.rs_id)">

					<div class="flex items-start gap-2">
						<div
							class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
							<UIcon name="i-lucide-building-2" class="w-4 h-4 text-primary" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between gap-1 mb-0.5">
								<p class="text-sm font-semibold truncate">{{ thread.supplier.company_name }}</p>
								<div class="flex items-center gap-1 shrink-0">
									<span v-if="thread.unread" class="w-2 h-2 rounded-full bg-primary shrink-0" />
									<span class="text-xs text-muted whitespace-nowrap">
										{{ thread.last_message?.received_at ?
											formatDateShort(thread.last_message.received_at) : '—'
										}}
									</span>
								</div>
							</div>
							<p class="text-xs text-muted truncate">
								{{ thread.last_message?.body ?? 'Нет сообщений' }}
							</p>
							<div class="flex items-center gap-2 mt-1">
								<UBadge :color="thread.last_message?.direction === 'incoming' ? 'success' : 'neutral'"
									variant="subtle" size="xs">
									{{ thread.message_count }} {{ messageCountLabel(thread.message_count) }}
								</UBadge>
							</div>
						</div>
					</div>
				</button>
			</div>
		</div>

		<div class="flex-1 flex flex-col min-w-0">

			<div v-if="!selectedRsId" class="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
				<UIcon name="i-lucide-mail" class="w-12 h-12 opacity-20" />
				<p class="text-sm">Выберите поставщика из списка</p>
			</div>

			<template v-else>
				<div class="px-3 md:px-5 py-2.5 border-b border-default flex items-center gap-2 shrink-0">
					<UButton v-if="isMobile" variant="ghost" size="sm" icon="i-lucide-arrow-left"
						@click="selectedRsId = null" class="mr-1" />

					<div class="min-w-0 flex-1">
						<p class="font-semibold truncate text-sm md:text-base">
							{{ selectedThread?.supplier.company_name ?? 'Выберите поставщика' }}
						</p>
						<p v-if="selectedThread?.supplier.email" class="text-[11px] md:text-xs text-muted truncate">
							{{ selectedThread.supplier.email }}
						</p>
					</div>

					<div class="flex items-center gap-1.5 shrink-0">
						<UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-refresh-cw"
							:loading="loadingMessages" @click="fetchMessages(selectedRsId!)" />
					</div>
				</div>

				<div ref="messagesContainer" class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
					<div v-if="loadingMessages" class="space-y-4">
						<USkeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-xl" />
					</div>

					<template v-else-if="messages.length">
						<div v-for="msg in messages" :key="msg.id" class="flex gap-3"
							:class="msg.direction === 'outgoing' ? 'flex-row-reverse' : ''">

							<div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
								:class="msg.direction === 'incoming' ? 'bg-primary/10' : 'bg-elevated'">
								<UIcon :name="msg.direction === 'incoming' ? 'i-lucide-building-2' : 'i-lucide-user'"
									class="w-4 h-4"
									:class="msg.direction === 'incoming' ? 'text-primary' : 'text-muted'" />
							</div>

							<div class="flex-1 min-w-0 max-w-[75%]">
								<div class="flex items-center gap-2 mb-1"
									:class="msg.direction === 'outgoing' ? 'flex-row-reverse' : ''">
									<span class="text-xs font-medium">
										{{ msg.direction === 'incoming' ? selectedThread?.supplier.company_name ?? '' :
											'Вы'
										}}
									</span>
									<span class="text-xs text-muted">{{ msg.received_at ? formatDate(msg.received_at) :
										'' }}</span>
								</div>

								<div class="rounded-2xl px-3.5 py-2.5 text-sm shadow-sm" :class="msg.direction === 'incoming'
									? 'bg-elevated border border-default/60 rounded-tl-md'
									: 'bg-primary/10 rounded-tr-md'">
									<p v-if="msg.subject"
										class="text-[10px] text-muted mb-1.5 font-medium tracking-tight">
										{{ msg.subject }}
									</p>
									<div class="whitespace-pre-wrap wrap-break-word text-[14px] leading-[1.35]">
										{{ msg.raw_body }}
									</div>
								</div>

								<div v-if="msg.attachments?.length" class="flex flex-wrap gap-2 mt-2">
									<button v-for="att in msg.attachments" :key="att.filename" type="button"
										class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-default hover:bg-elevated transition-colors text-xs cursor-pointer"
										@click="downloadAttachment(att)">
										<UIcon :name="fileIcon(att.content_type)" class="w-3.5 h-3.5 text-primary" />
										<span class="truncate max-w-36">{{ att.filename }}</span>
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

				<div class="border-t border-default px-5 py-3 shrink-0">
					<p class="text-xs text-muted font-medium mb-2">Ответить на письмо</p>
					<div class="flex gap-2 items-end">
						<UTextarea v-model="replyBody" placeholder="Текст сообщения..." :rows="3"
							class="flex-1 resize-none" />
						<UButton leading-icon="i-lucide-send" :loading="sendingReply" :disabled="!replyBody.trim()"
							@click="sendReply">
							Отправить ответ
						</UButton>
					</div>
					<UAlert v-if="replyError" color="error" variant="soft" icon="i-lucide-circle-alert"
						:description="replyError" class="mt-2" />
				</div>
			</template>
		</div>

		<div class="hidden lg:flex w-80 shrink-0 border-l border-default flex-col">
			<div class="px-4 py-3 border-b border-default flex items-center justify-between gap-2">
				<p class="text-sm font-semibold">Извлечённые параметры</p>
				<div class="flex items-center gap-1">
					<UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-info"
						title="AI-извлечение будет добавлено позже" />
				</div>
			</div>

			<div class="flex-1 overflow-y-auto px-4 py-3">
				<div class="flex flex-col items-center justify-center h-full gap-3 text-muted">
					<UIcon name="i-lucide-cpu" class="w-12 h-12 opacity-20" />
					<p class="text-sm text-center">AI-извлечение параметров будет добавлено позже</p>
				</div>
			</div>
		</div>

	</div>
</template>

<script lang="ts" setup>

import type { Message, ThreadSummary } from '#shared/types'

const route = useRoute()
const id = route.params.id as string
const { get, post, patch } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()

const threads = ref<ThreadSummary[]>([])
const loadingThreads = ref(true)
const threadSearch = ref('')
const selectedRsId = ref<string | null>(null)

const filteredThreads = computed(() => {
	const q = threadSearch.value.toLowerCase()
	if (!q) return threads.value
	return threads.value.filter(t =>
		t.supplier.company_name?.toLowerCase().includes(q) ||
		t.supplier.email?.toLowerCase().includes(q)
	)
})

const selectedThread = computed(() =>
	threads.value.find(t => t.rs_id === selectedRsId.value) ?? null
)

async function fetchThreads() {
	loadingThreads.value = true
	try {
		threads.value = await get<ThreadSummary[]>(`/requests/${id}/threads`)
	} catch (e: any) {
		threads.value = []
		toast.add({ title: e?.data?.detail ?? 'Ошибка загрузки тредов', color: 'error' })
	} finally {
		loadingThreads.value = false
	}
}

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
	} catch (e: any) {
		messages.value = []
		toast.add({ title: e?.data?.detail ?? 'Ошибка загрузки сообщений', color: 'error' })
	} finally {
		loadingMessages.value = false
		await nextTick()
		scrollToBottom()
	}
}

function scrollToBottom() {
	if (messagesContainer.value) {
		messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
	}
}

const replyBody = ref('')
const sendingReply = ref(false)
const replyError = ref<string | null>(null)

async function sendReply() {
	if (!selectedRsId.value || !replyBody.value.trim()) return
	sendingReply.value = true
	replyError.value = null
	const optimistic: Message = {
		id: crypto.randomUUID(),
		direction: 'outgoing',
		subject: null,
		raw_body: replyBody.value,
		attachments: null,
		received_at: new Date().toISOString(),
	}
	messages.value.push(optimistic)
	await nextTick()
	scrollToBottom()

	try {
		await post(`/requests/${id}/suppliers/${selectedRsId.value}/reply`, { body: replyBody.value })
		replyBody.value = ''
		toast.add({ title: 'Ответ отправлен', color: 'success', icon: 'i-lucide-mail-check' })
	} catch (e: any) {
		messages.value = messages.value.filter(m => m.id !== optimistic.id)
		const detail = e?.response?.data?.detail
		replyError.value = typeof detail === 'string' ? detail : 'Не удалось отправить ответ'
		toast.add({ title: replyError.value, color: 'error' })
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

const isMobile = ref(false)
onMounted(() => {
	const update = () => isMobile.value = window.innerWidth < 768
	update()
	window.addEventListener('resize', update)
})

async function fetchAnalysis() {
	if (!latestIncomingId.value && messages.value.length === 0) {
		loadingAnalysis.value = true
		await new Promise(r => setTimeout(r, 300))
		extractedParams.value = {}
		loadingAnalysis.value = false
		return
	}
	loadingAnalysis.value = true
	paramsDirty.value = false
	try {
		await new Promise(r => setTimeout(r, 500))
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
		await new Promise(r => setTimeout(r, 400))
		paramsDirty.value = false
		toast.add({ title: 'Параметры сохранены', color: 'success', icon: 'i-lucide-check' })
	} catch (e: any) {
		const detail = e?.response?.data?.detail
		toast.add({ title: detail ?? 'Ошибка сохранения', color: 'error' })
	} finally {
		savingParams.value = false
	}
}

async function reExtract() {
	if (!latestIncomingId.value) return
	extracting.value = true
	try {
		await new Promise(r => setTimeout(r, 1200))
		toast.add({ title: 'Параметры будут обновлены', description: 'AI обрабатывает письмо', color: 'info' })
		await fetchAnalysis()
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


await fetchThreads()

watch(latestIncomingId, (id) => {
	if (id) fetchAnalysis()
})


function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	})
}

function formatDateShort(iso: string) {
	const d = new Date(iso)
	const now = new Date()
	if (d.toDateString() === now.toDateString()) {
		return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
	}
	return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} Б`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
	return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function messageCountLabel(n: number): string {
	if (n % 10 === 1 && n % 100 !== 11) return 'письмо'
	if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'письма'
	return 'писем'
}

function fileIcon(contentType: string | null): string {
	if (!contentType) return 'i-lucide-file'
	if (contentType.includes('pdf')) return 'i-lucide-file-text'
	if (contentType.includes('image')) return 'i-lucide-image'
	if (contentType.includes('sheet') || contentType.includes('excel')) return 'i-lucide-table'
	if (contentType.includes('word')) return 'i-lucide-file-text'
	return 'i-lucide-file'
}

async function downloadAttachment(file: { filename: string; path: string | null }) {
	if (!file.path) return
	try {
		const serveUrl = `/requests/attachments/serve?attachment_path=${encodeURIComponent(file.path)}`
		const resp = await $axios.get(serveUrl, { responseType: 'blob' })
		const blobUrl = URL.createObjectURL(resp.data)
		const a = document.createElement('a')
		a.href = blobUrl
		a.download = file.filename || 'attachment'
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(blobUrl)
	} catch (e: unknown) {
		console.error('Download failed', e)
		toast.add({ title: 'Не удалось скачать', description: 'Попробуйте позже', color: 'error' })
	}
}
</script>
