<script lang="ts" setup>
import type { SubscriptionResponse } from '#shared/types'
import {
	effectiveEmailLimit,
	formatUploadLimitMb,
	tzKpUploadLimitBytes,
} from '#shared/utils/subscriptionAccess'
import { formatUsageLimit } from '#shared/utils/subscriptionDisplay'
import { t } from '~/constants/translations'

const props = withDefaults(defineProps<{
	subscription: SubscriptionResponse | null | undefined
	compact?: boolean
}>(), {
	compact: false,
})

const { public: publicConfig } = useRuntimeConfig()
const platformDefaultUpload = Number(publicConfig.maxTzUploadSize) || 100 * 1024 * 1024

type UsageRow = {
	key: string
	label: string
	used: number
	limit: number | null
	color: 'primary' | 'warning' | 'error' | 'success' | 'neutral'
	module: 1 | 2 | 'meta'
}

function usageColor(used: number, limit: number | null): UsageRow['color'] {
	if (limit == null || limit <= 0) return 'primary'
	const ratio = used / limit
	if (ratio >= 1) return 'error'
	if (ratio >= 0.85) return 'warning'
	return 'primary'
}

const rows = computed<UsageRow[]>(() => {
	const sub = props.subscription
	if (!sub) return []

	const result: UsageRow[] = []

	if (sub.module_1_enabled) {
		const searchesUsed = sub.searches_used_this_month ?? 0
		const searchesLimit = sub.max_searches_per_month
		result.push({
			key: 'searches',
			label: t('subscription.searches'),
			used: searchesUsed,
			limit: searchesLimit,
			color: usageColor(searchesUsed, searchesLimit),
			module: 1,
		})

		const emailLimit = effectiveEmailLimit(sub)
		const emailsUsed = sub.emails_sent_this_month ?? 0
		result.push({
			key: 'emails',
			label: t('subscription.emails'),
			used: emailsUsed,
			limit: emailLimit,
			color: usageColor(emailsUsed, emailLimit),
			module: 1,
		})
	}

	if (sub.module_2_enabled) {
		const kpUsed = sub.kp_processed_this_month ?? 0
		const kpLimit = sub.max_kp_processed_per_month
		result.push({
			key: 'kp',
			label: t('subscription.kpProcessed'),
			used: kpUsed,
			limit: kpLimit,
			color: usageColor(kpUsed, kpLimit),
			module: 2,
		})

		const pagesUsed = sub.pages_analyzed_this_month ?? 0
		const pagesLimit = sub.max_pages_analyzed_per_month
		result.push({
			key: 'pages',
			label: t('subscription.pagesAnalyzed'),
			used: pagesUsed,
			limit: pagesLimit,
			color: usageColor(pagesUsed, pagesLimit),
			module: 2,
		})
	}

	return result
})

const uploadLimitLabel = computed(() => {
	const bytes = tzKpUploadLimitBytes(props.subscription, platformDefaultUpload)
	return formatUploadLimitMb(bytes)
})

function progressValue(used: number, limit: number | null): number {
	if (limit == null || limit <= 0) return 0
	return Math.min(100, Math.round((used / limit) * 100))
}

function formatPair(used: number, limit: number | null): string {
	const usedLabel = used.toLocaleString('ru-RU')
	return `${usedLabel} / ${formatUsageLimit(limit)}`
}
</script>

<template>
	<div v-if="subscription" :class="compact ? 'space-y-3' : 'space-y-5'">
		<div
			v-for="row in rows"
			:key="row.key"
			:class="compact ? 'space-y-1' : 'space-y-1.5'"
		>
			<div class="flex items-center justify-between gap-3 text-sm">
				<span class="text-muted truncate">{{ row.label }}</span>
				<span class="font-medium tabular-nums shrink-0">
					{{ formatPair(row.used, row.limit) }}
				</span>
			</div>
			<UProgress
				v-if="row.limit != null"
				:model-value="progressValue(row.used, row.limit)"
				:max="100"
				:color="row.color"
				:size="compact ? 'xs' : 'sm'"
				class="w-full"
			/>
			<div
				v-else
				class="h-1.5 w-full rounded-full bg-elevated overflow-hidden"
			>
				<div class="h-full w-1/3 rounded-full bg-primary/40" />
			</div>
		</div>

		<div
			v-if="subscription.module_2_enabled"
			class="flex items-center justify-between gap-3 text-sm"
			:class="compact ? 'pt-1 border-t border-default' : 'pt-2 border-t border-default'"
		>
			<span class="text-muted">{{ t('subscription.uploadLimit') }}</span>
			<span class="font-medium tabular-nums shrink-0">{{ uploadLimitLabel }}</span>
		</div>
	</div>
</template>
