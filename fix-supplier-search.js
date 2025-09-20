// Исправление функции saveSearchResults в server/routes/supplier-search.ts
// Заменяем строки 272-280 на:

const fs = require('fs');

// Читаем текущий файл
const filePath = 'server/routes/supplier-search.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Заменяем проблемную часть
const oldCode = `            if (saved) {
                savedSuppliers.push({
                    ...saved,
                    searchEngine: result.engine,
                    allEmails: result.emails,
                    allPhones: result.phones,
                    searchDate: result.dateOfSearch,
                });
            }`;

const newCode = `            if (saved) {
                // Адаптируем данные для совместимости с фронтендом
                savedSuppliers.push({
                    // Основные поля для фронтенда
                    id: saved.id,
                    name: saved.rawTitle,
                    email: result.emails && result.emails[0] ? result.emails[0] : '',
                    website: saved.rawUrl,
                    description: saved.rawDescription,
                    categories: [result.engine],
                    // Дополнительные поля из staging_suppliers
                    sourceEngine: saved.sourceEngine,
                    searchQuery: saved.searchQuery,
                    region: saved.region,
                    rawTitle: saved.rawTitle,
                    rawDescription: saved.rawDescription,
                    rawUrl: saved.rawUrl,
                    rawEmails: saved.rawEmails,
                    rawPhones: saved.rawPhones,
                    status: saved.status,
                    createdAt: saved.createdAt,
                    // Поля для совместимости
                    searchEngine: result.engine,
                    allEmails: result.emails,
                    allPhones: result.phones,
                    searchDate: result.dateOfSearch,
                });
            }`;

content = content.replace(oldCode, newCode);

// Также исправляем обработку дубликатов
const oldDuplicateCode = `                savedSuppliers.push({
                    sourceEngine: result.engine,
                    searchQuery: result.query,
                    region: result.region || region,
                    rawTitle: supplierName,
                    rawDescription: result.description || '',
                    rawUrl: result.domain,
                    rawEmails: result.emails || [],
                    rawPhones: result.phones || [],
                    status: 'new',
                    searchEngine: result.engine,
                    allEmails: Array.isArray(result.emails) ? result.emails : [],
                    allPhones: Array.isArray(result.phones) ? result.phones : [],
                    searchDate: result.dateOfSearch,
                });`;

const newDuplicateCode = `                savedSuppliers.push({
                    // Основные поля для фронтенда
                    id: Date.now(), // Временный ID для дубликатов
                    name: supplierName,
                    email: result.emails && result.emails[0] ? result.emails[0] : '',
                    website: result.domain,
                    description: result.description || '',
                    categories: [result.engine],
                    // Дополнительные поля
                    sourceEngine: result.engine,
                    searchQuery: result.query,
                    region: result.region || region,
                    rawTitle: supplierName,
                    rawDescription: result.description || '',
                    rawUrl: result.domain,
                    rawEmails: result.emails || [],
                    rawPhones: result.phones || [],
                    status: 'new',
                    searchEngine: result.engine,
                    allEmails: Array.isArray(result.emails) ? result.emails : [],
                    allPhones: Array.isArray(result.phones) ? result.phones : [],
                    searchDate: result.dateOfSearch,
                });`;

content = content.replace(oldDuplicateCode, newDuplicateCode);

// Сохраняем исправленный файл
fs.writeFileSync(filePath, content);
console.log('Файл server/routes/supplier-search.ts исправлен!');
