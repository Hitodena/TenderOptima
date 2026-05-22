<template>
	<UContainer class="py-8 max-w-3xl">

		<UButton variant="ghost" leading-icon="i-lucide-arrow-left" :to="`/requests/${id}/responses`" class="mb-6">
			Все ответы
		</UButton>

		<template v-if="loading">
			<USkeleton class="h-64 w-full" />
		</template>

		<template v-else-if="response">

			<UCard class="mb-4">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h1 class="text-xl font-bold text-highlighted mb-1">
							{{ response.supplier.company_name }}
						</h1>
						<div class="flex items-center gap-2 text-sm text-muted flex-wrap">
							<UIcon name="i-lucide-mail" class="w-4 h-4" />
							<span>{{ response.supplier.email }}</span>
							<span>·</span>
							<UIcon name="i-lucide-globe" class="w-4 h-4" />
							<span>{{ response.supplier.domain }}</span>
						</div>
					</div>
					<div class="text-right shrink-0">
						<UBadge color="success" variant="subtle">Получен</UBadge>
						<p class="text-xs text-muted mt-1">
							{{ response.received_at ? formatDate(response.received_at) : '—' }}
						</p>
					</div>
				</div>
			</UCard>

			<UCard class="mb-4">
				<template #header>
					<div class="flex items-center gap-2">
						<UIcon name="i-lucide-mail-open" class="w-4 h-4 text-muted" />
						<span class="font-medium">{{ response.subject ?? 'Без темы' }}</span>
					</div>
				</template>

				<div class="prose prose-sm dark:prose-invert max-w-none">
					<pre v-if="response.raw_body"
						class="whitespace-pre-wrap font-sans text-sm text-default bg-transparent p-0 m-0">
		{{ response.raw_body }}</pre>
					<p v-else class="text-muted italic">Письмо без содержимого</p>
				</div>
			</UCard>

			<UCard v-if="response.attachments?.length">
				<template #header>
					<div class="flex items-center gap-2">
						<UIcon name="i-lucide-paperclip" class="w-4 h-4 text-muted" />
						<span class="font-medium">Вложения ({{ response.attachments.length }})</span>
					</div>
				</template>

				<div class="flex flex-wrap gap-2">
					<a v-for="file in response.attachments" :key="file.filename" :href="file.path ?? '#'"
						target="_blank"
						class="flex items-center gap-2 px-3 py-2 rounded-lg border border-default hover:bg-elevated transition-colors text-sm cursor-pointer">
						<UIcon :name="fileIcon(file.content_type)" class="w-4 h-4 text-primary" />
						<span class="truncate max-w-48">{{ file.filename }}</span>
						<span v-if="file.size" class="text-xs text-muted shrink-0">
							{{ formatSize(file.size) }}
						</span>
					</a>
				</div>
			</UCard>

		</template>

		<template v-else>
			<div class="flex flex-col items-center justify-center py-24 gap-3">
				<UIcon name="i-lucide-file-x" class="w-12 h-12 text-muted" />
				<p class="text-muted">Ответ не найден</p>
				<UButton :to="`/requests/${id}/responses`" variant="outline">Назад к ответам</UButton>
			</div>
		</template>

	</UContainer>
</template>

<script lang="ts" setup>
import type { SupplierResponseResponse } from '#shared/types'

const route = useRoute()
const id = route.params.id as string
const responseId = route.params.responseId as string
const { get } = useApi()

const response = ref<SupplierResponseResponse | null>(null)
const loading = ref(true)

async function fetchResponse() {
	loading.value = true
	try {
		const all = await get<SupplierResponseResponse[]>(`/requests/${id}/responses`)
		response.value = all.find(r => r.id === responseId) ?? null
	} catch {
		response.value = null
	} finally {
		loading.value = false
	}
}

await fetchResponse()

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	})
}

function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(contentType: string | null) {
	if (!contentType) return 'i-lucide-file'
	if (contentType.includes('pdf')) return 'i-lucide-file-text'
	if (contentType.includes('image')) return 'i-lucide-image'
	if (contentType.includes('sheet') || contentType.includes('excel')) return 'i-lucide-table'
	if (contentType.includes('word')) return 'i-lucide-file-text'
	return 'i-lucide-file'
}
</script>
