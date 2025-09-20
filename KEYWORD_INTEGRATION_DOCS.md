# Интеграция ключевых слов в семантический скоринг

## Обзор

Успешно интегрирована система ключевых слов в алгоритм семантического поиска по реестру поставщиков. Теперь система использует одобренные поисковые запросы для повышения релевантности результатов поиска.

## Что было реализовано

### 1. Модификация MatchingService

**Файл:** `server/matching-service.ts`

#### Добавленные импорты:
```typescript
import type { Supplier, SearchRequest, SupplierSearchKeyword } from "@shared/schema";
import { db } from "./db";
import { supplierSearchKeywords } from "../shared/schema";
import { eq } from "drizzle-orm";
```

#### Новая функция для получения ключевых слов:
```typescript
private async getKeywordsForSupplier(supplierId: number): Promise<string[]> {
  try {
    const keywords = await db
      .select({ keyword: supplierSearchKeywords.keyword })
      .from(supplierSearchKeywords)
      .where(eq(supplierSearchKeywords.supplierId, supplierId));
    
    return keywords.map(kw => kw.keyword);
  } catch (error) {
    console.error(`Error fetching keywords for supplier ${supplierId}:`, error);
    return [];
  }
}
```

#### Интеграция в алгоритм скоринга:
```typescript
// НОВОЕ ПРАВИЛО: Проверка ключевых слов из одобренных поисковых запросов
try {
  const supplierKeywords = await this.getKeywordsForSupplier(supplier.id);
  const originalQuery = searchRequest.productName.toLowerCase().trim();
  
  if (supplierKeywords.length > 0) {
    // Проверяем точное совпадение с исходным запросом
    if (supplierKeywords.some(kw => kw.toLowerCase().trim() === originalQuery)) {
      score += 2.0; // Значительный бонус за прямое совпадение
      matchedTerms.push(`keyword:${originalQuery}`);
      matchDetails.keywordMatch = true;
      matchDetails.matchedKeyword = originalQuery;
      console.log(`🎯 KEYWORD MATCH: "${originalQuery}" found in approved keywords for supplier "${supplier.name}" (+2.0 bonus)`);
    }
    
    // Проверяем частичное совпадение с ключевыми словами
    else if (supplierKeywords.some(kw => {
      const lowerKw = kw.toLowerCase().trim();
      return lowerKw.includes(originalQuery) || originalQuery.includes(lowerKw);
    })) {
      score += 1.0; // Бонус за частичное совпадение
      matchedTerms.push(`partial-keyword:${originalQuery}`);
      matchDetails.partialKeywordMatch = true;
      console.log(`🔍 PARTIAL KEYWORD MATCH: "${originalQuery}" partially matches approved keywords for supplier "${supplier.name}" (+1.0 bonus)`);
    }
  }
} catch (error) {
  console.error(`Error checking keywords for supplier ${supplier.id}:`, error);
}
```

### 2. Система скоринга

#### Бонусы за ключевые слова:
- **Точное совпадение:** +2.0 балла
- **Частичное совпадение:** +1.0 балл

#### Логика проверки:
1. Получение всех ключевых слов для поставщика из таблицы `supplier_search_keywords`
2. Сравнение исходного поискового запроса с ключевыми словами
3. Применение бонусов в зависимости от типа совпадения
4. Логирование совпадений для отладки

### 3. Асинхронная обработка

Алгоритм был изменен с синхронного `map` на асинхронный `Promise.all` для поддержки запросов к базе данных:

```typescript
const matches = await Promise.all(suppliers.map(async (supplier) => {
  // ... логика скоринга с проверкой ключевых слов
}));
```

## Как это работает

### 1. Процесс одобрения поставщика

1. Пользователь выполняет поиск поставщиков
2. Результаты сохраняются в `staging_suppliers`
3. Администратор одобряет поставщика через API модерации
4. Создается запись в `suppliers` и связь в `supplier_search_keywords`

### 2. Процесс поиска с ключевыми словами

1. Пользователь вводит поисковый запрос
2. Система получает всех поставщиков-кандидатов
3. Для каждого поставщика:
   - Выполняется стандартный скоринг (название, описание, категории)
   - Получаются связанные ключевые слова из `supplier_search_keywords`
   - Проверяется совпадение с исходным запросом
   - Применяются бонусы за ключевые слова
4. Результаты сортируются по общему score

### 3. Самообучаемость системы

Чем больше поставщиков одобряется через систему модерации, тем точнее становится внутренний поиск по реестру. Система "запоминает" успешные поисковые запросы и использует их для повышения релевантности.

## Тестирование

### Созданные тестовые скрипты:

1. **`test-keyword-integration.js`** - Основной тест интеграции
2. **`approve-supplier.js`** - Скрипт для одобрения поставщиков
3. **`check-approved-suppliers.js`** - Проверка статуса записей
4. **`test-keyword-algorithm.js`** - Тест алгоритма ключевых слов

### Результаты тестирования:

- ✅ Поставщики успешно одобряются через API модерации
- ✅ Создаются записи в таблице `suppliers`
- ✅ Создаются связи в таблице `supplier_search_keywords`
- ✅ Алгоритм интегрирован в `MatchingService`
- ✅ Логирование работает корректно

## Логирование

Система ведет подробное логирование:

```
🎯 KEYWORD MATCH: "поддоны купить" found in approved keywords for supplier "Bydom" (+2.0 bonus)
🔍 PARTIAL KEYWORD MATCH: "поддоны" partially matches approved keywords for supplier "Partnerpack" (+1.0 bonus)
```

## Преимущества

1. **Повышенная релевантность** - поставщики с одобренными ключевыми словами получают приоритет
2. **Самообучаемость** - система улучшается с каждым одобренным поставщиком
3. **Прозрачность** - все совпадения логируются для отладки
4. **Гибкость** - поддержка как точных, так и частичных совпадений

## Будущие улучшения

1. **Вес ключевых слов** - разные веса для разных типов ключевых слов
2. **Временные факторы** - учет времени одобрения ключевых слов
3. **Пользовательские предпочтения** - учет предпочтений конкретных пользователей
4. **Аналитика** - статистика эффективности ключевых слов

## Заключение

Интеграция ключевых слов успешно реализована и готова к использованию. Система теперь способна "учиться" на одобренных поставщиках и предоставлять более релевантные результаты поиска.
