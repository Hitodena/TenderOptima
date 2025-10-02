#!/usr/bin/env node

/**
 * Скрипт для проверки роли пользователя request@tenderoptima.by
 */

const { db } = require('./server/db');
const { users } = require('./shared/schema');
const { eq } = require('drizzle-orm');

async function checkUserRole() {
  try {
    console.log('🔍 Проверка роли пользователя request@tenderoptima.by...\n');
    
    // Находим пользователя по email
    const [user] = await db.select().from(users).where(eq(users.username, 'request@tenderoptima.by'));
    
    if (user) {
      console.log('✅ Пользователь найден:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Last Login: ${user.lastLogin}`);
      
      // Проверяем, почему он может считаться админом
      console.log('\n🔍 Анализ причин отображения админ панели:');
      
      if (user.role === 'admin') {
        console.log('❌ ПРОБЛЕМА: Пользователь имеет роль "admin" в базе данных!');
        console.log('   Это объясняет, почему показывается админ панель.');
      } else if (user.id === 1) {
        console.log('❌ ПРОБЛЕМА: Пользователь имеет ID=1, который считается админом в коде!');
        console.log('   В server/routes/admin.ts строка 14: (req.user as any)?.id === 1');
      } else {
        console.log('✅ Пользователь НЕ должен видеть админ панель');
        console.log('   Проблема может быть в кэше или localStorage');
      }
      
    } else {
      console.log('❌ Пользователь request@tenderoptima.by не найден в базе данных');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке пользователя:', error);
  }
}

if (require.main === module) {
  checkUserRole().catch(console.error);
}

module.exports = { checkUserRole };


