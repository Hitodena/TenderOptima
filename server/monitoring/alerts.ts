import { Logger } from './logger';
import { HealthMonitor } from './health-monitor';
import { HealthStatus } from './health-monitor';

export enum AlertType {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info'
}

export enum AlertCategory {
  SYSTEM = 'system',
  DATABASE = 'database',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  BUSINESS = 'business'
}

export interface Alert {
  id: string;
  type: AlertType;
  category: AlertCategory;
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  context?: any;
  userId?: number;
  ip?: string;
}

export class AlertManager {
  private static instance: AlertManager;
  private alerts: Map<string, Alert> = new Map();
  private logger: Logger;
  private healthMonitor: HealthMonitor;
  private alertThresholds: Map<string, any> = new Map();

  private constructor() {
    this.logger = Logger.getInstance();
    this.healthMonitor = HealthMonitor.getInstance();
    this.setupDefaultThresholds();
  }

  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  private setupDefaultThresholds(): void {
    this.alertThresholds.set('memory_usage', 90); // 90%
    this.alertThresholds.set('cpu_usage', 80); // 80%
    this.alertThresholds.set('response_time', 5000); // 5 секунд
    this.alertThresholds.set('error_rate', 10); // 10%
    this.alertThresholds.set('database_response_time', 2000); // 2 секунды
    this.alertThresholds.set('failed_requests', 50); // 50 запросов
  }

  public createAlert(
    type: AlertType,
    category: AlertCategory,
    title: string,
    message: string,
    context?: any
  ): Alert {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      category,
      title,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
      context
    };

    this.alerts.set(alert.id, alert);
    this.logger.warn(`Alert created: ${title}`, { alert });

    // Отправляем уведомление
    this.sendAlertNotification(alert);

