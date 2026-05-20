export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	typescript: { strict: true },

	modules: ['@nuxt/ui', 'nuxt-zod-i18n', '@nuxtjs/i18n', '@nuxt/eslint'],
	css: ['~/assets/css/main.css'],

	runtimeConfig: {
		public: {
			apiBase: 'http://localhost:8000/api',
		},
	},

	i18n: {
		locales: [{ code: 'ru', language: 'ru-RU' }],
		defaultLocale: 'ru',
	},

	ui: {
		theme: {
			transitions: true,
			colors: [
				'primary',
				'secondary',
				'error',
				'success',
				'warning',
				'info',
				'neutral',
			],
			defaultVariants: {
				color: 'primary',
				size: 'md',
			},
		},
	},
	fonts: {
		families: [
			{ name: 'Inter', provider: 'google', global: true },
			{ name: 'JetBrains Mono', provider: 'google', global: true },
		],
	},

	vite: {
		optimizeDeps: {
			include: ['@vue/devtools-core', '@vue/devtools-kit', 'axios', 'zod'],
		},
	},

	app: {
		head: {
			title: 'TenderOptima',
		},
	},
});
