<template>
	<UHeader>
		<template #left>
			<ULink to="/"
				class="flex items-center gap-5 font-bold text-lg text-highlighted hover:opacity-80 transition-opacity">
				<UIcon name="i-lucide-package-search" class="w-5 h-5 text-primary" />
				TenderOptima
			</ULink>
		</template>

		<UNavigationMenu v-if="auth.isAuthenticated.value" :items="navItems" />

		<template #right>
			<div class="flex items-center gap-5">
				<UColorModeButton />
				<UButton v-if="!auth.isAuthenticated.value" to="/auth" color="neutral" variant="outline"
					leading-icon="i-lucide-log-in" label="Войти" />
				<UDropdownMenu v-else :items="userMenuItems">
					<UButton color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down">
						<span class="max-w-28 truncate text-sm">{{ user?.full_name || user?.email }}</span>
					</UButton>
				</UDropdownMenu>
			</div>
		</template>
	</UHeader>

	<slot />
</template>


<script lang="ts" setup>
import type { UserResponse } from '#shared/types'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const auth = useAuthStore()
const { get } = useApi()
const route = useRoute()

const user = ref<UserResponse | null>(null)

if (auth.isAuthenticated.value) {
	try {
		user.value = await get<UserResponse>('/auth/me')
	} catch { }
}

const isRequestsActive = computed(() => route.path.startsWith('/requests'))

const navItems = computed<NavigationMenuItem[]>(() => [
	{
		label: 'Запросы',
		icon: 'i-lucide-layers',
		active: isRequestsActive.value,
		children: [
			{
				label: 'История запросов',
				description: 'Все ваши поисковые запросы',
				icon: 'i-lucide-history',
				to: '/requests',
			},
			{
				label: 'Чёрный список',
				description: 'Исключённые домены',
				icon: 'i-lucide-shield-off',
				to: '/requests/blacklist',
			},
		],
	},
	{
		label: 'Анализ ТЗ',
		icon: 'i-lucide-file-search',
		disabled: true,
		badge: { label: 'Скоро', color: 'neutral', variant: 'subtle', size: 'sm' },
	},
])


const userMenuItems = computed<DropdownMenuItem[][]>(() => [
	[
		{
			label: user.value?.email,
			disabled: true,
			icon: 'i-lucide-mail',
		},
	],
	[{
		label: 'Профиль',
		icon: 'i-lucide-user',
		disabled: true
	},
	{
		label: 'Подписка',
		icon: 'i-lucide-credit-card',
		disabled: true,
	}
	],
	[
		{
			label: 'Выйти',
			icon: 'i-lucide-log-out',
			color: 'error' as const,
			onSelect: () => {
				auth.clearToken()
				navigateTo('/auth')
			}
		}
	]

])
</script>
