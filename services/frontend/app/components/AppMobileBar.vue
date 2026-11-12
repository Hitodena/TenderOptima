<template>
	<!-- phones only: a compact native-style top bar — title on the left,
	     icon actions on the right; the search field opens from the magnifier -->
	<div class="sticky top-0 z-30 -mx-4 mb-2 border-b border-default/70 bg-default/90 px-2 backdrop-blur supports-backdrop-filter:bg-default/75 sm:-mx-6 md:hidden">
		<div v-if="!searchOpen" class="flex h-13 items-center gap-0.5">
			<UButton
				v-if="back"
				:to="back"
				color="neutral"
				variant="ghost"
				size="lg"
				icon="i-lucide-chevron-left"
				class="shrink-0"
				aria-label="Назад"
			/>
			<div class="min-w-0 flex-1" :class="back ? '' : 'pl-2'">
				<p class="truncate text-[17px] leading-tight font-semibold text-highlighted">{{ title }}</p>
				<p v-if="subtitle" class="truncate text-xs text-muted">{{ subtitle }}</p>
			</div>
			<UButton
				v-if="searchable"
				color="neutral"
				variant="ghost"
				size="lg"
				icon="i-lucide-search"
				class="shrink-0"
				:aria-label="searchPlaceholder"
				@click="openSearch"
			/>
			<slot name="actions" />
		</div>
		<div v-else class="flex h-13 items-center gap-2 px-2">
			<UInput
				ref="inputRef"
				v-model="search"
				:placeholder="searchPlaceholder"
				icon="i-lucide-search"
				size="lg"
				type="search"
				class="min-w-0 flex-1"
				:ui="{ base: 'rounded-xl bg-elevated ring-0' }"
				@keydown.esc="closeSearch"
			/>
			<button type="button" class="shrink-0 px-1 text-[15px] font-medium text-primary" @click="closeSearch">
				Отмена
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
	title: string
	subtitle?: string | null
	back?: string | null
	searchable?: boolean
	searchPlaceholder?: string
}>(), {
	subtitle: null,
	back: null,
	searchable: false,
	searchPlaceholder: 'Поиск',
})

const search = defineModel<string>('search', { default: '' })
const searchOpen = ref(false)
const inputRef = ref<{ inputRef?: HTMLInputElement } | null>(null)

async function openSearch() {
	searchOpen.value = true
	await nextTick()
	inputRef.value?.inputRef?.focus()
}

function closeSearch() {
	searchOpen.value = false
	search.value = ''
}

// an active search keeps the field open (e.g. after going back to the page)
onMounted(() => {
	if (search.value) searchOpen.value = true
})
</script>
