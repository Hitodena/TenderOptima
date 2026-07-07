<template>
	<UContainer class="py-8">
		<div class="max-w-7xl mx-auto space-y-4">
			<UCard>
				<template #header>
					<div class="flex items-center gap-3">
						<div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
							<UIcon name="i-lucide-shield" class="w-4.5 h-4.5 text-primary" />
						</div>
						<div>
							<h1 class="text-lg font-bold text-highlighted leading-tight">Админка</h1>
							<p class="text-xs text-muted">Ошибки фронтенда и идеи пользователей</p>
						</div>
					</div>
				</template>

			<UTabs v-model="activeTab" :items="tabs" :ui="{ list: 'mb-6' }">
				<template #users>
					<ProfileAdminPanel />
				</template>

				<template #errors>
						<div class="space-y-4">
							<div class="flex items-center justify-between flex-wrap gap-3">
								<p class="text-sm text-muted">
									{{ t('admin.errors.totalLabel') }}
									<span class="font-semibold text-highlighted">{{ errorsTotal }}</span>
								</p>
							</div>

							<div class="overflow-x-auto rounded-lg border border-default">
								<UTable
									:data="errors"
									:columns="errorColumns"
									:loading="loadingErrors"
									:ui="{
										td: 'align-top py-3',
										th: 'whitespace-nowrap',
									}"
									class="min-w-[960px] sm:min-w-[1100px] lg:min-w-[1280px]"
								>
									<template #empty>
										<div class="flex flex-col items-center justify-center py-12 gap-3">
											<UIcon name="i-lucide-check-circle" class="w-10 h-10 text-muted opacity-40" />
											<p class="text-muted">{{ t('admin.errors.empty') }}</p>
										</div>
									</template>

									<template #created_at-cell="{ row }">
										<span class="text-xs text-muted whitespace-nowrap tabular-nums">
											{{ formatDate(row.original.created_at) }}
										</span>
									</template>

									<template #created_time-cell="{ row }">
										<span class="text-xs text-muted whitespace-nowrap tabular-nums">
											{{ formatTime(row.original.created_at) }}
										</span>
									</template>

									<template #user-cell="{ row }">
										<div v-if="row.original.user" class="min-w-[8rem] max-w-[12rem] sm:max-w-[14rem]">
											<p class="text-xs font-medium break-all">{{ row.original.user.email }}</p>
											<p v-if="row.original.user.full_name" class="text-xs text-muted break-words mt-0.5">
												{{ row.original.user.full_name }}
											</p>
										</div>
										<span v-else class="text-xs text-muted">—</span>
									</template>

									<template #page_url-cell="{ row }">
										<div
											v-if="row.original.page_url"
											class="min-w-[8rem] max-w-[14rem] sm:max-w-[16rem] lg:max-w-[18rem]"
										>
											<p
												class="text-xs font-mono text-muted break-all"
												:class="isExpanded('page', row.original.id) ? 'whitespace-pre-wrap' : 'line-clamp-3'"
											>
												{{ row.original.page_url }}
											</p>
											<UButton
												v-if="shouldShowToggle(row.original.page_url, 120)"
												variant="link"
												color="primary"
												size="xs"
												class="px-0 mt-1 h-auto"
												@click="toggleExpand('page', row.original.id)"
											>
												{{ isExpanded('page', row.original.id) ? t('admin.errors.showLess') : t('admin.errors.showMore') }}
											</UButton>
										</div>
										<span v-else class="text-xs text-muted">—</span>
									</template>

									<template #request-cell="{ row }">
										<div
											v-if="row.original.request_method || row.original.request_url"
											class="min-w-[8rem] max-w-[14rem] sm:max-w-[16rem] lg:max-w-[18rem]"
										>
											<UBadge
												v-if="row.original.request_method"
												color="neutral"
												variant="soft"
												size="xs"
												class="shrink-0 mb-1"
											>
												{{ row.original.request_method }}
											</UBadge>
											<p
												v-if="row.original.request_url"
												class="text-xs font-mono text-muted break-all"
												:class="isExpanded('req', row.original.id) ? 'whitespace-pre-wrap' : 'line-clamp-3'"
											>
												{{ row.original.request_url }}
											</p>
											<UButton
												v-if="row.original.request_url && shouldShowToggle(row.original.request_url, 120)"
												variant="link"
												color="primary"
												size="xs"
												class="px-0 mt-1 h-auto"
												@click="toggleExpand('req', row.original.id)"
											>
												{{ isExpanded('req', row.original.id) ? t('admin.errors.showLess') : t('admin.errors.showMore') }}
											</UButton>
										</div>
										<span v-else class="text-xs text-muted">—</span>
									</template>

									<template #status_code-cell="{ row }">
										<UBadge
											v-if="row.original.status_code"
											:color="getStatusColor(row.original.status_code)"
											variant="soft"
											size="xs"
										>
											{{ row.original.status_code }}
										</UBadge>
										<span v-else class="text-xs text-muted">—</span>
									</template>

									<template #message-cell="{ row }">
										<div class="min-w-[10rem] max-w-[16rem] sm:max-w-[20rem] lg:max-w-[24rem]">
											<p
												class="text-xs break-words"
												:class="isExpanded('error', row.original.id) ? 'whitespace-pre-wrap' : 'line-clamp-4'"
											>
												{{ row.original.message }}
											</p>
											<UButton
												v-if="shouldShowToggle(row.original.message, 160)"
												variant="link"
												color="primary"
												size="xs"
												class="px-0 mt-1 h-auto"
												@click="toggleExpand('error', row.original.id)"
											>
												{{ isExpanded('error', row.original.id) ? t('admin.errors.showLess') : t('admin.errors.showMore') }}
											</UButton>
										</div>
									</template>

									<template #backend_response-cell="{ row }">
										<div
											v-if="row.original.backend_response"
											class="min-w-[10rem] max-w-[16rem] sm:max-w-[20rem] lg:max-w-[24rem]"
										>
											<pre
												class="text-xs font-mono text-muted break-all whitespace-pre-wrap"
												:class="isExpanded('resp', row.original.id) ? '' : 'line-clamp-4'"
											>{{ row.original.backend_response }}</pre>
											<UButton
												v-if="shouldShowToggle(row.original.backend_response, 160)"
												variant="link"
												color="primary"
												size="xs"
												class="px-0 mt-1 h-auto"
												@click="toggleExpand('resp', row.original.id)"
											>
												{{ isExpanded('resp', row.original.id) ? t('admin.errors.showLess') : t('admin.errors.showMore') }}
											</UButton>
										</div>
										<span v-else class="text-xs text-muted">—</span>
									</template>

									<template #actions-cell="{ row }">
										<div class="flex justify-end min-w-[2.5rem]">
											<UButton
												size="xs"
												variant="ghost"
												color="neutral"
												icon="i-lucide-copy"
												:aria-label="t('admin.errors.copyRow')"
												:title="t('admin.errors.copyRow')"
												:loading="copyingErrorId === row.original.id"
												@click="copyErrorRow(row.original)"
											/>
										</div>
									</template>
								</UTable>
							</div>

							<div v-if="errorsTotal > PAGE_SIZE" class="flex justify-center pt-2">
								<UPagination
									v-model:page="errorsPage"
									:total="errorsTotal"
									:items-per-page="PAGE_SIZE"
									size="sm"
								/>
							</div>
						</div>
					</template>

					<template #ideas>
						<div class="space-y-4">
							<div class="flex items-center justify-between flex-wrap gap-3">
								<p class="text-sm text-muted">
									Всего идей: <span class="font-semibold text-highlighted">{{ ideasTotal }}</span>
								</p>
							</div>

							<div class="overflow-x-auto rounded-lg border border-default">
								<UTable
									:data="ideas"
									:columns="ideaColumns"
									:loading="loadingIdeas"
									class="min-w-[500px]"
								>
									<template #empty>
										<div class="flex flex-col items-center justify-center py-12 gap-3">
											<UIcon name="i-lucide-lightbulb" class="w-10 h-10 text-muted opacity-40" />
											<p class="text-muted">Идей пока нет</p>
										</div>
									</template>

									<template #created_at-cell="{ row }">
										<span class="text-xs text-muted whitespace-nowrap">{{ formatDate(row.original.created_at) }}</span>
									</template>

									<template #user-cell="{ row }">
										<div v-if="row.original.user" class="min-w-0">
											<p class="text-xs font-medium truncate max-w-36">{{ row.original.user.email }}</p>
											<p v-if="row.original.user.full_name" class="text-xs text-muted truncate max-w-36">{{ row.original.user.full_name }}</p>
										</div>
										<span v-else class="text-xs text-muted">—</span>
									</template>

									<template #message-cell="{ row }">
										<div class="max-w-xl">
											<p
												class="text-sm cursor-pointer hover:text-highlighted transition-colors"
												@click="toggleExpand('idea', row.original.id)"
											>
												<span v-if="!expanded.has(`idea:${row.original.id}`)">{{ truncate(row.original.message, 120) }}</span>
												<span v-else class="whitespace-pre-wrap wrap-break-word">{{ row.original.message }}</span>
											</p>
										</div>
									</template>
								</UTable>
							</div>

							<div v-if="ideasTotal > PAGE_SIZE" class="flex justify-center pt-2">
								<UPagination
									v-model:page="ideasPage"
									:total="ideasTotal"
									:items-per-page="PAGE_SIZE"
									size="sm"
								/>
							</div>
						</div>
					</template>

				<template #blacklist>
					<div class="space-y-4">
						<div class="flex items-center justify-between flex-wrap gap-3">
							<p class="text-sm text-muted">
								Глобальный список заблокированных сайтов. Домены недоступны для всех пользователей при поиске.
							</p>
							<UButton
								size="sm"
								leading-icon="i-lucide-plus"
								@click="openAddBlacklist"
							>
								Добавить домен
							</UButton>
						</div>

						<div class="overflow-x-auto rounded-lg border border-default">
							<UTable
								:data="blacklist"
								:columns="blacklistColumns"
								:loading="loadingBlacklist"
								class="min-w-[500px]"
							>
								<template #empty>
									<div class="flex flex-col items-center justify-center py-12 gap-3">
										<UIcon name="i-lucide-shield-check" class="w-10 h-10 text-muted opacity-40" />
										<p class="text-muted">Список пуст</p>
									</div>
								</template>

								<template #created_at-cell="{ row }">
									<span class="text-xs text-muted whitespace-nowrap">{{ formatDate(row.original.created_at) }}</span>
								</template>

								<template #reason-cell="{ row }">
									<span class="text-xs text-muted">{{ row.original.reason ?? '—' }}</span>
								</template>

								<template #actions-cell="{ row }">
									<div class="flex justify-end">
										<UButton
											size="xs"
											color="error"
											variant="ghost"
											icon="i-lucide-trash-2"
											:loading="deletingBlacklistId === row.original.id"
											@click="deleteBlacklistEntry(row.original.id)"
										/>
									</div>
								</template>
							</UTable>
						</div>
					</div>

					<UModal v-model:open="addBlacklistOpen" title="Добавить домен в блэклист" :ui="{ content: 'max-w-md' }">
						<template #body>
							<UForm :schema="blacklistSchema" :state="blacklistForm" class="space-y-4" @submit="submitAddBlacklist">
								<UFormField label="Домен" name="domain" required hint="Например: spam-site.ru">
									<UInput
										v-model="blacklistForm.domain"
										icon="i-lucide-globe"
										placeholder="example.com"
										class="w-full"
									/>
								</UFormField>
								<UFormField label="Причина" name="reason">
									<UInput
										v-model="blacklistForm.reason"
										icon="i-lucide-info"
										placeholder="Спам, недостоверные данные и т.д."
										class="w-full"
									/>
								</UFormField>
								<div class="flex justify-end gap-2 pt-2">
									<UButton variant="ghost" color="neutral" type="button" @click="addBlacklistOpen = false">
										Отмена
									</UButton>
									<UButton type="submit" :loading="savingBlacklist" leading-icon="i-lucide-shield-ban">
										Добавить
									</UButton>
								</div>
							</UForm>
						</template>
					</UModal>
				</template>

				</UTabs>
			</UCard>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import { z } from 'zod'
