<template>
	<div class="space-y-5">
		<div class="flex items-center justify-between flex-wrap gap-3">
			<p class="text-base text-muted">
				{{ t('admin.emailRouting.totalLabel') }}
				<span class="font-semibold text-highlighted text-lg">{{ total }}</span>
			</p>
			<USwitch
				v-model="missingSubjectOnly"
				:label="t('admin.emailRouting.missingSubjectOnly')"
				:description="t('admin.emailRouting.missingSubjectHint')"
				size="md"
			/>
		</div>

		<UAlert
			v-if="loadError"
			color="error"
			variant="soft"
			icon="i-lucide-circle-alert"
			:description="loadError"
		/>

		<div v-if="loading" class="space-y-4">
			<USkeleton v-for="i in 3" :key="i" class="h-48 w-full rounded-xl" />
		</div>

		<div v-else-if="messages.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
			<UIcon name="i-lucide-mail" class="w-12 h-12 text-muted opacity-40" />
			<p class="text-base text-muted">{{ t('admin.emailRouting.empty') }}</p>
		</div>

		<div v-else class="space-y-4">
			<UCard
				v-for="item in messages"
				:key="item.id"
				:ui="{ body: 'p-4 sm:p-5 space-y-4' }"
			>
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div class="space-y-2 min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<UBadge
								:color="item.direction === 'incoming' ? 'primary' : 'neutral'"
								variant="subtle"
								size="md"
							>
								{{ item.direction === 'incoming'
									? t('admin.emailRouting.incoming')
									: t('admin.emailRouting.outgoing') }}
							</UBadge>
							<span class="text-sm text-muted tabular-nums">
								{{ item.received_at ? formatDateTime(item.received_at) : '—' }}
							</span>
						</div>
						<p class="text-base sm:text-lg font-semibold text-highlighted break-words leading-snug">
							{{ item.subject || '—' }}
						</p>
					</div>
					<div class="flex flex-wrap gap-2 shrink-0">
						<UButton
							size="sm"
							variant="soft"
							color="neutral"
							icon="i-lucide-link"
							:label="t('admin.emailRouting.relinkTitle')"
							@click="openRelink(item)"
						/>
						<UButton
							size="sm"
							variant="soft"
							color="neutral"
							icon="i-lucide-at-sign"
							:label="t('admin.emailRouting.recipientTitle')"
							@click="openRecipient(item)"
						/>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.emailRouting.fromColumn') }}
						</p>
						<p class="text-sm sm:text-base break-all">{{ item.from_email || '—' }}</p>
					</div>
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.emailRouting.toColumn') }}
						</p>
						<p class="text-sm sm:text-base break-all">{{ item.to_email || '—' }}</p>
					</div>
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.emailRouting.mailboxColumn') }}
						</p>
						<p class="text-sm sm:text-base break-all">{{ item.mailbox_email || '—' }}</p>
					</div>
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.emailRouting.userColumn') }}
						</p>
						<p class="text-sm sm:text-base break-all">{{ item.user_email || '—' }}</p>
					</div>
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.emailRouting.supplierColumn') }}
						</p>
						<p class="text-sm sm:text-base font-medium break-words">
							{{ supplierLabel(item) }}
						</p>
						<p v-if="item.supplier_email" class="text-sm break-all text-muted">
							{{ item.supplier_email }}
						</p>
					</div>
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wide text-muted">
							{{ t('admin.emailRouting.matchedByColumn') }}
						</p>
						<p class="text-sm sm:text-base">{{ matchedByLabel(item.matched_by) }}</p>
						<p class="text-sm text-muted">
							{{ t('admin.emailRouting.confidenceColumn') }}:
							{{ confidenceLabel(item.match_confidence) }}
						</p>
					</div>
				</div>

				<div class="rounded-lg bg-elevated/50 p-3 sm:p-4 space-y-2">
					<p class="text-xs font-medium uppercase tracking-wide text-muted">
						{{ t('admin.emailRouting.technicalTitle') }}
					</p>
					<div class="grid gap-2 sm:grid-cols-2 text-sm">
						<p class="break-all">
							<span class="text-muted">{{ t('admin.emailRouting.linkColumn') }}:</span>
							<span class="font-mono ml-1">{{ item.request_supplier_id }}</span>
						</p>
						<p v-if="item.request_id" class="break-all">
							<span class="text-muted">{{ t('admin.emailRouting.requestColumn') }}:</span>
							<span class="font-mono ml-1">{{ item.request_id }}</span>
						</p>
						<p v-if="item.tracking_id" class="break-all">
							<span class="text-muted">{{ t('admin.emailRouting.trackingColumn') }}:</span>
							<span class="font-mono ml-1">{{ item.tracking_id }}</span>
						</p>
						<p v-if="item.message_id" class="break-all sm:col-span-2">
							<span class="text-muted">{{ t('admin.emailRouting.messageId') }}:</span>
							<span class="font-mono ml-1">{{ item.message_id }}</span>
						</p>
						<p v-if="item.imap_id" class="break-all sm:col-span-2">
							<span class="text-muted">{{ t('admin.emailRouting.imapId') }}:</span>
							<span class="font-mono ml-1">{{ item.imap_id }}</span>
						</p>
					</div>
				</div>
			</UCard>
		</div>

		<div v-if="total > PAGE_SIZE" class="flex justify-center pt-2">
			<UPagination
				v-model:page="page"
				:total="total"
				:items-per-page="PAGE_SIZE"
				size="md"
			/>
		</div>

		<UModal
			v-model:open="relinkOpen"
			:title="t('admin.emailRouting.relinkTitle')"
			:ui="{ content: 'max-w-lg' }"
		>
			<template #body>
				<div class="space-y-4">
					<UFormField
						:label="t('admin.emailRouting.relinkTitle')"
						:hint="t('admin.emailRouting.relinkHint')"
					>
						<UInput v-model="relinkForm.requestSupplierId" class="w-full" size="lg" />
					</UFormField>
					<div class="flex justify-end gap-2">
						<UButton variant="ghost" color="neutral" size="lg" @click="() => { relinkOpen = false }">
							Отмена
						</UButton>
						<UButton size="lg" :loading="savingRelink" @click="submitRelink">
							{{ t('admin.emailRouting.save') }}
						</UButton>
					</div>
				</div>
			</template>
		</UModal>

		<UModal
			v-model:open="recipientOpen"
			:title="t('admin.emailRouting.recipientTitle')"
			:ui="{ content: 'max-w-lg' }"
		>
			<template #body>
				<div class="space-y-4">
					<UFormField
						:label="t('admin.emailRouting.recipientTitle')"
						:hint="t('admin.emailRouting.recipientHint')"
					>
						<UInput v-model="recipientForm.email" type="email" class="w-full" size="lg" />
					</UFormField>
					<div class="flex justify-end gap-2">
						<UButton variant="ghost" color="neutral" size="lg" @click="() => { recipientOpen = false }">
							Отмена
						</UButton>
						<UButton size="lg" :loading="savingRecipient" @click="submitRecipient">
							{{ t('admin.emailRouting.save') }}
						</UButton>
					</div>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script lang="ts" setup>
