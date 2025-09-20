import fs from 'fs';

// Читаем файл admin-moderation.ts
const filePath = 'server/routes/admin-moderation.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Добавляем импорт для аутентификации
const authImport = `import { requireAuth } from '../middleware/requireAuth';`;

// Находим место для вставки (после импорта drizzle-orm)
const insertAfter = `import { eq, and } from 'drizzle-orm';`;

if (content.includes(insertAfter) && !content.includes('requireAuth')) {
    content = content.replace(insertAfter, insertAfter + '\n' + authImport);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлен импорт requireAuth');
} else if (content.includes('requireAuth')) {
    console.log('✅ Импорт requireAuth уже существует');
} else {
    console.log('❌ Не удалось найти место для вставки импорта');
}

// Теперь добавим middleware к роутам
content = fs.readFileSync(filePath, 'utf8');

// Добавляем middleware ко всем роутам
const routes = [
    'router.get(\'/staging-suppliers\'',
    'router.post(\'/approve-supplier\'',
    'router.post(\'/merge-supplier\'',
    'router.post(\'/reject-supplier\''
];

routes.forEach(route => {
    if (content.includes(route) && !content.includes(`${route}, requireAuth`)) {
        content = content.replace(route, `${route}, requireAuth`);
    }
});

fs.writeFileSync(filePath, content);
console.log('✅ Добавлен middleware requireAuth ко всем роутам');
