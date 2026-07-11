<template>
	<UApp>
		<UMain>
			<NuxtLayout>
				<NuxtPage />
			</NuxtLayout>
		</UMain>

		<ConsultationModal />
		<CookieConsentBanner />
	</UApp>
</template>

<script lang="ts" setup>
useUtmParams().captureFromRoute()
</script>
