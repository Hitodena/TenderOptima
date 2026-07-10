# Чекпоинт 5.1 — TenderOptima landing

**Дата:** 2026-07-10  
**Проект:** `c:\Projects\TenderOptima2026`  
**Статус:** зафиксирован локально (agentmemory MCP в сессии недоступен)

## Что означает 5.1

Шаг **5.1** блока **«Модуль 2. ТЗ / КП»** (`TzKpHowItWorks.vue`):

| Поле | Значение |
|------|----------|
| ID шага | `upload-area` |
| Заголовок | Загрузка ТЗ |
| Мок | dropzone + загруженный PDF + кнопка «Анализировать ТЗ» |
| Скриншот (legacy) | `/landing/upload_area_analyze.png` |

Соседние шаги модуля 2: 5.2 извлечение → 5.3 проверка → 5.4 сопоставление → 5.5 письмо поставщику.

## Артефакты чекпоинта

- `services/frontend/app/components/landing/TzKpHowItWorks.vue` — рабочая версия в проекте
- `add/TzKpHowItWorks.vue` — снимок для ручной доработки (синхронизирован с рабочей копией)

## Поведение блока (на момент чекпоинта)

- Автопереключение шагов **только в viewport** (`useScrollReveal`, `once: false`)
- Таймлайн слева, анимированный mock-window справа
- Eyebrow секции: «Модуль 2. ТЗ / КП»
- Интервал автоплея: 5000 ms (prop `intervalMs`)

## Связанные незакоммиченные правки лендинга (контекст сессии)

- `LANDING_CTA_FORM_SUBMIT_LABEL` — «Получить доступ на 14 дней» (финальная форма)
- `AppFooter` — «© TenderOptima, {year}. Все права защищены»
- `ProblemSolutionBridge` — исправлено авто-переключение JTBD-вкладок
- `HowItWorksIntro` — крупные цифры 1/2, «Два модуля — один инструмент»
- `LandingPricingTeaser` + `PricingFeatureMatrix` + `pricing.ts` — единая тарифная секция
- FAQ на главной — `UAccordion type="single"`

## Concepts (для agentmemory / поиска)

`checkpoint-5.1`, `tz-kp-upload`, `модуль-2`, `загрузка-тз`, `TzKpHowItWorks`, `landing-mock`

## Восстановление

1. Открыть `add/TzKpHowItWorks.vue` или рабочий путь в `services/frontend/...`
2. На лендинге: секция `#tz-analysis`, первый шаг таймлайна «01 Загрузка ТЗ»
