-- Исправление request_id в staging_suppliers
-- Этот скрипт привязывает существующие записи к search_requests

-- 1. Обновляем записи на основе searchSessionId
UPDATE staging_suppliers 
SET request_id = sr.id
FROM search_requests sr
WHERE staging_suppliers.search_session_id = sr.search_session_id
  AND staging_suppliers.request_id IS NULL
  AND staging_suppliers.search_session_id IS NOT NULL;

-- 2. Обновляем записи на основе пользователя, запроса и времени (30 минут)
UPDATE staging_suppliers 
SET request_id = sr.id
FROM search_requests sr
WHERE staging_suppliers.user_id = sr.user_id
  AND staging_suppliers.search_query = sr.product_name
  AND staging_suppliers.request_id IS NULL
  AND ABS(EXTRACT(EPOCH FROM (staging_suppliers.created_at - sr.created_at))) < 1800;

-- 3. Обновляем записи на основе пользователя и времени (60 минут, без дублирования)
UPDATE staging_suppliers 
SET request_id = sr.id
FROM search_requests sr
WHERE staging_suppliers.user_id = sr.user_id
  AND staging_suppliers.request_id IS NULL
  AND ABS(EXTRACT(EPOCH FROM (staging_suppliers.created_at - sr.created_at))) < 3600
  AND NOT EXISTS (
    SELECT 1 FROM staging_suppliers ss2 
    WHERE ss2.request_id = sr.id 
    AND ss2.id != staging_suppliers.id
  );

-- 4. Проверяем результат
SELECT 
  COUNT(*) as total_records,
  COUNT(request_id) as records_with_request_id,
  COUNT(*) - COUNT(request_id) as records_without_request_id
FROM staging_suppliers;
