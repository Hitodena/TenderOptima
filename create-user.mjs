import { db } from './server/db.js';
import { users, subscriptions } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env' });

async function createUser() {
  try {
    console.log('Создание пользователя request@tenderoptima.by...');
    
    // Проверяем, существует ли пользователь
    const existingUser = await db.select().from(users).where(eq(users.username, 'request@tenderoptima.by'));
    
    if (existingUser.length > 0) {
      console.log('Пользователь request@tenderoptima.by уже существует');
      console.log('ID:', existingUser[0].id);
      console.log('Email:', existingUser[0].username);
      console.log('Role:', existingUser[0].role);
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
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 365); // 1 год
    
    const [subscription] = await db.insert(subscriptions)
      .values({
        userId: newUser.id,
        plan: 'premium',
        status: 'active',
        endDate: endDate,
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
