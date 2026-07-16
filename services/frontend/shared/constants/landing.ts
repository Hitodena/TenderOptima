/** Temporary flag: hide pricing teaser + nav link on the marketing landing. */
export const SHOW_LANDING_PRICING_TEASER = false

export interface TrustStripItem {
	icon: string
	label: string
}

export const TRUST_STRIP_ITEMS: TrustStripItem[] = [
	{ icon: 'i-lucide-monitor-check', label: 'Работает в браузере' },
	{ icon: 'i-lucide-download-cloud', label: 'Без установки' },
	{ icon: 'i-lucide-zap', label: '×10 к скорости' },
	{ icon: 'i-lucide-target', label: 'до 95% точность' },
	{ icon: 'i-lucide-shield-check', label: '-80% рисков' },
]

/** Prominent hero trust badges - only factual claims, no fabricated certifications. */
export interface HeroTrustBadge {
	icon: string
	label: string
}

export const HERO_TRUST_BADGES: HeroTrustBadge[] = [
	{ icon: 'i-lucide-mail', label: 'Поиск поставщиков' },
	{ icon: 'i-lucide-zap', label: 'Анализ ТЗ и КП' },
	{ icon: 'i-lucide-crosshair', label: 'Выявление расхождений' },
]

/** Hero H1 — two lines, rendered as a single heading. */
export const HERO_TITLE_LINES = [
	'Находите подходящих поставщиков за минуты.',
	'Проверяйте сложные КП на соответствие ТЗ без лишней рутины.',
] as const

/** Primary public landing CTA - opens consultation modal (demo request). */
export const LANDING_CTA_LABEL = 'Посмотреть систему в деле'

export const LANDING_CTA_SECTION_TITLE = 'Посмотрите систему в деле'

/** Submit button label for the embedded consultation form in the landing CTA band. */
export const LANDING_CTA_FORM_SUBMIT_LABEL = 'Получить доступ на 14 дней'

/** Browser chrome title in landing mockups and screenshot frames. */
export const LANDING_MOCKUP_BROWSER_TITLE
	= 'TenderOptima - автоматизация процесса закупок'

/** Short browser chrome title when the mockup URL bar has limited space. */
export const LANDING_MOCKUP_BROWSER_TITLE_SHORT = 'TenderOptima'

/** JTBD bridge - interactive split-screen panels after hero. */
export interface JtbdBridgePanel {
	id: 'price-push' | 'tz-kp'
	tabLabel: string
	tabShort: string
	headline: string
	description: string
	trigger: string
	metrics: { value: string, label: string }[]
	accent: 'sky' | 'orange'
	icon: string
}

export const JTBD_BRIDGE_PANELS: JtbdBridgePanel[] = [
	{
		id: 'price-push',
		tabLabel: 'Сбор и дожим по цене',
		tabShort: 'Лучшая цена',
		headline: 'От запроса до лучшей цены - за 5 минут',
		description:
			'Забудьте про ручной поиск контактов и сотни писем в почте. Платформа сама найдёт поставщиков, разошлёт запросы и соберёт ответы в единую таблицу.',
		trigger:
			'Умный дожим по цене в один клик. Снижение стоимости контракта окупает подписку сразу.',
		metrics: [
			{ value: '−4 ч', label: 'на рутину' },
			{ value: '1 клик', label: 'для запроса скидки' },
		],
		accent: 'sky',
		icon: 'i-lucide-trending-down',
	},
	{
		id: 'tz-kp',
		tabLabel: 'Сверка сложного КП',
		tabShort: 'Проверка ТЗ',
		headline: '100 страниц ТЗ проверены за 15 минут',
		description:
			'Хватит вычитывать документы с лупой. AI-модуль сам сопоставит требования вашего ТЗ с предложением поставщика и подсветит каждую нестыковку.',
		trigger:
			'Автоматическая генерация письма с замечаниями. Нулевой риск купить не то оборудование.',
		metrics: [
			{ value: 'до 95%', label: 'точность сверки' },
			{ value: 'до 1 часа', label: 'вместо дней или недель' },
		],
		accent: 'orange',
		icon: 'i-lucide-scan-search',
	},
]

