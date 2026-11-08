<template>
	<div class="space-y-4">
		<UAlert
			color="info"
			variant="soft"
			icon="i-lucide-monitor"
			title="Полный разбор — на компьютере"
			description="Сравнение ТЗ и КП — объёмный материал: дерево требований, правка статусов и письмо поставщику рассчитаны на большой экран. Откройте эту страницу на компьютере. Здесь — краткие итоги."
			:actions="[{
				label: copied ? 'Ссылка скопирована' : 'Скопировать ссылку',
				icon: copied ? 'i-lucide-check' : 'i-lucide-link',
				color: 'info',
				variant: 'outline',
				size: 'sm',
				onClick: copyLink,
			}]"
			orientation="vertical"
		/>

		<UCard class="shadow-sm" :ui="{ body: 'p-4' }">
			<div class="flex items-center justify-between gap-3">
				<p class="text-sm font-semibold text-highlighted">Требования из ТЗ</p>
				<p class="text-2xl font-bold text-primary tabular-nums leading-none">
					{{ requirementsCount }}
				</p>
			</div>
			<p class="mt-2 text-sm text-muted">
				<template v-if="stage === 'review'">
					Требования извлечены. Проверить и подтвердить список можно на компьютере —
					после этого станет доступна загрузка КП.
				</template>
				<template v-else-if="stage === 'closed'">
					Анализ завершён без сравнения с КП.
				</template>
				<template v-else>
					Список требований подтверждён.
				</template>
			</p>
		</UCard>

		<UCard v-if="processing" class="shadow-sm" :ui="{ body: 'p-4' }">
			<div class="flex items-start gap-3 text-muted">
				<UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin text-warning shrink-0 mt-0.5" />
				<div class="space-y-1">
					<p class="text-sm">{{ t('tzAnalysis.kpProcessingBanner') }}</p>
					<p class="text-xs">{{ t('tzAnalysis.kpProcessingBannerHint') }}</p>
				</div>
			</div>
		</UCard>

		<template v-if="stage !== 'review' && stage !== 'closed'">
			<div v-if="suppliers.length > 0" class="space-y-3">
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm font-semibold text-highlighted">Итоги по поставщикам</p>
					<UButton
						v-if="hasResults"
						size="sm"
						variant="outline"
						leading-icon="i-lucide-download"
						@click="emit('export')"
					>
						Excel
					</UButton>
				</div>

				<UCard
					v-for="supplier in suppliers"
					:key="supplier.id"
					class="shadow-sm"
					:ui="{ body: 'p-4' }"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-sm font-semibold text-highlighted break-words">
								{{ supplier.name }}
							</p>
							<p v-if="supplier.primaryKp" class="text-xs text-muted truncate">
								{{ supplier.primaryKp }}
							</p>
						</div>
						<p
							v-if="supplier.stats"
							class="text-2xl font-bold text-primary tabular-nums leading-none shrink-0"
						>
							{{ supplier.stats.match_score }}%
						</p>
					</div>

					<div v-if="supplier.stats" class="mt-3 flex flex-wrap gap-1.5">
						<UBadge color="success" variant="subtle">
							{{ supplier.stats.met_count }} ок
						</UBadge>
						<UBadge color="warning" variant="subtle">
							{{ supplier.stats.partial_count }} частично
						</UBadge>
						<UBadge color="error" variant="subtle">
							{{ supplier.stats.missing_count }} нет
						</UBadge>
						<UBadge color="neutral" variant="subtle">
							{{ supplier.stats.not_found_count }} не найдено
						</UBadge>
					</div>
					<p v-else class="mt-2 text-xs text-muted">
						{{ supplierStatusText(supplier.status) }}
					</p>
				</UCard>
			</div>

			<p v-else class="text-sm text-muted">
				Поставщики ещё не добавлены. Добавить их и загрузить КП можно на компьютере.
			</p>
		</template>
	</div>
</template>

<script setup lang="ts">
import type { TZAnalysisKpStats } from '#shared/types'
import { TZAnalysisSupplierStatus } from '#shared/types'
import { t } from '~/constants/translations'

export interface MobileSupplierSummary {
	id: string
	name: string
	status?: TZAnalysisSupplierStatus
	primaryKp: string | null
	stats: TZAnalysisKpStats | null
}

defineProps<{
	stage: 'review' | 'confirmed' | 'closed'
	requirementsCount: number
	suppliers: MobileSupplierSummary[]
	processing: boolean
	hasResults: boolean
}>()

const emit = defineEmits<{ export: [] }>()

const toast = useToast()
const copied = ref(false)

async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		copied.value = true
		setTimeout(() => { copied.value = false }, 2500)
	} catch {
		toast.add({
			title: 'Не удалось скопировать ссылку',
			description: window.location.href,
			color: 'warning',
		})
	}
}

function supplierStatusText(status?: TZAnalysisSupplierStatus) {
	if (status === TZAnalysisSupplierStatus.PROCESSING) return 'КП обрабатывается…'
	if (status === TZAnalysisSupplierStatus.FAILED) return 'Ошибка обработки КП — перезапустите анализ на компьютере.'
	return 'Сравнение ещё не запускалось.'
}
</script>
