const { db } = require('./server/db');
const { users } = require('./shared/schema');
const { eq } = require('drizzle-orm');
const bcrypt = require('bcrypt');

async function checkAndCreateAdmin() {
  try {
    console.log('🔍 Проверяем наличие админ пользователя...');
    
    // Проверяем, есть ли пользователь с ролью admin
    const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
    
    if (adminUsers.length > 0) {
      console.log('✅ Найдены админ пользователи:');
      adminUsers.forEach(user => {
        console.log(`  - ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
      });
    } else {
      console.log('❌ Админ пользователи не найдены');
      
      // Проверяем, есть ли пользователь с ID 1
      const user1 = await db.select().from(users).where(eq(users.id, 1));
      
      if (user1.length > 0) {
        console.log('👤 Найден пользователь с ID 1:', user1[0].username, 'Role:', user1[0].role);
        
        // Обновляем роль на admin
        await db.update(users)
          .set({ role: 'admin' })
          .where(eq(users.id, 1));
        
        console.log('✅ Роль пользователя с ID 1 обновлена на admin');
      } else {
        console.log('❌ Пользователь с ID 1 не найден');
        
        // Создаем админ пользователя
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const newAdmin = await db.insert(users).values({
          username: 'admin@example.com',
          password: hashedPassword,
          role: 'admin',
          language: 'ru',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        
        console.log('✅ Создан новый админ пользователь:', newAdmin[0]);
      }
    }
    
    // Показываем всех пользователей
    console.log('\n📋 Все пользователи в системе:');
    const allUsers = await db.select().from(users);
    allUsers.forEach(user => {
      console.log(`  - ID: ${user.id}, Username: ${user.username}, Role: ${user.role || 'user'}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    process.exit(0);
  }
}

checkAndCreateAdmin();
