<template>
  <UModal v-model:open="isOpen" title="Параметры письма поставщикам"
    description="Заполните описание и выберите что включить в письмо" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div class="space-y-4">
          <UFormField label="Описание товара/услуги" required>
            <UTextarea v-model="form.description"
              placeholder="Опишите детально товар или услугу, технические характеристики, объёмы..." :rows="6"
              class="w-full" size="lg" :class="errors.description ? 'ring-2 ring-error rounded-lg' : ''" />
            <p v-if="errors.description" class="text-xs text-error mt-1">{{ errors.description }}</p>
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Валюта">
              <UInput v-model="form.currency" placeholder="BYN" class="w-full" />
            </UFormField>

            <UFormField label="Срок поставки">
              <UInput v-model="form.delivery_deadline" type="datetime-local" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <p class="text-sm font-semibold mb-1">Запросить у поставщика</p>
            <p class="text-xs text-muted mb-3">Выбранные поля будут добавлены в письмо</p>
            <div class="space-y-1">
              <div v-for="field in standardFields" :key="field.key"
                class="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-elevated/50 transition-colors">
                <label class="text-sm cursor-pointer">{{ field.label }}</label>
                <USwitch :model-value="form.included_fields.includes(field.key)" size="sm"
                  @update:model-value="val => toggleField(field.key, val)" />
              </div>
            </div>
          </div>

          <USeparator />

          <div>
            <p class="text-sm font-semibold mb-2">Свои параметры</p>
            <div class="flex gap-2 mb-2">
              <UInput v-model="form.newLabel" placeholder="Параметр" class="flex-1" size="sm"
                @keyup.enter="addCustom" />
              <UInput v-model="form.newValue" placeholder="Значение" class="flex-1" size="sm"
                @keyup.enter="addCustom" />
              <UButton icon="i-lucide-plus" size="sm" variant="soft" :disabled="!form.newLabel || !form.newValue"
                @click="addCustom" />
            </div>

            <div v-if="form.custom_params.length" class="space-y-1">
              <div v-for="(p, idx) in form.custom_params" :key="idx"
                class="flex items-center justify-between rounded-lg bg-elevated px-3 py-2 text-sm">
                <span class="truncate">
                  <span class="font-medium">{{ p.label }}:</span>
                  <span class="text-muted ml-1">{{ p.value }}</span>
                </span>
                <UButton icon="i-lucide-x" size="xs" variant="ghost" color="neutral" class="shrink-0 ml-2"
                  @click="removeCustom(idx)" />
              </div>
            </div>
            <p v-else class="text-xs text-muted italic">Нет дополнительных параметров</p>
          </div>
        </div>
      </div>

      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error"
        class="mt-4" />

      <div class="flex justify-end gap-2 pt-6">
        <UButton color="neutral" variant="ghost" @click="close">Отмена</UButton>
        <UButton leading-icon="i-lucide-send" :loading="loading" @click="handleSaveAndLaunch">
          Сохранить и запустить рассылку
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
import type { RequestResponse } from '#shared/types'

const props = defineProps<{
  request?: RequestResponse | null
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ launched: [] }>()

const { patch, post } = useApi()

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

const form = reactive({
  description: '',
  currency: 'BYN',
  delivery_deadline: '',
  included_fields: ['description', 'total_price_no_vat', 'total_price_vat', 'price_per_unit', 'payment_terms', 'delivery_deadline', 'company_name', 'tax_id'] as string[],
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
  form.currency = r.currency || 'BYN'
  form.delivery_deadline = r.delivery_deadline ? r.delivery_deadline.slice(0, 16) : ''
  const ap = r.additional_params
  if (ap) {
    form.included_fields = [...(ap.included_fields || [])]
    form.custom_params = [...(ap.custom_params || [])]
  }
}

watch(() => isOpen.value, open => {
  if (open) loadFromRequest()
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
  if (!form.description || form.description.trim().length < 3) {
    errors.description = 'Описание обязательно (минимум 3 символа)'
    return false
  }
  return true
}

async function handleSaveAndLaunch() {
  if (!validate() || !props.request) return
  loading.value = true
  error.value = null
  try {
    await patch(`/requests/${props.request.id}`, {
      description: form.description,
      currency: form.currency || null,
      delivery_deadline: form.delivery_deadline || null,
      additional_params: {
        included_fields: form.included_fields,
        custom_params: form.custom_params,
      },
    })

    await post(`/requests/${props.request.id}/launch`)

    emit('launched')
    close()
  } catch (e: any) {
    const detail = e.response?.data?.detail
    error.value = typeof detail === 'string' ? detail : 'Ошибка при сохранении или запуске рассылки'
  } finally {
    loading.value = false
  }
}
</script>
