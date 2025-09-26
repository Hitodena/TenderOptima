import { attachmentProcessor } from './services/attachment-processor';
import { batchDatabaseService } from './services/batch-database';

/**
 * Конфигурация через переменные окружения
 */
export class AttachmentEnvConfig {
  
  /**
   * Загружает настройки из переменных окружения
   */
  static loadFromEnvironment() {
    console.log('🔧 Loading attachment processing configuration from environment...');
    
    // Настройки кеша из переменных окружения
    const cacheMaxSize = process.env.ATTACHMENT_CACHE_MAX_SIZE 
      ? parseInt(process.env.ATTACHMENT_CACHE_MAX_SIZE) 
      : 1000;
    
    const cacheTTL = process.env.ATTACHMENT_CACHE_TTL 
      ? parseInt(process.env.ATTACHMENT_CACHE_TTL) 
      : 24 * 60 * 60 * 1000; // 24 часа
    
    // Настройки batch операций
    const batchSize = process.env.ATTACHMENT_BATCH_SIZE 
      ? parseInt(process.env.ATTACHMENT_BATCH_SIZE) 
      : 10;
    
    // Интервал мониторинга
    const monitoringInterval = process.env.ATTACHMENT_MONITORING_INTERVAL 
      ? parseInt(process.env.ATTACHMENT_MONITORING_INTERVAL) 
      : 5 * 60 * 1000; // 5 минут
    
    // Применяем настройки
    attachmentProcessor.setCacheMaxSize(cacheMaxSize);
    attachmentProcessor.setCacheTTL(cacheTTL);
    batchDatabaseService.setBatchSize(batchSize);
    
    // Запускаем мониторинг если включен
    if (process.env.ATTACHMENT_MONITORING_ENABLED === 'true') {
      attachmentProcessor.startMonitoring(monitoringInterval);
    }
    
    console.log('✅ Attachment processing configuration loaded from environment');
    console.log(`   Cache: maxSize=${cacheMaxSize}, TTL=${cacheTTL}ms`);
    console.log(`   Batch: size=${batchSize}`);
    console.log(`   Monitoring: ${process.env.ATTACHMENT_MONITORING_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Получает текущие настройки из переменных окружения
   */
  static getEnvironmentConfig() {
    return {
      cache: {
        maxSize: process.env.ATTACHMENT_CACHE_MAX_SIZE || '1000',
        ttl: process.env.ATTACHMENT_CACHE_TTL || '86400000',
        enabled: process.env.ATTACHMENT_CACHE_ENABLED !== 'false'
      },
      batch: {
        size: process.env.ATTACHMENT_BATCH_SIZE || '10'
      },
      monitoring: {
        enabled: process.env.ATTACHMENT_MONITORING_ENABLED === 'true',
        interval: process.env.ATTACHMENT_MONITORING_INTERVAL || '300000'
      },
      processing: {
        timeout: process.env.ATTACHMENT_PROCESSING_TIMEOUT || '60000',
        maxFileSize: process.env.ATTACHMENT_MAX_FILE_SIZE || '52428800', // 50MB
        retryCount: process.env.ATTACHMENT_RETRY_COUNT || '3'
      }
    };
  }
}

// Автоматическая загрузка при импорте
if (process.env.NODE_ENV !== 'test') {
  AttachmentEnvConfig.loadFromEnvironment();
}
