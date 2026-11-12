<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<!-- the view switch (by parameter / by supplier) lives in the page's top bar -->
		<div
			v-if="view === 'param'"
			class="flex shrink-0 gap-1.5 overflow-x-auto px-4 pt-2.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			role="group"
			aria-label="Параметр сравнения"
		>
			<button
				v-for="req in orderedRequirements"
				:key="req"
				type="button"
				class="h-8 shrink-0 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors"
				:class="activeReq === req
					? 'border-inverted bg-inverted font-semibold text-inverted'
					: 'border-default text-muted'"
				:aria-pressed="activeReq === req"
				@click="activeReq = req"
			>
				{{ shortLabel(req) }}
			</button>
		</div>

		<!-- one parameter: suppliers from best to worst, one compact row each -->
		<div v-if="view === 'param'" class="flex-1 overflow-y-auto pb-3">
			<p class="px-4 pb-1.5 text-xs text-muted">
				{{ fullLabel(activeReq) }}<template v-if="priceUnits[activeReq]"> · за {{ priceUnits[activeReq] }}</template><template v-if="isPrice(activeReq)"> · от меньшей</template>
			</p>
			<ul class="divide-y divide-default/60 border-y border-default/60">
				<li v-for="(row, i) in rankedRows" :key="row.supplier.rs_id">
					<button
						type="button"
						class="relative flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-elevated/60"
						:class="row.best ? 'bg-success/5' : ''"
						@click="openCard(row.supplier)"
					>
						<span
							v-if="row.best"
							class="absolute inset-y-0 left-0 w-[3px] bg-success"
							aria-hidden="true"
						/>
						<span
							v-if="isPrice(activeReq)"
							class="w-4 shrink-0 text-center text-xs font-semibold tabular-nums"
							:class="row.best ? 'text-success' : 'text-dimmed'"
						>{{ row.value ? i + 1 : '' }}</span>
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 text-sm leading-snug font-medium">{{ row.supplier.company_name }}</span>
							<span
								v-if="row.note"
								class="mt-0.5 block truncate text-xs"
								:class="row.percent == null && row.value ? 'text-warning' : 'text-muted'"
							>{{ row.note }}</span>
							<span
								v-else-if="row.best || row.supplier.is_winner"
								class="mt-0.5 block text-xs font-semibold"
								:class="row.best ? 'text-success' : 'text-primary'"
							>{{ row.best ? 'Лучшая цена' : 'Победитель' }}</span>
						</span>
						<span class="flex shrink-0 flex-col items-end text-right">
							<span
								v-if="row.value"
								class="max-w-36 leading-tight tabular-nums"
								:class="isPrice(activeReq) ? 'text-[15px] font-semibold' : 'line-clamp-2 text-sm font-medium'"
							>{{ row.value }}</span>
							<span v-else class="text-sm text-dimmed">не указано</span>
							<span class="flex items-center gap-1.5 text-xs">
								<span v-if="row.previous" class="text-muted line-through">{{ row.previous }}</span>
								<span
									v-if="row.percent && !row.best"
									class="font-semibold tabular-nums"
									:class="(row.supplier.percent_vs_min?.[activeReq] ?? 0) > 0 ? 'text-warning' : 'text-success'"
								>{{ row.percent }}</span>
							</span>
						</span>
					</button>
				</li>
			</ul>
			<p v-if="!rankedRows.length" class="py-10 text-center text-sm text-muted">Нет ответов для сравнения</p>
		</div>

		<!-- one supplier per screen, swipe sideways -->
		<div v-else class="flex min-h-0 flex-1 flex-col pt-3">
			<div
				ref="cardStrip"
				class="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				@scroll.passive="onStripScroll"
			>
				<div
					v-for="supplier in suppliers"
					:key="supplier.rs_id"
					class="flex w-full shrink-0 snap-center px-4"
				>
					<article class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-default bg-default">
						<header class="flex shrink-0 items-start gap-2 px-4 pt-3.5 pb-3">
							<div class="min-w-0 flex-1">
								<p class="line-clamp-2 text-base leading-snug font-semibold text-highlighted">{{ supplier.company_name }}</p>
								<p class="truncate text-xs text-muted">{{ supplier.main_email }}</p>
							</div>
							<span
								class="mt-0.5 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
								:class="compliance(supplier).passed ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
							>
								<UIcon :name="compliance(supplier).passed ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="size-3.5" />
								{{ compliance(supplier).passed ? 'по ТЗ' : 'расхождения' }}
							</span>
						</header>
						<dl class="min-h-0 flex-1 overflow-y-auto">
							<div
								v-for="req in orderedRequirements"
								:key="req"
								class="flex items-start justify-between gap-3 border-t border-default/60 px-4 py-2.5"
							>
								<dt class="min-w-0 text-[13px] text-muted">{{ shortLabel(req) }}</dt>
								<dd class="flex max-w-[60%] flex-col items-end gap-0.5 text-right">
									<span class="text-sm break-words" :class="displayValue(supplier, req) === '—' ? 'text-dimmed' : 'font-semibold'">
										{{ displayValue(supplier, req) === '—' ? 'не указано' : displayValue(supplier, req) }}
									</span>
									<span
										v-if="supplier.previous_values?.[req] && supplier.previous_values[req] !== supplier.values[req]"
										class="text-xs text-muted line-through"
									>{{ supplier.previous_values[req] }}</span>
									<span
										v-if="supplier.price_notes?.[req]"
										class="text-xs"
										:class="supplier.percent_vs_min?.[req] == null ? 'text-warning' : 'text-muted'"
									>{{ supplier.price_notes[req] }}</span>
									<span
										v-if="percent(supplier, req)"
										class="text-xs font-semibold"
										:class="(supplier.percent_vs_min?.[req] ?? 0) > 0 ? 'text-warning' : 'text-success'"
									>{{ percent(supplier, req) === 'мин.' ? 'лучшая' : percent(supplier, req) }}</span>
								</dd>
							</div>
						</dl>
						<footer class="flex shrink-0 items-center gap-2 border-t border-default p-2.5">
							<template v-if="hasMismatches(supplier)">
								<UButton
									color="neutral"
									variant="outline"
									size="lg"
									icon="i-lucide-messages-square"
									class="shrink-0"
									aria-label="Переписка"
									title="Переписка"
									@click="emit('open-thread', supplier)"
								/>
								<UButton
									size="lg"
									class="min-w-0 flex-1 justify-center"
									leading-icon="i-lucide-mail"
									label="Запросить данные"
									@click="emit('letter', supplier)"
								/>
							</template>
							<UButton
								v-else
								color="neutral"
								variant="outline"
								size="lg"
								class="min-w-0 flex-1 justify-center"
								leading-icon="i-lucide-messages-square"
								label="Переписка"
								@click="emit('open-thread', supplier)"
							/>
							<UDropdownMenu :items="cardMenu(supplier)" :content="{ align: 'end' }">
								<UButton
									color="neutral"
									variant="ghost"
									size="lg"
									icon="i-lucide-ellipsis"
									class="shrink-0"
									aria-label="Ещё действия"
								/>
							</UDropdownMenu>
						</footer>
					</article>
				</div>
			</div>
			<div class="flex shrink-0 items-center justify-center gap-3 py-2">
				<UButton
					color="neutral"
					variant="ghost"
					size="sm"
					icon="i-lucide-chevron-left"
					:disabled="cardIndex === 0"
					aria-label="Предыдущий поставщик"
					@click="scrollToCard(cardIndex - 1)"
				/>
				<span class="text-xs text-muted tabular-nums">{{ cardIndex + 1 }} из {{ suppliers.length }}</span>
				<UButton
					color="neutral"
					variant="ghost"
					size="sm"
					icon="i-lucide-chevron-right"
					:disabled="cardIndex >= suppliers.length - 1"
					aria-label="Следующий поставщик"
					@click="scrollToCard(cardIndex + 1)"
				/>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { ComparisonSupplier } from '#shared/types'