import type { TableColumn } from '@nuxt/ui'
import type {
	BlacklistResponse,
	FrontendErrorLogResponse,
	IdeaSuggestionResponse,
	UserResponse,
} from '#shared/types'
import { t } from '~/constants/translations'

definePageMeta({ layout: 'default' })

const { get, post, del: delReq } = useApi()
const { formatDate, formatTime } = useFormatDate()
const toast = useToast()

const user = ref<UserResponse | null>(null)
try {
	user.value = await get<UserResponse>('/auth/me')
} catch {
	user.value = null
}

if (!user.value?.is_admin) {
	await navigateTo('/')
}

const PAGE_SIZE = 20

const activeTab = ref('users')
const tabs = [
	{ label: 'Пользователи', slot: 'users', value: 'users', icon: 'i-lucide-users' },
	{ label: 'Ошибки', slot: 'errors', value: 'errors', icon: 'i-lucide-bug' },
	{ label: 'Идеи', slot: 'ideas', value: 'ideas', icon: 'i-lucide-lightbulb' },
	{ label: 'Блэклист', slot: 'blacklist', value: 'blacklist', icon: 'i-lucide-shield-ban' },
]

const expanded = ref<Set<string>>(new Set())
const copyingErrorId = ref<string | null>(null)

function expandKey(prefix: string, id: string): string {
	return `${prefix}:${id}`
}

