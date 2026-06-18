<template>
	<UFooter class="border-t border-default">
		<template #left>
			<p class="text-muted text-sm">
				&copy; TenderOptima, {{ currentYear }}
			</p>
		</template>

		<template #right>
			<div class="flex flex-col items-end gap-1 text-sm text-muted sm:flex-row sm:items-center sm:gap-4">
				<a
					href="mailto:support@tenderoptima.by"
					class="hover:text-default transition-colors"
				>
					support@tenderoptima.by
				</a>
				<span class="hidden sm:inline">|</span>
				<span>пн–пт 9:00–18:00</span>
			</div>
		</template>
	</UFooter>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>
