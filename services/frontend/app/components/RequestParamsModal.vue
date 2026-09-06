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
                <div class="flex items-center gap-2">
                    <USwitch
                        v-model="multiPosition"
                        label="Несколько позиций"
                    />
                    <UTooltip
                        :text="multiPositionHint"
                        :content="{ side: 'bottom', align: 'start', sideOffset: 8 }"
                    >
                        <button
                            type="button"
                            class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-elevated text-muted transition-colors hover:bg-accented hover:text-default cursor-pointer"
                            aria-label="О нескольких позициях"
                            @click.stop
                        >
                            <UIcon name="i-lucide-info" class="size-4" />
                        </button>
                    </UTooltip>
                </div>

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

                <template v-if="!multiPosition">
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
                </template>

                <template v-else>
                    <div class="space-y-3">
                        <div>
                            <p class="text-sm font-semibold text-default">
                                Описания позиций закупки
                            </p>
                            <p class="text-xs text-muted mt-0.5">
                                Укажите не менее двух позиций. Каждая позиция описывается отдельно.
                            </p>
                        </div>
                        <div
                            v-for="(_, idx) in form.positionDescriptions"
                            :key="idx"
                            class="flex items-start gap-2"
                        >
                            <UFormField
                                :label="`Описание позиции ${idx + 1}`"
                                required
                                class="flex-1 min-w-0"
                            >
                                <UTextarea
                                    v-model="form.positionDescriptions[idx]"
                                    :placeholder="positionPlaceholder(idx)"
                                    :rows="4"
                                    class="w-full"
                                    size="lg"
                                    :color="errors.positions[idx] ? 'error' : undefined"
                                    :highlight="Boolean(errors.positions[idx])"
                                />
                                <p
                                    v-if="errors.positions[idx]"
                                    class="text-xs text-error mt-1"
                                >
                                    {{ errors.positions[idx] }}
                                </p>
                            </UFormField>
                            <UButton
                                type="button"
                                variant="ghost"
                                color="neutral"
                                icon="i-lucide-trash-2"
                                size="lg"
                                class="mt-6 shrink-0"
                                :disabled="form.positionDescriptions.length <= MIN_POSITIONS"
                                :aria-label="`Удалить позицию ${idx + 1}`"
                                @click="removePosition(idx)"
                            />
                        </div>
                        <UButton
                            type="button"
                            variant="outline"
                            color="neutral"
                            leading-icon="i-lucide-plus"
                            size="sm"
                            :disabled="form.positionDescriptions.length >= MAX_POSITIONS"
                            @click="addPosition"
                        >
                            Добавить позицию
                        </UButton>
                        <p v-if="errors.description" class="text-xs text-error">
                            {{ errors.description }}
                        </p>
                    </div>
                </template>

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

const MIN_POSITIONS = 2
const MAX_POSITIONS = 8
const POSITION_MIN_LEN = 3
const DESCRIPTION_MAX_LEN = 8000

const multiPositionHint
    = "Если в письме нужно описать несколько позиций закупки, а не одну — включите режим. Каждая позиция описывается отдельно."

const DEFAULT_LABELS_SINGLE = [
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
] as const

const DEFAULT_LABELS_MULTI = [
    "Описание товара",
    "Общая цена поставки без НДС",
    "Общая стоимость с НДС",
    "Условия оплаты",
    "Сроки поставки",
    "Условия поставки",
    "Гарантия",
    "Наименование поставщика",
    "Резидентство поставщика (страна)",
    "ИНН / УНП",
] as const

const POSITION_PRICE_PREFIX = "Цена без НДС:"
const DELIVERY_TOTAL_LABEL = "Общая цена поставки без НДС"
const DELIVERY_TOTAL_ALIASES = new Set([
    DELIVERY_TOTAL_LABEL,
    "Общая цена поставки",
])
const POSITION_TITLE_MAX_WORDS = 5

const multiPosition = ref(false)
const labelsFromServer = ref(false)

function defaultLabels(multi: boolean): string[] {
    return [...(multi ? DEFAULT_LABELS_MULTI : DEFAULT_LABELS_SINGLE)]
}

function isPositionPriceLabel(label: string): boolean {
    return label.trim().startsWith(POSITION_PRICE_PREFIX)
}

function isDeliveryTotalLabel(label: string): boolean {
    return DELIVERY_TOTAL_ALIASES.has(label.trim())
}

function positionPriceLabelsFromParts(parts: string[]): string[] {
    return parts
        .map((text) => text.trim().split(/\r?\n/)[0]?.trim() ?? "")
        .filter(Boolean)
        .map((title) => {
            const short = title
                .split(/\s+/)
                .slice(0, POSITION_TITLE_MAX_WORDS)
                .join(" ")
                .replace(/[ .,;:]+$/u, "")
            return `${POSITION_PRICE_PREFIX} ${short}`
        })
}

/** Inject per-item VAT-free price rows; keep delivery total without VAT. */
function mergeMultiPositionPriceLabels(
    labels: string[],
    positionParts: string[],
): string[] {
    const perItem = positionPriceLabelsFromParts(positionParts)
    if (!perItem.length) return [...labels]

    const withoutStale = labels.filter(
        (item) => !isPositionPriceLabel(item) && !isDeliveryTotalLabel(item),
    )
    let insertAt = 0
    for (let i = 0; i < withoutStale.length; i++) {
        if (withoutStale[i] === "Описание товара") {
            insertAt = i + 1
            break
        }
    }
    return [
        ...withoutStale.slice(0, insertAt),
        ...perItem,
        DELIVERY_TOTAL_LABEL,
        ...withoutStale.slice(insertAt),
    ]
}

