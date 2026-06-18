<template>
	<UPage>
		<UPageHero
			title="AI сервис для автоматизации процессов и принятия решений в закупках"
			description="Система аналитики предложений поставщиков на основе AI. Автоформирование отчётов и подготовка писем."
			:links="heroLinks"
		/>

		<UPageSection
			id="features"
			class="bg-elevated/25"
			title="Вам больше не придётся обрабатывать данные вручную"
			description="Когда нужно провести анализ предложений участников тендера"
		/>

		<UPageSection
			id="how-it-works"
			headline="Процесс"
			title="Как это работает"
			description="Три шага от загрузки материалов до готового результата."
		>
			<UPageGrid>
				<UPageCard
					v-for="(step, index) in workflowSteps"
					:key="index"
					spotlight
					:title="step.title"
					:description="step.description"
					:icon="step.icon"
				/>
			</UPageGrid>
		</UPageSection>

		<UPageSection
			id="benefits"
			class="bg-elevated/25"
			headline="Результаты"
			title="Измеримый эффект для закупок"
			description="Сократите время на анализ объёмных технических предложений в 10 раз."
			:features="benefits"
		/>

		<UPageSection
			id="requests"
			title="Ускорьте подготовку дополнительных запросов участникам"
			description="Теперь составление текста запросов возможно в несколько кликов."
			orientation="horizontal"
		>
			<div class="flex flex-col gap-4 rounded-xl border border-default bg-elevated p-6 lg:p-8">
				<div
					v-for="item in requestHighlights"
					:key="item"
					class="flex items-start gap-3 text-muted"
				>
					<UIcon name="i-lucide-check-circle" class="mt-0.5 size-5 shrink-0 text-primary" />
					<span>{{ item }}</span>
				</div>
			</div>
		</UPageSection>

		<UPageSection
			id="stages"
			class="bg-elevated/25"
			headline="Этапы"
			title="Три основных этапа для автоматизации"
		>
			<UTabs :items="stageTabs" class="w-full">
				<template #qualification>
					<div class="space-y-6 pt-4">
						<p class="text-sm font-semibold uppercase tracking-wide text-muted">
							Проверка предложений на соответствие квалификационным параметрам
						</p>
						<ol class="space-y-4">
							<li
								v-for="(step, index) in qualificationSteps"
								:key="step"
								class="flex gap-4"
							>
								<span
									class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
								>
									{{ index + 1 }}
								</span>
								<p class="pt-1 text-default">{{ step }}</p>
							</li>
						</ol>
						<div class="pt-2">
							<UButton
								label="Запросить демо доступ"
								size="lg"
								leading-icon="i-lucide-mail"
								:to="demoMailto"
							/>
						</div>
					</div>
				</template>

				<template #technical>
					<div class="space-y-4 pt-4 text-muted">
						<p>
							Автоматический технический анализ предложений участников
							на соответствие требованиям технического задания.
						</p>
						<p>
							Система формирует сводные отчёты и выводы,
							сокращая ручную проверку объёмных документов.
						</p>
					</div>
				</template>

				<template #comparison>
					<div class="space-y-4 pt-4 text-muted">
						<p>
							Сравнение коммерческих условий участников в единой структуре
							для быстрого выбора оптимального предложения.
						</p>
						<p>
							Подготовка писем и запросов на улучшение условий
							на основе выявленных расхождений.
						</p>
					</div>
				</template>
			</UTabs>
		</UPageSection>

		<UPageSection
			id="video"
			title="Видео презентация"
			description="Краткий обзор возможностей TenderOptima — около 1 минуты."
			orientation="horizontal"
			reverse
		>
			<div
				class="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-default bg-elevated/50"
			>
				<div class="flex flex-col items-center gap-3 text-muted">
					<UIcon name="i-lucide-play-circle" class="size-12 text-primary" />
					<p class="text-sm">Видео скоро будет доступно</p>
				</div>
			</div>
		</UPageSection>

		<UPageCTA
			title="AI + Аналитика = лучшие контракты"
			description="Автоматизируйте закупки уже сегодня."
			:links="ctaLinks"
		/>

		<UPageSection
			id="subscription"
			class="bg-elevated/25"
			headline="Подписка"
			title="Оформление подписки"
			description="Прозрачный процесс от заявки до доступа в систему."
		>
			<UPageGrid>
				<UPageCard
					v-for="(step, index) in subscriptionSteps"
					:key="index"
					spotlight
					:title="step.title"
					:description="step.description"
					:icon="step.icon"
				/>
			</UPageGrid>
		</UPageSection>
	</UPage>
