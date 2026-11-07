<template>
	<span
		class="relative shrink-0 overflow-hidden rounded-md border border-default bg-elevated"
		:class="sizeClass"
	>
		<img
			v-if="src"
			:src="src"
			alt=""
			class="absolute inset-0 h-full w-full object-cover object-top"
		>
		<span
			v-else
			class="absolute inset-0 grid place-items-end justify-center pb-1 text-[9px] font-bold text-white font-mono"
			:class="toneClass"
		>{{ kind.label }}</span>
		<span
			v-if="src"
			class="absolute bottom-0 left-0 rounded-tr px-1 text-[8px] font-bold leading-[14px] text-white font-mono"
			:class="toneClass"
		>{{ kind.label }}</span>
	</span>
</template>

<script lang="ts" setup>
import type { ThreadAttachment } from '#shared/types'
import { fileKind } from '#shared/utils/emailThread'

const props = withDefaults(defineProps<{
	attachment: ThreadAttachment
	size?: 'sm' | 'md'
}>(), { size: 'md' })

// one preview per stored file for the whole page: cards re-render often
const cache = useState<Record<string, string | null>>('inbox-thumb-cache', () => ({}))
const { $axios } = useNuxtApp()

const kind = computed(() => fileKind(props.attachment.filename, props.attachment.content_type))
const sizeClass = computed(() => (props.size === 'sm' ? 'w-8 h-10' : 'w-9 h-11'))
const toneClass = computed(() => {
	switch (kind.value.tone) {
		case 'pdf': return 'bg-red-600'
		case 'sheet': return 'bg-green-700'
		case 'doc': return 'bg-blue-600'
		case 'image': return 'bg-amber-600'
		case 'archive': return 'bg-slate-600'
		default: return 'bg-slate-500'
	}
})
const previewable = computed(() => kind.value.tone === 'pdf' || kind.value.tone === 'image')
const src = computed(() => (props.attachment.path ? cache.value[props.attachment.path] ?? null : null))

async function load() {
	const path = props.attachment.path
	if (!path || !previewable.value || path in cache.value) return
	cache.value[path] = null // mark as requested
	try {
		const res = await $axios.get(
			`/requests/attachments/thumbnail?width=96&attachment_path=${encodeURIComponent(path)}`,
			{ responseType: 'blob' },
		)
		cache.value[path] = URL.createObjectURL(res.data as Blob)
	} catch {
		// no preview (broken file, old server): the file-type badge stays
	}
}

onMounted(load)
watch(() => props.attachment.path, load)
</script>
