import fs from 'fs';

// Читаем файл routes.ts
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Добавляем регистрацию тестовых роутов после основных
const testRoutesToAdd = `
  // Register admin moderation test routes (NO AUTH - FOR TESTING ONLY)
  console.log('[Server] Registered admin moderation test routes');
  app.use('/api/admin-test', adminModerationTestRoutes);`;

// Находим место для вставки (после app.use('/api/admin', adminModerationRoutes))
const insertAfter = `  app.use('/api/admin', adminModerationRoutes);

  // User mode preference API endpoints`;

if (content.includes(insertAfter) && !content.includes('adminModerationTestRoutes')) {
    content = content.replace(insertAfter, `  app.use('/api/admin', adminModerationRoutes);${testRoutesToAdd}

  // User mode preference API endpoints`);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлена регистрация admin-moderation-test routes');
} else if (content.includes('adminModerationTestRoutes')) {
    console.log('✅ Регистрация уже существует');
} else {
    console.log('❌ Не удалось найти место для вставки');
}
