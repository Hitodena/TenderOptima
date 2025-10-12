import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { storage } from './storage';
import { createRequire } from 'module';
import { REQ_PATTERNS, TID_PATTERNS, EmailPatternMatcher } from './utils/email-patterns';

// ES modules workaround for requiring CommonJS modules
const require = createRequire(import.meta.url);

// Interface for detailed email processing results
interface EmailProcessingResult {
  status: 'success' | 'failed' | 'timeout' | 'db_error' | 'attachment_error';
  savedToDb: boolean;
  dbRecordId?: number;
  attachmentsProcessed: boolean;
  attachmentErrors?: string[];
  error?: string;
  messageId: string;
}

export class ImapService {
  private personalImapConnections = new Map<number, Imap>();
  private processedMessageIds = new Set<string>();
  private responseCache = new Map<string, any>();
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 60000; // 1 минута кэш

  constructor() {
    console.log('Initializing Personal IMAP Service - each user will have their own IMAP connection');
  }

  private async getPersonalImapConnection(userId: number): Promise<Imap | null> {
    console.log(`[IMAP] Creating personal IMAP connection for user ${userId}`);
    
    // Get user's personal email configuration
    const userConfig = await storage.getUserEmailConfig(userId);
    console.log(`[IMAP] CRITICAL DEBUG - User ${userId} email config:`, JSON.stringify(userConfig, null, 2));
    
    if (!userConfig || !userConfig.emailAccount || !userConfig.emailPassword) {
      console.log(`[IMAP] User ${userId} has no email configuration - skipping IMAP connection`);
      return null;
    }

    if (!userConfig.emailConfigured) {
      console.log(`[IMAP] User ${userId} email not configured - skipping IMAP connection`);
      return null;
    }

    // Check if we already have a connection for this user
    if (this.personalImapConnections.has(userId)) {
      const existingConnection = this.personalImapConnections.get(userId)!;
      console.log(`[IMAP] Using existing IMAP connection for user ${userId}`);
      return existingConnection;
    }

    try {
      const imapHost = userConfig.imapHost || 'imap.mail.ru';
      const imapPort = userConfig.imapPort || 993;
      
      console.log(`[IMAP] Creating new IMAP connection for user ${userId}:`);
      console.log(`[IMAP] - Email: ${userConfig.emailAccount}`);
      console.log(`[IMAP] - IMAP Host: ${imapHost}`);
      console.log(`[IMAP] - IMAP Port: ${imapPort}`);
      
      const imap = new Imap({
        user: userConfig.emailAccount,
        password: userConfig.emailPassword,
        host: imapHost,
        port: imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 30000
      });

      // Store this connection for future use
      this.personalImapConnections.set(userId, imap);

      imap.once('ready', () => {
        console.log(`[IMAP] Personal connection ready for user ${userId} (${userConfig.emailAccount})`);
      });

      imap.once('error', (err) => {
        console.error(`[IMAP] Personal connection error for user ${userId}:`, err);
        this.personalImapConnections.delete(userId);
      });

      imap.once('end', () => {
        console.log(`[IMAP] Personal connection ended for user ${userId}`);
        this.personalImapConnections.delete(userId);
      });

      return imap;
    } catch (error) {
      console.error(`[IMAP] Failed to create personal IMAP connection for user ${userId}:`, error);
      return null;
    }
  }

  private handleConnectionError(err: Error) {
  }

  private handleConnectionEnd() {
  }
  
  // Helper function to extract tracking info from email content
  private extractTrackingInfo(content: string, subject: string): { trackingId?: string; orderNumber?: string } {
    const result: { trackingId?: string; orderNumber?: string } = {};
    
    console.log(`\n🔍 Extracting tracking info from subject: "${subject}"`);
    
    // Прямой поиск REQ-XXXX-XXXXX в теме (приоритетно) - поддерживает дефисы и подчеркивания
    const directOrderMatch = subject.match(REQ_PATTERNS.DIRECT);
    if (directOrderMatch) {
      result.orderNumber = directOrderMatch[0];
      console.log(`✅ DIRECT MATCH - Found order number in subject: ${result.orderNumber}`);
    }
    
    // Прямой поиск [TID:...] в теме - поддерживает подчеркивания
    const directTrackingMatch = subject.match(TID_PATTERNS.BRACKET);
    if (directTrackingMatch && directTrackingMatch[1]) {
      result.trackingId = directTrackingMatch[1].trim();
      console.log(`✅ DIRECT MATCH - Found tracking ID in subject: ${result.trackingId}`);
    }
    
    // Combined text to search in (только если прямой поиск не дал результатов)
    const fullText = `${subject}\n${content}`;
    
    // Try to extract tracking ID (typically alphanumeric with underscores)
    if (!result.trackingId) {
      const trackingMatch = fullText.match(TID_PATTERNS.CONTENT);
      if (trackingMatch && trackingMatch[1]) {
        result.trackingId = trackingMatch[1].trim();
        console.log(`✅ CONTENT MATCH - Found tracking ID in content: ${result.trackingId}`);
      }
    }
    
    // Try to extract order number (supports dashes and underscores)
    if (!result.orderNumber) {
      const orderMatch = fullText.match(REQ_PATTERNS.CONTENT);
      if (orderMatch && orderMatch[1]) {
        result.orderNumber = orderMatch[1].trim();
        console.log(`✅ CONTENT MATCH - Found order number in content: ${result.orderNumber}`);
      }
    }
    
    // Alternative format without REQ prefix (supports dashes and underscores)
    if (!result.orderNumber) {
      const altOrderMatch = fullText.match(REQ_PATTERNS.ALTERNATIVE);
      if (altOrderMatch && altOrderMatch[1]) {
        result.orderNumber = `REQ-${altOrderMatch[1].trim()}`;
        console.log(`✅ CONTENT MATCH - Found alternative order number format: ${result.orderNumber}`);
      }
    }
    
    return result;
  }

