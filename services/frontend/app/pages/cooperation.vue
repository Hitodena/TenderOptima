<template>
	<div>
		<BaseSection tone="elevated" max-width="5xl">
			<div class="text-center">
				<p class="landing-section-headline mb-2">
					Поставщикам
				</p>
				<h1 class="landing-section-title mb-4">
					Приглашение к сотрудничеству
				</h1>
				<p class="landing-section-description mx-auto">
					Оставьте заявку, если хотите попасть в проверенную базу поставщиков TenderOptima.
					После модерации мы свяжемся с вами.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="3xl">
			<div class="landing-card bg-default mx-auto p-5 sm:p-6">
				<h2 class="mb-1 text-lg font-semibold text-highlighted">
					Заявка поставщика
				</h2>
				<p class="mb-4 text-sm text-muted">
					Заполните контакты и укажите сферу отрасли — это ускорит проверку.
				</p>
				<CooperationInviteForm />
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'
import CooperationInviteForm from '~/components/CooperationInviteForm.vue'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Сотрудничество для поставщиков — TenderOptima',
	description:
		'Оставьте заявку на включение в проверенную базу поставщиков TenderOptima.',
})
</script>
