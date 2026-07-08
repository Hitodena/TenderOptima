<template>
	<UModal
		v-model:open="isOpen"
		title="База поставщиков"
		:ui="{ content: 'max-w-3xl' }"
	>
		<template #body>
			<div class="flex flex-col gap-4 min-h-96">
				<div class="flex items-center gap-2">
					<UInput
						v-model="search"
						placeholder="Поиск по базе, названию, email..."
						icon="i-lucide-search"
						class="flex-1"
					/>
					<UButton
						size="sm"
						variant="ghost"
						color="neutral"
						icon="i-lucide-refresh-cw"
						:loading="loading"
						@click="fetchLists"
					/>
					<UButton
						size="sm"
						variant="outline"
						leading-icon="i-lucide-plus"
						@click="openCreateList"
					>
						Новая база
					</UButton>
				</div>

				<div class="flex-1 min-h-0">
					<div v-if="loading && !lists.length" class="space-y-2">
						<USkeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-lg" />
					</div>
					<div
						v-else-if="!filteredLists.length"
						class="flex flex-col items-center justify-center py-16 gap-2 text-muted"
					>
						<UIcon name="i-lucide-database" class="w-10 h-10 opacity-20" />
						<p class="text-sm">{{ search ? 'Ничего не найдено' : 'Базы поставщиков пусты' }}</p>
					</div>
					<div v-else class="space-y-3 max-h-112 overflow-y-auto pr-1">
						<div
							v-for="list in filteredLists"
							:key="list.id"
							class="rounded-lg border border-default overflow-hidden"
						>
							<button
								type="button"
								class="w-full flex items-center gap-3 p-3 text-left hover:bg-elevated/50 transition-colors"
								@click="toggleList(list.id)"
							>
								<UIcon
									:name="expandedListIds.has(list.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
									class="w-4 h-4 text-muted shrink-0"
								/>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<p class="text-sm font-semibold truncate">{{ list.title }}</p>
										<UBadge v-if="list.is_global" color="info" variant="subtle" size="sm">
											Общая
										</UBadge>
										<span class="text-xs text-muted">{{ list.items.length }} поставщ.</span>
									</div>
								</div>
								<UButton
									v-if="list.items.length"
									size="xs"
									variant="soft"
									leading-icon="i-lucide-users"
									:loading="addingListId === list.id"
									@click.stop="addAllToRequest(list)"
								>
									Добавить всех
								</UButton>
								<template v-if="canModifyList(list)">
									<template v-if="confirmDeleteListId === list.id">
										<UButton
											size="xs"
											color="error"
											variant="soft"
											icon="i-lucide-check"
											aria-label="Подтвердить удаление базы"
											:loading="deletingListId === list.id"
											@click.stop="confirmRemoveList(list.id)"
										/>
										<UButton
											size="xs"
											color="neutral"
											variant="ghost"
											icon="i-lucide-x"
											aria-label="Отменить удаление"
											@click.stop="confirmDeleteListId = null"
										/>
									</template>
									<UButton
										v-else
										size="xs"
										variant="ghost"
										color="error"
										icon="i-lucide-trash-2"
										aria-label="Удалить базу"
										:loading="deletingListId === list.id"
										@click.stop="startDeleteListConfirm(list.id)"
									/>
								</template>
							</button>

							<div v-if="expandedListIds.has(list.id)" class="border-t border-default p-3 space-y-3 bg-elevated/20">
								<div v-if="!list.items.length" class="text-xs text-muted text-center py-4">
									В базе пока нет поставщиков
								</div>
								<div
									v-for="item in list.items"
									:key="item.id"
									class="flex items-center gap-3 rounded-lg border border-default bg-default p-3"
								>
									<div class="w-8 h-8 rounded-lg bg-elevated flex items-center justify-center shrink-0">
										<UIcon name="i-lucide-building-2" class="w-4 h-4 text-muted" />
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium truncate">{{ item.company_name }}</p>
										<p class="text-xs text-muted truncate">{{ item.email }}</p>
										<p v-if="item.phone" class="text-xs text-muted/60 truncate">{{ item.phone }}</p>
										<p v-if="item.domain" class="text-xs text-muted/60 truncate">{{ item.domain }}</p>
									</div>
									<div class="flex items-center gap-1 shrink-0">
										<UButton
											v-if="canModifyList(list)"
											size="xs"
											variant="ghost"
											color="neutral"
											icon="i-lucide-pencil"
											@click="openEditItemModal(list.id, item)"
										/>
										<template v-if="canModifyList(list)">
											<template v-if="confirmDeleteItemId === item.id">
												<UButton
													size="xs"
													color="error"
													variant="soft"
													icon="i-lucide-check"
													aria-label="Подтвердить удаление"
													:loading="deletingItemId === item.id"
													@click.stop="confirmRemoveItem(list.id, item.id)"
												/>
												<UButton
													size="xs"
													color="neutral"
													variant="ghost"
													icon="i-lucide-x"
													aria-label="Отменить удаление"
													@click.stop="confirmDeleteItemId = null"
												/>
											</template>
											<UButton
												v-else
												size="xs"
												variant="ghost"
												color="error"
												icon="i-lucide-trash-2"
												aria-label="Удалить поставщика"
												:loading="deletingItemId === item.id"
												@click.stop="startDeleteItemConfirm(item.id)"
											/>
										</template>
										<UButton
											size="sm"
											variant="soft"
											leading-icon="i-lucide-plus"
											:loading="addingItemId === item.id"
											@click="addToRequest(item)"
										>
											Добавить
										</UButton>
									</div>
								</div>

								<div v-if="canModifyList(list)">
									<UButton
										size="sm"
										variant="outline"
										leading-icon="i-lucide-user-plus"
										@click="openAddItemModal(list.id)"
									>
										Добавить поставщика
									</UButton>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</UModal>

	<AddSupplierModal
		v-model:open="bookmarkModalOpen"
		:bookmark-list-id="editingBookmarkListId"
		:bookmark-item="editingBookmarkItem"
		@added="fetchLists"
		@updated="fetchLists"
	/>

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
import type {
	SupplierBookmarkItem,
	SupplierBookmarkList,
	SupplierCreate,
} from '#shared/types'
import { pluralizeSuppliers } from '#shared/utils/textFormat'

