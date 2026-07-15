<template>
	<ClientOnly>
		<div
			v-if="!hasChoice"
			class="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:px-4 sm:pb-4"
			role="dialog"
			:aria-label="t('cookies.description')"
		>
			<UCard
				class="mx-auto w-full max-w-4xl shadow-2xl ring-1 ring-default"
				:ui="{ body: 'p-4 sm:p-5' }"
			>
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-start gap-3">
						<div class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
							<UIcon name="i-lucide-cookie" class="size-5 text-primary" aria-hidden="true" />
						</div>
						<p class="text-sm leading-relaxed text-muted">
							<span>
								{{ t('cookies.description') }}
							</span>
							<button
								type="button"
								class="ml-1 font-medium text-primary underline underline-offset-2 hover:opacity-80"
								@click="settingsOpen = true"
							>
								{{ t('cookies.detailsLink') }}
							</button>
						</p>
					</div>

					<div class="flex shrink-0 flex-col gap-2 sm:flex-row">
						<UButton class="justify-center" @click="saveAcceptAll">
							{{ t('cookies.acceptAll') }}
						</UButton>
						<UButton
							class="justify-center"
							variant="outline"
							color="neutral"
							@click="saveNecessaryOnly"
						>
							{{ t('cookies.declineAll') }}
						</UButton>
					</div>
				</div>
			</UCard>
		</div>

		<UModal
			v-model:open="settingsOpen"
			:title="t('cookies.title')"
			:description="t('cookies.settingsDescription')"
			:ui="{ content: 'max-w-lg' }"
		>
			<template #body>
				<div class="space-y-3">
					<div class="rounded-xl border border-default bg-elevated/50 p-3">
						<UCheckbox :model-value="true" disabled>
							<template #label>
								<span class="font-medium text-highlighted">
									{{ t('cookies.necessaryTitle') }}
								</span>
							</template>
							<template #description>
								{{ t('cookies.necessaryDescription') }}
							</template>
						</UCheckbox>
					</div>

					<div class="rounded-xl border border-default bg-default p-3">
						<UCheckbox v-model="analytics">
							<template #label>
								<span class="font-medium text-highlighted">
									{{ t('cookies.analyticsTitle') }}
								</span>
							</template>
							<template #description>
								{{ t('cookies.analyticsDescription') }}
							</template>
						</UCheckbox>
					</div>
				</div>
			</template>

			<template #footer>
				<UButton block @click="saveCurrentChoice">
					{{ t('cookies.saveChoice') }}
				</UButton>
			</template>
		</UModal>
	</ClientOnly>
</template>

<script setup lang="ts">
import { t } from '~/constants/translations'

const {
	hasChoice,
	preferences,
	saveChoice,
	acceptAll,
	necessaryOnly,
} = useCookieConsent()

const analytics = ref(preferences.value.analytics)
const settingsOpen = ref(false)
const { captureFromRoute } = useUtmParams()

watch(
	preferences,
	(value) => {
		analytics.value = value.analytics
	},
	{ immediate: true },
)

function saveCurrentChoice() {
	saveChoice({
		analytics: analytics.value,
		marketing: false,
	})
	if (analytics.value) {
		captureFromRoute()
	}
	settingsOpen.value = false
}

function saveAcceptAll() {
	analytics.value = true
	acceptAll()
	captureFromRoute()
}

function saveNecessaryOnly() {
	analytics.value = false
	necessaryOnly()
}
</script>
