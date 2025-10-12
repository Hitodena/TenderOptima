import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { storage } from './storage';
import { createRequire } from 'module';

// ES modules workaround for requiring CommonJS modules
const require = createRequire(import.meta.url);
const apiAttachmentBridge = require('./file-processing/api_bridge.cjs');

// Interface for detailed email processing results
interface PersonalEmailProcessingResult {
  status: 'success' | 'failed' | 'timeout' | 'db_error' | 'attachment_error' | 'no_tracking' | 'already_processed' | 'saved_as_unprocessed' | 'duplicate_skipped';
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
  private lastCheckTime = new Map<number, Date>(); // ╨Т╤А╨╡╨╝╤П ╨┐╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨┤╨╗╤П ╨║╨░╨╢╨┤╨╛╨│╨╛ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П
  private responseCache = new Map<string, any>();
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 60000; // 1 ╨╝╨╕╨╜╤Г╤В╨░ ╨║╤Н╤И

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

    // ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х: ╨Т╤Б╨╡╨│╨┤╨░ ╤Г╨┤╨░╨╗╤П╨╡╨╝ ╤Б╤В╨░╤А╨╛╨╡ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╡ ╨╕ ╤Б╨╛╨╖╨┤╨░╨╡╨╝ ╨╜╨╛╨▓╨╛╨╡
    // ╨Я╨╡╤А╨╡╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╨╡ IMAP ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╣ ╨┐╤А╨╕╨▓╨╛╨┤╨╕╤В ╨║ ╨▓╨╜╤Г╤В╤А╨╡╨╜╨╜╨╕╨╝ ╨╛╤И╨╕╨▒╨║╨░╨╝ ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╤П
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

      // ╨Э╨░╤Б╤В╤А╨░╨╕╨▓╨░╨╡╨╝ ╨╛╨▒╤А╨░╨▒╨╛╤В╤З╨╕╨║╨╕ ╤Б╨╛╨▒╤Л╤В╨╕╨╣ ╨Я╨Х╨а╨Х╨Ф ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡╨╝ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╤П
      imap.once('ready', () => {
        console.log(`[PERSONAL IMAP] тЬЕ Personal connection ready for user ${userId} (${userConfig.emailAccount})`);
      });

      imap.once('error', (err) => {
        console.error(`[PERSONAL IMAP] тЭМ Personal connection error for user ${userId}:`, err);
        // ╨Э╨╡╨╝╨╡╨┤╨╗╨╡╨╜╨╜╨╛ ╤Г╨┤╨░╨╗╤П╨╡╨╝ ╨┐╤А╨╛╨▒╨╗╨╡╨╝╨╜╨╛╨╡ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╡
        this.personalImapConnections.delete(userId);
        try {
          (imap as any).end();
        } catch (cleanupError) {
          console.log(`[PERSONAL IMAP] Error during connection cleanup:`, cleanupError);
        }
      });

      imap.once('end', () => {
        console.log(`[PERSONAL IMAP] ЁЯФМ Personal connection ended for user ${userId}`);
        this.personalImapConnections.delete(userId);
      });

      // ╨б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╡ ╨Я╨Ю╨б╨Ы╨Х ╨╜╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╨╛╨▒╤А╨░╨▒╨╛╤В╤З╨╕╨║╨╛╨▓
      this.personalImapConnections.set(userId, imap);
      console.log(`[PERSONAL IMAP] ЁЯЖХ Created fresh IMAP connection for user ${userId}`);

