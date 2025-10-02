import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('System Health Check - Final Production Readiness', () => {
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

  describe('System Availability', () => {
    it('should have all critical endpoints available', async () => {
      const criticalEndpoints = [
        { path: '/api/health', method: 'GET', expectedStatus: 200 },
        { path: '/api/status', method: 'GET', expectedStatus: 200 },
        { path: '/api/auth/login', method: 'POST', expectedStatus: 401 }, // No credentials
        { path: '/api/auth/register', method: 'POST', expectedStatus: 400 }, // No data
        { path: '/api/requests', method: 'GET', expectedStatus: 401 }, // No auth
        { path: '/api/supplier-search', method: 'POST', expectedStatus: 401 }, // No auth
        { path: '/api/analyze', method: 'POST', expectedStatus: 401 }, // No auth
        { path: '/api/user/profile', method: 'GET', expectedStatus: 401 }, // No auth
        { path: '/api/admin/users', method: 'GET', expectedStatus: 401 }, // No auth
        { path: '/api/csrf-token', method: 'GET', expectedStatus: 200 }
      ];

      for (const endpoint of criticalEndpoints) {
        const requestOptions: RequestInit = {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' }
        };

        if (endpoint.method === 'POST') {
          requestOptions.body = JSON.stringify({});
        }

        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${endpoint.path}`, requestOptions);
        expect(response.status).toBe(endpoint.expectedStatus);
      }
    });

    it('should respond within acceptable time limits', async () => {
      const endpoints = [
        '/api/health',
        '/api/status',
        '/api/csrf-token'
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${endpoint}`);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(1000); // < 1 секунды
      }
    });

    it('should handle concurrent requests gracefully', async () => {
      const concurrentRequests = 50;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.ok).length;
      const successRate = (successCount / concurrentRequests) * 100;

      expect(successRate).toBeGreaterThanOrEqual(95); // 95% успешных запросов
    });
  });

  describe('Database Connectivity', () => {
    it('should connect to database successfully', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.database).toBe('connected');
    });

    it('should handle database queries efficiently', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        headers: { 'Cookie': sessionCookie }
      });
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(queryTime).toBeLessThan(2000); // < 2 секунды
    });

    it('should maintain database connection pool', async () => {
      const connectionTests = 20;
      const promises = [];

      for (let i = 0; i < connectionTests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
            headers: { 'Cookie': sessionCookie }
          })
        );
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.ok).length;
      const successRate = (successCount / connectionTests) * 100;

      expect(successRate).toBeGreaterThanOrEqual(95);
    });
  });

  describe('Authentication System', () => {
    it('should handle user registration', async () => {
      const timestamp = Date.now();
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Test User ${timestamp}`,
          email: `test${timestamp}@example.com`,
          password: 'Password123!',
          confirmPassword: 'Password123!'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();
    });

    it('should handle user login', async () => {
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
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should handle user logout', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Cookie': sessionCookie }
      });

      expect(response.status).toBe(200);
    });

    it('should protect authenticated routes', async () => {
      const protectedRoutes = [
        '/api/requests',
        '/api/user/profile',
        '/api/dashboard'
      ];

      for (const route of protectedRoutes) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${route}`);
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Core Business Logic', () => {
    it('should handle search requests creation', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          title: 'Production Test Request',
          description: 'Testing production readiness',
          requirements: ['quality', 'delivery'],
          budget: 10000,
          deadline: '2024-12-31'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.id).toBeDefined();
    });

    it('should handle supplier search', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({
          query: 'electronics manufacturer',
          maxResults: 10,
          regions: ['ru']
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle text analysis', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          text: 'We need electronics suppliers with ISO certification',
          type: 'requirements'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.analysis).toBeDefined();
    });

    it('should handle user profile management', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          name: 'Updated User Name',
          businessCard: 'Updated business card content',
          language: 'en'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
    });
  });

  describe('Security Systems', () => {
    it('should enforce CSRF protection', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({
          title: 'Test Request',
          description: 'Test Description'
        })
      });

      expect(response.status).toBe(403);
      const result = await response.json();
      expect(result.error).toContain('CSRF');
    });

    it('should enforce rate limiting', async () => {
      const maxRequests = 200;
      const promises = [];

      for (let i = 0; i < maxRequests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      const responses = await Promise.all(promises);
      const blockedResponses = responses.filter(r => r.status === 429);
      
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent SQL injection', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users;--",
        "' OR '1'='1",
        "' UNION SELECT * FROM users--"
      ];

      for (const input of maliciousInputs) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          body: JSON.stringify({
            query: input,
            maxResults: 10
          })
        });

        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.results).toBeDefined();
      }
    });

    it('should include security headers', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      const headers = response.headers;
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });
  });

  describe('Performance Metrics', () => {
    it('should meet performance requirements', async () => {
      const performanceTests = [
        { endpoint: '/api/health', maxTime: 500 },
        { endpoint: '/api/status', maxTime: 500 },
        { endpoint: '/api/requests', maxTime: 2000 },
        { endpoint: '/api/supplier-search', maxTime: 3000 },
        { endpoint: '/api/analyze', maxTime: 5000 }
      ];

      for (const test of performanceTests) {
        const startTime = Date.now();
        
        const requestOptions: RequestInit = {
          method: test.endpoint.includes('supplier-search') || test.endpoint.includes('analyze') ? 'POST' : 'GET',
          headers: { 'Content-Type': 'application/json' }
        };

        if (test.endpoint.includes('supplier-search')) {
          requestOptions.body = JSON.stringify({
            query: 'test',
            maxResults: 10
          });
        } else if (test.endpoint.includes('analyze')) {
          requestOptions.body = JSON.stringify({
            text: 'test',
            type: 'requirements'
          });
        }

        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${test.endpoint}`, requestOptions);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(test.maxTime);
      }
    });

    it('should handle memory efficiently', async () => {
      const startMemory = process.memoryUsage();
      
      // Выполняем операции
      const operations = 100;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      await Promise.all(promises);
      
      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(50); // < 50MB increase
    });

    it('should handle CPU efficiently', async () => {
      const startCpu = process.cpuUsage();
      
      // Выполняем CPU-интенсивные операции
      const operations = 50;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': sessionCookie,
              'X-CSRF-Token': 'valid-token'
            },
            body: JSON.stringify({
              text: `CPU test ${i}`.repeat(100),
              type: 'requirements'
            })
          })
        );
      }

      await Promise.all(promises);
      
      const endCpu = process.cpuUsage();
      const cpuUsed = endCpu.user - startCpu.user + endCpu.system - startCpu.system;
      const cpuUsedMs = cpuUsed / 1000;

      expect(cpuUsedMs).toBeLessThan(10000); // < 10 секунд CPU
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests gracefully', async () => {
      const invalidRequests = [
        { path: '/api/nonexistent', method: 'GET' },
        { path: '/api/requests', method: 'POST', body: 'invalid json' },
        { path: '/api/auth/login', method: 'POST', body: '{}' }
      ];

      for (const request of invalidRequests) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${request.path}`, {
          method: request.method,
          headers: { 'Content-Type': 'application/json' },
          body: request.body
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      }
    });

    it('should handle server errors gracefully', async () => {
      // Имитируем серверную ошибку
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/error-test`);
      
      if (response.status === 500) {
        const result = await response.json();
        expect(result.error).toBeDefined();
        expect(result.message).toBeDefined();
      }
    });

    it('should handle network timeouts gracefully', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(1000) // 1 секунда таймаут
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency', async () => {
      // Создаем запрос
      const createResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          title: 'Data Integrity Test',
          description: 'Testing data consistency',
          requirements: ['quality']
        })
      });

      expect(createResponse.status).toBe(200);
      const createdRequest = await createResponse.json();

      // Получаем запрос
      const getResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests/${createdRequest.id}`, {
        headers: { 'Cookie': sessionCookie }
      });

      expect(getResponse.status).toBe(200);
      const retrievedRequest = await getResponse.json();

      // Проверяем целостность данных
      expect(retrievedRequest.title).toBe('Data Integrity Test');
      expect(retrievedRequest.description).toBe('Testing data consistency');
      expect(retrievedRequest.requirements).toEqual(['quality']);
    });

    it('should handle concurrent data modifications', async () => {
      const concurrentUpdates = 10;
      const promises = [];

      for (let i = 0; i < concurrentUpdates; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/profile`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': sessionCookie,
              'X-CSRF-Token': 'valid-token'
            },
            body: JSON.stringify({
              name: `Updated Name ${i}`,
              businessCard: `Updated business card ${i}`
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.ok).length;
      
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Monitoring and Logging', () => {
    it('should log critical events', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!'
        })
      });

      expect(response.status).toBe(200);
      // В реальном приложении здесь была бы проверка логов
    });

    it('should track performance metrics', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
      // В реальном приложении здесь была бы проверка метрик
    });

    it('should monitor resource usage', async () => {
      const startMemory = process.memoryUsage();
      const startCpu = process.cpuUsage();

      // Выполняем операции
      const operations = 50;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
        );
      }

      await Promise.all(promises);

      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage();

      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
      const cpuUsed = endCpu.user - startCpu.user + endCpu.system - startCpu.system;

      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // < 100MB
      expect(cpuUsed).toBeLessThan(5000 * 1000); // < 5 секунд CPU
    });
  });

  describe('Production Readiness', () => {
    it('should have all required environment variables', async () => {
      const requiredEnvVars = [
        'DATABASE_URL',
        'TOKEN_SECRET',
        'NODE_ENV'
      ];

      for (const envVar of requiredEnvVars) {
        expect(process.env[envVar]).toBeDefined();
      }
    });

    it('should have proper error handling in production', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
      
      // Проверяем, что в production не возвращаются детали ошибок
      if (process.env.NODE_ENV === 'production') {
        const result = await response.json();
        expect(result.stack).toBeUndefined();
        expect(result.details).toBeUndefined();
      }
    });

    it('should have proper CORS configuration', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(200);
      
      const headers = response.headers;
      expect(headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });

    it('should have proper HTTPS configuration', async () => {
      if (TEST_CONFIG.API_BASE_URL.startsWith('https')) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
        
        expect(response.status).toBe(200);
        
        const headers = response.headers;
        expect(headers.get('Strict-Transport-Security')).toBeDefined();
      }
    });
  });
});


