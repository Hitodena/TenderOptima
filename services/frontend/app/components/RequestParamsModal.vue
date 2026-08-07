<template>
    <UModal v-model:open="isOpen" :ui="EMAIL_LETTER_MODAL_UI">
        <template #header>
            <div class="min-w-0">
                <p class="text-lg font-semibold text-highlighted">
                    {{ step === 'params'
                        ? 'Параметры письма поставщикам'
                        : 'Редактирование письма'
                    }}
                </p>
                <p class="text-sm text-muted mt-0.5">
                    {{ step === 'params'
                        ? 'Заполните описание и укажите дополнительные параметры'
                        : 'Проверьте и отредактируйте письмо перед отправкой'
                    }}
                </p>
            </div>
        </template>
        <template #body>
            <div v-if="step === 'params'" class="space-y-6">
                <UFormField label="Тема письма" :required="false">
                    <UInput
                        v-model="form.emailSubject"
                        placeholder="Запрос коммерческого предложения — ..."
                        class="w-full"
                        size="lg"
                        :color="errors.emailSubject ? 'error' : undefined"
                        :highlight="Boolean(errors.emailSubject)"
                        maxlength="255"
                    />
                    <p v-if="errors.emailSubject" class="text-xs text-error mt-1">{{ errors.emailSubject }}</p>
                </UFormField>

                <UFormField label="Описание товара/услуги" required>
                    <UTextarea
                        v-model="form.description"
                        placeholder="Опишите детально товар или услугу, технические характеристики, объёмы..."
                        :rows="6"
                        class="w-full"
                        size="lg"
                        :color="errors.description ? 'error' : undefined"
                        :highlight="Boolean(errors.description)"
                    />
                    <p v-if="errors.description" class="text-xs text-error mt-1">
                        {{ errors.description }}
                    </p>
                </UFormField>

                <div>
                    <p class="text-sm font-semibold mb-1">Дополнительные параметры</p>
                    <p class="text-xs text-muted mb-2">
                        Укажите, что должен указать поставщик в ответе
                    </p>

                    <div>
                        <div class="flex flex-wrap gap-1.5 mb-3 min-h-8">
                            <UBadge
                                v-for="(label, idx) in form.labels"
                                :key="idx"
                                size="md"
                                variant="soft"
                                color="primary"
                                class="gap-1.5 pr-1 cursor-default"
                            >
                                {{ label }}
                                <button
                                    type="button"
                                    class="ml-0.5 text-primary/60 hover:text-error transition-colors"
                                    @click="removeLabel(idx)"
                                >
                                    <UIcon name="i-lucide-x" class="w-3 h-3" />
                                </button>
                            </UBadge>
                            <span
                                v-if="!form.labels.length"
                                class="text-xs text-muted italic self-center"
                            >
                                Нет параметров
                            </span>
                        </div>

                        <div class="flex gap-2">
                            <UInput
                                v-model="form.newLabel"
                                placeholder="Требование (цена, сроки, условия...)"
                                class="flex-1"
                                size="lg"
                                @keyup.enter="addLabel"
                            />
                            <UButton
                                icon="i-lucide-plus"
                                variant="outline"
                                color="neutral"
                                size="lg"
                                :disabled="!form.newLabel.trim()"
                                @click="addLabel"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <p class="text-sm font-semibold mb-1">Визитная карточка</p>
                    <p class="text-xs text-muted mb-2">
                        Добавляется в конце письма.
                    </p>
                    <p class="mb-3 text-xs leading-relaxed text-muted">
                        <UIcon name="i-lucide-info" class="mr-1 inline size-3.5 align-[-2px] text-primary" />
                        {{ t('requests.businessCardModalHint') }}
                    </p>
                    <UAlert
                        v-if="showBusinessCardWarning"
                        color="warning"
                        variant="soft"
                        icon="i-lucide-triangle-alert"
                        class="mb-3"
                        :title="t('requests.businessCardModalWarnTitle')"
                        :description="t('requests.businessCardModalWarnBody')"
                    />
                    <UTextarea
                        v-model="form.businessInfo"
                        :placeholder="t('profile.businessCardPlaceholder')"
                        :rows="showBusinessCardWarning ? 8 : 4"
                        class="w-full"
                        :color="showBusinessCardWarning ? 'warning' : undefined"
                        :highlight="showBusinessCardWarning"
                    />
                    <div
                        v-if="showBusinessCardWarning"
                        class="mt-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5"
                    >
                        <p class="text-xs font-semibold text-warning mb-1.5">
                            {{ t('requests.businessCardModalExampleLabel') }}
                        </p>
                        <pre class="text-xs text-muted whitespace-pre-wrap font-sans leading-relaxed">{{ t('profile.businessCardPlaceholder') }}</pre>
                    </div>
                </div>

                <div>
                    <p class="text-sm font-semibold mb-1">Вложения</p>
                    <p class="text-xs text-muted mb-2">{{ uploadDescription }}</p>
                    <UFileUpload
                        :model-value="filesToUpload"
                        multiple
                        accept=".pdf,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
                        :interactive="false"
                        layout="list"
                        class="w-full"
                        @update:model-value="handleFilesUpdate"
                    >
                        <template #actions="{ open }">
                            <UButton type="button" variant="outline" size="sm" @click="open()">
                                <UIcon name="i-lucide-paperclip" class="w-4 h-4" />
                                Выбрать файлы
                            </UButton>
                        </template>
                    </UFileUpload>
                </div>

                <UAlert
                    v-if="error"
                    color="error"
                    variant="soft"
                    icon="i-lucide-circle-alert"
                    :description="error"
                />
            </div>

            <div v-else-if="step === 'confirm'" class="space-y-4">
                <UAlert
                    v-if="props.supplierCount"
                    color="info"
                    variant="soft"
                    icon="i-lucide-info"
                    :description="`Запрос будет отправлен на ${props.supplierCount} ${pluralizeSuppliers(props.supplierCount ?? 0)}`"
                />

                <UAlert
                    v-if="emailQuotaConfirmHint"
                    color="warning"
                    variant="soft"
                    icon="i-lucide-mail"
                    :description="emailQuotaConfirmHint"
                />

                <div class="flex items-center gap-2 text-sm text-muted">
                    Письмо сформировано на основе ваших параметров. Вы можете
                    отредактировать текст перед отправкой.
                </div>

                <div>
                    <p class="text-sm font-semibold mb-1">Тема письма</p>
                    <p class="text-xs text-muted mb-3">Будет использована как тема email. Изменения сохранятся.</p>
                    <UInput v-model="form.emailSubject" class="w-full font-medium" size="lg" maxlength="255" />
                </div>

                <div>
                    <p class="text-sm font-semibold mb-1">Тело письма</p>
                    <UTextarea
                        v-model="form.emailMessage"
                        :rows="20"
                        class="w-full font-mono text-sm"
                        placeholder="Текст письма загружается..."
                    />
                </div>

                <div v-if="uploadedAttachments.length > 0">
                    <p class="text-sm font-semibold mb-2">
                        Вложения ({{ uploadedAttachments.length }}/2)
                    </p>
                    <div class="space-y-2">
                        <div
                            v-for="(att, idx) in uploadedAttachments"
                            :key="idx"
                            class="flex items-center gap-2 text-sm p-2 bg-elevated/50 rounded-lg"
                        >
                            <UIcon name="i-lucide-paperclip" class="w-4 h-4 text-primary shrink-0" />
                            <span class="flex-1 truncate">{{ att.filename }}</span>
                            <span class="text-xs text-muted">{{
                                formatBytes(att.size)
                            }}</span>
                        </div>
                    </div>
                </div>

                <UAlert
                    v-if="error"
                    color="error"
                    variant="soft"
                    icon="i-lucide-circle-alert"
                    :description="error"
                />
            </div>
        </template>
        <template #footer>
            <div v-if="step === 'params'" :class="EMAIL_LETTER_MODAL_FOOTER_CLASS">
                <UButton color="neutral" variant="ghost" @click="close">
                    Отмена
                </UButton>
                <UButton
                    leading-icon="i-lucide-arrow-right"
                    :loading="loadingMessage"
                    @click="goToConfirm"
                >
                    Далее
                </UButton>
            </div>
            <div v-else-if="step === 'confirm'" :class="EMAIL_LETTER_MODAL_FOOTER_CLASS">
                <UButton
                    color="neutral"
                    variant="ghost"
                    leading-icon="i-lucide-arrow-left"
                    @click="step = 'params'"
                >
                    Назад
                </UButton>
                <UButton leading-icon="i-lucide-send" :loading="loading" @click="handleLaunch">
                    Запустить рассылку
                </UButton>
            </div>
        </template>
    </UModal>
