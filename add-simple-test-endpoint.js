import fs from 'fs';

// Читаем файл routes.ts
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Добавляем простой тестовый эндпоинт
const testEndpoint = `
  // Simple test endpoint for staging suppliers (NO AUTH)
  app.get("/api/test/staging-suppliers", async (req, res) => {
    try {
      console.log('[Test] Fetching staging suppliers...');
      
      const stagingRecords = await db
        .select()
        .from(stagingSuppliers)
        .where(eq(stagingSuppliers.status, 'new'))
        .orderBy(stagingSuppliers.createdAt);

      console.log(\`[Test] Found \${stagingRecords.length} records\`);

      res.json({
        success: true,
        data: stagingRecords,
        total: stagingRecords.length
      });

    } catch (error) {
      console.error('[Test] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });`;

// Находим место для вставки (после регистрации тестовых роутов)
const insertAfter = `  app.use('/api/admin-test', adminModerationTestRoutes);`;

if (content.includes(insertAfter) && !content.includes('/api/test/staging-suppliers')) {
    content = content.replace(insertAfter, insertAfter + testEndpoint);
    fs.writeFileSync(filePath, content);
    console.log('✅ Добавлен простой тестовый эндпоинт');
} else if (content.includes('/api/test/staging-suppliers')) {
    console.log('✅ Тестовый эндпоинт уже существует');
} else {
    console.log('❌ Не удалось найти место для вставки');
}