function isExpanded(prefix: string, id: string): boolean {
	return expanded.value.has(expandKey(prefix, id))
}

function toggleExpand(prefix: string, id: string) {
	const key = expandKey(prefix, id)
	if (expanded.value.has(key)) {
		expanded.value.delete(key)
	} else {
		expanded.value.add(key)
	}
}

function shouldShowToggle(text: string, threshold: number): boolean {
	return text.length > threshold
}

function serializeErrorRow(row: FrontendErrorLogResponse): string {
	const payload = {
		id: row.id,
		user_id: row.user_id,
		user: row.user,
		message: row.message,
		backend_response: row.backend_response,
		page_url: row.page_url,
		request_method: row.request_method,
		request_url: row.request_url,
		status_code: row.status_code,
		created_at: row.created_at,
	}
	return JSON.stringify(payload, null, 2)
}

async function copyTextToClipboard(text: string): Promise<boolean> {
	if (import.meta.client && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text)
			return true
		} catch {
			// fall through to legacy copy
		}
	}

	if (!import.meta.client) return false

	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.setAttribute('readonly', '')
	textarea.style.position = 'fixed'
	textarea.style.opacity = '0'
	document.body.appendChild(textarea)
	textarea.select()
	const copied = document.execCommand('copy')
	document.body.removeChild(textarea)
	return copied
}

