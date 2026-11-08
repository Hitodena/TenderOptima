<template>
	<nav
		aria-label="Основная навигация"
		class="app-mobile-tabbar fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-default bg-default/95 backdrop-blur lg:hidden"
	>
		<NuxtLink
			v-for="tab in tabs"
			:key="tab.key"
			:to="tab.to"
			class="relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors"
			:class="tab.active ? 'font-semibold text-primary' : 'font-medium text-muted'"
			:aria-current="tab.active ? 'page' : undefined"
		>
			<UIcon :name="tab.icon" class="size-6" />
			<span>{{ tab.label }}</span>
			<span
				v-if="tab.badge"
				class="absolute top-2 left-1/2 ml-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-700 px-1 text-[11px] font-bold text-white"
				:aria-label="`Новых ответов: ${tab.badge}`"
			>{{ tab.badge > 99 ? '99+' : tab.badge }}</span>
		</NuxtLink>
		<button
			type="button"
			class="flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors"
			:class="moreOpen || moreActive ? 'font-semibold text-primary' : 'font-medium text-muted'"
			@click="moreOpen = true"
		>
			<UIcon name="i-lucide-ellipsis" class="size-6" />
			<span>Ещё</span>
		</button>
	</nav>

	<UDrawer v-model:open="moreOpen" title="Ещё" :ui="{ content: 'lg:hidden' }">
		<template #body>
			<div class="flex flex-col gap-4 pb-4">
				<NuxtLink
					to="/profile"
					class="flex items-center gap-3 rounded-2xl border border-default p-3"
					@click="moreOpen = false"
				>
					<span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
						{{ initials }}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-semibold">{{ user?.full_name || user?.email }}</span>
						<span class="block truncate text-sm text-muted">{{ user?.email }} · профиль</span>
					</span>
					<UIcon name="i-lucide-chevron-right" class="size-5 text-dimmed" />
				</NuxtLink>

				<div class="flex flex-col overflow-hidden rounded-2xl border border-default">
					<p class="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">Модули</p>
					<NuxtLink
						v-for="item in moduleItems"
						:key="item.to"
						:to="item.to"
						class="flex min-h-13 items-center gap-3 border-t border-default/60 px-4 first-of-type:border-t-0"
						@click="moreOpen = false"
					>
						<UIcon :name="item.icon" class="size-5 text-primary" />
						<span class="flex-1">{{ item.label }}</span>
						<UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
					</NuxtLink>
				</div>

				<div class="flex flex-col overflow-hidden rounded-2xl border border-default">
					<NuxtLink
						:to="subscriptionPath"
						class="flex min-h-13 items-center gap-3 px-4"
						@click="moreOpen = false"
					>
						<UIcon name="i-lucide-credit-card" class="size-5 text-muted" />
						<span class="flex-1">Подписка</span>
						<span class="text-sm text-muted">{{ subscriptionLabel }}</span>
					</NuxtLink>
					<label class="flex min-h-13 cursor-pointer items-center gap-3 border-t border-default/60 px-4">
						<UIcon name="i-lucide-moon" class="size-5 text-muted" />
						<span class="flex-1">Тёмная тема</span>
						<USwitch v-model="isDark" aria-label="Тёмная тема" />
					</label>
					<button
						type="button"
						class="flex min-h-13 items-center gap-3 border-t border-default/60 px-4 text-left"
						@click="openIdea"
					>
						<UIcon name="i-lucide-lightbulb" class="size-5 text-muted" />
						<span class="flex-1">Идея или проблема</span>
					</button>
					<NuxtLink
						v-if="user?.is_admin"
						to="/admin"
						class="flex min-h-13 items-center gap-3 border-t border-default/60 px-4"
						@click="moreOpen = false"
					>
						<UIcon name="i-lucide-shield" class="size-5 text-muted" />
						<span class="flex-1">Админка</span>
					</NuxtLink>
				</div>

				<UCollapsible class="rounded-2xl border border-default">
					<button type="button" class="flex min-h-13 w-full items-center gap-3 px-4 text-left">
						<UIcon name="i-lucide-file-text" class="size-5 text-muted" />
						<span class="flex-1">Документы</span>
						<UIcon name="i-lucide-chevron-down" class="size-4 text-dimmed" />
					</button>
					<template #content>
						<div class="flex flex-col pb-2">
							<a
								v-for="link in legalLinks"
								:key="link.href"
								:href="link.href"
								target="_blank"
								rel="noopener noreferrer"
								class="flex min-h-11 items-center px-4 text-sm text-muted"
							>{{ link.label }}</a>
						</div>
					</template>
				</UCollapsible>

				<UButton
					color="error"
					variant="outline"
					size="xl"
					block
					label="Выйти"
					@click="logout"
				/>
			</div>
		</template>
	</UDrawer>
