<template>
	<div class="min-h-screen flex flex-col">
		<UHeader :toggle="false" class="h-20 border-b border-default">
			<template #left>
				<ULink to="/"
					class="flex items-center gap-2 font-bold text-2xl text-highlighted hover:opacity-80 transition-opacity">
					<UIcon name="i-lucide-package-search" class="w-8 h-8 text-primary" />
					TenderOptima
				</ULink>
			</template>

			<template #right>
				<UColorModeButton />
			</template>
		</UHeader>

		<slot />
	</div>
</template>
