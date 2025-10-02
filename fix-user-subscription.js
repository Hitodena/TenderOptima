#!/usr/bin/env node

/**
 * Скрипт для исправления подписки пользователя
 */

const { db } = require('./server/db');
const { subscriptions, users } = require('./shared/schema');
const { eq } = require('drizzle-orm');

async function fixUserSubscription() {
  try {
    console.log('🔧 Исправление подписки пользователя...\n');
    
    // 1. Находим пользователя request@tenderoptima.by
    const [user] = await db.select().from(users).where(eq(users.username, 'request@tenderoptima.by'));
    
    if (!user) {
      console.log('❌ Пользователь request@tenderoptima.by не найден');
      return;
    }
    
    console.log(`✅ Пользователь найден: ID ${user.id}, Username: ${user.username}`);
    
    // 2. Проверяем текущую подписку
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
    
    if (subscription) {
      console.log(`📋 Текущая подписка:`, {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        requestsLimit: subscription.requestsLimit,
        requestsUsed: subscription.requestsUsed,
        requestsRest: subscription.requestsRest,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      });
      
      // 3. Исправляем подписку
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 30); // 30 дней
      
      await db.update(subscriptions)
        .set({
          status: 'active',
          plan: 'premium',
          requestsLimit: 100,
          requestsUsed: 0,
          requestsRest: 100,
          endDate: newEndDate,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, subscription.id));
      
      console.log('✅ Подписка исправлена:');
      console.log('   - Статус: active');
      console.log('   - План: premium');
      console.log('   - Лимит запросов: 100');
      console.log('   - Использовано: 0');
      console.log('   - Осталось: 100');
      console.log(`   - Действует до: ${newEndDate.toLocaleDateString()}`);
      
    } else {
      console.log('❌ Подписка не найдена, создаем новую...');
      
      // Создаем новую подписку
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 30);
      
      await db.insert(subscriptions).values({
        userId: user.id,
        plan: 'premium',
        status: 'active',
        requestsLimit: 100,
        requestsUsed: 0,
        requestsRest: 100,
        startDate: new Date(),
        endDate: newEndDate,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✅ Новая подписка создана');
    }
    
    console.log('\n✅ Подписка пользователя исправлена!');
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении подписки:', error);
  } finally {
    process.exit(0);
  }
}

fixUserSubscription();
