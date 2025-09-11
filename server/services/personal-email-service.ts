import nodemailer from 'nodemailer';
import { storage } from '../storage';
import { decryptEmailPassword } from '../utils/email-encryption';

interface PersonalEmailConfig {
  emailAccount: string;
  emailPassword: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
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

class PersonalEmailService {
  private transporterCache = new Map<number, nodemailer.Transporter>();
  private configCache = new Map<number, PersonalEmailConfig>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get user's email configuration from database
   */
  private async getUserEmailConfig(userId: number): Promise<PersonalEmailConfig | null> {
    try {
      // Check cache first
      if (this.configCache.has(userId)) {
        return this.configCache.get(userId)!;
      }

      const user = await storage.getUserById(userId);
      if (!user || !user.emailConfigured || !user.emailAccount || !user.emailPassword) {
        return null;
      }

      const config: PersonalEmailConfig = {
        emailAccount: user.emailAccount,
        emailPassword: user.emailPassword,
        smtpHost: user.smtpHost || 'smtp.mail.ru',
        smtpPort: user.smtpPort || 587,
        imapHost: user.imapHost || 'imap.mail.ru',
        imapPort: user.imapPort || 993
      };

      // Cache the config
      this.configCache.set(userId, config);
      setTimeout(() => this.configCache.delete(userId), this.CACHE_TTL);

      return config;
    } catch (error) {
      console.error(`Error getting email config for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get or create email transporter for user
   */
  private async getUserTransporter(userId: number): Promise<nodemailer.Transporter | null> {
    try {
      // Check cache first
      if (this.transporterCache.has(userId)) {
        return this.transporterCache.get(userId)!;
      }

      const config = await this.getUserEmailConfig(userId);
      if (!config) {
        // Fall back to system email if no personal config
        return this.getSystemTransporter();
      }

      // Check if password is encrypted (contains : separators) or plain text
      let actualPassword: string;
      try {
        if (config.emailPassword.includes(':') && config.emailPassword.split(':').length === 3) {
          // Password appears to be encrypted
          actualPassword = decryptEmailPassword(config.emailPassword);
        } else {
          // Password is plain text
          actualPassword = config.emailPassword;
        }
      } catch (error) {
        console.log(`[email] Password decryption failed for user ${userId}, using as plain text`);
        actualPassword = config.emailPassword;
      }

      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: config.emailAccount,
          pass: actualPassword
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Cache the transporter
      this.transporterCache.set(userId, transporter);
      setTimeout(() => {
        this.transporterCache.delete(userId);
        transporter.close();
      }, this.CACHE_TTL);

      return transporter;
    } catch (error) {
      console.error(`Error creating transporter for user ${userId}:`, error);
      return this.getSystemTransporter();
    }
  }

  /**
   * Get system transporter (fallback)
   */
  private getSystemTransporter(): nodemailer.Transporter | null {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return null;
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  /**
   * Send email using user's personal email configuration
   */
  async sendEmail(userId: number, options: EmailOptions): Promise<boolean> {
    try {
      const transporter = await this.getUserTransporter(userId);
      if (!transporter) {
        console.error(`No email transporter available for user ${userId}`);
        return false;
      }

      // Get user's email for 'from' field
      const config = await this.getUserEmailConfig(userId);
      const fromEmail = config?.emailAccount || process.env.SMTP_USER;

      const mailOptions = {
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo || fromEmail,
        attachments: options.attachments,
        headers: options.headers
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully for user ${userId}:`, result.messageId);
      return true;

    } catch (error) {
      console.error(`Error sending email for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Test email connection for user
   */
  async testConnection(userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getUserTransporter(userId);
      if (!transporter) {
        return { success: false, error: 'No email configuration found' };
      }

      await transporter.verify();
      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Clear cache for specific user (call when user updates email config)
   */
  clearUserCache(userId: number): void {
    if (this.transporterCache.has(userId)) {
      const transporter = this.transporterCache.get(userId)!;
      transporter.close();
      this.transporterCache.delete(userId);
    }
    this.configCache.delete(userId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.transporterCache.forEach(transporter => {
      transporter.close();
    });
    this.transporterCache.clear();
    this.configCache.clear();
  }

  /**
   * Get list of all users with configured email
   */
  async getUsersWithEmailConfig(): Promise<Array<{ userId: number; emailAccount: string }>> {
    try {
      const users = await storage.getUsersWithEmailConfig();
      return users.map((user: any) => ({
        userId: user.id,
        emailAccount: user.emailAccount!
      }));
    } catch (error) {
      console.error('Error getting users with email config:', error);
      return [];
    }
  }
}

// Export singleton instance
export const personalEmailService = new PersonalEmailService();