<template>
	<div class="landing-topbar border-b border-default bg-elevated/60 px-4 sm:px-6 lg:px-8">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 py-2 text-sm">
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
				<a
					:href="`tel:${contactPhone}`"
					class="inline-flex items-center gap-1.5 transition-colors hover:text-highlighted"
				>
					<UIcon name="i-lucide-phone" class="size-3.5 shrink-0 text-primary" />
					{{ contactPhoneDisplay }}
				</a>
				<a
					:href="`mailto:${contactEmail}`"
					class="inline-flex items-center gap-1.5 transition-colors hover:text-highlighted"
				>
					<UIcon name="i-lucide-mail" class="size-3.5 shrink-0 text-primary" />
					{{ contactEmail }}
				</a>
				<span class="hidden items-center gap-1.5 sm:inline-flex">
					<UIcon name="i-lucide-clock" class="size-3.5 shrink-0 text-primary" />
					пн-пт 9:00-18:00
				</span>
			</div>
			<button
				type="button"
				class="landing-topbar-callback inline-flex cursor-pointer items-center gap-1.5 font-medium text-primary transition-opacity hover:opacity-80"
				@click="consultation.open()"
			>
				<UIcon name="i-lucide-phone-call" class="size-3.5" />
				Обратный звонок
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
const consultation = useConsultationModal()
const { public: publicConfig } = useRuntimeConfig()

const contactEmail = publicConfig.contactEmail
const contactPhone = computed(() => String(publicConfig.contactPhone).replace(/\s/g, ''))
const contactPhoneDisplay = computed(() => String(publicConfig.contactPhone))
</script>
