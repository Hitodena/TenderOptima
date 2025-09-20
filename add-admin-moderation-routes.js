import fs from 'fs';

// Читаем файл routes.ts
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Добавляем регистрацию роутов после adminEmailRoutes
const routesToAdd = `
  // Register admin moderation routes
  console.log('[Server] Registered admin moderation routes');
  app.use('/api/admin', adminModerationRoutes);`;

// Находим место для вставки (после app.use(adminEmailRoutes))
const insertAfter = `  app.use(adminEmailRoutes);`;

if (content.includes(insertAfter) && !content.includes('adminModerationRoutes')) {
    content = content.replace(insertAfter, insertAfter + routesToAdd);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлена регистрация admin-moderation routes');
} else if (content.includes('adminModerationRoutes')) {
    console.log('✅ Регистрация уже существует');
} else {
    console.log('❌ Не удалось найти место для вставки регистрации');
}
