import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Интерфейс для записи логов безопасности
interface SecurityLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  event: string;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  userId?: number;
  details?: any;
}

// Класс для логирования безопасности
class SecurityLogger {
  private logFile: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private maxLogFiles: number = 5;

  constructor() {
    // Создаем папку для логов, если её нет
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    this.logFile = path.join(logDir, 'security.log');
  }

  // Запись лога
  private writeLog(entry: SecurityLogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      // Проверяем размер файла и ротируем при необходимости
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxLogSize) {
          this.rotateLogs();
        }
      }
      
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('[SecurityLogger] Ошибка записи лога:', error);
    }
  }

  // Ротация логов
  private rotateLogs(): void {
    try {
      // Переименовываем существующие файлы
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // Удаляем самый старый файл
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Переименовываем текущий файл
      if (fs.existsSync(this.logFile)) {
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
    } catch (error) {
      console.error('[SecurityLogger] Ошибка ротации логов:', error);
    }
  }

  // Логирование попытки входа
  logLoginAttempt(req: Request, success: boolean, userId?: number, error?: string): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level: success ? 'INFO' : 'WARN',
      event: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
      path: req.path,
      method: req.method,
      userId: userId,
      details: error ? { error } : undefined
    };
    
    this.writeLog(entry);
    
    // Дополнительное логирование в консоль для критических событий
    if (!success) {
      console.log(`[Security] Failed login attempt from ${entry.ip} - ${entry.userAgent}`);
    }
  }

  // Логирование попытки регистрации
  logRegistrationAttempt(req: Request, success: boolean, userId?: number, error?: string): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level: success ? 'INFO' : 'WARN',
      event: success ? 'REGISTRATION_SUCCESS' : 'REGISTRATION_FAILED',
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
      path: req.path,
      method: req.method,
      userId: userId,
      details: error ? { error } : undefined
    };
    
    this.writeLog(entry);
  }

  // Логирование подозрительной активности
  logSuspiciousActivity(req: Request, reason: string, details?: any): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      event: 'SUSPICIOUS_ACTIVITY',
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
      path: req.path,
      method: req.method,
      details: { reason, ...details }
    };
    
    this.writeLog(entry);
    console.log(`[Security] Suspicious activity from ${entry.ip}: ${reason}`);
  }

  // Логирование критических событий
  logCriticalEvent(req: Request, event: string, details?: any): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'CRITICAL',
      event: event,
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
      path: req.path,
      method: req.method,
      details: details
    };
    
    this.writeLog(entry);
    console.error(`[Security] CRITICAL EVENT: ${event} from ${entry.ip}`);
  }

  // Логирование доступа к защищенным ресурсам
  logProtectedAccess(req: Request, userId: number, resource: string): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event: 'PROTECTED_ACCESS',
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
      path: req.path,
      method: req.method,
      userId: userId,
      details: { resource }
    };
    
    this.writeLog(entry);
  }
}

// Создаем экземпляр логгера
export const securityLogger = new SecurityLogger();

// Middleware для логирования всех запросов
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Логируем запрос
  console.log(`[Request] ${req.method} ${req.path} from ${req.ip}`);
  
  // Перехватываем ответ для логирования времени выполнения
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`[Response] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    return originalSend.call(this, data);
  };
  
  next();
};

// Middleware для обнаружения подозрительной активности
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  // Проверяем на ботов и краулеров
  if (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider')) {
    securityLogger.logSuspiciousActivity(req, 'Bot/Crawler detected', { userAgent });
  }
  
  // Проверяем на подозрительные пути
  if (req.path.includes('..') || req.path.includes('admin') || req.path.includes('config')) {
    securityLogger.logSuspiciousActivity(req, 'Suspicious path access', { path: req.path });
  }
  
  // Проверяем на множественные запросы с одного IP (базовая защита от DDoS)
  // Это можно расширить с помощью Redis для более сложной логики
  
  next();
};


