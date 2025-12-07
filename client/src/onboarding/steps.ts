export type OnboardingPlacement = "top" | "bottom" | "left" | "right" | "auto";

export type OnboardingTourStep = {
  id: string;
  target: string;
  title: string;
  description: string;
  placement?: OnboardingPlacement;
};

export type OnboardingPageKey = "login-landing" | "quick-procurement" | "search" | "send-request" | "send-request-with-id" | "select-request-parameters";

export const onboardingSteps: Record<OnboardingPageKey, OnboardingTourStep[]> = {
  "login-landing": [
    {
      id: "welcome",
      target: "login-landing-hero",
      title: "Домашний экран",
      description: "Здесь вы видите приветствие и статус подписки — отсюда стартуют все сценарии.",
      placement: "bottom",
    },
    {
      id: "quick-actions",
      target: "login-landing-primary-cta",
      title: "Быстрые действия",
      description: "Выберите «Выбор поставщика» для экспресс-запроса или «Технический анализ» для полноценного тендера.",
      placement: "right",
    },
    {
      id: "next-steps",
      target: "login-landing-guide",
      title: "Что делать дальше",
      description: "Блок «Быстрый старт» подскажет три шага: выбрать тип закупки, отправить запросы и сравнить ответы.",
      placement: "top",
    },
  ],
  "quick-procurement": [
    {
      id: "welcome",
      target: "quick-procurement-hero",
      title: "Быстрая закупка",
      description: "Здесь собраны инструменты для быстрого поиска поставщиков и отправки запросов. Выберите нужный раздел.",
      placement: "bottom",
    },
    {
      id: "features",
      target: "quick-procurement-features",
      title: "Основные функции",
      description: "Четыре карточки: поиск поставщиков, отправка запросов, выбор поставщика и управление контактами. Начните с поиска или сразу создайте запрос.",
      placement: "bottom",
    },
    {
      id: "guide",
      target: "quick-procurement-guide",
      title: "Как это работает",
      description: "Три простых шага: найдите поставщиков, отправьте запросы, выберите лучшее предложение. Всё готово к использованию.",
      placement: "top",
    },
  ],
  "search": [
    {
      id: "welcome",
      target: "search-hero",
      title: "Поиск поставщиков",
      description: "Здесь вы можете найти поставщиков по ключевым словам. Введите запрос, выберите регион и нажмите кнопку поиска.",
      placement: "bottom",
    },
    {
      id: "keywords",
      target: "search-keywords",
      title: "Ключевые слова",
      description: "Введите товар или услугу для поиска. Можно указать несколько запросов через запятую (до 5). Нажмите на иконку информации, чтобы узнать правила составления запросов.",
      placement: "bottom",
    },
    {
      id: "regions",
      target: "search-regions",
      title: "Выбор регионов",
      description: "Выберите регионы для поиска. Система автоматически определит доступные поисковые системы (Yandex, Google, реестр) в зависимости от выбранных регионов.",
      placement: "top",
    },
    {
      id: "search-button",
      target: "search-button",
      title: "Запуск поиска",
      description: "Нажмите эту кнопку, чтобы начать поиск. Результаты будут показаны на следующей странице, где вы сможете выбрать поставщиков и отправить им запросы.",
      placement: "top",
    },
  ],
  "send-request": [
    {
      id: "welcome",
      target: "send-request-hero",
      title: "Отправка запроса",
      description: "Здесь вы выбираете поставщиков и формируете запрос на коммерческие предложения. Добавьте поставщиков или загрузите их из контактов.",
      placement: "bottom",
    },
    {
      id: "add-suppliers",
      target: "send-request-add-suppliers",
      title: "Добавление поставщиков",
      description: "Используйте эти инструменты для добавления поставщиков: введите вручную, загрузите из Excel или выберите из базы контактов.",
      placement: "bottom",
    },
    {
      id: "suppliers-list",
      target: "send-request-suppliers-list",
      title: "Список поставщиков",
      description: "Здесь отображаются все добавленные поставщики. Выберите email-адреса для отправки запроса, используя чекбоксы рядом с каждым email.",
      placement: "top",
    },
    {
      id: "continue-button",
      target: "send-request-continue-button",
      title: "Продолжить",
      description: "После выбора поставщиков нажмите эту кнопку, чтобы перейти к выбору параметров запроса и описанию товара.",
      placement: "top",
    },
  ],
  "send-request-with-id": [
    {
      id: "welcome",
      target: "send-request-email-hero",
      title: "Форма отправки",
      description: "Здесь вы заполняете финальную форму запроса. Проверьте данные и отправьте запрос выбранным поставщикам.",
      placement: "bottom",
    },
    {
      id: "email-form",
      target: "send-request-email-form",
      title: "Форма запроса",
      description: "Заполните тему письма и текст запроса. Система автоматически подставит выбранные параметры и описание товара.",
      placement: "top",
    },
  ],
  "select-request-parameters": [
    {
      id: "welcome",
      target: "select-parameters-hero",
      title: "Выбор параметров",
      description: "На этом этапе вы выбираете параметры, которые будут включены в запрос поставщикам, и описываете товар или услугу.",
      placement: "bottom",
    },
    {
      id: "parameters-list",
      target: "select-parameters-list",
      title: "Параметры запроса",
      description: "Выберите параметры, которые должны быть в ответе поставщика: цена, сроки, условия оплаты и другие. Можно добавить свои параметры.",
      placement: "right",
    },
    {
      id: "product-description",
      target: "select-parameters-description",
      title: "Описание товара",
      description: "Опишите детально товар или услугу: технические характеристики, объемы, особые требования. Эта информация будет в письме.",
      placement: "left",
    },
    {
      id: "create-button",
      target: "select-parameters-create-button",
      title: "Создать запрос",
      description: "После выбора параметров и заполнения описания нажмите эту кнопку, чтобы создать запрос и перейти к форме отправки.",
      placement: "top",
    },
  ],
};

export const onboardingRouteMap: Record<string, OnboardingPageKey> = {
  "/": "login-landing",
  "/login-landing": "login-landing",
  "/quick-procurement": "quick-procurement",
  "/search": "search",
  "/send-request": "send-request",
  "/select-request-parameters": "select-request-parameters",
};

