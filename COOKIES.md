# Cookies TenderOptima

Документ описывает cookies, которые используются приложением TenderOptima, и связанные механизмы хранения данных в браузере.

## Используемые cookies

| Cookie | Обозначение | Функция | Где создаётся / обновляется | Где используется | Срок хранения | Атрибуты |
| --- | --- | --- | --- | --- | --- | --- |
| `sf_token` | Токен авторизации пользователя | Хранит JWT access token текущего пользователя. Используется frontend-приложением для авторизации API-запросов через заголовок `Authorization: Bearer <token>`. | `services/frontend/app/composables/useAuth.ts` через `useCookie()`. Значение устанавливается после успешного входа или регистрации в `services/frontend/app/pages/auth.vue`. | `services/frontend/app/plugins/axios.ts` добавляет токен в `Authorization`; `services/frontend/app/middleware/auth.global.ts` проверяет наличие токена для доступа к приватным страницам. | 30 дней (`maxAge: 60 * 60 * 24 * 30`) | `SameSite=Lax`; `Secure` включается только в production; cookie не является `HttpOnly`, так как frontend должен читать токен для Bearer-заголовка. |

## Жизненный цикл `sf_token`

1. Пользователь входит или регистрируется через backend endpoints `POST /api/auth/token` или `POST /api/auth/register`.
2. Backend возвращает JWT в JSON-поле `access_token`; backend не устанавливает `Set-Cookie`.
3. Frontend вызывает `auth.setToken(access_token)` и сохраняет JWT в cookie `sf_token`.
4. Axios interceptor читает `sf_token` и добавляет `Authorization: Bearer <token>` ко всем API-запросам.
5. При logout или ответе API `401 Unauthorized` frontend вызывает `auth.clearToken()`, очищая cookie.

## Backend cookies

Backend API сейчас не создаёт cookies и не использует server-side session cookie. Авторизация backend endpoints построена на `OAuth2PasswordBearer`: токен ожидается в HTTP-заголовке `Authorization`.

## Не cookies, но связанное хранение в браузере

| Ключ | Хранилище | Функция | Где используется | Срок хранения |
| --- | --- | --- | --- | --- |
| `nuxt-color-mode` | `localStorage` по умолчанию в `@nuxtjs/color-mode` | Сохраняет предпочтение пользователя по светлой/тёмной теме для `UColorModeButton`. В текущем `services/frontend/nuxt.config.ts` cookie storage не настроен. | `UColorModeButton` в `services/frontend/app/layouts/default.vue` и `services/frontend/app/layouts/auth.vue`. | До очистки localStorage пользователем или браузером. |
| `tz-letter-selection:<analysisId>:<supplierId>:<kp>` | `sessionStorage` | Временно сохраняет выбранные пункты письма поставщику на странице анализа ТЗ/КП. | `services/frontend/app/pages/tz-analysis/[id].vue`. | До закрытия вкладки или очистки sessionStorage. |

## Примечания по безопасности

- `sf_token` содержит JWT и должен рассматриваться как чувствительное значение.
- Cookie `sf_token` доступен JavaScript-коду приложения, поэтому защита от XSS критична.
- `SameSite=Lax` снижает риск межсайтовой отправки cookie в навигационных сценариях, но API всё равно авторизуется Bearer-заголовком, который frontend формирует явно.
- В production cookie передаётся только по HTTPS благодаря `secure: import.meta.env.PROD`.
