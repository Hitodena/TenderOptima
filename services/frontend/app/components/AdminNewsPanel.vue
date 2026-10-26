<template>
	<div class="space-y-5">
		<UCard>
			<template #header>
				<div>
					<h2 class="font-semibold">{{ t('admin.news.title') }}</h2>
					<p class="mt-1 text-sm text-muted">{{ t('admin.news.description') }}</p>
				</div>
			</template>

			<UForm :schema="schema" :state="form" class="space-y-4" @submit="publishNews">
				<div class="grid gap-4 md:grid-cols-2">
					<UFormField name="title" :label="t('admin.news.titleLabel')" required>
						<UInput
							v-model="form.title"
							:placeholder="t('admin.news.titlePlaceholder')"
							maxlength="180"
							class="w-full"
						/>
					</UFormField>
					<UFormField name="module_name" :label="t('admin.news.moduleLabel')">
						<UInput
							v-model="form.module_name"
							:placeholder="t('admin.news.modulePlaceholder')"
							maxlength="100"
							class="w-full"
						/>
					</UFormField>
				</div>

				<UFormField name="severity" :label="t('admin.news.severityLabel')" required>
					<USelect v-model="form.severity" :items="severityItems" class="w-full md:max-w-sm" />
				</UFormField>

				<UFormField name="content" :label="t('admin.news.contentLabel')" required>
					<UTextarea
						v-model="form.content"
						:placeholder="t('admin.news.contentPlaceholder')"
						:rows="4"
						:maxlength="5000"
						autoresize
						:maxrows="10"
						class="w-full"
					/>
				</UFormField>

				<UAlert
					v-if="formError"
					color="error"
					variant="soft"
					icon="i-lucide-circle-alert"
					:description="formError"
				/>

				<div class="flex justify-end">
					<UButton
						type="submit"
						:loading="publishing"
						leading-icon="i-lucide-megaphone"
					>
						{{ t('admin.news.publish') }}
					</UButton>
				</div>
			</UForm>
		</UCard>

		<UAlert
			v-if="loadError"
			color="error"
			variant="soft"
			icon="i-lucide-circle-alert"
			:description="loadError"
		/>

		<div class="overflow-x-auto rounded-lg border border-default">
			<UTable :data="newsItems" :columns="columns" :loading="loading" class="min-w-[880px]">
				<template #title-cell="{ row }">
					<div class="max-w-[28rem] whitespace-normal">
						<p class="font-medium text-highlighted">{{ row.original.title }}</p>
						<p class="mt-1 line-clamp-2 text-xs text-muted">{{ row.original.content }}</p>
					</div>
				</template>
				<template #module_name-cell="{ row }">
					<span>{{ row.original.module_name || '—' }}</span>
				</template>
				<template #severity-cell="{ row }">
					<UBadge :color="severityColor(row.original.severity)" variant="soft">
						{{ severityLabel(row.original.severity) }}
					</UBadge>
				</template>
				<template #is_active-cell="{ row }">
					<UBadge :color="row.original.is_active ? 'success' : 'neutral'" variant="soft">
						{{ row.original.is_active ? t('admin.news.active') : t('admin.news.inactive') }}
					</UBadge>
				</template>
				<template #read_count-cell="{ row }">
					<span>{{ row.original.read_count }}</span>
				</template>
				<template #created_at-cell="{ row }">
					<span class="text-xs text-muted">{{ formatDateTime(row.original.created_at) }}</span>
				</template>
				<template #actions-cell="{ row }">
					<UButton
						size="xs"
						:color="row.original.is_active ? 'neutral' : 'primary'"
						variant="soft"
						:icon="row.original.is_active ? 'i-lucide-eye-off' : 'i-lucide-eye'"
						:loading="savingId === row.original.id"
						:disabled="Boolean(savingId) && savingId !== row.original.id"
						@click="toggleActive(row.original)"
					>
						{{ row.original.is_active ? t('admin.news.deactivate') : t('admin.news.reactivate') }}
					</UButton>
				</template>
				<template #empty>
					<div class="flex flex-col items-center justify-center gap-3 py-12">
						<UIcon name="i-lucide-megaphone" class="size-10 text-muted opacity-40" />
						<p class="text-muted">{{ t('admin.news.empty') }}</p>
					</div>
				</template>
			</UTable>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { z } from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type {
	AdminNewsResponse,
	NewsCreate,
	NewsResponse,
	NewsSeverity,
} from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { t } from '~/constants/translations'

