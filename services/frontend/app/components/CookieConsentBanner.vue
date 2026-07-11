<template>
	<ClientOnly>
		<div
			v-if="!hasChoice"
			class="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:px-4 sm:pb-4"
			role="dialog"
			:aria-label="t('cookies.title')"
		>
			<UCard
				class="mx-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-hidden shadow-2xl ring-1 ring-default"
				:ui="{ body: 'p-4 sm:p-5', footer: 'p-4 sm:p-5' }"
			>
				<div class="space-y-4 overflow-y-auto pr-1">
					<div class="flex items-start gap-3">
						<div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
							<UIcon name="i-lucide-cookie" class="size-5 text-primary" />
						</div>
						<div>
							<h2 class="text-base font-semibold text-highlighted">
								{{ t('cookies.title') }}
							</h2>
							<p class="mt-1 text-sm text-muted">
								{{ t('cookies.description') }}
							</p>
						</div>
					</div>

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

						<div class="rounded-xl border border-default bg-default p-3">
							<UCheckbox v-model="marketing">
								<template #label>
									<span class="font-medium text-highlighted">
										{{ t('cookies.marketingTitle') }}
									</span>
								</template>
								<template #description>
									{{ t('cookies.marketingDescription') }}
								</template>
							</UCheckbox>
						</div>
					</div>
				</div>

				<template #footer>
					<div class="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
						<UButton
							color="neutral"
							variant="outline"
							class="justify-center"
							@click="saveNecessaryOnly"
						>
							{{ t('cookies.necessaryOnly') }}
						</UButton>
						<UButton
							color="neutral"
							variant="soft"
							class="justify-center"
							@click="saveCurrentChoice"
						>
							{{ t('cookies.saveChoice') }}
						</UButton>
						<UButton class="justify-center" @click="acceptAllCookies">
							{{ t('cookies.acceptAll') }}
						</UButton>
					</div>
				</template>
			</UCard>
		</div>
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
const marketing = ref(preferences.value.marketing)
const { captureFromRoute } = useUtmParams()

watch(
	preferences,
	(value) => {
		analytics.value = value.analytics
		marketing.value = value.marketing
	},
	{ immediate: true },
)

function saveCurrentChoice() {
	saveChoice({
		analytics: analytics.value,
		marketing: marketing.value,
	})
	if (analytics.value) {
		captureFromRoute()
	}
}

function saveNecessaryOnly() {
	analytics.value = false
	marketing.value = false
	necessaryOnly()
}

function acceptAllCookies() {
	acceptAll()
	captureFromRoute()
}
</script>
