<template>
	<UContainer class="py-8">

		<div class="flex items-center justify-between mb-6">
			<div>
				<h1 class="text-2xl font-bold text-highlighted">Чёрный список</h1>
				<p class="text-sm text-muted mt-1">Домены, исключённые из поиска поставщиков</p>
			</div>
		</div>

		<UCard class="mb-6">
			<UForm :schema="schema" :state="form" @submit="handleAdd">
				<div class="flex gap-3 items-start">
					<UFormField label="Домен" name="domain" class="flex-1" required>
						<UInput v-model="form.domain" placeholder="example.com" icon="i-lucide-shield-off"
							class="w-full" />
					</UFormField>

					<UFormField label="Причина" name="reason" class="flex-1">
						<UInput v-model="form.reason" placeholder="Спам, мошенники..." icon="i-lucide-message-square"
							class="w-full" />
					</UFormField>

					<UButton type="submit" icon="i-lucide-plus" :loading="adding" class="mt-6 shrink-0">
						Добавить
					</UButton>
				</div>
			</UForm>
		</UCard>

		<!-- Поиск -->
		<div class="flex items-center gap-3 mb-4">
			<UInput v-model="search" placeholder="Поиск по домену..." icon="i-lucide-search" class="max-w-xs" />
			<span class="ml-auto text-sm text-muted">{{ filtered.length }} доменов</span>
		</div>

		<!-- Таблица -->
		<UCard>
			<UTable :data="filtered" :columns="columns" :loading="loading">

				<template #reason-cell="{ row }">
					<span class="text-sm text-muted">{{ row.original.reason ?? '—' }}</span>
				</template>

				<template #created_at-cell="{ row }">
					<span class="text-sm text-muted">{{ formatDate(row.original.created_at) }}</span>
				</template>

				<template #actions-cell="{ row }">
					<UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2"
						:loading="deletingId === row.original.id" @click="handleDelete(row.original.id)" />
				</template>

				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 gap-2">
						<UIcon name="i-lucide-shield-check" class="w-10 h-10 text-muted" />
						<p class="text-sm text-muted">Чёрный список пуст</p>
					</div>
				</template>

			</UTable>
		</UCard>

	</UContainer>
</template>

<script lang="ts" setup>
import type { BlacklistCreate, BlacklistResponse } from '#shared/types'
import type { TableColumn } from '@nuxt/ui'
import { z } from 'zod'

definePageMeta({ layout: 'default' })

const { get, post, del } = useApi()

const items = ref<BlacklistResponse[]>([])
const loading = ref(true)
const adding = ref(false)
const deletingId = ref<string | null>(null)
const search = ref('')

const form = reactive({ domain: '', reason: '' })

const schema = z.object({
	domain: z.string().min(3, 'Минимум 3 символа').max(255),
	reason: z.string().max(500).optional(),
})

async function fetchBlacklist() {
	loading.value = true
	try {
		items.value = await get<BlacklistResponse[]>('/blacklist/')
	} catch {
		items.value = []
	} finally {
		loading.value = false
	}
}

await fetchBlacklist()

const filtered = computed(() => {
	if (!search.value) return items.value
	const q = search.value.toLowerCase()
	return items.value.filter(i => i.domain.toLowerCase().includes(q))
})

const columns: TableColumn<BlacklistResponse>[] = [
	{ accessorKey: 'domain', header: 'Домен' },
	{ accessorKey: 'reason', header: 'Причина' },
	{ accessorKey: 'created_at', header: 'Добавлен' },
	{ id: 'actions', header: '' },
]

async function handleAdd() {
	if (adding.value) return
	adding.value = true
	try {
		const payload: BlacklistCreate = {
			domain: form.domain,
			reason: form.reason || null,
		}
		const created = await post<BlacklistResponse>('/blacklist/', payload)
		items.value.unshift(created)
		form.domain = ''
		form.reason = ''
	} catch (e: any) {
		console.error(e)
	} finally {
		adding.value = false
	}
}

async function handleDelete(id: string) {
	deletingId.value = id
	try {
		await del(`/blacklist/${id}`)
		items.value = items.value.filter(i => i.id !== id)
	} finally {
		deletingId.value = null
	}
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric',
	})
}
</script>
