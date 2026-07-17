<template>
	<UContainer class="py-8 lg:py-12">
		<div class="max-w-3xl mx-auto">
			<div class="mb-12">
				<div class="text-center mb-6">
					<h1 class="text-3xl font-bold text-highlighted mb-2">Конструктор ТЗ</h1>
					<p class="text-muted text-sm">
						Создайте техническое задание с нуля или дополните уже готовое —
						с помощью ИИ-диалога и экспортом в .docx
					</p>
				</div>

				<UAlert
					v-if="module2BlockReason"
					color="warning"
					variant="soft"
					icon="i-lucide-triangle-alert"
					class="mb-4"
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

				<div class="flex justify-end mb-4">
					<UButton
						to="/tz-creation/history"
						size="lg"
						variant="outline"
						color="neutral"
						leading-icon="i-lucide-history"
					>
						История сессий
					</UButton>
				</div>

				<UCard class="shadow-sm mb-4">
					<UForm :schema="schema" :state="form" class="space-y-6" @submit="handleCreate">
						<div>
							<p class="text-sm font-semibold text-highlighted mb-3">
								Как хотите начать?
							</p>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<button
									type="button"
									class="text-left rounded-xl border p-4 transition-colors cursor-pointer"
									:class="form.mode === 'from_scratch'
										? 'border-primary bg-primary/5'
										: 'border-default hover:bg-elevated/50'"
									:disabled="!canCreateSession"
									@click="form.mode = 'from_scratch'"
								>
									<div class="flex items-center gap-2 mb-1.5">
										<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
											<UIcon name="i-lucide-sparkles" class="w-4 h-4 text-primary" />
										</div>
										<p class="font-semibold text-sm text-highlighted">Создать с нуля</p>
									</div>
									<p class="text-xs text-muted">
										Опишите идею закупки абстрактно — ИИ предложит структуру
										и уточнит детали в диалоге
									</p>
								</button>

								<button
									type="button"
									class="text-left rounded-xl border p-4 transition-colors cursor-pointer"
									:class="form.mode === 'refine_existing'
										? 'border-primary bg-primary/5'
										: 'border-default hover:bg-elevated/50'"
									:disabled="!canCreateSession"
									@click="form.mode = 'refine_existing'"
								>
									<div class="flex items-center gap-2 mb-1.5">
										<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
											<UIcon name="i-lucide-upload" class="w-4 h-4 text-primary" />
										</div>
										<p class="font-semibold text-sm text-highlighted">Загрузить готовое ТЗ</p>
									</div>
									<p class="text-xs text-muted">
										ИИ найдёт пробелы и подводные камни в вашем ТЗ и предложит,
										что стоит уточнить или добавить
									</p>
								</button>
							</div>
						</div>

						<UFormField label="Тип закупки" name="domain" description="Учитывается в подсказках и вопросах ИИ">
							<USelect
								v-model="form.domain"
								:items="domainOptions"
								size="lg"
								class="w-full"
								:disabled="!canCreateSession"
							/>
						</UFormField>

						<UFormField label="Название ТЗ" name="title" description="По умолчанию — «Тендер на закупку»">
							<UInput
								v-model="form.title"
								placeholder="Тендер на закупку упаковочного оборудования"
								icon="i-lucide-file-text"
								size="lg"
								class="w-full"
								:disabled="!canCreateSession"
							/>
						</UFormField>

						<UFormField
							label="Дополнительный контекст"
							name="note"
							description="Необязательно: любые детали, которые ИИ должен учесть сразу"
						>
							<UTextarea
								v-model="form.note"
								placeholder="Например: закупка для производственной линии, важна совместимость с существующим оборудованием"
								:rows="3"
								class="w-full"
								:disabled="!canCreateSession"
							/>
						</UFormField>

						<UButton
							type="submit"
							block
							size="lg"
							leading-icon="i-lucide-plus"
							:loading="loading"
							:disabled="!canCreateSession"
						>
							Начать
						</UButton>

						<SubscriptionErrorAlert
							v-if="createError"
							:error="createError"
							fallback="Не удалось создать сессию конструктора ТЗ. Попробуйте ещё раз."
						/>
					</UForm>
				</UCard>
			</div>
		</div>
	</UContainer>
</template>

<script lang="ts" setup>
import type { TZCreationDomain, TZCreationMode, TZCreationSession } from '#shared/types'
import {
	canStartModule2Work,
	module2WorkBlockMessage,
} from '#shared/utils/subscriptionAccess'
import { subscriptionPlansPath } from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'
import { z } from 'zod'

definePageMeta({ layout: 'default' })

const { post } = useApi()
const { user, loaded, ensureLoaded } = useCurrentUser()

onMounted(() => ensureLoaded())

const canCreateSession = computed(() =>
	canStartModule2Work(user.value?.subscription),
)

const module2BlockReason = computed(() =>
	loaded.value ? module2WorkBlockMessage(user.value?.subscription) : null,
)

const domainOptions: { label: string; value: TZCreationDomain }[] = [
	{ label: 'Оборудование', value: 'equipment' },
	{ label: 'Пищевая продукция', value: 'food' },
	{ label: 'Услуги', value: 'services' },
	{ label: 'Другое', value: 'other' },
]

const schema = z.object({
	title: z.string().max(500).optional(),
	domain: z.enum(['equipment', 'food', 'services', 'other']),
	note: z.string().max(1000).optional(),
})

const form = reactive({
	mode: 'from_scratch' as TZCreationMode,
	title: '',
	domain: 'other' as TZCreationDomain,
	note: '',
})

const loading = ref(false)
const createError = ref<unknown | null>(null)

async function handleCreate() {
	if (loading.value || !canCreateSession.value) return
	createError.value = null
	loading.value = true
	try {
		const created = await post<TZCreationSession>('/tz-creation/', {
			title: form.title.trim(),
			mode: form.mode,
			context: {
				domain: form.domain,
				note: form.note.trim(),
			},
		})
		await navigateTo(`/tz-creation/${created.id}`)
	} catch (e: unknown) {
		createError.value = e
	} finally {
		loading.value = false
	}
}
</script>