</template>

<script lang="ts" setup>
import type {
    AttachmentInfo,
    RequestResponse,
    RequestUpdate,
    SubscriptionResponse,
    UserResponse,
    UserUpdate,
} from "#shared/types"
import {
    EMAIL_LETTER_MODAL_FOOTER_CLASS,
    EMAIL_LETTER_MODAL_UI,
} from "#shared/constants/emailModal"
import { getApiErrorDetail } from "#shared/utils/apiError"
import { pluralizeSuppliers } from "#shared/utils/textFormat"
import { emailQuotaBlockMessage, emailQuotaRemaining, effectiveEmailLimit } from "#shared/utils/subscriptionAccess"
import { t } from "~/constants/translations"

const props = defineProps<{
    request?: RequestResponse | null
    supplierCount?: number
    subscription?: SubscriptionResponse | null
    isFirstRequest?: boolean
}>()
const isOpen = defineModel<boolean>("open", { default: false })
const emit = defineEmits<{ launched: [] }>()

const { patch, post, get } = useApi()
const toast = useToast()

type Step = "params" | "confirm"
const step = ref<Step>("params")

const form = reactive({
    description: "",
    labels: [
        "Описание товара",
        "Общая стоимость без НДС",
        "Общая стоимость с НДС",
        "Цена за единицу без НДС",
        "Условия оплаты",
        "Сроки поставки",
        "Условия поставки",
        "Гарантия",
        "Наименование поставщика",
        "Резидентство поставщика (страна)",
        "ИНН / УНП",
    ] as string[],
    newLabel: "",
    emailMessage: "",
    businessInfo: "",
    emailSubject: "",
})

