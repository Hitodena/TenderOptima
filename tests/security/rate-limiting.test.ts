import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('Rate Limiting Security Tests', () => {
  let testServer: any;
  let authToken: string;
  let sessionCookie: string;

  beforeAll(async () => {
    await setupTestEnvironment();
    testServer = await TestHelpers.createTestServer();
    
    // Создаем авторизованную сессию
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    sessionCookie = `session=${session.sessionId}`;
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    if (testServer) {
      await testServer.close();
    }
  });

  describe('Authentication Rate Limiting', () => {
    it('should limit login attempts per IP', async () => {
      const maxAttempts = 5;
      const promises = [];

      // Создаем много попыток входа с одного IP
      for (let i = 0; i < maxAttempts + 3; i++) {
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
      
      // Проверяем заголовки rate limiting
      const rateLimitHeaders = blockedResponses[0]?.headers;
      if (rateLimitHeaders) {
        expect(rateLimitHeaders.get('X-RateLimit-Limit')).toBeDefined();
        expect(rateLimitHeaders.get('X-RateLimit-Remaining')).toBeDefined();
        expect(rateLimitHeaders.get('X-RateLimit-Reset')).toBeDefined();
      }
    });

    it('should limit registration attempts per IP', async () => {
      const maxAttempts = 3;
      const promises = [];

      // Создаем много попыток регистрации с одного IP
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

    it('should limit password reset attempts per IP', async () => {
      const maxAttempts = 3;
      const promises = [];

      // Создаем много попыток сброса пароля с одного IP
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

    it('should implement progressive delays for failed attempts', async () => {
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

  describe('API Rate Limiting', () => {
    it('should limit API requests per user', async () => {
      const maxRequests = 100;
      const promises = [];

      // Создаем много API запросов от одного пользователя
      for (let i = 0; i < maxRequests + 10; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
            headers: { 'Cookie': sessionCookie }
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Некоторые запросы должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should limit search requests per user', async () => {
      const maxRequests = 50;
      const promises = [];

      // Создаем много поисковых запросов от одного пользователя
      for (let i = 0; i < maxRequests + 5; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': sessionCookie
            },
            body: JSON.stringify({
              query: `search ${i}`,
              maxResults: 10
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Некоторые запросы должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should limit analysis requests per user', async () => {
      const maxRequests = 20;
      const promises = [];

      // Создаем много запросов анализа от одного пользователя
      for (let i = 0; i < maxRequests + 3; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': sessionCookie,
              'X-CSRF-Token': 'valid-token'
            },
            body: JSON.stringify({
              text: `Analysis request ${i}`,
              type: 'requirements'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Некоторые запросы должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should limit email sending per user', async () => {
      const maxRequests = 10;
      const promises = [];

      // Создаем много запросов отправки email от одного пользователя
      for (let i = 0; i < maxRequests + 2; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': sessionCookie,
              'X-CSRF-Token': 'valid-token'
            },
            body: JSON.stringify({
              to: `recipient${i}@example.com`,
              subject: `Test Email ${i}`,
              body: `Test email content ${i}`
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Некоторые запросы должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('IP-based Rate Limiting', () => {
    it('should limit requests per IP address', async () => {
      const maxRequests = 200;
      const promises = [];

      // Создаем много запросов с одного IP
      for (let i = 0; i < maxRequests + 20; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      const responses = await Promise.all(promises);
      
      // Некоторые запросы должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should implement sliding window rate limiting', async () => {
      const windowSize = 60000; // 1 минута
      const maxRequests = 100;
      const requests = [];

      // Создаем запросы в течение окна
      for (let i = 0; i < maxRequests + 10; i++) {
        requests.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const responses = await Promise.all(requests);
      
      // Некоторые запросы должны быть заблокированы
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should reset rate limits after window expires', async () => {
      // Сначала исчерпываем лимит
      const maxRequests = 100;
      const promises = [];

      for (let i = 0; i < maxRequests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      await Promise.all(promises);

      // Проверяем, что запросы заблокированы
      const blockedResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(blockedResponse.status).toBe(429);

      // Ждем истечения окна (в реальном приложении это было бы через время)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем, что лимит сброшен
      const resetResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(resetResponse.status).toBe(200);
    });
  });

  describe('Endpoint-specific Rate Limiting', () => {
    it('should have different limits for different endpoints', async () => {
      const endpoints = [
        { path: '/api/health', expectedLimit: 200 },
        { path: '/api/auth/login', expectedLimit: 5 },
        { path: '/api/auth/register', expectedLimit: 3 },
        { path: '/api/supplier-search', expectedLimit: 50 },
        { path: '/api/analyze', expectedLimit: 20 }
      ];

      for (const endpoint of endpoints) {
        const maxRequests = endpoint.expectedLimit + 5;
        const promises = [];

        for (let i = 0; i < maxRequests; i++) {
          const requestOptions: RequestInit = {
            method: endpoint.path.includes('auth') ? 'POST' : 'GET',
            headers: { 'Content-Type': 'application/json' }
          };

          if (endpoint.path.includes('auth')) {
            requestOptions.body = JSON.stringify({
              email: 'test@example.com',
              password: 'Password123!'
            });
          }

          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}${endpoint.path}`, requestOptions)
          );
        }

        const responses = await Promise.all(promises);
        const blockedResponses = responses.filter(r => r.status === 429);
        
        // Проверяем, что лимит работает для каждого endpoint
        expect(blockedResponses.length).toBeGreaterThan(0);
      }
    });

    it('should limit expensive operations more strictly', async () => {
      const expensiveEndpoints = [
        '/api/analyze',
        '/api/supplier-search',
        '/api/send-email',
        '/api/upload'
      ];

      for (const endpoint of expensiveEndpoints) {
        const maxRequests = 10;
        const promises = [];

        for (let i = 0; i < maxRequests + 2; i++) {
          const requestOptions: RequestInit = {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': sessionCookie,
              'X-CSRF-Token': 'valid-token'
            },
            body: JSON.stringify({
              text: `Test ${i}`,
              type: 'requirements'
            })
          };

          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}${endpoint}`, requestOptions)
          );
        }

        const responses = await Promise.all(promises);
        const blockedResponses = responses.filter(r => r.status === 429);
        
        // Дорогие операции должны быть ограничены строже
        expect(blockedResponses.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Rate Limiting Headers', () => {
    it('should include rate limiting headers', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
      
      const headers = response.headers;
      
      // Проверяем наличие rate limiting заголовков
      expect(headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should update remaining count correctly', async () => {
      const responses = [];
      
      // Делаем несколько запросов
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
        responses.push(response);
      }

      // Проверяем, что remaining count уменьшается
      const remainingCounts = responses.map(r => 
        parseInt(r.headers.get('X-RateLimit-Remaining') || '0')
      );

      for (let i = 1; i < remainingCounts.length; i++) {
        expect(remainingCounts[i]).toBeLessThanOrEqual(remainingCounts[i-1]);
      }
    });

    it('should include retry-after header when rate limited', async () => {
      // Исчерпываем лимит
      const maxRequests = 200;
      const promises = [];

      for (let i = 0; i < maxRequests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      await Promise.all(promises);

      // Проверяем, что следующий запрос заблокирован
      const blockedResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(blockedResponse.status).toBe(429);
      
      // Проверяем наличие Retry-After заголовка
      const retryAfter = blockedResponse.headers.get('Retry-After');
      expect(retryAfter).toBeDefined();
      expect(parseInt(retryAfter || '0')).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting Bypass Prevention', () => {
    it('should prevent rate limiting bypass via different headers', async () => {
      const bypassAttempts = [
        { 'X-Forwarded-For': '192.168.1.1' },
        { 'X-Real-IP': '192.168.1.2' },
        { 'X-Client-IP': '192.168.1.3' },
        { 'CF-Connecting-IP': '192.168.1.4' },
        { 'True-Client-IP': '192.168.1.5' }
      ];

      for (const headers of bypassAttempts) {
        const maxRequests = 200;
        const promises = [];

        for (let i = 0; i < maxRequests; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
              headers: headers
            })
          );
        }

        const responses = await Promise.all(promises);
        const blockedResponses = responses.filter(r => r.status === 429);
        
        // Rate limiting должен работать независимо от заголовков
        expect(blockedResponses.length).toBeGreaterThan(0);
      }
    });

    it('should prevent rate limiting bypass via different user agents', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'curl/7.68.0',
        'PostmanRuntime/7.26.8'
      ];

      for (const userAgent of userAgents) {
        const maxRequests = 200;
        const promises = [];

        for (let i = 0; i < maxRequests; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
              headers: { 'User-Agent': userAgent }
            })
          );
        }

        const responses = await Promise.all(promises);
        const blockedResponses = responses.filter(r => r.status === 429);
        
        // Rate limiting должен работать независимо от User-Agent
        expect(blockedResponses.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Rate Limiting Recovery', () => {
    it('should recover from rate limiting gracefully', async () => {
      // Исчерпываем лимит
      const maxRequests = 200;
      const promises = [];

      for (let i = 0; i < maxRequests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      await Promise.all(promises);

      // Проверяем, что запросы заблокированы
      const blockedResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(blockedResponse.status).toBe(429);

      // Ждем восстановления
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем, что система восстановилась
      const recoveryResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(recoveryResponse.status).toBe(200);
    });

    it('should handle rate limiting errors gracefully', async () => {
      // Исчерпываем лимит
      const maxRequests = 200;
      const promises = [];

      for (let i = 0; i < maxRequests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      await Promise.all(promises);

      // Проверяем, что ошибки rate limiting обрабатываются корректно
      const blockedResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(blockedResponse.status).toBe(429);
      
      const result = await blockedResponse.json();
      expect(result.error).toContain('rate limit');
      expect(result.retryAfter).toBeDefined();
    });
  });
});


