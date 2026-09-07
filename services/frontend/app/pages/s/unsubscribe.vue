<template>
	<UContainer class="py-10 sm:py-16">
		<div class="mx-auto max-w-lg">
			<div class="mb-6 text-center">
				<h1 class="text-2xl font-bold text-highlighted sm:text-3xl">
					Больше не присылать
				</h1>
				<p class="mt-2 text-sm text-muted">
					Этот адрес больше не будет получать запросы через TenderOptima.
				</p>
			</div>

			<UCard class="shadow-sm">
				<div v-if="loading" class="space-y-3">
					<USkeleton class="h-10 w-full rounded-md" />
					<USkeleton class="h-12 w-full rounded-md" />
				</div>

				<UAlert
					v-else-if="loadError"
					color="error"
					variant="soft"
					icon="i-lucide-circle-alert"
					:description="loadError"
				/>

				<div v-else-if="done || alreadyUnsubscribed" class="space-y-3 text-center">
					<UIcon name="i-lucide-circle-check" class="mx-auto size-10 text-primary" />
					<p class="font-medium text-highlighted">Адрес исключён</p>
					<p class="text-sm text-muted">
						{{ preference?.email }} больше не будет получать запросы.
					</p>
				</div>

				<div v-else class="space-y-4">
					<UFormField label="Email">
						<UInput :model-value="preference?.email ?? ''" disabled icon="i-lucide-mail" class="w-full" />
					</UFormField>

					<UAlert
						v-if="submitError"
						color="error"
						variant="soft"
						icon="i-lucide-circle-alert"
						:description="submitError"
					/>

					<UButton
						block
						size="lg"
						color="neutral"
						leading-icon="i-lucide-mail-x"
						:loading="submitting"
						@click="confirmUnsubscribe"
					>
						Исключить этот адрес
					</UButton>
				</div>
			</UCard>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { SupplierEmailPreference, SupplierEmailPreferenceAction } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Больше не присылать — TenderOptima',
	description: 'Отписка от запросов коммерческих предложений TenderOptima.',
})

const route = useRoute()
const { get, post } = useApi()

const token = computed(() => {
	const raw = route.query.token
	return typeof raw === 'string' ? raw : ''
})

const preference = ref<SupplierEmailPreference | null>(null)
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const submitError = ref('')
const done = ref(false)

const alreadyUnsubscribed = computed(
	() => preference.value?.status === 'unsubscribed',
)

async function loadPreference() {
	if (!token.value) {
		loadError.value = 'В ссылке нет токена. Откройте письмо и перейдите по ссылке ещё раз.'
		loading.value = false
		return
	}
	loading.value = true
	loadError.value = ''
	try {
		preference.value = await get<SupplierEmailPreference>('/supplier-preferences/', {
			params: { token: token.value },
		})
	}
	catch (e: unknown) {
		loadError.value = getApiErrorDetail(e) ?? 'Недействительная или устаревшая ссылка.'
	}
	finally {
		loading.value = false
	}
}

async function confirmUnsubscribe() {
	if (submitting.value) return
	submitting.value = true
	submitError.value = ''
	try {
		await post<SupplierEmailPreferenceAction>('/supplier-preferences/unsubscribe', {
			token: token.value,
		})
		done.value = true
	}
	catch (e: unknown) {
		submitError.value = getApiErrorDetail(e) ?? 'Не удалось исключить адрес.'
	}
	finally {
		submitting.value = false
	}
}

onMounted(() => {
	void loadPreference()
})
</script>