import type { AdminEmailMessageItem, AdminEmailMessagePage } from '#shared/types'
import { t } from '~/constants/translations'
import { getApiErrorDetail } from '#shared/utils/apiError'

const { get, patch } = useApi()
const { formatDate, formatTime } = useFormatDate()
const toast = useToast()

const PAGE_SIZE = 10

const messages = ref<AdminEmailMessageItem[]>([])
const total = ref(0)
const page = ref(1)
const missingSubjectOnly = ref(true)
const loading = ref(false)
const loadError = ref<string | null>(null)

function formatDateTime(value: string): string {
	return `${formatDate(value)} ${formatTime(value)}`
}

function supplierLabel(item: AdminEmailMessageItem): string {
	if (item.supplier_company && item.supplier_domain) {
		return `${item.supplier_company} · ${item.supplier_domain}`
	}
	return item.supplier_company || item.supplier_domain || '—'
}

function matchedByLabel(value: string | null): string {
	if (!value) return '—'
	const labels: Record<string, string> = {
		tracking_id: t('admin.emailRouting.matchedBy.tracking_id'),
		message_id: t('admin.emailRouting.matchedBy.message_id'),
		sender_recipient: t('admin.emailRouting.matchedBy.sender_recipient'),
		outbound: t('admin.emailRouting.matchedBy.outbound'),
		manual: t('admin.emailRouting.matchedBy.manual'),
		unknown: t('admin.emailRouting.matchedBy.unknown'),
	}
	return labels[value] ?? value
}

