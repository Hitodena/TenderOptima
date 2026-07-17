<template>
	<div class="min-h-screen flex flex-col">
		<UHeader :toggle="false" class="h-20 border-b border-default">
			<template #left>
				<AppLogo />
			</template>

			<template #right>
				<UColorModeButton />
			</template>
		</UHeader>

		<slot />
	</div>
</template>
