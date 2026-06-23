<template>
	<UModal
		v-model:open="isOpen"
		:title="`Составить письмо — ${supplier.company_name}`"
		:ui="{ content: 'max-w-5xl' }"
	>
		<template #body>
			<div class="flex flex-col md:flex-row gap-4 min-h-96">
				<div class="flex-1 min-w-0 space-y-4">
					<UFormField label="Email">
						<UInput :model-value="supplier.main_email" readonly class="w-full" />
					</UFormField>
					<UFormField label="Тема">
						<UInput v-model="subject" class="w-full" />
					</UFormField>
					<UFormField label="Сообщение">
						<UTextarea v-model="body" :rows="14" class="w-full" autoresize />
					</UFormField>
					<UAlert v-if="error" color="error" variant="soft" :description="error" />
					<div class="flex justify-end gap-2 pt-2">
						<UButton variant="outline" color="neutral" @click="close">
							Отмена
						</UButton>
						<UButton
							leading-icon="i-lucide-send"
							:loading="sending"
							:disabled="!subject.trim() || !body.trim()"
							@click="send"
						>
							Отправить
						</UButton>
					</div>
				</div>
				<div class="w-full md:w-72 shrink-0 min-h-64 md:min-h-0">
					<EmailTemplateSidebar @select="applyTemplate" />
				</div>
			</div>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import type { ComparisonSupplier, EmailTemplate } from '#shared/types'
import EmailTemplateSidebar from '~/components/EmailTemplateSidebar.vue'

const props = defineProps<{
	requestId: string
	supplier: ComparisonSupplier
	initialBody: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { post } = useApi()
const toast = useToast()

const subject = ref('Уточнение коммерческого предложения')
const body = ref('')
const sending = ref(false)
const error = ref('')

function resetForm() {
	subject.value = 'Уточнение коммерческого предложения'
	body.value = props.initialBody
	error.value = ''
}

function applyTemplate(template: EmailTemplate) {
	subject.value = template.subject
	body.value = template.body.replace(
		/\{company_name\}/g,
		props.supplier.company_name,
	)
}

function close() {
	isOpen.value = false
}

async function send() {
	sending.value = true
	error.value = ''
	try {
		await post(
			`/requests/${props.requestId}/suppliers/${props.supplier.rs_id}/improvement-request`,
			{
				subject: subject.value.trim(),
				body: body.value.trim(),
			},
		)
		toast.add({
			title: 'Письмо отправлено',
			color: 'success',
			icon: 'i-lucide-check',
		})
		close()
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		error.value = typeof detail === 'string' ? detail : 'Не удалось отправить письмо'
	} finally {
		sending.value = false
	}
}

watch(
	() => [isOpen.value, props.supplier.rs_id, props.initialBody] as const,
	([open]) => {
		if (open) resetForm()
	},
	{ immediate: true },
)
</script>
