#!/usr/bin/env node

/**
 * Скрипт для настройки тестовой базы данных
 * Создает тестовую БД и применяет миграции
 */

import { config } from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env.test') });

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/supplierfinder_test';

console.log('🧪 Настройка тестовой базы данных...');

try {
  // 1. Создаем тестовую базу данных (если не существует)
  console.log('📊 Создание тестовой базы данных...');
  
  // Извлекаем параметры подключения из URL
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const dbHost = url.hostname;
  const dbPort = url.port || '5432';
  const dbUser = url.username;
  const dbPassword = url.password;
  
  // Создаем БД через psql
  const createDbCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -c "CREATE DATABASE ${dbName};" || echo "Database may already exist"`;
  
  try {
    execSync(createDbCommand, { stdio: 'inherit' });
  } catch (error) {
    console.log('ℹ️  База данных может уже существовать');
  }
  
  // 2. Применяем миграции к тестовой БД
  console.log('🔄 Применение миграций к тестовой БД...');
  
  // Устанавливаем переменную окружения для тестовой БД
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  
  // Генерируем миграции
  console.log('📝 Генерация миграций...');
  execSync('npm run db:generate', { stdio: 'inherit' });
  
  // Применяем миграции
  console.log('🚀 Применение миграций...');
  execSync('npm run db:push', { stdio: 'inherit' });
  
  // 3. Создаем тестовые данные
  console.log('📋 Создание тестовых данных...');
  
  // Здесь можно добавить создание базовых тестовых данных
  // Например, тестовых пользователей, категорий и т.д.
  
  console.log('✅ Тестовая база данных настроена успешно!');
  console.log(`📊 URL: ${TEST_DATABASE_URL}`);
  
} catch (error) {
  console.error('❌ Ошибка настройки тестовой БД:', error.message);
  process.exit(1);
}