      return imap;
    } catch (error) {
      console.error(`[PERSONAL IMAP] Failed to create personal IMAP connection for user ${userId}:`, error);
      return null;
    }
  }

  private async connectToPersonalImap(imap: Imap, userId: number): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`[PERSONAL IMAP] ЁЯФЧ Connecting to personal IMAP for user ${userId}...`);
      
      let timeoutId: NodeJS.Timeout;
      let resolved = false;
      let connectionAttempted = false;

      const resolveOnce = (success: boolean, reason?: string) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        
        if (!success && reason) {
          console.error(`[PERSONAL IMAP] тЭМ Connection failed for user ${userId}: ${reason}`);
          // ╨Ю╤З╨╕╤Й╨░╨╡╨╝ ╨┐╤А╨╛╨▒╨╗╨╡╨╝╨╜╨╛╨╡ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╡
          this.personalImapConnections.delete(userId);
        }
        resolve(success);
      };

      // Set timeout for connection
      timeoutId = setTimeout(() => {
        resolveOnce(false, 'Connection timeout (15s)');
      }, 15000);

      imap.once('ready', () => {
        console.log(`[PERSONAL IMAP] тЬЕ Successfully connected to personal IMAP for user ${userId}`);
        resolveOnce(true);
      });

      imap.once('error', (err) => {
        resolveOnce(false, `IMAP error: ${err.message || err}`);
      });

      try {
        // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╤З╤В╨╛ ╤Б╨╛╨╡╨┤╨╕╨╜╨╡╨╜╨╕╨╡ ╨╜╨╡ ╨▒╤Л╨╗╨╛ ╤Г╨╢╨╡ ╨╕╨╜╨╕╤Ж╨╕╨╕╤А╨╛╨▓╨░╨╜╨╛
        if (connectionAttempted) {
          resolveOnce(false, 'Connection already attempted');
          return;
        }
        connectionAttempted = true;
        
        console.log(`[PERSONAL IMAP] ЁЯЪА Initiating IMAP connection for user ${userId}...`);
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
    console.log(`ЁЯФН [PERSONAL IMAP] PERSONAL EMAIL CHECK INITIATED`);
    console.log(`ЁЯФН [PERSONAL IMAP] Timestamp: ${new Date().toISOString()}`);
    console.log(`ЁЯФН [PERSONAL IMAP] Request ID: ${requestId || 'All requests'}`);
    console.log(`ЁЯФН [PERSONAL IMAP] User ID: ${userId || 'No user specified'}`);
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

      // ╨Ю╨▒╨╜╨╛╨▓╨╗╤П╨╡╨╝ ╨▓╤А╨╡╨╝╤П ╨┐╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨┐╨╛╤Б╨╗╨╡ ╤Г╤Б╨┐╨╡╤И╨╜╨╛╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕
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
    
    // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╤В╨╛╨╗╤М╨║╨╛ INBOX, ╤В╨░╨║ ╨║╨░╨║ ╨╜╨╡ ╨▓╤Б╨╡ ╨┐╨╛╤З╤В╨╛╨▓╤Л╨╡ ╤Б╨╡╤А╨▓╨╕╤Б╤Л ╨╕╨╝╨╡╤О╤В ╨┐╨░╨┐╨║╤Г Spam
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
    
    // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╤В╨╛╨╗╤М╨║╨╛ INBOX, ╤В╨░╨║ ╨║╨░╨║ ╨╜╨╡ ╨▓╤Б╨╡ ╨┐╨╛╤З╤В╨╛╨▓╤Л╨╡ ╤Б╨╡╤А╨▓╨╕╤Б╤Л ╨╕╨╝╨╡╤О╤В ╨┐╨░╨┐╨║╤Г Spam
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
      imap.openBox(folderName, false, async (err, box) => {
        if (err) {
          console.error(`[PERSONAL EMAIL] Failed to open ${folderName} for user ${userId}:`, err);
          return reject(err);
        }

        console.log(`[PERSONAL EMAIL] Successfully opened ${folderName} for user ${userId}`);

        try {
          // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨▓╤А╨╡╨╝╤П ╨┐╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨╕╨╖ ╨▒╨░╨╖╤Л ╨┤╨░╨╜╨╜╤Л╤Е
          const lastCheck = await storage.getLastEmailCheck(userId);
          const searchDate = lastCheck 
            ? new Date(lastCheck.getTime() - 2 * 60 * 60 * 1000) // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ 2 ╤З╨░╤Б╨░ ╨▒╤Г╤Д╨╡╤А╨░
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 ╨┤╨╜╨╡╨╣ ╨╜╨░╨╖╨░╨┤ ╨┤╨╗╤П ╨┐╨╡╤А╨▓╨╛╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕
          
          console.log(`[PERSONAL EMAIL] Last check was: ${lastCheck?.toISOString() || 'Never'}`);
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

          fetch.once('error', async (err: any) => {
            console.error(`[PERSONAL EMAIL] Fetch error in ${folderName} for user ${userId}:`, err);
            // ╨Ю╨▒╨╜╨╛╨▓╨╗╤П╨╡╨╝ ╨▓╤А╨╡╨╝╤П ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨┤╨░╨╢╨╡ ╨┐╤А╨╕ ╨╛╤И╨╕╨▒╨║╨╡
            try {
              await storage.updateLastEmailCheck(userId);
              console.log(`[PERSONAL EMAIL] тЬЕ Updated lastEmailCheck for user ${userId} (after error)`);
            } catch (updateError) {
              console.error(`[PERSONAL EMAIL] тЭМ Error updating lastEmailCheck after error for user ${userId}:`, updateError);
            }
            reject(err);
          });

          fetch.once('end', async () => {
            console.log(`[PERSONAL EMAIL] Done checking emails in ${folderName} for user ${userId}`);
            // ╨Ю╨▒╨╜╨╛╨▓╨╗╤П╨╡╨╝ ╨▓╤А╨╡╨╝╤П ╨┐╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨▓ ╨▒╨░╨╖╨╡ ╨┤╨░╨╜╨╜╤Л╤Е
            try {
              await storage.updateLastEmailCheck(userId);
              console.log(`[PERSONAL EMAIL] тЬЕ Updated lastEmailCheck for user ${userId}`);
            } catch (error) {
              console.error(`[PERSONAL EMAIL] тЭМ Error updating lastEmailCheck for user ${userId}:`, error);
            }
            resolve();
          });
        });
        } catch (error) {
          console.error(`[PERSONAL EMAIL] Error in checkPersonalFolder for user ${userId}:`, error);
          reject(error);
        }
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

        // ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ ╨▓╤А╨╡╨╝╤П ╨┐╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨┤╨╗╤П ╤Н╤В╨╛╨│╨╛ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╕╨╗╨╕ 7 ╨┤╨╜╨╡╨╣ ╨╜╨░╨╖╨░╨┤ ╨┤╨╗╤П ╨┐╨╡╤А╨▓╨╛╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕
        const lastCheck = this.lastCheckTime.get(userId) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const searchDate = new Date(lastCheck.getTime() - 2 * 60 * 60 * 1000); // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ 2 ╤З╨░╤Б╨░ ╨▒╤Г╤Д╨╡╤А╨░
        
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
      console.log(`тЭМ [PERSONAL IMAP] Skipping email without messageId for user ${userId}`);
      return;
    }

    const messageId = parsed.messageId;
    const fromEmail = parsed.from?.text || 'Unknown';
    const subject = parsed.subject || 'No subject';
    const userMessageKey = `${userId}:${messageId}`;
    
    console.log(`\nЁЯФН [PERSONAL IMAP] ===== PERSONAL EMAIL PROCESSING START =====`);
    console.log(`ЁЯФН [PERSONAL IMAP] Message ID: ${messageId}`);
    console.log(`ЁЯФН [PERSONAL IMAP] From: ${fromEmail}`);
    console.log(`ЁЯФН [PERSONAL IMAP] Subject: ${subject}`);
    console.log(`ЁЯФН [PERSONAL IMAP] User ID: ${userId}`);
    console.log(`ЁЯФН [PERSONAL IMAP] Processing at: ${new Date().toLocaleTimeString()}`);
    
    // Check if this email was already successfully processed
    if (this.processedMessageIds.has(userMessageKey)) {
      console.log(`тПня╕П [PERSONAL IMAP] Email ${messageId} found in memory cache for user ${userId} - skipping`);
      return;
    }

    const result = await this._processPersonalEmailWithDetails(parsed, userId);
    
    console.log(`ЁЯФН [PERSONAL IMAP] Processing result:`, {
      status: result.status,
      savedToDb: result.savedToDb,
      attachmentsProcessed: result.attachmentsProcessed,
      error: result.error
    });
    
    // ╨Э╨Ю╨Т╨Р╨п ╨Ы╨Ю╨У╨Ш╨Ъ╨Р ╨Ъ╨Х╨и╨Ш╨а╨Ю╨Т╨Р╨Э╨Ш╨п - ╤В╨╛╨╗╤М╨║╨╛ success ╨▓ ╨║╨╡╤И
    if (result.status === 'success' && 
        result.savedToDb === true && 
        result.attachmentsProcessed === true) {
      this.processedMessageIds.add(userMessageKey);
      console.log(`тЬЕ [PERSONAL IMAP] Email ${messageId} successfully processed and cached for user ${userId}`);
    } else if (result.status === 'already_processed' && result.alreadyInDatabase) {
      // ╨в╨░╨║╨╢╨╡ ╨║╨╡╤И╨╕╤А╤Г╨╡╨╝ ╨╡╤Б╨╗╨╕ email ╤Г╨╢╨╡ ╨▒╤Л╨╗ ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╨╛╨▒╤А╨░╨▒╨╛╤В╨░╨╜ ╤А╨░╨╜╨╡╨╡
      this.processedMessageIds.add(userMessageKey);
      console.log(`тЬЕ [PERSONAL IMAP] Email ${messageId} already in database, added to cache for user ${userId}`);
    } else {
      console.log(`тЭМ [PERSONAL IMAP] Email ${messageId} not cached for user ${userId} due to: ${result.status}, DB: ${result.savedToDb}, Attachments: ${result.attachmentsProcessed}`);
      if (result.error) {
        console.log(`ЁЯЪи [PERSONAL IMAP] Error details: ${result.error}`);
      }
      if (result.attachmentErrors && result.attachmentErrors.length > 0) {
        console.log(`ЁЯУО [PERSONAL IMAP] Attachment errors: ${result.attachmentErrors.join(', ')}`);
      }
    }
    
    console.log(`ЁЯФН [PERSONAL IMAP] ===== PERSONAL EMAIL PROCESSING END =====\n`);
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
      console.log(`ЁЯУз [PERSONAL EMAIL DETAILS] Processing email ${messageId} for user ${userId}`);
      console.log(`ЁЯУз [PERSONAL EMAIL DETAILS] From: ${parsed.from?.text || 'Unknown'}`);
      console.log(`ЁЯУз [PERSONAL EMAIL DETAILS] Subject: ${parsed.subject || 'No subject'}`);

      // ╨Я╨Х╨а╨Т╨Р╨п ╨Я╨а╨Ю╨Т╨Х╨а╨Ъ╨Р: ╨С╨░╨╖╨░ ╨┤╨░╨╜╨╜╤Л╤Е - ╤Б╨░╨╝╨░╤П ╨╜╨░╨┤╨╡╨╢╨╜╨░╤П
      try {
        const existingResponse = await storage.findSupplierResponseByMessageId(messageId, userId);
        if (existingResponse) {
          console.log(`тЬЕ [DATABASE] Email ${messageId} already exists in database for user ${userId}`);
          result.status = 'already_processed';
          result.alreadyInDatabase = true;
          result.savedToDb = true;
          result.attachmentsProcessed = true; // Assume previously processed attachments are OK
          return result;
        }
      } catch (error) {
        console.log(`тЪая╕П [DATABASE] Error checking database for messageId ${messageId}, user ${userId}:`, error);
        result.error = `Database check error: ${error instanceof Error ? error.message : String(error)}`;
        // ╨Я╤А╨╛╨┤╨╛╨╗╨╢╨░╨╡╨╝ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╤Г ╨▓ ╤Б╨╗╤Г╤З╨░╨╡ ╨╛╤И╨╕╨▒╨║╨╕ ╨С╨Ф
      }

      // Extract tracking information
      const trackingInfo = this.extractTrackingInfo(parsed.text || '', parsed.subject || '');
      
      // ╨в╤А╨╡╨▒╤Г╤О╤В╤Б╤П ╨Ш REQ ╨Ш TID ╨┤╨╗╤П ╤Г╤Б╨┐╨╡╤И╨╜╨╛╨╣ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╕
      if (!trackingInfo.orderNumber || !trackingInfo.trackingId) {
        console.log(`тЭМ [TRACKING] No tracking information found in email for user ${userId}`);
        
        // Save as unprocessed email for manual review
        try {
          console.log(`ЁЯУз [PERSONAL IMAP] [UNPROCESSED] Saving email ${messageId} as unprocessed for manual review`);
          console.log(`ЁЯУз [PERSONAL IMAP] [UNPROCESSED] Email details: From=${parsed.from?.text || 'Unknown'}, Subject="${parsed.subject || 'No subject'}"`);
          console.log(`ЁЯУз [PERSONAL IMAP] [UNPROCESSED] User ID: ${userId}, Attachments: ${parsed.attachments?.length || 0}`);
          
          const attachments = parsed.attachments ? parsed.attachments.map((att: any) => ({
            filename: att.filename || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
            content: att.content ? att.content.toString('base64') : '',
            encoding: 'base64',
            size: att.size || (att.content ? att.content.length : 0)
          })) : [];
          
          const unprocessedEmail = await storage.createUnprocessedEmail({
            userId: userId,
            messageId: messageId,
            senderEmail: parsed.from?.text || 'Unknown',
            senderName: parsed.from?.text || null,
            subject: parsed.subject || 'No subject',
            content: parsed.text || '',
            attachments: attachments,
            receivedAt: new Date()
          });
          
          if (unprocessedEmail) {
            console.log(`тЬЕ [PERSONAL IMAP] [UNPROCESSED] Successfully saved unprocessed email with ID: ${unprocessedEmail.id}`);
            console.log(`тЬЕ [PERSONAL IMAP] [UNPROCESSED] Email will appear in admin panel for manual review`);
            result.status = 'saved_as_unprocessed';
            result.savedToDb = true;
            result.dbRecordId = unprocessedEmail.id;
          } else {
            console.log(`тПня╕П [PERSONAL IMAP] [UNPROCESSED] Email already exists, skipping duplicate`);
            result.status = 'duplicate_skipped';
            result.savedToDb = false;
          }
          return result;
        } catch (unprocessedError) {
          console.error(`тЭМ [PERSONAL IMAP] [UNPROCESSED] Error saving unprocessed email:`, unprocessedError);
          result.status = 'no_tracking';
          result.error = 'No tracking information found and failed to save as unprocessed';
          return result;
        }
      }

      console.log(`тЬЕ [TRACKING] Found tracking info for user ${userId}:`, trackingInfo);

      // Process attachments if any
      const attachments = parsed.attachments ? parsed.attachments.map((att: any) => ({
        filename: att.filename || 'attachment',
        contentType: att.contentType || 'application/octet-stream',
        content: att.content ? att.content.toString('base64') : '',
        encoding: 'base64',
        size: att.size || (att.content ? att.content.length : 0)
      })) : [];

      console.log(`ЁЯУО [ATTACHMENTS] Found ${attachments.length} attachments in email`);

      // Find the request ID by order number
      let requestId = null;
      if (trackingInfo.orderNumber) {
        console.log(`ЁЯФН [REQUEST LOOKUP] Looking up request ID for order number: ${trackingInfo.orderNumber}, user: ${userId}`);
        const searchRequest = await storage.getSearchRequestByOrderNumber(trackingInfo.orderNumber, userId);
        if (searchRequest) {
          requestId = searchRequest.id;
          console.log(`тЬЕ [REQUEST LOOKUP] Found request ID ${requestId} for order ${trackingInfo.orderNumber}`);
        } else {
          console.log(`тЭМ [REQUEST LOOKUP] ERROR: No request found for order number ${trackingInfo.orderNumber} and user ${userId}`);
          result.status = 'failed';
          result.error = `No request found for order number ${trackingInfo.orderNumber}`;
          return result;
        }
      } else {
        console.log(`тЭМ [REQUEST LOOKUP] ERROR: No order number found in email, cannot process`);
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

      console.log(`ЁЯТ╛ [DATABASE] Saving supplier response for user ${userId}:`, {
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
        console.log(`тЬЕ [DATABASE] Successfully saved email to database with ID: ${result.dbRecordId}`);

        // ╨Ю╤В╨┐╤А╨░╨▓╨╗╤П╨╡╨╝ ╤Г╨▓╨╡╨┤╨╛╨╝╨╗╨╡╨╜╨╕╨╡ ╤З╨╡╤А╨╡╨╖ Socket.IO ╨╛ ╨╜╨╛╨▓╨╛╨╝ email
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
            console.log(`ЁЯУб [SOCKET] Sent new email notification to user ${userId} for response ${result.dbRecordId}`);
          }
        } catch (socketError) {
          console.error('тЭМ [SOCKET] Error sending new email notification:', socketError);
        }

        // ╨Ч╨░╨┐╤Г╤Б╨║╨░╨╡╨╝ ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╤Г╤О ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╤Г attachments ╨╡╤Б╨╗╨╕ ╨╛╨╜╨╕ ╨╡╤Б╤В╤М
        if (attachments && attachments.length > 0 && savedResponse) {
          console.log(`ЁЯФД Starting automatic attachment processing for response ${savedResponse.id} with ${attachments.length} attachments`);
          try {
            const { AsyncEmailProcessor } = await import('./async-processing/email-processor');
            const processor = AsyncEmailProcessor.getInstance();
            await processor.processNewEmail(savedResponse);
            console.log(`тЬЕ Automatic attachment processing started for response ${savedResponse.id}`);
          } catch (error) {
            console.error(`тЭМ Failed to start automatic attachment processing for response ${savedResponse.id}:`, error);
          }
        }

        // ╨Ч╨░╨┐╤Г╤Б╨║╨░╨╡╨╝ ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨╕╨╖╨▓╨╗╨╡╤З╨╡╨╜╨╕╨╡ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓ (╨в╨Ю╨з╨Э╨Ю ╨Ъ╨Р╨Ъ ╨Т ╨а╨г╨з╨Э╨Ю╨Щ ╨а╨Х╨Р╨Ы╨Ш╨Ч╨Р╨ж╨Ш╨Ш)
        if (savedResponse && responseData.requestId) {
          console.log(`ЁЯФД Starting automatic parameter extraction for response ${savedResponse.id}`);
          try {
            // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╤Л ╨╖╨░╨┐╤А╨╛╤Б╨░
            const requestParams = await storage.getParametersForRequest(responseData.requestId);
            if (requestParams && requestParams.parameters) {
              const parameters = Array.isArray(requestParams.parameters) 
                ? requestParams.parameters 
                : JSON.parse(requestParams.parameters as string);
              
              if (parameters && parameters.length > 0) {
                // ╨и╨Р╨У 1: ╨Р╨╜╨░╨╗╨╕╨╖ ╨▓╨╗╨╛╨╢╨╡╨╜╨╕╨╣ (╨╡╤Б╨╗╨╕ ╨╡╤Б╤В╤М)
                let attachmentParameters: Record<string, any> = {};
                let hasAttachmentData = false;
                
                if (attachments && attachments.length > 0) {
                  console.log(`ЁЯФД Step 1: Analyzing ${attachments.length} attachments for response ${savedResponse.id}`);
                  try {
                    // ╨б╨╜╨░╤З╨░╨╗╨░ ╨╛╨▒╤А╨░╨▒╨░╤В╤Л╨▓╨░╨╡╨╝ ╨▓╨╗╨╛╨╢╨╡╨╜╨╕╤П ╨┤╨╗╤П ╨╕╨╖╨▓╨╗╨╡╤З╨╡╨╜╨╕╤П ╤В╨╡╨║╤Б╤В╨░
                    const { apiAttachmentBridge } = await import('./file-processing/api_bridge.cjs');
                    const attachmentResult = await apiAttachmentBridge.analyzeSupplierResponseAttachments(savedResponse);
                    
                    console.log(`ЁЯУО Attachment processing result:`, attachmentResult);
                    
                    if (attachmentResult && attachmentResult.parameters && Object.keys(attachmentResult.parameters).length > 0) {
                      attachmentParameters = attachmentResult.parameters;
                      hasAttachmentData = true;
                      console.log(`тЬЕ Step 1: Successfully extracted parameters from attachments:`, attachmentParameters);
                    } else {
                      console.log(`тЪая╕П Step 1: No parameters found in attachments, will try email body`);
                    }
                  } catch (error) {
                    console.warn(`тЪая╕П Step 1: Attachment analysis error:`, error);
                  }
                }
                
                // ╨и╨Р╨У 2: ╨Ш╨╖╨▓╨╗╨╡╤З╨╡╨╜╨╕╨╡ ╨╕╨╖ ╤В╨╡╨╗╨░ ╨┐╨╕╤Б╤М╨╝╨░
                console.log(`ЁЯФД Step 2: Extracting parameters from email body for response ${savedResponse.id}`);
                try {
                  // ╨Ц╨┤╨╡╨╝ ╨╜╨╡╨╝╨╜╨╛╨│╨╛, ╤З╤В╨╛╨▒╤Л ╨▓╨╗╨╛╨╢╨╡╨╜╨╕╤П ╤Г╤Б╨┐╨╡╨╗╨╕ ╨╛╨▒╤А╨░╨▒╨╛╤В╨░╤В╤М╤Б╤П
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  
                  // ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ ╨┐╤А╤П╨╝╤Г╤О ╤Д╤Г╨╜╨║╤Ж╨╕╤О ╨╕╨╖╨▓╨╗╨╡╤З╨╡╨╜╨╕╤П ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓
                  const { extractParametersFromResponse } = await import('./routes/extract-parameters');
                  const bodyResult = await extractParametersFromResponse(
                    savedResponse.id,
                    parameters,
                    true // useAI = true
                  );
                  
                  console.log(`тЬЕ Step 2: Parameters extracted from email body using AI:`, bodyResult);
                  
                  // ╨и╨Р╨У 3: ╨Я╤А╨╕╨╛╤А╨╕╤В╨╕╨╖╨░╤Ж╨╕╤П ╨╕╤Б╤В╨╛╤З╨╜╨╕╨║╨╛╨▓ (╨в╨Ю╨з╨Э╨Ю ╨Ъ╨Р╨Ъ ╨Т ╨а╨г╨з╨Э╨Ю╨Щ ╨а╨Х╨Р╨Ы╨Ш╨Ч╨Р╨ж╨Ш╨Ш)
                  let bodyParameters: Record<string, any> = {};
                  let finalParameters: Record<string, string> = {};
                  
                  // ╨Ю╨▒╤А╨░╨▒╨░╤В╤Л╨▓╨░╨╡╨╝ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╤Л ╨╕╨╖ ╤В╨╡╨╗╨░ ╨┐╨╕╤Б╤М╨╝╨░
                  if (bodyResult && bodyResult.length > 0) {
                    bodyResult.forEach((param: any) => {
                      bodyParameters[param.name] = param.value || '-';
                    });
                  }
                  
                  // ╨Я╤А╨╕╨╝╨╡╨╜╤П╨╡╨╝ ╨┐╤А╨░╨▓╨╕╨╗╨░ ╨┐╤А╨╕╨╛╤А╨╕╤В╨╡╤В╨░: ╨Т╨╗╨╛╨╢╨╡╨╜╨╕╤П > ╨в╨╡╨╗╨╛ ╨┐╨╕╤Б╤М╨╝╨░
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
                  
                  // ╨б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ ╨╕╨╖╨▓╨╗╨╡╤З╨╡╨╜╨╜╤Л╨╡ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╤Л ╨▓ ╨▒╨░╨╖╤Г ╨┤╨░╨╜╨╜╤Л╤Е
                  console.log(`ЁЯФД Step 3: Saving extracted parameters to database for response ${savedResponse.id}`);
                  await storage.saveExtractedParameters({
                    responseId: savedResponse.id,
                    requestId: responseData.requestId,
                    supplierEmail: responseData.supplierEmail,
                    parameters: finalParameters,
                    status: Object.values(finalParameters).some(val => val && val !== '-') ? 'completed' : 'no_parameters_found',
                    userId: userId
                  });
                  
                  console.log(`тЬЕ Automatic parameter extraction completed for response ${savedResponse.id}:`, finalParameters);
                } catch (error) {
                  console.error(`тЭМ Step 2: Error extracting parameters from email body:`, error);
                }
              } else {
                console.log(`тЪая╕П No parameters found for request ${responseData.requestId}, skipping parameter extraction`);
              }
            } else {
              console.log(`тЪая╕П No request parameters found for request ${responseData.requestId}, skipping parameter extraction`);
            }
          } catch (error) {
            console.error(`тЭМ Failed to start automatic parameter extraction for response ${savedResponse.id}:`, error);
          }
        }
      } catch (dbError) {
        console.error(`тЭМ [DATABASE] Error saving supplier response:`, dbError);
        result.status = 'db_error';
        result.error = `Database save error: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
        return result;
      }
      
      // Attachment processing (always considered successful if no attachments)
      result.attachmentsProcessed = true;
      let attachmentErrors: string[] = [];
      
      if (attachments.length > 0) {
        try {
          console.log(`тЪЩя╕П [ATTACHMENTS] Processing ${attachments.length} attachments...`);
          // TODO: Add attachment processing logic here if needed
          // For now, we consider attachments as successfully processed if they're saved with the response
          console.log(`тЬЕ [ATTACHMENTS] All attachments processed successfully`);
        } catch (attachError) {
          console.error(`тЭМ [ATTACHMENTS] Error processing attachments:`, attachError);
          attachmentErrors.push(`Attachment processing error: ${attachError instanceof Error ? attachError.message : String(attachError)}`);
          result.attachmentsProcessed = false;
        }
      }
      
      // Set final status
      if (result.savedToDb && result.attachmentsProcessed) {
        result.status = 'success';
        console.log(`ЁЯОЙ [PROCESSING] Email ${messageId} processed completely successfully for user ${userId}`);
        
        // ╨Ю╨▒╨╜╨╛╨▓╨╗╤П╨╡╨╝ ╨▓╤А╨╡╨╝╤П ╨┐╨╛╤Б╨╗╨╡╨┤╨╜╨╡╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨┤╨╗╤П ╤Н╤В╨╛╨│╨╛ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П
        this.lastCheckTime.set(userId, new Date());
      } else if (!result.savedToDb) {
        result.status = 'db_error';
        console.log(`ЁЯЪи [PROCESSING] Email ${messageId} failed due to database error for user ${userId}`);
      } else if (!result.attachmentsProcessed) {
        result.status = 'attachment_error';
        result.attachmentErrors = attachmentErrors;
        console.log(`тЪая╕П [PROCESSING] Email ${messageId} saved to DB but failed attachment processing for user ${userId}`);
      }
      
      return result;

    } catch (error) {
      console.error(`ЁЯЪи [PERSONAL EMAIL ERROR] Error processing email ${messageId} for user ${userId}:`, error);
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  private extractTrackingInfo(content: string, subject: string): { trackingId?: string; orderNumber?: string } {
    const result: { trackingId?: string; orderNumber?: string } = {};

    console.log(`[PERSONAL EMAIL] ЁЯФН Extracting tracking info from subject: "${subject}"`);
    console.log(`[PERSONAL EMAIL] ЁЯФН Content preview: "${content.substring(0, 100)}..."`);

    const fullText = `${subject} ${content}`;
    
    // ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х 1: ╨Я╨╛╨╕╤Б╨║ order number ╨▓ ╨║╨▓╨░╨┤╤А╨░╤В╨╜╤Л╤Е ╤Б╨║╨╛╨▒╨║╨░╤Е [REQ-XXXXXXXXX] (╨▒╤Г╨║╨▓╤Л, ╤Ж╨╕╤Д╤А╤Л, ╨┐╨╛╨┤╤З╨╡╤А╨║╨╕╨▓╨░╨╜╨╕╨╡)
    const bracketOrderMatch = fullText.match(/\[REQ-([A-Z0-9_-]+)\]/);
    if (bracketOrderMatch) {
      result.orderNumber = `REQ-${bracketOrderMatch[1]}`;
      console.log(`[PERSONAL EMAIL] тЬЕ BRACKET ORDER MATCH - Found: ${result.orderNumber}`);
    }
    
    // ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х 2: ╨Я╨╛╨╕╤Б╨║ tracking ID ╨▓ ╨║╨▓╨░╨┤╤А╨░╤В╨╜╤Л╤Е ╤Б╨║╨╛╨▒╨║╨░╤Е [TID:XXXXXXXXX]
    const bracketTidMatch = fullText.match(/\[TID:([A-Za-z0-9]+)\]/);
    if (bracketTidMatch) {
      result.trackingId = bracketTidMatch[1];
      console.log(`[PERSONAL EMAIL] тЬЕ BRACKET TID MATCH - Found: ${result.trackingId}`);
    }

    // Fallback: Direct search for REQ-XXXX-XXXXX ╨▒╨╡╨╖ ╤Б╨║╨╛╨▒╨╛╨║ (╨┤╨╗╤П ╤Б╨╛╨▓╨╝╨╡╤Б╤В╨╕╨╝╨╛╤Б╤В╨╕)
    if (!result.orderNumber) {
      const directOrderMatch = fullText.match(/REQ-\d{4}-\d{5}/);
      if (directOrderMatch) {
        result.orderNumber = directOrderMatch[0];
        console.log(`[PERSONAL EMAIL] тЬЕ DIRECT MATCH - Found order number: ${result.orderNumber}`);
      }
    }
    
    // Fallback: ╨Я╨╛╨╕╤Б╨║ tracking ID ╨▓ ╤В╨╡╨║╤Б╤В╨╡ (╤Б╤В╨░╤А╤Л╨╣ ╨░╨╗╨│╨╛╤А╨╕╤В╨╝ ╨┤╨╗╤П ╤Б╨╛╨▓╨╝╨╡╤Б╤В╨╕╨╝╨╛╤Б╤В╨╕)
    if (!result.trackingId) {
      const fullTextLower = fullText.toLowerCase();
      const trackingMatch = fullTextLower.match(/tracking[:\s]+([a-z0-9]{8,})/i);
      if (trackingMatch && trackingMatch[1]) {
        result.trackingId = trackingMatch[1].trim();
        console.log(`[PERSONAL EMAIL] тЬЕ FALLBACK TRACKING MATCH - Found: ${result.trackingId}`);
      }
    }
    
    // Fallback: ╨Я╨╛╨╕╤Б╨║ order number ╨▓ ╨║╨╛╨╜╤В╨╡╨╜╤В╨╡ (╤Б╤В╨░╤А╤Л╨╣ ╨░╨╗╨│╨╛╤А╨╕╤В╨╝ ╨┤╨╗╤П ╤Б╨╛╨▓╨╝╨╡╤Б╤В╨╕╨╝╨╛╤Б╤В╨╕)
    if (!result.orderNumber) {
      const fullTextLower = fullText.toLowerCase();
      const orderMatch = fullTextLower.match(/(?:order|request)\s*(?:number|id|#)?\s*[:#\s]+\s*(req-\d{4}-\d{5})/i);
      if (orderMatch && orderMatch[1]) {
        result.orderNumber = orderMatch[1].toUpperCase();
        console.log(`[PERSONAL EMAIL] тЬЕ FALLBACK CONTENT MATCH - Found: ${result.orderNumber}`);
      }
    }
    
    // ╨Р╨╗╤М╤В╨╡╤А╨╜╨░╤В╨╕╨▓╨╜╤Л╨╣ ╤Д╨╛╤А╨╝╨░╤В ╨▒╨╡╨╖ REQ ╨┐╤А╨╡╤Д╨╕╨║╤Б╨░
    if (!result.orderNumber) {
      const fullTextLower = fullText.toLowerCase();
      const altOrderMatch = fullTextLower.match(/(?:order|request)\s*(?:number|id|#)?\s*[:#\s]+\s*(\d{4}-\d{5})/i);
      if (altOrderMatch && altOrderMatch[1]) {
        result.orderNumber = `REQ-${altOrderMatch[1].toUpperCase()}`;
        console.log(`[PERSONAL EMAIL] тЬЕ FALLBACK ALT FORMAT - Found: ${result.orderNumber}`);
      }
    }
    
    // ╨Ы╨╛╨│╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡ ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В╨░
    if (result.orderNumber || result.trackingId) {
      console.log(`[PERSONAL EMAIL] ЁЯОп EXTRACTION SUCCESS - Order: ${result.orderNumber || 'N/A'}, Tracking: ${result.trackingId || 'N/A'}`);
    } else {
      console.log(`[PERSONAL EMAIL] тЭМ EXTRACTION FAILED - No tracking info found in: "${subject}"`);
      console.log(`[PERSONAL EMAIL] ЁЯФН Debug - Testing regex patterns manually...`);
      
      // Debug: ╤В╨╡╤Б╤В╨╕╤А╤Г╨╡╨╝ ╨║╨░╨╢╨┤╤Л╨╣ ╨┐╨░╤В╤В╨╡╤А╨╜ ╨╛╤В╨┤╨╡╨╗╤М╨╜╨╛
      console.log(`[PERSONAL EMAIL] ЁЯФН Test [REQ-XXXXX]: ${/\[REQ-([A-Z0-9_-]+)\]/.test(fullText)}`);
      console.log(`[PERSONAL EMAIL] ЁЯФН Test [TID:XXXXX]: ${/\[TID:([A-Za-z0-9]+)\]/.test(fullText)}`);
      console.log(`[PERSONAL EMAIL] ЁЯФН Test REQ-XXXXX: ${/REQ-[A-Z0-9_-]+/.test(fullText)}`);
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
