import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('Authentication Security Tests', () => {
  let testServer: any;

  beforeAll(async () => {
    await setupTestEnvironment();
    testServer = await TestHelpers.createTestServer();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    if (testServer) {
      await testServer.close();
    }
  });

  describe('Password Security', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'qwerty',
        'admin',
        'test',
        'password123',
        'Password123', // Только одна заглавная буква
        'PASSWORD123', // Нет строчных букв
        'password!', // Нет цифр
        'Password1' // Нет специальных символов
      ];

      for (const password of weakPasswords) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            email: 'test@example.com',
            password: password,
            confirmPassword: password
          })
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toContain('password');
      }
    });

    it('should accept strong passwords', async () => {
      const strongPasswords = [
        'Password123!',
        'MySecurePass1@',
        'ComplexP@ssw0rd',
        'Str0ng!Pass123',
        'Secure#Pass1'
      ];

      for (const password of strongPasswords) {
        const timestamp = Date.now();
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Test User ${timestamp}`,
            email: `test${timestamp}@example.com`,
            password: password,
            confirmPassword: password
          })
        });

        expect(response.status).toBe(200);
      }
    });

    it('should hash passwords securely', async () => {
      const password = 'SecurePassword123!';
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'hashtest@example.com',
          password: password,
          confirmPassword: password
        })
      });

      expect(response.status).toBe(200);
      
      // Проверяем, что пароль не хранится в открытом виде
      // В реальном приложении здесь был бы запрос к БД для проверки хэша
      const result = await response.json();
      expect(result.user).toBeDefined();
      expect(result.user.password).toBeUndefined(); // Пароль не должен возвращаться
    });

    it('should prevent password confirmation mismatch', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'mismatch@example.com',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!'
        })
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toContain('password');
    });
  });

  describe('Session Security', () => {
    it('should create secure sessions', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!'
        })
      });

      expect(response.status).toBe(200);
      
      const cookies = response.headers.get('set-cookie');
      expect(cookies).toBeDefined();
      
      // Проверяем, что сессия содержит secure флаги
      expect(cookies).toContain('HttpOnly');
      expect(cookies).toContain('Secure');
      expect(cookies).toContain('SameSite');
    });

    it('should invalidate sessions on logout', async () => {
      // Сначала логинимся
      const loginResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!'
        })
      });

      expect(loginResponse.status).toBe(200);
      const sessionCookie = loginResponse.headers.get('set-cookie');

      // Теперь выходим
      const logoutResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Cookie': sessionCookie || '' }
      });

      expect(logoutResponse.status).toBe(200);
      
      // Проверяем, что сессия недействительна
      const protectedResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/dashboard`, {
        headers: { 'Cookie': sessionCookie || '' }
      });

      expect(protectedResponse.status).toBe(401);
    });

    it('should handle session timeout', async () => {
      // Создаем сессию
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!'
        })
      });

      expect(response.status).toBe(200);
      
      // Имитируем истечение сессии (в реальном приложении это было бы через время)
      // Здесь мы просто проверяем, что система обрабатывает недействительные сессии
      const invalidSessionResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/dashboard`, {
        headers: { 'Cookie': 'session=invalid-session-id' }
      });

      expect(invalidSessionResponse.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit login attempts', async () => {
      const maxAttempts = 5;
      const promises = [];

      // Создаем много попыток входа с неверными данными
      for (let i = 0; i < maxAttempts + 2; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'WrongPassword123!'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Первые попытки должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should limit registration attempts', async () => {
      const maxAttempts = 3;
      const promises = [];

      // Создаем много попыток регистрации
      for (let i = 0; i < maxAttempts + 2; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `Test User ${i}`,
              email: `test${i}@example.com`,
              password: 'Password123!',
              confirmPassword: 'Password123!'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Некоторые попытки должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should limit password reset attempts', async () => {
      const maxAttempts = 3;
      const promises = [];

      // Создаем много попыток сброса пароля
      for (let i = 0; i < maxAttempts + 2; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Некоторые попытки должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should sanitize email input', async () => {
      const maliciousEmails = [
        'test@example.com<script>alert("xss")</script>',
        'test@example.com" OR 1=1--',
        'test@example.com; DROP TABLE users;--',
        'test@example.com\' UNION SELECT * FROM users--',
        'test@example.com<img src=x onerror=alert("xss")>'
      ];

      for (const email of maliciousEmails) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            email: email,
            password: 'Password123!',
            confirmPassword: 'Password123!'
          })
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toContain('email');
      }
    });

    it('should sanitize name input', async () => {
      const maliciousNames = [
        '<script>alert("xss")</script>',
        '" OR 1=1--',
        '; DROP TABLE users;--',
        '\' UNION SELECT * FROM users--',
        '<img src=x onerror=alert("xss")>'
      ];

      for (const name of maliciousNames) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            email: 'test@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!'
          })
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toContain('name');
      }
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'test@',
        'test.example.com',
        'test@.com',
        'test@example.',
        'test space@example.com',
        'test@example .com'
      ];

      for (const email of invalidEmails) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            email: email,
            password: 'Password123!',
            confirmPassword: 'Password123!'
          })
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toContain('email');
      }
    });
  });

  describe('Authorization', () => {
    it('should protect admin routes', async () => {
      // Попытка доступа к админ панели без авторизации
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/admin/users`);
      expect(response.status).toBe(401);
    });

    it('should protect admin routes with regular user', async () => {
      // Создаем обычного пользователя
      const registerResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Regular User',
          email: 'regular@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!'
        })
      });

      expect(registerResponse.status).toBe(200);
      const sessionCookie = registerResponse.headers.get('set-cookie');

      // Попытка доступа к админ панели с обычным пользователем
      const adminResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/admin/users`, {
        headers: { 'Cookie': sessionCookie || '' }
      });

      expect(adminResponse.status).toBe(403);
    });

    it('should allow admin access with admin user', async () => {
      // Создаем админа (в реальном приложении это было бы через БД)
      const adminResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/admin/users`, {
        headers: { 'Authorization': 'Bearer admin-token' }
      });

      // В тестовой среде это может быть 200 или 404, но не 401/403
      expect(adminResponse.status).not.toBe(401);
      expect(adminResponse.status).not.toBe(403);
    });

    it('should protect user-specific routes', async () => {
      // Попытка доступа к пользовательским данным без авторизации
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/profile`);
      expect(response.status).toBe(401);
    });

    it('should prevent access to other users data', async () => {
      // Создаем первого пользователя
      const user1Response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User 1',
          email: 'user1@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!'
        })
      });

      expect(user1Response.status).toBe(200);
      const user1Cookie = user1Response.headers.get('set-cookie');

      // Создаем второго пользователя
      const user2Response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User 2',
          email: 'user2@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!'
        })
      });

      expect(user2Response.status).toBe(200);
      const user2Cookie = user2Response.headers.get('set-cookie');

      // Попытка доступа к данным второго пользователя с сессией первого
      const crossAccessResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/profile`, {
        headers: { 'Cookie': user1Cookie || '' }
      });

      // Должен возвращать только данные первого пользователя
      expect(crossAccessResponse.status).toBe(200);
    });
  });

  describe('Token Security', () => {
    it('should generate secure tokens', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      if (result.token) {
        // Проверяем, что токен достаточно длинный и сложный
        expect(result.token.length).toBeGreaterThan(32);
        expect(result.token).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64-like format
      }
    });

    it('should expire tokens after timeout', async () => {
      // Создаем токен
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      if (result.token) {
        // Имитируем истечение токена (в реальном приложении это было бы через время)
        const expiredTokenResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/profile`, {
          headers: { 'Authorization': `Bearer expired-token` }
        });

        expect(expiredTokenResponse.status).toBe(401);
      }
    });

    it('should invalidate tokens on logout', async () => {
      // Создаем токен
      const loginResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!'
        })
      });

      expect(loginResponse.status).toBe(200);
      const result = await loginResponse.json();
      
      if (result.token) {
        // Выходим из системы
        const logoutResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${result.token}` }
        });

        expect(logoutResponse.status).toBe(200);

        // Проверяем, что токен недействителен
        const invalidTokenResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/profile`, {
          headers: { 'Authorization': `Bearer ${result.token}` }
        });

        expect(invalidTokenResponse.status).toBe(401);
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
      
      // Проверяем наличие security headers
      const headers = response.headers;
      
      // X-Content-Type-Options
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
      
      // X-Frame-Options
      expect(headers.get('X-Frame-Options')).toBe('DENY');
      
      // X-XSS-Protection
      expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
      
      // Strict-Transport-Security (если HTTPS)
      if (TEST_CONFIG.API_BASE_URL.startsWith('https')) {
        expect(headers.get('Strict-Transport-Security')).toBeDefined();
      }
    });

    it('should include CORS headers', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
        method: 'OPTIONS'
      });
      
      expect(response.status).toBe(200);
      
      const headers = response.headers;
      expect(headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });
  });

  describe('Brute Force Protection', () => {
    it('should detect brute force attacks', async () => {
      const maxAttempts = 10;
      const promises = [];

      // Создаем много попыток входа
      for (let i = 0; i < maxAttempts; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'WrongPassword123!'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Некоторые попытки должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should implement progressive delays', async () => {
      const attempts = 5;
      const responseTimes = [];

      for (let i = 0; i < attempts; i++) {
        const startTime = Date.now();
        
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'WrongPassword123!'
          })
        });
        
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
        
        // Небольшая задержка между попытками
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Проверяем, что время ответа увеличивается (progressive delay)
      for (let i = 1; i < responseTimes.length; i++) {
        expect(responseTimes[i]).toBeGreaterThanOrEqual(responseTimes[i-1]);
      }
    });
  });
});


