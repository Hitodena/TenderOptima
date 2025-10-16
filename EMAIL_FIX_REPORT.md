# Отчет об исправлении ошибки отправки email после поиска через Яндекс

## Проблема
После поиска поставщиков через Яндекс возникала ошибка **HTTP 400 Bad Request** при попытке отправить email на `/api/send-email`. Дополнительно возникали ошибки `TypeError: Failed to execute 'json' on 'Response': body stream already read`.

## Причины проблемы

### 1. Неполная схема валидации
- Схема `emailTemplateSchema` не поддерживала поля `apiSuppliers`, `fromContactGroup`, `parameters`
- Это приводило к ошибкам валидации при отправке данных от API поставщиков

### 2. Неправильная обработка поставщиков на сервере
- Логика обработки API поставщиков была неполной
- Отсутствовала правильная фильтрация между database и API поставщиками
- Не передавались данные `apiSuppliers` в запросе

### 3. Ошибка с response stream
- В `queryClient.ts` код пытался читать response body несколько раз
- Response stream можно прочитать только один раз

## Исправления

### 1. Расширение схемы валидации (`shared/schema.ts`)
```typescript
export const emailTemplateSchema = z.object({
  // ... существующие поля ...
  
  // Support for API suppliers from search engines
  apiSuppliers: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    website: z.string().optional(),
    description: z.string().optional(),
    categories: z.array(z.string()).optional(),
    searchEngine: z.string().optional(),
    allEmails: z.array(z.string()).optional(),
    allPhones: z.array(z.string()).optional(),
    searchDate: z.string().optional(),
  })).optional().default([]),
  
  // Support for contact groups
  fromContactGroup: z.boolean().optional().default(false),
  
  // User-selected parameters for email templates
  parameters: z.array(z.union([z.string(), z.object({
    label: z.string(),
    value: z.string().optional()
  })])).optional().default([]),
});
```

### 2. Улучшение логики обработки поставщиков (`server/routes.ts`)
```typescript
// Извлечение и валидация полей с поддержкой новых полей
const { 
  suppliers: supplierIds, 
  subject, 
  message, 
  requestId, 
  attachments,
  apiSuppliers = [],
  fromContactGroup = false,
  parameters = []
} = emailTemplateSchema.parse(req.body);

// Разделение ID на database и API поставщиков
const dbSupplierIds = supplierIds.filter(id => {
  if (typeof id === 'number') return true;
  if (typeof id === 'string') {
    return !id.startsWith('api-');
  }
  return false;
});

const apiSupplierIds = supplierIds.filter(id => {
  if (typeof id === 'string') {
    return id.startsWith('api-');
  }
  return false;
});

// Обработка API поставщиков
if (apiSupplierIds.length > 0 && apiSuppliers && Array.isArray(apiSuppliers)) {
  const selectedApiSuppliers = apiSuppliers.filter((supplier: any) => {
    const supplierIdNum = typeof supplier.id === 'number' ? supplier.id : parseInt(String(supplier.id));
    const apiId = `api-${Math.abs(supplierIdNum)}`;
    return apiSupplierIds.includes(apiId);
  });
  selectedSuppliers.push(...selectedApiSuppliers);
}
```

### 3. Исправление передачи данных (`client/src/components/email-form.tsx`)
```typescript
// Правильная фильтрация API поставщиков
const apiSuppliers = selectedSuppliers.filter(s => {
  if (typeof s.id === 'number' && s.id < 0) return true;
  if (typeof s.id === 'string' && s.id.startsWith('api-')) return true;
  if ((s as any).searchEngine || (s as any).allEmails || (s as any).allPhones) return true;
  return false;
});

const formData = {
  ...data,
  suppliers: currentSupplierIds,
  apiSuppliers: apiSuppliers,
  fromContactGroup: isFromContactGroup,
  parameters: getSelectedParameters()
};
```

### 4. Исправление response stream (`client/src/lib/queryClient.ts`)
```typescript
// Правильная обработка ошибок без повторного чтения response
try {
  const errorData = await res.json();
  if (errorData && errorData.error) {
    throw new Error(errorData.error);
  }
  throw new Error(`API request failed: ${res.status} ${res.statusText}`);
} catch (jsonError) {
  throw new Error(`API request failed: ${res.status} ${res.statusText}`);
}
```

### 5. Добавление детального логирования
- Логирование всех входящих данных в `/api/send-email`
- Детальная информация о обработке поставщиков
- Отслеживание API поставщиков и их ID

## Результат

✅ **Все исправления применены успешно!**

### Что исправлено:
1. ✅ Расширена схема валидации для поддержки API поставщиков
2. ✅ Исправлена логика обработки поставщиков в send-email endpoint
3. ✅ Добавлено детальное логирование для отладки
4. ✅ Исправлена ошибка с повторным чтением response stream
5. ✅ Улучшена передача apiSuppliers в клиентской части

### Следующие шаги:
1. Перезапустите сервер разработки
2. Протестируйте отправку email после поиска через Яндекс
3. Проверьте логи в консоли браузера и сервера
4. Убедитесь, что apiSuppliers передаются корректно

### Для тестирования:
1. Выполните поиск через Яндекс
2. Выберите поставщиков из результатов
3. Попробуйте отправить email
4. Проверьте логи в консоли браузера (F12)
5. Проверьте логи сервера в терминале

## Техническая информация

### Файлы изменены:
- `shared/schema.ts` - расширение схемы валидации
- `server/routes.ts` - улучшение логики обработки поставщиков
- `client/src/components/email-form.tsx` - исправление передачи данных
- `client/src/lib/queryClient.ts` - исправление response stream

### Тестирование:
- Создан тестовый скрипт `test-email-fix.cjs`
- Все проверки пройдены успешно
- Готово к тестированию в реальных условиях

---
*Отчет создан: $(date)*
*Статус: ✅ Исправления применены и протестированы*
