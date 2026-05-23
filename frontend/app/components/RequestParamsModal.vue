<template>
    <UModal v-model:open="isOpen" :title="step === 'params' ? 'Параметры письма поставщикам' : 'Подтверждение рассылки'"
        :description="step === 'params' ? 'Заполните описание и выберите что включить в письмо' : 'Проверьте данные перед отправкой'"
        :ui="{ content: step === 'params' ? 'max-w-3xl' : 'max-w-lg' }">
        <template #body>

            <div v-if="step === 'params'">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    <div class="space-y-4">
                        <UFormField label="Описание товара/услуги" required>
                            <UTextarea v-model="form.description"
                                placeholder="Опишите детально товар или услугу, технические характеристики, объёмы..."
                                :rows="6" class="w-full" size="lg"
                                :class="errors.description ? 'ring-2 ring-error rounded-lg' : ''" />
                            <p v-if="errors.description" class="text-xs text-error mt-1">{{ errors.description }}</p>
                        </UFormField>
                    </div>

                    <div>
                        <p class="text-sm font-semibold mb-1">Запросить у поставщика</p>
                        <p class="text-xs text-muted mb-3">Выбранные поля будут добавлены в письмо</p>
                        <div class="space-y-1">
                            <div v-for="field in standardFields" :key="field.key"
                                class="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-elevated/50 transition-colors">
                                <label class="text-sm cursor-pointer">{{ field.label }}</label>
                                <USwitch :model-value="form.included_fields.includes(field.key)" size="sm"
                                    @update:model-value="(val: boolean) => toggleField(field.key, val)" />
                            </div>
                            <div v-for="(p, idx) in form.custom_params" :key="idx"
                                class="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-elevated/50 transition-colors">
                                <span class="text-sm truncate">
                                    <span class="font-medium">{{ p.label }}:</span>
                                    <span class="text-muted ml-1">{{ p.value }}</span>
                                </span>
                                <UButton icon="i-lucide-x" size="xs" variant="ghost" color="neutral"
                                    class="shrink-0 ml-2" @click="removeCustom(idx)" />
                            </div>
                        </div>

                        <div class="flex gap-2 mt-3">
                            <UInput v-model="form.newLabel" placeholder="Название" class="flex-1" size="sm"
                                @keyup.enter="addCustom" />
                            <UInput v-model="form.newValue" placeholder="Значение" class="flex-1" size="sm"
                                @keyup.enter="addCustom" />
                            <UButton icon="i-lucide-plus" size="sm" variant="soft"
                                :disabled="!form.newLabel || !form.newValue" @click="addCustom" />
                        </div>
                    </div>
                </div>

                <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error"
                    class="mt-4" />

                <div class="flex justify-end gap-2 pt-6">
                    <UButton color="neutral" variant="ghost" @click="close">Отмена</UButton>
                    <UButton leading-icon="i-lucide-arrow-right" @click="goToConfirm">
                        Далее
                    </UButton>
                </div>
            </div>

            <div v-else-if="step === 'confirm'" class="space-y-4">
                <div class="rounded-xl bg-elevated p-4 space-y-3 text-sm">

                    <div class="flex gap-2">
                        <span class="text-muted w-36 shrink-0">Описание</span>
                        <span class="font-medium">{{ form.description }}</span>
                    </div>

                    <USeparator />

                    <div class="flex gap-2">
                        <span class="text-muted w-36 shrink-0">Запрашиваем</span>
                        <div class="flex flex-wrap gap-1">
                            <UBadge v-for="key in form.included_fields" :key="key" variant="subtle" color="neutral"
                                size="sm">
                                {{ fieldLabel(key) }}
                            </UBadge>
                            <UBadge v-for="p in form.custom_params" :key="p.label" variant="subtle" color="primary"
                                size="sm">
                                {{ p.label }}: {{ p.value }}
                            </UBadge>
                        </div>
                    </div>

                </div>

                <UAlert color="info" variant="soft" icon="i-lucide-info"
                    description="После запуска письма поставлены в очередь и будут отправлены автоматически. Ответы появятся в разделе «Ответы поставщиков»." />

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
import type { RequestResponse } from '#shared/types'