async function copyErrorRow(row: FrontendErrorLogResponse) {
	if (copyingErrorId.value) return
	copyingErrorId.value = row.id
	try {
		const copied = await copyTextToClipboard(serializeErrorRow(row))
		toast.add({
			title: copied ? t('admin.errors.copyRowSuccess') : t('admin.errors.copyRowError'),
			color: copied ? 'success' : 'error',
		})
	} catch {
		toast.add({ title: t('admin.errors.copyRowError'), color: 'error' })
	} finally {
		copyingErrorId.value = null
	}
}

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text
	return `${text.slice(0, maxLen)}…`
}

function getStatusColor(code: number): 'error' | 'warning' | 'success' | 'neutral' {
	if (code >= 500) return 'error'
	if (code >= 400) return 'warning'
	if (code >= 200 && code < 300) return 'success'
	return 'neutral'
}

// --- Errors tab ---

const errors = ref<FrontendErrorLogResponse[]>([])
const errorsTotal = ref(0)
const errorsPage = ref(1)
const loadingErrors = ref(false)

const errorColumns: TableColumn<FrontendErrorLogResponse>[] = [
	{ accessorKey: 'created_at', header: t('admin.errors.dateColumn') },
	{ id: 'created_time', accessorKey: 'created_at', header: t('admin.errors.timeColumn') },
	{ accessorKey: 'user', header: t('admin.errors.userColumn') },
	{ accessorKey: 'page_url', header: t('admin.errors.pageColumn') },
	{ id: 'request', accessorKey: 'request_url', header: t('admin.errors.requestColumn') },
	{ accessorKey: 'status_code', header: t('admin.errors.statusColumn') },
	{ accessorKey: 'message', header: t('admin.errors.messageColumn') },
	{ accessorKey: 'backend_response', header: t('admin.errors.backendResponseColumn') },
	{ id: 'actions', header: t('admin.errors.actionsColumn') },
]

