<template>
	<UPopover
		mode="hover"
		:open-delay="200"
		:content="{ side: 'bottom', align: 'start', sideOffset: 8 }"
		class="inline-flex shrink-0"
	>
		<button
			type="button"
			class="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated text-muted transition-colors hover:bg-accented hover:text-default"
			aria-label="Информация о поставщике"
			@click.stop
		>
			<UIcon name="i-lucide-info" class="size-3.5" />
		</button>

		<template #content>
			<div class="max-w-sm p-4 space-y-3 text-sm">
				<p class="font-semibold text-highlighted">{{ supplier.company_name }}</p>

				<div v-if="supplier.domain" class="space-y-0.5">
					<p class="text-xs font-medium text-muted uppercase tracking-wide">Домен</p>
					<a
						:href="toExternalUrl(supplier.domain)"
						target="_blank"
						class="text-primary hover:underline break-all"
						@click.stop
					>
						{{ formatDomainLabel(supplier.domain) }}
					</a>
				</div>

				<div class="space-y-0.5">
					<p class="text-xs font-medium text-muted uppercase tracking-wide">Email</p>
					<p class="text-default break-all">{{ supplier.main_email }}</p>
					<p
						v-for="email in extraEmails"
						:key="email"
						class="text-muted break-all"
					>
						{{ email }}
					</p>
				</div>
			</div>
		</template>
	</UPopover>
</template>

<script lang="ts" setup>
import type { Supplier } from '#shared/types'

const props = defineProps<{
	supplier: Supplier
}>()

const extraEmails = computed(() =>
	(props.supplier.extra_emails ?? []).filter(
		(email) => email && email !== props.supplier.main_email,
	),
)

function toExternalUrl(domain: string) {
	const trimmed = domain.trim()
	if (/^https?:\/\//i.test(trimmed)) return trimmed
	return `https://${trimmed}`
}

function formatDomainLabel(domain: string) {
	return domain.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}
</script>
