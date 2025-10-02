import { Request, Response } from 'express';
import { HealthMonitor } from './health-monitor';
import { MetricsCollector } from './metrics';
import { AlertManager } from './alerts';
import { Logger } from './logger';

export interface DashboardData {
  timestamp: string;
  system: {
    status: string;
    uptime: number;
    version: string;
    environment: string;
  };
  health: {
    database: string;
    memory: number;
    cpu: number;
    responseTime: number;
  };
  performance: {
    requests: {
      total: number;
      rate: number;
      successRate: number;
    };
    responseTime: {
      average: number;
      p95: number;
      p99: number;
    };
    errors: {
      total: number;
      rate: number;
    };
  };
  alerts: {
    active: number;
    critical: number;
    warning: number;
    info: number;
  };
  business: {
    users: number;
    requests: number;
    suppliers: number;
  };
  trends: {
    requests: Array<{ timestamp: string; value: number }>;
    responseTime: Array<{ timestamp: string; value: number }>;
    errors: Array<{ timestamp: string; value: number }>;
    memory: Array<{ timestamp: string; value: number }>;
  };
}

export class Dashboard {
  private static instance: Dashboard;
  private healthMonitor: HealthMonitor;
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private logger: Logger;
  private historicalData: Map<string, any[]> = new Map();

  private constructor() {
    this.healthMonitor = HealthMonitor.getInstance();
    this.metricsCollector = MetricsCollector.getInstance();
    this.alertManager = AlertManager.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): Dashboard {
    if (!Dashboard.instance) {
      Dashboard.instance = new Dashboard();
    }
    return Dashboard.instance;
  }

  public async getDashboardData(): Promise<DashboardData> {
    try {
      const healthStatus = await this.healthMonitor.getHealthStatus();
      const performanceMetrics = this.metricsCollector.getPerformanceMetrics();
      const activeAlerts = this.alertManager.getActiveAlerts();

      const dashboardData: DashboardData = {
        timestamp: new Date().toISOString(),
        system: {
          status: healthStatus.status,
          uptime: healthStatus.uptime,
          version: healthStatus.version,
          environment: healthStatus.environment
        },
        health: {
          database: healthStatus.database.status,
          memory: healthStatus.memory.percentage,
          cpu: healthStatus.cpu.usage,
          responseTime: healthStatus.requests.averageResponseTime
        },
        performance: {
          requests: {
            total: performanceMetrics.requests.total,
            rate: performanceMetrics.requests.rate,
            successRate: performanceMetrics.requests.total > 0 ? 
              (performanceMetrics.requests.successful / performanceMetrics.requests.total) * 100 : 0
          },
          responseTime: {
            average: performanceMetrics.responseTime.average,
            p95: performanceMetrics.responseTime.p95,
            p99: performanceMetrics.responseTime.p99
          },
          errors: {
            total: performanceMetrics.errors.total,
            rate: performanceMetrics.errors.rate
          }
        },
        alerts: {
          active: activeAlerts.length,
          critical: activeAlerts.filter(alert => alert.type === 'critical').length,
          warning: activeAlerts.filter(alert => alert.type === 'warning').length,
          info: activeAlerts.filter(alert => alert.type === 'info').length
        },
        business: {
          users: performanceMetrics.business.users.total,
          requests: performanceMetrics.business.requests.total,
          suppliers: performanceMetrics.business.suppliers.total
        },
        trends: {
          requests: this.getTrendData('requests'),
          responseTime: this.getTrendData('responseTime'),
          errors: this.getTrendData('errors'),
          memory: this.getTrendData('memory')
        }
      };

      return dashboardData;
    } catch (error) {
      this.logger.error('Failed to get dashboard data', { error });
      throw error;
    }
  }

  public async getSystemOverview(): Promise<any> {
    const healthStatus = await this.healthMonitor.getHealthStatus();
    const performanceMetrics = this.metricsCollector.getPerformanceMetrics();
    const activeAlerts = this.alertManager.getActiveAlerts();

    return {
      status: healthStatus.status,
      uptime: healthStatus.uptime,
      requests: {
        total: performanceMetrics.requests.total,
        rate: performanceMetrics.requests.rate,
        successRate: performanceMetrics.requests.total > 0 ? 
          (performanceMetrics.requests.successful / performanceMetrics.requests.total) * 100 : 0
      },
      performance: {
        responseTime: performanceMetrics.responseTime.average,
        memory: performanceMetrics.system.memory.percentage,
        cpu: performanceMetrics.system.cpu.usage
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(alert => alert.type === 'critical').length
      }
    };
  }

