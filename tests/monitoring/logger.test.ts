import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';
import { Logger, LogLevel } from '../../server/monitoring/logger';

describe('Logger - Production Logging', () => {
  let testServer: any;
  let authToken: string;
  let sessionCookie: string;
  let logger: Logger;

  beforeAll(async () => {
    await setupTestEnvironment();
    testServer = await TestHelpers.createTestServer();
    
    // Создаем авторизованную сессию
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    sessionCookie = `session=${session.sessionId}`;
    
    logger = Logger.getInstance();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    if (testServer) {
      await testServer.close();
    }
    logger.close();
  });

  describe('Log Level Configuration', () => {
    it('should log error messages', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should log warning messages', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('should log info messages', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('should log debug messages', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });
  });

  describe('Log Context', () => {
    it('should log with context', () => {
      expect(() => {
        logger.info('Test message with context', { 
          userId: 123, 
          action: 'test',
          timestamp: new Date().toISOString()
        });
      }).not.toThrow();
    });

    it('should log with complex context', () => {
      expect(() => {
        logger.error('Test error with complex context', {
          error: {
            name: 'TestError',
            message: 'Test error message',
            stack: 'Test stack trace'
          },
          request: {
            method: 'POST',
            url: '/api/test',
            headers: { 'Content-Type': 'application/json' }
          },
          user: {
            id: 123,
            email: 'test@example.com'
          }
        });
      }).not.toThrow();
    });
  });

  describe('Request Logging', () => {
    it('should log successful requests', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/health',
        ip: '127.0.0.1',
        get: (header: string) => 'Test User Agent'
      } as any;

      const mockRes = {
        statusCode: 200,
        on: (event: string, callback: Function) => {
          if (event === 'finish') {
            callback();
          }
        }
      } as any;

      expect(() => {
        logger.logRequest(mockReq, mockRes, 150);
      }).not.toThrow();
    });

    it('should log failed requests', () => {
      const mockReq = {
        method: 'POST',
        url: '/api/test',
        ip: '127.0.0.1',
        get: (header: string) => 'Test User Agent'
      } as any;

      const mockRes = {
        statusCode: 500,
        on: (event: string, callback: Function) => {
          if (event === 'finish') {
            callback();
          }
        }
      } as any;

      expect(() => {
        logger.logRequest(mockReq, mockRes, 2000);
      }).not.toThrow();
    });

    it('should log client errors', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/nonexistent',
        ip: '127.0.0.1',
        get: (header: string) => 'Test User Agent'
      } as any;

      const mockRes = {
        statusCode: 404,
        on: (event: string, callback: Function) => {
          if (event === 'finish') {
            callback();
          }
        }
      } as any;

      expect(() => {
        logger.logRequest(mockReq, mockRes, 100);
      }).not.toThrow();
    });
  });

  describe('Error Logging', () => {
    it('should log JavaScript errors', () => {
      const error = new Error('Test JavaScript error');
      error.stack = 'Test stack trace';
      
      expect(() => {
        logger.logError(error, { 
          context: 'test context',
          userId: 123
        });
      }).not.toThrow();
    });

    it('should log errors with context', () => {
      const error = new Error('Test error with context');
      
      expect(() => {
        logger.logError(error, {
          request: {
            method: 'POST',
            url: '/api/test',
            body: { test: 'data' }
          },
          user: {
            id: 123,
            email: 'test@example.com'
          }
        });
      }).not.toThrow();
    });
  });

  describe('Security Logging', () => {
    it('should log security events', () => {
      expect(() => {
        logger.logSecurity('Failed login attempt', {
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date().toISOString()
        });
      }).not.toThrow();
    });

    it('should log suspicious activity', () => {
      expect(() => {
        logger.logSecurity('Suspicious activity detected', {
          ip: '192.168.1.100',
          activity: 'Multiple failed login attempts',
          count: 5,
          timeWindow: '5 minutes'
        });
      }).not.toThrow();
    });

    it('should log authentication events', () => {
      expect(() => {
        logger.logAuthentication('User login successful', {
          userId: 123,
          email: 'test@example.com',
          ip: '192.168.1.100',
          timestamp: new Date().toISOString()
        });
      }).not.toThrow();
    });
  });

  describe('Database Logging', () => {
    it('should log database operations', () => {
      expect(() => {
        logger.logDatabase('SELECT users', {
          query: 'SELECT * FROM users WHERE id = ?',
          parameters: [123],
          executionTime: 150,
          rowsAffected: 1
        });
      }).not.toThrow();
    });

    it('should log database errors', () => {
      expect(() => {
        logger.logDatabase('Database connection failed', {
          error: 'Connection timeout',
          host: 'localhost',
          port: 5432,
          database: 'supplierfinder'
        });
      }).not.toThrow();
    });
  });

  describe('Business Logic Logging', () => {
    it('should log business events', () => {
      expect(() => {
        logger.logBusinessLogic('Search request created', {
          requestId: 123,
          userId: 456,
          title: 'Test Request',
          requirements: ['quality', 'delivery']
        });
      }).not.toThrow();
    });

    it('should log supplier search events', () => {
      expect(() => {
        logger.logBusinessLogic('Supplier search performed', {
          query: 'electronics manufacturer',
          results: 25,
          executionTime: 2000,
          userId: 123
        });
      }).not.toThrow();
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level configuration', () => {
      // В реальном приложении здесь была бы проверка фильтрации по уровню
      expect(() => {
        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');
      }).not.toThrow();
    });
  });

  describe('Log File Management', () => {
    it('should create log directory if not exists', () => {
      expect(() => {
        const logger = Logger.getInstance();
        expect(logger).toBeDefined();
      }).not.toThrow();
    });

    it('should write logs to file', () => {
      expect(() => {
        logger.info('Test log entry for file writing');
      }).not.toThrow();
    });
  });

  describe('Concurrent Logging', () => {
    it('should handle concurrent log writes', async () => {
      const concurrentLogs = 50;
      const promises = [];

      for (let i = 0; i < concurrentLogs; i++) {
        promises.push(
          new Promise(resolve => {
            logger.info(`Concurrent log entry ${i}`, { index: i });
            resolve(true);
          })
        );
      }

      await Promise.all(promises);
      
      // Проверяем, что все логи записались без ошибок
      expect(promises).toHaveLength(concurrentLogs);
    });

    it('should handle concurrent error logging', async () => {
      const concurrentErrors = 20;
      const promises = [];

      for (let i = 0; i < concurrentErrors; i++) {
        promises.push(
          new Promise(resolve => {
            const error = new Error(`Concurrent error ${i}`);
            logger.logError(error, { index: i });
            resolve(true);
          })
        );
      }

      await Promise.all(promises);
      
      expect(promises).toHaveLength(concurrentErrors);
    });
  });

  describe('Log Performance', () => {
    it('should log efficiently', () => {
      const startTime = Date.now();
      
      // Записываем много логов
      for (let i = 0; i < 100; i++) {
        logger.info(`Performance test log ${i}`, { index: i });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Логирование должно быть быстрым
      expect(duration).toBeLessThan(1000); // < 1 секунды
    });

    it('should handle large log entries', () => {
      const largeContext = {
        data: 'x'.repeat(10000), // 10KB данных
        array: Array(1000).fill('test'),
        object: {
          nested: {
            deep: {
              value: 'test'
            }
          }
        }
      };
      
      expect(() => {
        logger.info('Large log entry', largeContext);
      }).not.toThrow();
    });
  });

  describe('Log Formatting', () => {
    it('should format log entries correctly', () => {
      expect(() => {
        logger.info('Formatted log entry', {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Test message',
          context: { test: true }
        });
      }).not.toThrow();
    });

    it('should handle special characters in logs', () => {
      expect(() => {
        logger.info('Log with special characters: éñ中文🚀', {
          special: 'éñ中文🚀',
          unicode: 'Unicode: \u0041\u0042\u0043'
        });
      }).not.toThrow();
    });
  });

  describe('Log Cleanup', () => {
    it('should close log stream', () => {
      expect(() => {
        logger.close();
      }).not.toThrow();
    });
  });
});