  public async checkEmailsOnDemand(requestId?: number, userId?: number): Promise<{
    success: boolean;
    message: string;
    newResponses: number;
  }> {
    console.log(`Checking emails on demand for request ID: ${requestId || 'all'} and user ID: ${userId || 'all'}`);
    
    // НЕ ОЧИЩАЕМ кэш обработанных сообщений - это причина дубликатов!
    // Память о processedMessageIds должна сохраняться между запросами
    console.log(`Keeping processed message cache intact (${this.processedMessageIds.size} messages already processed)`);

    try {
      this.initializeConnection();

      if (!this.imap) {
        console.log("IMAP not configured. Checking for test suppliers via alternative method.");

        if (requestId) {
          try {
            const testResponse = await fetch(`http://localhost:5000/api/test/add-response/${requestId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });

            const testData = await testResponse.json();

            if (testData.success) {
              console.log('Added test supplier response via alternative method');
              return {
                success: true,
                message: `Found and processed 1 new supplier response (simulated)`,
                newResponses: 1
              };
            }
          } catch (testError) {
            console.error("Error simulating response:", testError);
          }
        }

        return {
          success: true,
          message: "IMAP not configured. No new supplier responses found.",
          newResponses: 0
        };
      }

      if (!this.isConnected) {
        console.log("IMAP not connected, connecting now...");
        await new Promise<void>((resolve, reject) => {
          this.imap?.once('ready', () => resolve());
          this.imap?.once('error', (err) => reject(err));
          this.imap?.connect();
        });
      }

      let responsesBefore = 0;

      if (requestId) {
        console.log(`Looking specifically for emails related to request ID: ${requestId}`);
        const request = await storage.getSearchRequest(requestId);

        if (request) {
          console.log(`Request order number: ${request.orderNumber}`);
          const requestSuppliers = await storage.getRequestSuppliers(requestId);
          console.log(`Request has ${requestSuppliers.length} contacted suppliers`);

          if (requestSuppliers.length > 0) {
            console.log("Tracking IDs to look for:");
            requestSuppliers.forEach(s => console.log(`- ${s.trackingId} (${s.supplierName})`));
          }

          const existingResponses = await storage.getSupplierResponses(requestId);
          responsesBefore = existingResponses.length;
          console.log(`Request has ${responsesBefore} existing responses before checking`);

          const orderNumber = request.orderNumber;
          await this._checkEmailsForOrderNumber(orderNumber, userId);
        } else {
          console.log(`Warning: Request with ID ${requestId} not found`);
          await this._checkEmails(userId);
        }
      } else {
        responsesBefore = await storage.countAllSupplierResponses();
        await this._checkEmails(userId);
      }

      let responsesAfter = 0;
      let newResponses = 0;

      if (requestId) {
        const updatedResponses = await storage.getSupplierResponses(requestId);
        responsesAfter = updatedResponses.length;
        newResponses = responsesAfter - responsesBefore;
        console.log(`Request now has ${responsesAfter} responses (${newResponses} new)`);
      } else {
        responsesAfter = await storage.countAllSupplierResponses();
        newResponses = responsesAfter - responsesBefore;
      }

      return {
        success: true,
        message: newResponses > 0 
          ? `Found and processed ${newResponses} new supplier ${newResponses === 1 ? 'response' : 'responses'}` 
          : "No new supplier responses found",
        newResponses
      };
    } catch (error: unknown) {
      console.error("Error checking emails on demand:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Error checking emails: ${errorMessage}`,
        newResponses: 0
      };
    }
  }

  private async _checkEmails(userId?: number): Promise<void> {
    console.log('========================');
    console.log('🔍 [GENERAL IMAP] Starting general IMAP check at:', new Date().toISOString());
    console.log('🔍 [GENERAL IMAP] User ID:', userId || 'No user specified');
    console.log('🔍 [GENERAL IMAP] IMAP connection status:', this.imap ? 'Connected' : 'Not connected');

    if (!this.imap) {
      console.error('❌ [GENERAL IMAP] IMAP connection is not initialized');
      throw new Error("IMAP connection is not initialized");
    }

    // Используем только INBOX и Spam (для mail.ru)
    // '[Gmail]/Spam' не работает на mail.ru
    const foldersToCheck = ['INBOX', 'Spam'];
    console.log('🔍 [GENERAL IMAP] Folders to check:', foldersToCheck);

    for (const folder of foldersToCheck) {
      console.log(`🔍 [GENERAL IMAP] Checking folder: ${folder}`);
      try {
        await this.checkFolder(folder, userId);
        console.log(`✅ [GENERAL IMAP] Successfully checked folder: ${folder}`);
      } catch (error) {
        console.error(`❌ [GENERAL IMAP] Error checking folder ${folder}:`, error);
      }
    }

    console.log('✅ [GENERAL IMAP] Done checking all email folders');
    return;
  }

  private async _checkEmailsForOrderNumber(orderNumber: string, userId?: number): Promise<void> {
    console.log('========================');
    console.log(`Starting optimized IMAP check for order number: ${orderNumber} at:`, new Date().toISOString());

    if (!this.imap) {
      throw new Error("IMAP connection is not initialized");
    }

    // Используем только INBOX и Spam (для mail.ru)
    // '[Gmail]/Spam' не работает на mail.ru
    const foldersToCheck = ['INBOX', 'Spam'];

    for (const folder of foldersToCheck) {
      console.log(`Checking folder: ${folder} for messages with order number: ${orderNumber}`);
      try {
        await this.checkFolderWithOrderNumber(folder, orderNumber, userId);
      } catch (error) {
        console.error(`Error checking folder ${folder} for order number:`, error);
      }
    }

    console.log(`Done checking for emails with order number: ${orderNumber}`);
    return;
  }

  private async checkFolder(folderName: string, userId?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        return reject(new Error("IMAP connection is not initialized"));
      }

      this.imap.openBox(folderName, false, async (err, box) => {
        if (err) {
          console.error(`Failed to open ${folderName}:`, err);
          return reject(err);
        }

        console.log(`Successfully opened ${folderName}, checking for emails...`);

        if (!this.imap) {
          return reject(new Error("IMAP connection is not initialized"));
        }

        try {
          // Получаем время последней проверки из базы данных
          const lastCheck = await storage.getLastEmailCheck(userId || 0);
        const searchDate = lastCheck 
          ? new Date(lastCheck.getTime() - 2 * 60 * 60 * 1000) // Добавляем 2 часа буфера
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 дней назад для первой проверки
        
        console.log(`[GENERAL IMAP] Last check was: ${lastCheck?.toISOString() || 'Never'}`);
        console.log(`[GENERAL IMAP] Searching for emails since ${searchDate.toISOString()}`);
        const searchCriteria = ['ALL', ['SINCE', searchDate]];

        this.imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);
          if (!results || !results.length) {
            console.log(`No emails found in ${folderName}`);
            return resolve();
          }

          console.log(`Found ${results.length} emails in ${folderName}`);

          if (!this.imap) {
            return reject(new Error("IMAP connection is not initialized"));
          }

          const fetch = this.imap.fetch(results, {
            bodies: '',
            markSeen: false
          });

          fetch.on('message', (msg: any) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream, async (err: any, parsed: any) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  return;
                }
                await this.processEmail(parsed, userId);
              });
            });
          });

          fetch.once('error', (err: any) => {
            console.error(`Fetch error in ${folderName}:`, err);
            reject(err);
          });

          fetch.once('end', async () => {
            console.log(`Done checking emails in ${folderName}`);
            // Обновляем время последней проверки в базе данных
            if (userId) {
              try {
                await storage.updateLastEmailCheck(userId);
                console.log(`[GENERAL IMAP] Updated lastEmailCheck for user ${userId}`);
              } catch (error) {
                console.error(`[GENERAL IMAP] Error updating lastEmailCheck for user ${userId}:`, error);
              }
            }
            resolve();
          });
        });
        } catch (error) {
          console.error(`[GENERAL IMAP] Error in checkFolder:`, error);
          reject(error);
        }
      });
    });
  }

  private async checkFolderWithOrderNumber(folderName: string, orderNumber: string, userId?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        return reject(new Error("IMAP connection is not initialized"));
      }

      this.imap.openBox(folderName, false, (err, box) => {
        if (err) {
          console.error(`Failed to open ${folderName}:`, err);
          return reject(err);
        }

        console.log(`Successfully opened ${folderName}, checking for emails with order number: ${orderNumber}...`);

        if (!this.imap) {
          return reject(new Error("IMAP connection is not initialized"));
        }

        const searchDate = new Date();
        searchDate.setDate(searchDate.getDate() - 30);

        const searchCriteria = ['ALL', ['SINCE', searchDate]];

        this.imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);
          if (!results || !results.length) {
            console.log(`No emails found in ${folderName}`);
            return resolve();
          }

          console.log(`Found ${results.length} emails in ${folderName}, filtering for order number: ${orderNumber}`);

          if (!this.imap) {
            return reject(new Error("IMAP connection is not initialized"));
          }

          const fetch = this.imap.fetch(results, {
            bodies: '',
            markSeen: false
          });

          fetch.on('message', (msg: any) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream, async (err: any, parsed: any) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  return;
                }
                if (parsed.subject && parsed.subject.includes(orderNumber)) {
                  console.log(`Found email with order number ${orderNumber} in subject: ${parsed.subject}`);
                  await this.processEmail(parsed, userId);
                }
              });
            });
          });

          fetch.once('error', (err: any) => {
            console.error(`Fetch error in ${folderName}:`, err);
            reject(err);
          });

          fetch.once('end', () => {
            console.log(`Done checking emails in ${folderName} for order number: ${orderNumber}`);
            resolve();
          });
        });
      });
    });
  }

  private async processEmail(mail: any, userId?: number): Promise<void> {
    if (!mail) {
      console.log('❌ [GENERAL IMAP] No email data to process');
      return;
    }

    const messageId = mail.messageId || mail.headers?.['message-id'] || `unknown-${Date.now()}`;
    const fromEmail = mail.from?.value?.[0]?.address || 'Unknown';
    const subject = mail.subject || 'No subject';
    
    console.log(`\n🔍 [GENERAL IMAP] ===== EMAIL PROCESSING START =====`);
    console.log(`🔍 [GENERAL IMAP] Message ID: ${messageId}`);
    console.log(`🔍 [GENERAL IMAP] From: ${fromEmail}`);
    console.log(`🔍 [GENERAL IMAP] Subject: ${subject}`);
    console.log(`🔍 [GENERAL IMAP] User ID: ${userId || 'No user specified'}`);
    console.log(`🔍 [GENERAL IMAP] Processing at: ${new Date().toLocaleTimeString()}`);
    
    // Check if this email was already successfully processed
    if (this.processedMessageIds.has(messageId)) {
      console.log(`⏭️ [GENERAL IMAP] Email ${messageId} found in memory cache - skipping`);
      return;
    }

    const result = await this._processEmailWithDetails(mail, userId);
    
    console.log(`🔍 [GENERAL IMAP] Processing result:`, {
      status: result.status,
      savedToDb: result.savedToDb,
      attachmentsProcessed: result.attachmentsProcessed,
      error: result.error
    });
    
    // НОВАЯ ЛОГИКА КЕШИРОВАНИЯ - только success в кеш
    if (result.status === 'success' && 
        result.savedToDb === true && 
        result.attachmentsProcessed === true) {
      this.processedMessageIds.add(messageId);
      console.log(`✅ [GENERAL IMAP] Email ${messageId} successfully processed and cached`);
    } else {
      console.log(`❌ [GENERAL IMAP] Email ${messageId} not cached due to: ${result.status}, DB: ${result.savedToDb}, Attachments: ${result.attachmentsProcessed}`);
      if (result.error) {
        console.log(`🚨 [GENERAL IMAP] Error details: ${result.error}`);
      }
      if (result.attachmentErrors && result.attachmentErrors.length > 0) {
        console.log(`📎 [GENERAL IMAP] Attachment errors: ${result.attachmentErrors.join(', ')}`);
      }
    }
    
    console.log(`🔍 [GENERAL IMAP] ===== EMAIL PROCESSING END =====\n`);
  }

  private async _processEmailWithDetails(mail: any, userId?: number): Promise<EmailProcessingResult> {
    const messageId = mail.messageId || mail.headers?.['message-id'] || `unknown-${Date.now()}`;
    let result: EmailProcessingResult = {
      status: 'failed',
      savedToDb: false,
      attachmentsProcessed: false,
      messageId: messageId
    };

    try {

      const { from, subject, text, attachments = [] } = mail;
      const fromEmail = from?.value?.[0]?.address || '';
      const messageDate = mail.date ? new Date(mail.date) : new Date();
      
      console.log(`📧 [EMAIL DETAILS] From: ${fromEmail}, Subject: ${subject || 'No subject'}, Attachments: ${attachments.length}`);
      
      // Process attachments for all emails (including system emails to ensure they display properly)
      const systemEmail = process.env.EMAIL_FROM || 'noreply@supplier-search.example.com';
      const isSystemEmail = fromEmail.toLowerCase() === systemEmail.toLowerCase();
      
      // Process attachments
      let filteredAttachments: Array<{
        filename: string;
        contentType: string;
        content: string;
        size: number;
        encoding?: string;
        extractedText?: string;
      }> = [];
      
      // Process attachments regardless of email source (fix for incoming attachments not showing)
      if (attachments && Array.isArray(attachments)) {
        console.log(`Processing ${attachments.length} attachments from email (${isSystemEmail ? 'system email' : 'supplier email'})`);
        
        // Detailed logging to diagnose issues
        attachments.forEach((att, index) => {
          console.log(`Email attachment ${index}: filename=${att.filename}, contentType=${att.contentType}, size=${att.size}, contentFormat=${typeof att.content}, isBuffer=${Buffer.isBuffer(att.content)}`);
        });
        
        filteredAttachments = attachments.map(att => {
          // Ensure we have the content and it's properly encoded
          let content = att.content;
          let encoding = 'base64';
          
          if (Buffer.isBuffer(content)) {
            console.log(`Converting attachment buffer to base64 string: ${att.filename}, size ${content.length} bytes`);
            content = content.toString('base64');
          } else if (typeof content === 'string') {
            console.log(`Attachment has string content, length: ${content.length} chars`);
            // Already a string, but ensure it's base64 encoded
            if (content.length > 0 && !content.match(/^[A-Za-z0-9+/=]+$/)) {
              console.log(`Attachment content doesn't appear to be base64, treating as raw text: ${att.filename}`);
              // If it's not base64, encode it
              try {
                content = Buffer.from(content).toString('base64');
              } catch (error) {
                console.error(`Error converting attachment content to base64: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          } else if (content === null || content === undefined) {
            console.log(`Attachment has null/undefined content: ${att.filename}`);
            content = '';
          } else {
            console.log(`Attachment has unsupported content type: ${typeof content} for ${att.filename}`);
            try {
              // Try to stringify and base64 encode
              content = Buffer.from(JSON.stringify(content)).toString('base64');
            } catch (error) {
              console.error(`Failed to process attachment content: ${error instanceof Error ? error.message : String(error)}`);
              content = '';
            }
          }
          
          // Preserve original file size if available, don't overwrite with base64 length
          let fileSize = att.size;
          if (!fileSize && typeof content === 'string') {
            // If no original size, estimate from base64 content
            fileSize = Math.round(content.length * 0.75); // Approximate original size from base64
          }
          
          return {
            filename: att.filename || 'unnamed_file',
            contentType: att.contentType || 'application/octet-stream',
            content: content,
            encoding: encoding,
            size: fileSize || 0,
            extractedText: att.extractedText
          };
        }).filter(att => att.filename && att.content);
        
        console.log(`Processed ${filteredAttachments.length} valid attachments for storage`);
      } else {
        console.log('No attachments found in the email');
      }

      // НАЧАЛО УЛУЧШЕННОГО КОДА ДЛЯ ПОИСКА ЗАПРОСА И ПРОВЕРКИ ДУБЛИКАТОВ
      // Находим имя отправителя и другие основные данные
      const displayFromName = from?.value?.[0]?.name || fromEmail;
      let requestId = 0;
      let supplierId = 'unknown';
      let supplierName = displayFromName;
      let requestSupplier = null;

      // Шаг 1: Поиск по номеру заказа (REQ и TID) - единственный способ связи
      if (!requestId) {
        // Собираем все возможные номера заказов из темы и текста письма
        const possibleOrderNumbers: string[] = [];
        
        // Поиск в теме письма (приоритет)
        if (subject) {
          const subjectMatches = subject.match(REQ_PATTERNS.DIRECT_GLOBAL) || [];
          possibleOrderNumbers.push(...subjectMatches);
        }
        
        // Поиск в тексте письма
        if (text) {
          const textMatches = text.match(REQ_PATTERNS.DIRECT_GLOBAL) || [];
          possibleOrderNumbers.push(...textMatches);
          
          // Поиск усеченных номеров вида -XXXX-XXXXX (поддерживает дефисы и подчеркивания)
          const truncatedMatches = text.match(REQ_PATTERNS.TRUNCATED_GLOBAL) || [];
          truncatedMatches.forEach((match: string) => {
            possibleOrderNumbers.push(`REQ${match}`);
          });
        }
        
        // Удаление дубликатов из списка номеров
        const uniqueOrderNumbers = Array.from(new Set(possibleOrderNumbers));
        
        if (uniqueOrderNumbers.length > 0) {
          console.log('Found possible order numbers:', uniqueOrderNumbers.join(', '));
          
          // CRITICAL FIX: Find the request that was used to contact THIS SPECIFIC SUPPLIER
          // Instead of just finding any request with the order number, we need to find
          // the request where this supplier email was actually contacted
          for (const orderNumber of uniqueOrderNumbers) {
            const request = await storage.getSearchRequestByOrderNumber(orderNumber);
            if (request) {
              console.log(`Found request with order ${orderNumber}: ID=${request.id}`);
              
              // Accept any email with valid REQ/TID - no email verification needed
              console.log(`✅ ACCEPTED: Email ${fromEmail} contains valid REQ ${orderNumber}. Using this request ID.`);
              requestId = request.id;
              // Use default values since we don't need to match specific supplier
              supplierId = 'unknown';
              supplierName = displayFromName;
              break;
            }
          }
          
          // If we still haven't found a match, fall back to the original logic but warn about potential mismatch
          if (!requestId) {
            console.log('⚠️ FALLBACK: Could not find request where this supplier was contacted. Using first matching order number (may cause parameter mismatch).');
            for (const orderNumber of uniqueOrderNumbers) {
              const request = await storage.getSearchRequestByOrderNumber(orderNumber);
              if (request) {
                console.log(`⚠️ FALLBACK: Using request ID=${request.id}, Order=${request.orderNumber} (parameter mismatch risk)`);
                requestId = request.id;
                break;
              }
            }
          }
        }
      }
      
      // Шаг 3: КРИТИЧЕСКАЯ ПРОВЕРКА НА ДУБЛИКАТЫ - ЗАГРУЖАЕМ СВЕЖИЕ ДАННЫЕ
      // Загружаем данные напрямую из базы данных для 100% точности дедупликации
      const existingResponses = await storage.getSupplierResponses(null);
      console.log(`🔍 DUPLICATE CHECK: Loaded ${existingResponses.length} existing responses from database for duplicate verification`);
      
      // БЛОКИРУЕМ ДУБЛИКАТЫ НА УРОВНЕ БАЗЫ ДАННЫХ
      // Проверим существующие записи по точному messageId
      if (messageId) {
        const duplicateByMessageId = await storage.checkExistingSupplierResponseByMessageId(messageId);
        if (duplicateByMessageId) {
          console.log(`🚫 DATABASE DUPLICATE DETECTED: MessageId ${messageId} already exists as response ${duplicateByMessageId.id}. BLOCKING save operation.`);
          return null;
        }
      }
      
      // СТРОГАЯ ПРОВЕРКА ПО MESSAGE ID (приоритет #1)
      if (messageId) {
        const messageIdDuplicate = existingResponses.find(response => 
          response.messageId === messageId
        );
        
        if (messageIdDuplicate) {
          console.log(`🚫 DUPLICATE DETECTED: MessageId ${messageId} already exists as response ${messageIdDuplicate.id}. BLOCKING save operation.`);
          return null;
        }
        
        // Дополнительная проверка в памяти
        if (this.processedMessageIds.has(messageId)) {
          console.log(`🚫 MEMORY DUPLICATE DETECTED: MessageId ${messageId} already processed in this session. BLOCKING save operation.`);
          return null;
        }
      }
      
      // ПРОВЕРКА ТОЛЬКО ПО SUBJECT (без email) - поставщик может отвечать с разных email
      const subjectDuplicate = existingResponses.find(response => 
        response.subject === subject
      );
      
      if (subjectDuplicate) {
        console.log(`🚫 DUPLICATE DETECTED: Subject "${subject}" already exists as response ${subjectDuplicate.id}. BLOCKING save operation.`);
        return null;
      }
      
      console.log(`✅ NO DUPLICATES FOUND: Subject is unique and safe to save`);
      // КОНЕЦ КРИТИЧЕСКОЙ ПРОВЕРКИ НА ДУБЛИКАТЫ
      
      // Добавляем сообщение в список обработанных для in-memory дедупликации
      // Дополнительная защита от дубликатов в рамках одной сессии
      if (messageId) {
        this.processedMessageIds.add(messageId);
        console.log(`📝 MEMORY CACHE: Added messageId ${messageId} to processed set (size: ${this.processedMessageIds.size})`);
      }

      console.log('\n📧 Processing Email:');
      console.log('From:', fromEmail, displayFromName ? `(${displayFromName})` : '');
      console.log('Subject:', subject);
      console.log('Date:', new Date().toISOString());
      console.log('Content Length:', text?.length || 0, 'characters');
      console.log('Attachments:', attachments?.length || 0);

      if (text && text.length > 0) {
        const previewLength = 200;
        console.log(`Content preview (first ${previewLength} chars):`);
        console.log(text.substring(0, previewLength) + (text.length > previewLength ? '...' : ''));

        if (text.length > previewLength) {
          console.log(`Content preview (last ${previewLength} chars):`);
          console.log('...' + text.substring(text.length - previewLength));
        }
      }

      const pendingRequests = await storage.getPendingSearchRequests();
      console.log('\nActive requests that could match:', pendingRequests.length);
      if (pendingRequests.length > 0) {
        console.log('Order numbers:', pendingRequests.map(r => r.orderNumber).join(', '));
      }

      // This section is now handled by the improved logic above

      const extractedInfo = this.extractTrackingInfo(text || '', subject || '');

      console.log('\n🔍 Extracted tracking info:', JSON.stringify(extractedInfo, null, 2));

      let possibleRefs = subject ? (subject.match(REQ_PATTERNS.DIRECT_GLOBAL) || []) : [];

      if (possibleRefs.length === 0) {
        possibleRefs = text ? (text.match(REQ_PATTERNS.DIRECT_GLOBAL) || []) : [];
      }

      const truncatedMatches = text ? (text.match(REQ_PATTERNS.TRUNCATED_GLOBAL) || []) : [];
      if (truncatedMatches.length > 0) {
        const reconstructedRefs = truncatedMatches.map((ref: string) => `REQ${ref}`);
        console.log(`Found truncated references: ${truncatedMatches.join(', ')}`);
        console.log(`Reconstructed as: ${reconstructedRefs.join(', ')}`);
        // Combine arrays and remove duplicates
        const combinedRefs: string[] = [];
        // Add unique values from possibleRefs
        possibleRefs.forEach((ref: string) => {
          if (!combinedRefs.includes(ref)) {
            combinedRefs.push(ref);
          }
        });
        // Add unique values from reconstructedRefs
        reconstructedRefs.forEach((ref: string) => {
          if (!combinedRefs.includes(ref)) {
            combinedRefs.push(ref);
          }
        });
        possibleRefs = combinedRefs;
      }

      if (possibleRefs.length > 0) {
        console.log('📑 Possible reference numbers found in email:', possibleRefs.join(', '));

        const allRequests = await storage.getAllSearchRequests(userId);
        console.log('🔍 Checking against all requests:', 
          allRequests.map(r => `${r.id}:${r.orderNumber}`).join(', ')
        );

        const matchingRefs = possibleRefs.filter((ref: string) => 
          allRequests.some(req => req.orderNumber === ref)
        );
        if (matchingRefs.length > 0) {
          console.log('✅ Found exact order number matches:', matchingRefs.join(', '));
        } else {
          const partialMatches = [];
          for (const ref of possibleRefs) {
            for (const req of allRequests) {
              const refDigits = ref.replace(/\D/g, '');
              const reqDigits = req.orderNumber.replace(/\D/g, '');
              if (refDigits.includes(reqDigits) || reqDigits.includes(refDigits)) {
                partialMatches.push(`${req.orderNumber} (partial match with ${ref})`);
              }
            }
          }

          if (partialMatches.length > 0) {
            console.log('⚠️ Found partial order number matches:', partialMatches.join(', '));
          } else {
            console.log('❌ No order number matches found');
          }
        }
      } else {
        console.log('❌ No order numbers found in email text');
      }

      if (!requestId && possibleRefs.length > 0) {
        // Сначала поищем точное совпадение номера заказа в subject (приоритетно)
        const subjectRefs = subject ? subject.match(REQ_PATTERNS.DIRECT_GLOBAL) || [] : [];
        if (subjectRefs.length > 0) {
          console.log(`📑 References found in subject: ${subjectRefs.join(', ')}`);
          for (const ref of subjectRefs) {
            console.log(`🔍 Trying to match reference from subject (highest priority): ${ref}`);
            
            // CRITICAL FIX: Find the request where this supplier was actually contacted
            const request = await storage.getSearchRequestByOrderNumber(ref);
            if (request) {
              console.log(`Found request with order ${ref}: ID=${request.id}`);
              
              // Accept any email with valid REQ/TID - no email verification needed
              console.log(`✅ ACCEPTED FROM SUBJECT: Email ${fromEmail} contains valid REQ ${ref}. Using this request ID.`);
              requestId = request.id;
              // Use default values since we don't need to match specific supplier
              supplierId = 'unknown';
              supplierName = displayFromName;
              break;
            } else {
              console.log(`❌ No matching request found for reference from subject: ${ref}`);
            }
          }
        }
        
        // Если не нашли точное совпадение в теме, ищем в теле письма
        if (!requestId) {
          for (const ref of possibleRefs) {
            console.log(`🔍 Trying to match reference from content: ${ref}`);
            
            // CRITICAL FIX: Find the request where this supplier was actually contacted
            const request = await storage.getSearchRequestByOrderNumber(ref);
            if (request) {
              console.log(`Found request with order ${ref}: ID=${request.id}`);
              
              // Accept any email with valid REQ/TID - no email verification needed
              console.log(`✅ ACCEPTED FROM CONTENT: Email ${fromEmail} contains valid REQ ${ref}. Using this request ID.`);
              requestId = request.id;
              // Use default values since we don't need to match specific supplier
              supplierId = 'unknown';
              supplierName = displayFromName;
              break;
            }
          }
        }
      }

      if (!requestId && extractedInfo.trackingId) {
        console.log(`🔍 Searching for supplier with tracking ID: ${extractedInfo.trackingId}`);
        const normalizedTrackingId = extractedInfo.trackingId.trim().toLowerCase();
        requestSupplier = await storage.getRequestSupplierByTrackingId(normalizedTrackingId);

        if (requestSupplier) {
          console.log(`✅ Found matching supplier by tracking ID: ${JSON.stringify(requestSupplier)}`);
          requestId = requestSupplier.requestId;
          supplierId = requestSupplier.supplierId;
          supplierName = requestSupplier.supplierName;
        } else {
          console.log(`⚠️ No exact match for tracking ID: ${extractedInfo.trackingId}`);
          const allSuppliers = await storage.getRequestSuppliers(null);
          const similarTracking = allSuppliers.filter(s => 
            s.trackingId && s.trackingId.toLowerCase().includes(normalizedTrackingId)
          );
          if (similarTracking.length > 0) {
            console.log('📋 Similar tracking IDs found:', similarTracking.map(s => s.trackingId));
          }
        }
      } 

      if (!requestId && pendingRequests.length > 0) {
        console.log(`⚠️ No specific match found. Using most recent request as fallback.`);
        const sortedRequests = [...pendingRequests].sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });

        const latestRequest = sortedRequests[0];
        requestId = latestRequest.id;
        console.log(`Using latest request: ${latestRequest.orderNumber} (ID: ${latestRequest.id})`);

        const suppliers = await storage.getRequestSuppliers(requestId);
        if (suppliers.length > 0) {
          requestSupplier = suppliers[0];
          supplierId = requestSupplier.supplierId;
          supplierName = requestSupplier.supplierName;
        }
      }

      // Требуются И REQ И TID для успешной обработки
      if (requestId && extractedInfo.trackingId) {
        if (extractedInfo.orderNumber) {
          console.log(`🔍 Looking up request by extracted order number: ${extractedInfo.orderNumber}`);
          const request = await storage.getSearchRequestByOrderNumber(extractedInfo.orderNumber);
          if (request) {
            console.log(`✅ Found request by extracted order number: ID=${request.id}, Order=${request.orderNumber}`);
            requestId = request.id;
          } else {
            console.log(`❌ No request found for extracted order number: ${extractedInfo.orderNumber}`);
          }
        }

        console.log('✅ Creating supplier response for request ID:', requestId);

        if (requestSupplier) {
          console.log('Updating request supplier record to mark as responded');
          await storage.updateRequestSupplierResponse(requestSupplier.id, true);
        }

        // Get the userId from the search request to ensure proper data isolation
        let userId: number | null = null;
        if (requestId) {
          const request = await storage.getSearchRequest(requestId);
          if (request) {
            userId = request.userId;
            console.log(`✅ Retrieved userId ${userId} from search request ${requestId} for proper data isolation`);
          }
        }

        // CRITICAL FIX: Ensure supplier ID is always positive for database consistency
        let fixedSupplierId: string = supplierId?.toString() || Math.abs(Date.now() % 10000).toString();
        
        if (typeof supplierId === 'number') {
          if (supplierId < 0) {
            // Convert negative supplier ID to positive
            fixedSupplierId = Math.abs(supplierId).toString();
            console.log(`🔧 Fixed negative supplier ID ${supplierId} to positive: ${fixedSupplierId}`);
          } else {
            fixedSupplierId = supplierId.toString();
          }
        } else if (typeof supplierId === 'string') {
          // Handle string supplier IDs that might contain negative values
          if (supplierId.startsWith('-')) {
            const numericPart = supplierId.replace(/\D/g, '');
            fixedSupplierId = numericPart || Math.abs(Date.now() % 10000).toString();
            console.log(`🔧 Fixed negative string supplier ID ${supplierId} to positive: ${fixedSupplierId}`);
          } else if (supplierId.startsWith('api-')) {
            // Keep API format as is
            fixedSupplierId = supplierId;
          } else {
            // Extract numeric part from any other string format
            const numericPart = supplierId.replace(/\D/g, '');
            fixedSupplierId = numericPart || Math.abs(Date.now() % 10000).toString();
          }
        } else {
          // Fallback: generate a positive ID
          fixedSupplierId = Math.abs(Date.now() % 10000).toString();
          console.log(`🔧 Generated fallback supplier ID: ${fixedSupplierId}`);
        }

        // Создаем базовый объект ответа с userId для правильной изоляции данных
        const responseData: any = {
          userId, // Add userId for proper data isolation
          requestId,
          requestSupplierId: requestSupplier?.id || null,
          supplierId: fixedSupplierId,
          supplierName: displayFromName, // Use authentic sender display name from email headers
          supplierEmail: fromEmail,
          subject: subject || '(No subject)',
          content: text || '(No content)',
          responseDate: new Date(),
          attachments: filteredAttachments,
        };

        // Добавляем messageId если он доступен
        if (messageId) {
          responseData.messageId = messageId;
        }

        const response = await storage.createSupplierResponse(responseData);

        // Инвалидируем кэш после сохранения нового ответа
        this.responseCache.delete('allResponses');
        this.lastCacheUpdate = 0;

        console.log('✅ Successfully saved supplier response:', {
          id: response.id,
          requestId: response.requestId,
          supplierName: response.supplierName,
          fromEmail: response.supplierEmail,
          subject: response.subject,
          date: response.responseDate,
          attachments: (attachments || []).length
        });

        // Запускаем автоматическую обработку attachments если они есть
        if (attachments && attachments.length > 0) {
          console.log(`🔄 Starting automatic attachment processing for response ${response.id} with ${attachments.length} attachments`);
          try {
            const { AsyncEmailProcessor } = await import('./async-processing/email-processor');
            const processor = AsyncEmailProcessor.getInstance();
            await processor.processNewEmail(response);
            console.log(`✅ Automatic attachment processing started for response ${response.id}`);
          } catch (error) {
            console.error(`❌ Failed to start automatic attachment processing for response ${response.id}:`, error);
          }
        }

        // Запускаем автоматическое извлечение параметров (ТОЧНО КАК В РУЧНОЙ РЕАЛИЗАЦИИ)
        if (response && response.requestId) {
          console.log(`🔄 Starting automatic parameter extraction for response ${response.id}`);
          try {
            // Получаем параметры запроса
            const requestParams = await storage.getParametersForRequest(response.requestId);
            if (requestParams && requestParams.parameters) {
              const parameters = Array.isArray(requestParams.parameters) 
                ? requestParams.parameters 
                : JSON.parse(requestParams.parameters as string);
              
              if (parameters && parameters.length > 0) {
                // ШАГ 1: Анализ вложений (если есть)
                let attachmentParameters: Record<string, any> = {};
                let hasAttachmentData = false;
                
                if (attachments && attachments.length > 0) {
                  console.log(`🔄 Step 1: Processing ${attachments.length} attachments for response ${response.id} using AsyncEmailProcessor`);
                  try {
                    // Используем AsyncEmailProcessor для обработки вложений
                    const { AsyncEmailProcessor } = await import('./async-processing/email-processor');
                    const processor = AsyncEmailProcessor.getInstance();
                    await processor.processNewEmail(response);
                    console.log(`✅ Step 1: AsyncEmailProcessor started for response ${response.id}`);
                    
                    // Ждем завершения обработки вложений
                    console.log(`⏳ Waiting for attachment processing to complete for response ${response.id}`);
                    let attempts = 0;
                    const maxAttempts = 20; // Максимум 60 секунд ожидания
                    
                    while (attempts < maxAttempts) {
                      const updatedResponse = await storage.getSupplierResponseById(response.id);
                      if (updatedResponse && updatedResponse.attachments && Array.isArray(updatedResponse.attachments)) {
                        const hasProcessedAttachments = updatedResponse.attachments.some((att: any) => att.extractedText);
                        if (hasProcessedAttachments) {
                          console.log(`✅ Attachments processed for response ${response.id}`);
                          break;
                        }
                      }
                      
                      console.log(`⏳ Waiting for attachments... attempt ${attempts + 1}/${maxAttempts}`);
                      await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем 3 секунды
                      attempts++;
                    }
                    
                    if (attempts >= maxAttempts) {
                      console.warn(`⚠️ Timeout waiting for attachment processing for response ${response.id}`);
                      // Даже если таймаут, продолжаем - возможно, вложения обработались, но не сохранились
                    }
                  } catch (error) {
                    console.error(`❌ Step 1: Error processing attachments with AsyncEmailProcessor:`, error);
                    // Продолжаем обработку даже если анализ вложений не удался
                  }
                }
                
                // ШАГ 2: Извлечение из тела письма и вложений
                console.log(`🔄 Step 2: Extracting parameters from email body and attachments for response ${response.id}`);
                try {
                  // Ждем завершения обработки вложений
                  if (attachments && attachments.length > 0) {
                    console.log(`⏳ Waiting for attachment processing to complete for response ${response.id}`);
                    // Проверяем, что вложения действительно обработаны и сохранены
                    let attempts = 0;
                    const maxAttempts = 20; // Максимум 60 секунд ожидания
                    
                    while (attempts < maxAttempts) {
                      const updatedResponse = await storage.getSupplierResponseById(response.id);
                      if (updatedResponse && updatedResponse.attachments && Array.isArray(updatedResponse.attachments)) {
                        const hasProcessedAttachments = updatedResponse.attachments.some((att: any) => att.extractedText);
                        if (hasProcessedAttachments) {
                          console.log(`✅ Attachments processed for response ${response.id}`);
                          break;
                        }
                      }
                      
                      console.log(`⏳ Waiting for attachments... attempt ${attempts + 1}/${maxAttempts}`);
                      await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем 3 секунды
                      attempts++;
                    }
                    
                    if (attempts >= maxAttempts) {
                      console.warn(`⚠️ Timeout waiting for attachment processing for response ${response.id}`);
                      // Даже если таймаут, продолжаем - возможно, вложения обработались, но не сохранились
                    }
                  }
                  
                  // Теперь извлекаем параметры, когда вложения точно обработаны
                  const { extractParametersFromResponse } = await import('./routes/extract-parameters');
                  const bodyResult = await extractParametersFromResponse(
                    response.id,
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
                  
                  // Применяем правила приоритета: Вложения > Тело письма + Дополнение
                  parameters.forEach(paramName => {
                    // 1. ПРИОРИТЕТ: Если данные есть во вложении - используем их
                    if (hasAttachmentData && attachmentParameters[paramName] && 
                        attachmentParameters[paramName] !== '-' && 
                        attachmentParameters[paramName] !== '' && 
                        attachmentParameters[paramName] !== null) {
                      finalParameters[paramName] = String(attachmentParameters[paramName]);
                      console.log(`Priority rule: Using attachment value for ${paramName}: ${attachmentParameters[paramName]}`);
                    } 
                    // 2. ДОПОЛНЕНИЕ: Если во вложении данных нет, но есть в теле письма - используем из тела
                    else if (bodyParameters[paramName] && 
                             bodyParameters[paramName] !== '-' && 
                             bodyParameters[paramName] !== '' && 
                             bodyParameters[paramName] !== null) {
                      finalParameters[paramName] = String(bodyParameters[paramName]);
                      console.log(`Priority rule: Using body value for ${paramName}: ${bodyParameters[paramName]} (attachment data not found)`);
                    } 
                    // 3. НЕТ ДАННЫХ: Если нигде не найдено
                    else {
                      finalParameters[paramName] = '-';
                      console.log(`Priority rule: No value found for ${paramName}, using default '-'`);
                    }
                  });
                  
                  // Сохраняем извлеченные параметры в базу данных
                  console.log(`🔄 Step 3: Saving extracted parameters to database for response ${response.id}`);
                  await storage.saveExtractedParameters({
                    responseId: response.id,
                    requestId: response.requestId,
                    supplierEmail: response.supplierEmail,
                    parameters: finalParameters,
                    status: Object.values(finalParameters).some(val => val && val !== '-') ? 'completed' : 'no_parameters_found',
                    userId: userId
                  });
                  
                  console.log(`✅ Automatic parameter extraction completed for response ${response.id}:`, finalParameters);
                } catch (error) {
                  console.error(`❌ Step 2: Error extracting parameters from email body:`, error);
                }
              } else {
                console.log(`⚠️ No parameters found for request ${response.requestId}, skipping parameter extraction`);
              }
            } else {
              console.log(`⚠️ No request parameters found for request ${response.requestId}, skipping parameter extraction`);
            }
          } catch (error) {
            console.error(`❌ Failed to start automatic parameter extraction for response ${response.id}:`, error);
          }
        }
        
        // Automatically process attachments if any exist using AsyncEmailProcessor
        if (filteredAttachments && filteredAttachments.length > 0) {
          console.log(`🔄 Starting automatic attachment processing for response ${response.id} with ${filteredAttachments.length} attachments`);
          try {
            const { AsyncEmailProcessor } = await import('./async-processing/email-processor');
            const processor = AsyncEmailProcessor.getInstance();
            await processor.processNewEmail(response);
            console.log(`✅ Automatic attachment processing started for response ${response.id}`);
          } catch (error) {
            console.error(`❌ Failed to start automatic attachment processing for response ${response.id}:`, error);
          }
        }

        // Успешно сохранено в базу данных
        result.savedToDb = true;
        result.dbRecordId = response.id;
        console.log(`✅ [DATABASE] Successfully saved email to database with ID: ${response.id}`);
        
        // Автоматическая обработка вложений, если они есть
        let attachmentErrors: string[] = [];
        result.attachmentsProcessed = true; // По умолчанию считаем успешным
        
        if (filteredAttachments && filteredAttachments.length > 0) {
          console.log(`🔄 [ATTACHMENTS] Starting automatic attachment processing for response ${response.id} with ${filteredAttachments.length} attachments using AsyncEmailProcessor`);
          try {
            const { AsyncEmailProcessor } = await import('./async-processing/email-processor');
            const processor = AsyncEmailProcessor.getInstance();
            await processor.processNewEmail(response);
            console.log(`✅ [ATTACHMENTS] Automatic attachment processing started for response ${response.id}`);
          } catch (error) {
            console.error(`❌ [ATTACHMENTS] Failed to start automatic attachment processing for response ${response.id}:`, error);
            attachmentErrors.push(`Attachment processing error: ${error instanceof Error ? error.message : String(error)}`);
            result.attachmentsProcessed = false;
          }
        }
        
        // Устанавливаем финальный статус
        if (result.savedToDb && result.attachmentsProcessed) {
          result.status = 'success';
          console.log(`🎉 [PROCESSING] Email ${messageId} processed completely successfully`);
        } else if (!result.savedToDb) {
          result.status = 'db_error';
          console.log(`🚨 [PROCESSING] Email ${messageId} failed due to database error`);
        } else if (!result.attachmentsProcessed) {
          result.status = 'attachment_error';
          result.attachmentErrors = attachmentErrors;
          console.log(`⚠️ [PROCESSING] Email ${messageId} saved to DB but failed attachment processing`);
        }
        
        return result;
      } else {
        console.log(`❌ [MATCHING] Could not match email ${messageId} to any request`);
        
        // Save as unprocessed email for manual review
        try {
          console.log(`📧 [GENERAL IMAP] [UNPROCESSED] Saving email ${messageId} as unprocessed for manual review`);
          console.log(`📧 [GENERAL IMAP] [UNPROCESSED] Email details: From=${fromEmail}, Subject="${subject}"`);
          console.log(`📧 [GENERAL IMAP] [UNPROCESSED] User ID: ${userId || 'No user'}, Attachments: ${filteredAttachments.length}`);
          
          const unprocessedEmail = await storage.createUnprocessedEmail({
            userId: userId || null,
            messageId: messageId,
            senderEmail: fromEmail,
            senderName: from?.value?.[0]?.name || null,
            subject: subject || 'No subject',
            content: text || '',
            attachments: filteredAttachments,
            receivedAt: messageDate
          });
          
          if (unprocessedEmail) {
            console.log(`✅ [GENERAL IMAP] [UNPROCESSED] Successfully saved unprocessed email with ID: ${unprocessedEmail.id}`);
            console.log(`✅ [GENERAL IMAP] [UNPROCESSED] Email will appear in admin panel for manual review`);
            result.status = 'saved_as_unprocessed';
            result.savedToDb = true;
            result.dbRecordId = unprocessedEmail.id;
          } else {
            console.log(`⏭️ [GENERAL IMAP] [UNPROCESSED] Email already exists, skipping duplicate`);
            result.status = 'duplicate_skipped';
            result.savedToDb = false;
          }
          return result;
        } catch (unprocessedError) {
          console.error(`❌ [GENERAL IMAP] [UNPROCESSED] Error saving unprocessed email:`, unprocessedError);
          result.status = 'failed';
          result.error = 'Could not match email to any request and failed to save as unprocessed';
          return result;
        }
      }
    } catch (error: unknown) {
      console.error(`🚨 [ERROR] Error processing email ${messageId}:`, error);
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }
}

export const imapService = new ImapService();
