<template>
	<UModal
		v-model:open="isOpen"
		title="Сохранить в базу"
		:ui="{ content: 'max-w-md' }"
	>
		<template #body>
			<div v-if="supplier" class="space-y-4">
				<UForm :schema="itemSchema" :state="itemForm" class="space-y-3" @submit="saveToList">
					<UFormField label="Название компании" name="company_name" required>
						<UInput
							v-model="itemForm.company_name"
							icon="i-lucide-building-2"
							class="w-full"
						/>
					</UFormField>

					<UFormField label="Email" name="email" required>
						<UInput
							v-model="itemForm.email"
							type="email"
							icon="i-lucide-mail"
							class="w-full"
						/>
					</UFormField>

					<UFormField label="Домен" name="domain">
						<UInput
							v-model="itemForm.domain"
							placeholder="supplier.ru"
							icon="i-lucide-globe"
							class="w-full"
						/>
					</UFormField>

					<UFormField label="Иное" name="notes" hint="Контакты, телефоны, комментарии">
						<UTextarea v-model="itemForm.notes" :rows="2" class="w-full" />
					</UFormField>

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
						<UButton variant="ghost" color="neutral" type="button" @click="isOpen = false">
							Отмена
						</UButton>
						<UButton
							type="submit"
							:loading="saving"
							:disabled="!canSave"
							leading-icon="i-lucide-database"
						>
							Сохранить
						</UButton>
					</div>
				</UForm>
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
					<UButton variant="ghost" color="neutral" type="button" @click="createListOpen = false">
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

const itemForm = reactive({
	company_name: '',
	email: '',
	domain: '',
	notes: '',
})

const itemSchema = z.object({
	company_name: z.string().min(1, 'Обязательное поле').max(200),
	email: z.string().email('Неверный формат email'),
	domain: z.string().optional(),
	notes: z.string().optional(),
})

function normalizeDomain(value: string | null | undefined): string | null {
	const trimmed = (value ?? '').trim()
	return trimmed.length >= 3 ? trimmed : null
}

const listOptions = computed(() =>
	lists.value.filter((list) => !list.is_global),
)

const selectedList = computed(() =>
	listOptions.value.find((list) => list.id === selectedListId.value) ?? null,
)

const duplicateWarning = computed(() => {
	if (!itemForm.email || !selectedList.value) return null
	const normalized = itemForm.email.trim().toLowerCase()
	if (selectedList.value.items.some((item) => (item.email ?? '').trim().toLowerCase() === normalized)) {
		return 'Этот email уже есть в выбранной базе'
	}
	return null
})

const canSave = computed(() =>
	Boolean(selectedListId.value && itemForm.email && !duplicateWarning.value),
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
	if (!canSave.value || !selectedListId.value || saving.value) return
	saving.value = true
	try {
		const created = await post<SupplierBookmarkItem>(
			`/supplier-bookmarks/${selectedListId.value}/items`,
			{
				company_name: itemForm.company_name.trim(),
				email: itemForm.email.trim(),
				domain: normalizeDomain(itemForm.domain),
				notes: itemForm.notes.trim() || null,
			},
		)
		lists.value = lists.value.map((list) =>
			list.id === selectedListId.value
				? { ...list, items: [...list.items, created] }
				: list,
		)
		toast.add({
			title: `${itemForm.company_name} добавлен в базу`,
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
		itemForm.company_name = props.supplier?.company_name ?? ''
		itemForm.email = props.supplier?.main_email ?? ''
		itemForm.domain = props.supplier?.domain ?? ''
		itemForm.notes = ''
		selectedListId.value = null
		fetchLists()
	}
})
</script>
