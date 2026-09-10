<template>
	<div class="space-y-5">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-1">
				<p class="text-base text-muted">
					{{ t('admin.analysisDebug.totalLabel') }}
					<span class="font-semibold text-highlighted text-lg">{{ total }}</span>
				</p>
				<p class="text-sm text-muted max-w-2xl">
					{{ t('admin.analysisDebug.description') }}
				</p>
			</div>
			<div class="flex flex-col sm:flex-row gap-3 sm:items-center">
				<UInput
					v-model="search"
					icon="i-lucide-search"
					:placeholder="t('admin.analysisDebug.searchPlaceholder')"
					class="w-full sm:w-72"
					size="md"
					@keyup.enter="reloadFirstPage"
				/>
				<USwitch
					v-model="withAttachmentsOnly"
					:label="t('admin.analysisDebug.withAttachmentsOnly')"
					size="md"
				/>
			</div>
		</div>

		<UAlert
			v-if="loadError"
			color="error"
			variant="soft"
			icon="i-lucide-circle-alert"
			:description="loadError"
		/>

		<div v-if="loading" class="space-y-4">
			<USkeleton v-for="i in 3" :key="i" class="h-36 w-full rounded-xl" />
		</div>

		<div v-else-if="items.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
			<UIcon name="i-lucide-microscope" class="w-12 h-12 text-muted opacity-40" />
			<p class="text-base text-muted">{{ t('admin.analysisDebug.empty') }}</p>
		</div>

		<div v-else class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
			<div class="space-y-3">
				<button
					v-for="item in items"
					:key="item.message_id"
					type="button"
					class="w-full text-left rounded-xl border border-default bg-default p-4 space-y-3 transition-colors hover:border-primary/40 hover:bg-elevated/40"
					:class="selectedId === item.message_id ? 'border-primary ring-1 ring-primary/30' : ''"
					@click="selectItem(item.message_id)"
				>
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-sm text-muted tabular-nums">
							{{ item.received_at ? formatDateTime(item.received_at) : '—' }}
						</span>
						<UBadge
							v-if="item.analysis_status"
							:color="statusColor(item.analysis_status)"
							variant="subtle"
							size="sm"
						>
							{{ item.analysis_status }}
						</UBadge>
					</div>
					<p class="text-sm sm:text-base font-semibold text-highlighted break-words leading-snug">
						{{ item.subject || t('admin.analysisDebug.noSubject') }}
					</p>
					<div class="grid gap-1 text-sm text-muted">
						<p class="break-all">{{ item.user_email || '—' }}</p>
						<p class="break-words font-medium text-default">
							{{ item.supplier_company || item.supplier_email || '—' }}
						</p>
						<p v-if="item.request_query" class="line-clamp-2 break-words">
							{{ item.request_query }}
						</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<UBadge color="neutral" variant="soft" size="sm">
							{{ t('admin.analysisDebug.attachmentsShort') }}: {{ item.attachment_count }}
						</UBadge>
						<UBadge color="neutral" variant="soft" size="sm">
							{{ t('admin.analysisDebug.matchesShort') }}: {{ item.match_count }}
						</UBadge>
						<UBadge
							v-if="item.calculated_count"
							color="warning"
							variant="soft"
							size="sm"
						>
							{{ t('admin.analysisDebug.originCalculated') }}: {{ item.calculated_count }}
						</UBadge>
						<UBadge
							v-if="item.manual_count"
							color="primary"
							variant="soft"
							size="sm"
						>
							{{ t('admin.analysisDebug.originManual') }}: {{ item.manual_count }}
						</UBadge>
					</div>
				</button>

				<div v-if="total > PAGE_SIZE" class="flex justify-center pt-2">
					<UPagination
						v-model:page="page"
						:total="total"
						:items-per-page="PAGE_SIZE"
						size="md"
					/>
				</div>
			</div>

			<div class="min-w-0">
				<div v-if="detailLoading" class="space-y-3">
					<USkeleton class="h-48 w-full rounded-xl" />
					<USkeleton class="h-64 w-full rounded-xl" />
				</div>
				<UCard
					v-else-if="detail"
					:ui="{ body: 'p-4 sm:p-5 space-y-5' }"
				>
					<div class="space-y-2">
						<p class="text-lg font-semibold text-highlighted break-words">
							{{ detail.subject || t('admin.analysisDebug.noSubject') }}
						</p>
						<div class="grid gap-2 sm:grid-cols-2 text-sm">
							<p class="break-all">
								<span class="text-muted">{{ t('admin.analysisDebug.userColumn') }}:</span>
								{{ detail.user_email || '—' }}
							</p>
							<p class="break-words">
								<span class="text-muted">{{ t('admin.analysisDebug.supplierColumn') }}:</span>
								{{ detail.supplier_company || detail.supplier_email || '—' }}
							</p>
							<p class="break-all sm:col-span-2">
								<span class="text-muted">{{ t('admin.analysisDebug.fromColumn') }}:</span>
								{{ detail.from_email || '—' }}
							</p>
							<p v-if="detail.request_id" class="break-all sm:col-span-2 font-mono text-xs">
								<span class="text-muted font-sans text-sm">{{ t('admin.analysisDebug.requestColumn') }}:</span>
								{{ detail.request_id }}
							</p>
							<p v-if="detail.llm_model" class="break-all sm:col-span-2">
								<span class="text-muted">{{ t('admin.analysisDebug.modelColumn') }}:</span>
								{{ detail.llm_model }}
							</p>
						</div>
					</div>

					<div class="space-y-3">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.analysisDebug.attachmentsTitle') }}
						</p>
						<div
							v-if="detail.attachments.length === 0"
							class="rounded-lg bg-elevated/50 px-3 py-4 text-sm text-muted"
						>
							{{ t('admin.analysisDebug.noAttachments') }}
						</div>
						<div v-else class="space-y-3">
							<div
								v-for="(att, idx) in detail.attachments"
								:key="`${att.path}-${idx}`"
								class="rounded-lg border border-default p-3 space-y-3"
							>
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 space-y-1">
										<p class="text-sm font-medium break-all">{{ att.filename }}</p>
										<p class="text-xs text-muted">
											{{ att.content_type || '—' }}
											<span v-if="att.size != null"> · {{ formatBytes(att.size) }}</span>
										</p>
									</div>
									<UButton
										size="sm"
										variant="soft"
										color="neutral"
										icon="i-lucide-download"
										:loading="downloadingPath === att.path"
										@click="downloadAttachment(att)"
									>
										{{ t('admin.analysisDebug.download') }}
									</UButton>
								</div>
								<img
									v-if="isImageAttachment(att) && previewUrls[att.path]"
									:src="previewUrls[att.path]"
									:alt="att.filename"
									class="max-h-72 w-full rounded-md object-contain bg-elevated/40"
								>
							</div>
						</div>
					</div>

					<div class="space-y-3">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.analysisDebug.matchesTitle') }}
						</p>
						<div
							v-if="detail.matches.length === 0"
							class="rounded-lg bg-elevated/50 px-3 py-4 text-sm text-muted"
						>
							{{ t('admin.analysisDebug.noMatches') }}
						</div>
						<div v-else class="overflow-x-auto rounded-lg border border-default">
							<table class="min-w-full text-sm">
								<thead class="bg-elevated/50">
									<tr class="border-b border-default">
										<th class="px-3 py-2 text-left font-medium">
											{{ t('admin.analysisDebug.requirementColumn') }}
										</th>
										<th class="px-3 py-2 text-left font-medium">
											{{ t('admin.analysisDebug.valueColumn') }}
										</th>
										<th class="px-3 py-2 text-left font-medium">
											{{ t('admin.analysisDebug.originColumn') }}
										</th>
										<th class="px-3 py-2 text-left font-medium">
											{{ t('admin.analysisDebug.statusColumn') }}
										</th>
									</tr>
								</thead>
								<tbody>
									<tr
										v-for="(match, idx) in detail.matches"
										:key="`${match.requirement}-${idx}`"
										class="border-b border-default/60 last:border-0 align-top"
									>
										<td class="px-3 py-2.5 max-w-56 break-words">
											{{ match.requirement }}
										</td>
										<td class="px-3 py-2.5 max-w-72 space-y-1">
											<p class="break-words whitespace-pre-wrap">
												{{ match.offer_value || '—' }}
											</p>
											<p
												v-if="match.corrected_from"
												class="text-xs text-muted"
											>
												<span class="line-through">{{ match.corrected_from }}</span>
												→ {{ match.offer_value }}
											</p>
											<p
												v-if="match.numeric_value != null"
												class="text-xs text-muted tabular-nums"
											>
												numeric: {{ match.numeric_value }}
												<span v-if="match.currency"> {{ match.currency }}</span>
											</p>
											<p
												v-if="match.explanation"
												class="text-xs text-muted break-words"
											>
												{{ match.explanation }}
											</p>
										</td>
										<td class="px-3 py-2.5">
											<UBadge
												:color="originColor(match)"
												variant="soft"
												size="sm"
											>
												{{ originLabel(match) }}
											</UBadge>
										</td>
										<td class="px-3 py-2.5">
											<span class="text-xs text-muted">{{ match.status }}</span>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>

					<div v-if="detail.body_preview" class="space-y-2">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.analysisDebug.bodyPreviewTitle') }}
						</p>
						<pre class="max-h-56 overflow-auto rounded-lg bg-elevated/50 p-3 text-xs whitespace-pre-wrap break-words">{{ detail.body_preview }}</pre>
					</div>
				</UCard>
				<div
					v-else
					class="rounded-xl border border-dashed border-default px-4 py-16 text-center text-sm text-muted"
				>
					{{ t('admin.analysisDebug.selectHint') }}
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type {
	AdminAnalysisAttachment,
	AdminAnalysisDetail,
	AdminAnalysisListItem,
	AdminAnalysisMatchItem,
	AdminAnalysisPage,
} from '#shared/types'
import { t } from '~/constants/translations'
import { getApiErrorDetail } from '#shared/utils/apiError'

