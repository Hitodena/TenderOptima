<template>
	<UContainer class="py-8">

		<UButton variant="ghost" leading-icon="i-lucide-arrow-left" :to="`/requests/${id}`" class="mb-6">
			К запросу
		</UButton>

		<div class="flex items-center justify-between mb-6">
			<div>
				<h1 class="text-2xl font-bold text-highlighted">Ответы поставщиков</h1>
				<p class="text-sm text-muted mt-1">Запрос #{{ id }}</p>
			</div>
			<UInput v-model="search" placeholder="Поиск по поставщику..." icon="i-lucide-search" class="w-64" />
		</div>

		<!-- Скелетон -->
		<template v-if="loading">
			<div class="space-y-3">
				<USkeleton v-for="i in 3" :key="i" class="h-20 w-full" />
			</div>
		</template>

		<!-- Список карточками — нагляднее таблицы для писем -->
		<template v-else-if="filtered.length">
			<div class="space-y-3">
				<UCard v-for="response in filtered" :key="response.id"
					class="cursor-pointer hover:shadow-md transition-shadow"
					@click="navigateTo(`/requests/${id}/responses/${response.id}`)">
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-3 min-w-0">
							<div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
								<UIcon name="i-lucide-building-2" class="w-4 h-4 text-primary" />
							</div>
							<div class="min-w-0">
								<p class="font-medium truncate">{{ response.supplier.company_name }}</p>
								<p class="text-sm text-muted truncate">{{ response.supplier.email }}</p>
								<p v-if="response.subject" class="text-sm mt-1 truncate">{{ response.subject }}</p>
							</div>
						</div>

						<div class="flex items-center gap-3 shrink-0">
							<!-- Вложения -->
							<UBadge v-if="response.attachments?.length" color="neutral" variant="subtle" size="sm"
								:label="`${response.attachments.length} файл${attachmentSuffix(response.attachments.length)}`"
								leading-icon="i-lucide-paperclip" />

							<span class="text-xs text-muted whitespace-nowrap">
								{{ response.received_at ? formatDate(response.received_at) : '—' }}
							</span>

							<UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-muted" />
						</div>
					</div>
				</UCard>
			</div>
		</template>

		<template v-else>
			<UCard>
				<div class="flex flex-col items-center justify-center py-16 gap-3">
					<UIcon name="i-lucide-mail-open" class="w-12 h-12 text-muted" />
					<p class="text-muted">
						{{ search ? 'Ничего не найдено' : 'Ответов пока нет' }}
					</p>
					<p v-if="!search" class="text-sm text-muted">Запустите рассылку чтобы получить ответы</p>
				</div>
			</UCard>
		</template>

	</UContainer>
</template>

<script lang="ts" setup>
import type { SupplierResponseResponse } from '#shared/types'

definePageMeta({ layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const { get } = useApi()

const responses = ref<SupplierResponseResponse[]>([])
const loading = ref(true)
const search = ref('')

async function fetchResponses() {
	loading.value = true
	try {
		responses.value = await get<SupplierResponseResponse[]>(`/requests/${id}/responses`)
	} catch {
		responses.value = []
	} finally {
		loading.value = false
	}
}

await fetchResponses()

const filtered = computed(() => {
	if (!search.value) return responses.value
	const q = search.value.toLowerCase()
	return responses.value.filter(r =>
		r.supplier.company_name.toLowerCase().includes(q) ||
		r.supplier.email.toLowerCase().includes(q) ||
		r.subject?.toLowerCase().includes(q)
	)
})

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
	})
}

function attachmentSuffix(n: number) {
	if (n % 10 === 1 && n % 100 !== 11) return ''
	if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'а'
	return 'ов'
}
</script>
