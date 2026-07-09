<template>
	<div>
		<BaseSection tone="elevated" max-width="5xl">
			<div class="text-center">
				<p class="landing-section-headline mb-2">
					Контакты
				</p>
				<h1 class="landing-section-title mb-4">
					Свяжитесь с нами
				</h1>
				<p class="landing-section-description mx-auto">
					Ответим на вопросы о продукте, подписке и подключении вашей компании — оставьте заявку или напишите
					напрямую.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="7xl">
			<div class="landing-cta-grid">
				<div class="landing-cta-grid__left min-w-0">
					<ContactSupportBrand />
					<ContactSupportPanel class="mt-4 sm:mt-5" />

					<div class="mt-4 flex flex-wrap gap-3 text-sm">
						<NuxtLink to="/faq" class="font-semibold text-primary underline underline-offset-2">
							Частые вопросы
						</NuxtLink>
						<NuxtLink to="/security" class="font-semibold text-primary underline underline-offset-2">
							Безопасность данных
						</NuxtLink>
					</div>
				</div>

				<div class="landing-cta-grid__form landing-card bg-default p-5 sm:p-6">
					<h2 class="mb-1 text-lg font-semibold text-highlighted">
						Оставить заявку
					</h2>
					<p class="mb-4 text-sm text-muted">
						Ответим в течение рабочего дня.
					</p>
					<ConsultationForm />
				</div>
			</div>

			<p class="landing-cta-copyright">
				Все права защищены
			</p>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'
import ContactSupportBrand from '~/components/landing/ContactSupportBrand.vue'
import ContactSupportPanel from '~/components/landing/ContactSupportPanel.vue'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Контакты — TenderOptima',
	description: 'Свяжитесь с командой TenderOptima по email, телефону, Telegram или оставьте заявку на консультацию.',
})
</script>
