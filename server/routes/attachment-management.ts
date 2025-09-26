import { Express } from 'express';
import { attachmentProcessor } from '../services/attachment-processor';
import { batchDatabaseService } from '../services/batch-database';
import { monitoringService } from '../services/monitoring';
import { requireAuth } from '../middleware/requireAuth';

export function registerAttachmentManagementRoutes(app: Express) {
  
  // Получение статистики обработки
  app.get('/api/attachment-stats', requireAuth, async (req, res) => {
    try {
      const stats = attachmentProcessor.exportAllMetrics();
      res.json(stats);
    } catch (error) {
      console.error('Error getting attachment stats:', error);
      res.status(500).json({ message: 'Failed to get attachment statistics', error: String(error) });
    }
  });

  // Получение статистики кеша
  app.get('/api/cache-stats', requireAuth, async (req, res) => {
    try {
      const cacheStats = attachmentProcessor.getCacheStats();
      const cacheInfo = attachmentProcessor.getCacheInfo();
      
      res.json({
        stats: cacheStats,
        entries: cacheInfo
      });
    } catch (error) {
      console.error('Error getting cache stats:', error);
      res.status(500).json({ message: 'Failed to get cache statistics', error: String(error) });
    }
  });

  // Очистка кеша
  app.post('/api/cache/clear', requireAuth, async (req, res) => {
    try {
      attachmentProcessor.clearCache();
      res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({ message: 'Failed to clear cache', error: String(error) });
    }
  });

  // Принудительная очистка устаревших записей кеша
  app.post('/api/cache/cleanup', requireAuth, async (req, res) => {
    try {
      const removedCount = attachmentProcessor.cleanupCache();
      res.json({ 
        message: `Cleaned up ${removedCount} expired cache entries`,
        removedCount 
      });
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      res.status(500).json({ message: 'Failed to cleanup cache', error: String(error) });
    }
  });

  // Настройка параметров кеша
  app.post('/api/cache/config', requireAuth, async (req, res) => {
    try {
      const { maxSize, ttl } = req.body;
      
      if (maxSize !== undefined) {
        attachmentProcessor.setCacheMaxSize(maxSize);
      }
      
      if (ttl !== undefined) {
        attachmentProcessor.setCacheTTL(ttl);
      }
      
      res.json({ 
        message: 'Cache configuration updated',
        maxSize: maxSize,
        ttl: ttl
      });
    } catch (error) {
      console.error('Error updating cache config:', error);
      res.status(500).json({ message: 'Failed to update cache configuration', error: String(error) });
    }
  });

  // Получение статистики временных файлов
  app.get('/api/temp-files-stats', requireAuth, async (req, res) => {
    try {
      const tempStats = await attachmentProcessor.getTempDirStats();
      res.json(tempStats);
    } catch (error) {
      console.error('Error getting temp files stats:', error);
      res.status(500).json({ message: 'Failed to get temp files statistics', error: String(error) });
    }
  });

  // Очистка временных файлов
  app.post('/api/temp-files/cleanup', requireAuth, async (req, res) => {
    try {
      await attachmentProcessor.cleanupAllTempFiles();
      res.json({ message: 'Temporary files cleaned up successfully' });
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
      res.status(500).json({ message: 'Failed to cleanup temporary files', error: String(error) });
    }
  });

  // Получение системных метрик
  app.get('/api/system-metrics', requireAuth, async (req, res) => {
    try {
      const systemMetrics = await attachmentProcessor.getSystemMetrics();
      const processingMetrics = attachmentProcessor.getProcessingMetrics();
      const performanceStats = attachmentProcessor.getPerformanceStats();
      
      res.json({
        system: systemMetrics,
        processing: processingMetrics,
        performance: performanceStats
      });
    } catch (error) {
      console.error('Error getting system metrics:', error);
      res.status(500).json({ message: 'Failed to get system metrics', error: String(error) });
    }
  });

  // Логирование текущего состояния системы
  app.post('/api/system/status', requireAuth, async (req, res) => {
    try {
      await attachmentProcessor.logSystemStatus();
      res.json({ message: 'System status logged to console' });
    } catch (error) {
      console.error('Error logging system status:', error);
      res.status(500).json({ message: 'Failed to log system status', error: String(error) });
    }
  });

  // Запуск мониторинга
  app.post('/api/monitoring/start', requireAuth, async (req, res) => {
    try {
      const { intervalMs } = req.body;
      attachmentProcessor.startMonitoring(intervalMs || 5 * 60 * 1000);
      res.json({ message: 'Monitoring started successfully' });
    } catch (error) {
      console.error('Error starting monitoring:', error);
      res.status(500).json({ message: 'Failed to start monitoring', error: String(error) });
    }
  });

  // Получение статистики batch операций
  app.get('/api/batch-stats', requireAuth, async (req, res) => {
    try {
      const batchSize = batchDatabaseService.getBatchSize();
      res.json({ 
        batchSize,
        message: 'Batch operations statistics retrieved'
      });
    } catch (error) {
      console.error('Error getting batch stats:', error);
      res.status(500).json({ message: 'Failed to get batch statistics', error: String(error) });
    }
  });

  // Настройка размера batch операций
  app.post('/api/batch/config', requireAuth, async (req, res) => {
    try {
      const { batchSize } = req.body;
      
      if (batchSize && batchSize > 0) {
        batchDatabaseService.setBatchSize(batchSize);
        res.json({ 
          message: `Batch size updated to ${batchSize}`,
          batchSize 
        });
      } else {
        res.status(400).json({ message: 'Invalid batch size provided' });
      }
    } catch (error) {
      console.error('Error updating batch config:', error);
      res.status(500).json({ message: 'Failed to update batch configuration', error: String(error) });
    }
  });

  // Экспорт всех метрик
  app.get('/api/metrics/export', requireAuth, async (req, res) => {
    try {
      const allMetrics = attachmentProcessor.exportAllMetrics();
      const timestamp = new Date().toISOString();
      
      res.json({
        timestamp,
        metrics: allMetrics
      });
    } catch (error) {
      console.error('Error exporting metrics:', error);
      res.status(500).json({ message: 'Failed to export metrics', error: String(error) });
    }
  });

  // Сброс всех метрик
  app.post('/api/metrics/reset', requireAuth, async (req, res) => {
    try {
      // Сбрасываем метрики мониторинга
      monitoringService.resetMetrics();
      
      // Очищаем кеш
      attachmentProcessor.clearCache();
      
      // Очищаем временные файлы
      await attachmentProcessor.cleanupAllTempFiles();
      
      res.json({ message: 'All metrics and caches reset successfully' });
    } catch (error) {
      console.error('Error resetting metrics:', error);
      res.status(500).json({ message: 'Failed to reset metrics', error: String(error) });
    }
  });

  // Получение информации о производительности
  app.get('/api/performance', requireAuth, async (req, res) => {
    try {
      const performanceStats = attachmentProcessor.getPerformanceStats();
      const processingMetrics = attachmentProcessor.getProcessingMetrics();
      const cacheStats = attachmentProcessor.getCacheStats();
      
      res.json({
        performance: performanceStats,
        processing: processingMetrics,
        cache: cacheStats
      });
    } catch (error) {
      console.error('Error getting performance info:', error);
      res.status(500).json({ message: 'Failed to get performance information', error: String(error) });
    }
  });
}
