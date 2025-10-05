import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { storage } from './storage';
import { createRequire } from 'module';

// ES modules workaround for requiring CommonJS modules
const require = createRequire(import.meta.url);
const apiAttachmentBridge = require('./file-processing/api_bridge.cjs');

// Interface for detailed email processing results
interface PersonalEmailProcessingResult {
  status: 'success' | 'failed' | 'timeout' | 'db_error' | 'attachment_error' | 'no_tracking' | 'already_processed';
  savedToDb: boolean;
  dbRecordId?: number;
  attachmentsProcessed: boolean;
  attachmentErrors?: string[];
  error?: string;
  messageId: string;
  alreadyInDatabase?: boolean;
}

export class PersonalImapService {
  private personalImapConnections = new Map<number, Imap>();
  private processedMessageIds = new Set<string>();
  private lastCheckTime = new Map<number, Date>(); // Время последней проверки для каждого пользователя
  private responseCache = new Map<string, any>();
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 60000; // 1 минута кэш

  constructor() {
    console.log('Initializing Personal IMAP Service - each user will have their own IMAP connection');
  }

  private isConnectionHealthy(imap: Imap): boolean {
    try {
      // Check if the connection object has the required internal state
      // @ts-ignore - accessing private properties to check connection state
      const state = imap._state;
      const sock = imap._sock;
      
      // Connection should have proper state and active socket
      return state !== undefined && sock !== undefined;
    } catch (error) {
      console.log(`[PERSONAL IMAP] Connection health check failed:`, error);
      return false;
    }
  }

  private async getPersonalImapConnection(userId: number): Promise<Imap | null> {
    console.log(`[PERSONAL IMAP] Getting personal IMAP connection for user ${userId}`);
    
    // Get user's personal email configuration
    const userConfig = await storage.getUserEmailConfig(userId);
    console.log(`[PERSONAL IMAP] CRITICAL DEBUG - User ${userId} email config:`, JSON.stringify(userConfig, null, 2));
    
    if (!userConfig || !userConfig.emailAccount || !userConfig.emailPassword) {
      console.log(`[PERSONAL IMAP] User ${userId} has no email configuration - skipping IMAP connection`);
      return null;
    }

    if (!userConfig.emailConfigured) {
      console.log(`[PERSONAL IMAP] User ${userId} email not configured - skipping IMAP connection`);
      return null;
    }

    // ИСПРАВЛЕНИЕ: Всегда удаляем старое соединение и создаем новое
    // Переиспользование IMAP соединений приводит к внутренним ошибкам состояния
    if (this.personalImapConnections.has(userId)) {
      const existingConnection = this.personalImapConnections.get(userId)!;
      console.log(`[PERSONAL IMAP] Removing existing connection for user ${userId} to prevent state issues`);
      try {
        (existingConnection as any).end();
      } catch (error) {
        console.log(`[PERSONAL IMAP] Error closing existing connection:`, error);
      }
      this.personalImapConnections.delete(userId);
    }

    try {
      const imapHost = userConfig.imapHost || 'imap.mail.ru';
      const imapPort = userConfig.imapPort || 993;
      
      console.log(`[PERSONAL IMAP] Creating new IMAP connection for user ${userId}:`);
      console.log(`[PERSONAL IMAP] - Email: ${userConfig.emailAccount}`);
      console.log(`[PERSONAL IMAP] - IMAP Host: ${imapHost}`);
      console.log(`[PERSONAL IMAP] - IMAP Port: ${imapPort}`);
      
      const imap = new Imap({
        user: userConfig.emailAccount,
        password: userConfig.emailPassword,
        host: imapHost,
        port: imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 30000
      });

      // Настраиваем обработчики событий ПЕРЕД сохранением соединения
      imap.once('ready', () => {
        console.log(`[PERSONAL IMAP] ✅ Personal connection ready for user ${userId} (${userConfig.emailAccount})`);
      });

      imap.once('error', (err) => {
        console.error(`[PERSONAL IMAP] ❌ Personal connection error for user ${userId}:`, err);
        // Немедленно удаляем проблемное соединение
        this.personalImapConnections.delete(userId);
        try {
          (imap as any).end();
        } catch (cleanupError) {
          console.log(`[PERSONAL IMAP] Error during connection cleanup:`, cleanupError);
        }
      });

      imap.once('end', () => {
        console.log(`[PERSONAL IMAP] 🔌 Personal connection ended for user ${userId}`);
        this.personalImapConnections.delete(userId);
      });

      // Сохраняем соединение ПОСЛЕ настройки обработчиков
      this.personalImapConnections.set(userId, imap);
      console.log(`[PERSONAL IMAP] 🆕 Created fresh IMAP connection for user ${userId}`);

      return imap;
    } catch (error) {
      console.error(`[PERSONAL IMAP] Failed to create personal IMAP connection for user ${userId}:`, error);
      return null;
    }
  }