const originalBusinessInfo = ref("")

function hasCompleteBusinessRequisites(text: string): boolean {
    const value = text.trim()
    if (!value) return false
    const hasLegalId = /УНП|ИНН|БИН/i.test(value)
    const hasContact = /Адрес|Тел\.?|Телефон|\+\d/i.test(value)
    return hasLegalId && hasContact
}

const showBusinessCardWarning = computed(() => {
    if (hasCompleteBusinessRequisites(form.businessInfo)) return false
    if (!form.businessInfo.trim()) return true
    return Boolean(props.isFirstRequest ?? props.request?.is_first_request)
})

const filesToUpload = ref<File[]>([])
const uploadedAttachments = ref<AttachmentInfo[]>([])

const errors = reactive({ description: "", emailSubject: "" })
const loading = ref(false)
const loadingMessage = ref(false)
const error = ref<string | null>(null)

const { public: publicConfig } = useRuntimeConfig()
const MAX_UPLOAD_FILES = publicConfig.maxUploadFiles as number
const MAX_UPLOAD_SIZE = publicConfig.maxRequestUploadSize as number

const uploadDescription = computed(() => {
    const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)
    return `До ${MAX_UPLOAD_FILES} файлов (PDF, DOCX, XLS/XLSX, TXT, JPG/PNG/WEBP), до ${sizeMb} МБ каждый`
})

const emailQuotaConfirmHint = computed(() => {
    const sub = props.subscription
    const limit = effectiveEmailLimit(sub)
    if (limit == null) return null
    const remaining = emailQuotaRemaining(sub)
    if (remaining == null) return null
    return `Остаток лимита писем в этом месяце: ${remaining.toLocaleString("ru-RU")} из ${limit.toLocaleString("ru-RU")}`
})

function loadFromRequest() {
    const r = props.request
    if (!r) return
    form.description = r.description || ""
    if (r.email_message) {
        const msg = r.email_message
        form.emailMessage = Array.isArray(msg) ? msg.join("\n") : String(msg)
    }
    const ap = r.additional_params
    if (ap && Array.isArray(ap) && ap.length > 0) {
        form.labels = [...ap]
    }
    const defaultSubject = r.query ? `Запрос коммерческого предложения — ${r.query}` : ""
    form.emailSubject = r.email_subject || defaultSubject
}

