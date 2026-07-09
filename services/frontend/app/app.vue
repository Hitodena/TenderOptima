<template>
	<UApp>
		<UMain>
			<NuxtLayout>
				<NuxtPage />
			</NuxtLayout>
		</UMain>

		<ConsultationModal />
	</UApp>
</template>

<script lang="ts" setup>
useUtmParams().captureFromRoute()
</script>
