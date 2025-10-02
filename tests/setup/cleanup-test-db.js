#!/usr/bin/env node

/**
 * Скрипт для очистки тестовой базы данных
 * Удаляет все тестовые данные и сбрасывает БД
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

console.log('🧹 Очистка тестовой базы данных...');

try {
  // Извлекаем параметры подключения из URL
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const dbHost = url.hostname;
  const dbPort = url.port || '5432';
  const dbUser = url.username;
  
  // 1. Подключаемся к БД и очищаем все таблицы
  console.log('🗑️  Очистка всех таблиц...');
  
  const cleanupCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "
    DO \$\$ 
    DECLARE 
        r RECORD;
    BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
    END \$\$;
  "`;
  
  try {
    execSync(cleanupCommand, { stdio: 'inherit' });
  } catch (error) {
    console.log('ℹ️  Некоторые таблицы могут быть уже пустыми');
  }
  
  // 2. Сбрасываем последовательности (auto-increment)
  console.log('🔄 Сброс последовательностей...');
  
  const resetSequencesCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "
    DO \$\$ 
    DECLARE 
        r RECORD;
    BEGIN
        FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
            EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.sequence_name) || ' RESTART WITH 1';
        END LOOP;
    END \$\$;
  "`;
  
  try {
    execSync(resetSequencesCommand, { stdio: 'inherit' });
  } catch (error) {
    console.log('ℹ️  Последовательности могут быть уже сброшены');
  }
  
  console.log('✅ Тестовая база данных очищена успешно!');
  
} catch (error) {
  console.error('❌ Ошибка очистки тестовой БД:', error.message);
  process.exit(1);
}