export interface PurchaseScenarioStep {
	icon: string
	title: string
	description: string
}

export const PURCHASE_SCENARIO_STEPS: PurchaseScenarioStep[] = [
	{
		icon: 'i-lucide-upload',
		title: 'Загрузили ТЗ',
		description: 'AI извлекает требования из технического задания - DOCX, PDF, сканы.',
	},
	{
		icon: 'i-lucide-search',
		title: 'Нашли поставщиков',
		description: 'Автопоиск компаний по запросу и региону поставки.',
	},
	{
		icon: 'i-lucide-send',
		title: 'Отправили запросы',
		description: 'Шаблон письма, параметры и рассылка - из одного экрана.',
	},
	{
		icon: 'i-lucide-inbox',
		title: 'Получили КП',
		description: 'Входящие ответы в едином интерфейсе с индикаторами новых сообщений.',
	},
	{
		icon: 'i-lucide-scan-search',
		title: 'AI сравнил',
		description: 'Сверка КП с требованиями ТЗ - таблица соответствия по каждому пункту.',
	},
	{
		icon: 'i-lucide-file-check',
		title: 'Экспортировали',
		description: 'Готовая таблица в XLSX/DOCX и письма поставщикам на уточнения.',
	},
]

/** «Рассылка запросов» - two-column block on the landing page. */
export interface RequestBroadcastHighlight {
	icon: string
	text: string
	iconBg: string
	iconColor: string
}

export const REQUEST_BROADCAST = {
	title: 'Быстрая отправка запросов и переписка с поставщиками - в несколько кликов',
	titleMobile: 'Работа с поставщиками в несколько кликов',
	subtitle:
		'',
	highlights: [
		{
			icon: 'i-lucide-badge-percent',
			text: 'Запрос скидки и уточнение условий',
			iconBg: 'bg-emerald-500/10 ring-1 ring-emerald-500/20',
			iconColor: 'text-emerald-600 dark:text-emerald-400',
		},
		{
			icon: 'i-lucide-file-text',
			text: 'Умные шаблоны писем для разных поставщиков',
			iconBg: 'bg-amber-500/10 ring-1 ring-amber-500/20',
			iconColor: 'text-amber-600 dark:text-amber-400',
		},
		{
			icon: 'i-lucide-inbox',
			text: 'Ответы поставщиков и переписка в одном окне',
			iconBg: 'bg-violet-500/10 ring-1 ring-violet-500/20',
			iconColor: 'text-violet-600 dark:text-violet-400',
		},
	] satisfies RequestBroadcastHighlight[],
}

export type ProductModuleGroup = 'supplier-search' | 'correspondence' | 'tz-kp'

export interface ProductModule {
	icon: string
	title: string
	description: string
	highlight: string
	image: string
	imageAlt: string
	group: ProductModuleGroup
}