const props = defineProps<{ request?: RequestResponse | null }>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ launched: [] }>()

const { patch, post } = useApi()
const toast = useToast()

type Step = 'params' | 'confirm'
const step = ref<Step>('params')

const standardFields = [
    { key: 'description', label: 'Описание товара' },
    { key: 'total_price_no_vat', label: 'Общая стоимость без НДС' },
    { key: 'total_price_vat', label: 'Общая стоимость с НДС' },
    { key: 'price_per_unit', label: 'Цена за единицу без НДС' },
    { key: 'payment_terms', label: 'Условия оплаты' },
    { key: 'delivery_deadline', label: 'Сроки поставки' },
    { key: 'delivery_terms', label: 'Условия поставки' },
    { key: 'warranty', label: 'Гарантия' },
    { key: 'company_name', label: 'Наименование поставщика' },
    { key: 'residency', label: 'Резидентство поставщика' },
    { key: 'tax_id', label: 'ИНН / УНП' },
] as const

const ALL_FIELD_LABELS: Record<string, string> = {
    delivery_region: 'Регион поставки',
    description: 'Описание товара',
    total_price_no_vat: 'Общая стоимость без НДС',
    total_price_vat: 'Общая стоимость с НДС',
    price_per_unit: 'Цена за единицу без НДС',
    payment_terms: 'Условия оплаты',
    delivery_deadline: 'Сроки поставки',
    delivery_terms: 'Условия поставки',
    warranty: 'Гарантия',
    company_name: 'Наименование поставщика',
    residency: 'Резидентство поставщика',
    tax_id: 'ИНН / УНП',
}

function fieldLabel(key: string): string {
    return ALL_FIELD_LABELS[key] ?? key
}

const form = reactive({
    description: '',
    included_fields: [
        'description', 'total_price_no_vat', 'total_price_vat',
        'price_per_unit', 'payment_terms', 'delivery_deadline',
        'company_name', 'tax_id',
    ] as string[],
    custom_params: [] as { label: string; value: string }[],
    newLabel: '',
    newValue: '',
})

const errors = reactive({ description: '' })
const loading = ref(false)
const error = ref<string | null>(null)

function loadFromRequest() {
    const r = props.request
    if (!r) return
    form.description = r.description || ''
    const ap = r.additional_params
    if (ap) {
        form.included_fields = [...(ap.included_fields || [])]
        form.custom_params = [...(ap.custom_params || [])]
    }
}

watch(() => isOpen.value, open => {
    if (open) { loadFromRequest(); step.value = 'params' }
    else { error.value = null; errors.description = '' }
}, { immediate: true })

watch(() => props.request, () => { if (isOpen.value) loadFromRequest() })

function toggleField(key: string, val: boolean) {
    if (val) {
        if (!form.included_fields.includes(key)) form.included_fields.push(key)
    } else {
        form.included_fields = form.included_fields.filter(k => k !== key)
    }
}

function addCustom() {
    if (!form.newLabel.trim() || !form.newValue.trim()) return
    form.custom_params.push({ label: form.newLabel.trim(), value: form.newValue.trim() })
    form.newLabel = ''
    form.newValue = ''
}

function removeCustom(idx: number) { form.custom_params.splice(idx, 1) }

function close() { isOpen.value = false }

function validate() {
    errors.description = ''
    let ok = true
    if (!form.description || form.description.trim().length < 3) {
        errors.description = 'Обязательное поле, минимум 3 символа'
        ok = false
    }
    return ok
}

function goToConfirm() {
    error.value = null
    if (!validate()) return
    step.value = 'confirm'
}

async function handleLaunch() {
    if (!props.request) return
    loading.value = true
    error.value = null
    try {
        await patch(`/requests/${props.request.id}`, {
            description: form.description,
            additional_params: {
                included_fields: form.included_fields,
                custom_params: form.custom_params,
            },
        })

        await post(`/requests/${props.request.id}/launch`)

        toast.add({
            title: 'Рассылка запущена',
            description: 'Письма поставлены в очередь и отправляются поставщикам',
            color: 'success',
            icon: 'i-lucide-mail-check',
        })

        emit('launched')
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
