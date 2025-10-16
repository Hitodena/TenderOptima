import { db } from './server/db.ts';
import { stagingSuppliers, searchRequests } from './shared/schema.ts';
import { eq, sql } from 'drizzle-orm';

async function checkData() {
  try {
    console.log('=== Проверка данных для запроса 905 ===');
    
    // Проверим запрос с ID 905
    const request = await db.select().from(searchRequests).where(eq(searchRequests.id, 905)).limit(1);
    console.log('Request 905:', request[0]);
    
    if (!request[0]) {
      console.log('Запрос 905 не найден');
      return;
    }
    
    // Проверим записи в staging_suppliers для этого запроса по requestId
    const byRequestId = await db.select({ count: sql`COUNT(*)` }).from(stagingSuppliers).where(eq(stagingSuppliers.requestId, 905));
    console.log('Records by requestId=905:', byRequestId[0]?.count || 0);
    
    // Проверим записи по searchQuery
    const bySearchQuery = await db.select({ count: sql`COUNT(*)` }).from(stagingSuppliers).where(eq(stagingSuppliers.searchQuery, 'купить бумажную посуду от производителя'));
    console.log('Records by searchQuery:', bySearchQuery[0]?.count || 0);
    
    // Проверим все записи для этого пользователя
    const byUserId = await db.select({ count: sql`COUNT(*)` }).from(stagingSuppliers).where(eq(stagingSuppliers.userId, request[0].userId));
    console.log('Records by userId:', byUserId[0]?.count || 0);
    
    // Проверим записи без requestId для этого пользователя
    const withoutRequestId = await db.select({ count: sql`COUNT(*)` }).from(stagingSuppliers).where(
      sql`${stagingSuppliers.userId} = ${request[0].userId} AND ${stagingSuppliers.requestId} IS NULL`
    );
    console.log('Records without requestId for this user:', withoutRequestId[0]?.count || 0);
    
    // Проверим несколько примеров записей
    const sampleRecords = await db.select({
      id: stagingSuppliers.id,
      requestId: stagingSuppliers.requestId,
      searchQuery: stagingSuppliers.searchQuery,
      rawTitle: stagingSuppliers.rawTitle,
      createdAt: stagingSuppliers.createdAt
    }).from(stagingSuppliers).where(eq(stagingSuppliers.userId, request[0].userId)).limit(5);
    
    console.log('\nПримеры записей:');
    sampleRecords.forEach(record => {
      console.log(`ID: ${record.id}, requestId: ${record.requestId}, searchQuery: "${record.searchQuery}", title: "${record.rawTitle}"`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();
