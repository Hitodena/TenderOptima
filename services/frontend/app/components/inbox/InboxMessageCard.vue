<template>
	<!-- robot letters and our forwards: one quiet line, details on demand -->
	<div
		v-if="systemKind"
		class="min-w-0 rounded-lg border px-3 py-2 text-xs"
		:class="[
			systemKind === 'bounce' ? 'border-error/30 bg-error/5' : 'border-default bg-default/60',
			highlighted ? 'ring-2 ring-primary/60' : '',
		]"
	>
		<div class="flex items-center gap-2 min-w-0">
			<UIcon
				:name="systemIcon"
				class="w-4 h-4 shrink-0"
				:class="systemKind === 'bounce' ? 'text-error' : 'text-muted'"
			/>
			<span class="min-w-0 flex-1 truncate" :class="systemKind === 'bounce' ? 'text-error font-medium' : 'text-muted'">
				{{ systemTitle }}
			</span>
			<span class="text-[11px] text-dimmed whitespace-nowrap tabular-nums">{{ fullTimeLabel }}</span>
			<UButton
				size="xs"
				color="neutral"
				variant="link"
				class="px-0"
				:aria-expanded="expanded"
				@click="emit('toggle')"
			>
				{{ expanded ? 'Скрыть' : 'Подробнее' }}
			</UButton>
		</div>
		<template v-if="expanded">
			<p class="mt-2 whitespace-pre-wrap wrap-break-word text-muted leading-relaxed max-w-[75ch]">{{ mainText || 'Текста нет' }}</p>
			<div v-if="systemKind === 'bounce'" class="mt-2 flex flex-wrap gap-2">
				<UButton size="xs" color="error" variant="soft" leading-icon="i-lucide-at-sign" @click="emit('fix-address')">
					Проверить адрес поставщика
				</UButton>
			</div>
		</template>
	</div>

	<!-- collapsed: one line, like an older letter in a mail client -->
	<button
		v-else-if="!expanded"
		type="button"
		class="group w-full min-w-0 grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
		:class="[
			isOutgoing
				? 'bg-primary/5 border-primary/15 hover:border-primary/30'
				: 'bg-default border-default hover:border-accented',
			highlighted ? 'ring-2 ring-primary/60' : '',
		]"
		:aria-label="`Развернуть письмо: ${senderLabel}, ${timeLabel}`"
		@click="emit('toggle')"
	>
		<span
			class="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold shrink-0"
			:class="isOutgoing ? 'bg-primary text-inverted' : 'bg-primary/10 text-primary'"
		>{{ isOutgoing ? 'Вы' : senderInitials }}</span>
		<span class="flex items-baseline gap-2 min-w-0">
			<span class="text-xs font-semibold whitespace-nowrap">{{ senderLabel }}</span>
			<span class="text-xs text-muted truncate min-w-0">{{ preview || message.subject || 'Без текста' }}</span>
		</span>
		<span class="flex items-center gap-2.5 text-[11px] text-dimmed whitespace-nowrap">
			<span v-if="offerVersionLabel" class="font-semibold text-primary">{{ offerVersionLabel }}</span>
			<span v-if="attachments.length" class="inline-flex items-center gap-0.5" :title="`Вложений: ${attachments.length}`">
				<UIcon name="i-lucide-paperclip" class="w-3 h-3" />{{ attachments.length }}
			</span>
			<span class="tabular-nums">{{ timeLabel }}</span>
		</span>
	</button>

	<!-- expanded: the whole letter -->
	<article
		v-else
		class="min-w-0 rounded-xl border shadow-sm transition-shadow duration-500"
		:class="[
			isOutgoing ? 'bg-primary/5 border-primary/20' : 'bg-default border-accented',
			highlighted ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-default' : '',
		]"
	>
		<header
			class="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-3 px-4 pt-3.5 pb-2"
			:class="collapsible ? 'cursor-pointer' : ''"
			@click="collapsible && emit('toggle')"
		>
			<span
				class="w-9 h-9 rounded-full grid place-items-center text-xs font-bold shrink-0"
				:class="isOutgoing ? 'bg-primary text-inverted' : 'bg-primary/10 text-primary'"
			>{{ isOutgoing ? 'Вы' : senderInitials }}</span>
			<div class="min-w-0">
				<p class="text-sm font-semibold leading-snug">
					{{ senderLabel }}
					<span v-if="!isOutgoing && senderEmail" class="hidden sm:inline font-normal text-xs text-muted">&lt;{{ senderEmail }}&gt;</span>
				</p>
				<p v-if="message.subject" class="text-[13px] text-default leading-snug wrap-break-word">
					{{ message.subject }}
				</p>
			</div>
			<div class="flex items-start gap-1">
				<span class="text-[11px] text-muted text-right whitespace-nowrap tabular-nums pt-0.5">{{ fullTimeLabel }}</span>
				<UButton
					v-if="collapsible"
					size="xs"
					color="neutral"
					variant="ghost"
					icon="i-lucide-chevron-up"
					aria-label="Свернуть письмо"
					title="Свернуть письмо"
					@click.stop="emit('toggle')"
				/>
			</div>
		</header>

		<!-- AI digest of this letter -->
		<div v-if="summary" class="mx-4 mb-2">
			<div
				v-if="summary.status === 'processing'"
				class="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"
			>
				<UIcon name="i-lucide-loader" class="w-3.5 h-3.5 animate-spin" />
				ИИ разбирает письмо. Его уже можно читать.
			</div>
			<div
				v-else-if="summary.status === 'ready' && summary.facts.length"
				class="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
			>
				<p class="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
					<UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
					<span>Главное из письма</span>
					<span v-if="summary.total" class="normal-case tracking-normal font-medium text-muted tabular-nums">
						· {{ summary.met }} из {{ summary.total }} требований
					</span>
					<span v-if="summary.changed" class="normal-case tracking-normal font-medium text-muted">
						· изменилось: {{ summary.changed }}
					</span>
				</p>
				<dl class="mt-1.5 grid gap-x-5 gap-y-1 grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))]">
					<div v-for="fact in summary.facts" :key="fact.requirement" class="min-w-0">
						<dt class="text-[11px] text-muted truncate" :title="fact.requirement">{{ fact.requirement }}</dt>
						<dd class="text-[13px] font-medium leading-snug wrap-break-word">
							{{ fact.value }}
							<span
								v-if="fact.changed"
								class="ml-1 inline-block rounded px-1 text-[10.5px] font-semibold bg-warning/10 text-warning"
								:title="`В прошлом письме: ${fact.previous}`"
							>было {{ fact.previous }}</span>
						</dd>
					</div>
				</dl>
			</div>
		</div>

		<div
			v-if="summary?.unread_files?.length"
			class="mx-4 mb-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs"
		>
			<p class="flex items-center gap-1.5 font-semibold text-warning">
				<UIcon name="i-lucide-file-warning" class="w-3.5 h-3.5 shrink-0" />
				ИИ не смог прочитать {{ summary.unread_files.length === 1 ? 'файл' : 'файлы' }} — проверьте вручную
			</p>
			<ul class="mt-1 space-y-0.5 text-default">
				<li v-for="item in summary.unread_files" :key="item" class="wrap-break-word">{{ item }}</li>
			</ul>
		</div>

		<div v-if="message.is_decline" class="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5 text-xs text-muted">
			<UIcon name="i-lucide-circle-slash" class="w-3.5 h-3.5" />
			Похоже на отказ от поставки. Это подсказка: проверьте текст письма.
		</div>

		<div class="px-4 pb-1 max-w-[75ch]">
			<p
				v-if="mainText"
				class="whitespace-pre-wrap wrap-break-word font-sans text-[13px] md:text-sm leading-relaxed"
			>
				<template v-for="(segment, segIdx) in splitTextWithLinks(mainText)" :key="`${message.id}-m-${segIdx}`">
					<a
						v-if="segment.type === 'link'"
						:href="segment.href"
						:title="segment.href"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-block max-w-full overflow-hidden text-ellipsis align-bottom text-primary underline underline-offset-2"
					>{{ segment.label }}</a>
					<span v-else>{{ segment.value }}</span>
				</template>
			</p>
			<p v-else class="text-sm text-muted italic">Письмо без текста</p>
		</div>

		<div v-if="quotedText" class="px-4 pt-1.5">
			<button
				type="button"
				class="text-[11px] text-muted bg-elevated border border-default rounded-md px-2 py-0.5 hover:text-default cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
				:aria-expanded="showQuote"
				@click="showQuote = !showQuote"
			>
				{{ showQuote ? 'Скрыть цитату' : '··· Показать цитату' }}
			</button>
			<p
				v-if="showQuote"
				class="mt-2 border-l-2 border-accented pl-3 whitespace-pre-wrap wrap-break-word text-xs text-muted leading-relaxed max-w-[75ch]"
			>{{ quotedText }}</p>
		</div>

		<div
			v-if="attachments.length"
			class="grid gap-2 px-4 pt-3 grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]"
			:class="attachments.length === 1 ? 'max-w-80' : ''"
		>
			<div
				v-for="(att, idx) in attachments"
				:key="`${att.filename}-${idx}`"
				class="min-w-0 flex items-center gap-2.5 rounded-lg border border-default bg-default px-2.5 py-2"
				:class="[att.path ? '' : 'opacity-50', att.is_latest === false ? 'bg-elevated/50' : '']"
			>
				<InboxAttachmentThumb :attachment="att" />
				<span class="min-w-0 flex-1">
					<span class="block text-xs font-medium leading-snug line-clamp-2 [overflow-wrap:anywhere]" :title="att.filename">{{ att.filename }}</span>
					<span class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted mt-0.5">
						<span
							v-if="att.doc_label && att.doc_type !== 'other' && att.doc_type !== 'image'"
							class="font-semibold rounded px-1"
							:class="att.doc_type === 'offer' ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
						>{{ att.doc_label }}<template v-if="att.version"> · v{{ att.version }}</template></span>
						<span v-if="att.is_latest === false" class="text-warning">есть новее</span>
						<span>{{ att.size ? formatBytes(att.size) : '' }}</span>
					</span>
				</span>
				<span class="flex items-center shrink-0">
					<UButton
						v-if="att.path && canPreview(att)"
						size="xs"
						color="neutral"
						variant="ghost"
						icon="i-lucide-eye"
						:aria-label="`Посмотреть ${att.filename}`"
						title="Посмотреть"
						@click="emit('preview', att)"
					/>
					<UButton
						v-if="att.path"
						size="xs"
						color="neutral"
						variant="ghost"
						icon="i-lucide-download"
						:aria-label="`Скачать ${att.filename}`"
						title="Скачать"
						@click="emit('download', att)"
					/>
					<span v-else class="text-[11px] text-muted px-1" title="Файл не сохранился на сервере">недоступен</span>
				</span>
			</div>
		</div>

		<div class="flex flex-wrap gap-1.5 px-4 pt-3 pb-3.5">
			<UButton
				v-if="!isOutgoing"
				size="xs"
				color="neutral"
				variant="outline"
				leading-icon="i-lucide-forward"
				@click="emit('forward')"
			>
				Переслать коллеге
			</UButton>
			<UButton
				v-if="downloadableCount > 1"
				size="xs"
				color="neutral"
				variant="ghost"
				leading-icon="i-lucide-archive"
				@click="emit('zip')"
			>
				Скачать все файлы письма · ZIP
			</UButton>
		</div>
	</article>
