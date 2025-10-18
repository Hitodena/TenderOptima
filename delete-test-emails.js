import { db } from './server/db.ts';
import { supplierResponses, requestSuppliers, extractedParameters, requestSupplierMessages } from './shared/schema.ts';
import { eq, and } from 'drizzle-orm';

async function deleteTestEmails() {
  const testEmail = 'compncc1@gmail.com';
  
  console.log(`🗑️  Начинаем удаление тестовых email'ов от ${testEmail}...`);
  
  try {
    // 1. Найти все ответы от тестового email'а
    console.log('📧 Ищем все ответы от тестового email...');
    const testResponses = await db
      .select()
      .from(supplierResponses)
      .where(eq(supplierResponses.supplierEmail, testEmail));
    
    console.log(`Найдено ${testResponses.length} ответов от ${testEmail}`);
    
    if (testResponses.length === 0) {
      console.log('✅ Тестовых email\'ов не найдено');
      return;
    }
    
    // Показать информацию о найденных ответах
    testResponses.forEach((response, index) => {
      console.log(`${index + 1}. ID: ${response.id}, Request: ${response.requestId}, Subject: ${response.subject}, Date: ${response.responseDate}`);
    });
    
    // 2. Удалить связанные извлеченные параметры
    console.log('🔍 Удаляем связанные извлеченные параметры...');
    const responseIds = testResponses.map(r => r.id);
    
    for (const responseId of responseIds) {
      const deletedParams = await db
        .delete(extractedParameters)
        .where(eq(extractedParameters.responseId, responseId));
      console.log(`Удалены параметры для ответа ${responseId}`);
    }
    
    // 3. Удалить связанные сообщения в переписке
    console.log('💬 Удаляем связанные сообщения в переписке...');
    for (const response of testResponses) {
      // Найти requestSupplierId для этого ответа
      const requestSupplier = await db
        .select()
        .from(requestSuppliers)
        .where(
          and(
            eq(requestSuppliers.requestId, response.requestId),
            eq(requestSuppliers.supplierEmail, testEmail)
          )
        )
        .limit(1);
      
      if (requestSupplier.length > 0) {
        const deletedMessages = await db
          .delete(requestSupplierMessages)
          .where(eq(requestSupplierMessages.requestSupplierId, requestSupplier[0].id));
        console.log(`Удалены сообщения для requestSupplier ${requestSupplier[0].id}`);
      }
    }
    
    // 4. Удалить сами ответы поставщиков
    console.log('📧 Удаляем ответы поставщиков...');
    const deletedResponses = await db
      .delete(supplierResponses)
      .where(eq(supplierResponses.supplierEmail, testEmail));
    
    console.log(`✅ Успешно удалено ${testResponses.length} тестовых ответов от ${testEmail}`);
    
    // 5. Опционально: удалить связанные requestSuppliers записи
    console.log('🔗 Проверяем связанные записи requestSuppliers...');
    const testRequestSuppliers = await db
      .select()
      .from(requestSuppliers)
      .where(eq(requestSuppliers.supplierEmail, testEmail));
    
    if (testRequestSuppliers.length > 0) {
      console.log(`Найдено ${testRequestSuppliers.length} записей requestSuppliers для ${testEmail}`);
      
      // Спросить пользователя, хочет ли он удалить и эти записи
      console.log('⚠️  ВНИМАНИЕ: Это также удалит записи о том, что запросы были отправлены этому поставщику');
      console.log('Если вы хотите удалить и эти записи, раскомментируйте следующий блок кода:');
      console.log(`
      const deletedRequestSuppliers = await db
        .delete(requestSuppliers)
        .where(eq(requestSuppliers.supplierEmail, testEmail));
      console.log(\`Удалено \${testRequestSuppliers.length} записей requestSuppliers\`);
      `);
    }
    
    console.log('🎉 Очистка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка при удалении тестовых email\'ов:', error);
  } finally {
    // Закрываем соединение с базой данных
    await db.$disconnect();
  }
}

// Запускаем скрипт
deleteTestEmails().catch(console.error);
