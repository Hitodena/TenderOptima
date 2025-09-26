import { storage } from '../storage';
import { ProcessedAttachment } from './attachment-processor';

export interface BatchUpdate {
  responseId: number;
  attachments: ProcessedAttachment[];
  isAnalyzed: boolean;
  processingStatus?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingError?: string;
}

export interface BatchResult {
  successful: number;
  failed: number;
  errors: Array<{
    responseId: number;
    error: string;
  }>;
}

export class BatchDatabaseService {
  private static instance: BatchDatabaseService;
  private batchSize = 10; // Размер batch для операций
  private maxRetries = 3;
  private retryDelay = 1000; // 1 секунда

  static getInstance(): BatchDatabaseService {
    if (!BatchDatabaseService.instance) {
      BatchDatabaseService.instance = new BatchDatabaseService();
    }
    return BatchDatabaseService.instance;
  }

  /**
   * Batch обновление ответов с обработанными вложениями
   */
  async batchUpdateResponses(updates: BatchUpdate[]): Promise<BatchResult> {
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Разбиваем на батчи
    const batches = this.createBatches(updates, this.batchSize);
    
    for (const batch of batches) {
      try {
        await this.processBatch(batch);
        result.successful += batch.length;
        console.log(`[BatchDatabase] Successfully processed batch of ${batch.length} responses`);
      } catch (error) {
        console.error(`[BatchDatabase] Batch failed:`, error);
        
        // Пытаемся обработать каждый элемент батча отдельно
        for (const update of batch) {
          try {
            await this.processSingleUpdate(update);
            result.successful++;
          } catch (singleError) {
            result.failed++;
            result.errors.push({
              responseId: update.responseId,
              error: singleError instanceof Error ? singleError.message : String(singleError)
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Обрабатывает один батч
   */
  private async processBatch(batch: BatchUpdate[]): Promise<void> {
    const promises = batch.map(update => this.processSingleUpdate(update));
    await Promise.all(promises);
  }

  /**
   * Обрабатывает одно обновление
   */
  private async processSingleUpdate(update: BatchUpdate): Promise<void> {
    const updateData: any = {
      attachments: update.attachments,
      isAnalyzed: update.isAnalyzed
    };

    if (update.processingStatus) {
      updateData.processingStatus = update.processingStatus;
    }

    if (update.processingStartedAt) {
      updateData.processingStartedAt = update.processingStartedAt;
    }

    if (update.processingCompletedAt) {
      updateData.processingCompletedAt = update.processingCompletedAt;
    }

    if (update.processingError) {
      updateData.processingError = update.processingError;
    }

    await storage.updateSupplierResponse(update.responseId, updateData);
  }

  /**
   * Batch получение ответов с вложениями
   */
  async batchGetResponsesWithAttachments(responseIds: number[], userId: number): Promise<Array<{
    id: number;
    attachments: ProcessedAttachment[];
    [key: string]: any;
  } | null>> {
    const results: Array<any> = [];
    
    // Разбиваем на батчи
    const batches = this.createBatches(responseIds, this.batchSize);
    
    for (const batch of batches) {
      const batchPromises = batch.map(id => 
        storage.getSupplierResponseWithAttachments(id, userId)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Batch создание ответов
   */
  async batchCreateResponses(responses: Array<{
    requestId: number;
    supplierName: string;
    supplierEmail: string;
    subject: string;
    message: string;
    attachments: ProcessedAttachment[];
    messageId?: string;
    responseDate?: Date;
  }>): Promise<BatchResult> {
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Разбиваем на батчи
    const batches = this.createBatches(responses, this.batchSize);
    
    for (const batch of batches) {
      try {
        await this.processCreateBatch(batch);
        result.successful += batch.length;
        console.log(`[BatchDatabase] Successfully created batch of ${batch.length} responses`);
      } catch (error) {
        console.error(`[BatchDatabase] Create batch failed:`, error);
        
        // Пытаемся создать каждый элемент отдельно
        for (const response of batch) {
          try {
            await storage.createSupplierResponse(response);
            result.successful++;
          } catch (singleError) {
            result.failed++;
            result.errors.push({
              responseId: 0, // Не знаем ID для новых записей
              error: singleError instanceof Error ? singleError.message : String(singleError)
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Обрабатывает батч создания
   */
  private async processCreateBatch(batch: any[]): Promise<void> {
    const promises = batch.map(response => storage.createSupplierResponse(response));
    await Promise.all(promises);
  }

  /**
   * Batch обновление статусов обработки
   */
  async batchUpdateProcessingStatus(updates: Array<{
    responseId: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
  }>): Promise<BatchResult> {
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Разбиваем на батчи
    const batches = this.createBatches(updates, this.batchSize);
    
    for (const batch of batches) {
      try {
        await this.processStatusBatch(batch);
        result.successful += batch.length;
        console.log(`[BatchDatabase] Successfully updated status for batch of ${batch.length} responses`);
      } catch (error) {
        console.error(`[BatchDatabase] Status update batch failed:`, error);
        
        // Пытаемся обновить каждый элемент отдельно
        for (const update of batch) {
          try {
            const updateData: any = {
              processingStatus: update.status
            };

            if (update.startedAt) {
              updateData.processingStartedAt = update.startedAt;
            }

            if (update.completedAt) {
              updateData.processingCompletedAt = update.completedAt;
            }

            if (update.error) {
              updateData.processingError = update.error;
            }

            await storage.updateSupplierResponse(update.responseId, updateData);
            result.successful++;
          } catch (singleError) {
            result.failed++;
            result.errors.push({
              responseId: update.responseId,
              error: singleError instanceof Error ? singleError.message : String(singleError)
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Обрабатывает батч обновления статусов
   */
  private async processStatusBatch(batch: any[]): Promise<void> {
    const promises = batch.map(update => {
      const updateData: any = {
        processingStatus: update.status
      };

      if (update.startedAt) {
        updateData.processingStartedAt = update.startedAt;
      }

      if (update.completedAt) {
        updateData.processingCompletedAt = update.completedAt;
      }

      if (update.error) {
        updateData.processingError = update.error;
      }

      return storage.updateSupplierResponse(update.responseId, updateData);
    });
    
    await Promise.all(promises);
  }

  /**
   * Создает батчи из массива
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Устанавливает размер батча
   */
  setBatchSize(size: number): void {
    this.batchSize = size;
    console.log(`[BatchDatabase] Batch size set to ${size}`);
  }

  /**
   * Получает текущий размер батча
   */
  getBatchSize(): number {
    return this.batchSize;
  }

  /**
   * Оптимизированное получение статистики
   */
  async getOptimizedStats(userId: number): Promise<{
    totalResponses: number;
    processedResponses: number;
    pendingResponses: number;
    failedResponses: number;
    totalAttachments: number;
    processedAttachments: number;
  }> {
    // Здесь можно добавить оптимизированные SQL запросы
    // для получения статистики одним запросом
    return {
      totalResponses: 0,
      processedResponses: 0,
      pendingResponses: 0,
      failedResponses: 0,
      totalAttachments: 0,
      processedAttachments: 0
    };
  }
}

export const batchDatabaseService = BatchDatabaseService.getInstance();