</template>

<script lang="ts" setup>
import type { Message, ThreadAttachment } from '#shared/types'
import { fileKind, letterPreview, splitQuotedReply } from '#shared/utils/emailThread'
import { splitTextWithLinks } from '#shared/utils/url'
import InboxAttachmentThumb from '~/components/inbox/InboxAttachmentThumb.vue'

const props = withDefaults(defineProps<{
	message: Message
	senderName: string
	senderInitials: string
	senderEmail?: string | null
	expanded: boolean
	/** false for the letter that must stay open (the latest one) */
	collapsible?: boolean
	highlighted?: boolean
}>(), {
	senderEmail: null,
	collapsible: true,
	highlighted: false,
})

const emit = defineEmits<{
	'toggle': []
	'download': [att: ThreadAttachment]
	'preview': [att: ThreadAttachment]
	'forward': []
	'zip': []
	'fix-address': []
}>()

const showQuote = ref(false)

const isOutgoing = computed(() => props.message.direction === 'outgoing')
const senderLabel = computed(() => (isOutgoing.value ? 'Вы' : props.senderName))
const systemKind = computed(() => props.message.kind ?? null)

// The server splits the letter (it sees the full original text); older
// servers send only raw_body, then the browser splits it the same way.
const split = computed(() => {
	if (typeof props.message.body_text === 'string') {
		return { main: props.message.body_text, quoted: props.message.quoted_text ?? '' }
	}
	return splitQuotedReply(props.message.raw_body)
})
const mainText = computed(() => split.value.main)
const quotedText = computed(() => split.value.quoted)
const preview = computed(() => letterPreview(mainText.value, 160))
const attachments = computed<ThreadAttachment[]>(() => props.message.attachments ?? [])
const downloadableCount = computed(() => attachments.value.filter(a => a.path).length)
const summary = computed(() => (isOutgoing.value ? null : props.message.summary ?? null))

const offerVersionLabel = computed(() => {
	const offer = attachments.value.find(a => a.doc_type === 'offer' && a.version)
	return offer ? `КП v${offer.version}` : ''
})

const systemIcon = computed(() => {
	if (systemKind.value === 'bounce') return 'i-lucide-mail-x'
	if (systemKind.value === 'forward') return 'i-lucide-forward'
	return 'i-lucide-bot'
})

const systemTitle = computed(() => {
	if (systemKind.value === 'bounce') return 'Письмо не доставлено: почтовый сервер вернул его обратно'
	if (systemKind.value === 'forward') {
		return `Вы переслали письмо${props.message.to_email ? ` на ${props.message.to_email}` : ''}`
	}
	return `Автоответ: ${preview.value || props.message.subject || 'без текста'}`
})

const timeLabel = computed(() => {
	const iso = props.message.received_at
	if (!iso) return ''
	return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})

const fullTimeLabel = computed(() => {
	const iso = props.message.received_at
	if (!iso) return ''
	return new Date(iso).toLocaleString('ru-RU', {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	})
})

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
