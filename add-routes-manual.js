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
const insertAfter = `  app.use(adminEmailRoutes);

  // User mode preference API endpoints`;

if (content.includes(insertAfter)) {
    content = content.replace(insertAfter, `  app.use(adminEmailRoutes);${routesToAdd}

  // User mode preference API endpoints`);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлена регистрация admin-moderation routes');
} else {
    console.log('❌ Не удалось найти место для вставки');
    console.log('Ищем альтернативное место...');
    
    // Альтернативный поиск
    const altInsertAfter = `  app.use(adminEmailRoutes);`;
    if (content.includes(altInsertAfter)) {
        content = content.replace(altInsertAfter, altInsertAfter + routesToAdd);
        fs.writeFileSync(filePath, content);
        console.log('✅ Добавлена регистрация admin-moderation routes (альтернативный способ)');
    } else {
        console.log('❌ Не удалось найти место для вставки');
    }
}
