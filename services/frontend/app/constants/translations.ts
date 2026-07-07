/**
 * Central UI translations for TenderOptima frontend.
 * Add new user-facing strings here; do not hardcode them in components.
 */
export const translations = {
	admin: {
		errors: {
			dateColumn: 'Дата',
			timeColumn: 'Время',
			userColumn: 'Пользователь',
			pageColumn: 'Страница',
			requestColumn: 'Метод / URL',
			statusColumn: 'Статус',
			messageColumn: 'Сообщение',
			backendResponseColumn: 'Ответ бэкенда',
			actionsColumn: 'Действия',
			copyRow: 'Копировать строку',
			copyRowSuccess: 'Строка скопирована',
			copyRowError: 'Не удалось скопировать',
			showMore: 'Показать полностью',
			showLess: 'Свернуть',
			empty: 'Ошибок нет',
			totalLabel: 'Всего записей:',
		},
	},
} as const

export type TranslationKey = typeof translations

/** Resolve a nested translation value by dot-path, e.g. `admin.errors.copyRow`. */
export function t(path: string): string {
	const parts = path.split('.')
	let current: unknown = translations
	for (const part of parts) {
		if (current === null || typeof current !== 'object' || !(part in current)) {
			return path
		}
		current = (current as Record<string, unknown>)[part]
	}
	return typeof current === 'string' ? current : path
}
