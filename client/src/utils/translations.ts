export type Language = 'ru' | 'en' | 'de';

export type TranslationKey = 
  // Common
  | 'app_title'
  | 'settings'
  | 'language'
  | 'save'
  | 'cancel'
  | 'loading'
  | 'error'
  | 'success'
  | 'yes'
  | 'no'
  | 'delete'
  | 'edit'
  | 'view'
  | 'add'
  | 'back'
  | 'close'
  | 'confirm'
  | 'unlimited'
  | 'status'
  | 'selected'
  | 'contact_info'
  | 'description'
  | 'redirecting'
  | 'optional'
  | 'saving'
  
  // Subscription Keys - All converted to dot notation
  | 'subscription.loading'
  | 'subscription.error.title' 
  | 'subscription.error.description'
  | 'subscription.notFound.title'
  | 'subscription.notFound.description'
  | 'subscription.title'
  | 'subscription.status.active'
  | 'subscription.status.inactive'
  | 'subscription.plan.trial'
  | 'subscription.plan.basic'
  | 'subscription.plan.premium'
  | 'subscription.plan.professional'
  | 'subscription.feature.unlimited_requests'
  | 'subscription.feature.priority_support'
  | 'subscription.feature.advanced_analytics'
  | 'subscription.feature.custom_templates'
  | 'subscription.feature.dedicated_manager'
  | 'subscription.feature.max_suppliers'
  | 'subscription.dateRange'
  | 'subscription.expired.title'
  | 'subscription.expired.description'
  | 'subscription.endingSoon.title'
  | 'subscription.endingSoon.description'
  | 'subscription.yourManager'
  | 'subscription.management'
  | 'subscription.list'
  | 'subscription.listDescription'
  | 'subscription.createNew'
  | 'subscription.createDescription'
  | 'subscription.edit'
  | 'subscription.editDescription'
  | 'subscription.user'
  | 'subscription.unknownUser'
  | 'subscription.plan'
  | 'subscription.status'
  | 'subscription.startDate'
  | 'subscription.endDate'
  | 'subscription.requestsLimit'
  | 'subscription.requestsUsed'
  | 'subscription.actions'
  | 'subscription.create'
  | 'subscription.update'
  | 'subscription.refresh'
  | 'subscription.resetCounts'
  | 'subscription.confirmReset'
  | 'subscription.confirmResetDescription'
  | 'subscription.noSubscriptions'
  | 'subscription.accessDenied'
  | 'subscription.adminOnly'
  | 'subscription.selectUser'
  | 'subscription.selectPlan'
  | 'subscription.selectStatus'
  | 'subscription.pickDate'
  | 'subscription.notes'
  | 'subscription.createSuccess'
  | 'subscription.createSuccessMessage'
  | 'subscription.createError'
  | 'subscription.updateSuccess'
  | 'subscription.updateSuccessMessage'
  | 'subscription.updateError'
  | 'subscription.resetSuccess'
  | 'subscription.resetSuccessMessage'
  | 'subscription.resetError'
  | 'subscription.loadError'
  | 'subscription.cancel'
  | 'subscription.confirm'
  | 'subscription.unlimited'
  | 'subscription.plans.trial'
  | 'subscription.plans.basic'
  | 'subscription.plans.premium'
  | 'subscription.statuses.active'
  | 'subscription.statuses.expired'
  | 'subscription.statuses.cancelled'
  
  // Contact Form
  | 'contact.form.title'
  | 'contact.form.description'
  | 'contact.form.subject'
  | 'contact.form.subjectPlaceholder'
  | 'contact.form.message'
  | 'contact.form.messagePlaceholder'
  | 'contact.form.attachments'
  | 'contact.form.send'
  | 'contact.form.sending'
  | 'contact.form.addFiles'
  | 'contact.form.uploadFiles'
  | 'contact.success.title'
  | 'contact.success.description'
  | 'contact.error.title'
  | 'contact.error.message'
  
  // Admin Panel
  | 'admin.panel'
  | 'admin.welcome'
  | 'admin.welcomeDescription'
  | 'admin.subscriptions'
  | 'admin.subscriptionsDescription'
  | 'admin.manage'
  | 'admin.comingSoon'
  | 'admin.moreFeatures'
  
  // Admin Subscription Keys
  | 'subscription.list'
  | 'subscription.listDescription'
  | 'subscription.createNew'
  | 'subscription.createDescription'
  | 'subscription.edit'
  | 'subscription.editDescription'
  | 'subscription.user'
  | 'subscription.unknownUser'
  | 'subscription.plan'
  | 'subscription.status'
  | 'subscription.startDate'
  | 'subscription.endDate'
  | 'subscription.requestsLimit'
  | 'subscription.requestsUsed'
  | 'subscription.actions'
  | 'subscription.create'
  | 'subscription.update'
  | 'subscription.refresh'
  | 'subscription.resetCounts'
  | 'subscription.confirmReset'
  | 'subscription.confirmResetDescription'
  | 'subscription.noSubscriptions'
  | 'subscription.accessDenied'
  | 'subscription.adminOnly'
  | 'subscription.selectUser'
  | 'subscription.selectPlan'
  | 'subscription.selectStatus'
  | 'subscription.pickDate'
  | 'subscription.notes'
  | 'subscription.createSuccess'
  | 'subscription.createSuccessMessage'
  | 'subscription.createError'
  | 'subscription.updateSuccess'
  | 'subscription.updateSuccessMessage'
  | 'subscription.updateError'
  | 'subscription.resetSuccess'
  | 'subscription.resetSuccessMessage'
  | 'subscription.resetError'
  | 'subscription.loadError'
  | 'subscription.cancel'
  | 'subscription.confirm'
  | 'subscription.unlimited'
  | 'subscription.plans.trial'
  | 'subscription.plans.basic'
  | 'subscription.plans.premium'
  | 'subscription.statuses.active'
  | 'subscription.statuses.expired'
  | 'subscription.statuses.cancelled'
  
  // User Subscription Display
  | 'subscription.loading'
  | 'subscription.error.title'
  | 'subscription.error.description'
  | 'subscription.notFound.title'
  | 'subscription.notFound.description'
  | 'subscription.title'
  | 'subscription.status.active'
  | 'subscription.status.inactive'
  | 'subscription.plan.trial'
  | 'subscription.plan.basic'
  | 'subscription.plan.premium'
  | 'subscription.plan.professional'
  | 'subscription.feature.unlimited_requests'
  | 'subscription.feature.priority_support'
  | 'subscription.feature.advanced_analytics'
  | 'subscription.feature.custom_templates'
  | 'subscription.feature.dedicated_manager'
  | 'subscription.feature.max_suppliers'
  | 'subscription.dateRange'
  | 'subscription.expired.title'
  | 'subscription.expired.description'
  | 'subscription.endingSoon.title'
  | 'subscription.endingSoon.description'
  | 'subscription.yourManager'
  
  // Admin Subscription Management
  | 'subscription.management'
  | 'subscription.list'
  | 'subscription.listDescription'
  | 'subscription.createNew'
  | 'subscription.createDescription'
  | 'subscription.edit'
  | 'subscription.editDescription'
  | 'subscription.user'
  | 'subscription.unknownUser'
  | 'subscription.plan'
  | 'subscription.status'
  | 'subscription.startDate'
  | 'subscription.endDate'
  | 'subscription.requestsLimit'
  | 'subscription.requestsUsed'
  | 'subscription.actions'
  | 'subscription.create'
  | 'subscription.update'
  | 'subscription.refresh'
  | 'subscription.resetCounts'
  | 'subscription.confirmReset'
  | 'subscription.confirmResetDescription'
  | 'subscription.noSubscriptions'
  | 'subscription.accessDenied'
  | 'subscription.adminOnly'
  | 'subscription.selectUser'
  | 'subscription.selectPlan'
  | 'subscription.selectStatus'
  | 'subscription.pickDate'
  | 'subscription.notes'
  | 'subscription.createSuccess'
  | 'subscription.createSuccessMessage'
  | 'subscription.createError'
  | 'subscription.updateSuccess'
  | 'subscription.updateSuccessMessage'
  | 'subscription.updateError'
  | 'subscription.resetSuccess'
  | 'subscription.resetSuccessMessage'
  | 'subscription.resetError'
  | 'subscription.loadError'
  | 'subscription.plans.trial'
  | 'subscription.plans.basic'
  | 'subscription.plans.premium'
  | 'subscription.statuses.active'
  | 'subscription.statuses.expired'
  | 'subscription.statuses.cancelled'
  
  // Account
  | 'account'
  | 'logout'
  | 'logging_out'
  | 'logged_in_as'
  | 'not_logged_in'
  | 'logout_description'
  | 'settings_saved'
  | 'settings.saved'
  | 'language_changed_successfully'
  | 'language.changed.successfully'
  | 'settings_description'
  
  // Business Card
  | 'business_card'
  | 'business_card_setup'
  | 'business_card_text'
  | 'business_card_setup_description'
  | 'business_card_description'
  | 'business_card_description_extended'
  | 'business_card_updated_successfully'
  | 'company_logo'
  | 'logo_preview'
  | 'change_logo'
  | 'upload_logo'
  | 'enter_business_card_text'
  
  // Search Animation
  | 'search_initializing'
  | 'search_database'
  | 'search_internet'
  | 'search_finalizing'
  | 'no_suppliers_found'
  
  // Main Navigation - New Menu Structure
  | 'quick_procurement'
  | 'tender_procurement'
  | 'settings'
  | 'search_suppliers'
  | 'send_requests' 
  | 'supplier_selection'
  | 'contact_database'
  | 'create_specification'
  | 'improve_specification'
  | 'technical_analysis'
  | 'final_supplier_selection'
  | 'welcome_title'
  | 'welcome_description'
  | 'quick_procurement_home_title'
  | 'quick_procurement_home_description'
  | 'tender_procurement_home_title'
  | 'tender_procurement_home_description'
  
  // Legacy Navigation (keep for compatibility)
  | 'send_request'
  | 'requests'
  | 'contacts'
  | 'dashboard'
  
  // Home Page
  | 'find_suppliers'
  | 'enter_search_query'
  | 'search_query_placeholder'
  | 'search_button'
  | 'searching'
  | 'search_results'
  | 'no_results'
  | 'supplier_search_subtitle'
  | 'suppliers_found'
  | 'select_suppliers'
  | 'total_selected'
  | 'next_step'
  | 'previous'
  
  // Supplier Results
  | 'supplier_details'
  | 'website'
  | 'add_to_contact_group'
  | 'select_contact_group'
  | 'create_new_group'
  | 'added_to_group'
  
  // Contact Groups
  | 'contact_groups'
  | 'new_group'
  | 'view_contacts'
  | 'send_email'
  | 'create_mailing'
  | 'add_contact'
  | 'email_sent'
  | 'email_sent_description'
  | 'back_to_group'
  | 'new_message'
  | 'sending_email_to_group'
  | 'recipients'
  | 'contacts_in_group'
  | 'subject'
  | 'message'
  | 'send_message'
  | 'message_sent'
  | 'no_contacts_in_group'
  | 'name'
  | 'email'
  | 'phone'
  | 'organization'
  | 'fill_required_fields'
  | 'need_subject'
  | 'need_message'
  | 'contact_added'
  | 'contact_added_description'
  | 'error_add_contact'
  | 'back_to_groups'
  | 'group_name'
  | 'contacts_count'
  | 'create_group'
  | 'delete_group'
  | 'confirm_delete_group'
  | 'group_deleted'
  
  // Dashboard/Requests
  | 'request_history'
  | 'search_requests'
  | 'request_id'
  | 'date'
  | 'status'
  | 'responses'
  | 'category'
  | 'actions'
  | 'request_details'
  | 'view_responses'
  | 'no_requests_found'
  | 'request_date'
  | 'suppliers_contacted'
  | 'product_details'
  | 'description'
  | 'quantity'
  | 'clone_request'
  | 'delete_request'
  | 'confirm_delete_request'
  | 'request_deleted'
  
  // Send Request
  | 'product_name'
  | 'product_category'
  | 'select_category'
  | 'product_description'
  | 'product_quantity'
  | 'delivery_location'
  | 'delivery_date'
  | 'additional_requirements'
  | 'contact_info'
  | 'your_name'
  | 'your_email'
  | 'your_phone'
  | 'company_name'
  | 'submit_request'
  | 'request_submitted'
  | 'request_error'
  | 'fill_required_products'
  
  // Compare
  | 'compare_responses'
  | 'select_parameters'
  | 'parameter'
  | 'supplier_responses'
  | 'supplier'
  | 'price'
  | 'delivery_time'
  | 'payment_terms'
  | 'warranty'
  | 'supplier_name'
  | 'supplier_residency'
  | 'supplier_inn_unp'
  | 'recommended_supplier'
  | 'export_to_excel'
  | 'export_to_pdf'
  | 'compare_results'
  | 'analysis_results'
  | 'ai_recommendation'
  | 'response_summary'
  | 'strengths'
  | 'weaknesses'
  | 'detailed_analysis';

