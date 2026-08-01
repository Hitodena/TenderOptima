<template>
	<LegalPageShell>
		<h1 class="text-2xl font-bold text-highlighted sm:text-3xl">
			Согласие на обработку персональных данных
		</h1>
		<p class="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
			Обработка персональных данных осуществляется в соответствии с законодательством
			Республики Беларусь и пользовательским соглашением сервиса.
		</p>
		<p class="text-sm text-muted sm:text-base">
			По вопросам:
			<a
				href="mailto:dpo@tenderoptima.by"
				class="text-primary underline underline-offset-2"
			>
				dpo@tenderoptima.by
			</a>
		</p>
	</LegalPageShell>
</template>

<script lang="ts" setup>
import LegalPageShell from '~/components/landing/LegalPageShell.vue'

definePageMeta({ layout: 'default' })

useSeoMeta({
	title: 'Согласие на обработку персональных данных — TenderOptima',
	description: 'Согласие на обработку персональных данных при использовании сервиса TenderOptima.',
})
</script>
