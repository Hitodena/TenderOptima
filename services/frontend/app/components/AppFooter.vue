<template>
	<footer class="app-footer shrink-0 border-t border-default bg-default px-4 py-3 sm:px-6 lg:px-8">
		<div
			class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-center text-xs text-muted sm:flex-row sm:gap-3 sm:text-left sm:text-sm"
		>
			<p class="min-w-0">
				&copy; TenderOptima, {{ currentYear }}. Все права защищены
			</p>

			<nav
				class="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 sm:justify-end sm:gap-x-2"
			>
				<NuxtLink
					:to="legalLinks[0].to"
					class="transition-colors hover:text-default"
				>
					{{ legalLinks[0].label }}
				</NuxtLink>
				<span class="shrink-0 text-border" aria-hidden="true">|</span>
				<NuxtLink
					:to="legalLinks[1].to"
					class="transition-colors hover:text-default"
				>
					{{ legalLinks[1].label }}
				</NuxtLink>
			</nav>
		</div>
	</footer>
</template>

<script setup lang="ts">
import { LEGAL_LINKS } from '#shared/constants/landing'

const currentYear = new Date().getFullYear()
const legalLinks = LEGAL_LINKS
</script>