export const PRODUCT_MODULES: ProductModule[] = [
	{
		icon: 'i-lucide-search',
		title: 'Поиск поставщиков',
		description: 'Автопоиск компаний по запросу и региону поставки с контактами для рассылки.',
		highlight: 'Скорость, фильтры, источник данных',
		image: '/landing/supplier_flow.gif',
		imageAlt: 'Поиск поставщиков по запросу и региону',
		group: 'supplier-search',
	},
	{
		icon: 'i-lucide-send',
		title: 'Рассылка запросов',
		description: 'Выбор поставщиков, параметры письма и отправка запросов из одного экрана.',
		highlight: 'Шаблоны, отправка писем',
		image: '/landing/email_chat.png',
		imageAlt: 'Рассылка запросов поставщикам',
		group: 'correspondence',
	},
	{
		icon: 'i-lucide-mail',
		title: 'Почтовый модуль',
		description: 'Переписка с поставщиками и индикаторы новых сообщений в едином окне.',
		highlight: 'Безопасное подключение SMTP/IMAP',
		image: '/landing/email_chat.png',
		imageAlt: 'Переписка с поставщиками',
		group: 'correspondence',
	},
	{
		icon: 'i-lucide-file-scan',
		title: 'Извлечение требований из ТЗ',
		description: 'AI достаёт требования из документа - DOCX, PDF, сканы.',
		highlight: 'Поддержка форматов, OCR',
		image: '/landing/upload_area_analyze.png',
		imageAlt: 'Загрузка и анализ технического задания',
		group: 'tz-kp',
	},
	{
		icon: 'i-lucide-scan-search',
		title: 'Сравнение КП с ТЗ',
		description: 'AI-сверка коммерческого предложения с требованиями, таблица соответствия.',
		highlight: 'до 95% точность, критерии соответствия',
		image: '/landing/tz_kp_compare.png',
		imageAlt: 'Сравнение коммерческого предложения с требованиями ТЗ',
		group: 'tz-kp',
	},
	{
		icon: 'i-lucide-file-check',
		title: 'Экспорт',
		description: 'Готовая таблица соответствия - выгрузка в XLSX/DOCX, письма поставщикам на уточнения.',
		highlight: 'Готовые шаблоны, docx/xlsx генерация',
		image: '/landing/excel.png',
		imageAlt: 'Экспорт таблицы соответствия в Excel',
		group: 'tz-kp',
	},
]

export interface ContactEmailChannel {
	address: string
	label: string
	description?: string
}

export const CONTACT_SUPPORT = {
	title: 'Поддержка',
	lead:
		' Поможем решить вопрос: пн-пт с 9:00 до 18:00.',
	emails: [
		{
			address: 'support@tenderoptima.by',
			label: 'Техподдержка',
		},
		{
			address: 'sales@tenderoptima.by',
			label: 'Продажи',
		},
	] satisfies ContactEmailChannel[],
} as const

export const LEGAL_LINKS = [
	{
		label: 'Согласие на обработку персональных данных',
		to: '/legal/personal-data-consent',
	},
	{
		label: 'Политика обработки персональных данных',
		to: '/legal/privacy-policy',
	},
] as const

export interface FaqItem {
	question: string
	answer: string
}

export const FAQ_ITEMS: FaqItem[] = [
	{
		question: 'Можно ли править требования после извлечения из ТЗ?',
		answer: 'Да. Система извлекает пункты из технического задания, вы просматриваете список, удаляете лишнее, добавляете недостающее и редактируете формулировки. Загрузка КП открывается только после подтверждения списка требований.',
	},
	{
		question: 'Как сверить КП нескольких поставщиков с одним ТЗ?',
		answer: 'В одной сессии анализа добавьте поставщиков, загрузите КП каждого и запустите сверку. По каждому поставщику — процент соответствия, совпадения, частичные расхождения и несоответствия по пунктам. Результаты можно выгрузить в XLSX.',
	},
	{
		question: 'Как отслеживать ответы поставщиков на запрос?',
		answer: 'В истории запросов отображаются «Входящие / Всего». Новый ответ от поставщика появляется как сообщение в переписке по соответствующему запросу — без переключения между почтой и таблицами.',
	},
	{
		question: 'Как формируется письмо поставщику с расхождениями?',
		answer: 'После сверки ТЗ и КП система собирает несоответствия по пунктам. Текст письма заполняется автоматически: что в ТЗ, что в КП, по каждому расхождению. Письмо можно отредактировать и выгрузить в DOCX или отправить из интерфейса.',
	},
	{
		question: 'Как сравнить предложения нескольких поставщиков в одной таблице?',
		answer: 'В модуле поиска и рассылки ответы сверяются по параметрам запроса — цена, сроки, условия, соответствие ТЗ. Таблица с сортировкой и статусами по пунктам выгружается в XLSX для согласования или передачи коллегам.',
	},
	{
		question: 'Что означает статус «не найдено» при сверке ТЗ и КП?',
		answer: 'Пункт есть в техническом задании, но в коммерческом предложении поставщика по нему нет данных — параметр не упомянут. Это не частичное и не полное несоответствие: значение в КП просто отсутствует. Такие пункты учитываются в сводке и могут попасть в письмо с запросом уточнений.',
	},
]

