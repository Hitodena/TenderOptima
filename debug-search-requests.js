#!/usr/bin/env node

/**
 * Скрипт для отладки проблем с search-requests
 */

const { db } = require('./server/db');
const { searchRequests } = require('./shared/schema');
const { eq, desc } = require('drizzle-orm');

async function debugSearchRequests() {
  try {
    console.log('🔍 Отладка проблем с search-requests...\n');
    
    // 1. Проверяем все запросы в базе данных
    console.log('1. Проверка всех запросов в базе данных:');
    const allRequests = await db
      .select({
        id: searchRequests.id,
        userId: searchRequests.userId,
        productName: searchRequests.productName,
        orderNumber: searchRequests.orderNumber,
        createdAt: searchRequests.createdAt
      })
      .from(searchRequests)
      .orderBy(desc(searchRequests.createdAt))
      .limit(10);
    
    console.log(`   Найдено запросов: ${allRequests.length}`);
    allRequests.forEach(req => {
      console.log(`   ID: ${req.id}, User: ${req.userId}, Product: ${req.productName}, Order: ${req.orderNumber}`);
    });
    
    // 2. Проверяем конкретные проблемные ID
    console.log('\n2. Проверка проблемных ID (567, 649):');
    const problemIds = [567, 649];
    
    for (const id of problemIds) {
      const request = await db
        .select()
        .from(searchRequests)
        .where(eq(searchRequests.id, id))
        .limit(1);
      
      if (request.length > 0) {
        console.log(`   ✅ ID ${id} найден: User ${request[0].userId}, Product: ${request[0].productName}`);
      } else {
        console.log(`   ❌ ID ${id} НЕ найден в базе данных`);
      }
    }
    
    // 3. Проверяем последние запросы пользователя
    console.log('\n3. Проверка последних запросов пользователя:');
    const userRequests = await db
      .select()
      .from(searchRequests)
      .where(eq(searchRequests.userId, 1)) // Проверяем для пользователя ID=1
      .orderBy(desc(searchRequests.createdAt))
      .limit(5);
    
    console.log(`   Запросы пользователя ID=1: ${userRequests.length}`);
    userRequests.forEach(req => {
      console.log(`   ID: ${req.id}, Product: ${req.productName}, Order: ${req.orderNumber}`);
    });
    
    // 4. Проверяем запросы пользователя ID=3 (request@tenderoptima.by)
    console.log('\n4. Проверка запросов пользователя request@tenderoptima.by (ID=3):');
    const user3Requests = await db
      .select()
      .from(searchRequests)
      .where(eq(searchRequests.userId, 3))
      .orderBy(desc(searchRequests.createdAt))
      .limit(5);
    
    console.log(`   Запросы пользователя ID=3: ${user3Requests.length}`);
    user3Requests.forEach(req => {
      console.log(`   ID: ${req.id}, Product: ${req.productName}, Order: ${req.orderNumber}`);
    });
    
    console.log('\n✅ Отладка завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при отладке:', error);
  } finally {
    process.exit(0);
  }
}

debugSearchRequests();
