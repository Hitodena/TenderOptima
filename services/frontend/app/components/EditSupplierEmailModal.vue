<template>
	<UModal v-model:open="isOpen" title="Изменить основной email" :ui="{ content: 'max-w-md' }">
		<template #body>
			<div v-if="supplier" class="space-y-4">
				<p class="text-sm text-muted">
					Выберите основной email для отправки запросов поставщику.
					Доступны все найденные email-адреса.
				</p>

				<div class="space-y-2 max-h-60 overflow-y-auto">
					<UButton v-for="email in allEmails" :key="email"
						:color="email === selectedEmail ? 'success' : 'neutral'"
						:variant="email === selectedEmail ? 'outline' : 'outline'"
						class="w-full justify-start font-normal" @click="selectedEmail = email">
						<template #leading>
							<UIcon :name="email === selectedEmail ? 'i-lucide-circle-check' : 'i-lucide-circle'"
								class="w-4 h-4" />
						</template>
						{{ email }}
						<UBadge v-if="email === supplier.main_email" color="success" variant="subtle" size="sm"
							class="ml-auto">
							Текущий
						</UBadge>
					</UButton>
				</div>

				<UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />

				<div class="flex justify-end gap-2 pt-2">
					<UButton color="neutral" variant="ghost" @click="close">Отмена</UButton>
					<UButton @click="handleSave" :loading="loading" :disabled="!hasChanges">Сохранить</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import type { Supplier, SupplierEmailUpdate } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

const props = withDefaults(defineProps<{
	supplier?: Supplier | null
}>(), {
	supplier: null,
})
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: []; closed: [] }>()

const { patch } = useApi()

const allEmails = computed(() => {
	if (!props.supplier) return []
	const emails = [props.supplier.main_email, ...(props.supplier.extra_emails || [])]
	return [...new Set(emails)].sort()
})

const selectedEmail = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const hasChanges = computed(() => !!props.supplier && selectedEmail.value !== props.supplier.main_email)

watch(
	() => props.supplier,
	(s) => {
		if (s) selectedEmail.value = s.main_email
	},
	{ immediate: true }
)

watch(
	() => isOpen.value,
	(open) => {
		if (open && props.supplier) {
			selectedEmail.value = props.supplier.main_email
			error.value = null
		}
		if (!open) {
			emit('closed')
		}
	}
)

function close() {
	isOpen.value = false
}

async function handleSave() {
	if (!props.supplier || !hasChanges.value) return
	loading.value = true
	error.value = null
	const payload: SupplierEmailUpdate = { main_email: selectedEmail.value }
	try {
		await patch(`/suppliers/${props.supplier.id}/email`, payload)
		emit('saved')
		close()
	} catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Ошибка при обновлении email'
	} finally {
		loading.value = false
	}
}
</script>
