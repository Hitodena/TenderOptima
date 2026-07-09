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
		emailRouting: {
			tabLabel: 'Почта',
			totalLabel: 'Всего писем:',
			missingSubjectOnly: 'Только без темы',
			missingSubjectHint: 'Входящие письма поставщиков с пустой темой (ответы без subject)',
			empty: 'Писем нет',
			incoming: 'Входящее',
			outgoing: 'Исходящее',
			fromColumn: 'От',
			toColumn: 'Кому',
			mailboxColumn: 'Ящик пользователя',
			matchedByColumn: 'Сопоставление',
			confidenceColumn: 'Уверенность',
			userColumn: 'Пользователь',
			supplierColumn: 'Поставщик',
			dateColumn: 'Дата',
			requestColumn: 'Заявка',
			trackingColumn: 'TID',
			linkColumn: 'Связь RS',
			technicalTitle: 'Технические данные',
			messageId: 'Message-ID',
			imapId: 'IMAP ID',
			relinkTitle: 'Переназначить привязку',
			relinkHint: 'UUID связи request-supplier',
			recipientTitle: 'Изменить получателя',
			recipientHint: 'Email получателя для этой связи',
			save: 'Сохранить',
			relinkSuccess: 'Привязка обновлена',
			recipientSuccess: 'Получатель обновлён',
			saveError: 'Не удалось сохранить',
			loadError: 'Не удалось загрузить письма',
			matchedBy: {
				tracking_id: 'TID в теме/теле',
				message_id: 'In-Reply-To / References',
				sender_recipient: 'Отправитель ↔ получатель',
				outbound: 'Исходящая отправка',
				manual: 'Вручную',
				unknown: 'Не зафиксировано',
			},
			confidence: {
				high: 'Высокая',
				medium: 'Средняя',
				manual: 'Вручную',
				n_a: '—',
				unknown: 'Не зафиксировано',
			},
		},
		users: {
			registeredAt: 'Регистрация',
			lastLogin: 'Последний вход',
			noLastLogin: 'ещё не входил',
			emailsSent: 'Писем отправлено',
			pagesAnalyzed: 'Страниц проанализировано',
			pagesRemaining: 'Страниц осталось',
			pagesPerMonth: 'Страниц / мес',
		},
	},
	profile: {
		mailTab: 'Почта',
		mailTitle: 'Настройки почты',
		mailDescription: 'Письма будут отправляться от указанного ящика. Для входящих ответов настройте IMAP.',
		currentSenderEmail: 'Email отправителя',
		currentSenderHint: 'С этого адреса уходят письма поставщикам.',
		customMailboxSection: 'Подключить свой ящик',
		customMailboxExpand: 'Настроить SMTP/IMAP',
		customMailboxCollapse: 'Свернуть настройки',
		mailManual: 'Заполните SMTP/IMAP host, логин и пароль приложения. Письма будут отправляться от указанного ящика. Порты задаются в конфигурации сервера.',
		smtpSection: 'SMTP (отправка)',
		imapSection: 'IMAP (получение ответов)',
		smtpHost: 'SMTP host',
		smtpUser: 'SMTP login',
		smtpPassword: 'SMTP password',
		imapHost: 'IMAP host',
		imapUser: 'IMAP login',
		imapPassword: 'IMAP password',
		passwordConfiguredHint: 'Пароль сохранён. Оставьте пустым, чтобы не менять.',
		clearPassword: 'Очистить пароль',
		saveMail: 'Сохранить почту',
		mailSaved: 'Почтовые настройки сохранены',
		mailSaveError: 'Ошибка сохранения почты',
		mailLoadError: 'Не удалось загрузить настройки почты',
	},
	subscription: {
		pagesPerMonth: 'Страниц в месяц',
		pagesRemaining: 'Страниц осталось',
		pagesRemainingThisMonth: 'Осталось {count} страниц анализа в этом месяце',
		pagesUnlimited: 'Анализ страниц без месячного лимита',
	},
	requests: {
		mailingCompletedHint: 'Рассылка завершена',
		mailingCompletedSubhint:
			'Можно добавить поставщиков и отправить запрос тем, кому письмо ещё не отправлено.',
		mailingPendingHint:
			'Выберите поставщиков без отправленного письма и нажмите «Отправить запрос»',
		receivedLettersStats:
			'Получено {emails} {emailsLabel} от {suppliers} {suppliersLabel}',
	},
	tzAnalysis: {
		kpProcessingBanner:
			'Анализ коммерческих предложений выполняется. Уже готовые поставщики доступны для изучения.',
		kpProcessingBannerHint:
			'Ожидайте до 2 часов. Страница обновится автоматически.',
		kpSupplierProcessing:
			'Анализ КП для «{name}» выполняется…',
		kpSupplierProcessingHint:
			'Ожидайте. Страница обновится автоматически.',
		statusNotCompare: 'Не сравнивать',
		statusNotCompareHint:
			'Статус ставится только вручную и не попадает в письмо поставщику',
	},
	inbox: {
		insertBusinessInfo: 'Вставить реквизиты',
		receiptAcknowledgement: 'Ответ о получении',
		receiptModalTitle: 'Ответ о получении',
		receiptIntro: 'Благодарим за предоставление информации. Мы обработаем ваше коммерческое предложение и направим ответ в ближайшее время.',
		receiptTemplateTitle: 'Ответ о получении',
		receiptTemplateSubject: 'Подтверждение получения',
		replyPlaceholder: 'Текст сообщения...',
		insertIntoReply: 'Вставить в ответ',
		cancel: 'Отмена',
		openSupplierThread: 'Открыть переписку с поставщиком',
		saveToDatabase: 'Сохранить в базу',
		incomingCountLabel: 'Входящие: {count}',
		you: 'Вы',
		quickReplyTemplates: 'Быстрые ответы',
		quickReplyTemplatesSettings: 'Настройка быстрых ответов',
		letterTemplates: 'Шаблоны писем',
		templatesAdd: 'Добавить',
		templatesEmpty: 'Нет шаблонов',
		templatesGlobal: 'Общий',
		templatesCreateTitle: 'Новый шаблон',
		templatesEditTitle: 'Редактировать шаблон',
		templatesFormTitle: 'Заголовок',
		templatesFormTitlePlaceholder: 'Например: Ответ о получении',
		templatesFormSubject: 'Тема письма',
		templatesFormSubjectPlaceholder: 'Тема письма',
		templatesFormBody: 'Текст',
		templatesFormBodyPlaceholder:
			'Текст письма. Можно использовать {company_name} для подстановки названия компании.',
		templatesSave: 'Сохранить шаблон',
		templatesSaveChanges: 'Сохранить изменения',
		templatesLoadError: 'Не удалось загрузить шаблоны',
		templatesFormIncomplete: 'Заполните все поля шаблона',
		templatesSaved: 'Шаблон сохранён',
		templatesUpdated: 'Шаблон обновлён',
		templatesSaveError: 'Не удалось сохранить шаблон',
		templatesUpdateError: 'Не удалось обновить шаблон',
		templatesDeleted: 'Шаблон удалён',
		templatesDeleteError: 'Не удалось удалить шаблон',
		correctedManually: '(изменено вручную)',
		requisitesHint: 'Для лучшей обратной связи всегда оставляйте реквизиты.',
		businessCardMissing: 'Визитная карточка не настроена',
		businessCardMissingHint: 'Заполните её в профиле',
		profileLink: 'Профиль',
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
