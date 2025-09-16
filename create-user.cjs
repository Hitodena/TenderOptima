const { db } = require('./server/db');
const { users, subscriptions } = require('./shared/schema');
const { eq } = require('drizzle-orm');
const bcrypt = require('bcryptjs');

async function createUser() {
  try {
    console.log('Создание пользователя request@tenderoptima.by...');
    
    // Проверяем, существует ли пользователь
    const existingUser = await db.select().from(users).where(eq(users.username, 'request@tenderoptima.by'));
    
    if (existingUser.length > 0) {
      console.log('Пользователь request@tenderoptima.by уже существует');
      return;
    }
    
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Создаем пользователя
    const [newUser] = await db.insert(users)
      .values({
        username: 'request@tenderoptima.by',
        password: hashedPassword,
        role: 'user',
        language: 'ru',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log('Пользователь создан:', newUser);
    
    // Создаем подписку
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 365); // 1 год
    
    const [subscription] = await db.insert(subscriptions)
      .values({
        userId: newUser.id,
        plan: 'premium',
        status: 'active',
        expiryDate: expiryDate,
        requestsLimit: 1000,
        requestsUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log('Подписка создана:', subscription);
    console.log('✅ Пользователь request@tenderoptima.by успешно создан!');
    console.log('Email: request@tenderoptima.by');
    console.log('Пароль: password123');
    
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
  } finally {
    process.exit(0);
  }
}

createUser();
