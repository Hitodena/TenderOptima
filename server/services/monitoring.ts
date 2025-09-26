import { ProcessedAttachment } from './attachment-processor';
import { ProcessingError } from './error-handler';

export interface ProcessingMetrics {
  totalProcessed: number;
  successful: number;
  failed: number;
  cached: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
  errorCounts: Record<string, number>;
  fileTypeCounts: Record<string, number>;
  sizeRanges: {
    small: number;    // < 1MB
    medium: number;   // 1MB - 10MB
    large: number;    // > 10MB
  };
}

export interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  tempDirStats: {
    fileCount: number;
    totalSize: number;
  };
  cacheStats: {
    size: number;
    hitRate: number;
    missRate: number;
  };
  processingQueue: number;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: ProcessingMetrics = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    cached: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0,
    errorCounts: {},
    fileTypeCounts: {},
    sizeRanges: {
      small: 0,
      medium: 0,
      large: 0
    }
  };
  
  private processingTimes: number[] = [];
  private readonly maxProcessingTimes = 1000; // Храним последние 1000 измерений

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Записывает начало обработки
   */
  recordProcessingStart(filename: string, contentType: string, size: number): string {
    const processingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[MONITORING] Processing started: ${processingId} - ${filename} (${contentType}, ${size} bytes)`);
    
    return processingId;
  }

  /**
   * Записывает успешное завершение обработки
   */
  recordProcessingSuccess(
    processingId: string,
    filename: string,
    contentType: string,
    size: number,
    processingTime: number,
    wasCached: boolean = false
  ): void {
    this.metrics.totalProcessed++;
    this.metrics.successful++;
    
    if (wasCached) {
      this.metrics.cached++;
    }
    
    // Обновляем статистику типов файлов
    this.metrics.fileTypeCounts[contentType] = (this.metrics.fileTypeCounts[contentType] || 0) + 1;
    
    // Обновляем статистику размеров
    this.updateSizeRange(size);
    
    // Обновляем время обработки
    this.updateProcessingTime(processingTime);
    
    console.log(`[MONITORING] Processing completed: ${processingId} - ${filename} (${processingTime}ms, cached: ${wasCached})`);
  }

  /**
   * Записывает ошибку обработки
   */
  recordProcessingError(
    processingId: string,
    filename: string,
    contentType: string,
    size: number,
    error: ProcessingError,
    processingTime: number
  ): void {
    this.metrics.totalProcessed++;
    this.metrics.failed++;
    
    // Обновляем счетчики ошибок
    this.metrics.errorCounts[error.type] = (this.metrics.errorCounts[error.type] || 0) + 1;
    
    // Обновляем время обработки (даже для ошибок)
    this.updateProcessingTime(processingTime);
    
    console.error(`[MONITORING] Processing failed: ${processingId} - ${filename} (${processingTime}ms, error: ${error.type})`);
  }

  /**
   * Обновляет статистику размеров файлов
   */
  private updateSizeRange(size: number): void {
    const sizeMB = size / (1024 * 1024);
    
    if (sizeMB < 1) {
      this.metrics.sizeRanges.small++;
    } else if (sizeMB <= 10) {
      this.metrics.sizeRanges.medium++;
    } else {
      this.metrics.sizeRanges.large++;
    }
  }

  /**
   * Обновляет статистику времени обработки
   */
  private updateProcessingTime(processingTime: number): void {
    this.metrics.totalProcessingTime += processingTime;
    this.processingTimes.push(processingTime);
    
    // Ограничиваем количество хранимых измерений
    if (this.processingTimes.length > this.maxProcessingTimes) {
      this.processingTimes.shift();
    }
    
    // Пересчитываем среднее время
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalProcessed;
  }

  /**
   * Получает текущие метрики обработки
   */
  getProcessingMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Получает системные метрики
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Получаем статистику временных файлов (нужно будет передать из AttachmentProcessor)
    const tempDirStats = { fileCount: 0, totalSize: 0 }; // TODO: Получить из AttachmentProcessor
    
    // Получаем статистику кеша (нужно будет передать из AttachmentCache)
    const cacheStats = { size: 0, hitRate: 0, missRate: 0 }; // TODO: Получить из AttachmentCache
    
    return {
      memoryUsage,
      uptime,
      tempDirStats,
      cacheStats,
      processingQueue: 0 // TODO: Получить из очереди обработки
    };
  }

  /**
   * Получает детальную статистику производительности
   */
  getPerformanceStats(): {
    processingTimes: {
      min: number;
      max: number;
      median: number;
      p95: number;
      p99: number;
    };
    throughput: {
      perSecond: number;
      perMinute: number;
      perHour: number;
    };
  } {
    if (this.processingTimes.length === 0) {
      return {
        processingTimes: { min: 0, max: 0, median: 0, p95: 0, p99: 0 },
        throughput: { perSecond: 0, perMinute: 0, perHour: 0 }
      };
    }
    
    const sortedTimes = [...this.processingTimes].sort((a, b) => a - b);
    const len = sortedTimes.length;
    
    const processingTimes = {
      min: sortedTimes[0],
      max: sortedTimes[len - 1],
      median: sortedTimes[Math.floor(len / 2)],
      p95: sortedTimes[Math.floor(len * 0.95)],
      p99: sortedTimes[Math.floor(len * 0.99)]
    };
    
    // Вычисляем throughput на основе последних измерений
    const recentTimes = this.processingTimes.slice(-100); // Последние 100 измерений
    const avgTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
    
    const throughput = {
      perSecond: avgTime > 0 ? 1000 / avgTime : 0,
      perMinute: avgTime > 0 ? 60000 / avgTime : 0,
      perHour: avgTime > 0 ? 3600000 / avgTime : 0
    };
    
    return { processingTimes, throughput };
  }

  /**
   * Сбрасывает метрики
   */
  resetMetrics(): void {
    this.metrics = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      cached: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      errorCounts: {},
      fileTypeCounts: {},
      sizeRanges: {
        small: 0,
        medium: 0,
        large: 0
      }
    };
    this.processingTimes = [];
    console.log('[MONITORING] Metrics reset');
  }

  /**
   * Экспортирует метрики в JSON
   */
  exportMetrics(): string {
    const data = {
      timestamp: new Date().toISOString(),
      processing: this.getProcessingMetrics(),
      performance: this.getPerformanceStats()
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Логирует текущее состояние системы
   */
  async logSystemStatus(): Promise<void> {
    const processingMetrics = this.getProcessingMetrics();
    const systemMetrics = await this.getSystemMetrics();
    const performanceStats = this.getPerformanceStats();
    
    console.log('\n=== SYSTEM STATUS ===');
    console.log(`📊 Processing: ${processingMetrics.successful}/${processingMetrics.totalProcessed} successful (${processingMetrics.cached} cached)`);
    console.log(`⏱️  Average time: ${processingMetrics.averageProcessingTime.toFixed(2)}ms`);
    console.log(`💾 Memory: ${Math.round(systemMetrics.memoryUsage.heapUsed / 1024 / 1024)}MB used`);
    console.log(`⏰ Uptime: ${Math.round(systemMetrics.uptime / 60)} minutes`);
    console.log(`📁 Temp files: ${systemMetrics.tempDirStats.fileCount} (${Math.round(systemMetrics.tempDirStats.totalSize / 1024 / 1024)}MB)`);
    console.log(`🗄️  Cache: ${systemMetrics.cacheStats.size} entries (${(systemMetrics.cacheStats.hitRate * 100).toFixed(1)}% hit rate)`);
    console.log(`🚀 Throughput: ${performanceStats.throughput.perMinute.toFixed(1)} files/min`);
    console.log('===================\n');
  }

  /**
   * Запускает периодический мониторинг
   */
  startPeriodicMonitoring(intervalMs: number = 5 * 60 * 1000): void {
    setInterval(async () => {
      await this.logSystemStatus();
    }, intervalMs);
    
    console.log(`[MONITORING] Started periodic monitoring (interval: ${intervalMs}ms)`);
  }
}

export const monitoringService = MonitoringService.getInstance();
