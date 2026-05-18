// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',

	devtools: { enabled: true },
	typescript: { strict: true },

	modules: ['@nuxt/ui'],

	css: ['~/assets/css/main.css'],

	ui: {
		theme: {
			transitions: false,
			colors: ['primary', 'error', 'success', 'warning', 'info'],
			defaultVariants: {
				color: 'primary',
				size: 'md',
			},
		},
	},
});