const { get } = useApi()
const { $axios } = useNuxtApp()
const { formatDate, formatTime } = useFormatDate()
const toast = useToast()

const PAGE_SIZE = 10

const items = ref<AdminAnalysisListItem[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const withAttachmentsOnly = ref(false)
const loading = ref(false)
const loadError = ref<string | null>(null)

const selectedId = ref<string | null>(null)
const detail = ref<AdminAnalysisDetail | null>(null)
const detailLoading = ref(false)
const downloadingPath = ref<string | null>(null)
const previewUrls = ref<Record<string, string>>({})

function formatDateTime(value: string): string {
	return `${formatDate(value)} ${formatTime(value)}`
}

function formatBytes(b: number): string {
	if (b < 1024) return `${b} Б`
	if (b < 1048576) return `${(b / 1024).toFixed(1)} КБ`
	return `${(b / 1048576).toFixed(1)} МБ`
}

function statusColor(status: string): 'success' | 'warning' | 'error' | 'neutral' {
	if (status === 'active') return 'success'
	if (status === 'processing') return 'warning'
	if (status === 'failed') return 'error'
	return 'neutral'
}

function originLabel(match: AdminAnalysisMatchItem): string {
	if (match.corrected_from) return t('admin.analysisDebug.originManual')
	if (match.value_origin === 'calculated') return t('admin.analysisDebug.originCalculated')
	if (match.value_origin === 'extracted') return t('admin.analysisDebug.originExtracted')
	return t('admin.analysisDebug.originUnknown')
}

function originColor(match: AdminAnalysisMatchItem): 'primary' | 'warning' | 'success' | 'neutral' {
	if (match.corrected_from) return 'primary'
	if (match.value_origin === 'calculated') return 'warning'
	if (match.value_origin === 'extracted') return 'success'
	return 'neutral'
}

function isImageAttachment(att: AdminAnalysisAttachment): boolean {
	const type = (att.content_type || '').toLowerCase()
	if (type.startsWith('image/')) return true
	return /\.(png|jpe?g|gif|webp|bmp)$/i.test(att.filename)
}

function revokePreviews() {
	for (const url of Object.values(previewUrls.value)) {
		URL.revokeObjectURL(url)
	}
	previewUrls.value = {}
}

async function loadImagePreviews(attachments: AdminAnalysisAttachment[]) {
	revokePreviews()
	const next: Record<string, string> = {}
	for (const att of attachments) {
		if (!isImageAttachment(att)) continue
		try {
			const res = await $axios.get(
				`/admin/attachments/serve?attachment_path=${encodeURIComponent(att.path)}`,
				{ responseType: 'blob' },
			)
			next[att.path] = URL.createObjectURL(res.data as Blob)
		}
		catch {
			// preview is optional
		}
	}
	previewUrls.value = next
}

async function fetchList() {
	loading.value = true
	loadError.value = null
	try {
		const params = new URLSearchParams({
			page: String(page.value),
			size: String(PAGE_SIZE),
			with_attachments_only: String(withAttachmentsOnly.value),
		})
		const q = search.value.trim()
		if (q) params.set('q', q)
		const data = await get<AdminAnalysisPage>(`/admin/response-analyses?${params}`)
		items.value = data.items
		total.value = data.total
		if (!selectedId.value && data.items[0]) {
			await selectItem(data.items[0].message_id)
		}
		else if (
			selectedId.value
			&& !data.items.some(item => item.message_id === selectedId.value)
		) {
			detail.value = null
			selectedId.value = null
			revokePreviews()
		}
	}
	catch (error) {
		loadError.value = getApiErrorDetail(error) || t('admin.analysisDebug.loadError')
		items.value = []
		total.value = 0
	}
	finally {
		loading.value = false
	}
}

async function selectItem(messageId: string) {
	selectedId.value = messageId
	detailLoading.value = true
	try {
		detail.value = await get<AdminAnalysisDetail>(
			`/admin/response-analyses/${messageId}`,
		)
		await loadImagePreviews(detail.value.attachments)
	}
	catch (error) {
		detail.value = null
		toast.add({
			title: getApiErrorDetail(error) || t('admin.analysisDebug.detailError'),
			color: 'error',
		})
	}
	finally {
		detailLoading.value = false
	}
}

async function downloadAttachment(att: AdminAnalysisAttachment) {
	downloadingPath.value = att.path
	try {
		const res = await $axios.get(
			`/admin/attachments/serve?attachment_path=${encodeURIComponent(att.path)}`,
			{ responseType: 'blob' },
		)
		const url = URL.createObjectURL(res.data as Blob)
		const a = document.createElement('a')
		a.href = url
		a.download = att.filename
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(url)
	}
	catch {
		toast.add({ title: t('admin.analysisDebug.downloadError'), color: 'error' })
	}
	finally {
		downloadingPath.value = null
	}
}

function reloadFirstPage() {
	if (page.value === 1) {
		void fetchList()
		return
	}
	page.value = 1
}

watch(page, () => {
	void fetchList()
})

watch(withAttachmentsOnly, () => {
	reloadFirstPage()
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
	if (searchTimer) clearTimeout(searchTimer)
	searchTimer = setTimeout(() => reloadFirstPage(), 350)
})

onMounted(() => {
	void fetchList()
})

onBeforeUnmount(() => {
	revokePreviews()
	if (searchTimer) clearTimeout(searchTimer)
})
</script>