/** B2B trust narrative blocks (descriptionroute §1.3) - no fabricated certifications. */
export interface TrustBlock {
	icon: string
	title: string
	description: string
	link?: string
	linkLabel?: string
}

export const TRUST_BLOCKS: TrustBlock[] = [
	{
		icon: 'i-lucide-shield-check',
		title: 'Безопасность данных',
		description: 'ТЗ и коммерческие предложения хранятся в изолированной базе. Доступ разграничен ролями, соединение защищено HTTPS. Условия обработки - в договоре и NDA по запросу.',
		link: '/security',
		linkLabel: 'Подробнее о безопасности',
	},
	{
		icon: 'i-lucide-mail-check',
		title: 'Подключение к почте',
		description: 'Рассылка и входящие через SMTP/IMAP от имени вашей компании. Учётные данные не хранятся в открытом виде и используются только для отправки запросов и получения ответов.',
		link: '/security',
		linkLabel: 'Как работает почтовый модуль',
	},
	{
		icon: 'i-lucide-server',
		title: 'Закрытый контур / on-premise',
		description: 'Для Enterprise доступно развёртывание в инфраструктуре клиента на базе Docker Compose - данные остаются в вашем контуре.',
		link: '/contacts',
		linkLabel: 'Обсудить развёртывание',
	},
	{
		icon: 'i-lucide-file-signature',
		title: 'Договор и конфиденциальность',
		description: 'Публичный договор оказания услуг, согласие на обработку персональных данных. По запросу - дополнительное соглашение о конфиденциальности и удаление данных.',
		link: '/security',
		linkLabel: 'Гарантии для B2B',
	},
]

export interface IndustrySegment {
	icon: string
	label: string
}

/** Industry focus areas - descriptive, without fabricated client logos. */
export const INDUSTRY_SEGMENTS: IndustrySegment[] = [
	{ icon: 'i-lucide-factory', label: 'Производство' },
	{ icon: 'i-lucide-shopping-bag', label: 'Ритейл' },
	{ icon: 'i-lucide-cpu', label: 'IT и телеком' },
	{ icon: 'i-lucide-zap', label: 'Энергетика' },
	{ icon: 'i-lucide-hard-hat', label: 'Строительство' },
	{ icon: 'i-lucide-landmark', label: 'Госзакупки' },
]

/** Inline emphasis segment for landing copy (metrics, outcomes, automation hooks). */
export interface LandingTextPart {
	text: string
	accent?: boolean
}

/** Compact ROI payback narrative - one block instead of repeating across JTBD/ICP. */
export interface RoiPaybackPoint {
	icon: string
	title: string
	description: LandingTextPart[]
}

export const ROI_PAYBACK_INTRO: LandingTextPart[] = [
	{ text: 'Экономия на контракте или предотвращённая ошибка в ТЗ стоят ' },
	{ text: 'в разы больше'    },
	{ text: ', чем тариф TenderOptima - платформа окупается уже на ' },
	{ text: 'первой закупке'   },
	{ text: '.' },
]

export const ROI_PAYBACK_POINTS: RoiPaybackPoint[] = [
	{
		icon: 'i-lucide-trending-down',
		title: 'Эффективные механики снижения цены.',
		description: [
			{ text: 'Экономия', accent: true },
			{ text: ' на одном контракте часто ' },
			{ text: 'превышает годовую подписку', accent: true },
			{ text: '. Широкий охват поставщиков способствует снижению цены контракта. Мы убираем рутину, высвобождая ресурсы команды.' },
		],
	},
	{
		icon: 'i-lucide-shield-alert',
		title: 'Скрытые потери на проверке сложных КП',
		description: [
			{ text: 'Отрыв команды 3-5 тех.специалистов на чтение многостраничных документов. Система ' },
			{ text: 'сокращает недели', accent: true },
			{ text: ' занятости команды ' },
			{ text: 'до 1-2 часов', accent: true },
			{ text: '. Одна пропущенная несостыковка в оборудовании стоит дороже тарифа. ' },
			{ text: 'Система подсказывает расхождения', accent: true },
			{ text: ' до подписания договора.' },
		],
	},
]

