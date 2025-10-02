#!/usr/bin/env node

/**
 * Скрипт для исправления роли пользователя request@tenderoptima.by
 */

const { db } = require('./server/db');
const { users } = require('./shared/schema');
const { eq } = require('drizzle-orm');

async function fixUserRole() {
  try {
    console.log('🔧 Исправление роли пользователя request@tenderoptima.by...\n');
    
    // Находим пользователя
    const [user] = await db.select().from(users).where(eq(users.username, 'request@tenderoptima.by'));
    
    if (user) {
      console.log('✅ Пользователь найден:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Текущая роль: ${user.role}`);
      
      // Если роль admin, исправляем на user
      if (user.role === 'admin') {
        console.log('\n🔧 Исправление роли с "admin" на "user"...');
        
        await db.update(users)
          .set({ role: 'user' })
          .where(eq(users.id, user.id));
        
        console.log('✅ Роль успешно изменена на "user"');
      } else {
        console.log('✅ Роль уже корректная:', user.role);
      }
      
      // Проверяем результат
      const [updatedUser] = await db.select().from(users).where(eq(users.username, 'request@tenderoptima.by'));
      console.log(`\n📋 Обновленная роль: ${updatedUser.role}`);
      
    } else {
      console.log('❌ Пользователь request@tenderoptima.by не найден в базе данных');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении роли пользователя:', error);
  }
}

async function checkAllUsers() {
  try {
    console.log('\n👥 Проверка всех пользователей в системе...\n');
    
    const allUsers = await db.select().from(users);
    
    console.log('📋 Список всех пользователей:');
    allUsers.forEach(user => {
      console.log(`   ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
    });
    
    const adminUsers = allUsers.filter(user => user.role === 'admin');
    console.log(`\n🔐 Пользователи с ролью "admin": ${adminUsers.length}`);
    adminUsers.forEach(user => {
      console.log(`   - ${user.username} (ID: ${user.id})`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при проверке пользователей:', error);
  }
}

async function main() {
  console.log('🚀 Запуск исправления ролей пользователей...\n');
  
  await fixUserRole();
  await checkAllUsers();
  
  console.log('\n✅ Исправление завершено!');
  console.log('\n📋 Резюме изменений:');
  console.log('1. ✅ Убрана проверка ID=1 как админа в server/routes/admin.ts');
  console.log('2. ✅ Убраны жестко заданные проверки админа в auth-provider.tsx');
  console.log('3. ✅ Убраны жестко заданные проверки админа в use-auth.ts');
  console.log('4. ✅ Исправлена роль пользователя request@tenderoptima.by');
  console.log('\n🎯 Теперь админ панель будет показываться ТОЛЬКО пользователям с ролью "admin"!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixUserRole, checkAllUsers };


