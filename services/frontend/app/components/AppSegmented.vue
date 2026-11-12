<template>
	<!-- compact iOS-style segmented control -->
	<div
		role="tablist"
		class="grid gap-0.5 rounded-[10px] bg-elevated p-0.5"
		:style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }"
	>
		<button
			v-for="item in items"
			:key="String(item.value)"
			type="button"
			role="tab"
			:aria-selected="model === item.value"
			:aria-label="item.ariaLabel || item.label"
			:title="item.ariaLabel || item.label"
			class="flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] transition-colors"
			:class="model === item.value ? 'bg-default font-semibold text-highlighted shadow-sm' : 'font-medium text-muted'"
			@click="model = item.value"
		>
			<UIcon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
			<span v-if="item.label" class="truncate">{{ item.label }}</span>
			<span v-if="item.count != null" class="tabular-nums opacity-70">{{ item.count }}</span>
		</button>
	</div>
</template>

<script lang="ts" setup generic="T extends string">
defineProps<{
	items: { value: T, label?: string, icon?: string, ariaLabel?: string, count?: number | null }[]
}>()

const model = defineModel<T>({ required: true })
</script>
