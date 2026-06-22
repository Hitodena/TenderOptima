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
								<UButton
									v-if="canModifyList(list)"
									size="xs"
									variant="ghost"
									color="error"
									icon="i-lucide-trash-2"
									:loading="deletingListId === list.id"
									@click.stop="removeList(list.id)"
								/>
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
										<p v-if="item.domain" class="text-xs text-muted/60 truncate">{{ item.domain }}</p>
									</div>
									<div class="flex items-center gap-1 shrink-0">
										<UButton
											v-if="canModifyList(list)"
											size="xs"
											variant="ghost"
											color="error"
											icon="i-lucide-trash-2"
											:loading="deletingItemId === item.id"
											@click="removeItem(list.id, item.id)"
										/>
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
										v-if="addingToListId !== list.id"
										size="sm"
										variant="outline"
										leading-icon="i-lucide-user-plus"
										@click="startAddItem(list.id)"
									>
										Добавить поставщика
									</UButton>
									<div v-else class="rounded-lg border border-default p-4 bg-default">
										<p class="text-sm font-semibold mb-3">Новый поставщик</p>
										<UForm
											:schema="itemSchema"
											:state="itemForm"
											class="space-y-3"
											@submit="() => createItem(list.id)"
										>
											<UFormField label="Название компании" name="company_name" required>
												<UInput
													v-model="itemForm.company_name"
													placeholder="ООО ПромПоставка"
													icon="i-lucide-building-2"
													class="w-full"
												/>
											</UFormField>
											<UFormField label="Email" name="email" required>
												<UInput
													v-model="itemForm.email"
													type="email"
													placeholder="sales@supplier.ru"
													icon="i-lucide-mail"
													class="w-full"
												/>
											</UFormField>

											<div>
												<UButton
													type="button"
													variant="ghost"
													color="neutral"
													size="sm"
													class="px-0"
													:trailing-icon="showItemOptional ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
													@click="showItemOptional = !showItemOptional"
												>
													Дополнительные поля
												</UButton>

												<div v-show="showItemOptional" class="mt-3 space-y-3">
													<UFormField label="Домен" name="domain" hint="example.com">
														<UInput
															v-model="itemForm.domain"
															placeholder="supplier.ru"
															icon="i-lucide-globe"
															class="w-full"
														/>
													</UFormField>
													<UFormField
														label="Заметки"
														name="notes"
														hint="Контакты, телефоны, комментарии"
													>
														<UTextarea
															v-model="itemForm.notes"
															:rows="3"
															placeholder="Телефон, контактное лицо, условия поставки..."
															class="w-full"
														/>
													</UFormField>
												</div>
											</div>

											<div class="flex justify-end gap-2">
												<UButton
													size="sm"
													variant="ghost"
													color="neutral"
													type="button"
													@click="cancelAddItem"
												>
													Отмена
												</UButton>
												<UButton size="sm" type="submit" :loading="savingItem">
													Сохранить
												</UButton>
											</div>
										</UForm>
									</div>
								</div>
							</div>
						</div>
					</div>
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
import type {
	SupplierBookmarkItem,
	SupplierBookmarkList,
	SupplierCreate,
} from '#shared/types'

const props = defineProps<{ requestId: string }>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [] }>()

const { get, post, del } = useApi()
const toast = useToast()

const lists = ref<SupplierBookmarkList[]>([])
const loading = ref(false)
const savingList = ref(false)
const savingItem = ref(false)
const deletingListId = ref<string | null>(null)
const deletingItemId = ref<string | null>(null)
const addingItemId = ref<string | null>(null)
const addingListId = ref<string | null>(null)
const addingToListId = ref<string | null>(null)
const search = ref('')
const expandedListIds = ref(new Set<string>())
const createListOpen = ref(false)

const listForm = reactive({ title: '' })
const itemForm = reactive({ domain: '', company_name: '', email: '', notes: '' })
const showItemOptional = ref(false)

const listSchema = z.object({
	title: z.string().min(1, 'Обязательное поле').max(255),
})

const itemSchema = z.object({
	domain: z.string().optional(),
	company_name: z.string().min(1, 'Обязательное поле').max(200),
	email: z.string().email('Неверный формат email'),
	notes: z.string().optional(),
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

function startAddItem(listId: string) {
	addingToListId.value = listId
	itemForm.domain = ''
	itemForm.company_name = ''
	itemForm.email = ''
	itemForm.notes = ''
	showItemOptional.value = false
}

function cancelAddItem() {
	addingToListId.value = null
	showItemOptional.value = false
}

async function createItem(listId: string) {
	if (savingItem.value) return
	savingItem.value = true
	try {
		const created = await post<SupplierBookmarkItem>(`/supplier-bookmarks/${listId}/items`, {
			company_name: itemForm.company_name.trim(),
			email: itemForm.email.trim(),
			domain: normalizeDomain(itemForm.domain),
			notes: itemForm.notes.trim() || null,
		})
		lists.value = lists.value.map((list) =>
			list.id === listId
				? { ...list, items: [...list.items, created] }
				: list,
		)
		cancelAddItem()
		toast.add({ title: 'Поставщик добавлен в базу', color: 'success' })
	} catch {
		toast.add({ title: 'Не удалось сохранить поставщика', color: 'error' })
	} finally {
		savingItem.value = false
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
		source: 'manual',
		request_id: props.requestId,
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
				title: `Добавлено поставщиков: ${added}`,
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
})
</script>
