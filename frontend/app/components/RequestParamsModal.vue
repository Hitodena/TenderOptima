<template>
    <UModal v-model:open="isOpen" :title="step === 'params' ? 'Параметры письма поставщикам' : 'Редактирование письма'"
        :description="step === 'params' ? 'Заполните описание и укажите дополнительные параметры' : 'Проверьте и отредактируйте письмо перед отправкой'"
        :ui="{ content: step === 'params' ? 'max-w-5xl' : 'max-w-5xl' }">
        <template #body>

            <div v-if="step === 'params'">
                <div class="space-y-6">
                    <UFormField label="Описание товара/услуги" required>
                        <UTextarea v-model="form.description"
                            placeholder="Опишите детально товар или услугу, технические характеристики, объёмы..."
                            :rows="6" class="w-full" size="lg"
                            :class="errors.description ? 'ring-2 ring-error rounded-lg' : ''" />
                        <p v-if="errors.description" class="text-xs text-error mt-1">{{ errors.description }}</p>
                    </UFormField>

                    <div>
                        <p class="text-sm font-semibold mb-1">Дополнительные параметры</p>
                        <p class="text-xs text-muted mb-3">Укажите что должен указать поставщик в ответе</p>

                        <div>
                            <div class="space-y-2 max-h-60 overflow-y-auto">
                                <div v-for="(label, idx) in form.labels" :key="idx"
                                    class="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-elevated/50 transition-colors">
                                    <span class="text-sm flex-1 truncate">{{ label }}</span>
                                    <button type="button"
                                        class="w-8 h-8 flex items-center justify-center rounded text-muted hover:text-error hover:bg-elevated transition-colors shrink-0"
                                        @click="removeLabel(idx)">
                                        <UIcon name="i-lucide-x" class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div class="flex gap-2 mt-3 items-center px-2">
                                <UInput v-model="form.newLabel" placeholder="Требование (цена, сроки, условия...)"
                                    class="flex-1" size="lg" @keyup.enter="addLabel" />
                                <button type="button"
                                    class="w-8 h-8 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-elevated transition-colors  disabled:opacity-40 disabled:cursor-not-allowed"
                                    :disabled="!form.newLabel.trim()" @click="addLabel">
                                    <UIcon name="i-lucide-plus" class="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <UFileUpload :model-value="filesToUpload" @update:model-value="handleFilesUpdate" multiple
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp" :interactive="true"
                            :description="uploadDescription" layout="list" class="w-full min-h-35" position="inside">
                            <template #actions="{ open }">
                                <UButton type="button" variant="outline" @click="open()">
                                    <UIcon name="i-lucide-paperclip" class="w-4 h-4 mr-2" />
                                    Выбрать файлы
                                </UButton>
                            </template>
                        </UFileUpload>
                    </div>
                </div>

                <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error"
                    class="mt-4" />

                <div class="flex justify-end gap-2 pt-6">
                    <UButton color="neutral" variant="ghost" @click="close">Отмена</UButton>
                    <UButton leading-icon="i-lucide-arrow-right" :loading="loadingMessage" @click="goToConfirm">
                        Далее
                    </UButton>
                </div>
            </div>

            <div v-else-if="step === 'confirm'" class="space-y-4">

                <div class="flex items-center gap-2 text-sm text-muted mb-4">
                    <UIcon name="i-lucide-info" class="w-4 h-4 shrink-0" />
                    Письмо сформировано на основе ваших параметров. Вы можете отредактировать текст перед отправкой.
                </div>

                <UTextarea v-model="form.emailMessage" :rows="20" class="w-full font-mono text-sm"
                    placeholder="Текст письма загружается..." />

                <div v-if="uploadedAttachments.length > 0" class="mb-4">
                    <p class="text-sm font-semibold mb-2">Вложения ({{ uploadedAttachments.length }}/2)</p>
                    <div class="space-y-2">
                        <div v-for="(att, idx) in uploadedAttachments" :key="idx"
                            class="flex items-center gap-2 text-sm p-2 bg-elevated/50 rounded-lg">
                            <UIcon name="i-lucide-paperclip" class="w-4 h-4 text-primary shrink-0" />
                            <span class="flex-1 truncate">{{ att.filename }}</span>
                            <span class="text-xs text-muted">{{ formatBytes(att.size) }}</span>
                        </div>
                    </div>
                </div>
                
                <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />

                <div class="flex justify-between pt-2">
                    <UButton color="neutral" variant="ghost" leading-icon="i-lucide-arrow-left"
                        @click="step = 'params'">
                        Назад
                    </UButton>
                    <UButton leading-icon="i-lucide-send" :loading="loading" @click="handleLaunch">
                        Запустить рассылку
                    </UButton>
                </div>
            </div>

        </template>
    </UModal>
</template>

<script lang="ts" setup>
import type { AttachmentInfo, RequestResponse, RequestUpdate } from '#shared/types'

const props = defineProps<{ request?: RequestResponse | null }>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ launched: [] }>()

const { patch, post } = useApi()
const toast = useToast()

type Step = 'params' | 'confirm'
const step = ref<Step>('params')

