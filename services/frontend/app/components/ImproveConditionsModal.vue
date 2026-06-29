<template>
	<UModal v-model:open="isOpen" :ui="EMAIL_LETTER_MODAL_UI">
		<template #header>
			<div class="min-w-0">
				<p class="text-lg font-semibold text-highlighted min-w-0 truncate">
					Запрос на улучшение условий — {{ supplier.company_name }}
				</p>
			</div>
		</template>
		<template #body>
			<div class="flex flex-col min-h-[min(70vh,40rem)]">
				<div class="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
					<div class="flex flex-col md:flex-row gap-4">
						<div class="flex-1 min-w-0 flex flex-col gap-4">
							<SupplierLetterReadonlyEmail :email="supplier.main_email" />
							<UFormField label="Тема">
								<UInput v-model="subject" class="w-full" />
							</UFormField>
							<UFormField label="Сообщение" class="flex-1 min-h-0">
								<UTextarea
									v-model="body"
									:rows="18"
									class="w-full"
									:ui="{ base: 'min-h-[min(40vh,24rem)] resize-y' }"
									autoresize
								/>
							</UFormField>
							<div>
								<p class="text-sm font-semibold mb-1">Вложения</p>
								<p class="text-xs text-muted mb-2">(договор, спецификация и др.)</p>
								<UFileUpload
									:model-value="filesToUpload"
									multiple
									accept=".pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
									:interactive="false"
									layout="list"
									class="w-full"
									@update:model-value="onFilesUpdate"
								>
									<template #actions="{ open }">
										<UButton type="button" variant="outline" size="sm" @click="open()">
											<UIcon name="i-lucide-paperclip" class="w-4 h-4" />
											Добавить файлы
										</UButton>
									</template>
								</UFileUpload>
							</div>
						</div>
						<div class="w-full md:w-72 shrink-0 min-h-64 md:min-h-0">
							<EmailTemplateSidebar @select="applyTemplate" />
						</div>
					</div>
				</div>

				<UAlert
					v-if="quotaMessage && !canSend"
					color="warning"
					variant="soft"
					icon="i-lucide-mail"
					:description="quotaMessage"
					class="shrink-0"
				/>

				<UAlert
					v-if="error"
					color="error"
					variant="soft"
					:description="error"
					class="shrink-0"
				/>

				<div :class="EMAIL_LETTER_MODAL_FOOTER_CLASS">
					<UButton color="neutral" variant="ghost" @click="close">
						Отмена
					</UButton>
					<UButton
						leading-icon="i-lucide-send"
						:loading="sending"
						:disabled="!subject.trim() || !body.trim() || !canSend"
						@click="send"
					>
						Отправить запрос
					</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import type { Attachment, ComparisonSupplier, EmailTemplate, SubscriptionResponse } from '#shared/types'
import {
	EMAIL_LETTER_MODAL_FOOTER_CLASS,
	EMAIL_LETTER_MODAL_UI,
} from '#shared/constants/emailModal'
import { getApiErrorDetail } from '#shared/utils/apiError'
import {
	canSendEmail,
	emailQuotaBlockMessage,
} from '#shared/utils/subscriptionAccess'
import EmailTemplateSidebar from '~/components/EmailTemplateSidebar.vue'
import SupplierLetterReadonlyEmail from '~/components/SupplierLetterReadonlyEmail.vue'

const props = defineProps<{
	requestId: string
	supplier: ComparisonSupplier
	subscription?: SubscriptionResponse | null
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { post } = useApi()
const toast = useToast()

const subject = ref('')
const body = ref('')
const filesToUpload = ref<File[]>([])
const sending = ref(false)
const error = ref('')

const canSend = computed(() => canSendEmail(props.subscription, 1))
const quotaMessage = computed(() => emailQuotaBlockMessage(props.subscription, 1))

function defaultSubject() {
	return 'Предложение об улучшении условий'
}

function defaultBody() {
	return `Добрый день.
В рамках текущей закупки мы получили ряд предложений. Ваше предложение - среди ключевых и находится на рассмотрении.

Поскольку цена является для нас одним из ключевых факторов выбора, текущие условия не позволяют нам сделать выбор в вашу пользу.

В рамках процедуры закупки предлагаем улучшить условия вашего предложения и предоставить ваше обновленное предложение в течение 3 рабочих дней.`
}

function onFilesUpdate(newFiles: File[] | null | undefined) {
	filesToUpload.value = newFiles ?? []
}

function resetForm() {
	subject.value = defaultSubject()
	body.value = defaultBody()
	filesToUpload.value = []
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
	if (!canSend.value) {
		error.value = quotaMessage.value ?? 'Лимит исходящих писем исчерпан'
		return
	}
	sending.value = true
	error.value = ''
	try {
		let attachmentPaths: string[] | undefined
		if (filesToUpload.value.length > 0) {
			const uploadFormData = new FormData()
			for (const file of filesToUpload.value) {
				uploadFormData.append('files', file)
			}
			const uploaded = await post<Attachment[]>(
				`/requests/${props.requestId}/attachments`,
				uploadFormData,
			)
			attachmentPaths = uploaded
				.map((a) => a.path)
				.filter((p): p is string => Boolean(p))
		}

		await post(`/requests/${props.requestId}/suppliers/${props.supplier.rs_id}/improvement-request`, {
			subject: subject.value.trim(),
			body: body.value.trim(),
			attachment_paths: attachmentPaths ?? null,
		})
		toast.add({
			title: 'Запрос на улучшение условий отправлен',
			color: 'success',
			icon: 'i-lucide-check',
		})
		close()
	} catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Не удалось отправить запрос'
	} finally {
		sending.value = false
	}
}

watch(
	() => [isOpen.value, props.supplier.rs_id] as const,
	([open]) => {
		if (open) resetForm()
	},
	{ immediate: true },
)
</script>
