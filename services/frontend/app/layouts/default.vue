<template>
	<div class="min-h-screen flex flex-col">
		<UHeader
		mode="slideover"
		:menu="{ side: 'right' }"
		:toggle="auth.isAuthenticated.value || isLandingPage"
		class="sticky top-0 z-50 h-20 border-b border-default bg-default/95 backdrop-blur supports-backdrop-filter:bg-default/80"
	>
		<template #left>
			<ULink
to="/"
				class="flex items-center gap-2 font-bold text-2xl text-highlighted hover:opacity-80 transition-opacity">
				<UIcon name="i-lucide-package-search" class="w-8 h-8 text-primary" />
				TenderOptima
			</ULink>
		</template>

		<UNavigationMenu
			v-if="auth.isAuthenticated.value"
			:items="navItems"
			class="w-full justify-center"
		/>
		<UNavigationMenu
			v-else-if="isLandingPage"
			:items="landingNavItems"
			class="w-full justify-center"
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
		</template>

		<template #right>
			<div class="flex items-center gap-2">
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
v-if="!auth.isAuthenticated.value" to="/auth" color="neutral" variant="outline"
					leading-icon="i-lucide-log-in" label="Войти" size="lg" />
				<UDropdownMenu v-else :items="userMenuItems" :ui="{ content: 'w-48' }">
					<UButton color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down" size="lg">
						<span class="max-w-28 truncate text-base">{{ user?.full_name || user?.email }}</span>
					</UButton>
				</UDropdownMenu>
			</div>
		</template>
	</UHeader>

		<slot />
		<IdeaSuggestionModal v-model:open="ideaModalOpen" />
	</div>
</template>


<script lang="ts" setup>
import type { UserResponse } from '#shared/types'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import {
	subscriptionModulesSummary,
	subscriptionNavBadge,
	subscriptionPlansPath,
} from '#shared/utils/subscriptionDisplay'

const auth = useAuthStore()
const { get } = useApi()
const route = useRoute()

const ideaModalOpen = ref(false)
const user = ref<UserResponse | null>(null)

if (auth.isAuthenticated.value) {
	try {
		user.value = await get<UserResponse>('/auth/me')
	} catch {
		auth.clearToken()
		user.value = null
	}
}

const isLandingPage = computed(() => route.path === '/')

const isRequestsActive = computed(() => route.path.startsWith('/requests'))
const isTzAnalysisActive = computed(() => route.path.startsWith('/tz-analysis'))
const isProfileSubscriptionActive = computed(
	() =>
		route.path === '/subscription'
		|| (route.path === '/profile' && route.query.tab === 'subscription'),
)
const subscriptionBadge = computed(() => subscriptionNavBadge(user.value?.subscription))

const landingNavItems = computed<NavigationMenuItem[]>(() => [
	{ label: 'Возможности', to: '/#features' },
	{ label: 'Как работает', to: '/#tz-analysis' },
	{ label: 'Анализ ТЗ / КП', to: '/#tz-analysis' },
	{ label: 'FAQ', to: '/#faq' },
	{ label: 'Подписка', to: '/#subscription' },
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
				label: 'История',
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