const props = defineProps<{
	requirements: string[]
	priceRequirements: string[]
	priceUnits: Record<string, string | null>
	suppliers: ComparisonSupplier[]
	hasConfirmedWinner: boolean
	unitPriceLabel: string
	positionTitle: (req: string) => string | null
	displayValue: (supplier: ComparisonSupplier, req: string) => string
	percent: (supplier: ComparisonSupplier, req: string) => string | null
	compliance: (supplier: ComparisonSupplier) => { passed: boolean }
	hasMismatches: (supplier: ComparisonSupplier) => boolean
}>()

const emit = defineEmits<{
	'open-thread': [supplier: ComparisonSupplier]
	'letter': [supplier: ComparisonSupplier]
	'improve': [supplier: ComparisonSupplier]
	'winner': [supplier: ComparisonSupplier]
	'clear-winner': []
}>()

type View = 'param' | 'card'
const view = defineModel<View>('view', { default: 'param' })

// price first, then the rest in the request's order
const orderedRequirements = computed(() => [
	...props.priceRequirements.filter(r => props.requirements.includes(r)),
	...props.requirements.filter(r => !props.priceRequirements.includes(r)),
])
const activeReq = ref('')
watch(orderedRequirements, (list) => {
	if (!list.includes(activeReq.value)) activeReq.value = list[0] ?? ''
}, { immediate: true })