function confidenceLabel(value: string | null): string {
	if (!value) return '—'
	const normalized = value === 'n/a' ? 'n_a' : value
	const key = normalized as 'high' | 'medium' | 'manual' | 'n_a' | 'unknown'
	const labels = {
		high: t('admin.emailRouting.confidence.high'),
		medium: t('admin.emailRouting.confidence.medium'),
		manual: t('admin.emailRouting.confidence.manual'),
		n_a: t('admin.emailRouting.confidence.n_a'),
		unknown: t('admin.emailRouting.confidence.unknown'),
	}
	return labels[key] ?? value
}

async function fetchMessages() {
	loading.value = true
	loadError.value = null
	try {
		const data = await get<AdminEmailMessagePage>(
			`/admin/email-messages?page=${page.value}&size=${PAGE_SIZE}&missing_subject_only=${missingSubjectOnly.value}`,
		)
		messages.value = data.items
		total.value = data.total
	} catch (e: unknown) {
		loadError.value = getApiErrorDetail(e) ?? t('admin.emailRouting.loadError')
		messages.value = []
	} finally {
		loading.value = false
	}
}

watch(page, () => { void fetchMessages() })

watch(missingSubjectOnly, () => {
	page.value = 1
	void fetchMessages()
})

onMounted(() => { void fetchMessages() })

const relinkOpen = ref(false)
const recipientOpen = ref(false)
const savingRelink = ref(false)
const savingRecipient = ref(false)
const activeMessage = ref<AdminEmailMessageItem | null>(null)

const relinkForm = reactive({ requestSupplierId: '' })
const recipientForm = reactive({ email: '' })

function openRelink(item: AdminEmailMessageItem) {
	activeMessage.value = item
	relinkForm.requestSupplierId = item.request_supplier_id
	relinkOpen.value = true
}

function openRecipient(item: AdminEmailMessageItem) {
	activeMessage.value = item
	recipientForm.email = item.supplier_email ?? item.to_email ?? ''
	recipientOpen.value = true
}

async function submitRelink() {
	if (!activeMessage.value || savingRelink.value) return
	savingRelink.value = true
	try {
		const updated = await patch<AdminEmailMessageItem>(
			`/admin/email-messages/${activeMessage.value.id}/link`,
			{ request_supplier_id: relinkForm.requestSupplierId.trim() },
		)
		const idx = messages.value.findIndex((m) => m.id === updated.id)
		if (idx >= 0) messages.value[idx] = updated
		relinkOpen.value = false
		toast.add({ title: t('admin.emailRouting.relinkSuccess'), color: 'success' })
	} catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? t('admin.emailRouting.saveError'),
			color: 'error',
		})
	} finally {
		savingRelink.value = false
	}
}

async function submitRecipient() {
	if (!activeMessage.value || savingRecipient.value) return
	savingRecipient.value = true
	try {
		await patch(
			`/admin/request-suppliers/${activeMessage.value.request_supplier_id}/recipient`,
			{ sent_to_email: recipientForm.email.trim() },
		)
		recipientOpen.value = false
		toast.add({ title: t('admin.emailRouting.recipientSuccess'), color: 'success' })
		await fetchMessages()
	} catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? t('admin.emailRouting.saveError'),
			color: 'error',
		})
	} finally {
		savingRecipient.value = false
	}
}
</script>
