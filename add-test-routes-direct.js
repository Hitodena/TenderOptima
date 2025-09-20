import fs from 'fs';

// Читаем файл routes.ts
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Добавляем регистрацию тестовых роутов
const testRoutesToAdd = `
  // Register admin moderation test routes (NO AUTH - FOR TESTING ONLY)
  console.log('[Server] Registered admin moderation test routes');
  app.use('/api/admin-test', adminModerationTestRoutes);`;

// Находим точное место для вставки
const insertAfter = `  app.use('/api/admin', adminModerationRoutes);`;

if (content.includes(insertAfter)) {
    content = content.replace(insertAfter, insertAfter + testRoutesToAdd);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлена регистрация admin-moderation-test routes');
} else {
    console.log('❌ Не удалось найти место для вставки');
}
