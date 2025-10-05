import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { errorHandler, ErrorType, ErrorSeverity } from './error-handler';
import { securityValidator } from './security-validator';
import { attachmentCache } from './attachment-cache';
import { monitoringService } from './monitoring';

export interface Attachment {
  filename: string;
  contentType: string;
  content: string; // base64 encoded
  size: number;
  encoding?: string;
  extractedText?: string;
}

export interface ProcessedAttachment extends Attachment {
  extractedText: string;
  processedAt: string;
  processingStatus: ProcessingStatus;
  error?: string;
}

export interface ProcessingStatus {
  status: 'success' | 'partial_failure' | 'critical_failure';
  method?: string;
  user_message?: string;
  error?: string;
}

export interface ProcessingOptions {
  timeout?: number; // milliseconds
  maxFileSize?: number; // bytes
  allowedTypes?: string[];
  retryCount?: number;
}

export class AttachmentProcessor {
  private static instance: AttachmentProcessor;
  private tempDir: string;
  private readonly defaultOptions: ProcessingOptions = {
    timeout: 60000, // 60 seconds
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      // PDF files
      'application/pdf',
      // Microsoft Word documents
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Microsoft Excel documents
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Text files
      'text/plain',
      'text/csv',
      // Image files (OCR support)
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/webp'
    ],
    retryCount: 3
  };

  private constructor() {
    this.tempDir = path.join(os.tmpdir(), 'supplier-finder-attachments');
    this.ensureTempDir();
  }

  static getInstance(): AttachmentProcessor {
    if (!AttachmentProcessor.instance) {
      AttachmentProcessor.instance = new AttachmentProcessor();
    }
    return AttachmentProcessor.instance;
  }

  /**
   * Обрабатывает массив вложений
   */
  async processAttachments(
    attachments: Attachment[], 
    options: ProcessingOptions = {}
  ): Promise<ProcessedAttachment[]> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Валидация входных данных
    this.validateAttachments(attachments, opts);
    
    const processedAttachments: ProcessedAttachment[] = [];
    
    for (const attachment of attachments) {
      try {
        const processed = await this.processSingleAttachment(attachment, opts);
        processedAttachments.push(processed);
      } catch (error) {
        const errorResult = errorHandler.handleError(error, {
          attachmentId: attachment.filename,
          filename: attachment.filename,
          attemptCount: 0
        });
        
        console.error(`[AttachmentProcessor] Error processing attachment ${attachment.filename}:`, errorResult.technicalMessage);
        
        processedAttachments.push({
          ...attachment,
          extractedText: '',
          processedAt: new Date().toISOString(),
          processingStatus: {
            status: 'critical_failure',
            error: errorResult.processingError.message,
            user_message: errorResult.userMessage,
            error_type: errorResult.errorType || 'unknown_error',
            suggestion: errorResult.suggestion || 'Попробуйте другой формат файла',
            timestamp: new Date().toISOString()
          },
          error: errorResult.userMessage
        });
      }
    }
    
    return processedAttachments;
  }

  /**
   * Обрабатывает одно вложение с retry логикой, кешированием и мониторингом
   */
  async processSingleAttachment(
    attachment: Attachment, 
    options: ProcessingOptions = {}
  ): Promise<ProcessedAttachment> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    const processingId = monitoringService.recordProcessingStart(
      attachment.filename,
      attachment.contentType,
      attachment.size
    );
    
    try {
      // Проверяем кеш
      const cached = attachmentCache.get(attachment);
      if (cached) {
        const processingTime = Date.now() - startTime;
        monitoringService.recordProcessingSuccess(
          processingId,
          attachment.filename,
          attachment.contentType,
          attachment.size,
          processingTime,
          true // wasCached
        );
        console.log(`[AttachmentProcessor] Cache hit for ${attachment.filename}`);
        return cached;
      }
      
      // Валидация
      this.validateAttachment(attachment, opts);
      
      const tempFilePath = await this.createTempFile(attachment);
      
      try {
        const result = await this.runPythonProcessorWithRetry(tempFilePath, attachment, opts);
        
        const processedAttachment: ProcessedAttachment = {
          ...attachment,
          extractedText: result.extractedText || '',
          processedAt: new Date().toISOString(),
          processingStatus: result.processingStatus || { status: 'success' }
        };
        
        // Сохраняем в кеш только успешные результаты
        if (result.processingStatus?.status === 'success') {
          attachmentCache.set(attachment, processedAttachment);
          console.log(`[AttachmentProcessor] Cached result for ${attachment.filename}`);
        }
        
        const processingTime = Date.now() - startTime;
        monitoringService.recordProcessingSuccess(
          processingId,
          attachment.filename,
          attachment.contentType,
          attachment.size,
          processingTime,
          false // wasCached
        );
        
        return processedAttachment;
      } finally {
        await this.cleanupTempFile(tempFilePath);
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorResult = errorHandler.handleError(error, {
        attachmentId: attachment.filename,
        filename: attachment.filename,
        attemptCount: 0
      });
      
      monitoringService.recordProcessingError(
        processingId,
        attachment.filename,
        attachment.contentType,
        attachment.size,
        errorResult.processingError,
        processingTime
      );
      
      throw error;
    }
  }

  /**
   * Запускает Python процессор с retry логикой
   */
  private async runPythonProcessorWithRetry(
    tempFilePath: string,
    attachment: Attachment,
    options: ProcessingOptions,
    attemptCount: number = 0
  ): Promise<{ extractedText: string; processingStatus: ProcessingStatus }> {
    try {
      return await this.runPythonProcessor(tempFilePath, attachment, options);
    } catch (error) {
      const errorResult = errorHandler.handleError(error, {
        attachmentId: attachment.filename,
        filename: attachment.filename,
        attemptCount
      });

      if (errorResult.shouldRetry && attemptCount < (options.retryCount || this.defaultOptions.retryCount!)) {
        console.log(`[AttachmentProcessor] Retrying attachment ${attachment.filename} (attempt ${attemptCount + 1}/${options.retryCount || this.defaultOptions.retryCount})`);
        
        // Ждем перед повтором
        await new Promise(resolve => setTimeout(resolve, errorResult.retryDelay!));
        
        return this.runPythonProcessorWithRetry(tempFilePath, attachment, options, attemptCount + 1);
      } else {
        // Максимальное количество попыток исчерпано или ошибка не retryable
        throw error;
      }
    }
  }

  /**
   * Валидирует массив вложений
   */
  private validateAttachments(attachments: Attachment[], options: ProcessingOptions): void {
    if (!attachments || attachments.length === 0) {
      throw new Error('No attachments provided');
    }

    if (attachments.length > 10) {
      throw new Error('Too many attachments (max 10)');
    }

    for (const attachment of attachments) {
      this.validateAttachment(attachment, options);
    }
  }

  /**
   * Валидирует одно вложение с проверками безопасности
   */
  private validateAttachment(attachment: Attachment, options: ProcessingOptions): void {
    if (!attachment.filename) {
      throw new Error('Attachment filename is required');
    }

    if (!attachment.content) {
      throw new Error('Attachment content is required');
    }

    // Комплексная валидация безопасности
    const securityResult = securityValidator.validateFile(
      attachment.filename,
      attachment.contentType,
      attachment.content,
      attachment.size
    );

    if (!securityResult.isValid) {
      throw new Error(`Security validation failed: ${securityResult.errors.join(', ')}`);
    }

    // Логируем предупреждения
    if (securityResult.warnings.length > 0) {
      console.warn(`[AttachmentProcessor] Security warnings for ${attachment.filename}:`, securityResult.warnings);
    }

    // Дополнительные проверки размера
    const maxSize = options.maxFileSize || this.defaultOptions.maxFileSize!;
    if (attachment.size > maxSize) {
      throw new Error(`File too large: ${attachment.filename} (${attachment.size} bytes, max: ${maxSize} bytes)`);
    }

    // Проверка типа файла
    if (options.allowedTypes && !options.allowedTypes.includes(attachment.contentType)) {
      throw new Error(`Unsupported file type: ${attachment.contentType}`);
    }

    // Проверка на потенциально опасные файлы
    if (securityValidator.isPotentiallyDangerous(attachment.filename, attachment.contentType)) {
      throw new Error(`Potentially dangerous file type: ${attachment.filename}`);
    }
  }

  /**
   * Создает временный файл для обработки
   */
  private async createTempFile(attachment: Attachment): Promise<string> {
    const tempFilePath = path.join(this.tempDir, `attachment_${Date.now()}_${attachment.filename}`);
    
    try {
      const fileBuffer = Buffer.from(attachment.content, 'base64');
      
      // Try to detect if this is a text file and handle encoding properly
      if (attachment.contentType?.startsWith('text/') || attachment.filename?.endsWith('.txt')) {
        // For text files, try multiple encodings for Russian text
        const encodings = ['utf8', 'cp1251', 'windows-1251', 'latin1'];
        let success = false;
        
        for (const encoding of encodings) {
          try {
            const textContent = fileBuffer.toString(encoding as BufferEncoding);
            console.log(`[AttachmentProcessor] Text file detected with ${encoding} encoding, content: ${textContent.substring(0, 100)}...`);
            await fs.writeFile(tempFilePath, textContent, 'utf8');
            success = true;
            break;
          } catch (encodingError) {
            console.log(`[AttachmentProcessor] ${encoding} decode failed, trying next encoding...`);
          }
        }
        
        if (!success) {
          console.log(`[AttachmentProcessor] All text encodings failed, writing as binary`);
          await fs.writeFile(tempFilePath, fileBuffer);
        }
      } else {
        // For binary files, write as-is
        await fs.writeFile(tempFilePath, fileBuffer);
      }
      
      console.log(`[AttachmentProcessor] Created temp file: ${tempFilePath} (${fileBuffer.length} bytes)`);
      
      // Debug: Show first 200 chars of the file content
      try {
        const debugContent = fileBuffer.toString('utf8', 0, Math.min(200, fileBuffer.length));
        console.log(`[AttachmentProcessor] File content preview: ${debugContent}`);
        console.log(`[AttachmentProcessor] File content hex: ${fileBuffer.toString('hex', 0, Math.min(100, fileBuffer.length))}`);
        
        // Test different encodings
        try {
          const cp1251Content = fileBuffer.toString('cp1251', 0, Math.min(200, fileBuffer.length));
          console.log(`[AttachmentProcessor] File content (CP1251): ${cp1251Content}`);
        } catch (e) {
          console.log(`[AttachmentProcessor] CP1251 decode failed: ${e.message}`);
        }
      } catch (debugError) {
        console.log(`[AttachmentProcessor] Could not preview file content: ${debugError}`);
      }
      
      return tempFilePath;
    } catch (error) {
      throw new Error(`Failed to create temp file for ${attachment.filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Запускает Python процессор с таймаутом
   */
  private async runPythonProcessor(
    tempFilePath: string, 
    attachment: Attachment, 
    options: ProcessingOptions
  ): Promise<{ extractedText: string; processingStatus: ProcessingStatus }> {
    // First try the simple extractor (like the old checkpoint)
    try {
      return await this.runSimpleExtractor(tempFilePath, attachment, options);
    } catch (simpleError) {
      console.log(`[AttachmentProcessor] Simple extractor failed for ${attachment.filename}, trying full processor: ${simpleError.message}`);
      
      // Fallback to full processor
      return new Promise((resolve, reject) => {
        const inputData = {
          attachments: [{
            filename: attachment.filename,
            contentType: attachment.contentType,
            content: attachment.content,
            size: attachment.size
          }]
        };
        
        const inputFilePath = path.join(this.tempDir, `input_${Date.now()}.json`);
        
        // Создаем input файл
        fs.writeFile(inputFilePath, JSON.stringify(inputData, null, 2), 'utf8')
          .then(() => {
            // Запускаем Python процесс
            const pythonProcess = spawn('python', [
              'server/file-processing/file_processor.py',
              inputFilePath
            ], {
              cwd: process.cwd(),
              stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            // Таймаут для процесса
            const timeout = setTimeout(() => {
              pythonProcess.kill('SIGTERM');
              reject(new Error(`Python process timeout after ${options.timeout}ms`));
            }, options.timeout);

            pythonProcess.stdout.on('data', (data) => {
              output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
              errorOutput += data.toString();
            });

            pythonProcess.on('close', async (code) => {
              clearTimeout(timeout);
              
              // Очистка input файла
              try {
                await fs.unlink(inputFilePath);
              } catch (cleanupError) {
                console.error('[AttachmentProcessor] Error cleaning up input file:', cleanupError);
              }
              
              if (code === 0) {
                try {
                  const result = JSON.parse(output);
                  if (result.attachments && result.attachments.length > 0) {
                    const processedAttachment = result.attachments[0];
                    resolve({
                      extractedText: processedAttachment.extractedText || '',
                      processingStatus: processedAttachment.processing_status || { status: 'success' }
                    });
                  } else {
                    resolve({
                      extractedText: '',
                      processingStatus: { status: 'success' }
                    });
                  }
                } catch (parseError) {
                  // Fallback: treat output as plain text
                  resolve({
                    extractedText: output.trim(),
                    processingStatus: { status: 'success', method: 'fallback' }
                  });
                }
              } else {
                reject(new Error(`Python processor failed with code ${code}: ${errorOutput}`));
              }
            });

            pythonProcess.on('error', (error) => {
              clearTimeout(timeout);
              reject(new Error(`Failed to start Python processor: ${error.message}`));
            });
          })
          .catch(reject);
      });
    }
  }

  /**
   * Run simple extractor (like the old checkpoint)
   */
  private async runSimpleExtractor(
    tempFilePath: string, 
    attachment: Attachment, 
    options: ProcessingOptions
  ): Promise<{ extractedText: string; processingStatus: ProcessingStatus }> {
    return new Promise((resolve, reject) => {
      // Запускаем простой Python скрипт
      const pythonProcess = spawn('python', [
        'server/file-processing/simple_text_extractor.py',
        tempFilePath,
        attachment.contentType
      ], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      // Таймаут для процесса
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error(`Simple extractor timeout after ${options.timeout}ms`));
      }, options.timeout);

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            if (result.success) {
              resolve({
                extractedText: result.text || '',
                processingStatus: { 
                  status: 'success', 
                  method: 'simple_extractor',
                  user_message: `Извлечено ${result.text_length || 0} символов`
                }
              });
            } else {
              reject(new Error(result.error || 'Simple extractor failed'));
            }
          } catch (parseError) {
            // Fallback: treat output as plain text
            resolve({
              extractedText: output.trim(),
              processingStatus: { status: 'success', method: 'simple_extractor_fallback' }
            });
          }
        } else {
          reject(new Error(`Simple extractor failed with code ${code}: ${errorOutput}`));
        }
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start simple extractor: ${error.message}`));
      });
    });
  }

  /**
   * Очищает временный файл
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      console.log(`[AttachmentProcessor] Cleaned up temp file: ${filePath}`);
    } catch (error) {
      console.error(`[AttachmentProcessor] Error cleaning up temp file ${filePath}:`, error);
    }
  }

  /**
   * Обеспечивает существование временной директории
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('[AttachmentProcessor] Error creating temp directory:', error);
      throw new Error('Failed to create temp directory');
    }
  }

  /**
   * Очищает все временные файлы (для maintenance)
   */
  async cleanupAllTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          console.log(`[AttachmentProcessor] Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      console.error('[AttachmentProcessor] Error during cleanup:', error);
    }
  }

  /**
   * Получает статистику использования временных файлов
   */
  async getTempDirStats(): Promise<{ fileCount: number; totalSize: number }> {
    try {
      const files = await fs.readdir(this.tempDir);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
      
      return {
        fileCount: files.length,
        totalSize
      };
    } catch (error) {
      console.error('[AttachmentProcessor] Error getting temp dir stats:', error);
      return { fileCount: 0, totalSize: 0 };
    }
  }

  /**
   * Получает статистику кеша
   */
  getCacheStats() {
    return attachmentCache.getStats();
  }

  /**
   * Очищает кеш
   */
  clearCache(): void {
    attachmentCache.clear();
    console.log('[AttachmentProcessor] Cache cleared');
  }

  /**
   * Принудительно очищает устаревшие записи из кеша
   */
  cleanupCache(): number {
    const removedCount = attachmentCache.forceCleanup();
    console.log(`[AttachmentProcessor] Cleaned up ${removedCount} expired cache entries`);
    return removedCount;
  }

  /**
   * Получает информацию о записях в кеше
   */
  getCacheInfo() {
    return attachmentCache.getCacheInfo();
  }

  /**
   * Устанавливает максимальный размер кеша
   */
  setCacheMaxSize(maxSize: number): void {
    attachmentCache.setMaxSize(maxSize);
    console.log(`[AttachmentProcessor] Cache max size set to ${maxSize}`);
  }

  /**
   * Устанавливает TTL кеша
   */
  setCacheTTL(ttl: number): void {
    attachmentCache.setDefaultTTL(ttl);
    console.log(`[AttachmentProcessor] Cache TTL set to ${ttl}ms`);
  }

  /**
   * Получает метрики обработки
   */
  getProcessingMetrics() {
    return monitoringService.getProcessingMetrics();
  }

  /**
   * Получает системные метрики
   */
  async getSystemMetrics() {
    return monitoringService.getSystemMetrics();
  }

  /**
   * Получает статистику производительности
   */
  getPerformanceStats() {
    return monitoringService.getPerformanceStats();
  }

  /**
   * Логирует текущее состояние системы
   */
  async logSystemStatus() {
    await monitoringService.logSystemStatus();
  }

  /**
   * Запускает периодический мониторинг
   */
  startMonitoring(intervalMs: number = 5 * 60 * 1000) {
    monitoringService.startPeriodicMonitoring(intervalMs);
  }

  /**
   * Экспортирует все метрики
   */
  exportAllMetrics() {
    return {
      processing: this.getProcessingMetrics(),
      performance: this.getPerformanceStats(),
      cache: this.getCacheStats(),
      tempDir: this.getTempDirStats()
    };
  }
}

export const attachmentProcessor = AttachmentProcessor.getInstance();