const form = reactive({
    description: "",
    positionDescriptions: ["", ""] as string[],
    labels: defaultLabels(false),
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

const errors = reactive({
    description: "",
    emailSubject: "",
    positions: [] as string[],
})
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

function positionPlaceholder(idx: number): string {
    const samples = [
        "Картонные коробки, объём, характеристики...",
        "Гофрокоробки, размеры, характеристики...",
    ]
    return samples[idx] ?? `Опишите позицию ${idx + 1}...`
}

function addPosition() {
    if (form.positionDescriptions.length >= MAX_POSITIONS) return
    form.positionDescriptions.push("")
    errors.positions.push("")
}

function removePosition(idx: number) {
    if (form.positionDescriptions.length <= MIN_POSITIONS) return
    form.positionDescriptions.splice(idx, 1)
    errors.positions.splice(idx, 1)
}

function joinPositionDescriptions(parts: string[]): string {
    return parts
        .map((text, idx) => `Позиция ${idx + 1}:\n${text.trim()}`)
        .join("\n\n")
}

function parsePositionDescriptions(raw: string): string[] | null {
    const text = raw.trim()
    if (!text) return null
    const matches = [...text.matchAll(/(?:^|\n)Позиция\s+(\d+):\s*\n?/gi)]
    if (matches.length < MIN_POSITIONS) return null
    const parts: string[] = []
    for (let i = 0; i < matches.length; i++) {
        const start = (matches[i].index ?? 0) + matches[i][0].length
        const end = i + 1 < matches.length
            ? (matches[i + 1].index ?? text.length)
            : text.length
        const chunk = text.slice(start, end).trim()
        if (chunk) parts.push(chunk)
    }
    return parts.length >= MIN_POSITIONS ? parts : null
}

function resolvedDescription(): string {
    if (!multiPosition.value) return form.description.trim()
    const parts = form.positionDescriptions
        .map((item) => item.trim())
        .filter(Boolean)
    return joinPositionDescriptions(parts)
}

watch(multiPosition, (enabled, wasEnabled) => {
    if (enabled === wasEnabled) return
    if (enabled && form.positionDescriptions.length < MIN_POSITIONS) {
        form.positionDescriptions = ["", ""]
        errors.positions = ["", ""]
    }
    if (!labelsFromServer.value) {
        form.labels = defaultLabels(enabled)
    }
})

function loadFromRequest() {
    const r = props.request
    if (!r) return
    const ap = r.additional_params
    labelsFromServer.value = Boolean(ap && Array.isArray(ap) && ap.length > 0)
    multiPosition.value = Boolean(r.is_multi_position)
    const parsed = r.is_multi_position && r.description
        ? parsePositionDescriptions(r.description)
        : null
    if (parsed) {
        form.positionDescriptions = parsed
        form.description = ""
        errors.positions = parsed.map(() => "")
    } else if (r.is_multi_position) {
        form.positionDescriptions = r.description
            ? [r.description, ""]
            : ["", ""]
        form.description = ""
        errors.positions = form.positionDescriptions.map(() => "")
    } else {
        form.description = r.description || ""
        form.positionDescriptions = ["", ""]
        errors.positions = ["", ""]
    }
    if (r.email_message) {
        const msg = r.email_message
        form.emailMessage = Array.isArray(msg) ? msg.join("\n") : String(msg)
    }
    if (labelsFromServer.value) {
        form.labels = [...(ap as string[])]
    } else {
        form.labels = defaultLabels(multiPosition.value)
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
            errors.positions = []
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
    errors.positions = form.positionDescriptions.map(() => "")

    if (multiPosition.value) {
        let ok = true
        const filledIdx: number[] = []
        form.positionDescriptions.forEach((item, idx) => {
            const value = item.trim()
            if (!value) return
            filledIdx.push(idx)
            if (value.length < POSITION_MIN_LEN) {
                errors.positions[idx] = `Минимум ${POSITION_MIN_LEN} символа`
                ok = false
            }
        })
        if (filledIdx.length < MIN_POSITIONS) {
            errors.description = `Укажите не менее ${MIN_POSITIONS} позиций`
            return false
        }
        if (!ok) return false
        const filled = filledIdx.map((idx) => form.positionDescriptions[idx].trim())
        const joined = joinPositionDescriptions(filled)
        if (joined.length > DESCRIPTION_MAX_LEN) {
            errors.description = `Суммарное описание не длиннее ${DESCRIPTION_MAX_LEN} символов`
            return false
        }
        return true
    }

    if (!form.description || form.description.trim().length < POSITION_MIN_LEN) {
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
        const description = resolvedDescription()
        let labels = [...form.labels]
        if (multiPosition.value) {
            const parts = form.positionDescriptions
                .map((item) => item.trim())
                .filter(Boolean)
            labels = mergeMultiPositionPriceLabels(labels, parts)
            form.labels = labels
        }
        const body: RequestUpdate = {
            description,
            additional_params: labels.length > 0 ? labels : null,
            is_multi_position: multiPosition.value,
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
