<template>
	<UModal v-model:open="isOpen">
		<template #header>
			<div class="flex items-start gap-3 min-w-0">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
					<UIcon name="i-lucide-database" class="size-5 text-primary" />
				</div>
				<div class="min-w-0">
					<p class="text-lg font-semibold text-highlighted">
						Импорт из базы поставщиков
					</p>
					<p class="mt-0.5 text-sm text-muted">
						Создать запрос без поиска и сразу добавить выбранную базу
					</p>
				</div>
			</div>
		</template>

		<template #body>
			<UForm :schema="schema" :state="form" class="space-y-4" @submit="submit">
				<UFormField label="Название запроса" name="query" required>
					<UInput
						v-model="form.query"
						placeholder="Например: насосы для котельной"
						icon="i-lucide-file-text"
						size="lg"
						class="w-full"
					/>
				</UFormField>

				<UFormField label="Регион" name="delivery_region" required>
					<UInput
						v-model="form.delivery_region"
						icon="i-lucide-map-pin"
						size="lg"
						class="w-full"
					/>
				</UFormField>

				<UFormField label="База поставщиков" name="bookmark_list_id" required>
					<USelectMenu
						v-model="form.bookmark_list_id"
						value-key="id"
						label-key="title"
						:items="listOptions"
						placeholder="Выберите базу"
						icon="i-lucide-database"
						class="w-full"
						:loading="listsLoading"
					/>
				</UFormField>

				<p v-if="selectedList" class="text-xs text-muted">
					В базе: {{ selectedList.items.length }}
					{{ pluralizeSuppliers(selectedList.items.length) }}
				</p>

				<UAlert
					v-if="error"
					color="error"
					variant="soft"
					icon="i-lucide-circle-alert"
					:description="error"
				/>

				<div class="flex justify-end gap-2 pt-1">
					<UButton color="neutral" variant="ghost" @click="isOpen = false">
						Отмена
					</UButton>
					<UButton
						type="submit"
						leading-icon="i-lucide-download"
						:loading="submitting"
						:disabled="!canSubmit"
					>
						Создать запрос
					</UButton>
				</div>
			</UForm>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import type { RequestFromBookmarksCreate, RequestResponse, SupplierBookmarkList } from '#shared/types'
import { z } from 'zod'
import { titleCaseWords } from '#shared/utils/textFormat'
import { getApiErrorDetail } from '#shared/utils/apiError'
import { t } from '~/constants/translations'

const isOpen = defineModel<boolean>('open', { default: false })

const { get, post } = useApi()
const toast = useToast()

const schema = z.object({
	query: z.string().min(3, 'Минимум 3 символа').max(500, 'Максимум 500 символов'),
	delivery_region: z.string().min(2, 'Укажите регион').max(100),
	bookmark_list_id: z.string().min(1, 'Выберите базу'),
})

const form = reactive({
	query: '',
	delivery_region: t('requests.defaultDeliveryRegion'),
	bookmark_list_id: '',
})

const lists = ref<SupplierBookmarkList[]>([])
const listsLoading = ref(false)
const submitting = ref(false)
const error = ref('')

const listOptions = computed(() =>
	lists.value.map((list) => ({
		id: list.id,
		title: `${list.title} (${list.items.length})`,
	})),
)

const selectedList = computed(() =>
	lists.value.find((list) => list.id === form.bookmark_list_id) ?? null,
)

const canSubmit = computed(() =>
	!submitting.value
	&& form.query.trim().length >= 3
	&& form.delivery_region.trim().length >= 2
	&& !!selectedList.value
	&& selectedList.value.items.length > 0,
)

function pluralizeSuppliers(count: number): string {
	const mod10 = count % 10
	const mod100 = count % 100
	if (mod10 === 1 && mod100 !== 11) return 'поставщик'
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'поставщика'
	return 'поставщиков'
}

async function fetchLists() {
	listsLoading.value = true
	try {
		lists.value = await get<SupplierBookmarkList[]>('/supplier-bookmarks')
		if (!form.bookmark_list_id && lists.value.length === 1) {
			form.bookmark_list_id = lists.value[0].id
		}
	}
	catch {
		lists.value = []
		toast.add({ title: 'Не удалось загрузить базы поставщиков', color: 'error' })
	}
	finally {
		listsLoading.value = false
	}
}

async function submit() {
	if (!canSubmit.value || !selectedList.value) return
	submitting.value = true
	error.value = ''
	try {
		const payload: RequestFromBookmarksCreate = {
			query: form.query.trim(),
			delivery_region: titleCaseWords(form.delivery_region),
			bookmark_list_id: form.bookmark_list_id,
		}
		const created = await post<RequestResponse>('/requests/from-bookmarks', payload)
		isOpen.value = false
		await navigateTo(`/requests/${created.id}`)
	}
	catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Не удалось создать запрос из базы'
	}
	finally {
		submitting.value = false
	}
}

watch(isOpen, (open) => {
	if (!open) return
	error.value = ''
	form.query = ''
	form.delivery_region = t('requests.defaultDeliveryRegion')
	form.bookmark_list_id = ''
	void fetchLists()
})
</script>
