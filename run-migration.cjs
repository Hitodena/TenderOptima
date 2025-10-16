import { db } from './server/db.ts';
import fs from 'fs';

console.log('=== Выполнение миграции: добавление requestId в staging_suppliers ===');

(async () => {
  try {
    // Читаем SQL файл
    const sqlContent = fs.readFileSync('migration_add_request_id_to_staging_suppliers.sql', 'utf8');
    
    // Разбиваем на отдельные запросы
    const queries = sqlContent
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));
    
    console.log(`Найдено ${queries.length} SQL запросов для выполнения`);
    
    // Выполняем каждый запрос
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`\n${i + 1}. Выполняем запрос:`);
      console.log(query);
      
      try {
        await db.execute(query);
        console.log('✅ Запрос выполнен успешно');
      } catch (error) {
        console.log('⚠️ Ошибка при выполнении запроса:', error.message);
        // Продолжаем выполнение других запросов
      }
    }
    
    console.log('\n=== Миграция завершена ===');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
  } finally {
    process.exit(0);
  }
})();
