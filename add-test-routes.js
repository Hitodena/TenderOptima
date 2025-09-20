import fs from 'fs';

// Читаем файл routes.ts
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Добавляем импорт для тестовых роутов
const testImport = `import adminModerationTestRoutes from "./routes/admin-moderation-test";`;

// Находим место для вставки (после adminModerationRoutes)
const insertAfter = `import adminModerationRoutes from "./routes/admin-moderation";`;

if (content.includes(insertAfter) && !content.includes('adminModerationTestRoutes')) {
    content = content.replace(insertAfter, insertAfter + '\n' + testImport);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлен импорт admin-moderation-test routes');
} else if (content.includes('adminModerationTestRoutes')) {
    console.log('✅ Импорт уже существует');
} else {
    console.log('❌ Не удалось найти место для вставки импорта');
}

// Теперь добавим регистрацию тестовых роутов
content = fs.readFileSync(filePath, 'utf8');

// Добавляем регистрацию тестовых роутов после основных
const testRoutesToAdd = `
  // Register admin moderation test routes (NO AUTH - FOR TESTING ONLY)
  console.log('[Server] Registered admin moderation test routes');
  app.use('/api/admin-test', adminModerationTestRoutes);`;

// Находим место для вставки (после app.use('/api/admin', adminModerationRoutes))
const insertAfterRoutes = `  app.use('/api/admin', adminModerationRoutes);`;

if (content.includes(insertAfterRoutes) && !content.includes('adminModerationTestRoutes')) {
    content = content.replace(insertAfterRoutes, insertAfterRoutes + testRoutesToAdd);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлена регистрация admin-moderation-test routes');
} else if (content.includes('adminModerationTestRoutes')) {
    console.log('✅ Регистрация уже существует');
} else {
    console.log('❌ Не удалось найти место для вставки регистрации');
}
