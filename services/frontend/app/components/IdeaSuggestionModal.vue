<template>
	<UModal v-model:open="isOpen" :ui="{ content: 'max-w-lg' }">
		<template #header>
			<div class="flex items-center gap-2.5">
				<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
					<UIcon name="i-lucide-lightbulb" class="w-4 h-4 text-primary" />
				</div>
				<div>
					<p class="font-semibold text-highlighted">Предложить идею</p>
					<p class="text-xs text-muted">Поделитесь идеей по улучшению сервиса</p>
				</div>
			</div>
		</template>

		<template #body>
			<div class="space-y-4">
				<UFormField label="Ваша идея">
					<UTextarea
						v-model="message"
						:rows="5"
						class="w-full"
						placeholder="Опишите идею, которую хотите предложить..."
						:disabled="submitting"
					/>
				</UFormField>

				<UAlert
					v-if="error"
					color="error"
					variant="soft"
					icon="i-lucide-circle-alert"
					:description="error"
				/>

				<UAlert
					v-if="success"
					color="success"
					variant="soft"
					icon="i-lucide-check"
					description="Идея отправлена. Спасибо!"
				/>

				<div class="flex justify-end gap-2 pt-2">
					<UButton color="neutral" variant="outline" :disabled="submitting" @click="close">
						Отмена
					</UButton>
					<UButton
						:loading="submitting"
						:disabled="!message.trim()"
						leading-icon="i-lucide-send"
						@click="submit"
					>
						Отправить
					</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import { getApiErrorDetail } from '#shared/utils/apiError'

const isOpen = defineModel<boolean>('open', { default: false })

const { post } = useApi()

const message = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

function close() {
	isOpen.value = false
}

watch(isOpen, (val) => {
	if (!val) {
		message.value = ''
		error.value = null
		success.value = false
	}
})

async function submit() {
	if (!message.value.trim() || submitting.value) return
	submitting.value = true
	error.value = null
	success.value = false
	try {
		await post('/feedback/ideas', { message: message.value.trim() })
		success.value = true
		message.value = ''
		setTimeout(() => {
			isOpen.value = false
		}, 1500)
	} catch (e: unknown) {
		error.value = getApiErrorDetail(e) ?? 'Не удалось отправить идею'
	} finally {
		submitting.value = false
	}
}
</script>