</template>

<script setup lang="ts">
import type { ButtonProps, TabsItem } from '@nuxt/ui'

definePageMeta({
	layout: 'default',
})

const demoMailto = 'mailto:support@tenderoptima.by?subject=Запрос демо доступа TenderOptima'

const heroLinks = ref<ButtonProps[]>([
	{
		label: 'Запросить демо доступ',
		to: demoMailto,
		icon: 'i-lucide-mail',
	},
	{
		label: 'Узнать больше',
		color: 'neutral',
		variant: 'subtle',
		trailingIcon: 'i-lucide-arrow-right',
		to: '#how-it-works',
	},
])

const ctaLinks = ref<ButtonProps[]>([
	{
		label: 'Запросить демо доступ',
		to: demoMailto,
		icon: 'i-lucide-mail',
	},
])

const workflowSteps = [
	{
		title: 'Загрузите материалы',
		description: 'Вы загружаете тех. задание и предложения участников.',
		icon: 'i-lucide-upload',
	},
	{
		title: 'Отправьте на обработку',
		description: 'Отправляете материалы на обработку в TenderOptima.',
		icon: 'i-lucide-send',
	},
	{
		title: 'Получите результат',
		description: 'Получаете результат в виде готовых сводных файлов и выводов.',
		icon: 'i-lucide-file-check',
	},
]

const benefits = [
	{
		title: 'В 10 раз быстрее',
		description: 'Сократите время на анализ объёмных технических предложений.',
		icon: 'i-lucide-zap',
	},
	{
		title: 'До 95% точности',
		description: 'Точность проверки на соответствие по заданным параметрам.',
		icon: 'i-lucide-target',
	},
	{
		title: 'На 80% меньше рисков',
		description: 'Снизьте закупочные риски за счёт системной проверки.',
		icon: 'i-lucide-shield-check',
	},
	{
		title: 'Быстрый выбор',
		description: 'Выбирайте лучших поставщиков быстрее.',
		icon: 'i-lucide-rocket',
	},
]

const requestHighlights = [
	'Автоматическое формирование текста запросов участникам',
	'Единый шаблон для дополнительных уточнений',
	'Отправка писем без ручной подготовки каждого документа',
]

const stageTabs: TabsItem[] = [
	{
		label: 'Квалификация участников',
		icon: 'i-lucide-user-check',
		slot: 'qualification',
	},
	{
		label: 'Технический анализ предложений',
		icon: 'i-lucide-file-search',
		slot: 'technical',
	},
	{
		label: 'Сравнение условий',
		icon: 'i-lucide-scale',
		slot: 'comparison',
	},
]

const qualificationSteps = [
	'Анализ предложений участников.',
	'Формирование сводного отчёта о соответствии.',
	'Формирование письма о выявленных несоответствиях для дальнейшей отправки участнику.',
]

const subscriptionSteps = [
	{
		title: 'Заполните форму',
		description: 'Оставьте заявку на демо-доступ или оформление подписки.',
		icon: 'i-lucide-clipboard-list',
	},
	{
		title: 'Изучите договор',
		description: 'Ознакомьтесь с публичным договором возмездного оказания услуг.',
		icon: 'i-lucide-file-text',
	},
	{
		title: 'Получите счёт',
		description: 'Счёт на оплату придёт на ваш email.',
		icon: 'i-lucide-receipt',
	},
	{
		title: 'Активируйте доступ',
		description: 'После оплаты доступ активируется — вы получите email с деталями входа.',
		icon: 'i-lucide-key-round',
	},
]
</script>
