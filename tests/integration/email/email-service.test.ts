import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';
import { TestHelpers } from '../../utils/test-helpers';

// Моки для email сервисов
const mockSendEmail = vi.fn();
const mockSendBulkEmail = vi.fn();
const mockValidateEmail = vi.fn();

vi.mock('../../../server/email', () => ({
  sendEmail: mockSendEmail,
  sendSimpleEmail: mockSendEmail,
  emailService: {
    sendEmail: mockSendEmail,
    sendBulkEmail: mockSendBulkEmail,
    validateEmail: mockValidateEmail
  }
}));

describe('Email Service Integration Tests', () => {
  let authToken: string;
  let userId: number;

  beforeEach(async () => {
    await setupTestEnvironment();
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    userId = session.user.id;
    
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Email Configuration', () => {
    it('should configure user email settings', async () => {
      const emailConfig = {
        emailAccount: 'user@company.com',
        emailPassword: 'encryptedpassword',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        imapHost: 'imap.gmail.com',
        imapPort: 993
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/business-card`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailConfig)
      });

      expect(response.status).toBe(200);
    });

    it('should validate email configuration', async () => {
      mockValidateEmail.mockResolvedValue(true);

      const emailConfig = {
        emailAccount: 'test@example.com',
        emailPassword: 'password123'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/validate-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailConfig)
      });

      expect(response.status).toBe(200);
      expect(mockValidateEmail).toHaveBeenCalledWith(emailConfig.emailAccount);
    });

    it('should handle invalid email configuration', async () => {
      mockValidateEmail.mockResolvedValue(false);

      const emailConfig = {
        emailAccount: 'invalid-email',
        emailPassword: 'password123'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/validate-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailConfig)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Email Sending', () => {
    it('should send single email', async () => {
      mockSendEmail.mockResolvedValue(true);

      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        body: 'Test email content',
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/test-personal-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailData)
      });

      expect(response.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledWith(
        emailData.to,
        emailData.subject,
        emailData.body,
        { userId: userId }
      );
    });

    it('should send bulk emails', async () => {
      mockSendBulkEmail.mockResolvedValue(true);

      const bulkEmailData = {
        recipients: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        subject: 'Bulk Email',
        body: 'Bulk email content',
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/send-bulk-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(bulkEmailData)
      });

      expect(response.status).toBe(200);
      expect(mockSendBulkEmail).toHaveBeenCalledWith(
        bulkEmailData.recipients,
        bulkEmailData.subject,
        bulkEmailData.body,
        { userId: userId }
      );
    });

    it('should handle email sending errors', async () => {
      mockSendEmail.mockRejectedValue(new Error('SMTP connection failed'));

      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        body: 'Test email content',
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/test-personal-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailData)
      });

      expect(response.status).toBe(500);
    });

    it('should validate email addresses before sending', async () => {
      mockValidateEmail.mockImplementation((email) => {
        return email.includes('@') && email.includes('.');
      });

      const validEmailData = {
        to: 'valid@example.com',
        subject: 'Test Email',
        body: 'Test email content',
        userId: userId
      };

      const invalidEmailData = {
        to: 'invalid-email',
        subject: 'Test Email',
        body: 'Test email content',
        userId: userId
      };

      // Валидный email
      const validResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/test-personal-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(validEmailData)
      });

      expect(validResponse.status).toBe(200);

      // Невалидный email
      const invalidResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/test-personal-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(invalidEmailData)
      });

      expect(invalidResponse.status).toBe(400);
    });
  });

  describe('Email Templates', () => {
    it('should send email with template', async () => {
      mockSendEmail.mockResolvedValue(true);

      const templateData = {
        to: 'recipient@example.com',
        template: 'supplier-request',
        variables: {
          supplierName: 'Test Supplier',
          requestTitle: 'Test Request',
          deadline: '2024-12-31'
        },
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/send-template-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(templateData)
      });

      expect(response.status).toBe(200);
    });

    it('should handle template rendering errors', async () => {
      mockSendEmail.mockRejectedValue(new Error('Template rendering failed'));

      const templateData = {
        to: 'recipient@example.com',
        template: 'invalid-template',
        variables: {},
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/send-template-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(templateData)
      });

      expect(response.status).toBe(500);
    });
  });

  describe('Email Attachments', () => {
    it('should send email with attachment', async () => {
      mockSendEmail.mockResolvedValue(true);

      const emailData = {
        to: 'recipient@example.com',
        subject: 'Email with Attachment',
        body: 'Please find attached file',
        attachments: [
          {
            filename: 'document.pdf',
            content: 'base64-encoded-content',
            type: 'application/pdf'
          }
        ],
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/send-email-with-attachment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailData)
      });

      expect(response.status).toBe(200);
    });

    it('should validate attachment types', async () => {
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Email with Invalid Attachment',
        body: 'Please find attached file',
        attachments: [
          {
            filename: 'malicious.exe',
            content: 'base64-encoded-content',
            type: 'application/x-executable'
          }
        ],
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/send-email-with-attachment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailData)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Email Rate Limiting', () => {
    it('should respect rate limits', async () => {
      // Мокаем rate limiting
      let emailCount = 0;
      mockSendEmail.mockImplementation(() => {
        emailCount++;
        if (emailCount > 10) {
          throw new Error('Rate limit exceeded');
        }
        return Promise.resolve(true);
      });

      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        body: 'Test email content',
        userId: userId
      };

      // Отправляем много писем быстро
      const promises = Array.from({ length: 15 }, () =>
        fetch(`${TEST_CONFIG.API_BASE_URL}/api/test-personal-email`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(emailData)
        })
      );

      const responses = await Promise.all(promises);
      
      // Некоторые запросы должны быть заблокированы
      const errorResponses = responses.filter(r => r.status === 429);
      expect(errorResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Email Delivery Status', () => {
    it('should track email delivery status', async () => {
      mockSendEmail.mockResolvedValue(true);

      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        body: 'Test email content',
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/test-personal-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle delivery failures', async () => {
      mockSendEmail.mockRejectedValue(new Error('Recipient email not found'));

      const emailData = {
        to: 'nonexistent@example.com',
        subject: 'Test Email',
        body: 'Test email content',
        userId: userId
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/test-personal-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(emailData)
      });

      expect(response.status).toBe(500);
    });
  });
});


