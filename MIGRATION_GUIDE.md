# 🚀 Руководство по миграции SupplierFinder в корневую папку

## 📋 Что мы делаем:
Переносим все файлы из папки `SupplierFinder/` в корневую папку проекта для упрощения работы.

## 🔄 Пошаговая миграция:

### Шаг 1: Запустите скрипт миграции
```powershell
# В PowerShell (от имени администратора, если нужно)
.\migrate-to-root.ps1
```

### Шаг 2: Если скрипт не работает, выполните вручную:
```powershell
# 1. Создайте резервную копию
New-Item -ItemType Directory -Path "backup-root" -Force
Copy-Item -Path "package.json" -Destination "backup-root\" -Force
Copy-Item -Path "start-dev.bat" -Destination "backup-root\" -Force
Copy-Item -Path "start-dev.ps1" -Destination "backup-root\" -Force

# 2. Скопируйте все файлы из SupplierFinder в корень
Copy-Item -Path "SupplierFinder\*" -Destination "." -Recurse -Force

# 3. Удалите пустую папку SupplierFinder
Remove-Item -Path "SupplierFinder" -Recurse -Force

# 4. Замените package.json
Copy-Item -Path "package-new.json" -Destination "package.json" -Force
```

### Шаг 3: Установите зависимости
```bash
npm install
```

### Шаг 4: Запустите сервер
```bash
npm run dev
```

## 📁 Новая структура проекта:
```
C:\Users\andda\Downloads\SupplierFinder\
├── .env                    ← Переменные окружения
├── package.json           ← Основной package.json
├── server/                ← Серверная часть
│   ├── index.ts
│   ├── db.ts
│   └── ...
├── client/                ← Клиентская часть
│   ├── src/
│   └── index.html
├── shared/                ← Общие файлы
│   ├── schema.ts
│   └── types.ts
├── start-dev.bat          ← Скрипты запуска
├── start-dev.ps1
├── vite.config.ts
├── tsconfig.json
└── ... (остальные файлы)
```

## ✅ Преимущества после миграции:
- ✅ Все команды работают из корня
- ✅ Нет путаницы с директориями
- ✅ Стандартная структура проекта
- ✅ Проще навигация
- ✅ Меньше ошибок с путями

## 🎯 Команды для запуска (после миграции):

### Основные команды:
```bash
npm run dev              # Запуск сервера разработки
npm run client           # Запуск клиента
npm run build            # Сборка проекта
npm run check            # Проверка TypeScript
```

### Диагностические команды:
```bash
npm run test:imports     # Тест импортов
npm run dev:simple       # Простой запуск сервера
```

### Скрипты запуска:
```bash
# Windows Command Prompt
start-dev.bat

# Windows PowerShell
.\start-dev.ps1
```

## 🔄 Rollback (если что-то пошло не так):
```powershell
# Восстановите файлы из резервной копии
Copy-Item -Path "backup-root\*" -Destination "." -Force

# Удалите скопированные файлы (будьте осторожны!)
# Удалите только те файлы, которые были скопированы из SupplierFinder
```

## 🚨 Если возникли проблемы:

1. **Проверьте структуру папок:**
   ```bash
   dir
   # Должны увидеть: server/, client/, package.json, .env
   ```

2. **Проверьте переменные окружения:**
   ```bash
   node test-server-simple.js
   ```

3. **Проверьте импорты:**
   ```bash
   npm run test:imports
   ```

4. **Проверьте TypeScript:**
   ```bash
   npm run check
   ```

## 🎉 После успешной миграции:
- Сервер будет доступен на `http://localhost:5000`
- Все команды будут работать из корневой папки
- Структура проекта станет стандартной и понятной

**Готово! Теперь у вас чистая и простая структура проекта!** 🚀
