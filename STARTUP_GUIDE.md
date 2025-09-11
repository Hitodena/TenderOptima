# 🚀 Руководство по запуску SupplierFinder

## Проблемы, которые были исправлены:

### 1. ✅ Проблема с переключением директорий
- Созданы скрипты `start-dev.bat` и `start-dev.ps1` в корневой папке
- Обновлен корневой `package.json` с правильными командами
- Теперь можно запускать из любой директории

### 2. ✅ Проблема с ES модулями
- Исправлены импорты в `server/index.ts` (убраны `* as` для dotenv)
- Все файлы уже используют правильный синтаксис ES модулей
- Создан `.env` файл из `env.dev`

### 3. ✅ Проблема с зависающими командами
- Создан улучшенный скрипт `start-server.js`
- Добавлены новые команды в `package.json`
- Улучшена обработка ошибок и логирование

## 🎯 Способы запуска сервера:

### Вариант 1: Из корневой папки (рекомендуется)
```bash
# Windows Command Prompt
start-dev.bat

# Windows PowerShell
.\start-dev.ps1

# Или через npm
npm run dev
```

### Вариант 2: Из папки SupplierFinder
```bash
cd SupplierFinder

# Основная команда
npm run dev

# Альтернативная команда
npm run dev:simple

# Тест импортов
npm run test:imports
```

### Вариант 3: Прямой запуск
```bash
cd SupplierFinder
tsx server/index.ts
```

## 🔧 Диагностика проблем:

### Проверка импортов:
```bash
cd SupplierFinder
npm run test:imports
```

### Проверка TypeScript:
```bash
cd SupplierFinder
npm run check
```

### Установка зависимостей:
```bash
# Из корневой папки
npm run install-all

# Или из папки SupplierFinder
cd SupplierFinder
npm install
```

## 📁 Структура проекта:
```
SupplierFinder/
├── start-dev.bat          # Скрипт запуска для Windows
├── start-dev.ps1          # Скрипт запуска для PowerShell
├── package.json           # Корневой package.json
└── SupplierFinder/        # Основной проект
    ├── .env              # Переменные окружения
    ├── package.json      # Основной package.json
    ├── server/           # Серверная часть
    ├── client/           # Клиентская часть
    └── start-server.js   # Улучшенный скрипт запуска
```

## 🚨 Если сервер все еще не запускается:

1. **Проверьте переменные окружения:**
   - Убедитесь, что файл `.env` существует в папке `SupplierFinder`
   - Проверьте, что `DATABASE_URL` установлен

2. **Проверьте зависимости:**
   ```bash
   cd SupplierFinder
   npm install
   ```

3. **Проверьте порт:**
   - Сервер пытается запуститься на порту 5000
   - Если порт занят, сервер автоматически найдет свободный

4. **Проверьте логи:**
   - Все команды теперь выводят подробную информацию
   - Ошибки будут показаны в консоли

## 🎉 Готово!
Теперь сервер должен запускаться без проблем. Выберите любой из способов запуска выше.
