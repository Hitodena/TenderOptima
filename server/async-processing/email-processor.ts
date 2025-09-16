import { spawn } from 'child_process';
import { storage } from '../storage';
import { SupplierResponse } from '@shared/schema';

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

      // Обрабатываем вложения через Python процессор
      const processedAttachments = await this.processAttachments(response.attachments as any[]);
      
      // Обновляем ответ с обработанными вложениями
      await storage.updateSupplierResponse(responseId, {
        attachments: processedAttachments,
        isAnalyzed: true
      });

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
   * Обрабатывает вложения через Python процессор
   */
  private async processAttachments(attachments: any[]): Promise<any[]> {
    if (!attachments || attachments.length === 0) {
      return attachments;
    }

    const processedAttachments = [];

    for (const attachment of attachments) {
      try {
        if (attachment.content && attachment.contentType) {
          // Обрабатываем через Python процессор
          const extractedText = await this.callPythonProcessor(attachment);
          
          processedAttachments.push({
            ...attachment,
            extractedText: extractedText,
            processedAt: new Date().toISOString()
          });
        } else {
          processedAttachments.push(attachment);
        }
      } catch (error) {
        console.error(`[AsyncEmailProcessor] Ошибка обработки вложения ${attachment.filename}:`, error);
        processedAttachments.push({
          ...attachment,
          processingError: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return processedAttachments;
  }

  /**
   * Вызывает Python процессор для извлечения текста
   */
  private async callPythonProcessor(attachment: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      // Create temporary file with attachment data
      const tempDir = path.join(os.tmpdir(), 'supplier-finder-attachments');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `attachment_${Date.now()}_${attachment.filename || 'unknown'}`);
      
      try {
        // Write base64 content to temporary file
        const fileBuffer = Buffer.from(attachment.content, 'base64');
        fs.writeFileSync(tempFilePath, fileBuffer);
        
        // Create input data for Python processor
        const inputData = {
          attachments: [{
            filename: attachment.filename || 'unknown',
            contentType: attachment.contentType || 'application/octet-stream',
            content: attachment.content, // ← Передаем исходный base64 контент
            size: fileBuffer.length
          }]
        };
        
        const inputFilePath = path.join(tempDir, `input_${Date.now()}.json`);
        fs.writeFileSync(inputFilePath, JSON.stringify(inputData, null, 2), 'utf8');
        
        // Call Python processor with input file
        const pythonProcess = spawn('python', [
          'server/file-processing/file_processor.py',
          inputFilePath
        ]);

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
          // Clean up temporary files
          try {
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(inputFilePath);
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }
          
          if (code === 0) {
            try {
              const result = JSON.parse(output);
              if (result.attachments && result.attachments.length > 0) {
                resolve(result.attachments[0].extractedText || '');
              } else {
                resolve('');
              }
            } catch (parseError) {
              resolve(output.trim());
            }
          } else {
            reject(new Error(`Python processor failed with code ${code}: ${errorOutput}`));
          }
        });

        pythonProcess.on('error', (error) => {
          // Clean up temporary files
          try {
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(inputFilePath);
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }
          
          reject(new Error(`Failed to start Python processor: ${error.message}`));
        });
        
      } catch (error) {
        // Clean up temporary files
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp files:', cleanupError);
        }
        
        reject(error);
      }
    });
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