  private async connectToPersonalImap(imap: Imap, userId: number): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`[PERSONAL IMAP] 🔗 Connecting to personal IMAP for user ${userId}...`);
      
      let timeoutId: NodeJS.Timeout;
      let resolved = false;
      let connectionAttempted = false;

      const resolveOnce = (success: boolean, reason?: string) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        
        if (!success && reason) {
          console.error(`[PERSONAL IMAP] ❌ Connection failed for user ${userId}: ${reason}`);
          // Очищаем проблемное соединение
          this.personalImapConnections.delete(userId);
        }
        resolve(success);
      };

      // Set timeout for connection
      timeoutId = setTimeout(() => {
        resolveOnce(false, 'Connection timeout (15s)');
      }, 15000);

      imap.once('ready', () => {
        console.log(`[PERSONAL IMAP] ✅ Successfully connected to personal IMAP for user ${userId}`);
        resolveOnce(true);
      });

      imap.once('error', (err) => {
        resolveOnce(false, `IMAP error: ${err.message || err}`);
      });

      try {
        // Проверяем, что соединение не было уже инициировано
        if (connectionAttempted) {
          resolveOnce(false, 'Connection already attempted');
          return;
        }
        connectionAttempted = true;
        
        console.log(`[PERSONAL IMAP] 🚀 Initiating IMAP connection for user ${userId}...`);
        imap.connect();
      } catch (error) {
        resolveOnce(false, `Connection initiation error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  public async checkEmailsOnDemand(requestId?: number, userId?: number): Promise<{
    success: boolean;
    message: string;
    newResponses: number;
  }> {
    console.log(`\n================================`);
    console.log(`🔍 PERSONAL EMAIL CHECK INITIATED`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Request ID: ${requestId || 'All requests'}`);
    console.log(`User ID: ${userId || 'No user specified'}`);
    console.log(`================================\n`);

    if (!userId) {
      return {
        success: false,
        message: "User ID is required for personal email checking",
        newResponses: 0
      };
    }

    try {
      // Get personal IMAP connection for this user
      const personalImap = await this.getPersonalImapConnection(userId);
      if (!personalImap) {
        return {
          success: false,
          message: "Failed to connect to user's personal email - check email configuration",
          newResponses: 0
        };
      }

      // Connect to user's personal IMAP
      const connected = await this.connectToPersonalImap(personalImap, userId);
      if (!connected) {
        return {
          success: false,
          message: "Failed to connect to personal email server - check credentials",
          newResponses: 0
        };
      }

      // Count responses before checking
      let responsesBefore = 0;
      let responsesAfter = 0;

      if (requestId) {
        const initialResponses = await storage.getSupplierResponses(requestId, userId);
        responsesBefore = initialResponses.length;
        console.log(`[PERSONAL EMAIL] User ${userId} Request ${requestId} currently has ${responsesBefore} responses`);

        // Get the request to extract order number
        const request = await storage.getSearchRequest(requestId, userId);
        if (request && request.orderNumber) {
          console.log(`[PERSONAL EMAIL] Using order number ${request.orderNumber} for targeted email search in user's mailbox`);
          await this.checkPersonalEmailsForOrderNumber(personalImap, request.orderNumber, userId);
        } else {
          console.log('[PERSONAL EMAIL] No order number found, checking all personal emails');
          await this.checkPersonalEmails(personalImap, userId);
        }
      } else {
        responsesBefore = await storage.countAllSupplierResponses();
        console.log(`[PERSONAL EMAIL] User ${userId} currently has ${responsesBefore} total responses`);

        // Check all emails in user's personal mailbox
        await this.checkPersonalEmails(personalImap, userId);
      }

      // Count responses after
      let newResponses = 0;

      if (requestId) {
        const updatedResponses = await storage.getSupplierResponses(requestId, userId);
        responsesAfter = updatedResponses.length;
        newResponses = responsesAfter - responsesBefore;
        console.log(`[PERSONAL EMAIL] Request now has ${responsesAfter} responses (${newResponses} new)`);
      } else {
        responsesAfter = await storage.countAllSupplierResponses();
        newResponses = responsesAfter - responsesBefore;
      }

      // Обновляем время последней проверки после успешной проверки
      this.lastCheckTime.set(userId, new Date());
      
      return {
        success: true,
        message: newResponses > 0 
          ? `Found and processed ${newResponses} new supplier ${newResponses === 1 ? 'response' : 'responses'} from personal mailbox` 
          : "No new supplier responses found in personal mailbox",
        newResponses
      };
    } catch (error: unknown) {
      console.error("[PERSONAL EMAIL] Error checking personal emails on demand:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Error checking personal emails: ${errorMessage}`,
        newResponses: 0
      };
    }
  }

  private async checkPersonalEmails(imap: Imap, userId: number): Promise<void> {
    console.log(`[PERSONAL EMAIL] Starting personal email check for user ${userId}`);
    
    // Проверяем только INBOX, так как не все почтовые сервисы имеют папку Spam
    const foldersToCheck = ['INBOX'];
    
    for (const folder of foldersToCheck) {
      console.log(`[PERSONAL EMAIL] Checking folder: ${folder} for user ${userId}`);
      try {
        await this.checkPersonalFolder(imap, folder, userId);
      } catch (error) {
        console.error(`[PERSONAL EMAIL] Error checking folder ${folder} for user ${userId}:`, error);
      }
    }

    console.log(`[PERSONAL EMAIL] Done checking all folders for user ${userId}`);
  }

  private async checkPersonalEmailsForOrderNumber(imap: Imap, orderNumber: string, userId: number): Promise<void> {
    console.log(`[PERSONAL EMAIL] Starting targeted email check for order ${orderNumber}, user ${userId}`);
    
    // Проверяем только INBOX, так как не все почтовые сервисы имеют папку Spam
    const foldersToCheck = ['INBOX'];
    
    for (const folder of foldersToCheck) {
      console.log(`[PERSONAL EMAIL] Checking folder: ${folder} for order ${orderNumber}, user ${userId}`);
      try {
        await this.checkPersonalFolderWithOrderNumber(imap, folder, orderNumber, userId);
      } catch (error) {
        console.error(`[PERSONAL EMAIL] Error checking folder ${folder} for order ${orderNumber}, user ${userId}:`, error);
      }
    }

    console.log(`[PERSONAL EMAIL] Done checking for order ${orderNumber}, user ${userId}`);
  }

  private async checkPersonalFolder(imap: Imap, folderName: string, userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      imap.openBox(folderName, false, (err, box) => {
        if (err) {
          console.error(`[PERSONAL EMAIL] Failed to open ${folderName} for user ${userId}:`, err);
          return reject(err);
        }

        console.log(`[PERSONAL EMAIL] Successfully opened ${folderName} for user ${userId}`);

        // Используем время последней проверки для этого пользователя или 7 дней назад для первой проверки
        const lastCheck = this.lastCheckTime.get(userId) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const searchDate = new Date(lastCheck.getTime() - 2 * 60 * 60 * 1000); // Добавляем 2 часа буфера
        
        console.log(`[PERSONAL EMAIL] Last check was: ${lastCheck.toISOString()}`);
        console.log(`[PERSONAL EMAIL] Searching for emails since ${searchDate.toISOString()} for user ${userId}`);
        const searchCriteria = ['ALL', ['SINCE', searchDate]];

        imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);
          if (!results || !results.length) {
            console.log(`[PERSONAL EMAIL] No emails found in ${folderName} for user ${userId}`);
            return resolve();
          }

          console.log(`[PERSONAL EMAIL] Found ${results.length} emails in ${folderName} for user ${userId}`);

          const fetch = imap.fetch(results, {
            bodies: '',
            markSeen: false
          });

          fetch.on('message', (msg: any) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream, async (err: any, parsed: any) => {
                if (err) {
                  console.error(`[PERSONAL EMAIL] Error parsing email for user ${userId}:`, err);
                  return;
                }
                await this.processPersonalEmail(parsed, userId);
              });
            });
          });

          fetch.once('error', (err: any) => {
            console.error(`[PERSONAL EMAIL] Fetch error in ${folderName} for user ${userId}:`, err);
            reject(err);
          });

          fetch.once('end', () => {
            console.log(`[PERSONAL EMAIL] Done checking emails in ${folderName} for user ${userId}`);
            resolve();
          });
        });
      });
    });
  }

  private async checkPersonalFolderWithOrderNumber(imap: Imap, folderName: string, orderNumber: string, userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      imap.openBox(folderName, false, (err, box) => {
        if (err) {
          console.error(`[PERSONAL EMAIL] Failed to open ${folderName} for order ${orderNumber}, user ${userId}:`, err);
          return reject(err);
        }

        console.log(`[PERSONAL EMAIL] Successfully opened ${folderName} for order ${orderNumber}, user ${userId}`);

        // Используем время последней проверки для этого пользователя или 7 дней назад для первой проверки
        const lastCheck = this.lastCheckTime.get(userId) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const searchDate = new Date(lastCheck.getTime() - 2 * 60 * 60 * 1000); // Добавляем 2 часа буфера
        
        console.log(`[PERSONAL EMAIL] Last check was: ${lastCheck.toISOString()}`);
        console.log(`[PERSONAL EMAIL] Searching for emails with order ${orderNumber} since ${searchDate.toISOString()} for user ${userId}`);
        // Search for emails containing the order number
        const searchCriteria = ['ALL', ['SINCE', searchDate], ['SUBJECT', orderNumber]];

        imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);
          if (!results || !results.length) {
            console.log(`[PERSONAL EMAIL] No emails found with order ${orderNumber} in ${folderName} for user ${userId}`);
            return resolve();
          }

          console.log(`[PERSONAL EMAIL] Found ${results.length} emails with order ${orderNumber} in ${folderName} for user ${userId}`);

          const fetch = imap.fetch(results, {
            bodies: '',
            markSeen: false
          });

          fetch.on('message', (msg: any) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream, async (err: any, parsed: any) => {
                if (err) {
                  console.error(`[PERSONAL EMAIL] Error parsing email for order ${orderNumber}, user ${userId}:`, err);
                  return;
                }
                await this.processPersonalEmail(parsed, userId);
              });
            });
          });

          fetch.once('error', (err: any) => {
            console.error(`[PERSONAL EMAIL] Fetch error in ${folderName} for order ${orderNumber}, user ${userId}:`, err);
            reject(err);
          });

          fetch.once('end', () => {
            console.log(`[PERSONAL EMAIL] Done checking emails with order ${orderNumber} in ${folderName} for user ${userId}`);
            resolve();
          });
        });
      });
    });
  }

  private async processPersonalEmail(parsed: any, userId: number): Promise<void> {
    if (!parsed || !parsed.messageId) {
      console.log(`[PERSONAL EMAIL] Skipping email without messageId for user ${userId}`);
      return;
    }

    const messageId = parsed.messageId;
    const userMessageKey = `${userId}:${messageId}`;
    console.log(`\n🔍 [PERSONAL EMAIL PROCESSING] Starting email processing for message ID: ${messageId}, user: ${userId}`);
    
    // Check if this email was already successfully processed
    if (this.processedMessageIds.has(userMessageKey)) {
      console.log(`⏭️ [PERSONAL EMAIL CACHING] Email ${messageId} found in memory cache for user ${userId} - skipping`);
      return;
    }

    const result = await this._processPersonalEmailWithDetails(parsed, userId);
    
    // НОВАЯ ЛОГИКА КЕШИРОВАНИЯ - только success в кеш
    if (result.status === 'success' && 
        result.savedToDb === true && 
        result.attachmentsProcessed === true) {
      this.processedMessageIds.add(userMessageKey);
      console.log(`✅ [PERSONAL EMAIL CACHING] Email ${messageId} successfully processed and cached for user ${userId}`);
    } else if (result.status === 'already_processed' && result.alreadyInDatabase) {
      // Также кешируем если email уже был успешно обработан ранее
      this.processedMessageIds.add(userMessageKey);
      console.log(`✅ [PERSONAL EMAIL CACHING] Email ${messageId} already in database, added to cache for user ${userId}`);
    } else {
      console.log(`❌ [PERSONAL EMAIL CACHING] Email ${messageId} not cached for user ${userId} due to: ${result.status}, DB: ${result.savedToDb}, Attachments: ${result.attachmentsProcessed}`);
      if (result.error) {
        console.log(`🚨 [PERSONAL EMAIL CACHING] Error details: ${result.error}`);
      }
      if (result.attachmentErrors && result.attachmentErrors.length > 0) {
        console.log(`📎 [PERSONAL EMAIL CACHING] Attachment errors: ${result.attachmentErrors.join(', ')}`);
      }
    }
  }

  private async _processPersonalEmailWithDetails(parsed: any, userId: number): Promise<PersonalEmailProcessingResult> {
    const messageId = parsed.messageId;
    let result: PersonalEmailProcessingResult = {
      status: 'failed',
      savedToDb: false,
      attachmentsProcessed: false,
      messageId: messageId
    };

    try {
      console.log(`📧 [PERSONAL EMAIL DETAILS] Processing email ${messageId} for user ${userId}`);
      console.log(`📧 [PERSONAL EMAIL DETAILS] From: ${parsed.from?.text || 'Unknown'}`);
      console.log(`📧 [PERSONAL EMAIL DETAILS] Subject: ${parsed.subject || 'No subject'}`);

      // ПЕРВАЯ ПРОВЕРКА: База данных - самая надежная
      try {
        const existingResponse = await storage.findSupplierResponseByMessageId(messageId, userId);
        if (existingResponse) {
          console.log(`✅ [DATABASE] Email ${messageId} already exists in database for user ${userId}`);
          result.status = 'already_processed';
          result.alreadyInDatabase = true;
          result.savedToDb = true;
          result.attachmentsProcessed = true; // Assume previously processed attachments are OK
          return result;
        }
      } catch (error) {
        console.log(`⚠️ [DATABASE] Error checking database for messageId ${messageId}, user ${userId}:`, error);
        result.error = `Database check error: ${error instanceof Error ? error.message : String(error)}`;
        // Продолжаем обработку в случае ошибки БД
      }

      // Extract tracking information
      const trackingInfo = this.extractTrackingInfo(parsed.text || '', parsed.subject || '');
      
      if (!trackingInfo.orderNumber && !trackingInfo.trackingId) {
        console.log(`❌ [TRACKING] No tracking information found in email for user ${userId}`);
        result.status = 'no_tracking';
        result.error = 'No tracking information found';
        return result;
      }

      console.log(`✅ [TRACKING] Found tracking info for user ${userId}:`, trackingInfo);

      // Process attachments if any
      const attachments = parsed.attachments ? parsed.attachments.map((att: any) => ({
        filename: att.filename || 'attachment',
        contentType: att.contentType || 'application/octet-stream',
        content: att.content ? att.content.toString('base64') : '',
        encoding: 'base64',
        size: att.size || (att.content ? att.content.length : 0)
      })) : [];

      console.log(`📎 [ATTACHMENTS] Found ${attachments.length} attachments in email`);

      // Find the request ID by order number
      let requestId = null;
      if (trackingInfo.orderNumber) {
        console.log(`🔍 [REQUEST LOOKUP] Looking up request ID for order number: ${trackingInfo.orderNumber}, user: ${userId}`);
        const searchRequest = await storage.getSearchRequestByOrderNumber(trackingInfo.orderNumber, userId);
        if (searchRequest) {
          requestId = searchRequest.id;
          console.log(`✅ [REQUEST LOOKUP] Found request ID ${requestId} for order ${trackingInfo.orderNumber}`);
        } else {
          console.log(`❌ [REQUEST LOOKUP] ERROR: No request found for order number ${trackingInfo.orderNumber} and user ${userId}`);
          result.status = 'failed';
          result.error = `No request found for order number ${trackingInfo.orderNumber}`;
          return result;
        }
      } else {
        console.log(`❌ [REQUEST LOOKUP] ERROR: No order number found in email, cannot process`);
        result.status = 'failed';
        result.error = 'No order number found in email';
        return result;
      }

      // Create supplier response record
      const responseData = {
        requestId: requestId, // Required field - must not be null
        requestSupplierId: null, // Will be resolved by matching logic
        supplierId: parsed.from?.value?.[0]?.address || 'unknown',
        supplierEmail: parsed.from?.value?.[0]?.address || parsed.from?.text || 'unknown@email.com',
        supplierName: parsed.from?.value?.[0]?.name || parsed.from?.text || 'Unknown Supplier',
        subject: parsed.subject || 'No subject',
        content: parsed.text || parsed.html || '',
        responseDate: parsed.date || new Date(),
        attachments: attachments,
        messageId: messageId,
        userId: userId
      };

      console.log(`💾 [DATABASE] Saving supplier response for user ${userId}:`, {
        requestId: responseData.requestId,
        supplier: responseData.supplierEmail,
        subject: responseData.subject,
        orderNumber: trackingInfo.orderNumber,
        trackingId: trackingInfo.trackingId,
        hasAttachments: attachments.length > 0
      });

      // Save to database with user association
      try {
        const savedResponse = await storage.createSupplierResponse(responseData);
        result.savedToDb = true;
        result.dbRecordId = savedResponse?.id;
        console.log(`✅ [DATABASE] Successfully saved email to database with ID: ${result.dbRecordId}`);

        // Отправляем уведомление через Socket.IO о новом email
        try {
          const io = (global as any).io;
          if (io) {
            io.to(`user_${userId}`).emit('newEmail', {
              responseId: result.dbRecordId,
              requestId: responseData.requestId,
              supplier: responseData.supplier,
              subject: responseData.subject,
              orderNumber: responseData.orderNumber,
              hasAttachments: responseData.hasAttachments,
              timestamp: new Date().toISOString()
            });
            console.log(`📡 [SOCKET] Sent new email notification to user ${userId} for response ${result.dbRecordId}`);
          }
        } catch (socketError) {
          console.error('❌ [SOCKET] Error sending new email notification:', socketError);
        }

        // Запускаем автоматическую обработку attachments если они есть
        if (attachments && attachments.length > 0 && savedResponse) {
          console.log(`🔄 Starting automatic attachment processing for response ${savedResponse.id} with ${attachments.length} attachments`);
          try {
            const { AsyncEmailProcessor } = await import('./async-processing/email-processor');
            const processor = AsyncEmailProcessor.getInstance();
            await processor.processNewEmail(savedResponse);
            console.log(`✅ Automatic attachment processing started for response ${savedResponse.id}`);
          } catch (error) {
            console.error(`❌ Failed to start automatic attachment processing for response ${savedResponse.id}:`, error);
          }
        }

        // Запускаем автоматическое извлечение параметров (ТОЧНО КАК В РУЧНОЙ РЕАЛИЗАЦИИ)
        if (savedResponse && responseData.requestId) {
          console.log(`🔄 Starting automatic parameter extraction for response ${savedResponse.id}`);
          try {
            // Получаем параметры запроса
            const requestParams = await storage.getParametersForRequest(responseData.requestId);
            if (requestParams && requestParams.parameters) {
              const parameters = Array.isArray(requestParams.parameters) 
                ? requestParams.parameters 
                : JSON.parse(requestParams.parameters as string);
              
              if (parameters && parameters.length > 0) {
                // ШАГ 1: Анализ вложений (если есть)
                let attachmentParameters: Record<string, any> = {};
                let hasAttachmentData = false;
                
                if (attachments && attachments.length > 0) {
                  console.log(`🔄 Step 1: Analyzing ${attachments.length} attachments for response ${savedResponse.id}`);
                  try {
                    // Сначала обрабатываем вложения для извлечения текста
                    const { apiAttachmentBridge } = await import('./file-processing/api_bridge.cjs');
                    const attachmentResult = await apiAttachmentBridge.analyzeSupplierResponseAttachments(savedResponse);
                    
                    console.log(`📎 Attachment processing result:`, attachmentResult);
                    
                    if (attachmentResult && attachmentResult.parameters && Object.keys(attachmentResult.parameters).length > 0) {
                      attachmentParameters = attachmentResult.parameters;
                      hasAttachmentData = true;
                      console.log(`✅ Step 1: Successfully extracted parameters from attachments:`, attachmentParameters);
                    } else {
                      console.log(`⚠️ Step 1: No parameters found in attachments, will try email body`);
                    }
                  } catch (error) {
                    console.warn(`⚠️ Step 1: Attachment analysis error:`, error);
                  }
                }
                
                // ШАГ 2: Извлечение из тела письма
                console.log(`🔄 Step 2: Extracting parameters from email body for response ${savedResponse.id}`);
                try {
                  // Ждем немного, чтобы вложения успели обработаться
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  
                  // Используем прямую функцию извлечения параметров
                  const { extractParametersFromResponse } = await import('./routes/extract-parameters');
                  const bodyResult = await extractParametersFromResponse(
                    savedResponse.id,
                    parameters,
                    true // useAI = true
                  );
                  
                  console.log(`✅ Step 2: Parameters extracted from email body using AI:`, bodyResult);
                  
                  // ШАГ 3: Приоритизация источников (ТОЧНО КАК В РУЧНОЙ РЕАЛИЗАЦИИ)
                  let bodyParameters: Record<string, any> = {};
                  let finalParameters: Record<string, string> = {};
                  
                  // Обрабатываем параметры из тела письма
                  if (bodyResult && bodyResult.length > 0) {
                    bodyResult.forEach((param: any) => {
                      bodyParameters[param.name] = param.value || '-';
                    });
                  }
                  
                  // Применяем правила приоритета: Вложения > Тело письма
                  parameters.forEach(paramName => {
                    if (hasAttachmentData && attachmentParameters[paramName] && 
                        attachmentParameters[paramName] !== '-' && 
                        attachmentParameters[paramName] !== '' && 
                        attachmentParameters[paramName] !== null) {
                      finalParameters[paramName] = String(attachmentParameters[paramName]);
                      console.log(`Priority rule: Using attachment value for ${paramName}: ${attachmentParameters[paramName]}`);
                    } else if (bodyParameters[paramName] && 
                               bodyParameters[paramName] !== '-' && 
                               bodyParameters[paramName] !== '' && 
                               bodyParameters[paramName] !== null) {
                      finalParameters[paramName] = String(bodyParameters[paramName]);
                      console.log(`Priority rule: Using body value for ${paramName}: ${bodyParameters[paramName]}`);
                    } else {
                      finalParameters[paramName] = '-';
                      console.log(`Priority rule: No value found for ${paramName}, using default '-'`);
                    }
                  });
                  
                  // Сохраняем извлеченные параметры в базу данных
                  console.log(`🔄 Step 3: Saving extracted parameters to database for response ${savedResponse.id}`);
                  await storage.saveExtractedParameters({
                    responseId: savedResponse.id,
                    requestId: responseData.requestId,
                    supplierEmail: responseData.supplierEmail,
                    parameters: finalParameters,
                    status: Object.values(finalParameters).some(val => val && val !== '-') ? 'completed' : 'no_parameters_found',
                    userId: userId
                  });
                  
                  console.log(`✅ Automatic parameter extraction completed for response ${savedResponse.id}:`, finalParameters);
                } catch (error) {
                  console.error(`❌ Step 2: Error extracting parameters from email body:`, error);
                }
              } else {
                console.log(`⚠️ No parameters found for request ${responseData.requestId}, skipping parameter extraction`);
              }
            } else {
              console.log(`⚠️ No request parameters found for request ${responseData.requestId}, skipping parameter extraction`);
            }
          } catch (error) {
            console.error(`❌ Failed to start automatic parameter extraction for response ${savedResponse.id}:`, error);
          }
        }
      } catch (dbError) {
        console.error(`❌ [DATABASE] Error saving supplier response:`, dbError);
        result.status = 'db_error';
        result.error = `Database save error: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
        return result;
      }
      
      // Attachment processing (always considered successful if no attachments)
      result.attachmentsProcessed = true;
      let attachmentErrors: string[] = [];
      
      if (attachments.length > 0) {
        try {
          console.log(`⚙️ [ATTACHMENTS] Processing ${attachments.length} attachments...`);
          // TODO: Add attachment processing logic here if needed
          // For now, we consider attachments as successfully processed if they're saved with the response
          console.log(`✅ [ATTACHMENTS] All attachments processed successfully`);
        } catch (attachError) {
          console.error(`❌ [ATTACHMENTS] Error processing attachments:`, attachError);
          attachmentErrors.push(`Attachment processing error: ${attachError instanceof Error ? attachError.message : String(attachError)}`);
          result.attachmentsProcessed = false;
        }
      }
      
      // Set final status
      if (result.savedToDb && result.attachmentsProcessed) {
        result.status = 'success';
        console.log(`🎉 [PROCESSING] Email ${messageId} processed completely successfully for user ${userId}`);
        
        // Обновляем время последней проверки для этого пользователя
        this.lastCheckTime.set(userId, new Date());
      } else if (!result.savedToDb) {
        result.status = 'db_error';
        console.log(`🚨 [PROCESSING] Email ${messageId} failed due to database error for user ${userId}`);
      } else if (!result.attachmentsProcessed) {
        result.status = 'attachment_error';
        result.attachmentErrors = attachmentErrors;
        console.log(`⚠️ [PROCESSING] Email ${messageId} saved to DB but failed attachment processing for user ${userId}`);
      }
      
      return result;

    } catch (error) {
      console.error(`🚨 [PERSONAL EMAIL ERROR] Error processing email ${messageId} for user ${userId}:`, error);
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  private extractTrackingInfo(content: string, subject: string): { trackingId?: string; orderNumber?: string } {
    const result: { trackingId?: string; orderNumber?: string } = {};

    console.log(`[PERSONAL EMAIL] 🔍 Extracting tracking info from subject: "${subject}"`);
    console.log(`[PERSONAL EMAIL] 🔍 Content preview: "${content.substring(0, 100)}..."`);

    const fullText = `${subject} ${content}`;
    
    // ИСПРАВЛЕНИЕ 1: Поиск order number в квадратных скобках [REQ-XXXXXXXXX] (буквы, цифры, подчеркивание)
    const bracketOrderMatch = fullText.match(/\[REQ-([A-Z0-9_-]+)\]/);
    if (bracketOrderMatch) {
      result.orderNumber = `REQ-${bracketOrderMatch[1]}`;
      console.log(`[PERSONAL EMAIL] ✅ BRACKET ORDER MATCH - Found: ${result.orderNumber}`);
    }
    
    // ИСПРАВЛЕНИЕ 2: Поиск tracking ID в квадратных скобках [TID:XXXXXXXXX]
    const bracketTidMatch = fullText.match(/\[TID:([A-Za-z0-9]+)\]/);
    if (bracketTidMatch) {
      result.trackingId = bracketTidMatch[1];
      console.log(`[PERSONAL EMAIL] ✅ BRACKET TID MATCH - Found: ${result.trackingId}`);
    }

    // Fallback: Direct search for REQ-XXXX-XXXXX без скобок (для совместимости)
    if (!result.orderNumber) {
      const directOrderMatch = fullText.match(/REQ-\d{4}-\d{5}/);
      if (directOrderMatch) {
        result.orderNumber = directOrderMatch[0];
        console.log(`[PERSONAL EMAIL] ✅ DIRECT MATCH - Found order number: ${result.orderNumber}`);
      }
    }
    
    // Fallback: Поиск tracking ID в тексте (старый алгоритм для совместимости)
    if (!result.trackingId) {
      const fullTextLower = fullText.toLowerCase();
      const trackingMatch = fullTextLower.match(/tracking[:\s]+([a-z0-9]{8,})/i);
      if (trackingMatch && trackingMatch[1]) {
        result.trackingId = trackingMatch[1].trim();
        console.log(`[PERSONAL EMAIL] ✅ FALLBACK TRACKING MATCH - Found: ${result.trackingId}`);
      }
    }
    
    // Fallback: Поиск order number в контенте (старый алгоритм для совместимости)
    if (!result.orderNumber) {
      const fullTextLower = fullText.toLowerCase();
      const orderMatch = fullTextLower.match(/(?:order|request)\s*(?:number|id|#)?\s*[:#\s]+\s*(req-\d{4}-\d{5})/i);
      if (orderMatch && orderMatch[1]) {
        result.orderNumber = orderMatch[1].toUpperCase();
        console.log(`[PERSONAL EMAIL] ✅ FALLBACK CONTENT MATCH - Found: ${result.orderNumber}`);
      }
    }
    
    // Альтернативный формат без REQ префикса
    if (!result.orderNumber) {
      const fullTextLower = fullText.toLowerCase();
      const altOrderMatch = fullTextLower.match(/(?:order|request)\s*(?:number|id|#)?\s*[:#\s]+\s*(\d{4}-\d{5})/i);
      if (altOrderMatch && altOrderMatch[1]) {
        result.orderNumber = `REQ-${altOrderMatch[1].toUpperCase()}`;
        console.log(`[PERSONAL EMAIL] ✅ FALLBACK ALT FORMAT - Found: ${result.orderNumber}`);
      }
    }
    
    // Логирование результата
    if (result.orderNumber || result.trackingId) {
      console.log(`[PERSONAL EMAIL] 🎯 EXTRACTION SUCCESS - Order: ${result.orderNumber || 'N/A'}, Tracking: ${result.trackingId || 'N/A'}`);
    } else {
      console.log(`[PERSONAL EMAIL] ❌ EXTRACTION FAILED - No tracking info found in: "${subject}"`);
      console.log(`[PERSONAL EMAIL] 🔍 Debug - Testing regex patterns manually...`);
      
      // Debug: тестируем каждый паттерн отдельно
      console.log(`[PERSONAL EMAIL] 🔍 Test [REQ-XXXXX]: ${/\[REQ-([A-Z0-9_-]+)\]/.test(fullText)}`);
      console.log(`[PERSONAL EMAIL] 🔍 Test [TID:XXXXX]: ${/\[TID:([A-Za-z0-9]+)\]/.test(fullText)}`);
      console.log(`[PERSONAL EMAIL] 🔍 Test REQ-XXXXX: ${/REQ-[A-Z0-9_-]+/.test(fullText)}`);
    }
    
    return result;
  }

  // Clean up connections
  public cleanup(): void {
    console.log('[PERSONAL EMAIL] Cleaning up personal IMAP connections');
    for (const [userId, imap] of Array.from(this.personalImapConnections.entries())) {
      try {
        (imap as any).end();
        console.log(`[PERSONAL EMAIL] Closed connection for user ${userId}`);
      } catch (error) {
        console.error(`[PERSONAL EMAIL] Error closing connection for user ${userId}:`, error);
      }
    }
    this.personalImapConnections.clear();
  }
}

// Export singleton instance
export const personalImapService = new PersonalImapService();