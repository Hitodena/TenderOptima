<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="shrink-0 space-y-2.5 border-b border-default px-4 py-3">
			<div role="tablist" class="grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1">
				<button
					v-for="v in views"
					:key="v.value"
					type="button"
					role="tab"
					:aria-selected="view === v.value"
					class="h-9 rounded-lg text-sm transition-colors"
					:class="view === v.value ? 'bg-default font-semibold shadow-sm' : 'font-medium text-muted'"
					@click="view = v.value"
				>
					{{ v.label }}
				</button>
			</div>
			<div
				v-if="view === 'param'"
				class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				role="group"
				aria-label="Параметр сравнения"
			>
				<button
					v-for="req in orderedRequirements"
					:key="req"
					type="button"
					class="h-9 shrink-0 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors"
					:class="activeReq === req
						? 'border-primary bg-primary font-semibold text-inverted'
						: 'border-default text-default'"
					:aria-pressed="activeReq === req"
					@click="activeReq = req"
				>
					{{ shortLabel(req) }}
				</button>
			</div>
		</div>

		<!-- one parameter: suppliers from best to worst -->
		<div v-if="view === 'param'" class="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
			<p class="text-sm text-muted">
				{{ fullLabel(activeReq) }}<template v-if="priceUnits[activeReq]"> · за {{ priceUnits[activeReq] }}</template><template v-if="isPrice(activeReq)"> · от меньшей</template>
			</p>
			<button
				v-for="row in rankedRows"
				:key="row.supplier.rs_id"
				type="button"
				class="flex w-full flex-col gap-1.5 rounded-2xl border bg-default p-4 text-left"
				:class="row.best ? 'border-2 border-success' : 'border-default'"
				@click="openCard(row.supplier)"
			>
				<span class="flex items-start justify-between gap-2">
					<span class="min-w-0 font-semibold leading-snug">{{ row.supplier.company_name }}</span>
					<span
						v-if="row.best"
						class="shrink-0 rounded-md bg-success/15 px-2 py-0.5 text-xs font-bold text-success"
					>Лучшая</span>
					<span
						v-else-if="row.supplier.is_winner"
						class="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary"
					>Победитель</span>
				</span>
				<span v-if="row.value" class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
					<span
						class="font-bold tracking-tight"
						:class="isPrice(activeReq) ? 'text-2xl' : 'text-base'"
					>{{ row.value }}</span>
					<span
						v-if="row.previous"
						class="text-sm text-muted line-through"
					>{{ row.previous }}</span>
					<span
						v-if="row.percent && !row.best"
						class="text-sm font-semibold"
						:class="(row.supplier.percent_vs_min?.[activeReq] ?? 0) > 0 ? 'text-warning' : 'text-success'"
					>{{ row.percent }}</span>
				</span>
				<span v-else class="text-sm text-muted">Не указано</span>
				<span
					v-if="row.note"
					class="text-sm"
					:class="row.percent == null && row.value ? 'text-warning' : 'text-muted'"
				>{{ row.note }}</span>
			</button>
			<p v-if="!rankedRows.length" class="py-10 text-center text-sm text-muted">Нет ответов для сравнения</p>
		</div>

		<!-- one supplier per card, swipe sideways -->
		<div v-else class="flex min-h-0 flex-1 flex-col py-3">
			<div
				ref="cardStrip"
				class="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				@scroll.passive="onStripScroll"
			>
				<article
					v-for="supplier in suppliers"
					:key="supplier.rs_id"
					class="flex w-[86%] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-default bg-default"
				>
					<header class="shrink-0 px-4 pt-4 pb-3">
						<p class="text-lg font-bold leading-snug">{{ supplier.company_name }}</p>
						<p class="truncate text-sm text-muted">{{ supplier.main_email }}</p>
					</header>
					<dl class="min-h-0 flex-1 overflow-y-auto">
						<div
							v-for="req in orderedRequirements"
							:key="req"
							class="flex items-start justify-between gap-3 border-t border-default/60 px-4 py-3"
						>
							<dt class="text-sm text-muted">{{ shortLabel(req) }}</dt>
							<dd class="flex flex-col items-end gap-0.5 text-right">
								<span class="text-[15px] font-semibold" :class="displayValue(supplier, req) === '—' ? 'font-normal text-muted' : ''">
									{{ displayValue(supplier, req) === '—' ? 'не указано' : displayValue(supplier, req) }}
								</span>
								<span
									v-if="supplier.previous_values?.[req] && supplier.previous_values[req] !== supplier.values[req]"
									class="text-xs text-muted line-through"
								>{{ supplier.previous_values[req] }}</span>
								<span
									v-if="supplier.price_notes?.[req]"
									class="max-w-44 text-xs"
									:class="supplier.percent_vs_min?.[req] == null ? 'text-warning' : 'text-muted'"
								>{{ supplier.price_notes[req] }}</span>
								<span
									v-if="percent(supplier, req)"
									class="text-xs font-semibold"
									:class="(supplier.percent_vs_min?.[req] ?? 0) > 0 ? 'text-warning' : 'text-success'"
								>{{ percent(supplier, req) === 'мин.' ? 'лучшая' : percent(supplier, req) }}</span>
							</dd>
						</div>
						<div class="flex items-center justify-between gap-3 border-t border-default/60 px-4 py-3">
							<dt class="text-sm text-muted">Соответствие ТЗ</dt>
							<dd
								class="flex items-center gap-1.5 text-[15px] font-semibold"
								:class="compliance(supplier).passed ? 'text-success' : 'text-error'"
							>
								<UIcon
									:name="compliance(supplier).passed ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
									class="size-5"
								/>
								{{ compliance(supplier).passed ? 'да' : 'есть расхождения' }}
							</dd>
						</div>
					</dl>
					<footer class="flex shrink-0 items-center gap-2 border-t border-default p-3">
						<UButton
							color="neutral"
							variant="outline"
							size="lg"
							class="min-w-0 flex-1 justify-center"
							label="Переписка"
							@click="emit('open-thread', supplier)"
						/>
						<UButton
							v-if="hasMismatches(supplier)"
							size="lg"
							class="min-w-0 flex-1 justify-center"
							leading-icon="i-lucide-mail"
							label="Запросить"
							@click="emit('letter', supplier)"
						/>
						<UDropdownMenu :items="cardMenu(supplier)">
							<UButton
								color="neutral"
								variant="ghost"
								size="lg"
								icon="i-lucide-ellipsis-vertical"
								aria-label="Ещё действия"
							/>
						</UDropdownMenu>
					</footer>
				</article>
			</div>
			<div class="flex shrink-0 justify-center gap-1.5 pt-3" :aria-label="`Поставщик ${cardIndex + 1} из ${suppliers.length}`">
				<span
					v-for="(s, i) in suppliers"
					:key="s.rs_id"
					class="h-1.5 rounded-full transition-all"
					:class="i === cardIndex ? 'w-5 bg-primary' : 'w-1.5 bg-accented'"
				/>
			</div>
		</div>

		<div class="shrink-0 border-t border-default px-4 py-2.5">
			<UButton
				color="neutral"
				variant="ghost"
				size="lg"
				block
				leading-icon="i-lucide-download"
				:loading="exporting"
				label="Выгрузить в Excel"
				@click="emit('export')"
			/>
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
	exporting: boolean
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
	'export': []
}>()

type View = 'param' | 'card'
const views: { value: View, label: string }[] = [
	{ value: 'param', label: 'По параметру' },
	{ value: 'card', label: 'По поставщикам' },
]
const view = ref<View>('param')

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
	const first = el?.firstElementChild as HTMLElement | null
	if (!el || !first) return
	const step = first.offsetWidth + 12
	cardIndex.value = Math.max(0, Math.min(props.suppliers.length - 1, Math.round(el.scrollLeft / step)))
}

async function openCard(supplier: ComparisonSupplier) {
	view.value = 'card'
	await nextTick()
	const idx = props.suppliers.findIndex(s => s.rs_id === supplier.rs_id)
	const el = cardStrip.value
	const card = el?.children[idx] as HTMLElement | undefined
	if (el && card) {
		el.scrollTo({ left: card.offsetLeft - 16, behavior: 'instant' as ScrollBehavior })
		cardIndex.value = idx
	}
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
