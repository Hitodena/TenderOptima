
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
  }>;
  headers?: Record<string, string>;
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

  async sendEmail(options: EmailOptions & { userId?: number }): Promise<boolean> {
    // Check if user has personal email configuration
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
      if (!userConfig || !userConfig.emailConfigured) {
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

  private async sendWithTransporter(transporter: nodemailer.Transporter, options: EmailOptions & { userId?: number }): Promise<boolean> {

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
      let fromAddress = options.from || process.env.EMAIL_FROM || process.env.SMTP_USER;
      
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
        replyTo: options.replyTo,
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
  
  let htmlCard = '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">';
  
  // Добавляем логотип, если он есть
  if (logoUrl) {
    htmlCard += `<div style="margin-bottom: 15px;"><img src="${logoUrl}" alt="Company Logo" style="max-width: 150px; max-height: 60px;"/></div>`;
  }
  
  // Добавляем текст бизнес-карточки, если он есть
  if (businessCard) {
    htmlCard += `<div style="font-family: Arial, sans-serif; font-size: 12px; color: #666;">${businessCard}</div>`;
  }
  
  htmlCard += '</div>';
  return htmlCard;
}

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
    }>;
    userId?: number; // ID пользователя для включения бизнес-карточки
  }
): Promise<boolean> => {
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
  
  // ОТКЛЮЧАЕМ бизнес-карточку, так как она вызывает проблемы с производительностью
  // Вместо получения и добавления, просто создаем стандартные опции для email
  
  const emailOptions: EmailOptions = {
    to,
    subject,
    text: text,
    html: options?.html || text.replace(/\n/g, '<br/>'),
    replyTo: options?.replyTo,
    attachments: processedAttachments,
    headers: {}
  };
  
  // Add tracking headers if provided
  if (options?.trackingId) {
    emailOptions.headers = {
      ...emailOptions.headers,
      'X-Tracking-ID': options.trackingId
    };
  }
  
  return emailService.sendEmail({ ...emailOptions, userId: options?.userId });
};