async function fetchErrors() {
	loadingErrors.value = true
	try {
		const data = await get<{ items: FrontendErrorLogResponse[]; total: number }>(
			`/feedback/errors?page=${errorsPage.value}&size=${PAGE_SIZE}`,
		)
		errors.value = data.items
		errorsTotal.value = data.total
	} catch {
		errors.value = []
	} finally {
		loadingErrors.value = false
	}
}

watch(errorsPage, () => fetchErrors())

// --- Ideas tab ---

const ideas = ref<IdeaSuggestionResponse[]>([])
const ideasTotal = ref(0)
const ideasPage = ref(1)
const loadingIdeas = ref(false)

const ideaColumns: TableColumn<IdeaSuggestionResponse>[] = [
	{ accessorKey: 'created_at', header: 'Дата' },
	{ accessorKey: 'user', header: 'Пользователь' },
	{ accessorKey: 'message', header: 'Идея' },
]

async function fetchIdeas() {
	loadingIdeas.value = true
	try {
		const data = await get<{ items: IdeaSuggestionResponse[]; total: number }>(
			`/feedback/ideas?page=${ideasPage.value}&size=${PAGE_SIZE}`,
		)
		ideas.value = data.items
		ideasTotal.value = data.total
	} catch {
		ideas.value = []
	} finally {
		loadingIdeas.value = false
	}
}

watch(ideasPage, () => fetchIdeas())

watch(activeTab, (tab) => {
	if (tab === 'errors' && errors.value.length === 0 && !loadingErrors.value) {
		void fetchErrors()
	}
	if (tab === 'ideas' && ideas.value.length === 0 && !loadingIdeas.value) {
		void fetchIdeas()
	}
	if (tab === 'blacklist' && blacklist.value.length === 0 && !loadingBlacklist.value) {
		void fetchBlacklist()
	}
})

onMounted(() => {
	// tabs are loaded lazily on activation
})

// --- Blacklist tab ---

const blacklist = ref<BlacklistResponse[]>([])
const loadingBlacklist = ref(false)
const deletingBlacklistId = ref<string | null>(null)
const addBlacklistOpen = ref(false)
const savingBlacklist = ref(false)

const blacklistForm = reactive({ domain: '', reason: '' })

const blacklistSchema = z.object({
	domain: z.string().min(3, 'Минимум 3 символа').max(255),
	reason: z.string().max(500).optional(),
})

const blacklistColumns: TableColumn<BlacklistResponse>[] = [
	{ accessorKey: 'domain', header: 'Домен' },
	{ accessorKey: 'reason', header: 'Причина' },
	{ accessorKey: 'created_at', header: 'Добавлен' },
	{ id: 'actions', header: '' },
]

async function fetchBlacklist() {
	loadingBlacklist.value = true
	try {
		const data = await get<BlacklistResponse[]>('/blacklist')
		blacklist.value = data.filter((entry) => entry.is_global)
	} catch {
		blacklist.value = []
	} finally {
		loadingBlacklist.value = false
	}
}

function openAddBlacklist() {
	blacklistForm.domain = ''
	blacklistForm.reason = ''
	addBlacklistOpen.value = true
}

async function submitAddBlacklist() {
	if (savingBlacklist.value) return
	savingBlacklist.value = true
	try {
		const created = await post<BlacklistResponse>('/blacklist', {
			domain: blacklistForm.domain.trim().toLowerCase(),
			reason: blacklistForm.reason.trim() || null,
			is_global: true,
		})
		blacklist.value = [created, ...blacklist.value]
		addBlacklistOpen.value = false
		toast.add({ title: 'Домен добавлен в блэклист', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось добавить домен', color: 'error' })
	} finally {
		savingBlacklist.value = false
	}
}

async function deleteBlacklistEntry(id: string) {
	deletingBlacklistId.value = id
	try {
		await delReq(`/blacklist/${id}`)
		blacklist.value = blacklist.value.filter((entry) => entry.id !== id)
		toast.add({ title: 'Домен удалён из блэклиста', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось удалить домен', color: 'error' })
	} finally {
		deletingBlacklistId.value = null
	}
}
</script>
