<script lang="ts" setup>
import type { BillingDocumentResponse } from '#shared/types'

const { get } = useApi()
const { $axios } = useNuxtApp()
const toast = useToast()

const billingDocuments = ref<BillingDocumentResponse[]>([])
const billingLoading = ref(false)

async function loadBillingData() {
	billingLoading.value = true
	try {
		billingDocuments.value = await get<BillingDocumentResponse[]>('/billing/documents')
	} catch {
		toast.add({ title: 'Не удалось загрузить документы', color: 'error' })
	} finally {
		billingLoading.value = false
	}
}

onMounted(() => {
	void loadBillingData()
})

async function downloadBillingDocument(
	doc: BillingDocumentResponse,
	docType: 'invoice' | 'act',
) {
	try {
		const res = await $axios.get(
			`/billing/documents/${doc.id}/download`,
			{
				params: { type: docType },
				responseType: 'blob',
			},
		)
		const blob = res.data as Blob
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${doc.receipt_id}-${docType}.docx`
		a.click()
		URL.revokeObjectURL(url)
	} catch {
		toast.add({ title: 'Не удалось скачать документ', color: 'error' })
	}
}

function formatDocumentPeriod(doc: BillingDocumentResponse) {
	const start = new Date(doc.period_start).toLocaleDateString('ru-RU')
	const end = new Date(doc.period_end).toLocaleDateString('ru-RU')
	return `${start} — ${end}`
}

function formatDocumentStatus(doc: BillingDocumentResponse) {
	if (doc.email_status === 'sent') return 'Отправлен'
	if (doc.email_status === 'pending') return 'В очереди'
	return doc.email_status
}
</script>

<template>
	<UCard :ui="{ body: 'p-5 space-y-6' }">
		<div class="space-y-1">
			<h3 class="text-lg font-semibold text-highlighted">Документы по подписке</h3>
			<p class="text-sm text-muted">
				Акты по купленным подпискам.
			</p>
		</div>

		<div v-if="billingLoading" class="flex justify-center py-8">
			<UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-muted" />
		</div>

		<template v-else>
			<div v-if="billingDocuments.length > 0" class="space-y-3">
				<p class="text-sm font-semibold">История документов</p>
				<div class="overflow-x-auto rounded-lg border border-default">
					<table class="min-w-full text-sm">
						<thead class="bg-elevated/50 text-muted">
							<tr>
								<th class="px-3 py-2 text-left font-medium">Номер</th>
								<th class="px-3 py-2 text-left font-medium">Период</th>
								<th class="px-3 py-2 text-left font-medium">Сумма</th>
								<th class="px-3 py-2 text-left font-medium">Статус</th>
								<th class="px-3 py-2 text-right font-medium">Документы</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="doc in billingDocuments"
								:key="doc.id"
								class="border-t border-default/60"
							>
								<td class="px-3 py-2 font-medium">{{ doc.receipt_id }}</td>
								<td class="px-3 py-2">{{ formatDocumentPeriod(doc) }}</td>
								<td class="px-3 py-2 tabular-nums">
									{{ doc.total_amount }} {{ doc.currency_code }}
								</td>
								<td class="px-3 py-2">{{ formatDocumentStatus(doc) }}</td>
								<td class="px-3 py-2 text-right">
									<div class="flex justify-end gap-1">
										<UButton
											size="xs"
											variant="ghost"
											color="neutral"
											label="Счёт"
											icon="i-lucide-download"
											@click="downloadBillingDocument(doc, 'invoice')"
										/>
										<UButton
											size="xs"
											variant="ghost"
											color="neutral"
											label="Акт"
											icon="i-lucide-download"
											@click="downloadBillingDocument(doc, 'act')"
										/>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<div v-else class="text-center py-8 text-muted">
				<UIcon name="i-lucide-file-text" class="w-10 h-10 mx-auto mb-2 opacity-30" />
				<p class="text-sm">Документов пока нет</p>
			</div>
		</template>
	</UCard>
</template>
