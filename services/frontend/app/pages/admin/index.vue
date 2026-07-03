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
									Всего записей: <span class="font-semibold text-highlighted">{{ errorsTotal }}</span>
								</p>
							</div>

							<div class="overflow-x-auto rounded-lg border border-default">
								<UTable
									:data="errors"
									:columns="errorColumns"
									:loading="loadingErrors"
									class="min-w-[700px]"
								>
									<template #empty>
										<div class="flex flex-col items-center justify-center py-12 gap-3">
											<UIcon name="i-lucide-check-circle" class="w-10 h-10 text-muted opacity-40" />
											<p class="text-muted">Ошибок нет</p>
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

									<template #page_url-cell="{ row }">
										<span class="text-xs font-mono text-muted truncate max-w-36 block" :title="row.original.page_url ?? undefined">
											{{ row.original.page_url ?? '—' }}
										</span>
									</template>

									<template #request-cell="{ row }">
										<div v-if="row.original.request_method || row.original.request_url" class="min-w-0">
											<UBadge
												v-if="row.original.request_method"
												color="neutral"
												variant="soft"
												size="xs"
												class="shrink-0 mb-1"
											>
												{{ row.original.request_method }}
											</UBadge>
											<p class="text-xs font-mono text-muted truncate max-w-48" :title="row.original.request_url ?? undefined">
												{{ row.original.request_url ?? '' }}
											</p>
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
										<div class="max-w-64">
											<p
												class="text-xs truncate cursor-pointer hover:text-highlighted transition-colors"
												:title="row.original.message"
												@click="toggleExpand('error', row.original.id)"
											>
												{{ row.original.message }}
											</p>
											<p
												v-if="expanded.has(`error:${row.original.id}`)"
												class="text-xs text-muted mt-1 wrap-break-word whitespace-pre-wrap"
											>
												{{ row.original.message }}
											</p>
										</div>
									</template>

									<template #backend_response-cell="{ row }">
										<div v-if="row.original.backend_response" class="max-w-48">
											<p
												class="text-xs truncate cursor-pointer text-muted hover:text-highlighted transition-colors font-mono"
												:title="row.original.backend_response"
												@click="toggleExpand('resp', row.original.id)"
											>
												{{ row.original.backend_response }}
											</p>
											<p
												v-if="expanded.has(`resp:${row.original.id}`)"
												class="text-xs text-muted mt-1 wrap-break-word whitespace-pre-wrap font-mono"
											>
												{{ row.original.backend_response }}
											</p>
										</div>
										<span v-else class="text-xs text-muted">—</span>
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
				</UTabs>
			</UCard>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type {
	FrontendErrorLogResponse,
	IdeaSuggestionResponse,
	UserResponse,
} from '#shared/types'

definePageMeta({ layout: 'default' })

const { get } = useApi()
const { formatDate } = useFormatDate()

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
]

const expanded = ref<Set<string>>(new Set())

function toggleExpand(prefix: string, id: string) {
	const key = `${prefix}:${id}`
	if (expanded.value.has(key)) {
		expanded.value.delete(key)
	} else {
		expanded.value.add(key)
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
	{ accessorKey: 'created_at', header: 'Дата' },
	{ accessorKey: 'user', header: 'Пользователь' },
	{ accessorKey: 'page_url', header: 'Страница' },
	{ id: 'request', accessorKey: 'request_url', header: 'Метод / URL' },
	{ accessorKey: 'status_code', header: 'Статус' },
	{ accessorKey: 'message', header: 'Сообщение' },
	{ accessorKey: 'backend_response', header: 'Ответ бэкенда' },
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
})

onMounted(() => {
	// errors and ideas are loaded lazily on tab activation
})
</script>
