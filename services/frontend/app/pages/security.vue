<template>
	<div>
		<BaseSection tone="elevated" max-width="5xl">
			<div class="text-center">
				<p class="landing-section-headline mb-2">
					Безопасность
				</p>
				<h1 class="landing-section-title mb-4">
					Данные закупок под контролем
				</h1>
				<p class="landing-section-description mx-auto">
					TenderOptima работает с коммерческой информацией клиентов — доступ к данным ограничен ролями,
					соединения защищены, а условия обработки данных закреплены в договоре.
				</p>
			</div>
		</BaseSection>

		<BaseSection>
			<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				<article v-for="item in securityPoints" :key="item.title" class="landing-card landing-card-feature">
					<div class="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10">
						<UIcon :name="item.icon" class="size-5 text-primary" />
					</div>
					<h3 class="mb-2 text-lg font-semibold text-highlighted">
						{{ item.title }}
					</h3>
					<p class="text-sm leading-relaxed text-muted">
						{{ item.description }}
					</p>
				</article>
			</div>
		</BaseSection>

		<BaseSection tone="elevated" max-width="3xl">
			<div class="landing-card p-8 text-center">
				<UIcon name="i-lucide-file-signature" class="mx-auto mb-4 size-9 text-primary" />
				<h2 class="mb-3 text-xl font-semibold text-highlighted">
					Нужны гарантии конфиденциальности для вашей компании?
				</h2>
				<p class="mb-6 leading-relaxed text-muted">
					Обсудим условия обработки данных и NDA на консультации перед подключением.
				</p>
				<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
					<BaseButton leading-icon="i-lucide-messages-square" @click="consultation.open()">
						Получить консультацию
					</BaseButton>
					<BaseButton variant="secondary" to="/contacts" leading-icon="i-lucide-mail">
						Связаться с нами
					</BaseButton>
				</div>
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseButton from '~/components/landing/BaseButton.vue'
import BaseSection from '~/components/landing/BaseSection.vue'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Безопасность — TenderOptima',
	description: 'Как TenderOptima защищает данные закупок: шифрование соединений, ролевой доступ, резервное копирование и договорные гарантии конфиденциальности.',
})

const consultation = useConsultationModal()

const securityPoints = [
	{
		icon: 'i-lucide-lock',
		title: 'Защищённое соединение',
		description: 'Обмен данными с сервисом идёт по защищённому HTTPS-соединению.',
	},
	{
		icon: 'i-lucide-key-round',
		title: 'Ролевой доступ',
		description: 'Доступ к аккаунту компании и подпискам разграничен ролями пользователей.',
	},
	{
		icon: 'i-lucide-mail-check',
		title: 'Подключение почты',
		description: 'Учётные данные для отправки писем поставщикам хранятся отдельно от переписки и используются только для рассылки запросов от имени вашей компании.',
	},
	{
		icon: 'i-lucide-database',
		title: 'Хранение данных',
		description: 'Данные закупок хранятся в изолированной базе данных сервиса с регулярным резервным копированием.',
	},
	{
		icon: 'i-lucide-file-signature',
		title: 'Договор и NDA',
		description: 'Условия обработки данных закреплены в публичном договоре оказания услуг; по запросу обсуждаем дополнительное соглашение о конфиденциальности.',
	},
	{
		icon: 'i-lucide-user-x',
		title: 'Удаление по запросу',
		description: 'По запросу компании данные аккаунта и связанные материалы удаляются из системы.',
	},
]
</script>
