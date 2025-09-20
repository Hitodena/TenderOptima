// Проверка данных в staging_suppliers
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { stagingSuppliers } from './shared/schema.js';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql, { schema: { stagingSuppliers } });

async function checkStagingData() {
  try {
    console.log('🔍 Проверяем данные в staging_suppliers...');
    
    // Получаем все записи
    const allRecords = await db.select().from(stagingSuppliers);
    console.log(`📊 Всего записей в staging_suppliers: ${allRecords.length}`);
    
    if (allRecords.length > 0) {
      console.log('\n📋 Первые 5 записей:');
      allRecords.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}, Название: ${record.rawTitle}, Статус: ${record.status}`);
        console.log(`   URL: ${record.rawUrl}`);
        console.log(`   Поиск: ${record.searchQuery}`);
        console.log(`   Движок: ${record.sourceEngine}`);
        console.log('');
      });
      
      // Статистика по статусам
      const statusStats = {};
      allRecords.forEach(record => {
        statusStats[record.status] = (statusStats[record.status] || 0) + 1;
      });
      
      console.log('📊 Статистика по статусам:');
      Object.entries(statusStats).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      
      // Статистика по движкам
      const engineStats = {};
      allRecords.forEach(record => {
        engineStats[record.sourceEngine] = (engineStats[record.sourceEngine] || 0) + 1;
      });
      
      console.log('\n📊 Статистика по движкам:');
      Object.entries(engineStats).forEach(([engine, count]) => {
        console.log(`   ${engine}: ${count}`);
      });
      
    } else {
      console.log('📭 Нет данных в staging_suppliers');
      console.log('💡 Выполните поиск поставщиков, чтобы создать записи');
    }
    
  } catch (error) {
    console.error('❌ Ошибка проверки данных:', error);
  } finally {
    await sql.end();
  }
}

checkStagingData();
