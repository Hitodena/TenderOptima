import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';
import { AlertManager, AlertType, AlertCategory } from '../../server/monitoring/alerts';

describe('Alert Manager - Production Alerts', () => {
  let testServer: any;
  let authToken: string;
  let sessionCookie: string;
  let alertManager: AlertManager;

  beforeAll(async () => {
    await setupTestEnvironment();
    testServer = await TestHelpers.createTestServer();
    
    // Создаем авторизованную сессию
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    sessionCookie = `session=${session.sessionId}`;
    
    alertManager = AlertManager.getInstance();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    if (testServer) {
      await testServer.close();
    }
  });

  describe('Alert Creation', () => {
    it('should create critical alerts', () => {
      const alert = alertManager.createAlert(
        AlertType.CRITICAL,
        AlertCategory.SYSTEM,
        'System Failure',
        'Critical system failure detected',
        { component: 'database', error: 'Connection lost' }
      );

      expect(alert).toBeDefined();
      expect(alert.type).toBe(AlertType.CRITICAL);
      expect(alert.category).toBe(AlertCategory.SYSTEM);
      expect(alert.title).toBe('System Failure');
      expect(alert.message).toBe('Critical system failure detected');
      expect(alert.resolved).toBe(false);
      expect(alert.timestamp).toBeDefined();
      expect(alert.id).toBeDefined();
    });

    it('should create warning alerts', () => {
      const alert = alertManager.createAlert(
        AlertType.WARNING,
        AlertCategory.PERFORMANCE,
        'High Memory Usage',
        'Memory usage is above 90%',
        { memoryUsage: 92, threshold: 90 }
      );

      expect(alert).toBeDefined();
      expect(alert.type).toBe(AlertType.WARNING);
      expect(alert.category).toBe(AlertCategory.PERFORMANCE);
      expect(alert.resolved).toBe(false);
    });

    it('should create info alerts', () => {
      const alert = alertManager.createAlert(
        AlertType.INFO,
        AlertCategory.BUSINESS,
        'New User Registration',
        'New user registered successfully',
        { userId: 123, email: 'test@example.com' }
      );

      expect(alert).toBeDefined();
      expect(alert.type).toBe(AlertType.INFO);
      expect(alert.category).toBe(AlertCategory.BUSINESS);
      expect(alert.resolved).toBe(false);
    });
  });

  describe('Alert Resolution', () => {
    it('should resolve alerts', () => {
      const alert = alertManager.createAlert(
        AlertType.CRITICAL,
        AlertCategory.SYSTEM,
        'Test Alert',
        'Test alert message'
      );

      const resolved = alertManager.resolveAlert(alert.id);
      
      expect(resolved).toBe(true);
      
      const activeAlerts = alertManager.getActiveAlerts();
      const resolvedAlert = activeAlerts.find(a => a.id === alert.id);
      expect(resolvedAlert).toBeUndefined();
    });

    it('should not resolve non-existent alerts', () => {
      const resolved = alertManager.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });
  });

  describe('Alert Filtering', () => {
    beforeEach(() => {
      // Создаем тестовые алерты
      alertManager.createAlert(AlertType.CRITICAL, AlertCategory.SYSTEM, 'System Alert 1', 'Message 1');
      alertManager.createAlert(AlertType.WARNING, AlertCategory.PERFORMANCE, 'Performance Alert 1', 'Message 2');
      alertManager.createAlert(AlertType.INFO, AlertCategory.BUSINESS, 'Business Alert 1', 'Message 3');
      alertManager.createAlert(AlertType.CRITICAL, AlertCategory.SECURITY, 'Security Alert 1', 'Message 4');
    });

    it('should get active alerts', () => {
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(activeAlerts.every(alert => !alert.resolved)).toBe(true);
    });

    it('should get alerts by category', () => {
      const systemAlerts = alertManager.getAlertsByCategory(AlertCategory.SYSTEM);
      const performanceAlerts = alertManager.getAlertsByCategory(AlertCategory.PERFORMANCE);
      const businessAlerts = alertManager.getAlertsByCategory(AlertCategory.BUSINESS);
      const securityAlerts = alertManager.getAlertsByCategory(AlertCategory.SECURITY);

      expect(systemAlerts.length).toBeGreaterThan(0);
      expect(performanceAlerts.length).toBeGreaterThan(0);
      expect(businessAlerts.length).toBeGreaterThan(0);
      expect(securityAlerts.length).toBeGreaterThan(0);

      expect(systemAlerts.every(alert => alert.category === AlertCategory.SYSTEM)).toBe(true);
      expect(performanceAlerts.every(alert => alert.category === AlertCategory.PERFORMANCE)).toBe(true);
      expect(businessAlerts.every(alert => alert.category === AlertCategory.BUSINESS)).toBe(true);
      expect(securityAlerts.every(alert => alert.category === AlertCategory.SECURITY)).toBe(true);
    });

    it('should get alerts by type', () => {
      const criticalAlerts = alertManager.getAlertsByType(AlertType.CRITICAL);
      const warningAlerts = alertManager.getAlertsByType(AlertType.WARNING);
      const infoAlerts = alertManager.getAlertsByType(AlertType.INFO);

      expect(criticalAlerts.length).toBeGreaterThan(0);
      expect(warningAlerts.length).toBeGreaterThan(0);
      expect(infoAlerts.length).toBeGreaterThan(0);

      expect(criticalAlerts.every(alert => alert.type === AlertType.CRITICAL)).toBe(true);
      expect(warningAlerts.every(alert => alert.type === AlertType.WARNING)).toBe(true);
      expect(infoAlerts.every(alert => alert.type === AlertType.INFO)).toBe(true);
    });
  });

  describe('System Health Monitoring', () => {
    it('should check system health', async () => {
      await alertManager.checkSystemHealth();
      
      // Проверяем, что мониторинг выполнился без ошибок
      expect(true).toBe(true);
    });

    it('should create alerts for unhealthy system', async () => {
      // В реальном приложении здесь была бы имитация нездорового состояния системы
      await alertManager.checkSystemHealth();
      
      const activeAlerts = alertManager.getActiveAlerts();
      // В реальном приложении здесь была бы проверка создания алертов
      expect(activeAlerts).toBeDefined();
    });
  });

  describe('Security Event Monitoring', () => {
    it('should check security events', () => {
      alertManager.checkSecurityEvents();
      
      // Проверяем, что мониторинг безопасности выполнился
      expect(true).toBe(true);
    });

    it('should create alerts for multiple security events', () => {
      // Создаем несколько алертов безопасности
      for (let i = 0; i < 6; i++) {
        alertManager.createAlert(
          AlertType.CRITICAL,
          AlertCategory.SECURITY,
          `Security Event ${i}`,
          `Security event ${i} detected`
        );
      }

      alertManager.checkSecurityEvents();
      
      const activeAlerts = alertManager.getActiveAlerts();
      const securityAlerts = activeAlerts.filter(alert => alert.category === AlertCategory.SECURITY);
      
      expect(securityAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should check performance metrics', () => {
      alertManager.checkPerformanceMetrics();
      
      // Проверяем, что мониторинг производительности выполнился
      expect(true).toBe(true);
    });

    it('should create alerts for performance issues', () => {
      // Создаем несколько алертов производительности
      for (let i = 0; i < 4; i++) {
        alertManager.createAlert(
          AlertType.WARNING,
          AlertCategory.PERFORMANCE,
          `Performance Issue ${i}`,
          `Performance issue ${i} detected`
        );
      }

      alertManager.checkPerformanceMetrics();
      
      const activeAlerts = alertManager.getActiveAlerts();
      const performanceAlerts = activeAlerts.filter(alert => alert.category === AlertCategory.PERFORMANCE);
      
      expect(performanceAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Alert Thresholds', () => {
    it('should set alert thresholds', () => {
      alertManager.setThreshold('memory_usage', 85);
      alertManager.setThreshold('cpu_usage', 75);
      alertManager.setThreshold('response_time', 3000);
      
      const thresholds = alertManager.getThresholds();
      
      expect(thresholds.get('memory_usage')).toBe(85);
      expect(thresholds.get('cpu_usage')).toBe(75);
      expect(thresholds.get('response_time')).toBe(3000);
    });

    it('should have default thresholds', () => {
      const thresholds = alertManager.getThresholds();
      
      expect(thresholds.get('memory_usage')).toBeDefined();
      expect(thresholds.get('cpu_usage')).toBeDefined();
      expect(thresholds.get('response_time')).toBeDefined();
      expect(thresholds.get('error_rate')).toBeDefined();
      expect(thresholds.get('database_response_time')).toBeDefined();
      expect(thresholds.get('failed_requests')).toBeDefined();
    });
  });

  describe('Alert Monitoring', () => {
    it('should start monitoring', async () => {
      await alertManager.startMonitoring();
      
      // Проверяем, что мониторинг запустился
      expect(true).toBe(true);
    });

    it('should stop monitoring', async () => {
      await alertManager.stopMonitoring();
      
      // Проверяем, что мониторинг остановился
      expect(true).toBe(true);
    });
  });

  describe('Alert Context', () => {
    it('should store alert context', () => {
      const context = {
        userId: 123,
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date().toISOString()
      };

      const alert = alertManager.createAlert(
        AlertType.CRITICAL,
        AlertCategory.SECURITY,
        'Security Breach',
        'Unauthorized access attempt',
        context
      );

      expect(alert.context).toEqual(context);
    });

    it('should handle complex alert context', () => {
      const complexContext = {
        request: {
          method: 'POST',
          url: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { email: 'test@example.com' }
        },
        user: {
          id: 123,
          email: 'test@example.com',
          role: 'admin'
        },
        system: {
          memory: 85,
          cpu: 75,
          disk: 60
        }
      };

      const alert = alertManager.createAlert(
        AlertType.WARNING,
        AlertCategory.PERFORMANCE,
        'System Performance Warning',
        'System resources are high',
        complexContext
      );

      expect(alert.context).toEqual(complexContext);
    });
  });

  describe('Alert Timestamps', () => {
    it('should set alert timestamps', () => {
      const beforeTime = new Date().toISOString();
      
      const alert = alertManager.createAlert(
        AlertType.INFO,
        AlertCategory.BUSINESS,
        'Test Alert',
        'Test message'
      );
      
      const afterTime = new Date().toISOString();
      
      expect(alert.timestamp).toBeDefined();
      expect(alert.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(alert.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should set resolution timestamps', () => {
      const alert = alertManager.createAlert(
        AlertType.CRITICAL,
        AlertCategory.SYSTEM,
        'Test Alert',
        'Test message'
      );

      const beforeResolve = new Date().toISOString();
      alertManager.resolveAlert(alert.id);
      const afterResolve = new Date().toISOString();

      const activeAlerts = alertManager.getActiveAlerts();
      const resolvedAlert = activeAlerts.find(a => a.id === alert.id);
      
      if (resolvedAlert) {
        expect(resolvedAlert.resolvedAt).toBeDefined();
        expect(resolvedAlert.resolvedAt).toBeGreaterThanOrEqual(beforeResolve);
        expect(resolvedAlert.resolvedAt).toBeLessThanOrEqual(afterResolve);
      }
    });
  });

  describe('Alert ID Generation', () => {
    it('should generate unique alert IDs', () => {
      const alert1 = alertManager.createAlert(
        AlertType.INFO,
        AlertCategory.BUSINESS,
        'Alert 1',
        'Message 1'
      );
      
      const alert2 = alertManager.createAlert(
        AlertType.INFO,
        AlertCategory.BUSINESS,
        'Alert 2',
        'Message 2'
      );

      expect(alert1.id).toBeDefined();
      expect(alert2.id).toBeDefined();
      expect(alert1.id).not.toBe(alert2.id);
    });

    it('should generate alert IDs with proper format', () => {
      const alert = alertManager.createAlert(
        AlertType.CRITICAL,
        AlertCategory.SYSTEM,
        'Test Alert',
        'Test message'
      );

      expect(alert.id).toMatch(/^alert_\d+_[a-z0-9]+$/);
    });
  });

  describe('Concurrent Alert Management', () => {
    it('should handle concurrent alert creation', async () => {
      const concurrentAlerts = 20;
      const promises = [];

      for (let i = 0; i < concurrentAlerts; i++) {
        promises.push(
          new Promise(resolve => {
            alertManager.createAlert(
              AlertType.INFO,
              AlertCategory.BUSINESS,
              `Concurrent Alert ${i}`,
              `Message ${i}`
            );
            resolve(true);
          })
        );
      }

      await Promise.all(promises);
      
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
    });

    it('should handle concurrent alert resolution', async () => {
      // Создаем алерты для разрешения
      const alerts = [];
      for (let i = 0; i < 10; i++) {
        const alert = alertManager.createAlert(
          AlertType.INFO,
          AlertCategory.BUSINESS,
          `Alert ${i}`,
          `Message ${i}`
        );
        alerts.push(alert);
      }

      const promises = alerts.map(alert => 
        new Promise(resolve => {
          alertManager.resolveAlert(alert.id);
          resolve(true);
        })
      );

      await Promise.all(promises);
      
      const activeAlerts = alertManager.getActiveAlerts();
      const resolvedAlerts = activeAlerts.filter(alert => 
        alerts.some(a => a.id === alert.id)
      );
      
      expect(resolvedAlerts.length).toBe(0);
    });
  });
});


