# 🚀 Руководство по управлению системой обработки вложений

## 📊 **Мониторинг и статистика**

### Получить общую статистику
```bash
GET /api/attachment-stats
```
Возвращает:
- Метрики обработки (успешные/неудачные)
- Статистику производительности
- Информацию о кеше
- Статистику временных файлов

### Получить статистику кеша
```bash
GET /api/cache-stats
```
Возвращает:
- Размер кеша
- Hit/Miss rate
- Список записей в кеше
- TTL информации

### Получить системные метрики
```bash
GET /api/system-metrics
```
Возвращает:
- Использование памяти
- Время работы системы
- Статистику временных файлов
- Производительность обработки

## 🗄️ **Управление кешем**

### Очистить весь кеш
```bash
POST /api/cache/clear
```

### Очистить устаревшие записи
```bash
POST /api/cache/cleanup
```

### Настроить параметры кеша
```bash
POST /api/cache/config
Content-Type: application/json

{
  "maxSize": 1000,     // Максимальное количество записей
  "ttl": 86400000      // TTL в миллисекундах (24 часа)
}
```

## 🧹 **Управление временными файлами**

### Получить статистику временных файлов
```bash
GET /api/temp-files-stats
```

### Очистить временные файлы
```bash
POST /api/temp-files/cleanup
```

## 📈 **Мониторинг производительности**

### Получить информацию о производительности
```bash
GET /api/performance
```

### Запустить мониторинг
```bash
POST /api/monitoring/start
Content-Type: application/json

{
  "intervalMs": 300000  // Интервал в миллисекундах (5 минут)
}
```

### Логировать текущее состояние
```bash
POST /api/system/status
```

## ⚙️ **Настройка batch операций**

### Получить статистику batch операций
```bash
GET /api/batch-stats
```

### Настроить размер batch
```bash
POST /api/batch/config
Content-Type: application/json

{
  "batchSize": 20  // Размер batch для операций с БД
}
```

## 📊 **Экспорт и сброс метрик**

### Экспортировать все метрики
```bash
GET /api/metrics/export
```

### Сбросить все метрики
```bash
POST /api/metrics/reset
```

## 🔧 **Примеры использования**

### 1. Проверить состояние системы
```bash
curl -X GET "http://localhost:5000/api/system-metrics" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Очистить кеш и временные файлы
```bash
curl -X POST "http://localhost:5000/api/cache/clear" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X POST "http://localhost:5000/api/temp-files/cleanup" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Настроить кеш для высокой нагрузки
```bash
curl -X POST "http://localhost:5000/api/cache/config" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "maxSize": 2000,
    "ttl": 43200000
  }'
```

### 4. Запустить мониторинг каждые 2 минуты
```bash
curl -X POST "http://localhost:5000/api/monitoring/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "intervalMs": 120000
  }'
```

## 🚨 **Диагностика проблем**

### Если система работает медленно:
1. Проверьте статистику кеша: `GET /api/cache-stats`
2. Очистите временные файлы: `POST /api/temp-files/cleanup`
3. Проверьте производительность: `GET /api/performance`

### Если много ошибок:
1. Проверьте метрики обработки: `GET /api/attachment-stats`
2. Очистите кеш: `POST /api/cache/clear`
3. Сбросьте метрики: `POST /api/metrics/reset`

### Если не хватает памяти:
1. Уменьшите размер кеша: `POST /api/cache/config`
2. Увеличьте частоту очистки временных файлов
3. Проверьте системные метрики: `GET /api/system-metrics`

## 📝 **Логирование**

Система автоматически логирует:
- ✅ Начало и завершение обработки файлов
- ✅ Ошибки с детальной классификацией
- ✅ Статистику кеша и производительности
- ✅ Системные метрики каждые 5 минут

Логи можно найти в консоли сервера или в файлах логов.
