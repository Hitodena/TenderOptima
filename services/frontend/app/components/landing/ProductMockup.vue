<template>
	<div
		class="landing-mockup"
		:class="{
			'landing-mockup--broadcast': isModuleMock,
		}"
	>
		<div
			v-if="isModuleMock"
			class="landing-mockup-backdrop"
			aria-hidden="true"
		/>

		<div
			class="rounded-3xl border border-slate-100/50 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/40 sm:p-6"
			:class="{ 'landing-mockup-shell--plain': variant !== 'hero' }"
		>
			<div
				class="landing-mockup-frame landing-browser-frame"
				:class="{
					'landing-mockup-frame--broadcast': isModuleMock,
					'landing-mockup-frame--hero shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]': variant === 'hero',
				}"
			>
				<div class="landing-browser-chrome">
					<span class="landing-browser-dot" />
					<span class="landing-browser-dot" />
					<span class="landing-browser-dot" />
					<span class="landing-browser-url">{{ browserUrl }}</span>
				</div>

				<!-- Hero: static screenshot -->
				<img
					v-if="variant === 'hero'"
					:src="image"
					:alt="imageAlt"
					class="block h-auto w-full"
					width="960"
					height="600"
					loading="eager"
					fetchpriority="high"
					decoding="async"
				>

			<!-- Broadcast: interactive-style mailing UI -->
			<div v-else-if="variant === 'broadcast'" class="mock-broadcast">
				<div class="mock-broadcast__header">
					<div>
						<p class="mock-broadcast__title">
							Поставщики для рассылки
						</p>
						<p class="mock-broadcast__subtitle">
							Запрос №1247 · кабель ВВГнг 3×2,5
						</p>
					</div>
					<span class="mock-broadcast__count">{{ selectedCount }} выбрано</span>
				</div>

				<ul class="mock-broadcast__list" role="list">
					<li
						v-for="(supplier, index) in suppliers"
						:key="supplier.id"
						class="mock-broadcast__row"
						:style="{ '--i': index }"
					>
						<span
							class="mock-broadcast__checkbox"
							:class="{ 'mock-broadcast__checkbox--on': supplier.checked }"
							aria-hidden="true"
						>
							<UIcon
								v-if="supplier.checked"
								name="i-lucide-check"
								class="size-3"
							/>
						</span>
						<span
							class="mock-broadcast__avatar"
							:class="supplier.avatarClass"
						>{{ supplier.initial }}</span>
						<span class="mock-broadcast__info">
							<span class="mock-broadcast__name">{{ supplier.name }}</span>
							<span class="mock-broadcast__meta">{{ supplier.meta }}</span>
						</span>
						<span
							v-if="supplier.checked"
							class="mock-broadcast__tag"
						>в рассылке</span>
					</li>
				</ul>

				<div class="mock-broadcast__footer">
					<button class="mock-broadcast__action" type="button" tabindex="-1">
						<UIcon name="i-lucide-send" class="size-3.5" />
						Отправить всем
					</button>
					<span class="mock-broadcast__hint">
						Шаблон «Запрос скидки» · SMTP вашей компании
					</span>
				</div>
			</div>

			<!-- Inbox: supplier replies and thread in one window -->
			<div v-else-if="variant === 'inbox'" class="mock-mail">
				<div class="mock-mail__header">
					<div>
						<p class="mock-mail__title">
							Переписка по запросу
						</p>
						<p class="mock-mail__subtitle">
							Запрос №1247 · кабель ВВГнг 3×2,5
						</p>
					</div>
					<span class="mock-mail__count">3 ответа</span>
				</div>

				<div class="mock-mail__layout">
					<div class="mock-mail__sidebar">
						<span class="mock-mail__sidebar-title">Поставщики</span>
						<ul class="mock-mail__list" role="list">
							<li class="mock-mail__item mock-mail__item--active" style="--i: 0">
								<span class="mock-mail__avatar">О</span>
								<span class="mock-mail__row">
									<span class="mock-mail__name">ООО «ОптиТорг»</span>
									<span class="mock-mail__preview">КП готово, отправляю…</span>
								</span>
								<span class="mock-mail__badge">2</span>
							</li>
							<li class="mock-mail__item" style="--i: 1">
								<span class="mock-mail__avatar mock-mail__avatar--b">П</span>
								<span class="mock-mail__row">
									<span class="mock-mail__name">ОАО «Просонит»</span>
									<span class="mock-mail__preview">Уточняем сроки…</span>
								</span>
							</li>
							<li class="mock-mail__item" style="--i: 2">
								<span class="mock-mail__avatar mock-mail__avatar--g">С</span>
								<span class="mock-mail__row">
									<span class="mock-mail__name">ООО «Синергия»</span>
									<span class="mock-mail__preview">Цена зафиксирована</span>
								</span>
								<span class="mock-mail__badge">1</span>
							</li>
						</ul>
					</div>

					<div class="mock-mail__thread">
						<div class="mock-mail__bubble mock-mail__bubble--in" style="--i: 0">
							<span class="mock-mail__bubble-from">ООО «ОптиТорг» · ответ на запрос</span>
							<p>
								Добрый день! Направляем коммерческое предложение. Срок поставки — 14 дней, цена 412 ₽/м.
							</p>
							<span class="mock-mail__bubble-attach">
								<UIcon name="i-lucide-paperclip" class="size-3" />
								КП_ОптиТорг.pdf
							</span>
						</div>
					</div>

					<div class="mock-mail__extract">
						<span class="mock-mail__extract-title">Извлечённые параметры</span>
						<ul class="mock-mail__params" role="list">
							<li class="mock-param" style="--i: 0">
								<span>Цена</span>
								<b>412 ₽/м</b>
							</li>
							<li class="mock-param" style="--i: 1">
								<span>Срок поставки</span>
								<b>14 дней</b>
							</li>
							<li class="mock-param" style="--i: 2">
								<span>Условия оплаты</span>
								<b>30 дней</b>
							</li>
						</ul>
					</div>
				</div>
			</div>

			<!-- Compare: supplier comparison table -->
			<div v-else-if="variant === 'compare'" class="mock-supplier-compare">
				<div class="mock-supplier-compare__header">
					<div>
						<p class="mock-supplier-compare__title">
							Сравнение поставщиков
						</p>
						<p class="mock-supplier-compare__subtitle">
							Запрос №1247 · кабель ВВГнг 3×2,5
						</p>
					</div>
					<span class="mock-supplier-compare__count">3 КП</span>
				</div>

				<div class="mock-supplier-compare__sort">
					<UIcon name="i-lucide-arrow-up-down" class="size-3 shrink-0" />
					<span>Сортировка по цене:</span>
					<b>Цена за единицу без НДС</b>
				</div>

				<div class="mock-supplier-compare__scroll">
					<table class="mock-supplier-table">
						<thead>
							<tr>
								<th>Требование</th>
								<th>
									<span class="mock-supplier-table__col">ООО «ОптиТорг»</span>
									<span class="mock-supplier-table__email">contact@••••••.ru</span>
								</th>
								<th>
									<span class="mock-supplier-table__col">ОАО «Просонит»</span>
									<span class="mock-supplier-table__email">sales@••••••.by</span>
								</th>
								<th class="mock-supplier-table__best">
									<span class="mock-supplier-table__col">ООО «Синергия»</span>
									<span class="mock-supplier-table__email">info@••••••.ru</span>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr style="--i: 0">
								<td>Описание товара</td>
								<td><span class="mock-supplier-status mock-supplier-status--ok">Выполнено</span></td>
								<td><span class="mock-supplier-status mock-supplier-status--ok">Выполнено</span></td>
								<td class="mock-supplier-table__best-cell"><span class="mock-supplier-status mock-supplier-status--ok">Выполнено</span></td>
							</tr>
							<tr style="--i: 1">
								<td>Цена за единицу без НДС</td>
								<td>
									<span class="mock-supplier-price">412 ₽/м</span>
									<span class="mock-supplier-diff">+3.5%</span>
								</td>
								<td>
									<span class="mock-supplier-price">423 ₽/м</span>
									<span class="mock-supplier-diff">+6.3%</span>
								</td>
								<td class="mock-supplier-table__best-cell">
									<span class="mock-supplier-price">398 ₽/м</span>
									<span class="mock-supplier-min">мин.</span>
								</td>
							</tr>
							<tr style="--i: 2">
								<td>Условия оплаты</td>
								<td><span class="mock-supplier-status mock-supplier-status--ok">Выполнено</span></td>
								<td><span class="mock-supplier-status mock-supplier-status--warn">Частично</span></td>
								<td class="mock-supplier-table__best-cell"><span class="mock-supplier-status mock-supplier-status--ok">Выполнено</span></td>
							</tr>
							<tr style="--i: 3">
								<td>Сроки поставки</td>
								<td>14 дней</td>
								<td>21 день</td>
								<td class="mock-supplier-table__best-cell">10 дней</td>
							</tr>
							<tr style="--i: 4">
								<td>Условия поставки</td>
								<td><span class="mock-supplier-status mock-supplier-status--ok">Выполнено</span></td>
								<td><span class="mock-supplier-status mock-supplier-status--ok">Выполнено</span></td>
								<td class="mock-supplier-table__best-cell"><span class="mock-supplier-status mock-supplier-status--ok">Выполнено</span></td>
							</tr>
						</tbody>
					</table>
				</div>

				<div class="mock-supplier-compare__footer">
					<button class="mock-supplier-compare__export" type="button" tabindex="-1">
						<UIcon name="i-lucide-download" class="size-3.5" />
						Экспорт XLSX
					</button>
				</div>
			</div>
		</div>
		</div>

		<template v-if="variant === 'hero'">
			<div class="landing-mockup-badge landing-mockup-badge-1">
				<span class="landing-mockup-badge-icon">
					<UIcon name="i-lucide-lock" class="size-4" />
				</span>
				<span>
					<span class="landing-mockup-badge-value block">Закрывающие</span>
					<span class="landing-mockup-badge-label">документы</span>
				</span>
			</div>

			<div class="landing-mockup-badge landing-mockup-badge-2">
				<span class="landing-mockup-badge-icon">
					<UIcon name="i-lucide-server" class="size-4" />
				</span>
				<span>
					<span class="landing-mockup-badge-value block">14 дней</span>
					<span class="landing-mockup-badge-label">бесплатно</span>
				</span>
			</div>
		</template>
	</div>
