import { test, expect } from '@playwright/test';

test.describe('Critical Paths - Authentication Flow', () => {
  test('user registration and login flow', async ({ page }) => {
    await test.step('Navigate to registration', async () => {
      await page.goto('/auth');
      await expect(page.locator('text=Регистрация')).toBeVisible();
      await page.click('text=Регистрация');
    });

    await test.step('Fill registration form', async () => {
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
    });

    await test.step('Submit registration', async () => {
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Регистрация успешна')).toBeVisible();
    });

    await test.step('Verify redirect to onboarding', async () => {
      await expect(page).toHaveURL(/.*onboarding.*/);
      await expect(page.locator('text=Добро пожаловать')).toBeVisible();
    });
  });

  test('user login flow', async ({ page }) => {
    await test.step('Navigate to login', async () => {
      await page.goto('/auth');
      await expect(page.locator('text=Вход')).toBeVisible();
    });

    await test.step('Fill login form', async () => {
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'TestPassword123!');
    });

    await test.step('Submit login', async () => {
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*dashboard.*/);
    });

    await test.step('Verify authenticated state', async () => {
      await expect(page.locator('text=Добро пожаловать')).toBeVisible();
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });
  });

  test('password reset flow', async ({ page }) => {
    await test.step('Navigate to password reset', async () => {
      await page.goto('/auth');
      await page.click('text=Забыли пароль?');
      await expect(page.locator('text=Восстановление пароля')).toBeVisible();
    });

    await test.step('Enter email for reset', async () => {
      await page.fill('input[type="email"]', 'test@example.com');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Письмо отправлено')).toBeVisible();
    });

    await test.step('Handle reset token', async () => {
      // В реальном приложении здесь был бы переход по ссылке из email
      await page.goto('/auth/reset?token=mock-token');
      await expect(page.locator('text=Новый пароль')).toBeVisible();
    });

    await test.step('Set new password', async () => {
      await page.fill('input[name="password"]', 'NewPassword123!');
      await page.fill('input[name="confirmPassword"]', 'NewPassword123!');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Пароль изменен')).toBeVisible();
    });
  });

  test('logout flow', async ({ page }) => {
    await test.step('Login first', async () => {
      await page.goto('/auth');
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*dashboard.*/);
    });

    await test.step('Logout', async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Выйти');
      await expect(page).toHaveURL(/.*auth.*/);
    });

    await test.step('Verify logged out state', async () => {
      await expect(page.locator('text=Вход')).toBeVisible();
      // Попытка доступа к защищенной странице должна перенаправить на auth
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/.*auth.*/);
    });
  });
});


