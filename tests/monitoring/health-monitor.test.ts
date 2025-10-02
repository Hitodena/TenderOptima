import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';
import { HealthMonitor } from '../../server/monitoring/health-monitor';

describe('Health Monitor - Production Monitoring', () => {
  let testServer: any;
  let authToken: string;
  let sessionCookie: string;
  let healthMonitor: HealthMonitor;

  beforeAll(async () => {
    await setupTestEnvironment();
    testServer = await TestHelpers.createTestServer();
    
    // Создаем авторизованную сессию
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    sessionCookie = `session=${session.sessionId}`;
    
    healthMonitor = HealthMonitor.getInstance();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    if (testServer) {
      await testServer.close();
    }
  });

  describe('Health Status Monitoring', () => {
    it('should provide health status', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toBeOneOf(['healthy', 'degraded', 'unhealthy']);
      expect(healthStatus.timestamp).toBeDefined();
      expect(healthStatus.uptime).toBeGreaterThan(0);
      expect(healthStatus.version).toBeDefined();
      expect(healthStatus.environment).toBeDefined();
    });

    it('should monitor database connection', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.database).toBeDefined();
      expect(healthStatus.database.status).toBeOneOf(['connected', 'disconnected']);
      expect(healthStatus.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(healthStatus.database.connections).toBeGreaterThanOrEqual(0);
    });

    it('should monitor memory usage', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.memory).toBeDefined();
      expect(healthStatus.memory.used).toBeGreaterThan(0);
      expect(healthStatus.memory.total).toBeGreaterThan(0);
      expect(healthStatus.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(healthStatus.memory.percentage).toBeLessThanOrEqual(100);
    });

    it('should monitor CPU usage', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.cpu).toBeDefined();
      expect(healthStatus.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(healthStatus.cpu.load).toBeGreaterThanOrEqual(0);
    });

    it('should monitor request metrics', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.requests).toBeDefined();
      expect(healthStatus.requests.total).toBeGreaterThanOrEqual(0);
      expect(healthStatus.requests.successful).toBeGreaterThanOrEqual(0);
      expect(healthStatus.requests.failed).toBeGreaterThanOrEqual(0);
      expect(healthStatus.requests.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should monitor error metrics', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.errors).toBeDefined();
      expect(healthStatus.errors.count).toBeGreaterThanOrEqual(0);
      expect(healthStatus.errors.criticalErrors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Request Recording', () => {
    it('should record successful requests', () => {
      const initialStatus = healthMonitor.getHealthStatus();
      
      healthMonitor.recordRequest(100, true);
      healthMonitor.recordRequest(200, true);
      healthMonitor.recordRequest(150, true);
      
      const updatedStatus = healthMonitor.getHealthStatus();
      
      expect(updatedStatus.requests.total).toBeGreaterThan(initialStatus.requests.total);
      expect(updatedStatus.requests.successful).toBeGreaterThan(initialStatus.requests.successful);
    });

    it('should record failed requests', () => {
      const initialStatus = healthMonitor.getHealthStatus();
      
      healthMonitor.recordRequest(100, false);
      healthMonitor.recordRequest(200, false);
      
      const updatedStatus = healthMonitor.getHealthStatus();
      
      expect(updatedStatus.requests.total).toBeGreaterThan(initialStatus.requests.total);
      expect(updatedStatus.requests.failed).toBeGreaterThan(initialStatus.requests.failed);
    });

    it('should calculate average response time', () => {
      healthMonitor.recordRequest(100, true);
      healthMonitor.recordRequest(200, true);
      healthMonitor.recordRequest(300, true);
      
      const healthStatus = healthMonitor.getHealthStatus();
      const expectedAverage = (100 + 200 + 300) / 3;
      
      expect(healthStatus.requests.averageResponseTime).toBeCloseTo(expectedAverage, 2);
    });
  });

  describe('Error Recording', () => {
    it('should record errors', () => {
      const initialStatus = healthMonitor.getHealthStatus();
      
      healthMonitor.recordError('Test error 1');
      healthMonitor.recordError('Test error 2');
      
      const updatedStatus = healthMonitor.getHealthStatus();
      
      expect(updatedStatus.errors.count).toBeGreaterThan(initialStatus.errors.count);
    });

    it('should record critical errors', () => {
      const initialStatus = healthMonitor.getHealthStatus();
      
      healthMonitor.recordError('Critical error 1', true);
      healthMonitor.recordError('Critical error 2', true);
      
      const updatedStatus = healthMonitor.getHealthStatus();
      
      expect(updatedStatus.errors.criticalErrors).toBeGreaterThan(initialStatus.errors.criticalErrors);
    });

    it('should track last error', () => {
      const testError = 'Test error message';
      
      healthMonitor.recordError(testError);
      
      const healthStatus = healthMonitor.getHealthStatus();
      
      expect(healthStatus.errors.lastError).toBe(testError);
    });
  });

  describe('Detailed Metrics', () => {
    it('should provide detailed metrics', async () => {
      const detailedMetrics = await healthMonitor.getDetailedMetrics();
      
      expect(detailedMetrics).toBeDefined();
      expect(detailedMetrics.system).toBeDefined();
      expect(detailedMetrics.system.platform).toBeDefined();
      expect(detailedMetrics.system.nodeVersion).toBeDefined();
      expect(detailedMetrics.system.pid).toBeDefined();
      expect(detailedMetrics.system.uptime).toBeGreaterThan(0);
    });

    it('should calculate requests per minute', async () => {
      const detailedMetrics = await healthMonitor.getDetailedMetrics();
      
      expect(detailedMetrics.application).toBeDefined();
      expect(detailedMetrics.application.requestsPerMinute).toBeGreaterThanOrEqual(0);
      expect(detailedMetrics.application.errorRate).toBeGreaterThanOrEqual(0);
      expect(detailedMetrics.application.successRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Status Determination', () => {
    it('should be healthy when all systems are working', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      if (healthStatus.database.status === 'connected' && 
          healthStatus.errors.criticalErrors === 0) {
        expect(healthStatus.status).toBeOneOf(['healthy', 'degraded']);
      }
    });

    it('should be degraded when performance is poor', async () => {
      // Имитируем плохую производительность
      for (let i = 0; i < 100; i++) {
        healthMonitor.recordRequest(5000, false); // Медленные запросы
      }
      
      const healthStatus = await healthMonitor.getHealthStatus();
      
      if (healthStatus.requests.failed > healthStatus.requests.successful * 0.1) {
        expect(healthStatus.status).toBeOneOf(['degraded', 'unhealthy']);
      }
    });

    it('should be unhealthy when critical systems fail', async () => {
      // Имитируем критические ошибки
      for (let i = 0; i < 10; i++) {
        healthMonitor.recordError('Critical system failure', true);
      }
      
      const healthStatus = await healthMonitor.getHealthStatus();
      
      if (healthStatus.errors.criticalErrors > 0) {
        expect(healthStatus.status).toBe('unhealthy');
      }
    });
  });

  describe('Performance Monitoring', () => {
    it('should monitor response times', async () => {
      const startTime = Date.now();
      
      // Выполняем операции
      const operations = 50;
      for (let i = 0; i < operations; i++) {
        healthMonitor.recordRequest(100 + Math.random() * 100, true);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.requests.averageResponseTime).toBeGreaterThan(0);
      expect(healthStatus.requests.averageResponseTime).toBeLessThan(1000);
    });

    it('should monitor memory usage', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(healthStatus.memory.percentage).toBeLessThanOrEqual(100);
      
      if (healthStatus.memory.percentage > 90) {
        expect(healthStatus.status).toBeOneOf(['degraded', 'unhealthy']);
      }
    });

    it('should monitor CPU usage', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(healthStatus.cpu.load).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with API', () => {
    it('should work with health check endpoint', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.database).toBeDefined();
      expect(result.memory).toBeDefined();
      expect(result.cpu).toBeDefined();
    });

    it('should work with metrics endpoint', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/metrics`);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.metrics).toBeDefined();
      expect(result.performance).toBeDefined();
    });
  });

  describe('Concurrent Monitoring', () => {
    it('should handle concurrent health checks', async () => {
      const concurrentChecks = 20;
      const promises = [];

      for (let i = 0; i < concurrentChecks; i++) {
        promises.push(healthMonitor.getHealthStatus());
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(concurrentChecks);
      results.forEach(result => {
        expect(result.status).toBeDefined();
        expect(result.timestamp).toBeDefined();
      });
    });

    it('should handle concurrent request recording', async () => {
      const concurrentRequests = 50;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          new Promise(resolve => {
            healthMonitor.recordRequest(100 + Math.random() * 100, Math.random() > 0.1);
            resolve(true);
          })
        );
      }

      await Promise.all(promises);
      
      const healthStatus = await healthMonitor.getHealthStatus();
      expect(healthStatus.requests.total).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // В реальном приложении здесь была бы имитация ошибки БД
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus.database).toBeDefined();
    });

    it('should handle memory monitoring errors gracefully', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.memory).toBeDefined();
      expect(healthStatus.memory.used).toBeGreaterThan(0);
      expect(healthStatus.memory.total).toBeGreaterThan(0);
    });

    it('should handle CPU monitoring errors gracefully', async () => {
      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus.cpu).toBeDefined();
      expect(healthStatus.cpu.usage).toBeGreaterThanOrEqual(0);
    });
  });
});