</template>

<script lang="ts" setup>
import {
	LANDING_MOCKUP_BROWSER_TITLE,
	LANDING_MOCKUP_BROWSER_TITLE_SHORT,
} from '#shared/constants/landing'

interface BroadcastSupplier {
	id: string
	name: string
	meta: string
	initial: string
	checked: boolean
	avatarClass?: string
}

const props = withDefaults(
	defineProps<{
		variant?: 'hero' | 'broadcast' | 'inbox' | 'compare'
		image?: string
		imageAlt?: string
	}>(),
	{
		variant: 'hero',
		image: '/landing/email_chat.png',
		imageAlt: 'Интерфейс TenderOptima: список поставщиков, переписка и панель соответствия требованиям',
	},
)

const isModuleMock = computed(() =>
	props.variant === 'broadcast'
	|| props.variant === 'inbox'
	|| props.variant === 'compare',
)

const browserUrl = computed(() => {
	if (isModuleMock.value) {
		return LANDING_MOCKUP_BROWSER_TITLE_SHORT
	}
	return LANDING_MOCKUP_BROWSER_TITLE
})

const suppliers: BroadcastSupplier[] = [
	{
		id: '1',
		name: 'ООО «ОптиТорг»',
		meta: 'ID: SUP-024 · contact@••••••.ru',
		initial: 'О',
		checked: true,
	},
	{
		id: '2',
		name: 'ОАО «Просонит»',
		meta: 'ID: SUP-031 · +7 ••• •••-••-••',
		initial: 'П',
		checked: true,
		avatarClass: 'mock-broadcast__avatar--b',
	},
	{
		id: '3',
		name: 'ООО «Синергия»',
		meta: 'ID: SUP-042 · рейтинг 4.9',
		initial: 'С',
		checked: true,
		avatarClass: 'mock-broadcast__avatar--g',
	},
	{
		id: '4',
		name: 'ООО «ТехСнаб»',
		meta: 'ID: SUP-058 · +7 ••• •••-••-••',
		initial: 'Т',
		checked: false,
		avatarClass: 'mock-broadcast__avatar--muted',
	},
]

