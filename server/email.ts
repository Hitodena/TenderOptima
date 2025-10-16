
import nodemailer from 'nodemailer';

// Check for required environment variables
if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn('Email service not fully configured. SMTP settings are missing.');
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
    encoding?: string;
    cid?: string; // Content-ID для встраивания в HTML
  }>;
  headers?: Record<string, string>;
  hideBusinessCard?: boolean; // Скрыть визитную карточку
  messageHistory?: string; // История сообщений для добавления после бизнес-карточки
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private personalTransporters = new Map<number, nodemailer.Transporter>();

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        console.log('Initializing email transporter with settings:');
        console.log(`- Host: ${process.env.SMTP_HOST}`);
        console.log(`- Port: ${process.env.SMTP_PORT}`);
        console.log(`- User: ${process.env.SMTP_USER}`);
        console.log(`- From: ${process.env.SMTP_USER}`);
        console.log(`- Secure: false`);
        
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          tls: {
            rejectUnauthorized: false
          },
          // Настройки для оптимизации отправки больших файлов
          pool: true, // Используем пул соединений
          maxConnections: 5, // Максимум 5 одновременных соединений
          maxMessages: 100, // Максимум 100 сообщений на соединение
          rateDelta: 20000, // Интервал между отправками (20 сек)
          rateLimit: 5, // Максимум 5 сообщений в интервал
          // Таймауты для больших файлов
          connectionTimeout: 60000, // 60 секунд на подключение
          greetingTimeout: 30000, // 30 секунд на приветствие
          socketTimeout: 60000, // 60 секунд на сокет
          // Дополнительные настройки для стабильности
          debug: false,
          logger: false
        });

        // Verify connection
        this.transporter.verify((error) => {
          if (error) {
            console.error('Email server error:', error);
          } else {
            console.log('Email transporter initialized successfully');
          }
        });

      } catch (error) {
        console.error('Failed to initialize email transporter:', error);
      }
    } else {
      console.warn('Email transporter not initialized. Missing SMTP settings.');
    }
  }

  async sendEmail(options: EmailOptions & { 
    userId?: number; 
    hideBusinessCard?: boolean;
    messageHistory?: string;
    from?: string;
    auth?: { user: string; pass: string };
    smtp?: { host: string; port: number; secure: boolean };
  }): Promise<boolean> {
    // Check if user has personal email configuration
    console.log(`[email] DEBUG - sendEmail called with options:`, { to: options.to, subject: options.subject, userId: options.userId, hideBusinessCard: options.hideBusinessCard });
    
    // If custom SMTP configuration is provided, use it
    if (options.smtp && options.auth && options.from) {
      console.log(`[email] Using custom SMTP configuration`);
      const customTransporter = nodemailer.createTransport({
        host: options.smtp.host,
        port: options.smtp.port,
        secure: options.smtp.secure,
        auth: options.auth,
        tls: {
          rejectUnauthorized: false
        }
      });
      
      // Override from address
      const customOptions = { ...options, from: options.from };
      return this.sendWithTransporter(customTransporter, customOptions);
    }
    
    if (options.userId) {
      // Clear cache for this user to ensure fresh data
      this.personalTransporters.delete(options.userId);
      console.log(`[email] CRITICAL DEBUG - sendEmail called for userId ${options.userId}`);
      
      const personalTransporter = await this.getPersonalTransporter(options.userId);
      if (personalTransporter) {
        console.log(`[email] CRITICAL DEBUG - Using personal transporter for user ${options.userId}`);
        return this.sendWithTransporter(personalTransporter, options);
      } else {
        console.log(`[email] CRITICAL DEBUG - No personal transporter available for user ${options.userId}, using fallback`);
        // Don't fall back to shared transporter for user emails - return false
        return false;
      }
    }

    // Fallback to shared transporter
    if (!this.transporter) {
      console.error('[email] Email transporter not initialized, attempting to reinitialize');
      this.initializeTransporter();
      
      // Если после повторной инициализации все равно нет транспорта
      if (!this.transporter) {
        console.error('[email] Failed to initialize email transporter after retry');
        return false;
      }
    }

    return this.sendWithTransporter(this.transporter, options);
  }

  private async getPersonalTransporter(userId: number): Promise<nodemailer.Transporter | null> {
    try {
      // Check if we already have a transporter for this user
      if (this.personalTransporters.has(userId)) {
        return this.personalTransporters.get(userId)!;
      }

      // Load user email configuration from database
      const userConfig = await this.loadUserEmailConfig(userId);
      console.log(`[email] DEBUG - User ${userId} email config:`, {
        hasConfig: !!userConfig,
        hasAccount: !!userConfig?.emailAccount,
        hasPassword: !!userConfig?.emailPassword,
        emailConfigured: userConfig?.emailConfigured,
        smtpHost: userConfig?.smtpHost,
        smtpPort: userConfig?.smtpPort
      });
      
      if (!userConfig || !userConfig.emailAccount || !userConfig.emailPassword) {
        console.log(`[email] User ${userId} email not configured:`, {
          hasAccount: !!userConfig?.emailAccount,
          hasPassword: !!userConfig?.emailPassword,
          emailConfigured: userConfig?.emailConfigured
        });
        return null;
      }

      // Decrypt password if needed (same logic as PersonalEmailService)
      let actualPassword: string;
      try {
        if (userConfig.emailPassword.includes(':') && userConfig.emailPassword.split(':').length === 3) {
          // Password appears to be encrypted
          const { decryptEmailPassword } = await import('./utils/email-encryption');
          actualPassword = decryptEmailPassword(userConfig.emailPassword);
        } else {
          // Password is plain text
          actualPassword = userConfig.emailPassword;
        }
      } catch (error) {
        console.log(`[email] Password decryption failed for user ${userId}, using as plain text`);
        actualPassword = userConfig.emailPassword;
      }

      // Create personal transporter with optimized settings for large files
      const transporter = nodemailer.createTransport({
        host: userConfig.smtpHost,
        port: userConfig.smtpPort,
        secure: userConfig.smtpPort === 465,
        auth: {
          user: userConfig.emailAccount,
          pass: actualPassword
        },
        tls: {
          rejectUnauthorized: false
        },
        // Настройки для оптимизации отправки больших файлов
        pool: true, // Используем пул соединений
        maxConnections: 3, // Меньше соединений для персональных аккаунтов
        maxMessages: 50, // Меньше сообщений на соединение
        rateDelta: 30000, // Больший интервал для персональных аккаунтов (30 сек)
        rateLimit: 3, // Меньше сообщений в интервал
        // Таймауты для больших файлов
        connectionTimeout: 60000, // 60 секунд на подключение
        greetingTimeout: 30000, // 30 секунд на приветствие
        socketTimeout: 60000, // 60 секунд на сокет
        // Дополнительные настройки для стабильности
        debug: false,
        logger: false
      });

      // Verify connection
      try {
        await transporter.verify();
        this.personalTransporters.set(userId, transporter);
        console.log(`[email] Personal transporter created for user ${userId} (${userConfig.emailAccount})`);
        return transporter;
      } catch (verifyError) {
        console.error(`[email] Personal transporter verification failed for user ${userId}:`, verifyError);
        return null;
      }
    } catch (error) {
      console.error(`[email] Error creating personal transporter for user ${userId}:`, error);
      return null;
    }
  }

  private async loadUserEmailConfig(userId: number): Promise<any> {
    try {
      const storage = (await import('./storage')).storage;
      const config = await storage.getUserEmailConfig(userId);
      console.log(`[email] CRITICAL DEBUG - loadUserEmailConfig for user ${userId}:`, JSON.stringify(config, null, 2));
      return config;
    } catch (error) {
      console.error(`[email] Error loading user email config for user ${userId}:`, error);
      return null;
    }
  }

  private async sendWithTransporter(transporter: nodemailer.Transporter, options: EmailOptions & { userId?: number; hideBusinessCard?: boolean; from?: string }): Promise<boolean> {
    console.log(`[email] sendWithTransporter called with:`, { to: options.to, subject: options.subject, userId: options.userId, hideBusinessCard: options.hideBusinessCard });

    try {
      // Проверка обязательных полей
      if (!options.to || !options.subject || !options.text) {
        console.error('[email] Missing required email fields:', { 
          to: options.to ? 'Present' : 'Missing', 
          subject: options.subject ? 'Present' : 'Missing',
          text: options.text ? 'Present' : 'Missing'
        });
        return false;
      }
      
      console.log(`[email] Preparing to send email to ${options.to} with subject "${options.subject}"`);
      
      // Determine the correct 'from' address
      let fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;
      
      // If this is a personal transporter (has userId), get the user's email account
      if (options.userId && transporter !== this.transporter) {
        try {
          const userConfig = await this.loadUserEmailConfig(options.userId);
          if (userConfig && userConfig.emailAccount) {
            fromAddress = userConfig.emailAccount;
            console.log(`[email] Using personal email account for user ${options.userId}: ${fromAddress}`);
          }
        } catch (error) {
          console.error(`[email] Failed to get user email config for from address:`, error);
        }
      }
      
      const mailOptions = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text.replace(/\n/g, '<br/>'),
        replyTo: options.replyTo || fromAddress, // Если replyTo не указан, используем from адрес
        attachments: options.attachments,
        headers: options.headers || {}
      };

      // Расширенное логирование конфигурации
      console.log('[email] SMTP configuration:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER ? 'Configured' : 'Missing',
        pass: process.env.SMTP_PASS ? 'Configured' : 'Missing',
        from: mailOptions.from,
        to: mailOptions.to,
        hasReplyTo: !!mailOptions.replyTo,
        hasAttachments: mailOptions.attachments ? mailOptions.attachments.length : 0
      });

      // Попытка отправки с повторной попыткой при ошибке
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          const info = await transporter.sendMail(mailOptions);
          console.log(`[email] Email sent successfully (attempt ${retryCount + 1}):`, info.messageId);
          return true;
        } catch (sendError) {
          console.error(`[email] Failed to send email (attempt ${retryCount + 1}):`, sendError);
          
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`[email] Retrying send (${retryCount}/${maxRetries})...`);
            // Небольшая пауза перед повторной попыткой
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // For shared transporter, try to reinitialize on last attempt
            if (retryCount === maxRetries && transporter === this.transporter) {
              console.log('[email] Reinitializing shared transporter before final retry');
              this.initializeTransporter();
              if (!this.transporter) {
                console.error('[email] Failed to reinitialize transporter');
                return false;
              }
            }
          } else {
            return false;
          }
        }
      }
      
      return false; // Не должны сюда попасть, но на всякий случай
    } catch (error) {
      console.error('[email] Fatal error in email send process:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();

// Импортируем необходимые модули для работы с бизнес-карточкой
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Получает бизнес-карточку пользователя по ID
 */
async function getUserBusinessCard(userId: number): Promise<{ businessCard: string | null; logoUrl: string | null }> {
  try {
    const [user] = await db.select({ 
      businessCard: users.businessCard,
      logoUrl: users.logoUrl
    }).from(users).where(eq(users.id, userId));
    
    // Отладочная информация
    console.log('[email] getUserBusinessCard result:', {
      userId,
      found: !!user,
      businessCard: user?.businessCard ? `"${user.businessCard}"` : 'null',
      businessCardLength: user?.businessCard?.length || 0,
      hasNewlines: user?.businessCard?.includes('\n') || false,
      newlineCount: (user?.businessCard?.match(/\n/g) || []).length,
      logoUrl: user?.logoUrl || 'null'
    });
    
    return user || { businessCard: null, logoUrl: null };
  } catch (error) {
    console.error('[email] Error fetching user business card:', error);
    return { businessCard: null, logoUrl: null };
  }
}

/**
 * Форматирует бизнес-карточку для текстовой версии письма
 */
function formatTextBusinessCard(businessCard: string | null): string {
  if (!businessCard) return '';
  return `\n\n---\n${businessCard.replace(/<[^>]*>/g, '')}`;
}

/**
 * Форматирует бизнес-карточку для HTML версии письма
 */
function formatHtmlBusinessCard(businessCard: string | null, logoUrl: string | null): string {
  if (!businessCard && !logoUrl) return '';
  
  // Отладочная информация
  console.log('[email] formatHtmlBusinessCard called with:', {
    businessCard: businessCard ? `"${businessCard}"` : 'null',
    businessCardLength: businessCard?.length || 0,
    hasNewlines: businessCard?.includes('\n') || false,
    newlineCount: (businessCard?.match(/\n/g) || []).length
  });
  
  let htmlCard = '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">';
  
  // Добавляем логотип, если он есть - используем CID для встраивания
  if (logoUrl) {
    const logoFilename = logoUrl.split('/').pop() || 'logo.png';
    htmlCard += `<div style="margin-bottom: 15px;"><img src="cid:${logoFilename}" alt="Company Logo" style="max-width: 150px; max-height: 60px;"/></div>`;
  }
  
  // Добавляем текст бизнес-карточки, если он есть
  if (businessCard) {
    // Разбиваем текст на строки и оборачиваем каждую в <p> тег
    const lines = businessCard
      .replace(/\r\n/g, '\n')  // Нормализуем Windows line endings
      .replace(/\r/g, '\n')    // Нормализуем Mac line endings
      .split('\n')
      .filter(line => line.trim() !== ''); // Убираем пустые строки
    
    console.log('[email] Formatted business card:', {
      original: businessCard,
      lines: lines,
      lineCount: lines.length,
      originalLength: businessCard.length
    });
    
    // Создаем HTML с отдельными <p> тегами для каждой строки
    const formattedBusinessCard = lines
      .map(line => `<p style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 12px; color: #666; line-height: 1.4;">${line.trim()}</p>`)
      .join('');
    
    htmlCard += `<div style="margin: 0; padding: 0;">${formattedBusinessCard}</div>`;
  }
  
  htmlCard += '</div>';
  return htmlCard;
}

// ПРОСТАЯ ФУНКЦИЯ ДЛЯ СТРАНИЦЫ "ОТПРАВКА ЗАПРОСОВ" - КОПИЯ ИЗ РАБОЧЕГО ЧЕКПОИНТА
export const sendSimpleEmail = async (
  to: string, 
  subject: string, 
  text: string, 
  options?: { 
    trackingId?: string; 
    requestId?: number;
    replyTo?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
      encoding?: string;
      cid?: string; // Content-ID для встраивания в HTML
    }>;
    userId?: number; // ID пользователя для включения бизнес-карточки
  }
): Promise<boolean> => {
  console.log(`[email] *** sendSimpleEmail FUNCTION CALLED ***`, { to, subject, userId: options?.userId });
  
  // Детальное логирование SMTP конфигурации
  console.log(`[email] SMTP Configuration check:`, {
    SMTP_HOST: process.env.SMTP_HOST || 'NOT SET',
    SMTP_PORT: process.env.SMTP_PORT || 'NOT SET',
    SMTP_USER: process.env.SMTP_USER ? 'SET' : 'NOT SET',
    SMTP_PASS: process.env.SMTP_PASS ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET'
  });
  
  // Process attachments to ensure proper encoding
  let processedAttachments = options?.attachments;
  
  if (processedAttachments && processedAttachments.length > 0) {
    console.log(`[email] Processing ${processedAttachments.length} attachments for email to ${to}`);
    
    // Ensure all attachments have proper encoding
    processedAttachments = processedAttachments.map(attachment => {
      // Skip if no content
      if (!attachment.content) {
        console.log(`[email] Skipping empty attachment: ${attachment.filename}`);
        return attachment;
      }
      
      // Ensure encoding is specified
      const encoding = attachment.encoding || 'base64';
      
      // If content is a Buffer, keep it as is
      if (Buffer.isBuffer(attachment.content)) {
        console.log(`[email] Attachment ${attachment.filename} is already a Buffer`);
        return {
          ...attachment,
          encoding
        };
      }
      
      // Return the attachment with the ensured encoding
      return {
        ...attachment,
        encoding
      };
    });
  }
  
  // Восстанавливаем функциональность бизнес-карточки - ПРОСТАЯ ВЕРСИЯ
  let finalText = text;
  let finalHtml = options?.html || text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  let businessCardAttachments = processedAttachments || [];
  
  // Получаем бизнес-карточку пользователя, если userId предоставлен
  if (options?.userId) {
    try {
      console.log(`[email] Fetching business card for user ${options.userId}`);
      const { businessCard, logoUrl } = await getUserBusinessCard(options.userId);
      
      if (businessCard || logoUrl) {
        console.log(`[email] Adding business card to email:`, { businessCard: !!businessCard, logoUrl: !!logoUrl });
        
        // Добавляем бизнес-карточку к текстовой версии - ПРОСТАЯ ЛОГИКА
        if (businessCard) {
          const textBusinessCard = formatTextBusinessCard(businessCard);
          finalText += textBusinessCard;
        }
        
        // Добавляем бизнес-карточку к HTML версии - ПРОСТАЯ ЛОГИКА
        if (businessCard) {
          const htmlBusinessCard = formatHtmlBusinessCard(businessCard, logoUrl);
          finalHtml += htmlBusinessCard;
        }
        
        console.log(`[email] Business card added successfully`);
      } else {
        console.log(`[email] No business card found for user ${options.userId}`);
      }
    } catch (error) {
      console.error(`[email] Error processing business card for user ${options.userId}:`, error);
      // Продолжаем отправку без бизнес-карточки
    }
  }
  
  // Добавляем историю сообщений после бизнес-карточки, если она есть
  if (options?.messageHistory) {
    finalText += options.messageHistory;
    finalHtml += options.messageHistory.replace(/\n/g, '<br/>');
  }
  
  const emailOptions: EmailOptions = {
    to,
    subject,
    text: finalText,
    html: finalHtml,
    replyTo: options?.replyTo,
    attachments: businessCardAttachments,
    headers: {}
  };
  
  // Add tracking headers if provided
  if (options?.trackingId) {
    emailOptions.headers = {
      ...emailOptions.headers,
      'X-Tracking-ID': options.trackingId
    };
  }
  
  console.log(`[email] CALLING emailService.sendEmail (SIMPLE) with:`, { to: emailOptions.to, subject: emailOptions.subject, userId: options?.userId });
  
  const result = await emailService.sendEmail({ ...emailOptions, userId: options?.userId });
  
  console.log(`[email] sendSimpleEmail RESULT:`, { 
    success: result, 
    to: emailOptions.to, 
    subject: emailOptions.subject, 
    userId: options?.userId 
  });
  
  return result;
};

export const sendEmail = async (
  to: string, 
  subject: string, 
  text: string, 
  options?: { 
    trackingId?: string; 
    requestId?: number;
    replyTo?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
      encoding?: string;
      cid?: string; // Content-ID для встраивания в HTML
    }>;
    userId?: number; // ID пользователя для включения бизнес-карточки
    hideBusinessCard?: boolean; // Скрыть визитную карточку
    messageHistory?: string; // История сообщений для добавления после бизнес-карточки
    // User SMTP configuration
    from?: string;
    auth?: {
      user: string;
      pass: string;
    };
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
    };
  }
): Promise<boolean> => {
  console.log(`[email] *** sendEmail FUNCTION CALLED ***`, { to, subject, userId: options?.userId });
  // Process attachments to ensure proper encoding
  let processedAttachments = options?.attachments;
  
  if (processedAttachments && processedAttachments.length > 0) {
    console.log(`[email] Processing ${processedAttachments.length} attachments for email to ${to}`);
    
    // Ensure all attachments have proper encoding
    processedAttachments = processedAttachments.map(attachment => {
      // Skip if no content
      if (!attachment.content) {
        console.log(`[email] Skipping empty attachment: ${attachment.filename}`);
        return attachment;
      }
      
      // Ensure encoding is specified
      const encoding = attachment.encoding || 'base64';
      
      // If content is a Buffer, keep it as is
      if (Buffer.isBuffer(attachment.content)) {
        console.log(`[email] Attachment ${attachment.filename} is already a Buffer`);
        return {
          ...attachment,
          encoding
        };
      }
      
      // If it's a string, check if it's already base64
      if (typeof attachment.content === 'string') {
        const isValidBase64 = (str: string): boolean => {
          if (str.length % 4 !== 0) return false;
          return /^[A-Za-z0-9+/=]+$/.test(str);
        };
        
        // Handle data URLs
        if (attachment.content.includes('data:') && attachment.content.includes('base64,')) {
          console.log(`[email] Processing data URL attachment: ${attachment.filename}`);
          const base64Content = attachment.content.split('base64,')[1];
          if (base64Content) {
            return {
              ...attachment,
              content: base64Content,
              encoding
            };
          }
        }
        
        // If not valid base64, encode it
        if (!isValidBase64(attachment.content)) {
          console.log(`[email] Converting non-base64 content to base64: ${attachment.filename}`);
          try {
            return {
              ...attachment,
              content: Buffer.from(attachment.content).toString('base64'),
              encoding
            };
          } catch (error) {
            console.error(`[email] Error encoding attachment content:`, error);
          }
        }
      }
      
      // Return the attachment with the ensured encoding
      return {
        ...attachment,
        encoding
      };
    });
  }
  
  // Восстанавливаем функциональность бизнес-карточки
  let finalText = text || '';
  let finalHtml = options?.html || (text || '').replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  let businessCardAttachments = processedAttachments || [];
  
  // Получаем бизнес-карточку пользователя, если userId предоставлен и не скрыта
  if (options?.userId && !options?.hideBusinessCard) {
    try {
      console.log(`[email] Fetching business card for user ${options.userId}`);
      const { businessCard, logoUrl } = await getUserBusinessCard(options.userId);
      
      if (businessCard || logoUrl) {
        console.log(`[email] Adding business card to email:`, { businessCard: !!businessCard, logoUrl: !!logoUrl });
        
        // Добавляем логотип как attachment, если он есть
        if (logoUrl) {
          try {
            const response = await fetch(logoUrl);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              const logoFilename = logoUrl.split('/').pop() || 'logo.png';
              const contentType = response.headers.get('content-type') || 'image/png';
              
              businessCardAttachments.push({
                filename: logoFilename,
                content: Buffer.from(buffer),
                contentType: contentType,
                cid: logoFilename // Content-ID для встраивания в HTML
              });
              
              console.log(`[email] Logo added as attachment: ${logoFilename}`);
            }
          } catch (logoError) {
            console.error(`[email] Error loading logo:`, logoError);
          }
        }
        
        // Добавляем бизнес-карточку к текстовой версии
        const textBusinessCard = formatTextBusinessCard(businessCard);
        
        // ВРЕМЕННО: Простая логика как в рабочем чекпоинте
        // Для email с фразой о неизменении темы, добавляем визитную карточку ПОСЛЕ фразы
        if (finalText.includes('!При ответе на наш запрос не меняйте тему письма')) {
          // Находим позицию фразы и вставляем визитную карточку после неё
          const phraseIndex = finalText.lastIndexOf('!При ответе на наш запрос не меняйте тему письма');
          if (phraseIndex !== -1) {
            // Находим конец фразы (после Request Tracking ID)
            const endOfPhrase = finalText.indexOf('\n', phraseIndex + 200); // Ищем конец после фразы
            if (endOfPhrase !== -1) {
              const beforePhrase = finalText.substring(0, endOfPhrase);
              const afterPhrase = finalText.substring(endOfPhrase);
              finalText = beforePhrase + '\n' + textBusinessCard + afterPhrase;
            } else {
              finalText += '\n' + textBusinessCard;
            }
          } else {
            finalText += textBusinessCard;
          }
        } else {
          // Для обычных email (без фразы) добавляем визитную карточку в конец - ПРОСТАЯ ЛОГИКА
          finalText += textBusinessCard;
        }
        
        // Добавляем историю сообщений после бизнес-карточки, если она есть
        if (options?.messageHistory) {
          finalText += options.messageHistory;
        }
        
        // Добавляем бизнес-карточку к HTML версии
        const htmlBusinessCard = formatHtmlBusinessCard(businessCard, logoUrl);
        
        // ВРЕМЕННО: Простая логика для HTML версии
        // Для HTML версии тоже нужно вставить визитную карточку ПОСЛЕ фразы
        if (finalHtml.includes('!При ответе на наш запрос не меняйте тему письма')) {
          const phraseIndex = finalHtml.lastIndexOf('!При ответе на наш запрос не меняйте тему письма');
          if (phraseIndex !== -1) {
            // Находим конец фразы (после Request Tracking ID)
            const endOfPhrase = finalHtml.indexOf('<br/>', phraseIndex + 200); // Ищем конец после фразы
            if (endOfPhrase !== -1) {
              const beforePhrase = finalHtml.substring(0, endOfPhrase);
              const afterPhrase = finalHtml.substring(endOfPhrase);
              finalHtml = beforePhrase + '<br/>' + htmlBusinessCard + afterPhrase;
            } else {
              finalHtml += '<br/>' + htmlBusinessCard;
            }
          } else {
            finalHtml += htmlBusinessCard;
          }
        } else {
          // Для обычных email (без фразы) добавляем визитную карточку в конец - ПРОСТАЯ ЛОГИКА
          finalHtml += htmlBusinessCard;
        }
        
        // Добавляем историю сообщений после бизнес-карточки в HTML версии, если она есть
        if (options?.messageHistory) {
          finalHtml += options.messageHistory.replace(/\n/g, '<br/>');
        }
        
        console.log(`[email] Business card added successfully`);
      } else {
        console.log(`[email] No business card found for user ${options.userId}`);
      }
    } catch (error) {
      console.error(`[email] Error processing business card for user ${options.userId}:`, error);
      // Продолжаем отправку без бизнес-карточки
    }
  }
  
  const emailOptions: EmailOptions = {
    to,
    subject,
    text: finalText,
    html: finalHtml,
    replyTo: options?.replyTo,
    attachments: businessCardAttachments,
    headers: {}
  };
  
  // Add tracking headers if provided
  if (options?.trackingId) {
    emailOptions.headers = {
      ...emailOptions.headers,
      'X-Tracking-ID': options.trackingId
    };
  }
  
  console.log(`[email] CALLING emailService.sendEmail with:`, { to: emailOptions.to, subject: emailOptions.subject, userId: options?.userId });
  return emailService.sendEmail({ ...emailOptions, userId: options?.userId });
};
