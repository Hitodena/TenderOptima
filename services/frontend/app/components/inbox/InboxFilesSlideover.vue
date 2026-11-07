<template>
	<USlideover v-model:open="isOpen" :title="`Файлы · ${supplierName}`" :description="descriptionLabel" :ui="{ content: 'max-w-md' }">
		<template #body>
			<div v-if="!groups.length" class="flex flex-col items-center gap-2 py-12 text-sm text-muted">
				<UIcon name="i-lucide-paperclip" class="w-8 h-8 opacity-30" />
				В переписке нет файлов
			</div>
			<div v-else class="space-y-5">
				<section v-for="group in groups" :key="group.key" class="space-y-1">
					<h3 class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">{{ group.label }}</h3>
					<div
						v-for="item in group.items"
						:key="item.key"
						class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-elevated"
						:class="item.att.is_latest === false ? 'opacity-60' : ''"
					>
						<InboxAttachmentThumb :attachment="item.att" size="sm" />
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium leading-snug line-clamp-2 [overflow-wrap:anywhere]" :class="item.att.is_latest === false ? 'line-through decoration-dimmed' : ''" :title="item.att.filename">
								{{ item.att.filename }}
							</p>
							<p class="text-[11px] text-muted flex flex-wrap gap-x-1.5">
								<span v-if="item.att.version" class="font-semibold" :class="item.att.is_latest ? 'text-primary' : ''">
									v{{ item.att.version }}{{ item.att.is_latest ? ' · актуальная' : ' · заменена' }}
								</span>
								<span>{{ item.when }}</span>
								<span v-if="item.att.size">{{ formatBytes(item.att.size) }}</span>
							</p>
						</div>
						<UButton
							v-if="item.att.path && canPreview(item.att)"
							size="xs" color="neutral" variant="ghost" icon="i-lucide-eye"
							:aria-label="`Посмотреть ${item.att.filename}`"
							@click="emit('preview', item.att)"
						/>
						<UButton
							v-if="item.att.path"
							size="xs" color="neutral" variant="ghost" icon="i-lucide-download"
							:aria-label="`Скачать ${item.att.filename}`"
							@click="emit('download', item.att)"
						/>
						<UButton
							size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right"
							aria-label="Показать письмо"
							title="Показать письмо"
							@click="emit('show-message', item.messageId)"
						/>
					</div>
				</section>
			</div>
		</template>
		<template #footer>
			<UButton
				block
				leading-icon="i-lucide-archive"
				:disabled="!downloadable"
				:loading="zipping"
				@click="emit('zip')"
			>
				Скачать все файлы · ZIP
			</UButton>
		</template>
	</USlideover>
</template>

<script lang="ts" setup>
import type { Message, ThreadAttachment } from '#shared/types'
import { fileKind } from '#shared/utils/emailThread'
import InboxAttachmentThumb from '~/components/inbox/InboxAttachmentThumb.vue'

const props = defineProps<{
	messages: Message[]
	supplierName: string
	zipping?: boolean
}>()
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
	'preview': [att: ThreadAttachment]
	'download': [att: ThreadAttachment]
	'zip': []
	'show-message': [messageId: string]
}>()

// order of groups on screen; "ours" collects everything we sent
const GROUP_ORDER = ['offer', 'price', 'certificate', 'invoice', 'contract', 'tech_spec', 'company_card', 'image', 'other', 'ours']
const GROUP_LABEL: Record<string, string> = {
	offer: 'Коммерческие предложения',
	price: 'Прайсы',
	certificate: 'Сертификаты и декларации',
	invoice: 'Счета',
	contract: 'Договоры',
	tech_spec: 'ТЗ и спецификации',
	company_card: 'Карточки и реквизиты',
	image: 'Фото',
	other: 'Другие файлы',
	ours: 'Вы отправили',
}

interface Item { key: string, att: ThreadAttachment, messageId: string, when: string, ts: number }

const groups = computed(() => {
	const byGroup = new Map<string, Item[]>()
	for (const msg of props.messages) {
		if (msg.kind) continue // robots and forwards: copies, not new files
		const ts = msg.received_at ? new Date(msg.received_at).getTime() : 0
		const when = msg.received_at
			? new Date(msg.received_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
			: ''
		;(msg.attachments ?? []).forEach((att, idx) => {
			const key = msg.direction === 'outgoing' ? 'ours' : (att.doc_type || 'other')
			const list = byGroup.get(key) ?? []
			list.push({ key: `${msg.id}-${idx}`, att, messageId: msg.id, when, ts })
			byGroup.set(key, list)
		})
	}
	return GROUP_ORDER
		.filter(k => byGroup.has(k))
		.map(k => ({
			key: k,
			label: GROUP_LABEL[k] ?? 'Файлы',
			// newest first: the current version on top
			items: byGroup.get(k)!.sort((a, b) => b.ts - a.ts),
		}))
})

const total = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))
const downloadable = computed(() => groups.value.some(g => g.items.some(i => i.att.path)))
const descriptionLabel = computed(() => `${total.value} ${plural(total.value)} в переписке`)

function plural(n: number) {
	const a = n % 100, b = n % 10
	if (a >= 11 && a <= 19) return 'файлов'
	if (b === 1) return 'файл'
	if (b >= 2 && b <= 4) return 'файла'
	return 'файлов'
}

function kind(att: ThreadAttachment) {
	return fileKind(att.filename, att.content_type)
}

function canPreview(att: ThreadAttachment) {
	const tone = kind(att).tone
	return tone === 'pdf' || tone === 'image'
}


function formatBytes(b: number) {
	if (b < 1024) return `${b} Б`
	if (b < 1048576) return `${(b / 1024).toFixed(1)} КБ`
	return `${(b / 1048576).toFixed(1)} МБ`
}
</script>
