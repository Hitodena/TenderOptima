<template>
	<UModal v-model:open="isOpen" title="Добавить поставщика" :ui="{ content: 'max-w-md' }">
		<template #body>
			<UForm :schema="schema" :state="form" class="space-y-4" @submit="handleAdd">
				<UFormField label="Название компании" name="company_name" required>
					<UInput
						v-model="form.company_name"
						placeholder="ООО ПромПоставка"
						icon="i-lucide-building-2"
						class="w-full"
					/>
				</UFormField>

				<UFormField label="Email" name="email" required>
					<UInput
						v-model="form.email"
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
						:trailing-icon="showOptional ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
						@click="showOptional = !showOptional"
					>
						Дополнительные поля
					</UButton>

					<div v-show="showOptional" class="mt-3 space-y-3">
						<UFormField label="Домен" name="domain" hint="example.com">
							<UInput
								v-model="form.domain"
								placeholder="supplier.ru"
								icon="i-lucide-globe"
								class="w-full"
							/>
						</UFormField>

						<UFormField
							label="Дополнительные email"
							name="extra_emails"
							hint="Через запятую или с новой строки"
						>
							<UTextarea
								v-model="form.extra_emails"
								:rows="3"
								placeholder="info@supplier.ru, zakupki@supplier.ru"
								class="w-full"
							/>
						</UFormField>
					</div>
				</div>

				<UAlert
					v-if="error"
					color="error"
					variant="soft"
					icon="i-lucide-circle-alert"
					:description="error"
				/>

				<div class="flex justify-end gap-2 pt-2">
					<UButton color="neutral" variant="ghost" @click="close">Отмена</UButton>
					<UButton type="submit" :loading="loading" leading-icon="i-lucide-plus">
						Добавить
					</UButton>
				</div>
			</UForm>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import { z } from 'zod'
import type { SupplierCreate } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

const props = defineProps<{ requestId: string }>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [] }>()

const { post } = useApi()

const schema = z.object({
	domain: z.string().optional(),
	company_name: z.string().min(1, 'Обязательное поле').max(200),
	email: z.string().email('Неверный формат email'),
	extra_emails: z.string().optional(),
})

const form = reactive({
	domain: '',
	company_name: '',
	email: '',
	extra_emails: '',
})
const showOptional = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

function parseExtraEmails(raw: string, primaryEmail: string): string[] | null {
	const parts = raw
		.split(/[\n,;]+/)
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean)
	const unique = [...new Set(parts.filter((part) => part !== primaryEmail.trim().toLowerCase()))]
	return unique.length ? unique : null
}

function resetForm() {
	form.domain = ''
	form.company_name = ''
	form.email = ''
	form.extra_emails = ''
	showOptional.value = false
	error.value = null
}

function close() {
	isOpen.value = false
	resetForm()
}

async function handleAdd() {
	if (loading.value) return
	loading.value = true
	error.value = null
	try {
		const email = form.email.trim()
		const payload: SupplierCreate = {
			domain: form.domain.trim() || null,
			company_name: form.company_name.trim(),
			email,
			extra_emails: parseExtraEmails(form.extra_emails, email),
			source: 'manual',
			request_id: props.requestId,
		}
		await post('/suppliers/', payload)
		emit('added')
		close()
	} catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Ошибка при добавлении поставщика'
	} finally {
		loading.value = false
	}
}
</script>