</template>

<script lang="ts" setup>
import type { RequestHistoryPageResponse } from '#shared/types'
import { RequestHistoryGroup } from '#shared/types'
import {
	subscriptionNavBadge,
	subscriptionPlansPath,
} from '#shared/utils/subscriptionDisplay'
import { companyInitials } from '#shared/utils/emailThread'
import { LEGAL_LINKS } from '#shared/constants/landing'
import { t } from '~/constants/translations'

const emit = defineEmits<{ idea: [] }>()

const route = useRoute()
const auth = useAuthStore()
const { user } = useCurrentUser()
const { get } = useApi()
const colorMode = useColorMode()

const moreOpen = ref(false)
const legalLinks = LEGAL_LINKS
const unread = useState<number>('mobile-tabbar-unread', () => 0)

const isDark = computed({
	get: () => colorMode.value === 'dark',
	set: (dark: boolean) => { colorMode.preference = dark ? 'dark' : 'light' },
})

const initials = computed(() => companyInitials(user.value?.full_name || user.value?.email || ''))
const subscriptionPath = computed(() => subscriptionPlansPath())
const subscriptionLabel = computed(() => subscriptionNavBadge(user.value?.subscription).label)

const moduleItems = computed(() => {
	const items = [
		{ label: 'Анализ предложений', icon: 'i-lucide-file-search', to: '/tz-analysis' },
		{ label: t('navigation.offerHistory'), icon: 'i-lucide-history', to: '/tz-analysis/history' },
	]
	if (user.value?.is_admin) {
		items.push({ label: 'Конструктор ТЗ', icon: 'i-lucide-file-plus-2', to: '/tz-creation' })
	}
	return items
})

const moreActive = computed(() =>
	['/tz-analysis', '/tz-creation', '/profile', '/subscription', '/admin'].some(p => route.path.startsWith(p)),
)

const tabs = computed(() => [
	{ key: 'home', label: 'Главная', icon: 'i-lucide-house', to: '/', active: route.path === '/', badge: 0 },
	{ key: 'search', label: 'Поиск', icon: 'i-lucide-search', to: '/requests', active: route.path === '/requests', badge: 0 },
	{
		key: 'requests',
		label: 'Запросы',
		icon: 'i-lucide-inbox',
		to: '/requests/history',
		active: route.path.startsWith('/requests/') ,
		badge: unread.value,
	},
])

// new supplier letters across the active requests (first page is enough
// for a badge; the history page shows the exact numbers per request)
let lastFetch = 0
async function refreshUnread() {
	if (!auth.isAuthenticated.value) return
	const now = Date.now()
	if (now - lastFetch < 15_000) return
	lastFetch = now
	try {
		const res = await get<RequestHistoryPageResponse>('/requests/history', {
			params: { group: RequestHistoryGroup.ACTIVE, page: 1, size: 50 },
		})
		unread.value = res.items.reduce((sum, r) => sum + (r.supplier_messages_unread ?? 0), 0)
	} catch {
		// the badge is a hint; keep the last value
	}
}

onMounted(refreshUnread)
watch(() => route.fullPath, () => {
	moreOpen.value = false
	void refreshUnread()
})

function openIdea() {
	moreOpen.value = false
	emit('idea')
}

function logout() {
	moreOpen.value = false
	auth.clearToken()
	navigateTo('/auth')
}
</script>
