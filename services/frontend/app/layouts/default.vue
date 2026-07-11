<template>
	<div class="min-h-screen flex flex-col">
		<UHeader
		mode="slideover"
		:menu="{ side: 'right' }"
		:toggle="auth.isAuthenticated.value || isLandingPage"
		class="sticky top-0 z-50 h-20 border-b border-default bg-default/95 backdrop-blur supports-backdrop-filter:bg-default/80"
		:ui="headerUi"
	>
		<template #left>
			<AppLogo />
		</template>

		<UNavigationMenu
			v-if="auth.isAuthenticated.value"
			:items="navItems"
			class="w-full justify-center"
		/>
		<UNavigationMenu
			v-else-if="isLandingPage"
			:items="landingNavItems"
			class="hidden w-full min-w-0 justify-center lg:flex"
		/>

		<template #body>
			<UNavigationMenu
				v-if="auth.isAuthenticated.value"
				:items="navItems"
				orientation="vertical"
				class="-mx-2.5"
			/>
			<UNavigationMenu
				v-else-if="isLandingPage"
				:items="landingNavItems"
				orientation="vertical"
				class="-mx-2.5"
			/>
			<div v-if="!auth.isAuthenticated.value" class="mt-4 flex flex-col gap-2">
				<UButton
					block
					size="lg"
					leading-icon="i-lucide-play-circle"
					:label="landingCtaLabel"
					class="landing-btn-primary"
					@click="consultation.open()"
				/>
				<UButton
					to="/auth"
					color="neutral"
					variant="outline"
					leading-icon="i-lucide-log-in"
					label="Войти"
					block
					size="lg"
				/>
			</div>
		</template>

		<template #right>
			<div class="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5 lg:gap-2">
				<UColorModeButton />
				<UButton
					v-if="auth.isAuthenticated.value"
					color="neutral"
					variant="ghost"
					icon="i-lucide-lightbulb"
					size="lg"
					title="Предложить идею"
					@click="ideaModalOpen = true"
				/>
				<UButton
					v-if="!auth.isAuthenticated.value"
					to="/auth"
					color="neutral"
					variant="outline"
					icon="i-lucide-log-in"
					size="lg"
					title="Войти"
					aria-label="Войти"
					class="hidden sm:inline-flex"
				/>
				<UButton
					v-if="!auth.isAuthenticated.value && isLandingPage"
					size="lg"
					icon="i-lucide-play-circle"
					:title="landingCtaLabel"
					:aria-label="landingCtaLabel"
					class="hidden sm:inline-flex landing-btn-primary"
					@click="consultation.open()"
				/>
				<UDropdownMenu
					v-if="auth.isAuthenticated.value"
					:items="userMenuItems"
					:ui="{ content: 'w-48' }"
				>
					<UButton color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down" size="lg">
						<span class="max-w-28 truncate text-base">{{ user?.full_name || user?.email }}</span>
					</UButton>
				</UDropdownMenu>
			</div>
		</template>
	</UHeader>

		<div class="flex-1">
			<slot />
		</div>
		<AppFooter />
		<IdeaSuggestionModal v-model:open="ideaModalOpen" />
	</div>
</template>


<script lang="ts" setup>
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import {
	subscriptionModulesSummary,
	subscriptionNavBadge,
	subscriptionPlansPath,
} from '#shared/utils/subscriptionDisplay'
import { LANDING_CTA_LABEL } from '#shared/constants/landing'
import { t } from '~/constants/translations'

const auth = useAuthStore()
const consultation = useConsultationModal()
const route = useRoute()
const landingCtaLabel = LANDING_CTA_LABEL

const ideaModalOpen = ref(false)
const { user, ensureLoaded } = useCurrentUser()

if (auth.isAuthenticated.value) {
	await ensureLoaded()
}

const MARKETING_ROUTES = new Set(['/', '/product', '/security', '/contacts', '/faq', '/pricing', '/cases'])
const isLandingPage = computed(() => MARKETING_ROUTES.has(route.path))

const headerUi = computed(() => {
	const isLandingGuest = isLandingPage.value && !auth.isAuthenticated.value

	if (!isLandingGuest) {
		return {}
	}

	return {
		root: 'landing-site-header',
		container: 'flex w-full items-center gap-2 sm:gap-3 lg:gap-4',
		left: 'shrink-0',
		center: 'flex min-w-0 flex-1 justify-center',
		right: 'flex shrink-0 items-center justify-end gap-1 sm:gap-1.5 lg:gap-2',
	}
})