export const translations: Record<Language, Record<TranslationKey, string>> = {
  ru: {
    // Common
    app_title: 'SupplierFinder',
    settings: 'Настройки',
    language: 'Язык',
    save: 'Сохранить',
    cancel: 'Отмена',
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    yes: 'Да',
    no: 'Нет',
    delete: 'Удалить',
    edit: 'Редактировать',
    view: 'Просмотр',
    add: 'Добавить',
    back: 'Назад',
    close: 'Закрыть',
    confirm: 'Подтвердить',
    unlimited: 'Неограниченно',
    status: 'Статус',
    selected: 'Выбрано',
    contact_info: 'Контактная информация',
    description: 'Описание',
    redirecting: 'Перенаправление...',
    optional: 'необязательно',
    saving: 'Сохранение...',
    
    // Subscription
    'subscription.title': 'Статус подписки',
    'subscription.loading': 'Загрузка информации о подписке...',
    'subscription.error.title': 'Ошибка подписки',
    'subscription.error.description': 'Произошла ошибка при получении информации о вашей подписке. Пожалуйста, попробуйте позже.',
    'subscription.notFound.title': 'Подписка не найдена',
    'subscription.notFound.description': 'Активная подписка для вашей учетной записи не найдена. Пожалуйста, свяжитесь со службой поддержки.',
    'subscription.expired.title': 'Подписка истекла',
    'subscription.expired.description': 'Срок действия вашей подписки истек. Пожалуйста, свяжитесь с вашим менеджером для продления.',
    'subscription.endingSoon.title': 'Подписка скоро закончится',
    'subscription.endingSoon.description': 'Ваша подписка истекает через {days} дней. Пожалуйста, свяжитесь с вашим менеджером для продления.',
    'subscription.yourManager': 'Ваш менеджер',
    'subscription.status.active': 'Активна',
    'subscription.status.inactive': 'Неактивна',
    'subscription.dateRange': 'Период подписки',
    'subscription.feature.unlimited_requests': 'Неограниченное количество запросов',
    'subscription.feature.priority_support': 'Приоритетная поддержка',
    'subscription.feature.advanced_analytics': 'Расширенная аналитика',
    'subscription.feature.custom_templates': 'Настраиваемые шаблоны',
    'subscription.feature.dedicated_manager': 'Выделенный менеджер',
    'subscription.feature.max_suppliers': 'Расширенный лимит поставщиков',
    'subscription.plan.trial': 'Пробный план',
    'subscription.plan.basic': 'Базовый план',
    'subscription.plan.premium': 'Премиум план',
    'subscription.plan.professional': 'Профессиональный план',
    'subscription.management': 'Управление подпиской',
    'subscription.list': 'Список подписок',
    'subscription.listDescription': 'Управление подписками пользователей',
    'subscription.createNew': 'Создать новую подписку',
    'subscription.createDescription': 'Создать новую подписку для пользователя',
    'subscription.edit': 'Редактировать подписку',
    'subscription.editDescription': 'Изменить параметры подписки',
    'subscription.user': 'Пользователь',
    'subscription.unknownUser': 'Неизвестный пользователь',
    'subscription.plan': 'Тарифный план',
    'subscription.status': 'Статус подписки',
    'subscription.startDate': 'Дата начала',
    'subscription.endDate': 'Дата окончания',
    'subscription.requestsLimit': 'Лимит запросов',
    'subscription.requestsUsed': 'Использовано запросов',
    'subscription.actions': 'Действия',
    'subscription.create': 'Создать',
    'subscription.update': 'Обновить',
    'subscription.refresh': 'Обновить',
    'subscription.resetCounts': 'Сбросить счетчики',
    'subscription.confirmReset': 'Сбросить счетчики использования',
    'subscription.confirmResetDescription': 'Вы уверены, что хотите сбросить счетчики использования для всех подписок?',
    'subscription.noSubscriptions': 'Подписки не найдены',
    'subscription.accessDenied': 'Доступ запрещен',
    'subscription.adminOnly': 'Только для администраторов',
    'subscription.selectUser': 'Выберите пользователя',
    'subscription.selectPlan': 'Выберите тарифный план',
    'subscription.selectStatus': 'Выберите статус',
    'subscription.pickDate': 'Выберите дату',
    'subscription.notes': 'Примечания',
    'subscription.createSuccess': 'Подписка создана',
    'subscription.createSuccessMessage': 'Подписка успешно создана',
    'subscription.createError': 'Ошибка создания подписки',
    'subscription.updateSuccess': 'Подписка обновлена',
    'subscription.updateSuccessMessage': 'Подписка успешно обновлена',
    'subscription.updateError': 'Ошибка обновления подписки',
    'subscription.resetSuccess': 'Счетчики сброшены',
    'subscription.resetSuccessMessage': 'Счетчики использования успешно сброшены',
    'subscription.resetError': 'Ошибка сброса счетчиков',
    'subscription.loadError': 'Ошибка загрузки подписок',
    'subscription.cancel': 'Отменить',
    'subscription.confirm': 'Подтвердить',
    'subscription.unlimited': 'Без ограничений',
    'subscription.plans.trial': 'Пробный',
    'subscription.plans.basic': 'Базовый',
    'subscription.plans.premium': 'Премиум',
    'subscription.statuses.active': 'Активна',
    'subscription.statuses.expired': 'Истекла',
    'subscription.statuses.cancelled': 'Отменена',
    
    // Admin panel translations
    "admin.panel": "Панель администратора",
    "admin.welcome": "Добро пожаловать в панель администратора",
    "admin.welcomeDescription": "Управляйте подписками пользователей и другими административными функциями",
    "admin.subscriptions": "Подписки",
    "admin.subscriptionsDescription": "Управление подписками пользователей",
    "admin.manage": "Управлять",
    "admin.comingSoon": "Скоро будет доступно",
    "admin.moreFeatures": "Больше административных функций появится в будущих обновлениях",
    
    // Contact Form
    "contact.form.title": "Свяжитесь с нами",
    "contact.form.description": "Отправьте сообщение в службу поддержки",
    "contact.form.subject": "Тема",
    "contact.form.subjectPlaceholder": "О чем ваш вопрос?",
    "contact.form.message": "Сообщение",
    "contact.form.messagePlaceholder": "Пожалуйста, опишите ваш вопрос или проблему подробно...",
    "contact.form.attachments": "Вложения",
    "contact.form.send": "Отправить сообщение",
    "contact.form.sending": "Отправка...",
    "contact.form.addFiles": "Добавить файлы",
    "contact.form.uploadFiles": "Загрузить файлы",
    "contact.success.title": "Сообщение отправлено",
    "contact.success.description": "Ваше сообщение успешно отправлено. Мы свяжемся с вами в ближайшее время.",
    "contact.error.title": "Ошибка отправки сообщения",
    "contact.error.message": "При отправке сообщения произошла ошибка. Пожалуйста, попробуйте еще раз позже.",
    
    // We've removed this duplicate section as these keys are already defined above
    
    // Admin Subscription Management - keys removed as they're now defined in TranslationKey type
    // (Do not duplicate subscription management keys here)
    
    // User Subscription Display - removed duplicates
    
    // Account
    account: 'Учетная запись',
    logout: 'Выйти',
    logging_out: 'Выполняется выход...',
    logged_in_as: 'Вы вошли как',
    not_logged_in: 'Вы не авторизованы',
    logout_description: 'Нажмите на кнопку ниже, чтобы выйти из системы и завершить сессию.',
    settings_saved: 'Настройки сохранены',
    'settings.saved': 'Настройки сохранены',
    language_changed_successfully: 'Язык успешно изменен',
    'language.changed.successfully': 'Язык успешно изменен',
    settings_description: 'Настройте параметры вашей учетной записи',
    
    // Business Card
    business_card: 'Визитная карточка',
    business_card_setup: 'Настройка визитной карточки',
    business_card_text: 'Текст визитной карточки',
    business_card_setup_description: 'Добавьте информацию, которая будет отображаться в конце писем, отправляемых поставщикам',
    business_card_description: 'Настройте вашу визитную карточку, которая добавляется ко всем письмам',
    business_card_description_extended: 'Этот текст будет добавлен в конце писем, отправляемых поставщикам. Включите все необходимые контактные данные.',
    business_card_updated_successfully: 'Визитная карточка успешно обновлена',
    company_logo: 'Логотип компании',
    logo_preview: 'Предпросмотр логотипа',
    change_logo: 'Изменить логотип',
    upload_logo: 'Загрузить логотип',
    enter_business_card_text: 'Введите текст визитной карточки компании',
    
    // Search Animation
    search_initializing: 'Инициализация поиска',
    search_database: 'Поиск в базе данных',
    search_internet: 'Поиск в интернете',
    search_finalizing: 'Обработка результатов',
    no_suppliers_found: 'Не найдено поставщиков, соответствующих вашим требованиям.',
    
    // Main Navigation
    search_suppliers: 'Найти поставщиков',
    send_request: 'Отправить запрос',
    requests: 'Запросы',
    contacts: 'Контакты',
    dashboard: 'Панель управления',
    
    // Home Page
    find_suppliers: 'Найти поставщиков',
    enter_search_query: 'Введите поисковый запрос',
    search_query_placeholder: 'Введите название продукта или услуги...',
    search_button: 'Поиск',
    searching: 'Поиск...',
    search_results: 'Результаты поиска',
    no_results: 'Нет результатов',
    supplier_search_subtitle: 'Найдите подходящих поставщиков для вашего бизнеса',
    suppliers_found: 'Найдено поставщиков',
    select_suppliers: 'Выберите поставщиков',
    total_selected: 'Всего выбрано',
    next_step: 'Следующий шаг',
    previous: 'Назад',
    
    // Supplier Results
    supplier_details: 'Детали поставщика',
    website: 'Веб-сайт',
    add_to_contact_group: 'Добавить в группу контактов',
    select_contact_group: 'Выберите группу контактов',
    create_new_group: 'Создать новую группу',
    added_to_group: 'Добавлено в группу',
    
    // Contact Groups
    contact_groups: 'Группы контактов',
    new_group: 'Новая группа',
    view_contacts: 'Просмотреть контакты',
    send_email: 'Отправить email',
    create_mailing: 'Создать рассылку',
    add_contact: 'Добавить контакт',
    email_sent: 'Сообщение отправлено!',
    email_sent_description: 'Письмо успешно отправлено всем контактам в группе. Вы будете перенаправлены на страницу групп контактов.',
    back_to_group: 'Назад к группе',
    new_message: 'Новое сообщение',
    sending_email_to_group: 'Отправка email всем контактам в группе',
    recipients: 'Получатели',
    contacts_in_group: 'Контакты в группе',
    subject: 'Тема письма',
    message: 'Сообщение',
    send_message: 'Отправить письмо',
    message_sent: 'Письмо отправлено',
    
    // Subscription information - removed duplicates (already defined above)
    no_contacts_in_group: 'Нет контактов в этой группе',
    name: 'Имя',
    email: 'Email',
    phone: 'Телефон',
    organization: 'Организация',
    fill_required_fields: 'Пожалуйста, укажите имя и email контакта',
    need_subject: 'Пожалуйста, введите тему письма',
    need_message: 'Пожалуйста, введите текст сообщения',
    contact_added: 'Контакт добавлен',
    contact_added_description: 'Новый контакт успешно добавлен в группу',
    error_add_contact: 'Не удалось добавить контакт',
    back_to_groups: 'К группам контактов',
    group_name: 'Название группы',
    contacts_count: 'Количество контактов',
    create_group: 'Создать группу',
    delete_group: 'Удалить группу',
    confirm_delete_group: 'Вы уверены, что хотите удалить эту группу?',
    group_deleted: 'Группа удалена',
    
    // Main Navigation - New Menu Structure
    quick_procurement: 'ВЫБОР ПОСТАВЩИКА',
    tender_procurement: 'ТЕХНИЧЕСКИЙ АНАЛИЗ',
    // Removed duplicate settings and search_suppliers keys (already exist above)
    send_requests: 'Отправка Запросов',
    supplier_selection: 'Выбор поставщика',
    contact_database: 'База контактов',
    create_specification: 'Создание тех.задания',
    improve_specification: 'Улучшение тех.задания',
    technical_analysis: 'Технический анализ',
    final_supplier_selection: 'Выбор поставщика',
    welcome_title: 'Добро пожаловать в SupplierFinder',
    welcome_description: 'Выберите тип закупочной процедуры для начала работы',
    quick_procurement_home_title: 'Выбор поставщика',
    quick_procurement_home_description: 'Инструкции и возможности для быстрого поиска поставщиков и отправки запросов',
    tender_procurement_home_title: 'Технический анализ', 
    tender_procurement_home_description: 'Полный цикл тендерных процедур с техническим анализом и сравнением предложений',

    // Dashboard/Requests
    request_history: 'История запросов',
    search_requests: 'Поиск запросов',
    request_id: 'ID запроса',
    date: 'Дата',
    // "status" is already defined, so using a reference
    // status: 'Статус',
    responses: 'Ответы',
    category: 'Категория',
    actions: 'Действия',
    request_details: 'Детали запроса',
    view_responses: 'Просмотр ответов',
    no_requests_found: 'Запросы не найдены',
    request_date: 'Дата запроса',
    suppliers_contacted: 'Контактов с поставщиками',
    product_details: 'Детали продукта',
    quantity: 'Количество',
    clone_request: 'Клонировать запрос',
    delete_request: 'Удалить запрос',
    confirm_delete_request: 'Вы уверены, что хотите удалить этот запрос?',
    request_deleted: 'Запрос удален',
    
    // Send Request
    product_name: 'Название продукта',
    product_category: 'Категория продукта',
    select_category: 'Выберите категорию',
    product_description: 'Описание продукта',
    product_quantity: 'Количество',
    delivery_location: 'Место доставки',
    delivery_date: 'Дата доставки',
    additional_requirements: 'Дополнительные требования',
    your_name: 'Ваше имя',
    your_email: 'Ваш email',
    your_phone: 'Ваш телефон',
    company_name: 'Название компании',
    submit_request: 'Отправить запрос',
    request_submitted: 'Запрос отправлен',
    request_error: 'Ошибка запроса',
    fill_required_products: 'Пожалуйста, заполните информацию о продукте',
    
    // Compare
    compare_responses: 'Сравнить ответы',
    select_parameters: 'Выберите параметры',
    parameter: 'Параметр',
    supplier_responses: 'Ответы поставщиков',
    supplier: 'Поставщик',
    price: 'Цена',
    delivery_time: 'Срок доставки',
    payment_terms: 'Условия оплаты',
    warranty: 'Гарантия',
    supplier_name: 'Наименование поставщика',
    supplier_residency: 'Резидентство поставщика (страна)',
    supplier_inn_unp: 'ИНН / УНП',
    recommended_supplier: 'Рекомендуемый поставщик',
    export_to_excel: 'Экспорт в Excel',
    export_to_pdf: 'Экспорт в PDF',
    compare_results: 'Результаты сравнения',
    analysis_results: 'Результаты анализа',
    ai_recommendation: 'ИИ рекомендация',
    response_summary: 'Сводка ответов',
    strengths: 'Сильные стороны',
    weaknesses: 'Слабые стороны',
    detailed_analysis: 'Детальный анализ',
  },
  
  en: {
    // Common
    app_title: 'SupplierSearch',
    settings: 'Settings',
    language: 'Language',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    yes: 'Yes',
    no: 'No',
    delete: 'Delete',
    edit: 'Edit',
    
    // User Subscription Display
    'subscription.loading': 'Loading subscription information...',
    'subscription.error.title': 'Subscription Error',
    'subscription.error.description': 'There was a problem loading your subscription information. Please try again later.',
    'subscription.notFound.title': 'No Subscription Found',
    'subscription.notFound.description': 'We couldn\'t find an active subscription for your account. Please contact support for assistance.',
    'subscription.title': 'Your Subscription',
    'subscription.status.active': 'Active',
    'subscription.status.inactive': 'Inactive',
    'subscription.plan.trial': 'Trial Plan',
    'subscription.plan.basic': 'Basic Plan',
    'subscription.plan.premium': 'Premium Plan',
    'subscription.plan.professional': 'Professional Plan',
    'subscription.feature.unlimited_requests': 'Unlimited request submissions',
    'subscription.feature.priority_support': 'Priority customer support',
    'subscription.feature.advanced_analytics': 'Advanced analytics dashboard',
    'subscription.feature.custom_templates': 'Custom email templates',
    'subscription.feature.dedicated_manager': 'Dedicated account manager',
    'subscription.feature.max_suppliers': 'Maximum suppliers per request',
    'subscription.dateRange': 'Subscription period',
    'subscription.expired.title': 'Subscription Expired',
    'subscription.expired.description': 'Your subscription has expired. Please contact your account manager to renew.',
    'subscription.endingSoon.title': 'Subscription Ending Soon',
    'subscription.endingSoon.description': 'Your subscription will expire in {days} days. Please contact your account manager to renew.',
    'subscription.yourManager': 'Your Account Manager',
    view: 'View',
    add: 'Add',
    back: 'Back',
    close: 'Close',
    selected: 'Selected',
    contact_info: 'Contact Info',
    description: 'Description',
    redirecting: 'Redirecting...',
    optional: 'optional',
    saving: 'Saving...',
    confirm: 'Confirm',
    unlimited: 'Unlimited',
    
    // We've already defined these keys earlier, so removing them to avoid duplication
    
    // Admin Subscription Management
    'subscription.management': 'Subscription Management',
    'subscription.list': 'Subscription List',
    'subscription.listDescription': 'View and manage all user subscriptions',
    'subscription.createNew': 'Create New Subscription',
    'subscription.createDescription': 'Fill in the details to create a new subscription',
    'subscription.edit': 'Edit Subscription',
    'subscription.editDescription': 'Editing subscription for user {user}',
    'subscription.user': 'User',
    'subscription.unknownUser': 'Unknown User',
    'subscription.plan': 'Plan',
    'subscription.status': 'Status',
    'subscription.startDate': 'Start Date',
    'subscription.endDate': 'End Date',
    'subscription.requestsLimit': 'Requests Limit',
    'subscription.requestsUsed': 'Requests Used',
    'subscription.actions': 'Actions',
    'subscription.create': 'Create',
    'subscription.update': 'Update',
    'subscription.refresh': 'Refresh',
    'subscription.resetCounts': 'Reset Counts',
    'subscription.confirmReset': 'Reset Usage Counts',
    'subscription.confirmResetDescription': 'Are you sure you want to reset usage counts for all subscriptions?',
    'subscription.noSubscriptions': 'No subscriptions found',
    'subscription.accessDenied': 'Access Denied',
    'subscription.adminOnly': 'Admin Only',
    'subscription.selectUser': 'Select User',
    'subscription.selectPlan': 'Select Plan',
    'subscription.selectStatus': 'Select Status',
    'subscription.pickDate': 'Pick a date',
    'subscription.notes': 'Notes',
    'subscription.createSuccess': 'Subscription Created',
    'subscription.createSuccessMessage': 'Subscription successfully created',
    'subscription.createError': 'Error creating subscription',
    'subscription.updateSuccess': 'Subscription Updated',
    'subscription.updateSuccessMessage': 'Subscription successfully updated',
    'subscription.updateError': 'Error updating subscription',
    'subscription.resetSuccess': 'Counts Reset',
    'subscription.resetSuccessMessage': 'Usage counts successfully reset',
    'subscription.resetError': 'Error resetting counts',
    'subscription.loadError': 'Error loading subscriptions',
    'subscription.cancel': 'Cancel',
    'subscription.confirm': 'Confirm',
    'subscription.unlimited': 'Unlimited',
    'subscription.plans.trial': 'Trial',
    'subscription.plans.basic': 'Basic',
    'subscription.plans.premium': 'Premium',
    'subscription.statuses.active': 'Active',
    'subscription.statuses.expired': 'Expired',
    'subscription.statuses.cancelled': 'Cancelled',
    'settings.saved': 'Settings saved successfully',
    'language.changed.successfully': 'Language changed successfully',
    
    // Removing duplicate subscription error messages as they're already defined in the User Subscription Display section above
    
    // Account
    account: 'Account',
    logout: 'Logout',
    logging_out: 'Logging out...',
    logged_in_as: 'Logged in as',
    not_logged_in: 'Not logged in',
    logout_description: 'Click the button below to logout and end your session.',
    settings_saved: 'Settings saved',
    language_changed_successfully: 'Language changed successfully',
    settings_description: 'Configure your account settings',
    
    // Business Card
    business_card: 'Business Card',
    business_card_setup: 'Business Card Setup',
    business_card_text: 'Business Card Text',
    business_card_setup_description: 'Add information that will appear at the end of emails sent to suppliers',
    business_card_description: 'Configure your business card that is added to all emails',
    business_card_description_extended: 'This text will be added at the end of emails sent to suppliers. Include all necessary contact information.',
    business_card_updated_successfully: 'Business card successfully updated',
    company_logo: 'Company Logo',
    logo_preview: 'Logo Preview',
    change_logo: 'Change Logo',
    upload_logo: 'Upload Logo',
    enter_business_card_text: 'Enter company business card text',
    
    // Search Animation
    search_initializing: 'Initializing search',
    search_database: 'Searching database',
    search_internet: 'Searching internet',
    search_finalizing: 'Processing results',
    no_suppliers_found: 'No suppliers found matching your requirements.',
    
    // Main Navigation
    search_suppliers: 'Find Suppliers',
    send_request: 'Send Request',
    requests: 'Requests',
    contacts: 'Contacts',
    dashboard: 'Dashboard',
    
    // Home Page
    find_suppliers: 'Find Suppliers',
    enter_search_query: 'Enter search query',
    search_query_placeholder: 'Enter product or service name...',
    search_button: 'Search',
    searching: 'Searching...',
    search_results: 'Search Results',
    no_results: 'No results found',
    supplier_search_subtitle: 'Find suitable suppliers for your business',
    suppliers_found: 'Suppliers found',
    select_suppliers: 'Select suppliers',
    total_selected: 'Total selected',
    next_step: 'Next step',
    previous: 'Previous',
    
    // Supplier Results
    supplier_details: 'Supplier Details',
    website: 'Website',
    add_to_contact_group: 'Add to contact group',
    select_contact_group: 'Select contact group',
    create_new_group: 'Create new group',
    added_to_group: 'Added to group',
    
    // Contact Groups
    contact_groups: 'Contact Groups',
    new_group: 'New Group',
    view_contacts: 'View Contacts',
    send_email: 'Send Email',
    create_mailing: 'Create Mailing',
    add_contact: 'Add Contact',
    email_sent: 'Message Sent!',
    email_sent_description: 'Email has been successfully sent to all contacts in the group. You will be redirected to the contact groups page.',
    back_to_group: 'Back to Group',
    new_message: 'New Message',
    sending_email_to_group: 'Sending email to all contacts in group',
    recipients: 'Recipients',
    contacts_in_group: 'Contacts in Group',
    subject: 'Subject',
    message: 'Message',
    send_message: 'Send Message',
    message_sent: 'Message Sent',
    no_contacts_in_group: 'No contacts in this group',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    organization: 'Organization',
    fill_required_fields: 'Please provide name and email for the contact',
    need_subject: 'Please enter message subject',
    need_message: 'Please enter message content',
    contact_added: 'Contact Added',
    contact_added_description: 'New contact has been successfully added to the group',
    error_add_contact: 'Failed to add contact',
    back_to_groups: 'Back to Contact Groups',
    group_name: 'Group Name',
    contacts_count: 'Contacts Count',
    create_group: 'Create Group',
    delete_group: 'Delete Group',
    confirm_delete_group: 'Are you sure you want to delete this group?',
    group_deleted: 'Group Deleted',

    // Main Navigation - New Menu Structure  
    quick_procurement: 'QUICK PROCUREMENT',
    tender_procurement: 'TENDER PROCUREMENT',
    // Removed duplicate settings and search_suppliers keys (already exist above)
    send_requests: 'Send Requests',
    supplier_selection: 'Supplier Selection',
    contact_database: 'Contact Database',
    create_specification: 'Create Specification',
    improve_specification: 'Improve Specification', 
    technical_analysis: 'Technical Analysis',
    final_supplier_selection: 'Supplier Selection',
    welcome_title: 'Welcome to SupplierFinder',
    welcome_description: 'Choose your procurement process type to get started',
    quick_procurement_home_title: 'Quick Procurement',
    quick_procurement_home_description: 'Instructions and tools for fast supplier search and request sending',
    tender_procurement_home_title: 'Tender Procurement',
    tender_procurement_home_description: 'Full tender cycle with technical analysis and proposal comparison',

    // Dashboard/Requests
    request_history: 'Request History',
    search_requests: 'Search Requests',
    request_id: 'Request ID',
    date: 'Date',
    status: 'Status',
    responses: 'Responses',
    category: 'Category',
    actions: 'Actions',
    request_details: 'Request Details',
    view_responses: 'View Responses',
    no_requests_found: 'No requests found',
    request_date: 'Request Date',
    suppliers_contacted: 'Suppliers Contacted',
    product_details: 'Product Details',
    quantity: 'Quantity',
    clone_request: 'Clone Request',
    delete_request: 'Delete Request',
    confirm_delete_request: 'Are you sure you want to delete this request?',
    request_deleted: 'Request Deleted',
    
    // Send Request
    product_name: 'Product Name',
    product_category: 'Product Category',
    select_category: 'Select Category',
    product_description: 'Product Description',
    product_quantity: 'Quantity',
    delivery_location: 'Delivery Location',
    delivery_date: 'Delivery Date',
    additional_requirements: 'Additional Requirements',
    your_name: 'Your Name',
    your_email: 'Your Email',
    your_phone: 'Your Phone',
    company_name: 'Company Name',
    submit_request: 'Submit Request',
    request_submitted: 'Request Submitted',
    request_error: 'Request Error',
    fill_required_products: 'Please fill in the product information',
    
    // Compare
    compare_responses: 'Compare Responses',
    select_parameters: 'Select Parameters',
    parameter: 'Parameter',
    supplier_responses: 'Supplier Responses',
    supplier: 'Supplier',
    price: 'Price',
    delivery_time: 'Delivery Time',
    payment_terms: 'Payment Terms',
    warranty: 'Warranty',
    supplier_name: 'Supplier Name',
    supplier_residency: 'Supplier Residency (Country)',
    supplier_inn_unp: 'TIN / UNP',
    recommended_supplier: 'Recommended Supplier',
    export_to_excel: 'Export to Excel',
    export_to_pdf: 'Export to PDF',
    compare_results: 'Compare Results',
    analysis_results: 'Analysis Results',
    ai_recommendation: 'AI Recommendation',
    response_summary: 'Response Summary',
    strengths: 'Strengths',
    weaknesses: 'Weaknesses',
    detailed_analysis: 'Detailed Analysis',
    
    // Contact Form
    "contact.form.title": "Contact Us",
    "contact.form.description": "Send a message to our support team",
    "contact.form.subject": "Subject",
    "contact.form.subjectPlaceholder": "What is your inquiry about?",
    "contact.form.message": "Message",
    "contact.form.messagePlaceholder": "Please describe your question or issue in detail...",
    "contact.form.attachments": "Attachments",
    "contact.form.send": "Send Message",
    "contact.form.sending": "Sending...",
    "contact.form.addFiles": "Add Files",
    "contact.form.uploadFiles": "Upload Files",
    "contact.success.title": "Message Sent",
    "contact.success.description": "Your message has been successfully sent. We'll contact you shortly.",
    "contact.error.title": "Message Sending Failed",
    "contact.error.message": "There was an error sending your message. Please try again later.",
    
    // Admin panel translations
    "admin.panel": "Admin Panel",
    "admin.welcome": "Welcome to the Admin Panel",
    "admin.welcomeDescription": "Manage user subscriptions and other administrative functions",
    "admin.subscriptions": "Subscriptions",
    "admin.subscriptionsDescription": "Manage user subscription plans",
    "admin.manage": "Manage",
    "admin.comingSoon": "Coming Soon",
    "admin.moreFeatures": "More administrative features will be available in future updates",
  },
  
  de: {
    // Admin panel translations
    "admin.panel": "Admin-Panel",
    "admin.welcome": "Willkommen im Admin-Panel",
    "admin.welcomeDescription": "Verwalten Sie Benutzerabonnements und andere Verwaltungsfunktionen",
    "admin.subscriptions": "Abonnements",
    "admin.subscriptionsDescription": "Verwalten Sie Benutzerabonnementpläne",
    "admin.manage": "Verwalten",
    "admin.comingSoon": "Kommt bald",
    "admin.moreFeatures": "Weitere Verwaltungsfunktionen werden in zukünftigen Updates verfügbar sein",
    
    // Contact Form
    "contact.form.title": "Kontaktieren Sie uns",
    "contact.form.description": "Senden Sie eine Nachricht an unser Support-Team",
    "contact.form.subject": "Betreff",
    "contact.form.subjectPlaceholder": "Worum geht es in Ihrer Anfrage?",
    "contact.form.message": "Nachricht",
    "contact.form.messagePlaceholder": "Bitte beschreiben Sie Ihre Frage oder Ihr Problem ausführlich...",
    "contact.form.attachments": "Anhänge",
    "contact.form.send": "Nachricht senden",
    "contact.form.sending": "Wird gesendet...",
    "contact.form.addFiles": "Dateien hinzufügen",
    "contact.form.uploadFiles": "Dateien hochladen",
    "contact.success.title": "Nachricht gesendet",
    "contact.success.description": "Ihre Nachricht wurde erfolgreich gesendet. Wir werden uns in Kürze mit Ihnen in Verbindung setzen.",
    "contact.error.title": "Fehler beim Senden der Nachricht",
    "contact.error.message": "Beim Senden Ihrer Nachricht ist ein Fehler aufgetreten. Bitte versuchen Sie es später noch einmal.",
    
    // Common
    app_title: 'SupplierSearch',
    settings: 'Einstellungen',
    language: 'Sprache',
    save: 'Speichern',
    cancel: 'Abbrechen',
    loading: 'Wird geladen...',
    error: 'Fehler',
    success: 'Erfolg',
    yes: 'Ja',
    no: 'Nein',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    view: 'Ansehen',
    add: 'Hinzufügen',
    back: 'Zurück',
    close: 'Schließen',
    selected: 'Ausgewählt',
    contact_info: 'Kontaktinformationen',
    description: 'Beschreibung',
    redirecting: 'Weiterleitung...',
    optional: 'optional',
    saving: 'Speichern...',
    
    // Account
    account: 'Konto',
    logout: 'Abmelden',
    logging_out: 'Abmelden...',
    logged_in_as: 'Angemeldet als',
    not_logged_in: 'Nicht angemeldet',
    logout_description: 'Klicken Sie auf die Schaltfläche unten, um sich abzumelden und Ihre Sitzung zu beenden.',
    settings_saved: 'Einstellungen gespeichert',
    language_changed_successfully: 'Sprache erfolgreich geändert',
    settings_description: 'Konfigurieren Sie Ihre Kontoeinstellungen',
    
    // Business Card
    business_card: 'Visitenkarte',
    business_card_setup: 'Visitenkarte einrichten',
    business_card_text: 'Visitenkarttext',
    business_card_setup_description: 'Fügen Sie Informationen hinzu, die am Ende von E-Mails an Lieferanten angezeigt werden',
    business_card_description: 'Konfigurieren Sie Ihre Visitenkarte, die allen E-Mails hinzugefügt wird',
    business_card_description_extended: 'Dieser Text wird am Ende von E-Mails an Lieferanten hinzugefügt. Fügen Sie alle notwendigen Kontaktinformationen hinzu.',
    business_card_updated_successfully: 'Visitenkarte erfolgreich aktualisiert',
    company_logo: 'Firmenlogo',
    logo_preview: 'Logo-Vorschau',
    change_logo: 'Logo ändern',
    upload_logo: 'Logo hochladen',
    enter_business_card_text: 'Geben Sie den Text der Firmenvistenkarte ein',
    
    // Search Animation
    search_initializing: 'Suche wird initialisiert',
    search_database: 'Durchsuche Datenbank',
    search_internet: 'Durchsuche Internet',
    search_finalizing: 'Verarbeite Ergebnisse',
    no_suppliers_found: 'Keine Lieferanten gefunden, die Ihren Anforderungen entsprechen.',
    
    // Main Navigation
    search_suppliers: 'Lieferanten finden',
    send_request: 'Anfrage senden',
    requests: 'Anfragen',
    contacts: 'Kontakte',
    dashboard: 'Dashboard',
    
    // Home Page
    find_suppliers: 'Lieferanten finden',
    enter_search_query: 'Suchbegriff eingeben',
    search_query_placeholder: 'Produkt- oder Dienstleistungsname eingeben...',
    search_button: 'Suchen',
    searching: 'Suche läuft...',
    search_results: 'Suchergebnisse',
    no_results: 'Keine Ergebnisse gefunden',
    supplier_search_subtitle: 'Finden Sie geeignete Lieferanten für Ihr Unternehmen',
    suppliers_found: 'Lieferanten gefunden',
    select_suppliers: 'Lieferanten auswählen',
    total_selected: 'Insgesamt ausgewählt',
    next_step: 'Nächster Schritt',
    previous: 'Zurück',
    
    // Supplier Results
    supplier_details: 'Lieferantendetails',
    website: 'Webseite',
    add_to_contact_group: 'Zur Kontaktgruppe hinzufügen',
    select_contact_group: 'Kontaktgruppe auswählen',
    create_new_group: 'Neue Gruppe erstellen',
    added_to_group: 'Zur Gruppe hinzugefügt',
    
    // Contact Groups
    contact_groups: 'Kontaktgruppen',
    new_group: 'Neue Gruppe',
    view_contacts: 'Kontakte anzeigen',
    send_email: 'E-Mail senden',
    create_mailing: 'Mailing erstellen',
    add_contact: 'Kontakt hinzufügen',
    email_sent: 'Nachricht gesendet!',
    email_sent_description: 'E-Mail wurde erfolgreich an alle Kontakte in der Gruppe gesendet. Sie werden zur Kontaktgruppenseite weitergeleitet.',
    back_to_group: 'Zurück zur Gruppe',
    new_message: 'Neue Nachricht',
    sending_email_to_group: 'E-Mail an alle Kontakte in der Gruppe senden',
    recipients: 'Empfänger',
    contacts_in_group: 'Kontakte in der Gruppe',
    subject: 'Betreff',
    message: 'Nachricht',
    send_message: 'Nachricht senden',
    message_sent: 'Nachricht gesendet',
    no_contacts_in_group: 'Keine Kontakte in dieser Gruppe',
    name: 'Name',
    email: 'E-Mail',
    phone: 'Telefon',
    organization: 'Organisation',
    fill_required_fields: 'Bitte geben Sie Name und E-Mail für den Kontakt an',
    need_subject: 'Bitte geben Sie einen Betreff ein',
    need_message: 'Bitte geben Sie einen Nachrichtentext ein',
    contact_added: 'Kontakt hinzugefügt',
    contact_added_description: 'Neuer Kontakt wurde erfolgreich zur Gruppe hinzugefügt',
    error_add_contact: 'Fehler beim Hinzufügen des Kontakts',
    back_to_groups: 'Zurück zu Kontaktgruppen',
    group_name: 'Gruppenname',
    contacts_count: 'Anzahl der Kontakte',
    create_group: 'Gruppe erstellen',
    delete_group: 'Gruppe löschen',
    confirm_delete_group: 'Sind Sie sicher, dass Sie diese Gruppe löschen möchten?',
    group_deleted: 'Gruppe gelöscht',
    
    // Dashboard/Requests
    request_history: 'Anfragenverlauf',
    search_requests: 'Anfragen durchsuchen',
    request_id: 'Anfrage-ID',
    date: 'Datum',
    status: 'Status',
    responses: 'Antworten',
    category: 'Kategorie',
    actions: 'Aktionen',
    request_details: 'Anfragedetails',
    view_responses: 'Antworten anzeigen',
    no_requests_found: 'Keine Anfragen gefunden',
    request_date: 'Anfragedatum',
    suppliers_contacted: 'Kontaktierte Lieferanten',
    product_details: 'Produktdetails',
    quantity: 'Menge',
    clone_request: 'Anfrage klonen',
    delete_request: 'Anfrage löschen',
    confirm_delete_request: 'Sind Sie sicher, dass Sie diese Anfrage löschen möchten?',
    request_deleted: 'Anfrage gelöscht',
    
    // Send Request
    product_name: 'Produktname',
    product_category: 'Produktkategorie',
    select_category: 'Kategorie auswählen',
    product_description: 'Produktbeschreibung',
    product_quantity: 'Menge',
    delivery_location: 'Lieferort',
    delivery_date: 'Lieferdatum',
    additional_requirements: 'Zusätzliche Anforderungen',
    your_name: 'Ihr Name',
    your_email: 'Ihre E-Mail',
    your_phone: 'Ihre Telefonnummer',
    company_name: 'Firmenname',
    submit_request: 'Anfrage absenden',
    request_submitted: 'Anfrage gesendet',
    request_error: 'Anfragefehler',
    fill_required_products: 'Bitte füllen Sie die Produktinformationen aus',
    
    // Compare
    compare_responses: 'Antworten vergleichen',
    select_parameters: 'Parameter auswählen',
    parameter: 'Parameter',
    supplier_responses: 'Lieferantenantworten',
    supplier: 'Lieferant',
    price: 'Preis',
    delivery_time: 'Lieferzeit',
    payment_terms: 'Zahlungsbedingungen',
    warranty: 'Garantie',
    supplier_name: 'Lieferantenname',
    supplier_residency: 'Lieferanten-Residenz (Land)',
    supplier_inn_unp: 'Steuer-ID / UNP',
    recommended_supplier: 'Empfohlener Lieferant',
    export_to_excel: 'Nach Excel exportieren',
    export_to_pdf: 'Als PDF exportieren',
    compare_results: 'Vergleichsergebnisse',
    analysis_results: 'Analyseergebnisse',
    ai_recommendation: 'KI-Empfehlung',
    response_summary: 'Antwortübersicht',
    strengths: 'Stärken',
    weaknesses: 'Schwächen',
    detailed_analysis: 'Detaillierte Analyse',
  }
};