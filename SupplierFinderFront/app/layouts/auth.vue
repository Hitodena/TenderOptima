<template>
	<UHeader>
		<template #left>
			<ULink to="/"
				class="flex items-center gap-2 font-bold text-lg text-highlighted hover:opacity-80 transition-opacity">
				<UIcon name="i-lucide-package-search" class="w-5 h-5 text-primary" />
				SupplierFinder
			</ULink>
		</template>

		<template #right>
			<UColorModeButton />
		</template>
	</UHeader>

	<slot />
</template>