const isRequestsActive = computed(() => route.path.startsWith('/requests'))
const isTzAnalysisActive = computed(() => route.path.startsWith('/tz-analysis'))
const isProfileSubscriptionActive = computed(
	() =>
		route.path === '/subscription'
		|| (route.path === '/profile' && (route.query.tab === 'subscription' || route.query.tab === 'acts')),
)
const subscriptionBadge = computed(() => subscriptionNavBadge(user.value?.subscription))

const landingNavItems = computed<NavigationMenuItem[]>(() => [
	{
		label: 'Продукт',
		icon: 'i-lucide-layout-grid',
		to: '/#supplier-search',
		children: [
			{
				label: 'Поиск поставщиков',
				icon: 'i-lucide-search',
				to: '/#supplier-search',
				description: 'Автопоиск компаний по запросу и региону',
			},
			{
				label: 'Рассылка и переписка',
				icon: 'i-lucide-send',
				to: '/#requests',
				description: 'Запросы поставщикам и входящие ответы в одном окне',
			},
			{
				label: 'Анализ ТЗ и КП',
				icon: 'i-lucide-scan-search',
				to: '/#tz-analysis',
				description: 'AI-сверка коммерческих предложений с требованиями',
			},
			{
				label: 'Для кого',
				icon: 'i-lucide-users',
				to: '/#icp',
				description: 'От специалиста по закупкам до руководителя',
			},
		],
	},
	{ label: 'Тарифы', icon: 'i-lucide-credit-card', to: '/#pricing' },
	{ label: 'Кейсы', icon: 'i-lucide-briefcase', to: '/#cases' },
	{ label: 'Контакты', icon: 'i-lucide-mail', to: '/#contacts' },
])

const navItems = computed<NavigationMenuItem[]>(() => [
	{
		label: 'Запросы',
		icon: 'i-lucide-layers',
		active: isRequestsActive.value,
		to: '/requests',
		badge: user.value?.subscription?.module_1_enabled === false
			? { label: 'М1 выкл.', color: 'warning' as const, variant: 'subtle' as const, size: 'sm' as const }
			: undefined,
		children: [
			{
				label: 'Поиск',
				icon: 'i-lucide-search',
				to: '/requests',
				description: "Начать новый поиск."
			},
			{
				label: 'История',
				icon: 'i-lucide-history',
				to: '/requests/history',
				description: "Показать полную историю запросов."
			},
		],
	},
	{
		label: 'Анализ Предложений',
		icon: 'i-lucide-file-search',
		active: isTzAnalysisActive.value,
		to: '/tz-analysis',
		badge: user.value?.subscription?.module_2_enabled === false
			? { label: 'М2 выкл.', color: 'warning' as const, variant: 'subtle' as const, size: 'sm' as const }
			: undefined,
		children: [
			{
				label: 'Новый анализ',
				icon: 'i-lucide-scan-search',
				to: '/tz-analysis',
				description: 'Сравнение ТЗ с коммерческим предложением',
			},
			{
				label: t('navigation.offerHistory'),
				icon: 'i-lucide-history',
				to: '/tz-analysis/history',
				description: 'Активные, в обработке и завершённые анализы',
			},
		],
	},
	{
		label: 'Подписка',
		icon: 'i-lucide-credit-card',
		active: isProfileSubscriptionActive.value,
		to: subscriptionPlansPath(),
		description: subscriptionModulesSummary(user.value?.subscription),
		badge: {
			label: subscriptionBadge.value.label,
			color: subscriptionBadge.value.color,
			variant: 'subtle',
			size: 'sm',
		},
	},
])



const userMenuItems = computed<DropdownMenuItem[][]>(() => {
	const sections: DropdownMenuItem[][] = [
		[
			{
				label: user.value?.email,
				disabled: true,
				icon: 'i-lucide-mail',
			},
		],
		[
			{
				label: 'Профиль',
				icon: 'i-lucide-user',
				to: '/profile',
			},
		],
	]

	if (user.value?.is_admin) {
		sections.push([
			{
				label: 'Админка',
				icon: 'i-lucide-shield',
				to: '/admin',
			},
		])
	}

	sections.push([
		{
			label: 'Выйти',
			icon: 'i-lucide-log-out',
			color: 'error' as const,
			onSelect: () => {
				auth.clearToken()
				navigateTo('/auth')
			},
		},
	])

	return sections
})
</script>