const selectedCount = computed(() => suppliers.filter((s) => s.checked).length)
</script>

<style scoped>
.landing-mockup--broadcast {
	max-width: none;
}

.landing-mockup-backdrop {
	position: absolute;
	inset: -0.75rem -0.5rem;
	z-index: 0;
	border-radius: 1.25rem;
	background: linear-gradient(
		135deg,
		color-mix(in oklab, var(--color-cta) 10%, transparent),
		color-mix(in oklab, var(--color-accent-light) 8%, transparent)
	);
	backdrop-filter: blur(16px);
	-webkit-backdrop-filter: blur(16px);
}

.landing-mockup-frame--broadcast {
	position: relative;
	z-index: 1;
	overflow: hidden;
	border-color: color-mix(in oklab, var(--ui-border) 70%, transparent);
	background: color-mix(in oklab, var(--ui-bg) 88%, transparent);
	box-shadow:
		0 25px 50px -12px rgb(15 23 42 / 22%),
		0 0 0 1px color-mix(in oklab, var(--ui-border) 50%, transparent);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
}

.mock-broadcast {
	padding: 1rem 1rem 1.125rem;
}

.mock-broadcast__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 0.75rem;
	margin-bottom: 0.875rem;
}

.mock-broadcast__title {
	font-size: 0.875rem;
	font-weight: 700;
	color: var(--ui-text-highlighted);
}