const props = defineProps<{ requestId: string }>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [] }>()

const { get, post, del } = useApi()
const toast = useToast()

const lists = ref<SupplierBookmarkList[]>([])
const loading = ref(false)
const savingList = ref(false)
const deletingListId = ref<string | null>(null)
const deletingItemId = ref<string | null>(null)
const confirmDeleteListId = ref<string | null>(null)
const confirmDeleteItemId = ref<string | null>(null)
const addingItemId = ref<string | null>(null)
const addingListId = ref<string | null>(null)
const search = ref('')
const expandedListIds = ref(new Set<string>())
const createListOpen = ref(false)
const bookmarkModalOpen = ref(false)
const editingBookmarkListId = ref<string | null>(null)
const editingBookmarkItem = ref<SupplierBookmarkItem | null>(null)

const listForm = reactive({ title: '' })

const listSchema = z.object({
	title: z.string().min(1, 'Обязательное поле').max(255),
})

const filteredLists = computed(() => {
	const q = search.value.trim().toLowerCase()
	if (!q) return lists.value
	return lists.value
		.map((list) => {
			const titleMatch = list.title.toLowerCase().includes(q)
			const items = list.items.filter(
				(item) =>
					titleMatch ||
					item.company_name.toLowerCase().includes(q) ||
					item.email.toLowerCase().includes(q) ||
					(item.domain ?? '').toLowerCase().includes(q),
			)
			if (titleMatch || items.length) {
				return { ...list, items: titleMatch ? list.items : items }
			}
			return null
		})
		.filter((list): list is SupplierBookmarkList => list !== null)
})

function canModifyList(list: SupplierBookmarkList): boolean {
	return !list.is_global
}

function normalizeDomain(value: string | null | undefined): string | null {
	const trimmed = (value ?? '').trim()
	return trimmed.length >= 3 ? trimmed : null
}

function normalizePhone(value: string | null | undefined): string | null {
	const trimmed = (value ?? '').trim()
	return trimmed || null
}

function clearDeleteConfirm() {
	confirmDeleteListId.value = null
	confirmDeleteItemId.value = null
}

