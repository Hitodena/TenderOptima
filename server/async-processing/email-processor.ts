import { storage } from '../storage';
import { SupplierResponse } from '@shared/schema';
import { attachmentProcessor, Attachment, ProcessedAttachment } from '../services/attachment-processor';
import { batchDatabaseService } from '../services/batch-database';

export class AsyncEmailProcessor {
  private static instance: AsyncEmailProcessor;
  private processingQueue: Set<number> = new Set();
  private maxRetries = 3;
  private retryDelay = 5000; // 5 секунд

  static getInstance(): AsyncEmailProcessor {
    if (!AsyncEmailProcessor.instance) {
      AsyncEmailProcessor.instance = new AsyncEmailProcessor();
    }
    return AsyncEmailProcessor.instance;
  }

  /**
   * Обрабатывает новый email асинхронно
   */
  async processNewEmail(response: SupplierResponse): Promise<void> {
    try {
      console.log(`[AsyncEmailProcessor] Начинаем обработку email ID: ${response.id}`);
      console.log(`[AsyncEmailProcessor] Email имеет ${(response.attachments as any[])?.length || 0} вложений`);
      
      // Обновляем статус на 'processing'
      await this.updateProcessingStatus(response.id, 'processing', new Date());
      
      // Запускаем асинхронную обработку
      this.startAsyncProcessing(response.id);
      
    } catch (error) {
      console.error(`[AsyncEmailProcessor] Ошибка при запуске обработки email ID: ${response.id}`, error);
      await this.updateProcessingStatus(response.id, 'failed', null, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Запускает асинхронную обработку с retry логикой
   */
  private async startAsyncProcessing(responseId: number, retryCount = 0): Promise<void> {
    if (this.processingQueue.has(responseId)) {
      console.log(`[AsyncEmailProcessor] Email ID: ${responseId} уже в очереди обработки`);
      return;
    }

    this.processingQueue.add(responseId);

    try {
      console.log(`[AsyncEmailProcessor] Обрабатываем email ID: ${responseId} (попытка ${retryCount + 1})`);
      
      // Получаем полные данные ответа
      const response = await storage.getSupplierResponseById(responseId);
      if (!response) {
        throw new Error(`Response with ID ${responseId} not found`);
      }

      // Обрабатываем вложения через единый сервис
      const attachments = (response.attachments as any[]) || [];
      console.log(`[AsyncEmailProcessor] Обрабатываем ${attachments.length} вложений для email ID: ${responseId}`);
      
      const processedAttachments = await attachmentProcessor.processAttachments(attachments, {
        timeout: 120000, // 120 секунд (OCR может занимать больше времени)
        maxFileSize: 50 * 1024 * 1024, // 50MB
        retryCount: 3
      });
      
      console.log(`[AsyncEmailProcessor] Обработано ${processedAttachments.length} вложений для email ID: ${responseId}`);
      
      // Детальное логирование результатов обработки
      processedAttachments.forEach((attachment, index) => {
        console.log(`[AsyncEmailProcessor] Attachment ${index + 1}: ${attachment.filename}`);
        console.log(`[AsyncEmailProcessor] - ContentType: ${attachment.contentType}`);
        console.log(`[AsyncEmailProcessor] - Has extractedText: ${!!attachment.extractedText}`);
        console.log(`[AsyncEmailProcessor] - ExtractedText length: ${attachment.extractedText?.length || 0}`);
        if (attachment.extractedText && attachment.extractedText.length > 0) {
          console.log(`[AsyncEmailProcessor] - ExtractedText preview: ${attachment.extractedText.substring(0, 200)}...`);
          
          // Проверяем качество извлеченного текста
          const hasErrors = attachment.extractedText.includes('Error extracting') || 
                           attachment.extractedText.includes('Ошибка') ||
                           attachment.extractedText.includes('No text found');
          console.log(`[AsyncEmailProcessor] - Text quality: ${hasErrors ? 'POOR (has errors)' : 'GOOD'}`);
        } else {
          console.log(`[AsyncEmailProcessor] - WARNING: No text extracted from attachment`);
        }
      });
      
      // Используем batch обновление для оптимизации
      const batchResult = await batchDatabaseService.batchUpdateResponses([{
        responseId: responseId,
        attachments: processedAttachments,
        isAnalyzed: true,
        processingStatus: 'completed',
        processingCompletedAt: new Date()
      }]);
      
      if (batchResult.failed > 0) {
        console.error(`[AsyncEmailProcessor] Batch update failed for response ${responseId}:`, batchResult.errors);
        throw new Error(`Failed to update response ${responseId}: ${batchResult.errors[0]?.error}`);
      }

      // Обновляем статус на 'completed'
      await this.updateProcessingStatus(responseId, 'completed', null, null, new Date());
      
      console.log(`[AsyncEmailProcessor] ✅ Email ID: ${responseId} успешно обработан`);
      
    } catch (error) {
      console.error(`[AsyncEmailProcessor] ❌ Ошибка обработки email ID: ${responseId}`, error);
      
      if (retryCount < this.maxRetries) {
        console.log(`[AsyncEmailProcessor] Повторная попытка через ${this.retryDelay}ms...`);
        setTimeout(() => {
          this.startAsyncProcessing(responseId, retryCount + 1);
        }, this.retryDelay);
      } else {
        // Максимальное количество попыток исчерпано
        await this.updateProcessingStatus(responseId, 'failed', null, error instanceof Error ? error.message : String(error));
        console.error(`[AsyncEmailProcessor] ❌ Email ID: ${responseId} - обработка провалена после ${this.maxRetries} попыток`);
      }
    } finally {
      this.processingQueue.delete(responseId);
    }
  }


  /**
   * Обновляет статус обработки в БД
   */
  private async updateProcessingStatus(
    responseId: number, 
    status: 'pending' | 'processing' | 'completed' | 'failed',
    startedAt?: Date | null,
    error?: string | null,
    completedAt?: Date | null
  ): Promise<void> {
    try {
      const updateData: any = {
        processingStatus: status
      };

      if (startedAt) {
        updateData.processingStartedAt = startedAt;
      }

      if (completedAt) {
        updateData.processingCompletedAt = completedAt;
      }

      if (error) {
        updateData.processingError = error;
      }

      await storage.updateSupplierResponse(responseId, updateData);
      
    } catch (error) {
      console.error(`[AsyncEmailProcessor] Ошибка обновления статуса для ID: ${responseId}`, error);
    }
  }

  /**
   * Ручной запуск обработки (для фронтенда)
   */
  async manualProcessing(responseId: number): Promise<void> {
    console.log(`[AsyncEmailProcessor] Ручной запуск обработки email ID: ${responseId}`);
    
    // Сбрасываем статус на 'pending'
    await this.updateProcessingStatus(responseId, 'pending');
    
    // Запускаем обработку
    this.startAsyncProcessing(responseId);
  }

  /**
   * Получает статус обработки
   */
  async getProcessingStatus(responseId: number): Promise<{
    status: string;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
  } | null> {
    try {
      const response = await storage.getSupplierResponseById(responseId);
      if (!response) return null;

      return {
        status: response.processingStatus || 'pending',
        startedAt: response.processingStartedAt || undefined,
        completedAt: response.processingCompletedAt || undefined,
        error: response.processingError || undefined
      };
    } catch (error) {
      console.error(`[AsyncEmailProcessor] Ошибка получения статуса для ID: ${responseId}`, error);
      return null;
    }
  }
}
