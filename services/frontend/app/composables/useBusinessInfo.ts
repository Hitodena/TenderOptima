import type { UserResponse } from '#shared/types'
import { appendBusinessInfoToBody, resolveBusinessInfo } from '#shared/utils/businessInfo'

let cachedUser: UserResponse | null = null
let loadPromise: Promise<UserResponse | null> | null = null

export function useBusinessInfo() {
	const { get } = useApi()
	const toast = useToast()

	const businessInfo = computed(() => resolveBusinessInfo(cachedUser))

	async function ensureLoaded(): Promise<string> {
		if (cachedUser) return resolveBusinessInfo(cachedUser)
		if (!loadPromise) {
			loadPromise = get<UserResponse>('/auth/me')
				.then((user) => {
					cachedUser = user
					return user
				})
				.catch(() => null)
				.finally(() => {
					loadPromise = null
				})
		}
		const user = await loadPromise
		return resolveBusinessInfo(user)
	}

	function insertIntoBody(body: Ref<string>, businessText?: string) {
		const text = (businessText ?? businessInfo.value).trim()
		if (!text) {
			toast.add({
				title: 'Визитная карточка не настроена',
				description: 'Заполните её в профиле',
				color: 'warning',
				actions: [{
					label: 'Профиль',
					onClick: () => { navigateTo('/profile?tab=business_card') },
				}],
			})
			return
		}
		body.value = appendBusinessInfoToBody(body.value, text)
	}

	return {
		businessInfo,
		ensureLoaded,
		insertIntoBody,
	}
}
