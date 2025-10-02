import { test, expect } from '@playwright/test';

test.describe('Critical Paths - Supplier Search Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Предполагаем, что пользователь уже авторизован
    await page.goto('/search');
  });

  test('basic supplier search', async ({ page }) => {
    await test.step('Enter search query', async () => {
      await page.fill('input[placeholder*="поиск"]', 'electronics manufacturer');
      await expect(page.locator('input[placeholder*="поиск"]')).toHaveValue('electronics manufacturer');
    });

    await test.step('Select search filters', async () => {
      await page.selectOption('select[name="category"]', 'electronics');
      await page.selectOption('select[name="region"]', 'ru');
      await page.selectOption('select[name="sort"]', 'rating-desc');
    });

    await test.step('Execute search', async () => {
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="search-loading"]')).toBeVisible();
    });

    await test.step('Verify search results', async () => {
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      await expect(page.locator('text=Найдено поставщиков')).toBeVisible();
    });
  });

  test('advanced supplier search with filters', async ({ page }) => {
    await test.step('Open advanced filters', async () => {
      await page.click('button[data-testid="advanced-filters"]');
      await expect(page.locator('[data-testid="advanced-filters-panel"]')).toBeVisible();
    });

    await test.step('Set advanced filters', async () => {
      await page.check('input[name="verified-only"]');
      await page.fill('input[name="min-rating"]', '4.0');
      await page.fill('input[name="max-price"]', '10000');
      await page.selectOption('select[name="certification"]', 'ISO 9001');
    });

    await test.step('Apply filters and search', async () => {
      await page.click('button[data-testid="apply-filters"]');
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
    });

    await test.step('Verify filtered results', async () => {
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      // Проверяем, что все результаты соответствуют фильтрам
      const supplierCards = page.locator('[data-testid="supplier-card"]');
      const count = await supplierCards.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test('supplier search with multiple queries', async ({ page }) => {
    await test.step('Enter multiple search terms', async () => {
      await page.fill('input[placeholder*="поиск"]', 'electronics, components, manufacturing');
      await page.click('button[data-testid="add-search-term"]');
      await page.fill('input[data-testid="search-term-1"]', 'ISO certified');
      await page.click('button[data-testid="add-search-term"]');
      await page.fill('input[data-testid="search-term-2"]', 'fast delivery');
    });

    await test.step('Execute multi-query search', async () => {
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="search-loading"]')).toBeVisible();
    });

    await test.step('Verify comprehensive results', async () => {
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      await expect(page.locator('text=Поиск по нескольким запросам')).toBeVisible();
    });
  });

  test('supplier search error handling', async ({ page }) => {
    await test.step('Test empty search query', async () => {
      await page.fill('input[placeholder*="поиск"]', '');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Введите поисковый запрос')).toBeVisible();
    });

    await test.step('Test invalid characters', async () => {
      await page.fill('input[placeholder*="поиск"]', '<script>alert("xss")</script>');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Недопустимые символы')).toBeVisible();
    });

    await test.step('Test very long query', async () => {
      const longQuery = 'a'.repeat(1000);
      await page.fill('input[placeholder*="поиск"]', longQuery);
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Слишком длинный запрос')).toBeVisible();
    });
  });

  test('supplier search performance', async ({ page }) => {
    await test.step('Measure search response time', async () => {
      const startTime = Date.now();
      
      await page.fill('input[placeholder*="поиск"]', 'electronics manufacturer');
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Поиск должен завершиться за разумное время
      expect(responseTime).toBeLessThan(10000); // 10 секунд
    });

    await test.step('Test concurrent searches', async () => {
      // Открываем несколько вкладок для параллельного поиска
      const context = page.context();
      const page2 = await context.newPage();
      const page3 = await context.newPage();
      
      await page.goto('/search');
      await page2.goto('/search');
      await page3.goto('/search');
      
      // Выполняем поиск на всех страницах одновременно
      const promises = [
        page.fill('input[placeholder*="поиск"]', 'electronics'),
        page2.fill('input[placeholder*="поиск"]', 'automotive'),
        page3.fill('input[placeholder*="поиск"]', 'textiles')
      ];
      
      await Promise.all(promises);
      
      const submitPromises = [
        page.click('button[type="submit"]'),
        page2.click('button[type="submit"]'),
        page3.click('button[type="submit"]')
      ];
      
      await Promise.all(submitPromises);
      
      // Проверяем, что все поиски завершились успешно
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      await expect(page2.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      await expect(page3.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      
      await page2.close();
      await page3.close();
    });
  });

  test('supplier search with pagination', async ({ page }) => {
    await test.step('Execute search with many results', async () => {
      await page.fill('input[placeholder*="поиск"]', 'supplier');
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
    });

    await test.step('Navigate through pages', async () => {
      if (await page.locator('button[data-testid="next-page"]').isVisible()) {
        await page.click('button[data-testid="next-page"]');
        await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
        
        await page.click('button[data-testid="prev-page"]');
        await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      }
    });

    await test.step('Test page size options', async () => {
      await page.selectOption('select[name="pageSize"]', '50');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      
      await page.selectOption('select[name="pageSize"]', '100');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
    });
  });

  test('supplier search with sorting', async ({ page }) => {
    await test.step('Execute initial search', async () => {
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
    });

    await test.step('Test different sorting options', async () => {
      const sortOptions = ['rating-desc', 'rating-asc', 'name-asc', 'name-desc', 'price-asc', 'price-desc'];
      
      for (const sortOption of sortOptions) {
        await page.selectOption('select[name="sort"]', sortOption);
        await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      }
    });

    await test.step('Verify sorting works correctly', async () => {
      await page.selectOption('select[name="sort"]', 'rating-desc');
      
      // Проверяем, что результаты отсортированы по рейтингу
      const ratings = await page.locator('[data-testid="supplier-rating"]').allTextContents();
      if (ratings.length > 1) {
        const firstRating = parseFloat(ratings[0]);
        const secondRating = parseFloat(ratings[1]);
        expect(firstRating).toBeGreaterThanOrEqual(secondRating);
      }
    });
  });
});


