import { db } from './server/db.ts';
import { stagingSuppliers, searchRequests } from './shared/schema.ts';
import { eq, sql, and, gte, lte } from 'drizzle-orm';

console.log('=== Исправление request_id в staging_suppliers ===');

(async () => {
  try {
    // 1. Проверяем сколько записей без request_id
    const nullRequestIdCount = await db
      .select({ count: sql`COUNT(*)` })
      .from(stagingSuppliers)
      .where(sql`${stagingSuppliers.requestId} IS NULL`);
    
    console.log(`Найдено ${nullRequestIdCount[0]?.count || 0} записей без request_id`);

    // 2. Обновляем записи на основе searchSessionId
    console.log('Обновляем записи на основе searchSessionId...');
    const updateBySessionResult = await db.execute(sql`
      UPDATE staging_suppliers 
      SET request_id = sr.id
      FROM search_requests sr
      WHERE staging_suppliers.search_session_id = sr.search_session_id
        AND staging_suppliers.request_id IS NULL
        AND staging_suppliers.search_session_id IS NOT NULL
    `);
    
    console.log('Обновлено записей по searchSessionId:', updateBySessionResult.rowCount);

    // 3. Обновляем записи на основе пользователя, запроса и времени
    console.log('Обновляем записи на основе пользователя, запроса и времени...');
    const updateByUserTimeResult = await db.execute(sql`
      UPDATE staging_suppliers 
      SET request_id = sr.id
      FROM search_requests sr
      WHERE staging_suppliers.user_id = sr.user_id
        AND staging_suppliers.search_query = sr.product_name
        AND staging_suppliers.request_id IS NULL
        AND ABS(EXTRACT(EPOCH FROM (staging_suppliers.created_at - sr.created_at))) < 1800
    `);
    
    console.log('Обновлено записей по пользователю и времени:', updateByUserTimeResult.rowCount);

    // 4. Обновляем записи на основе пользователя и времени (более широкий диапазон)
    console.log('Обновляем записи на основе пользователя и времени (широкий диапазон)...');
    const updateByUserTimeWideResult = await db.execute(sql`
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
        )
    `);
    
    console.log('Обновлено записей по пользователю и времени (широкий диапазон):', updateByUserTimeWideResult.rowCount);

    // 5. Проверяем результат
    const finalNullCount = await db
      .select({ count: sql`COUNT(*)` })
      .from(stagingSuppliers)
      .where(sql`${stagingSuppliers.requestId} IS NULL`);
    
    const totalCount = await db
      .select({ count: sql`COUNT(*)` })
      .from(stagingSuppliers);
    
    console.log(`\n=== РЕЗУЛЬТАТ ===`);
    console.log(`Всего записей в staging_suppliers: ${totalCount[0]?.count || 0}`);
    console.log(`Записей без request_id: ${finalNullCount[0]?.count || 0}`);
    console.log(`Записей с request_id: ${(totalCount[0]?.count || 0) - (finalNullCount[0]?.count || 0)}`);

    // 6. Показываем примеры обновленных записей
    const sampleUpdated = await db
      .select({
        id: stagingSuppliers.id,
        searchQuery: stagingSuppliers.searchQuery,
        requestId: stagingSuppliers.requestId,
        createdAt: stagingSuppliers.createdAt
      })
      .from(stagingSuppliers)
      .where(sql`${stagingSuppliers.requestId} IS NOT NULL`)
      .limit(5);
    
    console.log('\nПримеры обновленных записей:');
    sampleUpdated.forEach(record => {
      console.log(`ID: ${record.id}, Query: "${record.searchQuery}", RequestID: ${record.requestId}, Created: ${record.createdAt}`);
    });

  } catch (error) {
    console.error('❌ Ошибка при исправлении request_id:', error);
  } finally {
    process.exit(0);
  }
})();
