<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">
			<div class="mb-12">
				<div class="text-center mb-6">
					<h1 class="text-3xl font-bold text-highlighted mb-2">Анализ технических предложений</h1>
					<p class="text-muted text-sm">
						Сравните техническое задание с коммерческим предложением поставщика
					</p>
				</div>

				<UAlert
					v-if="isTestPlan(user?.subscription)"
					color="info"
					variant="soft"
					icon="i-lucide-info"
					title="Лимит загрузки по подписке"
					:description="uploadLimitHint"
					class="mb-4"
				/>

				<UAlert
					v-if="pagesRemainingLabel"
					color="primary"
					variant="soft"
					icon="i-lucide-file-stack"
					:description="pagesRemainingLabel"
					class="mb-4"
				/>

				<div class="flex justify-end mb-4">
					<UButton
to="/tz-analysis/history" size="lg" variant="outline" color="neutral"
						leading-icon="i-lucide-history">
						История анализов
					</UButton>
				</div>

				<UCard class="shadow-sm mb-4">
					<UForm :schema="schema" :state="form" class="space-y-5" @submit="handleCreate">
						<UAlert
							v-if="module2BlockReason"
							color="warning"
							variant="soft"
							icon="i-lucide-triangle-alert"
							class="mb-1"
						>
							<template #description>
								<div class="space-y-2">
									<p>{{ module2BlockReason }}</p>
									<ULink
										:to="subscriptionPlansPath()"
										class="text-sm font-medium text-primary hover:underline underline-offset-2"
									>
										{{ t('subscription.upgradeCta') }}
									</ULink>
								</div>
							</template>
						</UAlert>

						<UFormField label="Название" name="title" required>
							<UInput
								v-model="form.title"
								placeholder="Сравнение КП ООО «Поставщик» с ТЗ №12..."
								icon="i-lucide-file-search"
								size="lg"
								class="w-full"
								:disabled="!canCreateAnalysis"
							/>
						</UFormField>

						<UButton
							type="submit"
							block
							size="lg"
							leading-icon="i-lucide-plus"
							:loading="loading"
							:disabled="!canCreateAnalysis"
						>
							Создать анализ
						</UButton>

						<SubscriptionErrorAlert
							v-if="createError"
							:error="createError"
							fallback="Не удалось создать анализ. Попробуйте ещё раз."
						/>
					</UForm>
				</UCard>
			</div>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TZAnalysisSession } from '#shared/types'
import {
	canStartModule2Work,
	isTestPlan,
	module2UploadLimitHint,
	module2WorkBlockMessage,
	pagesAnalysisRemaining,
} from '#shared/utils/subscriptionAccess'
import { subscriptionPlansPath } from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'
import { z } from 'zod'

definePageMeta({ layout: 'default' })

const { post } = useApi()
const { public: publicConfig } = useRuntimeConfig()
const { user, loaded, ensureLoaded } = useCurrentUser()

onMounted(() => ensureLoaded())

const canCreateAnalysis = computed(() =>
	canStartModule2Work(user.value?.subscription),
)

const module2BlockReason = computed(() =>
	loaded.value ? module2WorkBlockMessage(user.value?.subscription) : null,
)

const uploadLimitHint = computed(() =>
	module2UploadLimitHint(
		user.value?.subscription,
		publicConfig.maxTzUploadSize as number,
	),
)

const pagesRemainingLabel = computed(() => {
	const sub = user.value?.subscription
	if (!sub?.module_2_enabled) return null
	if (sub.max_pages_analyzed_per_month == null) {
		return t('subscription.pagesUnlimited')
	}
	const remaining = pagesAnalysisRemaining(sub)
	if (remaining === null) return t('subscription.pagesUnlimited')
	return t('subscription.pagesRemainingThisMonth').replace(
		'{count}',
		remaining.toLocaleString('ru-RU'),
	)
})

const schema = z.object({
	title: z.string().min(3, 'Минимум 3 символа').max(500, 'Максимум 500 символов'),
})

const form = reactive({ title: '' })
const loading = ref(false)
const createError = ref<unknown | null>(null)

async function handleCreate() {
	if (loading.value || !canCreateAnalysis.value) return
	createError.value = null
	loading.value = true
	try {
		const created = await post<TZAnalysisSession>('/tz-analysis/', {
			title: form.title.trim(),
		})
		await navigateTo(`/tz-analysis/${created.id}`)
	} catch (e: unknown) {
		createError.value = e
	} finally {
		loading.value = false
	}
}
</script>
