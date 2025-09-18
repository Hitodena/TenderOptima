# Правила кэширования TenderOptima

## Обзор

В приложении TenderOptima реализована система селективного кэширования, которая решает проблему отображения в Chrome, сохраняя при этом удобство использования для пользователей.

## Принципы кэширования

### 🚫 Что НЕ кэшируется (для предотвращения проблем с Chrome)

1. **HTML страницы** - всегда загружаются свежие версии
2. **API маршруты** - данные всегда актуальные
3. **Аутентификация** - полное отключение кэширования для безопасности

### ✅ Что кэшируется (для удобства пользователей)

1. **Пользовательские сессии** - сохраняются на 30 дней
2. **Статические ресурсы** - кэшируются с хэшами
3. **Токены доступа** - действуют 30 дней

## Детальные правила по типам ресурсов

### 1. API Маршруты (`/api/*`)

#### Аутентификация (`/api/auth/*`)
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```
**Цель**: Полное отключение кэширования для безопасности

#### Остальные API (`/api/*`)
```
Cache-Control: no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
Vary: Cookie, Authorization
```
**Цель**: Отключение кэширования данных, но сохранение сессий

### 2. Статические ресурсы

#### В Development режиме
```
Cache-Control: public, max-age=300  # 5 минут
Last-Modified: [текущее время]
ETag: "dev-[timestamp]"
```

#### В Production режиме
```
Cache-Control: public, max-age=31536000, immutable  # 1 год
Last-Modified: [время сборки]
```
**Файлы**: `.js`, `.css`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.ico`, `.svg`, `.woff`, `.woff2`, `.ttf`, `.eot`

### 3. HTML страницы
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
Pragma: no-cache
Expires: 0
Last-Modified: [текущее время]
ETag: "[timestamp]"
```

## Настройки сессий

### Куки сессий
```javascript
{
  name: 'supplier_session',
  maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 дней
  secure: false,                      // Для локальной разработки
  sameSite: 'lax',                   // Совместимость с браузерами
  httpOnly: true,                    // Защита от XSS
  path: '/',
  rolling: true                      // Обновление при каждом запросе
}
```

### Токены доступа
```javascript
{
  expiry: 30 * 24 * 60 * 60 * 1000,  // 30 дней
  secret: process.env.TOKEN_SECRET,
  algorithm: 'sha256'
}
```

## Решение проблем с Chrome

### Проблема
Chrome агрессивно кэширует старые версии файлов, что приводит к:
- Отображению устаревшего интерфейса
- Ошибкам JavaScript
- Проблемам с загрузкой стилей

### Решение
1. **Селективное кэширование** - разные правила для разных типов ресурсов
2. **Версионирование** - временные метки для скриптов
3. **Агрессивные заголовки** - для HTML и API маршрутов
4. **Сохранение сессий** - пользователи остаются авторизованными

## Техническая реализация

### Серверные заголовки (server/index.ts)
```javascript
app.use((req, res, next) => {
  const path = req.path;
  const isApiRoute = path.startsWith('/api/');
  const isAuthRoute = path.startsWith('/api/auth/');
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i.test(path);
  
  if (isApiRoute) {
    if (isAuthRoute) {
      // Полное отключение кэширования
      res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    } else {
      // Отключение кэширования данных, сохранение сессий
      res.header('Cache-Control', 'no-cache, must-revalidate, private');
    }
  } else if (isStaticAsset) {
    // Кэширование статических ресурсов
    res.header('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    // Отключение кэширования HTML
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
  
  next();
});
```

### Middleware для сессий (server/auth.ts)
```javascript
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.header('Cache-Control', 'no-cache, must-revalidate, private');
    res.header('Vary', 'Cookie, Authorization');
    
    // Обновляем время жизни сессии
    if (req.session) {
      req.session.touch();
    }
  }
  next();
});
```

### Версионирование в HTML (client/index.html)
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
<meta name="version" content="<%= new Date().getTime() %>" />
<script type="module" src="/src/main.tsx?v=<%= new Date().getTime() %>"></script>
```

## Мониторинг и отладка

### Проверка заголовков
```bash
# Проверка заголовков для разных типов ресурсов
curl -I http://localhost:5000/                    # HTML
curl -I http://localhost:5000/api/auth/me         # API
curl -I http://localhost:5000/src/main.tsx        # JS
```

### Логирование сессий
```javascript
console.log('[Auth] Session settings:', {
  maxAge: sessionSettings.cookie?.maxAge,
  rolling: sessionSettings.rolling,
  resave: sessionSettings.resave
});
```

## Рекомендации для разработчиков

### 1. При добавлении новых API маршрутов
- Убедитесь, что они используют правильные заголовки кэширования
- Для аутентификации используйте `no-store`
- Для данных используйте `no-cache, private`

### 2. При изменении статических ресурсов
- Используйте хэширование имен файлов в production
- Обновляйте версии в development

### 3. При работе с сессиями
- Не изменяйте настройки `maxAge` без необходимости
- Используйте `rolling: true` для обновления времени жизни
- Тестируйте в разных браузерах

## Безопасность

### Защита от XSS
```javascript
res.header('X-Content-Type-Options', 'nosniff');
res.header('X-Frame-Options', 'DENY');
res.header('X-XSS-Protection', '1; mode=block');
```

### Защита сессий
```javascript
cookie: {
  httpOnly: true,    // Защита от XSS
  sameSite: 'lax',   // Защита от CSRF
  secure: false      // Для локальной разработки
}
```

## Производительность

### Оптимизация загрузки
1. **Статические ресурсы** - кэшируются на 1 год
2. **API данные** - не кэшируются, всегда актуальные
3. **HTML** - не кэшируется, предотвращает проблемы с Chrome

### Мониторинг
- Отслеживайте время загрузки страниц
- Мониторьте количество запросов к API
- Проверяйте размер кэша браузера

## Заключение

Система селективного кэширования TenderOptima решает проблему отображения в Chrome, сохраняя при этом:
- ✅ Удобство использования (сессии сохраняются)
- ✅ Безопасность (аутентификация не кэшируется)
- ✅ Производительность (статические ресурсы кэшируются)
- ✅ Совместимость (работает во всех браузерах)

Пользователи остаются авторизованными на 30 дней, но всегда видят актуальную версию приложения.
