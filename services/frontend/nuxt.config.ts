export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	typescript: { strict: true },

	modules: [
		'@nuxt/ui',
		'nuxt-zod-i18n',
		'@nuxtjs/i18n',
		'@nuxt/eslint',
		'nuxt-skill-hub',
	],
	css: ['~/assets/css/main.css'],

	runtimeConfig: {
		public: {
			apiBase: String(import.meta.env.API_BASE ?? '/api'),
			maxUploadFiles: Number(import.meta.env.MAX_UPLOAD_FILES ?? '2'),
			maxUploadSize: Number(
				import.meta.env.MAX_UPLOAD_SIZE ?? (10 * 1024 * 1024).toString(),
			),
			contactEmail: String(
				import.meta.env.CONTACT_EMAIL ?? 'support@tenderoptima.by',
			),
			contactPhone: String(
				import.meta.env.CONTACT_PHONE ?? '+375291234567',
			),
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