/** Two product directions shown before interactive HowItWorks walkthroughs. */
export interface ServiceDirection {
	id: 'supplier-search' | 'tz-analysis'
	index: number
	title: string
	description: string
	icon: string
	anchor: string
}

export const SERVICE_DIRECTIONS: ServiceDirection[] = [
	{
		id: 'supplier-search',
		index: 1,
		title: 'Поиск поставщиков',
		description:
			'Автопоиск компаний по запросу и региону, рассылка запросов и сбор ответов - без ручного сбора контактов.',
		icon: 'i-lucide-search',
		anchor: '#supplier-search',
	},
	{
		id: 'tz-analysis',
		index: 2,
		title: 'Анализ ТЗ и КП',
		description:
			'Извлечение требований из технического задания и AI-сверка каждого коммерческого предложения.',
		icon: 'i-lucide-scan-search',
		anchor: '#tz-analysis',
	},
]

/** Anonymized scenario-based case studies - no fabricated client names or logos. */
export type CaseStudyVisual = 'compare' | 'search' | 'extract'

export interface CaseStudy {
	id: string
	industry: string
	industryIcon: string
	title: string
	metric?: string
	description: string
	outcomes: string[]
	modules: string[]
	visual: CaseStudyVisual
}

export const CASE_STUDIES: CaseStudy[] = [
	{
		id: 'manufacturing-kp-compare',
		industry: 'Производство',
		industryIcon: 'i-lucide-factory',
		title: 'Сверка 12 предложений с техническим заданием',
		metric: '−90% времени на рутинный анализ',
		description:
			'Отдел закупок тратил недели на ручную сверку. Мы загрузили документы в TenderOptima. Система автоматически сопоставила пункты и выгрузила готовую таблицу соответствий в XLSX.',
		outcomes: [
			'Полная таблица соответствия по каждому пункту ТЗ',
			'Готовые письма поставщикам на уточнение расхождений',
		],
		modules: ['Анализ ТЗ/КП', 'Экспорт'],
		visual: 'compare',
	},
	{
		id: 'tender-supplier-search',
		industry: 'Тендерный отдел',
		industryIcon: 'i-lucide-gavel',
		title: 'Поиск поставщиков и рассылка запросов по региону',
		metric: 'в 3 раза больше ответов рынка',
		description:
			'Нужно было быстро найти поставщиков по новой закупке и разослать запросы с единым шаблоном - без ручного сбора контактов и подготовки писем. Автопоиск, рассылка из одного экрана и сбор ответов в едином интерфейсе.',
		outcomes: [
			'Поиск и рассылка без переключения между сервисами',
			'Единый шаблон запроса для всех участников',
			'Отслеживание входящих в одном окне',
		],
		modules: ['Поиск поставщиков', 'Рассылка', 'Почта'],
		visual: 'search',
	},
	{
		id: 'it-procurement-tz',
		industry: 'IT-закупки',
		industryIcon: 'i-lucide-cpu',
		title: 'Проверка технического КП на соответствие',
		description:
			'Технический специалист тратил часы на построчное сравнение объёмного КП с требованиями из ТЗ. Извлечение пунктов, AI-сверка и группировка совпадений и расхождений по статусам.',
		outcomes: [
			'Структурированный список требований из документа',
			'Статусы «Выполнено» / «Частично» / «Не выполнено» по пунктам',
			'Экспорт отчёта для передачи руководителю закупок',
		],
		modules: ['Извлечение ТЗ', 'Сравнение КП'],
		visual: 'extract',
	},
]

export interface CasesCtaBannerContent {
	title: string
	subtitle: string
	buttonLabel: string
	trustText: string
}

export const CASES_CTA_BANNER: CasesCtaBannerContent = {
	title: 'Не нашли сценарий под свои задачи?',
	subtitle:
		'Давайте обсудим. Мы покажем, как TenderOptima улучшит именно Ваши процессы и рассчитаем потенциальную экономию.',
	buttonLabel: 'Обсудить мой кейс',
	trustText: '',
}
