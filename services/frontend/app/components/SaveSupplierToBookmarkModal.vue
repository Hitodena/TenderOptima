<template>
	<UModal
		v-model:open="isOpen"
		title="Сохранить в базу"
		:ui="{ content: 'max-w-md' }"
	>
		<template #body>
			<div v-if="supplier" class="space-y-4">
				<div class="rounded-lg border border-default bg-elevated/30 p-3">
					<p class="text-sm font-semibold truncate">{{ supplier.company_name }}</p>
					<p class="text-xs text-muted truncate">{{ supplier.main_email }}</p>
					<p v-if="supplier.domain" class="text-xs text-muted/70 truncate">
						{{ formatDomainLabel(supplier.domain) }}
					</p>
				</div>

				<div v-if="loading && !lists.length" class="space-y-2">
					<USkeleton class="h-10 w-full rounded-md" />
				</div>

				<template v-else>
					<UFormField label="База поставщиков" required>
						<div class="flex items-center gap-2">
							<USelectMenu
								v-model="selectedListId"
								value-key="id"
								label-key="title"
								:items="listOptions"
								placeholder="Выберите базу"
								icon="i-lucide-database"
								class="flex-1 w-full"
								:loading="loading"
							/>
							<UButton
								size="sm"
								variant="outline"
								icon="i-lucide-plus"
								title="Новая база"
								@click="openCreateList"
							/>
						</div>
					</UFormField>

					<UAlert
						v-if="duplicateWarning"
						color="warning"
						variant="soft"
						icon="i-lucide-triangle-alert"
						:description="duplicateWarning"
					/>

					<p v-if="!listOptions.length && !loading" class="text-xs text-muted">
						У вас пока нет баз. Создайте новую, чтобы сохранить поставщика.
					</p>
				</template>

				<div class="flex justify-end gap-2 pt-2">
					<UButton variant="ghost" color="neutral" @click="isOpen = false">
						Отмена
					</UButton>
					<UButton
						:loading="saving"
						:disabled="!canSave"
						leading-icon="i-lucide-database"
						@click="saveToList"
					>
						Сохранить
					</UButton>
				</div>
			</div>
		</template>
	</UModal>

	<UModal v-model:open="createListOpen" title="Новая база поставщиков" :ui="{ content: 'max-w-md' }">
		<template #body>
			<UForm :schema="listSchema" :state="listForm" class="space-y-4" @submit="createList">
				<UFormField label="Название базы" name="title" required>
					<UInput
						v-model="listForm.title"
						placeholder="Поставщики по строительству"
						icon="i-lucide-database"
						class="w-full"
					/>
				</UFormField>
				<div class="flex justify-end gap-2 pt-2">
					<UButton variant="ghost" color="neutral" @click="createListOpen = false">
						Отмена
					</UButton>
					<UButton type="submit" :loading="savingList">
						Создать
					</UButton>
				</div>
			</UForm>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import { z } from 'zod'
import type { Supplier, SupplierBookmarkItem, SupplierBookmarkList } from '#shared/types'
import { formatDomainLabel } from '#shared/utils/url'

const props = defineProps<{ supplier: Supplier | null }>()
const isOpen = defineModel<boolean>('open', { default: false })

const { get, post } = useApi()
const toast = useToast()

const lists = ref<SupplierBookmarkList[]>([])
const loading = ref(false)
const saving = ref(false)
const savingList = ref(false)
const selectedListId = ref<string | null>(null)
const createListOpen = ref(false)

const listForm = reactive({ title: '' })

const listSchema = z.object({
	title: z.string().min(1, 'Обязательное поле').max(255),
})

const listOptions = computed(() =>
	lists.value.filter((list) => !list.is_global),
)

const selectedList = computed(() =>
	listOptions.value.find((list) => list.id === selectedListId.value) ?? null,
)

function normalizeEmail(value: string | null | undefined): string {
	return (value ?? '').trim().toLowerCase()
}

function normalizeDomain(value: string | null | undefined): string | null {
	const trimmed = (value ?? '').trim()
	return trimmed.length >= 3 ? trimmed : null
}

function isDuplicateEmail(list: SupplierBookmarkList, email: string): boolean {
	const normalized = normalizeEmail(email)
	return list.items.some((item) => normalizeEmail(item.email) === normalized)
}

const duplicateWarning = computed(() => {
	if (!props.supplier?.main_email || !selectedList.value) return null
	if (isDuplicateEmail(selectedList.value, props.supplier.main_email)) {
		return 'Этот email уже есть в выбранной базе'
	}
	return null
})

const canSave = computed(() =>
	Boolean(selectedListId.value && props.supplier?.main_email && !duplicateWarning.value),
)

async function fetchLists() {
	loading.value = true
	try {
		lists.value = await get<SupplierBookmarkList[]>('/supplier-bookmarks')
		if (
			selectedListId.value
			&& !listOptions.value.some((list) => list.id === selectedListId.value)
		) {
			selectedListId.value = null
		}
		if (!selectedListId.value && listOptions.value.length === 1) {
			selectedListId.value = listOptions.value[0]!.id
		}
	} catch {
		lists.value = []
		toast.add({ title: 'Не удалось загрузить базы поставщиков', color: 'error' })
	} finally {
		loading.value = false
	}
}

function openCreateList() {
	listForm.title = ''
	createListOpen.value = true
}

async function createList() {
	if (savingList.value) return
	savingList.value = true
	try {
		const created = await post<SupplierBookmarkList>('/supplier-bookmarks', {
			title: listForm.title.trim(),
			is_global: false,
		})
		lists.value = [{ ...created, items: created.items ?? [] }, ...lists.value]
		selectedListId.value = created.id
		createListOpen.value = false
		toast.add({ title: 'База создана', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось создать базу', color: 'error' })
	} finally {
		savingList.value = false
	}
}

async function saveToList() {
	if (!canSave.value || !props.supplier || !selectedListId.value || saving.value) return
	saving.value = true
	try {
		const created = await post<SupplierBookmarkItem>(
			`/supplier-bookmarks/${selectedListId.value}/items`,
			{
				company_name: props.supplier.company_name.trim(),
				email: props.supplier.main_email.trim(),
				domain: normalizeDomain(props.supplier.domain),
			},
		)
		lists.value = lists.value.map((list) =>
			list.id === selectedListId.value
				? { ...list, items: [...list.items, created] }
				: list,
		)
		toast.add({
			title: `${props.supplier.company_name} добавлен в базу`,
			color: 'success',
			icon: 'i-lucide-check',
		})
		isOpen.value = false
	} catch {
		toast.add({ title: 'Не удалось сохранить поставщика', color: 'error' })
	} finally {
		saving.value = false
	}
}

watch(isOpen, (open) => {
	if (open) {
		selectedListId.value = null
		fetchLists()
	}
})
</script>