const { get, post, patch } = useApi()
const { formatDateTime } = useFormatDate()
const toast = useToast()

const schema = z.object({
	title: z.string().trim().min(3, t('admin.news.titleError')).max(180),
	module_name: z.string().trim().max(100).optional(),
	severity: z.enum(['info', 'warning', 'error']),
	content: z.string().trim().min(1, t('admin.news.contentError')).max(5000),
})
type NewsForm = z.output<typeof schema>

const form = reactive<NewsForm>({
	title: '',
	module_name: '',
	severity: 'warning',
	content: '',
})
const severityItems = [
	{ label: t('news.severity.info'), value: 'info' },
	{ label: t('news.severity.warning'), value: 'warning' },
	{ label: t('news.severity.error'), value: 'error' },
]
const columns: TableColumn<AdminNewsResponse>[] = [
	{ accessorKey: 'title', header: t('admin.news.titleLabel') },
	{ accessorKey: 'module_name', header: t('admin.news.moduleLabel') },
	{ accessorKey: 'severity', header: t('admin.news.severityLabel') },
	{ accessorKey: 'is_active', header: t('admin.news.statusLabel') },
	{ accessorKey: 'read_count', header: t('admin.news.readCount') },
	{ accessorKey: 'created_at', header: t('admin.news.createdAt') },
	{ id: 'actions', header: '' },
]

const newsItems = ref<AdminNewsResponse[]>([])
const loading = ref(false)
const publishing = ref(false)
const savingId = ref<string | null>(null)
const loadError = ref<string | null>(null)
const formError = ref<string | null>(null)

function severityLabel(severity: NewsSeverity): string {
	return t(`news.severity.${severity}`)
}

function severityColor(severity: NewsSeverity): 'primary' | 'warning' | 'error' {
	if (severity === 'error') return 'error'
	if (severity === 'warning') return 'warning'
	return 'primary'
}

async function loadNews() {
	loading.value = true
	loadError.value = null
	try {
		newsItems.value = await get<AdminNewsResponse[]>('/admin/news')
	} catch (error: unknown) {
		loadError.value = getApiErrorDetail(error) ?? t('admin.news.loadError')
	} finally {
		loading.value = false
	}
}

async function publishNews(event: FormSubmitEvent<NewsForm>) {
	publishing.value = true
	formError.value = null
	try {
		const payload: NewsCreate = {
			...event.data,
			module_name: event.data.module_name?.trim() || null,
		}
		await post<NewsResponse>('/admin/news', payload)
		Object.assign(form, {
			title: '',
			module_name: '',
			severity: 'warning',
			content: '',
		})
		await loadNews()
		toast.add({ title: t('admin.news.publishSuccess'), color: 'success' })
	} catch (error: unknown) {
		formError.value = getApiErrorDetail(error) ?? t('admin.news.publishError')
	} finally {
		publishing.value = false
	}
}

async function toggleActive(item: AdminNewsResponse) {
	if (savingId.value) return
	savingId.value = item.id
	loadError.value = null
	try {
		const updated = await patch<NewsResponse>(`/admin/news/${item.id}`, {
			is_active: !item.is_active,
		})
		const index = newsItems.value.findIndex((news) => news.id === item.id)
		if (index >= 0) {
			newsItems.value[index] = { ...newsItems.value[index], ...updated }
		}
	} catch (error: unknown) {
		loadError.value = getApiErrorDetail(error) ?? t('admin.news.updateError')
	} finally {
		savingId.value = null
	}
}

onMounted(loadNews)
</script>