function startDeleteListConfirm(listId: string) {
	confirmDeleteItemId.value = null
	confirmDeleteListId.value = listId
}

function startDeleteItemConfirm(itemId: string) {
	confirmDeleteListId.value = null
	confirmDeleteItemId.value = itemId
}

async function confirmRemoveList(listId: string) {
	confirmDeleteListId.value = null
	await removeList(listId)
}

async function confirmRemoveItem(listId: string, itemId: string) {
	confirmDeleteItemId.value = null
	await removeItem(listId, itemId)
}

function toggleList(listId: string) {
	const next = new Set(expandedListIds.value)
	if (next.has(listId)) next.delete(listId)
	else next.add(listId)
	expandedListIds.value = next
}

async function fetchLists() {
	loading.value = true
	try {
		lists.value = await get<SupplierBookmarkList[]>('/supplier-bookmarks')
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

function openAddItemModal(listId: string) {
	editingBookmarkListId.value = listId
	editingBookmarkItem.value = null
	bookmarkModalOpen.value = true
}

function openEditItemModal(listId: string, item: SupplierBookmarkItem) {
	editingBookmarkListId.value = listId
	editingBookmarkItem.value = item
	bookmarkModalOpen.value = true
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
		expandedListIds.value = new Set([...expandedListIds.value, created.id])
		createListOpen.value = false
		toast.add({ title: 'База создана', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось создать базу', color: 'error' })
	} finally {
		savingList.value = false
	}
}

async function removeList(listId: string) {
	deletingListId.value = listId
	try {
		await del(`/supplier-bookmarks/${listId}`)
		lists.value = lists.value.filter((list) => list.id !== listId)
		const next = new Set(expandedListIds.value)
		next.delete(listId)
		expandedListIds.value = next
		toast.add({ title: 'База удалена', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось удалить базу', color: 'error' })
	} finally {
		deletingListId.value = null
	}
}

async function removeItem(listId: string, itemId: string) {
	deletingItemId.value = itemId
	try {
		await del(`/supplier-bookmarks/${listId}/items/${itemId}`)
		lists.value = lists.value.map((list) =>
			list.id === listId
				? { ...list, items: list.items.filter((item) => item.id !== itemId) }
				: list,
		)
		toast.add({ title: 'Поставщик удалён из базы', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось удалить поставщика', color: 'error' })
	} finally {
		deletingItemId.value = null
	}
}

function supplierPayload(item: SupplierBookmarkItem): SupplierCreate {
	return {
		domain: normalizeDomain(item.domain),
		company_name: item.company_name.trim(),
		email: item.email.trim(),
		phone: normalizePhone(item.phone),
		source: 'manual',
		request_id: props.requestId,
		is_enabled: true,
	}
}

async function addToRequest(item: SupplierBookmarkItem) {
	addingItemId.value = item.id
	try {
		await post('/suppliers/', supplierPayload(item))
		emit('added')
		toast.add({
			title: `${item.company_name} добавлен к запросу`,
			color: 'success',
			icon: 'i-lucide-check',
		})
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		toast.add({
			title: typeof detail === 'string' ? detail : 'Не удалось добавить поставщика',
			color: 'error',
		})
	} finally {
		addingItemId.value = null
	}
}

async function addAllToRequest(list: SupplierBookmarkList) {
	if (!list.items.length || addingListId.value) return
	addingListId.value = list.id
	try {
		const results = await Promise.allSettled(
			list.items.map((item) => post('/suppliers/', supplierPayload(item))),
		)
		const added = results.filter((r) => r.status === 'fulfilled').length
		const failed = results.length - added
		if (added > 0) emit('added')
		if (failed === 0) {
			toast.add({
				title: `Добавлено ${added} ${pluralizeSuppliers(added)}`,
				color: 'success',
				icon: 'i-lucide-check',
			})
		} else if (added > 0) {
			toast.add({
				title: `Добавлено ${added}, не удалось: ${failed}`,
				color: 'warning',
			})
		} else {
			toast.add({ title: 'Не удалось добавить поставщиков', color: 'error' })
		}
	} finally {
		addingListId.value = null
	}
}

watch(isOpen, (open) => {
	if (open) fetchLists()
	else clearDeleteConfirm()
})

watch(search, () => {
	clearDeleteConfirm()
})
</script>