const form = reactive({
    description: '',
    labels: [
        'Описание товара',
        'Общая стоимость без НДС',
        'Общая стоимость с НДС',
        'Цена за единицу без НДС',
        'Условия оплаты',
        'Сроки поставки',
        'Условия поставки',
        'Гарантия',
        'Наименование поставщика',
        'Резидентство поставщика (страна)',
        'ИНН / УНП',
    ] as string[],
    newLabel: '',
    emailMessage: '',
})

const filesToUpload = ref<File[]>([])
const uploadedAttachments = ref<AttachmentInfo[]>([])

const errors = reactive({ description: '' })
const loading = ref(false)
const loadingMessage = ref(false)
const error = ref<string | null>(null)

const { public: publicConfig } = useRuntimeConfig()
const MAX_UPLOAD_FILES = publicConfig.maxUploadFiles as number
const MAX_UPLOAD_SIZE = publicConfig.maxUploadSize as number

const uploadDescription = computed(() => {
    const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)
    return `Добавьте до ${MAX_UPLOAD_FILES} файлов (PDF, DOC/DOCX, XLS/XLSX, TXT, JPG/PNG/WEBP). Максимум ${MAX_UPLOAD_FILES} файла, до ${sizeMb} МБ каждый`
})

function loadFromRequest() {
    const r = props.request
    if (!r) return
    form.description = r.description || ''
    if (r.email_message) {
        const msg = r.email_message
        form.emailMessage = Array.isArray(msg) ? msg.join('\n') : String(msg)
    }
    const ap = r.additional_params
    if (ap && Array.isArray(ap) && ap.length > 0) {
        form.labels = [...ap]
    }
}

watch(() => isOpen.value, open => {
    if (open) { loadFromRequest(); step.value = 'params' }
    else { error.value = null; errors.description = '' }
}, { immediate: true })

watch(() => props.request, () => { if (isOpen.value) loadFromRequest() })

function addLabel() {
    if (!form.newLabel.trim()) return
    form.labels.push(form.newLabel.trim())
    form.newLabel = ''
}

function removeLabel(idx: number) { form.labels.splice(idx, 1) }

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Б'
    const k = 1024
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function handleFilesUpdate(newFiles: File[] | null | undefined) {
    let arr = newFiles ? [...newFiles] : []
    const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)

    let filtered = arr.filter((f) => {
        if (f.size > MAX_UPLOAD_SIZE) {
            toast.add({
                title: 'Файл слишком большой',
                description: `${f.name} превышает ${sizeMb} МБ`,
                color: 'error',
            })
            return false
        }
        return true
    })

    if (filtered.length > MAX_UPLOAD_FILES) {
        toast.add({
            title: `Максимум ${MAX_UPLOAD_FILES} файла`,
            description: 'Уже добавлено максимальное количество файлов',
            color: 'warning',
        })
        filtered = filtered.slice(0, MAX_UPLOAD_FILES)
    }

    filesToUpload.value = filtered
}

function close() { isOpen.value = false }

function validate() {
    errors.description = ''
    if (!form.description || form.description.trim().length < 3) {
        errors.description = 'Обязательное поле, минимум 3 символа'
        return false
    }
    return true
}

async function goToConfirm() {
    error.value = null
    if (!validate() || !props.request) return

    loadingMessage.value = true
    try {
        const body: RequestUpdate = {
            description: form.description,
            additional_params: form.labels.length > 0 ? form.labels : null,
        }
        await patch(`/requests/${props.request.id}`, body)

        if (filesToUpload.value.length > 0) {
            const uploadFormData = new FormData()
            for (const file of filesToUpload.value) {
                uploadFormData.append('files', file)
            }
            try {
                const uploaded = await post<AttachmentInfo[]>(`/requests/${props.request.id}/attachments`, uploadFormData)
                uploadedAttachments.value = uploaded
            } catch (uploadErr: any) {
                const detail = uploadErr?.response?.data?.detail
                error.value = typeof detail === 'string' ? detail : 'Ошибка при загрузке файлов'
                return
            }
        }

        const updated = await patch<RequestResponse>(`/requests/${props.request.id}/email_message`)

        if (updated?.email_message) {
            const msg = updated.email_message
            form.emailMessage = Array.isArray(msg) ? msg.join('\n') : String(msg)
        }

        step.value = 'confirm'
    } catch (e: any) {
        const detail = e?.response?.data?.detail
        error.value = typeof detail === 'string' ? detail : 'Ошибка при генерации письма'
    } finally {
        loadingMessage.value = false
    }
}

async function handleLaunch() {
    if (!props.request) return
    loading.value = true
    error.value = null
    try {
        if (form.emailMessage) {
            await patch(`/requests/${props.request.id}/email_message`, {
                email_message: form.emailMessage,
            })
        }

        await post(`/requests/${props.request.id}/launch`)

        emit('launched')
        toast.add({
            title: 'Рассылка запущена',
            description: 'Письма поставлены в очередь и отправляются поставщикам',
            color: 'success',
            icon: 'i-lucide-mail-check',
        })
        close()
        await navigateTo(`/requests/${props.request.id}/responses`)
    } catch (e: any) {
        const detail = e?.response?.data?.detail
        error.value = typeof detail === 'string' ? detail : 'Ошибка при запуске рассылки'
        step.value = 'params'
    } finally {
        loading.value = false
    }
}
</script>
