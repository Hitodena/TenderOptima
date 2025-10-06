const { db } = require('./server/db');
const { users } = require('./shared/schema');
const { eq } = require('drizzle-orm');

async function checkUsers() {
  try {
    console.log('Проверяем пользователей в БД...');
    
    // Получаем всех пользователей
    const allUsers = await db.select().from(users);
    
    console.log(`Найдено пользователей: ${allUsers.length}`);
    
    allUsers.forEach((user, index) => {
      console.log(`\nПользователь ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Username (email): ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Language: ${user.language}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log(`  Last Login: ${user.lastLogin || 'Никогда'}`);
      console.log(`  Email Account: ${user.emailAccount || 'Не настроен'}`);
      console.log(`  Email Configured: ${user.emailConfigured}`);
    });
    
    // Проверяем последнего пользователя
    if (allUsers.length > 0) {
      const lastUser = allUsers[allUsers.length - 1];
      console.log(`\nПоследний зарегистрированный пользователь:`);
      console.log(`  Username: ${lastUser.username}`);
      console.log(`  Created: ${lastUser.createdAt}`);
      console.log(`  Has password: ${!!lastUser.password}`);
    }
    
  } catch (error) {
    console.error('Ошибка при проверке пользователей:', error);
  }
}

checkUsers();
