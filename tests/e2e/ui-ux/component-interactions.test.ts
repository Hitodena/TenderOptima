import { test, expect } from '@playwright/test';

test.describe('UI/UX Component Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('navigation menu interactions', async ({ page }) => {
    await test.step('Test main navigation', async () => {
      await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible();
      
      // Проверяем все пункты меню
      const menuItems = [
        'Главная',
        'Поиск поставщиков',
        'Мои запросы',
        'Анализ предложений',
        'Контакты',
        'Настройки'
      ];
      
      for (const item of menuItems) {
        await expect(page.locator(`text=${item}`)).toBeVisible();
      }
    });

    await test.step('Test navigation links', async () => {
      await page.click('text=Поиск поставщиков');
      await expect(page).toHaveURL(/.*search.*/);
      
      await page.click('text=Мои запросы');
      await expect(page).toHaveURL(/.*requests.*/);
      
      await page.click('text=Настройки');
      await expect(page).toHaveURL(/.*settings.*/);
    });

    await test.step('Test mobile navigation', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.click('[data-testid="mobile-menu-toggle"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      await page.click('text=Поиск поставщиков');
      await expect(page).toHaveURL(/.*search.*/);
    });
  });

  test('form interactions and validation', async ({ page }) => {
    await test.step('Test search form', async () => {
      await page.goto('/search');
      
      // Проверяем обязательные поля
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Заполните поисковый запрос')).toBeVisible();
      
      // Заполняем форму
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.selectOption('select[name="category"]', 'electronics');
      
      // Проверяем, что ошибка исчезла
      await expect(page.locator('text=Заполните поисковый запрос')).not.toBeVisible();
    });

    await test.step('Test request creation form', async () => {
      await page.goto('/send-request');
      
      // Проверяем валидацию полей
      await page.fill('input[name="title"]', '');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Заполните название запроса')).toBeVisible();
      
      // Заполняем все обязательные поля
      await page.fill('input[name="title"]', 'Test Request');
      await page.fill('textarea[name="description"]', 'Test Description');
      await page.fill('input[name="budget"]', '10000');
      
      // Проверяем, что форма готова к отправке
      await expect(page.locator('button[type="submit"]')).not.toBeDisabled();
    });

    await test.step('Test dynamic form fields', async () => {
      await page.goto('/send-request');
      
      // Добавляем требования
      await page.click('button[data-testid="add-requirement"]');
      await expect(page.locator('input[data-testid="requirement-0"]')).toBeVisible();
      
      await page.fill('input[data-testid="requirement-0"]', 'ISO 9001 certification');
      
      // Добавляем еще одно требование
      await page.click('button[data-testid="add-requirement"]');
      await expect(page.locator('input[data-testid="requirement-1"]')).toBeVisible();
      
      // Удаляем требование
      await page.click('button[data-testid="remove-requirement-1"]');
      await expect(page.locator('input[data-testid="requirement-1"]')).not.toBeVisible();
    });
  });

  test('modal and popup interactions', async ({ page }) => {
    await test.step('Test supplier details modal', async () => {
      await page.goto('/search');
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      
      // Открываем модальное окно с деталями поставщика
      await page.click('[data-testid="supplier-details-0"]');
      await expect(page.locator('[data-testid="supplier-modal"]')).toBeVisible();
      
      // Проверяем содержимое модального окна
      await expect(page.locator('[data-testid="supplier-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="supplier-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="supplier-contact"]')).toBeVisible();
    });

    await test.step('Test modal close interactions', async () => {
      await page.click('[data-testid="supplier-details-0"]');
      await expect(page.locator('[data-testid="supplier-modal"]')).toBeVisible();
      
      // Закрываем модальное окно разными способами
      await page.click('[data-testid="modal-close"]');
      await expect(page.locator('[data-testid="supplier-modal"]')).not.toBeVisible();
      
      // Открываем снова и закрываем по ESC
      await page.click('[data-testid="supplier-details-0"]');
      await expect(page.locator('[data-testid="supplier-modal"]')).toBeVisible();
      
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="supplier-modal"]')).not.toBeVisible();
    });

    await test.step('Test confirmation dialogs', async () => {
      await page.goto('/requests');
      
      // Пытаемся удалить запрос
      await page.click('[data-testid="delete-request-0"]');
      await expect(page.locator('[data-testid="confirmation-dialog"]')).toBeVisible();
      
      // Отменяем удаление
      await page.click('button[data-testid="cancel-delete"]');
      await expect(page.locator('[data-testid="confirmation-dialog"]')).not.toBeVisible();
      
      // Подтверждаем удаление
      await page.click('[data-testid="delete-request-0"]');
      await page.click('button[data-testid="confirm-delete"]');
      await expect(page.locator('text=Запрос удален')).toBeVisible();
    });
  });

  test('data table interactions', async ({ page }) => {
    await test.step('Test supplier table', async () => {
      await page.goto('/search');
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      
      // Проверяем таблицу поставщиков
      await expect(page.locator('[data-testid="supplier-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="supplier-row"]')).toHaveCount.greaterThan(0);
    });

    await test.step('Test table sorting', async () => {
      // Кликаем по заголовкам для сортировки
      await page.click('[data-testid="sort-by-name"]');
      await expect(page.locator('[data-testid="sort-indicator-name"]')).toBeVisible();
      
      await page.click('[data-testid="sort-by-rating"]');
      await expect(page.locator('[data-testid="sort-indicator-rating"]')).toBeVisible();
      
      await page.click('[data-testid="sort-by-price"]');
      await expect(page.locator('[data-testid="sort-indicator-price"]')).toBeVisible();
    });

    await test.step('Test table selection', async () => {
      // Выбираем поставщиков
      await page.check('[data-testid="select-supplier-0"]');
      await page.check('[data-testid="select-supplier-1"]');
      await page.check('[data-testid="select-supplier-2"]');
      
      // Проверяем, что выбраны правильные поставщики
      await expect(page.locator('text=Выбрано поставщиков: 3')).toBeVisible();
      
      // Выбираем всех поставщиков
      await page.click('[data-testid="select-all-suppliers"]');
      await expect(page.locator('text=Выбрано поставщиков:')).toBeVisible();
    });

    await test.step('Test table pagination', async () => {
      // Проверяем пагинацию
      if (await page.locator('[data-testid="pagination"]').isVisible()) {
        await page.click('[data-testid="next-page"]');
        await expect(page.locator('[data-testid="supplier-row"]')).toHaveCount.greaterThan(0);
        
        await page.click('[data-testid="prev-page"]');
        await expect(page.locator('[data-testid="supplier-row"]')).toHaveCount.greaterThan(0);
      }
    });
  });

  test('responsive design and layout', async ({ page }) => {
    await test.step('Test desktop layout', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      
      // Проверяем десктопную версию
      await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    });

    await test.step('Test tablet layout', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      
      // Проверяем планшетную версию
      await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();
      await expect(page.locator('[data-testid="collapsible-sidebar"]')).toBeVisible();
    });

    await test.step('Test mobile layout', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Проверяем мобильную версию
      await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Проверяем, что контент помещается
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    });

    await test.step('Test layout transitions', async () => {
      // Плавный переход между размерами экрана
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1024, height: 768 },
        { width: 768, height: 1024 },
        { width: 375, height: 667 }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
      }
    });
  });

  test('loading states and animations', async ({ page }) => {
    await test.step('Test search loading state', async () => {
      await page.goto('/search');
      
      // Имитируем медленный поиск
      await page.route('**/api/supplier-search', route => {
        setTimeout(() => route.continue(), 2000);
      });
      
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      
      // Проверяем состояние загрузки
      await expect(page.locator('[data-testid="search-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    });

    await test.step('Test form submission loading', async () => {
      await page.goto('/send-request');
      
      // Имитируем медленную отправку формы
      await page.route('**/api/requests', route => {
        setTimeout(() => route.continue(), 1500);
      });
      
      await page.fill('input[name="title"]', 'Test Request');
      await page.fill('textarea[name="description"]', 'Test Description');
      await page.click('button[type="submit"]');
      
      // Проверяем состояние загрузки
      await expect(page.locator('[data-testid="form-loading"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });

    await test.step('Test success animations', async () => {
      await page.goto('/send-request');
      
      await page.fill('input[name="title"]', 'Test Request');
      await page.fill('textarea[name="description"]', 'Test Description');
      await page.click('button[type="submit"]');
      
      // Проверяем анимацию успеха
      await expect(page.locator('[data-testid="success-animation"]')).toBeVisible();
      await expect(page.locator('text=Запрос создан успешно')).toBeVisible();
    });
  });

  test('keyboard navigation and accessibility', async ({ page }) => {
    await test.step('Test keyboard navigation', async () => {
      await page.goto('/');
      
      // Навигация с клавиатуры
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Проверяем, что произошел переход
      await expect(page).toHaveURL(/.*search.*/);
    });

    await test.step('Test form keyboard navigation', async () => {
      await page.goto('/send-request');
      
      // Навигация по форме с Tab
      await page.keyboard.press('Tab');
      await page.keyboard.type('Test Request');
      
      await page.keyboard.press('Tab');
      await page.keyboard.type('Test Description');
      
      await page.keyboard.press('Tab');
      await page.keyboard.type('10000');
      
      // Отправка формы с Enter
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Запрос создан успешно')).toBeVisible();
    });

    await test.step('Test accessibility attributes', async () => {
      await page.goto('/');
      
      // Проверяем ARIA атрибуты
      await expect(page.locator('[data-testid="main-navigation"]')).toHaveAttribute('role', 'navigation');
      await expect(page.locator('[data-testid="search-form"]')).toHaveAttribute('role', 'search');
      await expect(page.locator('[data-testid="supplier-table"]')).toHaveAttribute('role', 'table');
      
      // Проверяем alt тексты для изображений
      await expect(page.locator('img[alt*="logo"]')).toBeVisible();
      await expect(page.locator('img[alt*="supplier"]')).toBeVisible();
    });
  });
});


