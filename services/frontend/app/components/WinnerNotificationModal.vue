<template>
	<UModal
		v-model:open="isOpen"
		title="Отправить уведомление победителю"
		:ui="{ content: 'max-w-5xl' }"
	>
		<template #body>
			<div class="flex flex-col md:flex-row gap-4 min-h-96">
				<div class="flex-1 min-w-0 space-y-4">
					<div class="rounded-lg border border-success/30 bg-success/5 p-4">
						<p class="text-xs font-medium text-success mb-1">
							Выбранный победитель:
						</p>
						<p class="text-sm font-semibold">{{ supplier.company_name }}</p>
						<p class="text-xs text-success mt-1">
							Email: {{ supplier.main_email }}
						</p>
					</div>
					<UFormField label="Тема письма">
						<UInput v-model="subject" class="w-full" />
					</UFormField>
					<UFormField label="Текст письма">
						<UTextarea v-model="body" :rows="10" class="w-full" autoresize />
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
							class="w-full min-h-20"
							@update:model-value="filesToUpload = $event"
						>
							<template #actions="{ open }">
								<UButton type="button" variant="outline" size="sm" @click="open()">
									<UIcon name="i-lucide-paperclip" class="w-4 h-4" />
									Добавить файлы
								</UButton>
							</template>
						</UFileUpload>
					</div>
					<UAlert v-if="error" color="error" variant="soft" :description="error" />
					<div class="flex justify-end gap-2 pt-2">
						<UButton variant="outline" color="neutral" @click="close">
							Отменить
						</UButton>
						<UButton
							color="success"
							leading-icon="i-lucide-send"
							:loading="sending"
							:disabled="!subject.trim() || !body.trim()"
							@click="send"
						>
							Отправить уведомление
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
import type { Attachment, ComparisonSupplier, EmailTemplate } from '#shared/types'
import EmailTemplateSidebar from '~/components/EmailTemplateSidebar.vue'

const props = defineProps<{
	requestId: string
	supplier: ComparisonSupplier
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { post } = useApi()
const toast = useToast()

const subject = ref('')
const body = ref('')
const filesToUpload = ref<File[]>([])
const sending = ref(false)
const error = ref('')

function defaultSubject() {
	return 'Поздравляем! Ваше предложение признано лучшим'
}

function defaultBody(companyName: string) {
	return `Уважаемый ${companyName}!

Поздравляем! Ваше коммерческое предложение признано лучшим в рамках проведённого тендера.

Мы готовы заключить с вами договор на поставку товаров/услуг на условиях, указанных в вашем предложении.

С уважением.`
}

function resetForm() {
	subject.value = defaultSubject()
	body.value = defaultBody(props.supplier.company_name)
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

		await post(
			`/requests/${props.requestId}/suppliers/${props.supplier.rs_id}/winner-notification`,
			{
				subject: subject.value.trim(),
				body: body.value.trim(),
				attachment_paths: attachmentPaths ?? null,
			},
		)
		toast.add({
			title: 'Уведомление победителю отправлено',
			color: 'success',
			icon: 'i-lucide-check',
		})
		close()
	} catch (e: unknown) {
		const detail = (e as { response?: { data?: { detail?: string } } })
			?.response?.data?.detail
		error.value = typeof detail === 'string'
			? detail
			: 'Не удалось отправить уведомление'
	} finally {
		sending.value = false
	}
}

watch(isOpen, (open) => {
	if (open) resetForm()
})
</script>
