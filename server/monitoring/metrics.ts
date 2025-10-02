import { Request, Response } from 'express';
import { Logger } from './logger';

export interface MetricData {
  name: string;
  value: number;
  timestamp: string;
  labels?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface PerformanceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per second
  };
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  errors: {
    total: number;
    rate: number; // errors per second
    byType: Record<string, number>;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      load: number;
    };
  };
  business: {
    users: {
      total: number;
      active: number;
      new: number;
    };
    requests: {
      total: number;
      pending: number;
      completed: number;
    };
    suppliers: {
      total: number;
      active: number;
      new: number;
    };
  };
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, MetricData[]> = new Map();
  private logger: Logger;
  private startTime: number;
  private requestCount: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private responseTimes: number[] = [];
  private errorCount: number = 0;
  private errorsByType: Map<string, number> = new Map();

  private constructor() {
    this.logger = Logger.getInstance();
    this.startTime = Date.now();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public recordRequest(req: Request, res: Response, duration: number): void {
    this.requestCount++;
    this.responseTimes.push(duration);

    if (res.statusCode >= 200 && res.statusCode < 400) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
      this.errorCount++;
      
      const errorType = this.getErrorType(res.statusCode);
      this.errorsByType.set(errorType, (this.errorsByType.get(errorType) || 0) + 1);
    }

    // Записываем метрику
    this.recordMetric('http_requests_total', 1, 'counter', {
      method: req.method,
      status: res.statusCode.toString(),
      endpoint: req.route?.path || req.path
    });

    this.recordMetric('http_request_duration_ms', duration, 'histogram', {
      method: req.method,
      endpoint: req.route?.path || req.path
    });
  }

  public recordMetric(
    name: string, 
    value: number, 
    type: 'counter' | 'gauge' | 'histogram' | 'summary',
    labels?: Record<string, string>
  ): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: new Date().toISOString(),
      labels,
      type
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);

    // Ограничиваем количество метрик (храним только последние 1000)
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  public recordBusinessMetric(event: string, value: number, context?: any): void {
    this.recordMetric(`business_${event}`, value, 'counter', context);
    this.logger.info(`Business metric recorded: ${event}`, { value, context });
  }

  public recordSecurityMetric(event: string, value: number, context?: any): void {
    this.recordMetric(`security_${event}`, value, 'counter', context);
    this.logger.warn(`Security metric recorded: ${event}`, { value, context });
  }

  public recordPerformanceMetric(metric: string, value: number, context?: any): void {
    this.recordMetric(`performance_${metric}`, value, 'gauge', context);
  }

  public getMetrics(): Map<string, MetricData[]> {
    return new Map(this.metrics);
  }

  public getMetric(name: string): MetricData[] {
    return this.metrics.get(name) || [];
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    const uptime = Date.now() - this.startTime;
    const uptimeSeconds = uptime / 1000;
    
    // Вычисляем процентили для времени ответа
    const sortedResponseTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedResponseTimes, 50);
    const p95 = this.calculatePercentile(sortedResponseTimes, 95);
    const p99 = this.calculatePercentile(sortedResponseTimes, 99);
    const max = Math.max(...this.responseTimes);

    return {
      requests: {
        total: this.requestCount,
        successful: this.successfulRequests,
        failed: this.failedRequests,
        rate: this.requestCount / uptimeSeconds
      },
      responseTime: {
        average: this.responseTimes.length > 0 ? 
          this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length : 0,
        p50,
        p95,
        p99,
        max
      },
      errors: {
        total: this.errorCount,
        rate: this.errorCount / uptimeSeconds,
        byType: Object.fromEntries(this.errorsByType)
      },
      system: {
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        },
        cpu: {
          usage: process.cpuUsage().user + process.cpuUsage().system,
          load: process.platform === 'linux' ? require('os').loadavg()[0] : 0
        }
      },
      business: {
        users: {
          total: 0, // В реальном приложении здесь был бы запрос к БД
          active: 0,
          new: 0
        },
        requests: {
          total: 0, // В реальном приложении здесь был бы запрос к БД
          pending: 0,
          completed: 0
        },
        suppliers: {
          total: 0, // В реальном приложении здесь был бы запрос к БД
          active: 0,
          new: 0
        }
      }
    };
  }

  public getMetricSummary(): any {
    const performanceMetrics = this.getPerformanceMetrics();
    const allMetrics = this.getMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      performance: performanceMetrics,
      metrics: Object.fromEntries(
        Array.from(allMetrics.entries()).map(([name, data]) => [
          name,
          {
            count: data.length,
            latest: data[data.length - 1],
            type: data[0]?.type
          }
        ])
      )
    };
  }

  public exportPrometheusFormat(): string {
    const allMetrics = this.getMetrics();
    let prometheusOutput = '';

    for (const [name, data] of allMetrics.entries()) {
      if (data.length === 0) continue;

      const latest = data[data.length - 1];
      const labels = latest.labels ? 
        Object.entries(latest.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',') : '';

      prometheusOutput += `# HELP ${name} ${name}\n`;
      prometheusOutput += `# TYPE ${name} ${latest.type}\n`;
      prometheusOutput += `${name}{${labels}} ${latest.value}\n`;
    }

    return prometheusOutput;
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private getErrorType(statusCode: number): string {
    if (statusCode >= 500) return 'server_error';
    if (statusCode >= 400) return 'client_error';
    return 'unknown';
  }

  public reset(): void {
    this.metrics.clear();
    this.requestCount = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.responseTimes = [];
    this.errorCount = 0;
    this.errorsByType.clear();
    this.startTime = Date.now();
  }
}

// Middleware для сбора метрик
export const metricsMiddleware = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();
  const metricsCollector = MetricsCollector.getInstance();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metricsCollector.recordRequest(req, res, duration);
  });

  next();
};

// Endpoint для получения метрик
export const metricsHandler = (req: Request, res: Response) => {
  const metricsCollector = MetricsCollector.getInstance();
  const format = req.query.format as string;

  if (format === 'prometheus') {
    res.set('Content-Type', 'text/plain');
    res.send(metricsCollector.exportPrometheusFormat());
  } else {
    res.json(metricsCollector.getMetricSummary());
  }
};

// Утилиты для записи метрик
export const recordBusinessMetric = (event: string, value: number, context?: any) => {
  const metricsCollector = MetricsCollector.getInstance();
  metricsCollector.recordBusinessMetric(event, value, context);
};

export const recordSecurityMetric = (event: string, value: number, context?: any) => {
  const metricsCollector = MetricsCollector.getInstance();
  metricsCollector.recordSecurityMetric(event, value, context);
};

export const recordPerformanceMetric = (metric: string, value: number, context?: any) => {
  const metricsCollector = MetricsCollector.getInstance();
  metricsCollector.recordPerformanceMetric(metric, value, context);
};