    return alert;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    
    this.logger.info(`Alert resolved: ${alert.title}`, { alert });
    return true;
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  public getAlertsByCategory(category: AlertCategory): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.category === category);
  }

  public getAlertsByType(type: AlertType): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.type === type);
  }

  public async checkSystemHealth(): Promise<void> {
    try {
      const healthStatus = await this.healthMonitor.getHealthStatus();
      
      // Проверяем статус системы
      if (healthStatus.status === 'unhealthy') {
        this.createAlert(
          AlertType.CRITICAL,
          AlertCategory.SYSTEM,
          'System Unhealthy',
          'System is in unhealthy state',
          { healthStatus }
        );
      } else if (healthStatus.status === 'degraded') {
        this.createAlert(
          AlertType.WARNING,
          AlertCategory.SYSTEM,
          'System Degraded',
          'System performance is degraded',
          { healthStatus }
        );
      }

      // Проверяем использование памяти
      if (healthStatus.memory.percentage > this.alertThresholds.get('memory_usage')) {
        this.createAlert(
          AlertType.WARNING,
          AlertCategory.PERFORMANCE,
          'High Memory Usage',
          `Memory usage is ${healthStatus.memory.percentage.toFixed(2)}%`,
          { memory: healthStatus.memory }
        );
      }

      // Проверяем время ответа
      if (healthStatus.requests.averageResponseTime > this.alertThresholds.get('response_time')) {
        this.createAlert(
          AlertType.WARNING,
          AlertCategory.PERFORMANCE,
          'Slow Response Time',
          `Average response time is ${healthStatus.requests.averageResponseTime.toFixed(2)}ms`,
          { requests: healthStatus.requests }
        );
      }

      // Проверяем ошибки
      if (healthStatus.errors.count > this.alertThresholds.get('failed_requests')) {
        this.createAlert(
          AlertType.WARNING,
          AlertCategory.SYSTEM,
          'High Error Count',
          `Error count is ${healthStatus.errors.count}`,
          { errors: healthStatus.errors }
        );
      }

      // Проверяем базу данных
      if (healthStatus.database.status === 'disconnected') {
        this.createAlert(
          AlertType.CRITICAL,
          AlertCategory.DATABASE,
          'Database Disconnected',
          'Database connection is lost',
          { database: healthStatus.database }
        );
      } else if (healthStatus.database.responseTime > this.alertThresholds.get('database_response_time')) {
        this.createAlert(
          AlertType.WARNING,
          AlertCategory.DATABASE,
          'Slow Database Response',
          `Database response time is ${healthStatus.database.responseTime}ms`,
          { database: healthStatus.database }
        );
      }

    } catch (error) {
      this.logger.error('Failed to check system health', { error });
    }
  }

  public checkSecurityEvents(): void {
    // Проверяем подозрительную активность
    const activeAlerts = this.getActiveAlerts();
    const securityAlerts = activeAlerts.filter(alert => alert.category === AlertCategory.SECURITY);
    
    if (securityAlerts.length > 5) {
      this.createAlert(
        AlertType.CRITICAL,
        AlertCategory.SECURITY,
        'Multiple Security Events',
        `There are ${securityAlerts.length} active security alerts`,
        { securityAlerts }
      );
    }
  }

  public checkPerformanceMetrics(): void {
    // Проверяем метрики производительности
    const activeAlerts = this.getActiveAlerts();
    const performanceAlerts = activeAlerts.filter(alert => alert.category === AlertCategory.PERFORMANCE);
    
    if (performanceAlerts.length > 3) {
      this.createAlert(
        AlertType.WARNING,
        AlertCategory.PERFORMANCE,
        'Performance Issues',
        `There are ${performanceAlerts.length} active performance alerts`,
        { performanceAlerts }
      );
    }
  }

  public setThreshold(category: string, value: any): void {
    this.alertThresholds.set(category, value);
    this.logger.info(`Alert threshold updated: ${category} = ${value}`);
  }

  public getThresholds(): Map<string, any> {
    return new Map(this.alertThresholds);
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendAlertNotification(alert: Alert): void {
    // В реальном приложении здесь была бы отправка уведомлений
    // (email, Slack, Discord, etc.)
    
    this.logger.warn(`Alert notification: ${alert.title}`, {
      alert,
      notification: {
        type: 'alert',
        priority: alert.type,
        category: alert.category
      }
    });
  }

  public async startMonitoring(): Promise<void> {
    // Запускаем мониторинг каждые 30 секунд
    setInterval(async () => {
      await this.checkSystemHealth();
      this.checkSecurityEvents();
      this.checkPerformanceMetrics();
    }, 30000);

    this.logger.info('Alert monitoring started');
  }

  public async stopMonitoring(): Promise<void> {
    this.logger.info('Alert monitoring stopped');
  }
}

// Утилиты для создания алертов
export const createSystemAlert = (title: string, message: string, context?: any) => {
  const alertManager = AlertManager.getInstance();
  return alertManager.createAlert(AlertType.CRITICAL, AlertCategory.SYSTEM, title, message, context);
};

export const createSecurityAlert = (title: string, message: string, context?: any) => {
  const alertManager = AlertManager.getInstance();
  return alertManager.createAlert(AlertType.CRITICAL, AlertCategory.SECURITY, title, message, context);
};

export const createPerformanceAlert = (title: string, message: string, context?: any) => {
  const alertManager = AlertManager.getInstance();
  return alertManager.createAlert(AlertType.WARNING, AlertCategory.PERFORMANCE, title, message, context);
};

export const createDatabaseAlert = (title: string, message: string, context?: any) => {
  const alertManager = AlertManager.getInstance();
  return alertManager.createAlert(AlertType.CRITICAL, AlertCategory.DATABASE, title, message, context);
};

export const createBusinessAlert = (title: string, message: string, context?: any) => {
  const alertManager = AlertManager.getInstance();
  return alertManager.createAlert(AlertType.INFO, AlertCategory.BUSINESS, title, message, context);
};


