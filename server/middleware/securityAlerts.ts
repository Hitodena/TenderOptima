import { Request } from 'express';
import { securityLogger } from './securityLogger';
import { ipMonitor } from './ipMonitor';

// Интерфейс для алертов
interface SecurityAlert {
  id: string;
  timestamp: Date;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  message: string;
  ip?: string;
  userId?: number;
  details?: any;
  resolved: boolean;
}

// Класс для управления алертами безопасности
class SecurityAlertManager {
  private alerts: Map<string, SecurityAlert> = new Map();
  private alertThresholds: Map<string, number> = new Map();
  private alertCounts: Map<string, number> = new Map();
  private readonly maxAlerts: number = 1000;
  private readonly alertRetentionDays: number = 30;

  constructor() {
    // Настраиваем пороги для различных типов алертов
    this.alertThresholds.set('FAILED_LOGIN_ATTEMPTS', 3);
    this.alertThresholds.set('SUSPICIOUS_ACTIVITY', 5);
    this.alertThresholds.set('IP_BLOCKED', 1);
    this.alertThresholds.set('CRITICAL_EVENT', 1);
    this.alertThresholds.set('RATE_LIMIT_EXCEEDED', 10);
    
    // Запускаем периодическую очистку старых алертов
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 24 * 60 * 60 * 1000); // Каждые 24 часа
  }

  // Создание нового алерта
  createAlert(
    type: string,
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    message: string,
    ip?: string,
    userId?: number,
    details?: any
  ): string {
    const alertId = this.generateAlertId();
    const alert: SecurityAlert = {
      id: alertId,
      timestamp: new Date(),
      level,
      type,
      message,
      ip,
      userId,
      details,
      resolved: false
    };

    this.alerts.set(alertId, alert);
    
    // Увеличиваем счетчик для данного типа алерта
    const currentCount = this.alertCounts.get(type) || 0;
    this.alertCounts.set(type, currentCount + 1);

    // Логируем алерт
    securityLogger.logCriticalEvent(
      { ip } as Request,
      `SECURITY_ALERT_${level}`,
      { alertId, type, message, details }
    );

    // Отправляем уведомление для критических алертов
    if (level === 'CRITICAL' || level === 'HIGH') {
      this.sendAlertNotification(alert);
    }

    // Проверяем, нужно ли принять меры
    this.checkAlertThresholds(type);

    return alertId;
  }

  // Генерация уникального ID алерта
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Отправка уведомления об алерте
  private sendAlertNotification(alert: SecurityAlert): void {
    const notification = {
      timestamp: alert.timestamp.toISOString(),
      level: alert.level,
      type: alert.type,
      message: alert.message,
      ip: alert.ip,
      userId: alert.userId,
      details: alert.details
    };

    // В реальном приложении здесь можно отправить email, SMS, Slack уведомление и т.д.
    console.log(`🚨 SECURITY ALERT [${alert.level}]: ${alert.type}`);
    console.log(`📧 Message: ${alert.message}`);
    console.log(`🌐 IP: ${alert.ip || 'Unknown'}`);
    console.log(`👤 User ID: ${alert.userId || 'Unknown'}`);
    console.log(`📊 Details:`, alert.details);
    console.log('---');

    // Здесь можно добавить интеграцию с внешними сервисами:
    // - Email уведомления
    // - Slack/Discord webhooks
    // - SMS уведомления
    // - Push уведомления
  }

  // Проверка порогов алертов
  private checkAlertThresholds(type: string): void {
    const threshold = this.alertThresholds.get(type);
    const currentCount = this.alertCounts.get(type) || 0;

    if (threshold && currentCount >= threshold) {
      this.createAlert(
        'THRESHOLD_EXCEEDED',
        'HIGH',
        `Alert threshold exceeded for ${type}: ${currentCount} occurrences`,
        undefined,
        undefined,
        { type, count: currentCount, threshold }
      );
    }
  }

  // Получение всех алертов
  getAllAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values()).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  // Получение алертов по типу
  getAlertsByType(type: string): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Получение алертов по уровню
  getAlertsByLevel(level: string): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.level === level)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Получение нерешенных алертов
  getUnresolvedAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Отметка алерта как решенного
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      securityLogger.logCriticalEvent(
        { ip: alert.ip } as Request,
        'ALERT_RESOLVED',
        { alertId, type: alert.type }
      );
      return true;
    }
    return false;
  }

  // Получение статистики алертов
  getAlertStats(): any {
    const stats = {
      total: this.alerts.size,
      unresolved: this.getUnresolvedAlerts().length,
      byLevel: {} as any,
      byType: {} as any,
      recent: 0
    };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const alert of this.alerts.values()) {
      // Статистика по уровням
      stats.byLevel[alert.level] = (stats.byLevel[alert.level] || 0) + 1;
      
      // Статистика по типам
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
      
      // Недавние алерты (за последние 24 часа)
      if (alert.timestamp > oneDayAgo) {
        stats.recent++;
      }
    }

    return stats;
  }

  // Очистка старых алертов
  private cleanupOldAlerts(): void {
    const cutoffDate = new Date(Date.now() - this.alertRetentionDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffDate) {
        this.alerts.delete(alertId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[SecurityAlerts] Cleaned up ${removedCount} old alerts`);
    }
  }
}

// Создаем экземпляр менеджера алертов
export const securityAlertManager = new SecurityAlertManager();

// Функции для создания различных типов алертов
export const createFailedLoginAlert = (ip: string, username: string, error: string) => {
  return securityAlertManager.createAlert(
    'FAILED_LOGIN_ATTEMPT',
    'MEDIUM',
    `Failed login attempt for user "${username}" from IP ${ip}`,
    ip,
    undefined,
    { username, error }
  );
};

export const createSuspiciousActivityAlert = (ip: string, reason: string, details?: any) => {
  return securityAlertManager.createAlert(
    'SUSPICIOUS_ACTIVITY',
    'HIGH',
    `Suspicious activity detected from IP ${ip}: ${reason}`,
    ip,
    undefined,
    details
  );
};

export const createIPBlockedAlert = (ip: string, reason: string) => {
  return securityAlertManager.createAlert(
    'IP_BLOCKED',
    'CRITICAL',
    `IP address ${ip} has been blocked: ${reason}`,
    ip,
    undefined,
    { reason, blockedAt: new Date().toISOString() }
  );
};

export const createCriticalEventAlert = (event: string, details?: any) => {
  return securityAlertManager.createAlert(
    'CRITICAL_EVENT',
    'CRITICAL',
    `Critical security event: ${event}`,
    undefined,
    undefined,
    details
  );
};