  public async getPerformanceReport(): Promise<any> {
    const performanceMetrics = this.metricsCollector.getPerformanceMetrics();
    const allMetrics = this.metricsCollector.getMetrics();

    return {
      timestamp: new Date().toISOString(),
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

  public async getAlertsReport(): Promise<any> {
    const activeAlerts = this.alertManager.getActiveAlerts();
    const alertsByCategory = this.alertManager.getAlertsByCategory;
    const alertsByType = this.alertManager.getAlertsByType;

    return {
      timestamp: new Date().toISOString(),
      active: activeAlerts,
      summary: {
        total: activeAlerts.length,
        critical: activeAlerts.filter(alert => alert.type === 'critical').length,
        warning: activeAlerts.filter(alert => alert.type === 'warning').length,
        info: activeAlerts.filter(alert => alert.type === 'info').length
      },
      byCategory: {
        system: alertsByCategory('system').length,
        database: alertsByCategory('database').length,
        security: alertsByCategory('security').length,
        performance: alertsByCategory('performance').length,
        business: alertsByCategory('business').length
      },
      byType: {
        critical: alertsByType('critical').length,
        warning: alertsByType('warning').length,
        info: alertsByType('info').length
      }
    };
  }

  public async getBusinessMetrics(): Promise<any> {
    const performanceMetrics = this.metricsCollector.getPerformanceMetrics();
    const businessMetrics = this.metricsCollector.getMetric('business_');

    return {
      timestamp: new Date().toISOString(),
      users: performanceMetrics.business.users,
      requests: performanceMetrics.business.requests,
      suppliers: performanceMetrics.business.suppliers,
      metrics: businessMetrics
    };
  }

  private getTrendData(metric: string): Array<{ timestamp: string; value: number }> {
    const data = this.historicalData.get(metric) || [];
    return data.slice(-24); // Последние 24 точки данных
  }

  public recordHistoricalData(): void {
    const timestamp = new Date().toISOString();
    const performanceMetrics = this.metricsCollector.getPerformanceMetrics();

    // Записываем исторические данные
    this.recordDataPoint('requests', { timestamp, value: performanceMetrics.requests.rate });
    this.recordDataPoint('responseTime', { timestamp, value: performanceMetrics.responseTime.average });
    this.recordDataPoint('errors', { timestamp, value: performanceMetrics.errors.rate });
    this.recordDataPoint('memory', { timestamp, value: performanceMetrics.system.memory.percentage });

    // Ограничиваем количество исторических данных (храним только последние 1000 точек)
    for (const [key, data] of this.historicalData.entries()) {
      if (data.length > 1000) {
        this.historicalData.set(key, data.slice(-1000));
      }
    }
  }

  private recordDataPoint(metric: string, dataPoint: any): void {
    if (!this.historicalData.has(metric)) {
      this.historicalData.set(metric, []);
    }
    this.historicalData.get(metric)!.push(dataPoint);
  }

  public startHistoricalDataCollection(): void {
    // Записываем исторические данные каждые 5 минут
    setInterval(() => {
      this.recordHistoricalData();
    }, 5 * 60 * 1000);

    this.logger.info('Historical data collection started');
  }

  public stopHistoricalDataCollection(): void {
    this.logger.info('Historical data collection stopped');
  }
}

// Endpoint для дашборда
export const dashboardHandler = async (req: Request, res: Response) => {
  try {
    const dashboard = Dashboard.getInstance();
    const dashboardData = await dashboard.getDashboardData();
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
};

// Endpoint для системного обзора
export const systemOverviewHandler = async (req: Request, res: Response) => {
  try {
    const dashboard = Dashboard.getInstance();
    const overview = await dashboard.getSystemOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system overview' });
  }
};

// Endpoint для отчета о производительности
export const performanceReportHandler = async (req: Request, res: Response) => {
  try {
    const dashboard = Dashboard.getInstance();
    const report = await dashboard.getPerformanceReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get performance report' });
  }
};

// Endpoint для отчета об алертах
export const alertsReportHandler = async (req: Request, res: Response) => {
  try {
    const dashboard = Dashboard.getInstance();
    const report = await dashboard.getAlertsReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get alerts report' });
  }
};

// Endpoint для бизнес-метрик
export const businessMetricsHandler = async (req: Request, res: Response) => {
  try {
    const dashboard = Dashboard.getInstance();
    const metrics = await dashboard.getBusinessMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get business metrics' });
  }
};


