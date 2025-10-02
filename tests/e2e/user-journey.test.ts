import { test, expect } from '@playwright/test';

test.describe('User Journey E2E Tests', () => {
  test('complete supplier search workflow', async ({ page }) => {
    // 1. Переходим на главную страницу
    await page.goto('/');
    
    // 2. Проверяем, что мы на странице входа
    await expect(page.locator('h1')).toContainText(/вход|login|sign in/i);
    
    // 3. Регистрируемся или входим
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    
    // Если есть форма регистрации
    if (await page.locator('input[type="email"]').isVisible()) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
    }
    
    // 4. Переходим к созданию поискового запроса
    await page.click('text=Создать запрос');
    await expect(page).toHaveURL(/.*send-request.*/);
    
    // 5. Заполняем форму поискового запроса
    await page.fill('input[name="title"]', 'E2E Test Request');
    await page.fill('textarea[name="description"]', 'Testing full workflow with Playwright');
    await page.fill('input[name="budget"]', '10000');
    await page.fill('input[name="deadline"]', '2024-12-31');
    
    // 6. Добавляем требования
    await page.click('button[data-testid="add-requirement"]');
    await page.fill('input[data-testid="requirement-0"]', 'High quality');
    
    await page.click('button[data-testid="add-requirement"]');
    await page.fill('input[data-testid="requirement-1"]', 'Fast delivery');
    
    // 7. Отправляем запрос
    await page.click('button[type="submit"]');
    
    // 8. Проверяем, что запрос создан
    await expect(page.locator('text=Запрос создан успешно')).toBeVisible();
    
    // 9. Переходим к поиску поставщиков
    await page.click('text=Найти поставщиков');
    await expect(page).toHaveURL(/.*search.*/);
    
    // 10. Выполняем поиск
    await page.fill('input[placeholder*="поиск"]', 'electronics manufacturer');
    await page.click('button[type="submit"]');
    
    // 11. Проверяем результаты поиска
    await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
    
    // 12. Выбираем поставщиков
    await page.check('[data-testid="supplier-checkbox-0"]');
    await page.check('[data-testid="supplier-checkbox-1"]');
    
    // 13. Отправляем запрос поставщикам
    await page.click('button[data-testid="send-to-suppliers"]');
    
    // 14. Проверяем подтверждение
    await expect(page.locator('text=Запрос отправлен поставщикам')).toBeVisible();
    
    // 15. Переходим к дашборду
    await page.click('text=Дашборд');
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // 16. Проверяем, что запрос отображается в дашборде
    await expect(page.locator('text=E2E Test Request')).toBeVisible();
  });

  test('user authentication flow', async ({ page }) => {
    // 1. Переходим на страницу входа
    await page.goto('/auth');
    
    // 2. Проверяем элементы формы
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // 3. Тестируем валидацию
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Обязательное поле')).toBeVisible();
    
    // 4. Вводим неверные данные
    await page.fill('input[type="email"]', 'invalid@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // 5. Проверяем сообщение об ошибке
    await expect(page.locator('text=Неверные данные')).toBeVisible();
    
    // 6. Тестируем регистрацию
    await page.click('text=Регистрация');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    
    // 7. Заполняем форму регистрации
    const email = `newuser-${Date.now()}@example.com`;
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    
    // 8. Отправляем форму
    await page.click('button[type="submit"]');
    
    // 9. Проверяем успешную регистрацию
    await expect(page.locator('text=Регистрация успешна')).toBeVisible();
  });

  test('supplier search and filtering', async ({ page }) => {
    // Предполагаем, что пользователь уже авторизован
    await page.goto('/search');
    
    // 1. Проверяем элементы поиска
    await expect(page.locator('input[placeholder*="поиск"]')).toBeVisible();
    await expect(page.locator('select[name="category"]')).toBeVisible();
    await expect(page.locator('select[name="region"]')).toBeVisible();
    
    // 2. Выполняем поиск
    await page.fill('input[placeholder*="поиск"]', 'electronics');
    await page.selectOption('select[name="category"]', 'electronics');
    await page.click('button[type="submit"]');
    
    // 3. Проверяем результаты
    await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
    
    // 4. Тестируем фильтры
    await page.click('button[data-testid="filter-button"]');
    await page.check('input[name="filter-verified"]');
    await page.fill('input[name="min-rating"]', '4');
    await page.click('button[data-testid="apply-filters"]');
    
    // 5. Проверяем, что фильтры применились
    await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
    
    // 6. Тестируем сортировку
    await page.selectOption('select[name="sort"]', 'rating-desc');
    await expect(page.locator('[data-testid="supplier-card"]').first()).toBeVisible();
    
    // 7. Тестируем пагинацию
    if (await page.locator('button[data-testid="next-page"]').isVisible()) {
      await page.click('button[data-testid="next-page"]');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
    }
  });

  test('responsive design', async ({ page }) => {
    // Тестируем на мобильном устройстве
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // 1. Проверяем, что меню адаптируется
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // 2. Тестируем на планшете
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    
    // 3. Проверяем, что контент адаптируется
    await expect(page.locator('[data-testid="desktop-menu"]')).toBeVisible();
    
    // 4. Тестируем на десктопе
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    
    // 5. Проверяем полную функциональность
    await expect(page.locator('[data-testid="full-menu"]')).toBeVisible();
  });

  test('error handling and edge cases', async ({ page }) => {
    // 1. Тестируем 404 страницу
    await page.goto('/nonexistent-page');
    await expect(page.locator('text=404')).toBeVisible();
    
    // 2. Тестируем медленное соединение
    await page.route('**/*', route => {
      // Имитируем медленное соединение
      setTimeout(() => route.continue(), 2000);
    });
    
    await page.goto('/');
    await expect(page.locator('[data-testid="loading"]')).toBeVisible();
    
    // 3. Тестируем обработку ошибок API
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.goto('/dashboard');
    await expect(page.locator('text=Ошибка загрузки')).toBeVisible();
  });
});


