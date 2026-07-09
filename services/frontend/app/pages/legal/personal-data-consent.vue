<template>
	<div>
		<BaseSection tone="elevated" max-width="3xl">
			<div class="text-center">
				<h1 class="landing-section-title mb-4">
					Согласие на обработку персональных данных
				</h1>
				<p class="landing-section-description mx-auto">
					Документ определяет условия, на которых пользователь предоставляет согласие на обработку
					персональных данных при использовании сервиса TenderOptima.
				</p>
			</div>
		</BaseSection>

		<BaseSection max-width="3xl">
			<div class="prose prose-sm max-w-none text-default">
				<p>
					Обработка персональных данных осуществляется в соответствии с законодательством Республики Беларусь
					и пользовательским соглашением сервиса.
				</p>
				<p>
					По вопросам обработки персональных данных обращайтесь:
					<a href="mailto:dpo@tenderoptima.by" class="text-primary underline underline-offset-2">
						dpo@tenderoptima.by
					</a>
				</p>
			</div>
		</BaseSection>
	</div>
</template>

<script lang="ts" setup>
import BaseSection from '~/components/landing/BaseSection.vue'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Согласие на обработку персональных данных — TenderOptima',
	description: 'Согласие на обработку персональных данных при использовании сервиса TenderOptima.',
})
</script>
