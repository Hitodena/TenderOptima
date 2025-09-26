import { attachmentProcessor } from './services/attachment-processor';
import { batchDatabaseService } from './services/batch-database';

/**
 * Конфигурация системы обработки вложений
 * Измените эти параметры для настройки системы
 */
export class AttachmentConfig {
  
  /**
   * Инициализация системы с оптимальными настройками
   */
  static initialize() {
    console.log('🔧 Initializing attachment processing system...');
    
    // Настройки кеша
    attachmentProcessor.setCacheMaxSize(1000); // Максимум 1000 записей в кеше
    attachmentProcessor.setCacheTTL(24 * 60 * 60 * 1000); // 24 часа TTL
    
    // Настройки batch операций
    batchDatabaseService.setBatchSize(10); // Batch размер 10 записей
    
    // Запуск мониторинга
    attachmentProcessor.startMonitoring(5 * 60 * 1000); // Каждые 5 минут
    
    console.log('✅ Attachment processing system initialized');
  }
  
  /**
   * Настройки для высокой нагрузки
   */
  static configureForHighLoad() {
    console.log('🚀 Configuring for high load...');
    
    // Больший кеш для высокой нагрузки
    attachmentProcessor.setCacheMaxSize(2000);
    attachmentProcessor.setCacheTTL(12 * 60 * 60 * 1000); // 12 часов
    
    // Больший batch размер
    batchDatabaseService.setBatchSize(20);
    
    // Более частый мониторинг
    attachmentProcessor.startMonitoring(2 * 60 * 1000); // Каждые 2 минуты
    
    console.log('✅ High load configuration applied');
  }
  
  /**
   * Настройки для экономии ресурсов
   */
  static configureForResourceSaving() {
    console.log('💾 Configuring for resource saving...');
    
    // Меньший кеш
    attachmentProcessor.setCacheMaxSize(500);
    attachmentProcessor.setCacheTTL(6 * 60 * 60 * 1000); // 6 часов
    
    // Меньший batch размер
    batchDatabaseService.setBatchSize(5);
    
    // Реже мониторинг
    attachmentProcessor.startMonitoring(10 * 60 * 1000); // Каждые 10 минут
    
    console.log('✅ Resource saving configuration applied');
  }
  
  /**
   * Настройки для разработки
   */
  static configureForDevelopment() {
    console.log('🛠️ Configuring for development...');
    
    // Небольшой кеш для разработки
    attachmentProcessor.setCacheMaxSize(100);
    attachmentProcessor.setCacheTTL(60 * 60 * 1000); // 1 час
    
    // Малый batch размер
    batchDatabaseService.setBatchSize(3);
    
    // Частый мониторинг для отладки
    attachmentProcessor.startMonitoring(60 * 1000); // Каждую минуту
    
    console.log('✅ Development configuration applied');
  }
  
  /**
   * Получить текущие настройки
   */
  static getCurrentConfig() {
    return {
      cache: {
        maxSize: attachmentProcessor.getCacheStats().size,
        ttl: '24 hours (default)'
      },
      batch: {
        size: batchDatabaseService.getBatchSize()
      },
      monitoring: {
        enabled: true,
        interval: '5 minutes (default)'
      }
    };
  }
  
  /**
   * Сбросить все настройки к значениям по умолчанию
   */
  static resetToDefaults() {
    console.log('🔄 Resetting to default configuration...');
    
    // Очищаем кеш
    attachmentProcessor.clearCache();
    
    // Сбрасываем метрики
    attachmentProcessor.getProcessingMetrics();
    
    // Применяем настройки по умолчанию
    this.initialize();
    
    console.log('✅ Configuration reset to defaults');
  }
}

// Автоматическая инициализация при импорте
if (process.env.NODE_ENV !== 'test') {
  AttachmentConfig.initialize();
}
