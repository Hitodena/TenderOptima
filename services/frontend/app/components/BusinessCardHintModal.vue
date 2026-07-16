<template>
	<UModal v-model:open="isOpen">
		<template #header>
			<div class="flex items-start gap-3 min-w-0">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
					<UIcon name="i-lucide-id-card" class="size-5 text-primary" />
				</div>
				<div class="min-w-0">
					<p class="text-lg font-semibold text-highlighted">
						{{ t('requests.businessCardHintTitle') }}
					</p>
					<p class="mt-0.5 text-sm text-muted">
						{{ t('requests.businessCardHintSubtitle') }}
					</p>
				</div>
			</div>
		</template>

		<template #body>
			<div class="space-y-4">
				<p class="text-sm leading-relaxed text-toned">
					{{ t('requests.businessCardHintBody') }}
				</p>
				<ul class="space-y-2.5">
					<li
						v-for="item in hintItems"
						:key="item"
						class="flex items-start gap-2.5 text-sm text-muted"
					>
						<UIcon
							name="i-lucide-check"
							class="mt-0.5 size-4 shrink-0 text-primary"
						/>
						<span>{{ item }}</span>
					</li>
				</ul>
			</div>
		</template>

		<template #footer>
			<div class="flex w-full flex-wrap items-center justify-end gap-2">
				<UButton color="neutral" variant="ghost" @click="dismiss">
					{{ t('requests.businessCardHintLater') }}
				</UButton>
				<UButton
					color="primary"
					leading-icon="i-lucide-id-card"
					@click="goToProfile"
				>
					{{ t('requests.businessCardHintCta') }}
				</UButton>
			</div>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import { t } from '~/constants/translations'

const isOpen = defineModel<boolean>('open', { default: false })

const { markSeen } = useBusinessCardHint()

const hintItems = [
	t('requests.businessCardHintItem1'),
	t('requests.businessCardHintItem2'),
	t('requests.businessCardHintItem3'),
]

function dismiss() {
	markSeen()
	isOpen.value = false
}

function goToProfile() {
	markSeen()
	isOpen.value = false
	navigateTo('/profile?tab=business_card')
}

watch(isOpen, (open) => {
	if (!open) markSeen()
})
</script>
