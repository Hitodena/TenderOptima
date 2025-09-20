import fs from 'fs';

// Читаем файл routes.ts
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Добавляем импорт после adminEmailRoutes
const importToAdd = `import adminModerationRoutes from "./routes/admin-moderation";`;

// Находим место для вставки (после adminEmailRoutes)
const insertAfter = `import adminEmailRoutes from "./routes/admin-email";`;

if (content.includes(insertAfter) && !content.includes(importToAdd)) {
    content = content.replace(insertAfter, insertAfter + '\n' + importToAdd);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлен импорт admin-moderation routes');
} else if (content.includes(importToAdd)) {
    console.log('✅ Импорт уже существует');
} else {
    console.log('❌ Не удалось найти место для вставки импорта');
}
