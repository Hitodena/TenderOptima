import { test, expect } from '@playwright/test';

test.describe('Complete User Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на главную страницу
    await page.goto('/');
  });

  test('complete supplier search and request workflow', async ({ page }) => {
    // 1. Регистрация нового пользователя
    await test.step('User Registration', async () => {
      await page.click('text=Регистрация');
      await expect(page.locator('input[name="name"]')).toBeVisible();
      
      const timestamp = Date.now();
      const userData = {
        name: `Test User ${timestamp}`,
        email: `test-${timestamp}@example.com`,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      };
      
      await page.fill('input[name="name"]', userData.name);
      await page.fill('input[type="email"]', userData.email);
      await page.fill('input[type="password"]', userData.password);
      await page.fill('input[name="confirmPassword"]', userData.confirmPassword);
      
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Регистрация успешна')).toBeVisible();
    });

    // 2. Онбординг
    await test.step('User Onboarding', async () => {
      await page.click('text=Начать');
      
      // Заполняем бизнес-карточку
      await page.fill('textarea[name="businessCard"]', 'Мы ищем поставщиков электроники с ISO сертификацией');
      await page.click('button[type="submit"]');
      
      // Завершаем онбординг
      await page.click('text=Завершить');
      await expect(page.locator('text=Добро пожаловать')).toBeVisible();
    });

    // 3. Создание поискового запроса
    await test.step('Create Search Request', async () => {
      await page.click('text=Отправить запрос');
      await expect(page).toHaveURL(/.*send-request.*/);
      
      const requestData = {
        title: 'E2E Test Request',
        description: 'Testing complete workflow with Playwright',
        budget: '10000',
        deadline: '2024-12-31'
      };
      
      await page.fill('input[name="title"]', requestData.title);
      await page.fill('textarea[name="description"]', requestData.description);
      await page.fill('input[name="budget"]', requestData.budget);
      await page.fill('input[name="deadline"]', requestData.deadline);
      
      // Добавляем требования
      await page.click('button[data-testid="add-requirement"]');
      await page.fill('input[data-testid="requirement-0"]', 'ISO 9001 certification');
      
      await page.click('button[data-testid="add-requirement"]');
      await page.fill('input[data-testid="requirement-1"]', 'Fast delivery');
      
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Запрос создан успешно')).toBeVisible();
    });

    // 4. Поиск поставщиков
    await test.step('Search Suppliers', async () => {
      await page.click('text=Найти поставщиков');
      await expect(page).toHaveURL(/.*search.*/);
      
      await page.fill('input[placeholder*="поиск"]', 'electronics manufacturer ISO certified');
      await page.selectOption('select[name="category"]', 'electronics');
      await page.selectOption('select[name="region"]', 'ru');
      
      await page.click('button[type="submit"]');
      
      // Ждем результаты поиска
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
    });

    // 5. Выбор поставщиков
    await test.step('Select Suppliers', async () => {
      // Выбираем первых 3 поставщиков
      await page.check('[data-testid="supplier-checkbox-0"]');
      await page.check('[data-testid="supplier-checkbox-1"]');
      await page.check('[data-testid="supplier-checkbox-2"]');
      
      await page.click('button[data-testid="select-suppliers"]');
      await expect(page.locator('text=Выбрано поставщиков: 3')).toBeVisible();
    });

    // 6. Отправка запроса поставщикам
    await test.step('Send Request to Suppliers', async () => {
      await page.click('button[data-testid="send-to-suppliers"]');
      
      // Заполняем email шаблон
      await page.fill('textarea[name="emailTemplate"]', 'Уважаемые поставщики,\n\nМы заинтересованы в ваших услугах. Пожалуйста, рассмотрите наш запрос.\n\nС уважением,\nКоманда закупок');
      
      await page.click('button[data-testid="send-emails"]');
      await expect(page.locator('text=Запрос отправлен поставщикам')).toBeVisible();
    });

    // 7. Переход к дашборду
    await test.step('View Dashboard', async () => {
      await page.click('text=Дашборд');
      await expect(page).toHaveURL(/.*dashboard.*/);
      
      // Проверяем, что запрос отображается в дашборде
      await expect(page.locator('text=E2E Test Request')).toBeVisible();
      await expect(page.locator('text=Активные запросы')).toBeVisible();
    });

    // 8. Просмотр деталей запроса
    await test.step('View Request Details', async () => {
      await page.click('text=E2E Test Request');
      await expect(page).toHaveURL(/.*requests\/\d+.*/);
      
      // Проверяем детали запроса
      await expect(page.locator('text=E2E Test Request')).toBeVisible();
      await expect(page.locator('text=Testing complete workflow with Playwright')).toBeVisible();
      await expect(page.locator('text=ISO 9001 certification')).toBeVisible();
    });

    // 9. Управление контактами
    await test.step('Manage Contacts', async () => {
      await page.click('text=Контакты');
      await expect(page).toHaveURL(/.*contact-groups.*/);
      
      // Создаем группу контактов
      await page.click('button[data-testid="create-contact-group"]');
      await page.fill('input[name="groupName"]', 'Electronics Suppliers');
      await page.fill('textarea[name="groupDescription"]', 'Group of electronics suppliers');
      
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Electronics Suppliers')).toBeVisible();
    });

    // 10. Настройки пользователя
    await test.step('User Settings', async () => {
      await page.click('text=Настройки');
      await expect(page).toHaveURL(/.*settings.*/);
      
      // Изменяем язык
      await page.selectOption('select[name="language"]', 'en');
      
      // Изменяем предпочитаемый режим
      await page.selectOption('select[name="preferredMode"]', 'analyze_offers');
      
      await page.click('button[data-testid="save-settings"]');
      await expect(page.locator('text=Настройки сохранены')).toBeVisible();
    });
  });

  test('supplier response and analysis workflow', async ({ page }) => {
    // Предполагаем, что пользователь уже авторизован и есть активный запрос
    await test.step('View Supplier Responses', async () => {
      await page.goto('/dashboard');
      
      // Переходим к запросу с ответами
      await page.click('text=Запрос с ответами');
      await expect(page).toHaveURL(/.*requests\/\d+.*/);
      
      // Проверяем, что есть ответы от поставщиков
      await expect(page.locator('[data-testid="supplier-response"]')).toHaveCount.greaterThan(0);
    });

    await test.step('Analyze Supplier Responses', async () => {
      // Выбираем ответ для анализа
      await page.click('[data-testid="analyze-response-0"]');
      
      // Запускаем анализ
      await page.click('button[data-testid="start-analysis"]');
      await expect(page.locator('text=Анализ запущен')).toBeVisible();
      
      // Ждем завершения анализа
      await expect(page.locator('text=Анализ завершен')).toBeVisible({ timeout: 30000 });
    });

    await test.step('Compare Suppliers', async () => {
      // Выбираем поставщиков для сравнения
      await page.check('[data-testid="compare-supplier-0"]');
      await page.check('[data-testid="compare-supplier-1"]');
      await page.check('[data-testid="compare-supplier-2"]');
      
      await page.click('button[data-testid="compare-suppliers"]');
      await expect(page).toHaveURL(/.*compare-results.*/);
      
      // Проверяем результаты сравнения
      await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="supplier-score"]')).toHaveCount.greaterThan(0);
    });

    await test.step('Select Winner', async () => {
      // Выбираем победителя
      await page.click('[data-testid="select-winner-0"]');
      await page.fill('textarea[name="winnerNotes"]', 'Лучшее предложение по цене и качеству');
      
      await page.click('button[data-testid="confirm-winner"]');
      await expect(page.locator('text=Победитель выбран')).toBeVisible();
    });

    await test.step('Send Notifications', async () => {
      // Отправляем уведомления
      await page.click('button[data-testid="send-notifications"]');
      
      // Выбираем шаблон уведомления
      await page.selectOption('select[name="notificationTemplate"]', 'winner-selected');
      
      await page.click('button[data-testid="send-winner-notification"]');
      await expect(page.locator('text=Уведомления отправлены')).toBeVisible();
    });
  });

  test('admin panel workflow', async ({ page }) => {
    // Предполагаем, что пользователь имеет права администратора
    await test.step('Access Admin Panel', async () => {
      await page.goto('/admin/email');
      await expect(page).toHaveURL(/.*admin.*/);
      
      // Проверяем элементы админ панели
      await expect(page.locator('text=Административная панель')).toBeVisible();
      await expect(page.locator('text=Управление email')).toBeVisible();
    });

    await test.step('Manage Email Templates', async () => {
      await page.click('text=Шаблоны email');
      
      // Создаем новый шаблон
      await page.click('button[data-testid="create-template"]');
      await page.fill('input[name="templateName"]', 'Custom Supplier Request');
      await page.fill('textarea[name="templateSubject"]', 'Новый запрос поставщика: {{title}}');
      await page.fill('textarea[name="templateBody"]', 'Уважаемый {{supplierName}},\n\nМы заинтересованы в ваших услугах для проекта: {{title}}\n\nОписание: {{description}}\n\nСрок: {{deadline}}\n\nС уважением,\n{{userName}}');
      
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Шаблон создан')).toBeVisible();
    });

    await test.step('Moderate Suppliers', async () => {
      await page.click('text=Модерация поставщиков');
      
      // Просматриваем список поставщиков
      await expect(page.locator('[data-testid="supplier-list"]')).toBeVisible();
      
      // Одобряем поставщика
      await page.click('[data-testid="approve-supplier-0"]');
      await expect(page.locator('text=Поставщик одобрен')).toBeVisible();
    });

    await test.step('View Analytics', async () => {
      await page.click('text=Аналитика');
      
      // Проверяем различные метрики
      await expect(page.locator('[data-testid="total-requests"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-suppliers"]')).toBeVisible();
      await expect(page.locator('[data-testid="response-rate"]')).toBeVisible();
    });
  });

  test('error handling and edge cases', async ({ page }) => {
    await test.step('Handle Network Errors', async () => {
      // Имитируем медленное соединение
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 2000);
      });
      
      await page.goto('/');
      await expect(page.locator('[data-testid="loading"]')).toBeVisible();
    });

    await test.step('Handle Form Validation Errors', async () => {
      await page.goto('/send-request');
      
      // Пытаемся отправить пустую форму
      await page.click('button[type="submit"]');
      
      // Проверяем сообщения об ошибках
      await expect(page.locator('text=Обязательное поле')).toBeVisible();
      await expect(page.locator('text=Заполните все обязательные поля')).toBeVisible();
    });

    await test.step('Handle API Errors', async () => {
      // Имитируем ошибку API
      await page.route('**/api/supplier-search', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });
      
      await page.goto('/search');
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('text=Ошибка загрузки')).toBeVisible();
    });

    await test.step('Handle Large Data Sets', async () => {
      await page.goto('/dashboard');
      
      // Имитируем большое количество запросов
      await page.evaluate(() => {
        // Создаем много элементов в DOM
        for (let i = 0; i < 1000; i++) {
          const div = document.createElement('div');
          div.textContent = `Request ${i}`;
          div.setAttribute('data-testid', `request-${i}`);
          document.body.appendChild(div);
        }
      });
      
      // Проверяем, что приложение не зависает
      await expect(page.locator('[data-testid="request-0"]')).toBeVisible();
    });
  });

  test('mobile responsive design', async ({ page }) => {
    await test.step('Mobile Viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Проверяем, что меню адаптируется
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Проверяем, что контент помещается
      await expect(page.locator('main')).toBeVisible();
    });

    await test.step('Tablet Viewport', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      
      // Проверяем планшетную версию
      await expect(page.locator('[data-testid="tablet-menu"]')).toBeVisible();
    });

    await test.step('Desktop Viewport', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      
      // Проверяем десктопную версию
      await expect(page.locator('[data-testid="desktop-menu"]')).toBeVisible();
    });
  });
});


