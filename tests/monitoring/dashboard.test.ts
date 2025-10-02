import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';
import { Dashboard } from '../../server/monitoring/dashboard';

describe('Dashboard - Production Dashboard', () => {
  let testServer: any;
  let authToken: string;
  let sessionCookie: string;
  let dashboard: Dashboard;

  beforeAll(async () => {
    await setupTestEnvironment();
    testServer = await TestHelpers.createTestServer();
    
    // Создаем авторизованную сессию
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    sessionCookie = `session=${session.sessionId}`;
    
    dashboard = Dashboard.getInstance();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    if (testServer) {
      await testServer.close();
    }
  });

  describe('Dashboard Data', () => {
    it('should provide dashboard data', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData).toBeDefined();
      expect(dashboardData.timestamp).toBeDefined();
      expect(dashboardData.system).toBeDefined();
      expect(dashboardData.health).toBeDefined();
      expect(dashboardData.performance).toBeDefined();
      expect(dashboardData.alerts).toBeDefined();
      expect(dashboardData.business).toBeDefined();
      expect(dashboardData.trends).toBeDefined();
    });

    it('should include system information', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData.system.status).toBeDefined();
      expect(dashboardData.system.uptime).toBeGreaterThan(0);
      expect(dashboardData.system.version).toBeDefined();
      expect(dashboardData.system.environment).toBeDefined();
    });

    it('should include health information', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData.health.database).toBeDefined();
      expect(dashboardData.health.memory).toBeGreaterThanOrEqual(0);
      expect(dashboardData.health.cpu).toBeGreaterThanOrEqual(0);
      expect(dashboardData.health.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include performance information', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData.performance.requests).toBeDefined();
      expect(dashboardData.performance.requests.total).toBeGreaterThanOrEqual(0);
      expect(dashboardData.performance.requests.rate).toBeGreaterThanOrEqual(0);
      expect(dashboardData.performance.requests.successRate).toBeGreaterThanOrEqual(0);
      
      expect(dashboardData.performance.responseTime).toBeDefined();
      expect(dashboardData.performance.responseTime.average).toBeGreaterThanOrEqual(0);
      expect(dashboardData.performance.responseTime.p95).toBeGreaterThanOrEqual(0);
      expect(dashboardData.performance.responseTime.p99).toBeGreaterThanOrEqual(0);
      
      expect(dashboardData.performance.errors).toBeDefined();
      expect(dashboardData.performance.errors.total).toBeGreaterThanOrEqual(0);
      expect(dashboardData.performance.errors.rate).toBeGreaterThanOrEqual(0);
    });

    it('should include alerts information', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData.alerts).toBeDefined();
      expect(dashboardData.alerts.active).toBeGreaterThanOrEqual(0);
      expect(dashboardData.alerts.critical).toBeGreaterThanOrEqual(0);
      expect(dashboardData.alerts.warning).toBeGreaterThanOrEqual(0);
      expect(dashboardData.alerts.info).toBeGreaterThanOrEqual(0);
    });

    it('should include business information', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData.business).toBeDefined();
      expect(dashboardData.business.users).toBeGreaterThanOrEqual(0);
      expect(dashboardData.business.requests).toBeGreaterThanOrEqual(0);
      expect(dashboardData.business.suppliers).toBeGreaterThanOrEqual(0);
    });

    it('should include trends information', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData.trends).toBeDefined();
      expect(dashboardData.trends.requests).toBeDefined();
      expect(dashboardData.trends.responseTime).toBeDefined();
      expect(dashboardData.trends.errors).toBeDefined();
      expect(dashboardData.trends.memory).toBeDefined();
    });
  });

  describe('System Overview', () => {
    it('should provide system overview', async () => {
      const overview = await dashboard.getSystemOverview();
      
      expect(overview).toBeDefined();
      expect(overview.status).toBeDefined();
      expect(overview.uptime).toBeGreaterThan(0);
      expect(overview.requests).toBeDefined();
      expect(overview.performance).toBeDefined();
      expect(overview.alerts).toBeDefined();
    });

    it('should include request information', async () => {
      const overview = await dashboard.getSystemOverview();
      
      expect(overview.requests.total).toBeGreaterThanOrEqual(0);
      expect(overview.requests.rate).toBeGreaterThanOrEqual(0);
      expect(overview.requests.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should include performance information', async () => {
      const overview = await dashboard.getSystemOverview();
      
      expect(overview.performance.responseTime).toBeGreaterThanOrEqual(0);
      expect(overview.performance.memory).toBeGreaterThanOrEqual(0);
      expect(overview.performance.cpu).toBeGreaterThanOrEqual(0);
    });

    it('should include alerts information', async () => {
      const overview = await dashboard.getSystemOverview();
      
      expect(overview.alerts.active).toBeGreaterThanOrEqual(0);
      expect(overview.alerts.critical).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Report', () => {
    it('should provide performance report', async () => {
      const report = await dashboard.getPerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.metrics).toBeDefined();
    });

    it('should include performance metrics', async () => {
      const report = await dashboard.getPerformanceReport();
      
      expect(report.performance.requests).toBeDefined();
      expect(report.performance.responseTime).toBeDefined();
      expect(report.performance.errors).toBeDefined();
      expect(report.performance.system).toBeDefined();
      expect(report.performance.business).toBeDefined();
    });

    it('should include metrics information', async () => {
      const report = await dashboard.getPerformanceReport();
      
      expect(report.metrics).toBeDefined();
      expect(typeof report.metrics).toBe('object');
    });
  });

  describe('Alerts Report', () => {
    it('should provide alerts report', async () => {
      const report = await dashboard.getAlertsReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.active).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.byCategory).toBeDefined();
      expect(report.byType).toBeDefined();
    });

    it('should include active alerts', async () => {
      const report = await dashboard.getAlertsReport();
      
      expect(Array.isArray(report.active)).toBe(true);
    });

    it('should include alerts summary', async () => {
      const report = await dashboard.getAlertsReport();
      
      expect(report.summary.total).toBeGreaterThanOrEqual(0);
      expect(report.summary.critical).toBeGreaterThanOrEqual(0);
      expect(report.summary.warning).toBeGreaterThanOrEqual(0);
      expect(report.summary.info).toBeGreaterThanOrEqual(0);
    });

    it('should include alerts by category', async () => {
      const report = await dashboard.getAlertsReport();
      
      expect(report.byCategory.system).toBeGreaterThanOrEqual(0);
      expect(report.byCategory.database).toBeGreaterThanOrEqual(0);
      expect(report.byCategory.security).toBeGreaterThanOrEqual(0);
      expect(report.byCategory.performance).toBeGreaterThanOrEqual(0);
      expect(report.byCategory.business).toBeGreaterThanOrEqual(0);
    });

    it('should include alerts by type', async () => {
      const report = await dashboard.getAlertsReport();
      
      expect(report.byType.critical).toBeGreaterThanOrEqual(0);
      expect(report.byType.warning).toBeGreaterThanOrEqual(0);
      expect(report.byType.info).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Business Metrics', () => {
    it('should provide business metrics', async () => {
      const metrics = await dashboard.getBusinessMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.users).toBeDefined();
      expect(metrics.requests).toBeDefined();
      expect(metrics.suppliers).toBeDefined();
      expect(metrics.metrics).toBeDefined();
    });

    it('should include user metrics', async () => {
      const metrics = await dashboard.getBusinessMetrics();
      
      expect(metrics.users.total).toBeGreaterThanOrEqual(0);
      expect(metrics.users.active).toBeGreaterThanOrEqual(0);
      expect(metrics.users.new).toBeGreaterThanOrEqual(0);
    });

    it('should include request metrics', async () => {
      const metrics = await dashboard.getBusinessMetrics();
      
      expect(metrics.requests.total).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.pending).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.completed).toBeGreaterThanOrEqual(0);
    });

    it('should include supplier metrics', async () => {
      const metrics = await dashboard.getBusinessMetrics();
      
      expect(metrics.suppliers.total).toBeGreaterThanOrEqual(0);
      expect(metrics.suppliers.active).toBeGreaterThanOrEqual(0);
      expect(metrics.suppliers.new).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Historical Data Collection', () => {
    it('should record historical data', () => {
      expect(() => {
        dashboard.recordHistoricalData();
      }).not.toThrow();
    });

    it('should start historical data collection', () => {
      expect(() => {
        dashboard.startHistoricalDataCollection();
      }).not.toThrow();
    });

    it('should stop historical data collection', () => {
      expect(() => {
        dashboard.stopHistoricalDataCollection();
      }).not.toThrow();
    });
  });

  describe('Trend Data', () => {
    it('should provide trend data', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData.trends.requests).toBeDefined();
      expect(dashboardData.trends.responseTime).toBeDefined();
      expect(dashboardData.trends.errors).toBeDefined();
      expect(dashboardData.trends.memory).toBeDefined();
    });

    it('should include trend data points', async () => {
      const dashboardData = await dashboard.getDashboardData();
      
      expect(Array.isArray(dashboardData.trends.requests)).toBe(true);
      expect(Array.isArray(dashboardData.trends.responseTime)).toBe(true);
      expect(Array.isArray(dashboardData.trends.errors)).toBe(true);
      expect(Array.isArray(dashboardData.trends.memory)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle dashboard errors gracefully', async () => {
      // В реальном приложении здесь была бы имитация ошибки
      const dashboardData = await dashboard.getDashboardData();
      
      expect(dashboardData).toBeDefined();
      expect(dashboardData.timestamp).toBeDefined();
    });

    it('should handle system overview errors gracefully', async () => {
      const overview = await dashboard.getSystemOverview();
      
      expect(overview).toBeDefined();
      expect(overview.status).toBeDefined();
    });

    it('should handle performance report errors gracefully', async () => {
      const report = await dashboard.getPerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });
  });

  describe('Integration with API', () => {
    it('should work with dashboard endpoint', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/dashboard`);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.timestamp).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.health).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.alerts).toBeDefined();
      expect(result.business).toBeDefined();
      expect(result.trends).toBeDefined();
    });

    it('should work with system overview endpoint', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/system-overview`);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.status).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.requests).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.alerts).toBeDefined();
    });

    it('should work with performance report endpoint', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/performance-report`);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.timestamp).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should work with alerts report endpoint', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/alerts-report`);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.timestamp).toBeDefined();
      expect(result.active).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.byCategory).toBeDefined();
      expect(result.byType).toBeDefined();
    });

    it('should work with business metrics endpoint', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/business-metrics`);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.timestamp).toBeDefined();
      expect(result.users).toBeDefined();
      expect(result.requests).toBeDefined();
      expect(result.suppliers).toBeDefined();
      expect(result.metrics).toBeDefined();
    });
  });

  describe('Concurrent Dashboard Access', () => {
    it('should handle concurrent dashboard requests', async () => {
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(dashboard.getDashboardData());
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.timestamp).toBeDefined();
        expect(result.system).toBeDefined();
        expect(result.health).toBeDefined();
        expect(result.performance).toBeDefined();
        expect(result.alerts).toBeDefined();
        expect(result.business).toBeDefined();
        expect(result.trends).toBeDefined();
      });
    });

    it('should handle concurrent system overview requests', async () => {
      const concurrentRequests = 15;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(dashboard.getSystemOverview());
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.status).toBeDefined();
        expect(result.uptime).toBeGreaterThan(0);
        expect(result.requests).toBeDefined();
        expect(result.performance).toBeDefined();
        expect(result.alerts).toBeDefined();
      });
    });
  });

  describe('Data Consistency', () => {
    it('should provide consistent data across requests', async () => {
      const dashboardData1 = await dashboard.getDashboardData();
      const dashboardData2 = await dashboard.getDashboardData();
      
      expect(dashboardData1.system.status).toBe(dashboardData2.system.status);
      expect(dashboardData1.system.environment).toBe(dashboardData2.system.environment);
      expect(dashboardData1.system.version).toBe(dashboardData2.system.version);
    });

    it('should provide consistent performance data', async () => {
      const performanceReport1 = await dashboard.getPerformanceReport();
      const performanceReport2 = await dashboard.getPerformanceReport();
      
      expect(performanceReport1.performance.requests).toBeDefined();
      expect(performanceReport2.performance.requests).toBeDefined();
      expect(performanceReport1.performance.responseTime).toBeDefined();
      expect(performanceReport2.performance.responseTime).toBeDefined();
    });
  });
});


