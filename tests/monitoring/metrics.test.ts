import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';
import { MetricsCollector } from '../../server/monitoring/metrics';

describe('Metrics Collector - Production Metrics', () => {
  let testServer: any;
  let authToken: string;
  let sessionCookie: string;
  let metricsCollector: MetricsCollector;

  beforeAll(async () => {
    await setupTestEnvironment();
    testServer = await TestHelpers.createTestServer();
    
    // Создаем авторизованную сессию
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    sessionCookie = `session=${session.sessionId}`;
    
    metricsCollector = MetricsCollector.getInstance();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    if (testServer) {
      await testServer.close();
    }
  });

  describe('Request Recording', () => {
    it('should record successful requests', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/health',
        route: { path: '/api/health' }
      } as any;

      const mockRes = {
        statusCode: 200
      } as any;

      metricsCollector.recordRequest(mockReq, mockRes, 150);
      
      const metrics = metricsCollector.getPerformanceMetrics();
      expect(metrics.requests.total).toBeGreaterThan(0);
      expect(metrics.requests.successful).toBeGreaterThan(0);
    });

    it('should record failed requests', () => {
      const mockReq = {
        method: 'POST',
        url: '/api/test',
        route: { path: '/api/test' }
      } as any;

      const mockRes = {
        statusCode: 500
      } as any;

      metricsCollector.recordRequest(mockReq, mockRes, 2000);
      
      const metrics = metricsCollector.getPerformanceMetrics();
      expect(metrics.requests.total).toBeGreaterThan(0);
      expect(metrics.requests.failed).toBeGreaterThan(0);
    });

    it('should record client errors', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/nonexistent',
        route: { path: '/api/nonexistent' }
      } as any;

      const mockRes = {
        statusCode: 404
      } as any;

      metricsCollector.recordRequest(mockReq, mockRes, 100);
      
      const metrics = metricsCollector.getPerformanceMetrics();
      expect(metrics.requests.total).toBeGreaterThan(0);
      expect(metrics.requests.failed).toBeGreaterThan(0);
    });
  });

  describe('Metric Recording', () => {
    it('should record counter metrics', () => {
      metricsCollector.recordMetric('test_counter', 1, 'counter', { label: 'test' });
      
      const metrics = metricsCollector.getMetric('test_counter');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(1);
      expect(metrics[metrics.length - 1].type).toBe('counter');
    });

    it('should record gauge metrics', () => {
      metricsCollector.recordMetric('test_gauge', 75.5, 'gauge', { label: 'test' });
      
      const metrics = metricsCollector.getMetric('test_gauge');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(75.5);
      expect(metrics[metrics.length - 1].type).toBe('gauge');
    });

    it('should record histogram metrics', () => {
      metricsCollector.recordMetric('test_histogram', 150, 'histogram', { label: 'test' });
      
      const metrics = metricsCollector.getMetric('test_histogram');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(150);
      expect(metrics[metrics.length - 1].type).toBe('histogram');
    });

    it('should record summary metrics', () => {
      metricsCollector.recordMetric('test_summary', 200, 'summary', { label: 'test' });
      
      const metrics = metricsCollector.getMetric('test_summary');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(200);
      expect(metrics[metrics.length - 1].type).toBe('summary');
    });
  });

  describe('Business Metrics', () => {
    it('should record business metrics', () => {
      metricsCollector.recordBusinessMetric('user_registration', 1, { userId: 123 });
      
      const metrics = metricsCollector.getMetric('business_user_registration');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(1);
    });

    it('should record search metrics', () => {
      metricsCollector.recordBusinessMetric('search_performed', 1, { 
        query: 'electronics',
        results: 25,
        userId: 123
      });
      
      const metrics = metricsCollector.getMetric('business_search_performed');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(1);
    });

    it('should record request creation metrics', () => {
      metricsCollector.recordBusinessMetric('request_created', 1, {
        requestId: 456,
        userId: 123,
        title: 'Test Request'
      });
      
      const metrics = metricsCollector.getMetric('business_request_created');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(1);
    });
  });

  describe('Security Metrics', () => {
    it('should record security metrics', () => {
      metricsCollector.recordSecurityMetric('failed_login', 1, {
        ip: '192.168.1.100',
        email: 'test@example.com'
      });
      
      const metrics = metricsCollector.getMetric('security_failed_login');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(1);
    });

    it('should record suspicious activity metrics', () => {
      metricsCollector.recordSecurityMetric('suspicious_activity', 1, {
        ip: '192.168.1.100',
        activity: 'Multiple failed logins',
        count: 5
      });
      
      const metrics = metricsCollector.getMetric('security_suspicious_activity');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(1);
    });

    it('should record security breaches', () => {
      metricsCollector.recordSecurityMetric('security_breach', 1, {
        type: 'unauthorized_access',
        severity: 'high',
        ip: '192.168.1.100'
      });
      
      const metrics = metricsCollector.getMetric('security_security_breach');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics', () => {
      metricsCollector.recordPerformanceMetric('response_time', 150, { endpoint: '/api/health' });
      
      const metrics = metricsCollector.getMetric('performance_response_time');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(150);
    });

    it('should record memory usage metrics', () => {
      metricsCollector.recordPerformanceMetric('memory_usage', 85.5, { component: 'heap' });
      
      const metrics = metricsCollector.getMetric('performance_memory_usage');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(85.5);
    });

    it('should record CPU usage metrics', () => {
      metricsCollector.recordPerformanceMetric('cpu_usage', 75.2, { component: 'main' });
      
      const metrics = metricsCollector.getMetric('performance_cpu_usage');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(75.2);
    });
  });

  describe('Performance Metrics Calculation', () => {
    it('should calculate request rates', () => {
      const metrics = metricsCollector.getPerformanceMetrics();
      
      expect(metrics.requests.rate).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.total).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.successful).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.failed).toBeGreaterThanOrEqual(0);
    });

    it('should calculate response time percentiles', () => {
      // Записываем несколько запросов с разным временем ответа
      for (let i = 0; i < 100; i++) {
        const mockReq = { method: 'GET', url: '/api/test', route: { path: '/api/test' } } as any;
        const mockRes = { statusCode: 200 } as any;
        metricsCollector.recordRequest(mockReq, mockRes, 100 + Math.random() * 200);
      }
      
      const metrics = metricsCollector.getPerformanceMetrics();
      
      expect(metrics.responseTime.average).toBeGreaterThan(0);
      expect(metrics.responseTime.p50).toBeGreaterThan(0);
      expect(metrics.responseTime.p95).toBeGreaterThan(0);
      expect(metrics.responseTime.p99).toBeGreaterThan(0);
      expect(metrics.responseTime.max).toBeGreaterThan(0);
    });

    it('should calculate error rates', () => {
      const metrics = metricsCollector.getPerformanceMetrics();
      
      expect(metrics.errors.rate).toBeGreaterThanOrEqual(0);
      expect(metrics.errors.total).toBeGreaterThanOrEqual(0);
      expect(metrics.errors.byType).toBeDefined();
    });

    it('should calculate system metrics', () => {
      const metrics = metricsCollector.getPerformanceMetrics();
      
      expect(metrics.system.memory.used).toBeGreaterThan(0);
      expect(metrics.system.memory.total).toBeGreaterThan(0);
      expect(metrics.system.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.system.memory.percentage).toBeLessThanOrEqual(100);
      
      expect(metrics.system.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.system.cpu.load).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metric Storage', () => {
    it('should store metrics with timestamps', () => {
      metricsCollector.recordMetric('test_metric', 100, 'gauge');
      
      const metrics = metricsCollector.getMetric('test_metric');
      expect(metrics.length).toBeGreaterThan(0);
      
      const latestMetric = metrics[metrics.length - 1];
      expect(latestMetric.timestamp).toBeDefined();
      expect(latestMetric.name).toBe('test_metric');
      expect(latestMetric.value).toBe(100);
    });

    it('should store metrics with labels', () => {
      const labels = { method: 'GET', endpoint: '/api/health', status: '200' };
      metricsCollector.recordMetric('http_requests', 1, 'counter', labels);
      
      const metrics = metricsCollector.getMetric('http_requests');
      expect(metrics.length).toBeGreaterThan(0);
      
      const latestMetric = metrics[metrics.length - 1];
      expect(latestMetric.labels).toEqual(labels);
    });

    it('should limit metric storage', () => {
      // Записываем много метрик
      for (let i = 0; i < 1500; i++) {
        metricsCollector.recordMetric('test_metric', i, 'gauge');
      }
      
      const metrics = metricsCollector.getMetric('test_metric');
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Metric Export', () => {
    it('should export Prometheus format', () => {
      metricsCollector.recordMetric('test_counter', 5, 'counter', { label: 'test' });
      metricsCollector.recordMetric('test_gauge', 75.5, 'gauge', { label: 'test' });
      
      const prometheusOutput = metricsCollector.exportPrometheusFormat();
      
      expect(prometheusOutput).toContain('# HELP test_counter test_counter');
      expect(prometheusOutput).toContain('# TYPE test_counter counter');
      expect(prometheusOutput).toContain('test_counter{label="test"} 5');
      
      expect(prometheusOutput).toContain('# HELP test_gauge test_gauge');
      expect(prometheusOutput).toContain('# TYPE test_gauge gauge');
      expect(prometheusOutput).toContain('test_gauge{label="test"} 75.5');
    });

    it('should export metric summary', () => {
      metricsCollector.recordMetric('test_metric', 100, 'gauge');
      
      const summary = metricsCollector.getMetricSummary();
      
      expect(summary.timestamp).toBeDefined();
      expect(summary.uptime).toBeGreaterThan(0);
      expect(summary.performance).toBeDefined();
      expect(summary.metrics).toBeDefined();
    });
  });

  describe('Concurrent Metric Recording', () => {
    it('should handle concurrent metric recording', async () => {
      const concurrentMetrics = 50;
      const promises = [];

      for (let i = 0; i < concurrentMetrics; i++) {
        promises.push(
          new Promise(resolve => {
            metricsCollector.recordMetric(`concurrent_metric_${i}`, i, 'gauge');
            resolve(true);
          })
        );
      }

      await Promise.all(promises);
      
      const allMetrics = metricsCollector.getMetrics();
      expect(allMetrics.size).toBeGreaterThan(0);
    });

    it('should handle concurrent request recording', async () => {
      const concurrentRequests = 30;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          new Promise(resolve => {
            const mockReq = { method: 'GET', url: '/api/test', route: { path: '/api/test' } } as any;
            const mockRes = { statusCode: 200 } as any;
            metricsCollector.recordRequest(mockReq, mockRes, 100 + Math.random() * 100);
            resolve(true);
          })
        );
      }

      await Promise.all(promises);
      
      const metrics = metricsCollector.getPerformanceMetrics();
      expect(metrics.requests.total).toBeGreaterThan(0);
    });
  });

  describe('Metric Reset', () => {
    it('should reset metrics', () => {
      // Записываем некоторые метрики
      metricsCollector.recordMetric('test_metric', 100, 'gauge');
      metricsCollector.recordBusinessMetric('test_business', 1);
      
      // Сбрасываем метрики
      metricsCollector.reset();
      
      const metrics = metricsCollector.getMetrics();
      expect(metrics.size).toBe(0);
      
      const performanceMetrics = metricsCollector.getPerformanceMetrics();
      expect(performanceMetrics.requests.total).toBe(0);
      expect(performanceMetrics.requests.successful).toBe(0);
      expect(performanceMetrics.requests.failed).toBe(0);
    });
  });

  describe('Error Type Classification', () => {
    it('should classify server errors', () => {
      const mockReq = { method: 'POST', url: '/api/test', route: { path: '/api/test' } } as any;
      const mockRes = { statusCode: 500 } as any;
      
      metricsCollector.recordRequest(mockReq, mockRes, 2000);
      
      const metrics = metricsCollector.getPerformanceMetrics();
      expect(metrics.errors.byType.server_error).toBeGreaterThan(0);
    });

    it('should classify client errors', () => {
      const mockReq = { method: 'GET', url: '/api/test', route: { path: '/api/test' } } as any;
      const mockRes = { statusCode: 400 } as any;
      
      metricsCollector.recordRequest(mockReq, mockRes, 100);
      
      const metrics = metricsCollector.getPerformanceMetrics();
      expect(metrics.errors.byType.client_error).toBeGreaterThan(0);
    });
  });

  describe('Integration with API', () => {
    it('should work with metrics endpoint', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/metrics`);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.metrics).toBeDefined();
      expect(result.performance).toBeDefined();
    });

    it('should work with Prometheus format', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/metrics?format=prometheus`);
      
      expect(response.status).toBe(200);
      const result = await response.text();
      
      expect(result).toContain('# HELP');
      expect(result).toContain('# TYPE');
    });
  });
});


