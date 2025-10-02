import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  userId?: number;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private static instance: Logger;
  private logStream: NodeJS.WritableStream;
  private logLevel: LogLevel;
  private logDir: string;

  private constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    this.logDir = process.env.LOG_DIR || join(process.cwd(), 'logs');
    
    // Создаем директорию для логов
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }

    // Создаем поток для записи логов
    const logFile = join(this.logDir, `app-${format(new Date(), 'yyyy-MM-dd')}.log`);
    this.logStream = createWriteStream(logFile, { flags: 'a' });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const formattedEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(formattedEntry) + '\n';
  }

  private writeLog(level: LogLevel, message: string, context?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    const formattedLog = this.formatLogEntry(entry);
    
    // Записываем в файл
    this.logStream.write(formattedLog);
    
    // Выводим в консоль в development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level.toUpperCase()}] ${message}`, context ? context : '');
    }
  }

  public error(message: string, context?: any): void {
    this.writeLog(LogLevel.ERROR, message, context);
  }

  public warn(message: string, context?: any): void {
    this.writeLog(LogLevel.WARN, message, context);
  }

  public info(message: string, context?: any): void {
    this.writeLog(LogLevel.INFO, message, context);
  }

  public debug(message: string, context?: any): void {
    this.writeLog(LogLevel.DEBUG, message, context);
  }

  public logRequest(req: Request, res: Response, duration: number): void {
    const context = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id
    };

    if (res.statusCode >= 500) {
      this.error(`Server error: ${req.method} ${req.url}`, context);
    } else if (res.statusCode >= 400) {
      this.warn(`Client error: ${req.method} ${req.url}`, context);
    } else {
      this.info(`Request: ${req.method} ${req.url}`, context);
    }
  }

  public logError(error: Error, context?: any): void {
    this.error(error.message, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }

  public logSecurity(event: string, context?: any): void {
    this.warn(`Security event: ${event}`, {
      ...context,
      security: true,
      timestamp: new Date().toISOString()
    });
  }

  public logDatabase(operation: string, context?: any): void {
    this.debug(`Database operation: ${operation}`, {
      ...context,
      database: true,
      timestamp: new Date().toISOString()
    });
  }

  public logAuthentication(event: string, context?: any): void {
    this.info(`Authentication: ${event}`, {
      ...context,
      authentication: true,
      timestamp: new Date().toISOString()
    });
  }

  public logBusinessLogic(event: string, context?: any): void {
    this.info(`Business logic: ${event}`, {
      ...context,
      business: true,
      timestamp: new Date().toISOString()
    });
  }

  public close(): void {
    this.logStream.end();
  }
}

// Middleware для логирования запросов
export const requestLoggingMiddleware = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();
  const logger = Logger.getInstance();

  // Перехватываем завершение запроса
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);
  });

  next();
};

// Middleware для обработки ошибок
export const errorLoggingMiddleware = (error: Error, req: Request, res: Response, next: Function) => {
  const logger = Logger.getInstance();
  
  logger.logError(error, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id
  });

  next(error);
};

// Утилиты для логирования
export const logSecurityEvent = (event: string, context?: any) => {
  const logger = Logger.getInstance();
  logger.logSecurity(event, context);
};

export const logDatabaseOperation = (operation: string, context?: any) => {
  const logger = Logger.getInstance();
  logger.logDatabase(operation, context);
};

export const logAuthenticationEvent = (event: string, context?: any) => {
  const logger = Logger.getInstance();
  logger.logAuthentication(event, context);
};

export const logBusinessEvent = (event: string, context?: any) => {
  const logger = Logger.getInstance();
  logger.logBusinessEvent(event, context);
};


