import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('Component Integration - Final Production Check', () => {
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

  describe('Frontend-Backend Integration', () => {
    it('should serve static files correctly', async () => {
      const staticFiles = [
        '/',
        '/favicon.ico',
        '/manifest.json'
      ];

      for (const file of staticFiles) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${file}`);
        expect(response.status).toBe(200);
      }
    });

    it('should handle client-side routing', async () => {
      const clientRoutes = [
        '/',
        '/auth',
        '/dashboard',
        '/search',
        '/requests',
        '/profile',
        '/settings'
      ];

      for (const route of clientRoutes) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${route}`);
        expect(response.status).toBe(200);
      }
    });

    it('should provide API endpoints for frontend', async () => {
      const apiEndpoints = [
        '/api/health',
        '/api/status',
        '/api/csrf-token',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/logout',
        '/api/requests',
        '/api/supplier-search',
        '/api/analyze',
        '/api/user/profile'
      ];

      for (const endpoint of apiEndpoints) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${endpoint}`);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(500);
      }
    });
  });

  describe('Database Integration', () => {
    it('should handle database migrations', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.database).toBe('connected');
    });

    it('should handle database transactions', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          title: 'Transaction Test',
          description: 'Testing database transactions',
          requirements: ['quality']
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.id).toBeDefined();
    });

    it('should handle database connection pooling', async () => {
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

    it('should handle database queries efficiently', async () => {
      const queryTests = [
        { endpoint: '/api/requests', description: 'Simple SELECT' },
        { endpoint: '/api/supplier-search', description: 'Complex JOIN', method: 'POST', body: { query: 'test' } },
        { endpoint: '/api/analyze', description: 'INSERT/UPDATE', method: 'POST', body: { text: 'test', type: 'requirements' } }
      ];

      for (const test of queryTests) {
        const startTime = Date.now();
        
        const requestOptions: RequestInit = {
          method: test.method || 'GET',
          headers: { 'Content-Type': 'application/json' }
        };

        if (test.body) {
          requestOptions.body = JSON.stringify(test.body);
        }

        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${test.endpoint}`, requestOptions);
        const endTime = Date.now();
        const queryTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(queryTime).toBeLessThan(3000); // < 3 секунды
      }
    });
  });

  describe('Authentication Integration', () => {
    it('should integrate with session management', async () => {
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
      expect(cookies).toContain('session=');
    });

    it('should integrate with CSRF protection', async () => {
      // Получаем CSRF токен
      const csrfResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/csrf-token`, {
        headers: { 'Cookie': sessionCookie }
      });

      expect(csrfResponse.status).toBe(200);
      const csrfResult = await csrfResponse.json();
      const csrfToken = csrfResult.csrfToken;

      // Используем CSRF токен
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          title: 'CSRF Test',
          description: 'Testing CSRF integration'
        })
      });

      expect(response.status).toBe(200);
    });

    it('should integrate with authorization', async () => {
      const protectedRoutes = [
        '/api/requests',
        '/api/user/profile',
        '/api/dashboard'
      ];

      for (const route of protectedRoutes) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${route}`, {
          headers: { 'Cookie': sessionCookie }
        });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Email Integration', () => {
    it('should handle email configuration', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/email-config`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          emailAccount: 'test@example.com',
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          imapHost: 'imap.example.com',
          imapPort: 993
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it('should handle email sending', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          to: 'recipient@example.com',
          subject: 'Test Email',
          body: 'Test email content'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it('should handle email templates', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/email-templates`, {
        headers: { 'Cookie': sessionCookie }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.templates).toBeDefined();
    });
  });

  describe('AI Integration', () => {
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

    it('should handle parameter extraction', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/extract-parameters`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          responseId: 1,
          parameters: ['price', 'delivery', 'quality'],
          useAI: true
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.extractedParameters).toBeDefined();
    });

    it('should handle semantic analysis', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/semantic/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          projectId: 1,
          content: 'Electronics manufacturing with ISO 9001 certification',
          blockTitle: 'Technical Specifications'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.semanticEssence).toBeDefined();
    });
  });

  describe('External API Integration', () => {
    it('should handle Yandex search', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
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
    });

    it('should handle Google search', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/google-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({
          query: 'electronics supplier',
          maxResults: 10,
          regions: ['us']
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.results).toBeDefined();
    });

    it('should handle unified search', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/universal-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({
          query: 'electronics manufacturer',
          sources: ['yandex', 'google'],
          maxResults: 20
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.results).toBeDefined();
    });
  });

  describe('Caching Integration', () => {
    it('should handle search result caching', async () => {
      const searchQuery = 'electronics manufacturer';
      
      // Первый поиск
      const firstResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({
          query: searchQuery,
          maxResults: 10
        })
      });

      expect(firstResponse.status).toBe(200);
      const firstResult = await firstResponse.json();

      // Второй поиск (должен использовать кэш)
      const secondResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({
          query: searchQuery,
          maxResults: 10
        })
      });

      expect(secondResponse.status).toBe(200);
      const secondResult = await secondResponse.json();

      // Результаты должны быть одинаковыми
      expect(secondResult.results).toEqual(firstResult.results);
    });

    it('should handle cache invalidation', async () => {
      // Очищаем кэш
      const clearResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/cache/clear`, {
        method: 'POST',
        headers: { 'Cookie': sessionCookie }
      });

      expect(clearResponse.status).toBe(200);

      // Проверяем, что кэш очищен
      const searchResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({
          query: 'test query',
          maxResults: 10
        })
      });

      expect(searchResponse.status).toBe(200);
    });
  });

  describe('File Upload Integration', () => {
    it('should handle file uploads', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt');

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Cookie': sessionCookie },
        body: formData
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.fileId).toBeDefined();
    });

    it('should handle file validation', async () => {
      const maliciousFile = new FormData();
      maliciousFile.append('file', new Blob(['<script>alert("xss")</script>'], { type: 'text/html' }), 'malicious.html');

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Cookie': sessionCookie },
        body: maliciousFile
      });

      expect(response.status).toBe(400);
    });

    it('should handle file processing', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/process-file`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'valid-token'
        },
        body: JSON.stringify({
          fileId: 1,
          processType: 'text-extraction'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.processedContent).toBeDefined();
    });
  });

  describe('WebSocket Integration', () => {
    it('should handle WebSocket connections', async () => {
      // В реальном приложении здесь был бы тест WebSocket соединения
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/websocket-status`);
      expect(response.status).toBe(200);
    });

    it('should handle real-time notifications', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/notifications`, {
        headers: { 'Cookie': sessionCookie }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.notifications).toBeDefined();
    });
  });

  describe('Admin Integration', () => {
    it('should handle admin user management', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.users).toBeDefined();
    });

    it('should handle admin supplier management', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/admin/suppliers`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.suppliers).toBeDefined();
    });

    it('should handle admin analytics', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/admin/analytics`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.metrics).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
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

      expect(successRate).toBeGreaterThanOrEqual(95);
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
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
      const memoryUsedMB = memoryUsed / 1024 / 1024;

      expect(memoryUsedMB).toBeLessThan(100); // < 100MB
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
});


