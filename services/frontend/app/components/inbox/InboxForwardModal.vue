<template>
	<UModal v-model:open="isOpen" title="Переслать письмо коллеге" :ui="{ content: 'max-w-lg' }">
		<template #body>
			<form class="space-y-4" @submit.prevent="submit">
				<p class="text-sm text-muted">
					Письмо {{ supplierName }}<template v-if="receivedLabel"> от {{ receivedLabel }}</template>
					уйдёт с вашего почтового ящика. Пересылка считается отправленным письмом в лимите тарифа.
				</p>
				<p class="text-sm text-muted">
					Когда коллега ответит, его ответ появится здесь, в переписке с поставщиком, как комментарий коллеги.
					Поставщик его не увидит.
				</p>
				<UFormField label="Кому" required :error="emailError || undefined">
					<UInput
						id="forward-to"
						v-model="toEmail"
						type="email"
						placeholder="colleague@company.by"
						autocomplete="email"
						class="w-full"
						autofocus
					/>
				</UFormField>
				<UFormField label="Комментарий" hint="Необязательно">
					<UTextarea
						id="forward-comment"
						v-model="comment"
						:rows="3"
						autoresize
						placeholder="Посмотри, пожалуйста, условия по оплате"
						class="w-full"
					/>
				</UFormField>
				<UCheckbox
					v-if="attachmentCount"
					id="forward-attachments"
					v-model="includeAttachments"
					:label="`Приложить файлы письма (${attachmentCount})`"
				/>
				<UAlert v-if="quotaMessage" color="warning" variant="soft" icon="i-lucide-mail" :description="quotaMessage" />
				<UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
				<div class="flex justify-end gap-2 pt-1">
					<UButton color="neutral" variant="ghost" type="button" @click="() => { isOpen = false }">Отмена</UButton>
					<UButton type="submit" leading-icon="i-lucide-forward" :loading="sending" :disabled="!canSend">
						Переслать
					</UButton>
				</div>
			</form>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import type { ForwardPayload, Message } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

const props = defineProps<{
	requestId: string
	rsId: string | null
	message: Message | null
	supplierName: string
	quotaMessage?: string | null
}>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ sent: [toEmail: string] }>()

const { post } = useApi()
const toEmail = ref('')
const comment = ref('')
const includeAttachments = ref(true)
const sending = ref(false)
const error = ref<string | null>(null)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const emailError = computed(() =>
	toEmail.value.trim() && !EMAIL_RE.test(toEmail.value.trim()) ? 'Проверьте адрес' : null,
)
const attachmentCount = computed(() => (props.message?.attachments ?? []).filter(a => a.path).length)
const canSend = computed(() =>
	Boolean(props.rsId && props.message && EMAIL_RE.test(toEmail.value.trim()) && !props.quotaMessage),
)
const receivedLabel = computed(() => {
	const iso = props.message?.received_at
	return iso
		? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
		: ''
})

watch(isOpen, (open) => {
	if (open) {
		comment.value = ''
		includeAttachments.value = true
		error.value = null
	}
})

async function submit() {
	if (!canSend.value || !props.rsId || !props.message) return
	sending.value = true
	error.value = null
	const to = toEmail.value.trim()
	try {
		const payload: ForwardPayload = {
			to_email: to,
			comment: comment.value.trim() || null,
			include_attachments: includeAttachments.value,
		}
		await post(
			`/requests/${props.requestId}/suppliers/${props.rsId}/messages/${props.message.id}/forward`,
			payload,
		)
		emit('sent', to)
		isOpen.value = false
	} catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Не удалось переслать письмо'
	} finally {
		sending.value = false
	}
}
</script>