function isPrice(req: string) {
	return props.priceRequirements.includes(req)
}

// a position price gets "Цена · <position>"; "(страна)" is dropped so the
// chip stays short
function shortLabel(req: string): string {
	const position = props.positionTitle(req)
	if (position) return `Цена · ${position}`
	return req.replace(/\s*\(страна\)\s*$/i, '')
}

function fullLabel(req: string): string {
	const position = props.positionTitle(req)
	return position ? `${props.unitPriceLabel} · ${position}` : req
}

interface Row {
	supplier: ComparisonSupplier
	value: string | null
	previous: string | null
	percent: string | null
	best: boolean
	note: string | null
}

const rankedRows = computed((): Row[] => {
	const req = activeReq.value
	if (!req) return []
	const rows = props.suppliers.map((supplier) => {
		const shown = props.displayValue(supplier, req)
		const prev = supplier.previous_values?.[req]
		return {
			supplier,
			value: shown && shown !== '—' ? shown : null,
			previous: prev && prev !== supplier.values[req] ? prev : null,
			percent: props.percent(supplier, req),
			note: supplier.price_notes?.[req] ?? null,
			// "best" only where the server compared numbers (percent 0 = minimum)
			best: isPrice(req) && supplier.percent_vs_min?.[req] === 0,
		}
	})
	if (!isPrice(req)) {
		return [...rows].sort((a, b) => Number(Boolean(b.value)) - Number(Boolean(a.value)))
	}
	return [...rows].sort((a, b) => {
		const av = a.supplier.numeric_values?.[req] ?? null
		const bv = b.supplier.numeric_values?.[req] ?? null
		if (av === null && bv === null) return 0
		if (av === null) return 1
		if (bv === null) return -1
		return av - bv
	})
})

const cardStrip = ref<HTMLElement | null>(null)
const cardIndex = ref(0)

function onStripScroll() {
	const el = cardStrip.value
	if (!el || !el.clientWidth) return
	cardIndex.value = Math.max(0, Math.min(props.suppliers.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
}

function scrollToCard(idx: number, behavior: ScrollBehavior = 'smooth') {
	const el = cardStrip.value
	if (!el || idx < 0 || idx >= props.suppliers.length) return
	el.scrollTo({ left: idx * el.clientWidth, behavior })
	cardIndex.value = idx
}

async function openCard(supplier: ComparisonSupplier) {
	view.value = 'card'
	await nextTick()
	scrollToCard(props.suppliers.findIndex(s => s.rs_id === supplier.rs_id), 'instant' as ScrollBehavior)
}

function cardMenu(supplier: ComparisonSupplier) {
	const items: { label: string, icon: string, onSelect: () => void }[] = [
		{ label: 'Улучшить условия', icon: 'i-lucide-sparkles', onSelect: () => emit('improve', supplier) },
	]
	if (!props.hasConfirmedWinner) {
		items.push({ label: 'Выбрать победителем', icon: 'i-lucide-trophy', onSelect: () => emit('winner', supplier) })
	} else if (supplier.is_winner) {
		items.push({ label: 'Снять выбор победителя', icon: 'i-lucide-x', onSelect: () => emit('clear-winner') })
	}
	return [items]
}
</script>
