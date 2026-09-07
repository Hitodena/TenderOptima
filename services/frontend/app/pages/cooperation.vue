<template>
	<div>
		<BaseSection tone="elevated" max-width="5xl">
			<div class="text-center">
				<p class="landing-section-headline mb-2">
					Поставщикам
				</p>
				<h1 class="landing-section-title mb-4">
					{{ token ? 'Получать похожие запросы' : 'Приглашение к сотрудничеству' }}
				</h1>
				<p class="landing-section-description mx-auto">
					{{ token
						? 'Адрес уже подставлен из письма. Укажите категории, регион и согласие — затем сохраните.'
						: 'Оставьте заявку, если хотите попасть в проверенную базу поставщиков TenderOptima. После модерации мы свяжемся с вами.' }}
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="3xl">
			<div class="landing-card bg-default mx-auto p-5 sm:p-6">
				<h2 class="mb-1 text-lg font-semibold text-highlighted">
					{{ token ? 'Подписка на запросы' : 'Заявка поставщика' }}
				</h2>
				<p v-if="!token" class="mb-4 text-sm text-muted">
					Заполните контакты и укажите сферу отрасли — это ускорит проверку.
				</p>
				<CooperationInviteForm :token="token || undefined" />
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'
import CooperationInviteForm from '~/components/CooperationInviteForm.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const token = computed(() => {
	const raw = route.query.token
	return typeof raw === 'string' ? raw : ''
})

useSeoMeta({
	title: 'Сотрудничество для поставщиков — TenderOptima',
	description: 'Подписка на запросы и заявка в базу поставщиков TenderOptima.',
})
</script>
