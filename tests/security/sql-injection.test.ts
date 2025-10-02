import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('SQL Injection Protection Tests', () => {
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

  describe('Authentication SQL Injection', () => {
    it('should prevent SQL injection in login email', async () => {
      const sqlInjectionPayloads = [
        "admin@example.com' OR '1'='1",
        "admin@example.com' OR 1=1--",
        "admin@example.com'; DROP TABLE users;--",
        "admin@example.com' UNION SELECT * FROM users--",
        "admin@example.com' OR '1'='1' AND '1'='1",
        "admin@example.com' OR 1=1 LIMIT 1--",
        "admin@example.com' OR '1'='1' LIMIT 1 OFFSET 0--",
        "admin@example.com' OR EXISTS(SELECT * FROM users)--",
        "admin@example.com' OR '1'='1' AND password LIKE '%'--",
        "admin@example.com' OR '1'='1' AND role='admin'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: payload,
            password: 'anypassword'
          })
        });

        // Должен отклонять попытки SQL injection
        expect(response.status).toBe(401);
        const result = await response.json();
        expect(result.error).toContain('credentials');
      }
    });

    it('should prevent SQL injection in login password', async () => {
      const sqlInjectionPayloads = [
        "password' OR '1'='1",
        "password' OR 1=1--",
        "password'; DROP TABLE users;--",
        "password' UNION SELECT * FROM users--",
        "password' OR '1'='1' AND '1'='1",
        "password' OR 1=1 LIMIT 1--",
        "password' OR '1'='1' LIMIT 1 OFFSET 0--",
        "password' OR EXISTS(SELECT * FROM users)--",
        "password' OR '1'='1' AND username LIKE '%'--",
        "password' OR '1'='1' AND role='admin'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: payload
          })
        });

        // Должен отклонять попытки SQL injection
        expect(response.status).toBe(401);
        const result = await response.json();
        expect(result.error).toContain('credentials');
      }
    });

    it('should prevent SQL injection in registration', async () => {
      const sqlInjectionPayloads = [
        {
          name: "'; DROP TABLE users;--",
          email: "test@example.com",
          password: "Password123!",
          confirmPassword: "Password123!"
        },
        {
          name: "Test User",
          email: "test@example.com'; DROP TABLE users;--",
          password: "Password123!",
          confirmPassword: "Password123!"
        },
        {
          name: "Test User",
          email: "test@example.com",
          password: "Password123!'; DROP TABLE users;--",
          confirmPassword: "Password123!'; DROP TABLE users;--"
        }
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // Должен отклонять попытки SQL injection
        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Search SQL Injection', () => {
    it('should prevent SQL injection in search queries', async () => {
      const sqlInjectionPayloads = [
        "electronics'; DROP TABLE suppliers;--",
        "electronics' OR '1'='1",
        "electronics' UNION SELECT * FROM users--",
        "electronics' OR 1=1--",
        "electronics'; INSERT INTO suppliers (name) VALUES ('hacked');--",
        "electronics' OR EXISTS(SELECT * FROM users)--",
        "electronics' OR '1'='1' AND '1'='1",
        "electronics' OR 1=1 LIMIT 1--",
        "electronics' OR '1'='1' LIMIT 1 OFFSET 0--",
        "electronics' OR '1'='1' AND name LIKE '%'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          body: JSON.stringify({
            query: payload,
            maxResults: 10
          })
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        
        // Проверяем, что результат не содержит данных из других таблиц
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }
    });

    it('should prevent SQL injection in filter parameters', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE suppliers;--",
        "' OR '1'='1",
        "' UNION SELECT * FROM users--",
        "' OR 1=1--",
        "'; INSERT INTO suppliers (name) VALUES ('hacked');--",
        "' OR EXISTS(SELECT * FROM users)--",
        "' OR '1'='1' AND '1'='1",
        "' OR 1=1 LIMIT 1--",
        "' OR '1'='1' LIMIT 1 OFFSET 0--",
        "' OR '1'='1' AND name LIKE '%'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          body: JSON.stringify({
            query: 'electronics',
            category: payload,
            region: 'ru',
            maxResults: 10
          })
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.results).toBeDefined();
      }
    });

    it('should prevent SQL injection in pagination parameters', async () => {
      const sqlInjectionPayloads = [
        "1; DROP TABLE suppliers;--",
        "1' OR '1'='1",
        "1' UNION SELECT * FROM users--",
        "1' OR 1=1--",
        "1'; INSERT INTO suppliers (name) VALUES ('hacked');--",
        "1' OR EXISTS(SELECT * FROM users)--",
        "1' OR '1'='1' AND '1'='1",
        "1' OR 1=1 LIMIT 1--",
        "1' OR '1'='1' LIMIT 1 OFFSET 0--",
        "1' OR '1'='1' AND name LIKE '%'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          body: JSON.stringify({
            query: 'electronics',
            page: payload,
            pageSize: 10,
            maxResults: 10
          })
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.results).toBeDefined();
      }
    });
  });

  describe('Request Management SQL Injection', () => {
    it('should prevent SQL injection in request creation', async () => {
      const sqlInjectionPayloads = [
        {
          title: "'; DROP TABLE requests;--",
          description: "Test Description",
          requirements: ["quality"]
        },
        {
          title: "Test Request",
          description: "'; DROP TABLE requests;--",
          requirements: ["quality"]
        },
        {
          title: "Test Request",
          description: "Test Description",
          requirements: ["'; DROP TABLE requests;--"]
        }
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: JSON.stringify(payload)
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.id).toBeDefined();
      }
    });

    it('should prevent SQL injection in request updates', async () => {
      const sqlInjectionPayloads = [
        {
          title: "'; DROP TABLE requests;--",
          description: "Updated Description"
        },
        {
          title: "Updated Request",
          description: "'; DROP TABLE requests;--"
        },
        {
          title: "Updated Request",
          description: "Updated Description",
          requirements: ["'; DROP TABLE requests;--"]
        }
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests/1`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: JSON.stringify(payload)
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
      }
    });

    it('should prevent SQL injection in request deletion', async () => {
      const sqlInjectionPayloads = [
        "1; DROP TABLE requests;--",
        "1' OR '1'='1",
        "1' UNION SELECT * FROM users--",
        "1' OR 1=1--",
        "1'; INSERT INTO requests (title) VALUES ('hacked');--",
        "1' OR EXISTS(SELECT * FROM users)--",
        "1' OR '1'='1' AND '1'='1",
        "1' OR 1=1 LIMIT 1--",
        "1' OR '1'='1' LIMIT 1 OFFSET 0--",
        "1' OR '1'='1' AND title LIKE '%'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests/${payload}`, {
          method: 'DELETE',
          headers: { 
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          }
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(404); // ID не найден, но не SQL injection
      }
    });
  });

  describe('User Profile SQL Injection', () => {
    it('should prevent SQL injection in profile updates', async () => {
      const sqlInjectionPayloads = [
        {
          name: "'; DROP TABLE users;--",
          businessCard: "Test Business Card"
        },
        {
          name: "Updated Name",
          businessCard: "'; DROP TABLE users;--"
        },
        {
          name: "Updated Name",
          businessCard: "Test Business Card",
          language: "'; DROP TABLE users;--"
        }
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/profile`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: JSON.stringify(payload)
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
      }
    });

    it('should prevent SQL injection in email configuration', async () => {
      const sqlInjectionPayloads = [
        {
          emailAccount: "'; DROP TABLE users;--",
          smtpHost: "smtp.example.com"
        },
        {
          emailAccount: "test@example.com",
          smtpHost: "'; DROP TABLE users;--"
        },
        {
          emailAccount: "test@example.com",
          smtpHost: "smtp.example.com",
          smtpPort: "'; DROP TABLE users;--"
        }
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/email-config`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: JSON.stringify(payload)
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Analysis SQL Injection', () => {
    it('should prevent SQL injection in analysis requests', async () => {
      const sqlInjectionPayloads = [
        {
          text: "'; DROP TABLE analysis;--",
          type: "requirements"
        },
        {
          text: "Test Analysis",
          type: "'; DROP TABLE analysis;--"
        },
        {
          text: "'; DROP TABLE analysis;--",
          type: "requirements",
          projectId: "1; DROP TABLE projects;--"
        }
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: JSON.stringify(payload)
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.analysis).toBeDefined();
      }
    });

    it('should prevent SQL injection in parameter extraction', async () => {
      const sqlInjectionPayloads = [
        {
          responseId: "1; DROP TABLE responses;--",
          parameters: ["price", "delivery"]
        },
        {
          responseId: 1,
          parameters: ["'; DROP TABLE responses;--"]
        },
        {
          responseId: "1' OR '1'='1",
          parameters: ["price", "delivery"]
        }
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/extract-parameters`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: JSON.stringify(payload)
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.extractedParameters).toBeDefined();
      }
    });
  });

  describe('Admin SQL Injection', () => {
    it('should prevent SQL injection in admin user management', async () => {
      const sqlInjectionPayloads = [
        "1; DROP TABLE users;--",
        "1' OR '1'='1",
        "1' UNION SELECT * FROM users--",
        "1' OR 1=1--",
        "1'; INSERT INTO users (username) VALUES ('hacked');--",
        "1' OR EXISTS(SELECT * FROM users)--",
        "1' OR '1'='1' AND '1'='1",
        "1' OR 1=1 LIMIT 1--",
        "1' OR '1'='1' LIMIT 1 OFFSET 0--",
        "1' OR '1'='1' AND username LIKE '%'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/admin/users/${payload}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(404); // Пользователь не найден, но не SQL injection
      }
    });

    it('should prevent SQL injection in admin supplier management', async () => {
      const sqlInjectionPayloads = [
        "1; DROP TABLE suppliers;--",
        "1' OR '1'='1",
        "1' UNION SELECT * FROM suppliers--",
        "1' OR 1=1--",
        "1'; INSERT INTO suppliers (name) VALUES ('hacked');--",
        "1' OR EXISTS(SELECT * FROM suppliers)--",
        "1' OR '1'='1' AND '1'='1",
        "1' OR 1=1 LIMIT 1--",
        "1' OR '1'='1' LIMIT 1 OFFSET 0--",
        "1' OR '1'='1' AND name LIKE '%'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/admin/suppliers/${payload}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(404); // Поставщик не найден, но не SQL injection
      }
    });
  });

  describe('URL Parameter SQL Injection', () => {
    it('should prevent SQL injection in URL parameters', async () => {
      const sqlInjectionPayloads = [
        "?id=1; DROP TABLE requests;--",
        "?id=1' OR '1'='1",
        "?id=1' UNION SELECT * FROM users--",
        "?id=1' OR 1=1--",
        "?id=1'; INSERT INTO requests (title) VALUES ('hacked');--",
        "?id=1' OR EXISTS(SELECT * FROM users)--",
        "?id=1' OR '1'='1' AND '1'='1",
        "?id=1' OR 1=1 LIMIT 1--",
        "?id=1' OR '1'='1' LIMIT 1 OFFSET 0--",
        "?id=1' OR '1'='1' AND title LIKE '%'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests${payload}`, {
          headers: { 'Cookie': sessionCookie }
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(404); // ID не найден, но не SQL injection
      }
    });

    it('should prevent SQL injection in query parameters', async () => {
      const sqlInjectionPayloads = [
        "?q=electronics'; DROP TABLE suppliers;--",
        "?q=electronics' OR '1'='1",
        "?q=electronics' UNION SELECT * FROM users--",
        "?q=electronics' OR 1=1--",
        "?q=electronics'; INSERT INTO suppliers (name) VALUES ('hacked');--",
        "?q=electronics' OR EXISTS(SELECT * FROM users)--",
        "?q=electronics' OR '1'='1' AND '1'='1",
        "?q=electronics' OR 1=1 LIMIT 1--",
        "?q=electronics' OR '1'='1' LIMIT 1 OFFSET 0--",
        "?q=electronics' OR '1'='1' AND name LIKE '%'--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search${payload}`, {
          headers: { 'Cookie': sessionCookie }
        });

        // Должен обрабатывать запрос безопасно
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.results).toBeDefined();
      }
    });
  });

  describe('Blind SQL Injection', () => {
    it('should prevent blind SQL injection attacks', async () => {
      const blindSqlPayloads = [
        "'; WAITFOR DELAY '00:00:05'--",
        "' OR SLEEP(5)--",
        "'; SELECT pg_sleep(5)--",
        "' OR (SELECT COUNT(*) FROM users) > 0--",
        "'; IF (SELECT COUNT(*) FROM users) > 0 WAITFOR DELAY '00:00:05'--",
        "' OR (SELECT COUNT(*) FROM users) = 1--",
        "'; IF (SELECT COUNT(*) FROM users) = 1 WAITFOR DELAY '00:00:05'--"
      ];

      for (const payload of blindSqlPayloads) {
        const startTime = Date.now();
        
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          body: JSON.stringify({
            query: payload,
            maxResults: 10
          })
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Должен обрабатывать запрос быстро (без задержек)
        expect(responseTime).toBeLessThan(2000); // < 2 секунды
        expect(response.status).toBe(200);
      }
    });

    it('should prevent time-based blind SQL injection', async () => {
      const timeBasedPayloads = [
        "'; WAITFOR DELAY '00:00:10'--",
        "' OR SLEEP(10)--",
        "'; SELECT pg_sleep(10)--",
        "'; IF (SELECT COUNT(*) FROM users) > 0 WAITFOR DELAY '00:00:10'--",
        "' OR (SELECT COUNT(*) FROM users) > 0 AND SLEEP(10)--"
      ];

      for (const payload of timeBasedPayloads) {
        const startTime = Date.now();
        
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: payload,
            password: 'anypassword'
          })
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Должен обрабатывать запрос быстро (без задержек)
        expect(responseTime).toBeLessThan(2000); // < 2 секунды
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Error-based SQL Injection', () => {
    it('should prevent error-based SQL injection', async () => {
      const errorBasedPayloads = [
        "'; SELECT * FROM users WHERE 1=1--",
        "' OR 1=1 AND (SELECT * FROM users)--",
        "'; SELECT * FROM users WHERE id=1--",
        "' OR 1=1 AND (SELECT COUNT(*) FROM users)--",
        "'; SELECT * FROM users WHERE username='admin'--",
        "' OR 1=1 AND (SELECT username FROM users LIMIT 1)--",
        "'; SELECT * FROM users WHERE role='admin'--",
        "' OR 1=1 AND (SELECT role FROM users LIMIT 1)--"
      ];

      for (const payload of errorBasedPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          body: JSON.stringify({
            query: payload,
            maxResults: 10
          })
        });

        // Должен обрабатывать запрос без ошибок
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }
    });
  });
});


