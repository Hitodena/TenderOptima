import { Request, Response } from 'express';
import { db } from '../db';
import { users, searchRequests, supplierResponses } from '@shared/schema';
import { count, eq, and, gte } from 'drizzle-orm';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  database: {
    status: 'connected' | 'disconnected';
    responseTime: number;
    connections: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    load: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  errors: {
    count: number;
    lastError?: string;
    criticalErrors: number;
  };
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private startTime: number;
  private requestCount: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private totalResponseTime: number = 0;
  private errorCount: number = 0;
  private criticalErrorCount: number = 0;
  private lastError: string | undefined;

  private constructor() {
    this.startTime = Date.now();
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  public recordRequest(responseTime: number, success: boolean): void {
    this.requestCount++;
    this.totalResponseTime += responseTime;
    
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
  }

  public recordError(error: string, critical: boolean = false): void {
    this.errorCount++;
    this.lastError = error;
    
    if (critical) {
      this.criticalErrorCount++;
    }
  }

  public async getHealthStatus(): Promise<HealthStatus> {
    const uptime = Date.now() - this.startTime;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Проверяем подключение к БД
    const dbStartTime = Date.now();
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let dbResponseTime = 0;
    let dbConnections = 0;

    try {
      await db.select({ count: count() }).from(users);
      dbStatus = 'connected';
      dbResponseTime = Date.now() - dbStartTime;
      dbConnections = 1; // В реальном приложении здесь был бы пул соединений
    } catch (error) {
      this.recordError(`Database connection failed: ${error}`, true);
    }

    // Вычисляем метрики
    const averageResponseTime = this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const cpuUsageMs = (cpuUsage.user + cpuUsage.system) / 1000;

    // Определяем общий статус
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (dbStatus === 'disconnected' || this.criticalErrorCount > 0) {
      status = 'unhealthy';
    } else if (this.failedRequests > this.successfulRequests * 0.1 || memoryPercentage > 90) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
        connections: dbConnections
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: memoryPercentage
      },
      cpu: {
        usage: cpuUsageMs,
        load: process.platform === 'linux' ? require('os').loadavg()[0] : 0
      },
      requests: {
        total: this.requestCount,
        successful: this.successfulRequests,
        failed: this.failedRequests,
        averageResponseTime: averageResponseTime
      },
      errors: {
        count: this.errorCount,
        lastError: this.lastError,
        criticalErrors: this.criticalErrorCount
      }
    };
  }

  public async getDetailedMetrics(): Promise<any> {
    const healthStatus = await this.getHealthStatus();
    
    // Дополнительные метрики
    const additionalMetrics = {
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
        uptime: process.uptime()
      },
      application: {
        requestsPerMinute: this.calculateRequestsPerMinute(),
        errorRate: this.calculateErrorRate(),
        successRate: this.calculateSuccessRate()
      }
    };

    return {
      ...healthStatus,
      ...additionalMetrics
    };
  }

  private calculateRequestsPerMinute(): number {
    const uptimeMinutes = (Date.now() - this.startTime) / (1000 * 60);
    return uptimeMinutes > 0 ? this.requestCount / uptimeMinutes : 0;
  }

  private calculateErrorRate(): number {
    return this.requestCount > 0 ? (this.failedRequests / this.requestCount) * 100 : 0;
  }

  private calculateSuccessRate(): number {
    return this.requestCount > 0 ? (this.successfulRequests / this.requestCount) * 100 : 0;
  }
}

// Middleware для записи метрик
export const healthMonitoringMiddleware = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();
  const monitor = HealthMonitor.getInstance();

  // Перехватываем завершение запроса
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 400;
    
    monitor.recordRequest(responseTime, success);
    
    if (!success) {
      monitor.recordError(`HTTP ${res.statusCode}: ${req.method} ${req.path}`);
    }
  });

  next();
};

// Endpoint для health check
export const healthCheckHandler = async (req: Request, res: Response) => {
  try {
    const monitor = HealthMonitor.getInstance();
    const healthStatus = await monitor.getHealthStatus();
    
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
};

// Endpoint для детальных метрик
export const metricsHandler = async (req: Request, res: Response) => {
  try {
    const monitor = HealthMonitor.getInstance();
    const metrics = await monitor.getDetailedMetrics();
    
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics'
    });
  }
};


