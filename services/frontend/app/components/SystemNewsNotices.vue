<template>
	<div v-if="notices.length" class="border-b border-default bg-elevated/30">
		<UContainer class="space-y-3 py-3">
			<section
				v-for="notice in notices"
					:key="notice.id"
					:class="['flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-start', severitySurface[notice.severity]]"
					role="status"
					aria-live="polite"
				>
				<div class="flex min-w-0 flex-1 items-start gap-3">
					<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-default/70">
						<UIcon :name="severityIcon[notice.severity]" :class="['size-5', severityText[notice.severity]]" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<p class="font-semibold text-highlighted">{{ notice.title }}</p>
							<UBadge :color="severityColor(notice.severity)" variant="soft">
								{{ t(`news.severity.${notice.severity}`) }}
							</UBadge>
							<UBadge v-if="notice.module_name" color="neutral" variant="outline">
								{{ notice.module_name }}
							</UBadge>
						</div>
						<p class="mt-1 whitespace-pre-line text-sm text-default">{{ notice.content }}</p>
						<time class="mt-2 block text-xs text-muted" :datetime="notice.created_at">
							{{ formatDateTime(notice.created_at) }}
						</time>
					</div>
				</div>
				<div class="flex shrink-0 justify-end sm:pt-0.5">
					<UButton
						variant="soft"
						color="neutral"
						leading-icon="i-lucide-check"
						:loading="markingId === notice.id"
						:disabled="Boolean(markingId) && markingId !== notice.id"
						@click="acknowledge(notice)"
					>
						{{ t('news.acknowledge') }}
					</UButton>
				</div>
			</section>
		</UContainer>
	</div>
</template>

<script lang="ts" setup>
import type { NewsResponse, NewsSeverity } from '#shared/types'
import { t } from '~/constants/translations'

const auth = useAuthStore()
const { get, post } = useApi()
const { formatDateTime } = useFormatDate()
const toast = useToast()

const notices = ref<NewsResponse[]>([])
const markingId = ref<string | null>(null)
const acknowledgedIds = new Set<string>()
let refreshTimer: ReturnType<typeof setInterval> | undefined

const severityIcon: Record<NewsSeverity, string> = {
	info: 'i-lucide-info',
	warning: 'i-lucide-triangle-alert',
	error: 'i-lucide-circle-alert',
}
const severityText: Record<NewsSeverity, string> = {
	info: 'text-primary',
	warning: 'text-warning',
	error: 'text-error',
}
const severitySurface: Record<NewsSeverity, string> = {
	info: 'border-primary/30 bg-primary/5',
	warning: 'border-warning/40 bg-warning/5',
	error: 'border-error/40 bg-error/5',
}

function severityColor(severity: NewsSeverity): 'primary' | 'warning' | 'error' {
	if (severity === 'error') return 'error'
	if (severity === 'warning') return 'warning'
	return 'primary'
}

async function loadUnread() {
	if (!auth.isAuthenticated.value) return
	try {
		const unread = await get<NewsResponse[]>('/news/unread')
		notices.value = unread.filter((notice) => !acknowledgedIds.has(notice.id))
	} catch {
		// Keep the last successful list visible until the next refresh succeeds.
	}
}

async function acknowledge(notice: NewsResponse) {
	if (markingId.value) return
	markingId.value = notice.id
	try {
		await post<{ status: 'read' }>(`/news/${notice.id}/read`, {})
		acknowledgedIds.add(notice.id)
		notices.value = notices.value.filter((item) => item.id !== notice.id)
	} catch {
		toast.add({ title: t('news.acknowledgeError'), color: 'error' })
	} finally {
		markingId.value = null
	}
}

onMounted(() => {
	void loadUnread()
	refreshTimer = setInterval(() => {
		void loadUnread()
	}, 60_000)
})

onBeforeUnmount(() => {
	if (refreshTimer) clearInterval(refreshTimer)
})
</script>
