import * as path from 'path';
import { ErrorType } from './error-handler';

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedFilename?: string;
}

export class SecurityValidator {
  private static instance: SecurityValidator;
  
  // Опасные расширения файлов
  private readonly dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.app', '.deb', '.pkg', '.dmg', '.iso', '.sh', '.ps1', '.py', '.rb',
    '.pl', '.php', '.asp', '.jsp', '.cgi'
  ];
  
  // Поддерживаемые типы файлов
  private readonly allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff'
  ];
  
  // Максимальные размеры файлов (в байтах)
  private readonly maxFileSizes = {
    'application/pdf': 50 * 1024 * 1024, // 50MB
    'application/msword': 25 * 1024 * 1024, // 25MB
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 25 * 1024 * 1024, // 25MB
    'application/vnd.ms-excel': 25 * 1024 * 1024, // 25MB
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 25 * 1024 * 1024, // 25MB
    'text/plain': 10 * 1024 * 1024, // 10MB
    'text/csv': 10 * 1024 * 1024, // 10MB
    'image/jpeg': 20 * 1024 * 1024, // 20MB
    'image/png': 20 * 1024 * 1024, // 20MB
    'image/gif': 20 * 1024 * 1024, // 20MB
    'image/bmp': 20 * 1024 * 1024, // 20MB
    'image/tiff': 20 * 1024 * 1024, // 20MB
    'default': 50 * 1024 * 1024 // 50MB по умолчанию
  };

  static getInstance(): SecurityValidator {
    if (!SecurityValidator.instance) {
      SecurityValidator.instance = new SecurityValidator();
    }
    return SecurityValidator.instance;
  }

  /**
   * Валидирует файл на безопасность
   */
  validateFile(
    filename: string,
    contentType: string,
    content: string,
    size: number
  ): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Валидация имени файла
    const filenameValidation = this.validateFilename(filename);
    if (!filenameValidation.isValid) {
      errors.push(...filenameValidation.errors);
    }
    if (filenameValidation.warnings.length > 0) {
      warnings.push(...filenameValidation.warnings);
    }
    
    // Валидация типа контента
    const contentTypeValidation = this.validateContentType(contentType);
    if (!contentTypeValidation.isValid) {
      errors.push(...contentTypeValidation.errors);
    }
    
    // Валидация размера файла
    const sizeValidation = this.validateFileSize(contentType, size);
    if (!sizeValidation.isValid) {
      errors.push(...sizeValidation.errors);
    }
    
    // Валидация base64 контента
    const contentValidation = this.validateContent(content);
    if (!contentValidation.isValid) {
      errors.push(...contentValidation.errors);
    }
    
    // Проверка на подозрительные паттерны
    const suspiciousPatterns = this.checkSuspiciousPatterns(filename, content);
    if (suspiciousPatterns.length > 0) {
      warnings.push(...suspiciousPatterns);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedFilename: filenameValidation.sanitizedFilename
    };
  }

  /**
   * Валидирует имя файла
   */
  private validateFilename(filename: string): SecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizedFilename = filename;
    
    if (!filename || filename.trim().length === 0) {
      errors.push('Имя файла не может быть пустым');
      return { isValid: false, errors, warnings };
    }
    
    // Проверка длины имени файла
    if (filename.length > 255) {
      errors.push('Имя файла слишком длинное (максимум 255 символов)');
      return { isValid: false, errors, warnings };
    }
    
    // Проверка на опасные символы
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      errors.push('Имя файла содержит недопустимые символы');
      return { isValid: false, errors, warnings };
    }
    
    // Проверка на двойные расширения
    const doubleExtension = /\.\w+\.\w+$/;
    if (doubleExtension.test(filename)) {
      warnings.push('Файл имеет двойное расширение - возможна попытка скрыть тип файла');
    }
    
    // Проверка расширения файла
    const extension = path.extname(filename).toLowerCase();
    if (this.dangerousExtensions.includes(extension)) {
      errors.push(`Расширение файла ${extension} не поддерживается по соображениям безопасности`);
      return { isValid: false, errors, warnings };
    }
    
    // Санитизация имени файла
    sanitizedFilename = this.sanitizeFilename(filename);
    if (sanitizedFilename !== filename) {
      warnings.push('Имя файла было очищено от небезопасных символов');
    }
    
    return {
      isValid: true,
      errors,
      warnings,
      sanitizedFilename
    };
  }

  /**
   * Валидирует тип контента
   */
  private validateContentType(contentType: string): SecurityValidationResult {
    const errors: string[] = [];
    
    if (!contentType || contentType.trim().length === 0) {
      errors.push('Тип контента не может быть пустым');
      return { isValid: false, errors, warnings: [] };
    }
    
    if (!this.allowedMimeTypes.includes(contentType)) {
      errors.push(`Тип файла ${contentType} не поддерживается`);
      return { isValid: false, errors, warnings: [] };
    }
    
    return { isValid: true, errors, warnings: [] };
  }

  /**
   * Валидирует размер файла
   */
  private validateFileSize(contentType: string, size: number): SecurityValidationResult {
    const errors: string[] = [];
    
    if (size <= 0) {
      errors.push('Размер файла должен быть больше 0');
      return { isValid: false, errors, warnings: [] };
    }
    
    const maxSize = this.maxFileSizes[contentType as keyof typeof this.maxFileSizes] || this.maxFileSizes.default;
    if (size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      errors.push(`Файл слишком большой. Максимальный размер для ${contentType}: ${maxSizeMB}MB`);
      return { isValid: false, errors, warnings: [] };
    }
    
    return { isValid: true, errors, warnings: [] };
  }

  /**
   * Валидирует содержимое файла
   */
  private validateContent(content: string): SecurityValidationResult {
    const errors: string[] = [];
    
    if (!content || content.trim().length === 0) {
      errors.push('Содержимое файла не может быть пустым');
      return { isValid: false, errors, warnings: [] };
    }
    
    // Проверка на валидность base64
    try {
      const decoded = Buffer.from(content, 'base64');
      if (decoded.length === 0) {
        errors.push('Некорректное содержимое файла');
        return { isValid: false, errors, warnings: [] };
      }
    } catch (error) {
      errors.push('Содержимое файла не является валидным base64');
      return { isValid: false, errors, warnings: [] };
    }
    
    return { isValid: true, errors, warnings: [] };
  }

  /**
   * Проверяет на подозрительные паттерны
   */
  private checkSuspiciousPatterns(filename: string, content: string): string[] {
    const warnings: string[] = [];
    
    // Проверка на подозрительные имена файлов
    const suspiciousNames = [
      'malware', 'virus', 'trojan', 'backdoor', 'keylogger',
      'password', 'secret', 'confidential', 'private'
    ];
    
    const lowerFilename = filename.toLowerCase();
    for (const suspicious of suspiciousNames) {
      if (lowerFilename.includes(suspicious)) {
        warnings.push(`Имя файла содержит подозрительное слово: ${suspicious}`);
      }
    }
    
    // Проверка на подозрительные паттерны в содержимом
    try {
      const decoded = Buffer.from(content, 'base64');
      const contentStr = decoded.toString('utf8', 0, Math.min(decoded.length, 1024)); // Первые 1KB
      
      // Проверка на исполняемый код
      const executablePatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /eval\(/i,
        /exec\(/i
      ];
      
      for (const pattern of executablePatterns) {
        if (pattern.test(contentStr)) {
          warnings.push('Файл может содержать исполняемый код');
          break;
        }
      }
    } catch (error) {
      // Игнорируем ошибки декодирования для проверки паттернов
    }
    
    return warnings;
  }

  /**
   * Санитизирует имя файла
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"|?*\x00-\x1f]/g, '_') // Заменяем опасные символы
      .replace(/\.{2,}/g, '.') // Убираем множественные точки
      .replace(/^\.+|\.+$/g, '') // Убираем точки в начале и конце
      .replace(/\s+/g, '_') // Заменяем пробелы на подчеркивания
      .substring(0, 255); // Ограничиваем длину
  }

  /**
   * Проверяет, является ли файл потенциально опасным
   */
  isPotentiallyDangerous(filename: string, contentType: string): boolean {
    const extension = path.extname(filename).toLowerCase();
    
    // Проверка на исполняемые файлы
    if (this.dangerousExtensions.includes(extension)) {
      return true;
    }
    
    // Проверка на подозрительные MIME типы
    const suspiciousMimeTypes = [
      'application/x-executable',
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-winexe'
    ];
    
    if (suspiciousMimeTypes.includes(contentType)) {
      return true;
    }
    
    return false;
  }

  /**
   * Получает максимальный размер файла для типа
   */
  getMaxFileSize(contentType: string): number {
    return this.maxFileSizes[contentType as keyof typeof this.maxFileSizes] || this.maxFileSizes.default;
  }

  /**
   * Получает список поддерживаемых типов файлов
   */
  getAllowedMimeTypes(): string[] {
    return [...this.allowedMimeTypes];
  }
}

export const securityValidator = SecurityValidator.getInstance();
