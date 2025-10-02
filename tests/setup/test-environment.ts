import { config } from 'dotenv';
import path from 'path';

// Загружаем тестовые переменные окружения
config({ path: path.resolve(process.cwd(), '.env.test') });

export const TEST_CONFIG = {
  // Тестовая база данных
  DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/supplierfinder_test',
  
  // Тестовый порт
  PORT: process.env.TEST_PORT || '5001',
  
  // Тестовые API ключи
  OPENAI_API_KEY: process.env.TEST_OPENAI_API_KEY || 'test-key',
  SENDGRID_API_KEY: process.env.TEST_SENDGRID_API_KEY || 'test-sendgrid-key',
  
  // Настройки тестирования
  TEST_TIMEOUT: 30000,
  API_BASE_URL: `http://localhost:${process.env.TEST_PORT || '5001'}`,
  
  // Тестовые пользователи
  TEST_USERS: {
    admin: { 
      email: 'admin@test.com', 
      password: 'admin123',
      name: 'Test Admin',
      role: 'admin'
    },
    user: { 
      email: 'user@test.com', 
      password: 'user123',
      name: 'Test User',
      role: 'user'
    }
  },
  
  // Тестовые данные
  TEST_DATA: {
    searchRequest: {
      title: 'Test Search Request',
      description: 'Test description for search request',
      requirements: ['quality', 'delivery', 'price'],
      budget: 10000,
      deadline: '2024-12-31'
    },
    supplier: {
      name: 'Test Supplier',
      email: 'supplier@test.com',
      phone: '+1234567890',
      website: 'https://test-supplier.com',
      description: 'Test supplier description',
      categories: ['manufacturing', 'electronics']
    }
  }
};

export const setupTestEnvironment = async () => {
  console.log('🧪 Настройка тестового окружения...');
  
  try {
    // Проверяем доступность тестовой БД
    // await checkDatabaseConnection();
    
    // Инициализируем тестовые данные
    // await initializeTestData();
    
    // Настраиваем моки для внешних сервисов
    // await setupMocks();
    
    console.log('✅ Тестовое окружение готово');
    return true;
  } catch (error) {
    console.error('❌ Ошибка настройки тестового окружения:', error);
    throw error;
  }
};

export const cleanupTestEnvironment = async () => {
  console.log('🧹 Очистка тестового окружения...');
  
  try {
    // Очищаем тестовые данные
    // await cleanupTestData();
    
    // Закрываем соединения
    // await closeConnections();
    
    console.log('✅ Тестовое окружение очищено');
  } catch (error) {
    console.error('❌ Ошибка очистки тестового окружения:', error);
  }
};

// Утилиты для тестирования
export const testHelpers = {
  // Создание тестового пользователя
  createTestUser: async (userData: any) => {
    // Реализация создания тестового пользователя
  },
  
  // Очистка тестовых данных
  cleanupTestData: async () => {
    // Реализация очистки тестовых данных
  },
  
  // Получение авторизационного токена
  getAuthToken: async (user: any) => {
    // Реализация получения токена
  },
  
  // Мокирование внешних сервисов
  mockExternalServices: () => {
    // Реализация мокирования
  }
};


