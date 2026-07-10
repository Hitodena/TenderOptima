<template>
	<article class="landing-case-expanded landing-card flex h-full flex-col overflow-hidden">
		<div class="flex flex-1 flex-col p-6 sm:p-7 lg:p-8">
			<div class="mb-5 flex flex-wrap items-center gap-2">
				<span class="landing-industry-pill">
					<UIcon :name="study.industryIcon" class="landing-industry-pill-icon size-4" />
					{{ study.industry }}
				</span>
			</div>

			<h3 class="mb-4 text-xl font-semibold leading-snug text-highlighted sm:text-2xl lg:text-[1.65rem]">
				{{ study.title }}
			</h3>

			<p class="case-metric mb-5 text-2xl font-bold leading-tight tracking-tight text-primary sm:text-3xl">
				{{ study.metric }}
			</p>

			<div class="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
				<div class="min-w-0">
					<p class="text-sm leading-relaxed text-muted sm:text-base">
						{{ study.description }}
					</p>

					<ul class="mt-5 space-y-2.5 border-t border-default pt-5">
						<li
							v-for="outcome in study.outcomes"
							:key="outcome"
							class="flex items-start gap-2.5 text-sm text-highlighted sm:text-[0.9375rem]"
						>
							<span class="case-outcome-check mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
								<UIcon name="i-lucide-check" class="size-3" />
							</span>
							<span>{{ outcome }}</span>
						</li>
					</ul>
				</div>

				<div
					class="case-visual mt-4 min-h-[8.5rem] rounded-xl border border-default bg-elevated/40 p-3 lg:mt-0 lg:min-h-[11.5rem]"
					aria-hidden="true"
				>
					<div v-if="study.visual === 'compare'" class="case-visual-compare">
						<div class="case-visual-compare__head">
							<span>Сверка КП</span>
							<span class="case-visual-compare__badge">12 КП</span>
						</div>
						<div class="case-visual-compare__table">
							<div class="case-visual-compare__row case-visual-compare__row--head">
								<span>Пункт ТЗ</span>
								<span>Статус</span>
							</div>
							<div class="case-visual-compare__row">
								<span>Мощность, кВт</span>
								<span class="case-visual-compare__ok">✓</span>
							</div>
							<div class="case-visual-compare__row">
								<span>Класс IP</span>
								<span class="case-visual-compare__ok">✓</span>
							</div>
							<div class="case-visual-compare__row">
								<span>Срок службы</span>
								<span class="case-visual-compare__warn">~</span>
							</div>
						</div>
					</div>

					<div v-else-if="study.visual === 'search'" class="case-visual-search">
						<div class="case-visual-search__field">
							<span class="case-visual-search__label">Запрос</span>
							<span class="case-visual-search__value">Кабель ВВГнг 3×2,5</span>
						</div>
						<ul class="case-visual-search__list">
							<li><span>О</span> ООО «ОптиТорг» <em>+ в рассылку</em></li>
							<li><span>П</span> ОАО «Просонит» <em class="is-on">✓</em></li>
							<li><span>С</span> ООО «Синергия» <em class="is-on">✓</em></li>
						</ul>
					</div>

					<div v-else class="case-visual-extract">
						<div class="case-visual-extract__head">
							<span>Техническая проверка</span>
							<span>12/12</span>
						</div>
						<div class="case-visual-extract__bar">
							<span></span>
						</div>
						<ul class="case-visual-extract__list">
							<li><span>Мощность, кВт</span><strong>✓</strong></li>
							<li><span>Класс защиты IP</span><strong>✓</strong></li>
							<li><span>Напряжение, В</span><strong>✓</strong></li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	</article>
</template>

<script lang="ts" setup>
import type { CaseStudy } from '#shared/constants/landing'

defineProps<{
	study: CaseStudy
}>()
</script>

<style scoped>
.case-metric {
	font-variant-numeric: tabular-nums;
}

.case-outcome-check {
	background: color-mix(in oklab, var(--ui-primary) 12%, transparent);
	color: var(--ui-primary);
}

.case-visual-compare__head,
.case-visual-extract__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.5rem;
	font-size: 0.625rem;
	font-weight: 600;
	color: var(--ui-text-muted);
}

.case-visual-compare__badge {
	padding: 0.1rem 0.35rem;
	border-radius: 999px;
	background: color-mix(in oklab, var(--ui-primary) 12%, transparent);
	color: var(--ui-primary);
}

.case-visual-compare__table {
	display: grid;
	gap: 0.25rem;
	font-size: 0.625rem;
}

.case-visual-compare__row {
	display: grid;
	grid-template-columns: 1fr auto;
	gap: 0.5rem;
	padding: 0.3rem 0.4rem;
	border-radius: 0.375rem;
	background: var(--ui-bg);
	color: var(--ui-text-muted);
}

.case-visual-compare__row--head {
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	background: transparent;
}

.case-visual-compare__ok {
	color: #10b981;
	font-weight: 700;
}

.case-visual-compare__warn {
	color: #f59e0b;
	font-weight: 700;
}

.case-visual-search__field {
	margin-bottom: 0.5rem;
	padding: 0.4rem 0.5rem;
	border-radius: 0.5rem;
	background: var(--ui-bg);
}

.case-visual-search__label {
	display: block;
	font-size: 0.5625rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--ui-text-dimmed, var(--ui-text-muted));
}

.case-visual-search__value {
	font-size: 0.6875rem;
	color: var(--ui-text-highlighted);
}

.case-visual-search__list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: grid;
	gap: 0.25rem;
	font-size: 0.625rem;
	color: var(--ui-text-muted);
}

.case-visual-search__list li {
	display: grid;
	grid-template-columns: auto 1fr auto;
	align-items: center;
	gap: 0.35rem;
	padding: 0.3rem 0.4rem;
	border-radius: 0.375rem;
	background: var(--ui-bg);
}

.case-visual-search__list li span {
	display: inline-flex;
	width: 1rem;
	height: 1rem;
	align-items: center;
	justify-content: center;
	border-radius: 999px;
	background: color-mix(in oklab, var(--ui-primary) 14%, transparent);
	font-size: 0.5625rem;
	font-weight: 700;
	color: var(--ui-primary);
}

.case-visual-search__list em {
	font-style: normal;
	font-size: 0.5625rem;
	color: var(--ui-primary);
}

.case-visual-search__list em.is-on {
	color: #10b981;
}

.case-visual-extract__bar {
	height: 0.35rem;
	margin-bottom: 0.5rem;
	border-radius: 999px;
	background: var(--ui-bg);
	overflow: hidden;
}

.case-visual-extract__bar span {
	display: block;
	height: 100%;
	width: 100%;
	border-radius: inherit;
	background: linear-gradient(
		90deg,
		var(--ui-primary),
		color-mix(in oklab, var(--ui-primary) 55%, #10b981)
	);
}

.case-visual-extract__list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: grid;
	gap: 0.25rem;
	font-size: 0.625rem;
}

.case-visual-extract__list li {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.3rem 0.45rem;
	border-radius: 0.375rem;
	background: var(--ui-bg);
	color: var(--ui-text-muted);
}

.case-visual-extract__list strong {
	color: #10b981;
	font-weight: 700;
}
</style>
