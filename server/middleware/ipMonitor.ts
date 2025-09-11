import { Request, Response, NextFunction } from 'express';
import { securityLogger } from './securityLogger';

// Интерфейс для отслеживания IP адресов
interface IPActivity {
  ip: string;
  failedAttempts: number;
  lastAttempt: Date;
  blockedUntil?: Date;
  totalRequests: number;
  suspiciousActivity: number;
}

// Класс для мониторинга IP адресов
class IPMonitor {
  private ipActivities: Map<string, IPActivity> = new Map();
  private readonly maxFailedAttempts: number = 5;
  private readonly blockDuration: number = 15 * 60 * 1000; // 15 минут
  private readonly suspiciousThreshold: number = 10;
  private readonly cleanupInterval: number = 60 * 60 * 1000; // 1 час

  constructor() {
    // Запускаем периодическую очистку старых записей
    setInterval(() => {
      this.cleanupOldEntries();
    }, this.cleanupInterval);
  }

  // Получение активности IP
  private getIPActivity(ip: string): IPActivity {
    if (!this.ipActivities.has(ip)) {
      this.ipActivities.set(ip, {
        ip,
        failedAttempts: 0,
        lastAttempt: new Date(),
        totalRequests: 0,
        suspiciousActivity: 0
      });
    }
    return this.ipActivities.get(ip)!;
  }

  // Проверка, заблокирован ли IP
  isIPBlocked(ip: string): boolean {
    const activity = this.ipActivities.get(ip);
    if (!activity || !activity.blockedUntil) {
      return false;
    }
    
    if (new Date() > activity.blockedUntil) {
      // Блокировка истекла, сбрасываем
      activity.blockedUntil = undefined;
      activity.failedAttempts = 0;
      securityLogger.logSuspiciousActivity(
        { ip } as Request, 
        'IP block expired', 
        { ip, blockDuration: this.blockDuration }
      );
      return false;
    }
    
    return true;
  }

  // Регистрация неудачной попытки
  recordFailedAttempt(ip: string, reason: string): void {
    const activity = this.getIPActivity(ip);
    activity.failedAttempts++;
    activity.lastAttempt = new Date();
    activity.suspiciousActivity++;

    securityLogger.logSuspiciousActivity(
      { ip } as Request,
      `Failed attempt: ${reason}`,
      { 
        ip, 
        failedAttempts: activity.failedAttempts,
        totalFailed: activity.failedAttempts 
      }
    );

    // Блокируем IP при превышении лимита
    if (activity.failedAttempts >= this.maxFailedAttempts) {
      this.blockIP(ip, 'Too many failed attempts');
    }
  }

  // Регистрация успешной попытки
  recordSuccessfulAttempt(ip: string): void {
    const activity = this.getIPActivity(ip);
    activity.failedAttempts = 0; // Сбрасываем счетчик неудачных попыток
    activity.lastAttempt = new Date();
    activity.totalRequests++;
  }

  // Блокировка IP
  private blockIP(ip: string, reason: string): void {
    const activity = this.getIPActivity(ip);
    activity.blockedUntil = new Date(Date.now() + this.blockDuration);
    
    securityLogger.logCriticalEvent(
      { ip } as Request,
      'IP_BLOCKED',
      { 
        ip, 
        reason, 
        blockedUntil: activity.blockedUntil,
        failedAttempts: activity.failedAttempts 
      }
    );
    
    console.log(`[Security] IP ${ip} blocked for ${this.blockDuration / 1000 / 60} minutes. Reason: ${reason}`);
  }

  // Регистрация подозрительной активности
  recordSuspiciousActivity(ip: string, reason: string, details?: any): void {
    const activity = this.getIPActivity(ip);
    activity.suspiciousActivity++;
    activity.lastAttempt = new Date();

    securityLogger.logSuspiciousActivity(
      { ip } as Request,
      reason,
      { 
        ip, 
        suspiciousCount: activity.suspiciousActivity,
        ...details 
      }
    );

    // Блокируем при превышении порога подозрительной активности
    if (activity.suspiciousActivity >= this.suspiciousThreshold) {
      this.blockIP(ip, 'Excessive suspicious activity');
    }
  }

  // Получение статистики IP
  getIPStats(ip: string): IPActivity | null {
    return this.ipActivities.get(ip) || null;
  }

  // Получение всех заблокированных IP
  getBlockedIPs(): string[] {
    const blockedIPs: string[] = [];
    for (const [ip, activity] of this.ipActivities.entries()) {
      if (activity.blockedUntil && new Date() < activity.blockedUntil) {
        blockedIPs.push(ip);
      }
    }
    return blockedIPs;
  }

  // Очистка старых записей
  private cleanupOldEntries(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 часа
    
    for (const [ip, activity] of this.ipActivities.entries()) {
      const age = now.getTime() - activity.lastAttempt.getTime();
      
      // Удаляем записи старше 24 часов, если IP не заблокирован
      if (age > maxAge && (!activity.blockedUntil || now > activity.blockedUntil)) {
        this.ipActivities.delete(ip);
      }
    }
    
    console.log(`[IPMonitor] Cleanup completed. Active IPs: ${this.ipActivities.size}`);
  }

  // Разблокировка IP (для админских операций)
  unblockIP(ip: string): boolean {
    const activity = this.ipActivities.get(ip);
    if (activity && activity.blockedUntil) {
      activity.blockedUntil = undefined;
      activity.failedAttempts = 0;
      activity.suspiciousActivity = 0;
      
      securityLogger.logCriticalEvent(
        { ip } as Request,
        'IP_UNBLOCKED',
        { ip, unblockedBy: 'admin' }
      );
      
      console.log(`[Security] IP ${ip} unblocked by admin`);
      return true;
    }
    return false;
  }
}

// Создаем экземпляр монитора IP
export const ipMonitor = new IPMonitor();

// Middleware для проверки блокировки IP
export const ipBlockingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  if (ipMonitor.isIPBlocked(ip)) {
    securityLogger.logCriticalEvent(
      req,
      'BLOCKED_IP_ACCESS_ATTEMPT',
      { ip, path: req.path, method: req.method }
    );
    
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Your IP address has been temporarily blocked due to suspicious activity.',
      retryAfter: '15 minutes'
    });
  }
  
  next();
};

// Middleware для отслеживания активности IP
export const ipTrackingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  // Регистрируем каждый запрос
  const activity = ipMonitor.getIPStats(ip);
  if (activity) {
    activity.totalRequests++;
    activity.lastAttempt = new Date();
  }
  
  next();
};


