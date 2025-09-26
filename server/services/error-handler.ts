export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROCESSING_ERROR = 'PROROCESSING_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  FILE_SIZE_ERROR = 'FILE_SIZE_ERROR',
  FILE_TYPE_ERROR = 'FILE_TYPE_ERROR',
  PYTHON_PROCESS_ERROR = 'PYTHON_PROCESS_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ProcessingError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: any;
  timestamp: Date;
  context?: {
    attachmentId?: string;
    responseId?: number;
    userId?: number;
    filename?: string;
  };
  retryable: boolean;
  userMessage: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Классифицирует ошибку и создает ProcessingError
   */
  classifyError(error: any, context?: any): ProcessingError {
    const timestamp = new Date();
    
    // Определяем тип ошибки
    let type: ErrorType;
    let severity: ErrorSeverity;
    let retryable: boolean;
    let userMessage: string;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout') || message.includes('timed out')) {
        type = ErrorType.TIMEOUT_ERROR;
        severity = ErrorSeverity.MEDIUM;
        retryable = true;
        userMessage = 'Обработка файла заняла слишком много времени. Попробуйте еще раз.';
      } else if (message.includes('file too large') || message.includes('size')) {
        type = ErrorType.FILE_SIZE_ERROR;
        severity = ErrorSeverity.LOW;
        retryable = false;
        userMessage = 'Файл слишком большой для обработки.';
      } else if (message.includes('unsupported') || message.includes('file type')) {
        type = ErrorType.FILE_TYPE_ERROR;
        severity = ErrorSeverity.LOW;
        retryable = false;
        userMessage = 'Неподдерживаемый тип файла.';
      } else if (message.includes('python') || message.includes('process')) {
        type = ErrorType.PYTHON_PROCESS_ERROR;
        severity = ErrorSeverity.HIGH;
        retryable = true;
        userMessage = 'Ошибка обработки файла. Попробуйте еще раз.';
      } else if (message.includes('database') || message.includes('db')) {
        type = ErrorType.DATABASE_ERROR;
        severity = ErrorSeverity.HIGH;
        retryable = true;
        userMessage = 'Ошибка сохранения данных. Попробуйте еще раз.';
      } else if (message.includes('network') || message.includes('connection')) {
        type = ErrorType.NETWORK_ERROR;
        severity = ErrorSeverity.MEDIUM;
        retryable = true;
        userMessage = 'Проблема с сетью. Попробуйте еще раз.';
      } else if (message.includes('validation') || message.includes('invalid')) {
        type = ErrorType.VALIDATION_ERROR;
        severity = ErrorSeverity.LOW;
        retryable = false;
        userMessage = 'Некорректные данные файла.';
      } else {
        type = ErrorType.UNKNOWN_ERROR;
        severity = ErrorSeverity.MEDIUM;
        retryable = true;
        userMessage = 'Произошла неизвестная ошибка. Попробуйте еще раз.';
      }
    } else {
      type = ErrorType.UNKNOWN_ERROR;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      userMessage = 'Произошла неизвестная ошибка. Попробуйте еще раз.';
    }

    return {
      type,
      severity,
      message: error instanceof Error ? error.message : String(error),
      details: error,
      timestamp,
      context,
      retryable,
      userMessage
    };
  }

  /**
   * Логирует ошибку с соответствующим уровнем
   */
  logError(processingError: ProcessingError): void {
    const logMessage = {
      type: processingError.type,
      severity: processingError.severity,
      message: processingError.message,
      context: processingError.context,
      timestamp: processingError.timestamp,
      retryable: processingError.retryable
    };

    switch (processingError.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(`[CRITICAL ERROR] ${JSON.stringify(logMessage)}`);
        break;
      case ErrorSeverity.HIGH:
        console.error(`[HIGH ERROR] ${JSON.stringify(logMessage)}`);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(`[MEDIUM ERROR] ${JSON.stringify(logMessage)}`);
        break;
      case ErrorSeverity.LOW:
        console.log(`[LOW ERROR] ${JSON.stringify(logMessage)}`);
        break;
    }
  }

  /**
   * Определяет, нужно ли повторить операцию
   */
  shouldRetry(processingError: ProcessingError, attemptCount: number, maxRetries: number = 3): boolean {
    if (!processingError.retryable) {
      return false;
    }

    if (attemptCount >= maxRetries) {
      return false;
    }

    // Для критических ошибок меньше попыток
    if (processingError.severity === ErrorSeverity.CRITICAL && attemptCount >= 1) {
      return false;
    }

    return true;
  }

  /**
   * Вычисляет задержку перед повтором
   */
  getRetryDelay(processingError: ProcessingError, attemptCount: number): number {
    const baseDelay = 1000; // 1 секунда
    const maxDelay = 30000; // 30 секунд
    
    // Экспоненциальная задержка с jitter
    const delay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    const jitter = Math.random() * 1000; // до 1 секунды случайности
    
    return delay + jitter;
  }

  /**
   * Создает пользовательское сообщение об ошибке
   */
  createUserMessage(processingError: ProcessingError): string {
    return processingError.userMessage;
  }

  /**
   * Создает техническое сообщение для разработчиков
   */
  createTechnicalMessage(processingError: ProcessingError): string {
    return `[${processingError.type}] ${processingError.message} (Severity: ${processingError.severity}, Retryable: ${processingError.retryable})`;
  }

  /**
   * Обрабатывает ошибку и возвращает результат
   */
  handleError(error: any, context?: any): {
    processingError: ProcessingError;
    shouldRetry: boolean;
    retryDelay?: number;
    userMessage: string;
    technicalMessage: string;
  } {
    const processingError = this.classifyError(error, context);
    this.logError(processingError);
    
    const attemptCount = context?.attemptCount || 0;
    const shouldRetry = this.shouldRetry(processingError, attemptCount);
    const retryDelay = shouldRetry ? this.getRetryDelay(processingError, attemptCount) : undefined;
    
    return {
      processingError,
      shouldRetry,
      retryDelay,
      userMessage: this.createUserMessage(processingError),
      technicalMessage: this.createTechnicalMessage(processingError)
    };
  }
}

export const errorHandler = ErrorHandler.getInstance();