.mock-broadcast__subtitle {
	margin-top: 0.15rem;
	font-size: 0.6875rem;
	color: var(--ui-text-muted);
}

.mock-broadcast__count {
	flex: none;
	padding: 0.2rem 0.55rem;
	border-radius: 999px;
	font-size: 0.625rem;
	font-weight: 700;
	color: var(--color-cta);
	background: color-mix(in oklab, var(--color-cta) 10%, transparent);
	border: 1px solid color-mix(in oklab, var(--color-cta) 24%, transparent);
}

.mock-broadcast__list {
	display: flex;
	flex-direction: column;
	gap: 0.45rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.mock-broadcast__row {
	display: flex;
	align-items: center;
	gap: 0.55rem;
	padding: 0.5rem 0.55rem;
	border-radius: 0.625rem;
	border: 1px solid var(--ui-border);
	background: color-mix(in oklab, var(--ui-bg-elevated) 55%, transparent);
	animation: mock-row-in 0.45s ease both;
	animation-delay: calc(var(--i) * 0.08s);
}

@keyframes mock-row-in {
	from {
		opacity: 0;
		transform: translateY(6px);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.mock-broadcast__checkbox {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.05rem;
	height: 1.05rem;
	flex-shrink: 0;
	border-radius: 0.25rem;
	border: 1.5px solid var(--ui-border);
	background: var(--ui-bg);
	color: #fff;
}

.mock-broadcast__checkbox--on {
	border-color: var(--color-cta);
	background: var(--color-cta);
}

.mock-broadcast__avatar {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.75rem;
	height: 1.75rem;
	flex-shrink: 0;
	border-radius: 999px;
	font-size: 0.6875rem;
	font-weight: 700;
	color: #fff;
	background: #6366f1;
}

.mock-broadcast__avatar--b {
	background: #0ea5e9;
}

.mock-broadcast__avatar--g {
	background: #10b981;
}

.mock-broadcast__avatar--muted {
	background: var(--ui-border);
	color: var(--ui-text-muted);
}

.mock-broadcast__info {
	flex: 1;
	min-width: 0;
}

.mock-broadcast__name {
	display: block;
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--ui-text-highlighted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-broadcast__meta {
	display: block;
	margin-top: 0.1rem;
	font-size: 0.625rem;
	color: var(--ui-text-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-broadcast__tag {
	flex: none;
	font-size: 0.5625rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #10b981;
}

.mock-broadcast__footer {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 0.5rem;
	margin-top: 0.875rem;
	padding-top: 0.875rem;
	border-top: 1px solid var(--ui-border);
}

.mock-broadcast__action {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.4rem;
	width: 100%;
	padding: 0.5rem 0.875rem;
	border: 1px solid color-mix(in oklab, var(--color-cta) 28%, var(--ui-border));
	border-radius: 0.5rem;
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--color-cta);
	background: color-mix(in oklab, var(--color-cta) 5%, var(--ui-bg));
	cursor: default;
}

.mock-broadcast__hint {
	text-align: center;
	font-size: 0.625rem;
	color: var(--ui-text-muted);
}

/* Inbox / correspondence mock */
.mock-mail {
	padding: 1rem 1rem 1.125rem;
}

.mock-mail__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 0.75rem;
	margin-bottom: 0.875rem;
}

.mock-mail__title {
	font-size: 0.875rem;
	font-weight: 700;
	color: var(--ui-text-highlighted);
}

.mock-mail__subtitle {
	margin-top: 0.15rem;
	font-size: 0.6875rem;
	color: var(--ui-text-muted);
}

.mock-mail__count {
	flex: none;
	padding: 0.2rem 0.55rem;
	border-radius: 999px;
	font-size: 0.625rem;
	font-weight: 700;
	color: #7c3aed;
	background: color-mix(in oklab, #8b5cf6 10%, transparent);
	border: 1px solid color-mix(in oklab, #8b5cf6 22%, transparent);
}

.mock-mail__layout {
	display: grid;
	grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 0.85fr);
	gap: 0.5rem;
	min-height: 12rem;
}

.mock-mail__sidebar {
	display: grid;
	gap: 0.4rem;
	align-content: start;
}

.mock-mail__sidebar-title {
	font-size: 0.625rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--ui-text-muted);
}

.mock-mail__list {
	display: grid;
	gap: 0.3rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.mock-mail__item {
	display: grid;
	grid-template-columns: auto 1fr auto;
	gap: 0.45rem;
	align-items: center;
	padding: 0.4rem;
	border-radius: 0.45rem;
	border: 1px solid var(--ui-border);
	background: color-mix(in oklab, var(--ui-bg-elevated) 55%, transparent);
	animation: mock-row-in 0.45s ease both;
	animation-delay: calc(var(--i, 0) * 0.08s);
}

.mock-mail__item--active {
	border-color: color-mix(in oklab, var(--color-cta) 50%, var(--ui-border));
	box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-cta) 18%, transparent);
}

.mock-mail__avatar {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 0.4rem;
	font-size: 0.65rem;
	font-weight: 700;
	color: #fff;
	background: #6366f1;
}

.mock-mail__avatar--b {
	background: #0ea5e9;
}

.mock-mail__avatar--g {
	background: #10b981;
}

.mock-mail__row {
	display: grid;
	gap: 0.1rem;
	min-width: 0;
}

.mock-mail__name {
	font-size: 0.68rem;
	font-weight: 600;
	color: var(--ui-text-highlighted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-mail__preview {
	font-size: 0.6rem;
	color: var(--ui-text-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-mail__badge {
	font-size: 0.58rem;
	font-weight: 700;
	color: #fff;
	background: var(--color-cta);
	border-radius: 999px;
	padding: 0 0.3rem;
	line-height: 1.1;
}

.mock-mail__thread {
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	gap: 0.4rem;
	padding: 0.4rem;
	border-radius: 0.5rem;
	border: 1px solid var(--ui-border);
	background: color-mix(in oklab, var(--ui-bg-elevated) 55%, transparent);
}

.mock-mail__bubble {
	border-radius: 0.6rem;
	padding: 0.5rem 0.6rem;
	max-width: 100%;
	font-size: 0.7rem;
	line-height: 1.4;
	animation: mock-row-in 0.45s ease both;
	animation-delay: calc(var(--i, 0) * 0.08s + 0.12s);
}

.mock-mail__bubble--in {
	background: color-mix(in oklab, var(--color-cta) 8%, var(--ui-bg));
	border: 1px solid color-mix(in oklab, var(--color-cta) 20%, var(--ui-border));
	color: var(--ui-text-default);
}

.mock-mail__bubble p {
	margin: 0.25rem 0;
}

.mock-mail__bubble-from {
	display: block;
	font-size: 0.62rem;
	font-weight: 700;
	color: var(--color-cta);
}

.mock-mail__bubble-attach {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	font-size: 0.62rem;
	color: var(--ui-text-muted);
}

.mock-mail__extract {
	display: grid;
	gap: 0.35rem;
	align-content: start;
	padding: 0.5rem;
	border-radius: 0.5rem;
	border: 1px solid var(--ui-border);
	background: color-mix(in oklab, var(--ui-bg-elevated) 55%, transparent);
}

.mock-mail__extract-title {
	font-size: 0.62rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--ui-text-muted);
}

.mock-mail__params {
	display: grid;
	gap: 0.3rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.mock-param {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.4rem;
	font-size: 0.68rem;
	animation: mock-row-in 0.45s ease both;
	animation-delay: calc(var(--i, 0) * 0.08s + 0.16s);
}

.mock-param span {
	color: var(--ui-text-muted);
}

.mock-param b {
	font-weight: 600;
	color: var(--ui-text-highlighted);
}

/* Supplier comparison table mock */
.mock-supplier-compare {
	padding: 1rem 1rem 1.125rem;
}

.mock-supplier-compare__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 0.75rem;
	margin-bottom: 0.75rem;
}

.mock-supplier-compare__title {
	font-size: 0.875rem;
	font-weight: 700;
	color: var(--ui-text-highlighted);
}

.mock-supplier-compare__subtitle {
	margin-top: 0.15rem;
	font-size: 0.6875rem;
	color: var(--ui-text-muted);
}

.mock-supplier-compare__count {
	flex: none;
	padding: 0.2rem 0.55rem;
	border-radius: 999px;
	font-size: 0.625rem;
	font-weight: 700;
	color: #0369a1;
	background: color-mix(in oklab, var(--color-cta) 10%, transparent);
	border: 1px solid color-mix(in oklab, var(--color-cta) 24%, transparent);
}

.mock-supplier-compare__sort {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.35rem;
	margin-bottom: 0.55rem;
	font-size: 0.625rem;
	color: var(--ui-text-muted);
}

.mock-supplier-compare__sort b {
	font-weight: 600;
	color: var(--ui-text-highlighted);
}

.mock-supplier-compare__scroll {
	overflow-x: auto;
	border-radius: 0.5rem;
	border: 1px solid var(--ui-border);
	background: color-mix(in oklab, var(--ui-bg-elevated) 55%, transparent);
}

.mock-supplier-table {
	width: 100%;
	border-collapse: collapse;
	min-width: 28rem;
}

.mock-supplier-table th,
.mock-supplier-table td {
	padding: 0.4rem 0.5rem;
	font-size: 0.625rem;
	border-bottom: 1px solid var(--ui-border);
	vertical-align: top;
}

.mock-supplier-table th {
	text-align: left;
	font-weight: 600;
	color: var(--ui-text-muted);
	background: color-mix(in oklab, var(--ui-bg-elevated) 80%, var(--ui-bg));
}

.mock-supplier-table td {
	color: var(--ui-text-default);
	animation: mock-row-in 0.45s ease both;
	animation-delay: calc(var(--i, 0) * 0.06s);
}

.mock-supplier-table tbody tr:last-child td {
	border-bottom: 0;
}

.mock-supplier-table__col {
	display: block;
	font-weight: 600;
	color: var(--ui-text-highlighted);
	white-space: nowrap;
}

.mock-supplier-table__email {
	display: block;
	margin-top: 0.1rem;
	font-size: 0.5625rem;
	font-weight: 400;
	color: var(--ui-text-muted);
	white-space: nowrap;
}

.mock-supplier-table__best {
	position: relative;
}

.mock-supplier-table__best-cell {
	background: color-mix(in oklab, #10b981 8%, transparent);
}

.mock-supplier-status {
	display: inline-flex;
	padding: 0.12rem 0.4rem;
	border-radius: 999px;
	font-size: 0.5625rem;
	font-weight: 600;
	white-space: nowrap;
}

.mock-supplier-status--ok {
	color: #047857;
	background: color-mix(in oklab, #10b981 14%, transparent);
}

.mock-supplier-status--warn {
	color: #b45309;
	background: color-mix(in oklab, #f59e0b 16%, transparent);
}

.mock-supplier-price {
	font-weight: 600;
	color: var(--ui-text-highlighted);
}

.mock-supplier-min {
	margin-left: 0.25rem;
	padding: 0.05rem 0.3rem;
	border-radius: 0.25rem;
	font-size: 0.5625rem;
	font-weight: 700;
	color: #047857;
	background: color-mix(in oklab, #10b981 14%, transparent);
}

.mock-supplier-diff {
	margin-left: 0.25rem;
	font-size: 0.5625rem;
	font-weight: 600;
	color: #b45309;
}

.mock-supplier-compare__footer {
	display: flex;
	justify-content: flex-end;
	margin-top: 0.75rem;
	padding-top: 0.75rem;
	border-top: 1px solid var(--ui-border);
}

.mock-supplier-compare__export {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.45rem 0.75rem;
	border: 1px solid var(--ui-border);
	border-radius: 0.5rem;
	font-size: 0.6875rem;
	font-weight: 600;
	color: var(--ui-text-highlighted);
	background: var(--ui-bg);
	cursor: default;
}

@media (max-width: 640px) {
	.mock-mail__layout {
		grid-template-columns: 1fr;
		min-height: auto;
	}
}

@media (prefers-reduced-motion: reduce) {
	.mock-broadcast__row,
	.mock-mail__item,
	.mock-mail__bubble,
	.mock-param,
	.mock-supplier-table td {
		animation: none;
	}
}
</style>
