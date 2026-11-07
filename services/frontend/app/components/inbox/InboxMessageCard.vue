<template>
	<!-- collapsed: one line, like an older letter in a mail client -->
	<button
		v-if="!expanded"
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

		<div class="px-4 pb-1 max-w-[75ch]">
			<p
				v-if="split.main"
				class="whitespace-pre-wrap wrap-break-word font-sans text-[13px] md:text-sm leading-relaxed"
			>
				<template v-for="(segment, segIdx) in splitTextWithLinks(split.main)" :key="`${message.id}-m-${segIdx}`">
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

		<div v-if="split.quoted" class="px-4 pt-1.5">
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
			>{{ split.quoted }}</p>
		</div>

		<div
			v-if="attachments.length"
			class="grid gap-2 px-4 pt-3 grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]"
			:class="attachments.length === 1 ? 'max-w-80' : ''"
		>
			<button
				v-for="(att, idx) in attachments"
				:key="`${att.filename}-${idx}`"
				type="button"
				class="group/att min-w-0 flex items-center gap-2.5 rounded-lg border border-default bg-default px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
				:class="att.path ? 'hover:bg-elevated hover:border-accented cursor-pointer' : 'opacity-50 cursor-not-allowed'"
				:disabled="!att.path"
				:title="att.path ? `Скачать ${att.filename}` : 'Файл недоступен для скачивания'"
				@click="emit('download', att)"
			>
				<span
					class="w-9 h-11 rounded-md grid place-items-end justify-center pb-1 text-[9px] font-bold text-white shrink-0 font-mono"
					:class="toneClass(kind(att).tone)"
				>{{ kind(att).label }}</span>
				<span class="min-w-0 flex-1">
					<span class="block text-xs font-medium leading-snug line-clamp-2 [overflow-wrap:anywhere]">{{ att.filename }}</span>
					<span class="block text-[11px] text-muted mt-0.5">{{ att.size ? formatBytes(att.size) : 'размер неизвестен' }}</span>
				</span>
				<UIcon
					v-if="att.path"
					name="i-lucide-download"
					class="w-4 h-4 text-muted group-hover/att:text-primary shrink-0"
				/>
			</button>
		</div>

		<div class="h-3.5" />
	</article>
</template>

<script lang="ts" setup>
import type { Attachment, Message } from '#shared/types'
import { fileKind, letterPreview, splitQuotedReply, type FileTone } from '#shared/utils/emailThread'
import { splitTextWithLinks } from '#shared/utils/url'

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
	toggle: []
	download: [att: Attachment]
}>()

const showQuote = ref(false)

const isOutgoing = computed(() => props.message.direction === 'outgoing')
const senderLabel = computed(() => (isOutgoing.value ? 'Вы' : props.senderName))
const split = computed(() => splitQuotedReply(props.message.raw_body))
const preview = computed(() => letterPreview(props.message.raw_body, 160))
const attachments = computed(() => props.message.attachments ?? [])

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

function kind(att: Attachment) {
	return fileKind(att.filename, att.content_type)
}

function toneClass(tone: FileTone) {
	switch (tone) {
		case 'pdf': return 'bg-red-600'
		case 'sheet': return 'bg-green-700'
		case 'doc': return 'bg-blue-600'
		case 'image': return 'bg-amber-600'
		case 'archive': return 'bg-slate-600'
		default: return 'bg-slate-500'
	}
}

function formatBytes(b: number) {
	if (b < 1024) return `${b} Б`
	if (b < 1048576) return `${(b / 1024).toFixed(1)} КБ`
	return `${(b / 1048576).toFixed(1)} МБ`
}
</script>