async function loadBusinessInfo() {
    try {
        const user = await get<UserResponse>("/auth/me")
        const val = user.business_info ?? ""
        form.businessInfo = val
        originalBusinessInfo.value = val
    } catch {
        // business info is optional for the modal
    }
}

watch(
    () => isOpen.value,
    async (open) => {
        if (open) {
            loadFromRequest()
            step.value = "params"
            await loadBusinessInfo()
        } else {
            error.value = null
            errors.description = ""
            errors.emailSubject = ""
        }
    },
    { immediate: true },
)

watch(
    () => props.request,
    () => {
        if (isOpen.value) loadFromRequest()
    },
)

function addLabel() {
    if (!form.newLabel.trim()) return
    form.labels.push(form.newLabel.trim())
    form.newLabel = ""
}

function removeLabel(idx: number) {
    form.labels.splice(idx, 1)
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Б"
    const k = 1024
    const sizes = ["Б", "КБ", "МБ", "ГБ"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function handleFilesUpdate(newFiles: File[] | null | undefined) {
    const arr = newFiles ? [...newFiles] : []
    const sizeMb = Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)

    let filtered = arr.filter((f) => {
        if (f.size > MAX_UPLOAD_SIZE) {
            toast.add({
                title: "Файл слишком большой",
                description: `${f.name} превышает ${sizeMb} МБ`,
                color: "error",
            })
            return false
        }
        return true
    })

    if (filtered.length > MAX_UPLOAD_FILES) {
        toast.add({
            title: `Максимум ${MAX_UPLOAD_FILES} файла`,
            description: "Уже добавлено максимальное количество файлов",
            color: "warning",
        })
        filtered = filtered.slice(0, MAX_UPLOAD_FILES)
    }

    filesToUpload.value = filtered
}

function close() {
    isOpen.value = false
}

function validate() {
    errors.description = ""
    errors.emailSubject = ""
    if (!form.description || form.description.trim().length < 3) {
        errors.description = "Обязательное поле, минимум 3 символа"
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

        if (form.businessInfo !== originalBusinessInfo.value) {
            const userPayload: UserUpdate = {
                business_info: form.businessInfo || null,
            }
            await patch("/auth/me", userPayload)
            originalBusinessInfo.value = form.businessInfo
        }

        if (filesToUpload.value.length > 0) {
            const uploadFormData = new FormData()
            for (const file of filesToUpload.value) {
                uploadFormData.append("files", file)
            }
            try {
                const uploaded = await post<AttachmentInfo[]>(
                    `/requests/${props.request.id}/attachments`,
                    uploadFormData,
                )
                uploadedAttachments.value = uploaded
            } catch (uploadErr: unknown) {
                error.value = getApiErrorDetail(uploadErr) ?? "Ошибка при загрузке файлов"
                return
            }
        }

        const updated = await patch<RequestResponse>(
            `/requests/${props.request.id}/email_message`,
            { email_subject: form.emailSubject || null },
        )

        if (updated?.email_message) {
            const msg = updated.email_message
            form.emailMessage = Array.isArray(msg) ? msg.join("\n") : String(msg)
        }

        step.value = "confirm"
    } catch (e: unknown) {
        error.value = getApiErrorDetail(e) ?? "Ошибка при генерации письма"
    } finally {
        loadingMessage.value = false
    }
}

async function handleLaunch() {
    if (!props.request) return
    const quotaMsg = emailQuotaBlockMessage(
        props.subscription,
        props.supplierCount ?? 1,
    )
    if (quotaMsg) {
        error.value = quotaMsg
        return
    }
    loading.value = true
    error.value = null
    try {
        const emailPayload: {
            email_subject: string | null
            email_message?: string
        } = { email_subject: form.emailSubject || null }
        if (form.emailMessage) emailPayload.email_message = form.emailMessage
        await patch(`/requests/${props.request.id}/email_message`, emailPayload)

        await post(`/requests/${props.request.id}/launch`)

        emit("launched")
        toast.add({
            title: "Рассылка запущена",
            description: "Письма поставлены в очередь и отправляются поставщикам",
            color: "success",
            icon: "i-lucide-mail-check",
        })
        close()
        await navigateTo(`/requests/${props.request.id}/responses`)
    } catch (e: unknown) {
        error.value = getApiErrorDetail(e) ?? "Ошибка при запуске рассылки"
        step.value = "params"
    } finally {
        loading.value = false
    }
}
</script>
