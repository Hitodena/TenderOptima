import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { storage } from '../storage';
import { encryptEmailPassword, decryptEmailPassword, testEncryption } from '../utils/email-encryption';
import { personalEmailService } from '../services/personal-email-service';

const router = Router();

// Admin middleware - check if user has admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Get all users with their email configuration status
 */
router.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    
    const usersWithEmailStatus = users.map((user: any) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      emailConfigured: user.emailConfigured || false,
      emailAccount: user.emailAccount || null,
      hasEmailPassword: !!user.emailPassword,
      smtpHost: user.smtpHost || 'smtp.mail.ru',
      smtpPort: user.smtpPort || 587,
      imapHost: user.imapHost || 'imap.mail.ru',
      imapPort: user.imapPort || 993,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }));

    res.json(usersWithEmailStatus);
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Get email configuration for specific user
 */
router.get('/api/admin/users/:id/email-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const config = await storage.getUserEmailConfig(userId);
    if (!config) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return config without password for security
    const safeConfig = {
      emailAccount: config.emailAccount,
      hasPassword: !!config.emailPassword,
      smtpHost: config.smtpHost || 'smtp.mail.ru',
      smtpPort: config.smtpPort || 587,
      imapHost: config.imapHost || 'imap.mail.ru',
      imapPort: config.imapPort || 993,
      emailConfigured: config.emailConfigured || false
    };

    res.json(safeConfig);
  } catch (error) {
    console.error('Error fetching user email config:', error);
    res.status(500).json({ error: 'Failed to fetch email configuration' });
  }
});

/**
 * Update email configuration for specific user
 */
router.put('/api/admin/users/:id/email-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { emailAccount, emailPassword, smtpHost, smtpPort, imapHost, imapPort } = req.body;

    // Validate required fields
    if (!emailAccount || !emailPassword) {
      return res.status(400).json({ error: 'Email account and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAccount)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Encrypt password
    const encryptedPassword = encryptEmailPassword(emailPassword);

    // Prepare config update
    const configUpdate = {
      emailAccount,
      emailPassword: encryptedPassword,
      smtpHost: smtpHost || 'smtp.mail.ru',
      smtpPort: smtpPort || 587,
      imapHost: imapHost || 'imap.mail.ru',
      imapPort: imapPort || 993,
      emailConfigured: true
    };

    // Update in database
    const success = await storage.updateUserEmailConfig(userId, configUpdate);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update email configuration' });
    }

    // Clear cache for this user
    personalEmailService.clearUserCache(userId);

    res.json({ 
      success: true, 
      message: 'Email configuration updated successfully',
      config: {
        emailAccount: configUpdate.emailAccount,
        smtpHost: configUpdate.smtpHost,
        smtpPort: configUpdate.smtpPort,
        imapHost: configUpdate.imapHost,
        imapPort: configUpdate.imapPort,
        emailConfigured: true
      }
    });
  } catch (error) {
    console.error('Error updating user email config:', error);
    res.status(500).json({ error: 'Failed to update email configuration' });
  }
});

/**
 * Test email connection for specific user
 */
router.post('/api/admin/users/:id/email-config/test', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Test connection using PersonalEmailService
    const testResult = await personalEmailService.testConnection(userId);
    
    res.json({
      success: testResult.success,
      message: testResult.success ? 'Email connection successful' : `Connection failed: ${testResult.error}`,
      error: testResult.error
    });
  } catch (error) {
    console.error('Error testing email connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to test email connection',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset email configuration for specific user
 */
router.delete('/api/admin/users/:id/email-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Reset config in database
    const success = await storage.resetUserEmailConfig(userId);
    if (!success) {
      return res.status(500).json({ error: 'Failed to reset email configuration' });
    }

    // Clear cache for this user
    personalEmailService.clearUserCache(userId);

    res.json({ 
      success: true, 
      message: 'Email configuration reset successfully' 
    });
  } catch (error) {
    console.error('Error resetting user email config:', error);
    res.status(500).json({ error: 'Failed to reset email configuration' });
  }
});

/**
 * Test encryption system
 */
router.get('/api/admin/test-encryption', requireAuth, requireAdmin, async (req, res) => {
  try {
    const isWorking = testEncryption();
    res.json({
      success: isWorking,
      message: isWorking ? 'Encryption system is working correctly' : 'Encryption system test failed'
    });
  } catch (error) {
    console.error('Error testing encryption:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Encryption test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get system email statistics
 */
router.get('/api/admin/email-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    const usersWithEmail = users.filter((user: any) => user.emailConfigured && user.emailAccount);
    
    const stats = {
      totalUsers: users.length,
      usersWithEmailConfig: usersWithEmail.length,
      usersWithoutEmailConfig: users.length - usersWithEmail.length,
      configurationRate: users.length > 0 ? Math.round((usersWithEmail.length / users.length) * 100) : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ error: 'Failed to fetch email statistics' });
  }
});

// Get all subscriptions for admin view
router.get('/subscriptions', async (req, res) => {
  try {
    console.log('[Admin Email API] Fetching all subscriptions');
    const subscriptions = await storage.getAllSubscriptionsWithUsers();
    console.log(`[Admin Email API] Found ${subscriptions.length} subscriptions`);
    res.json(subscriptions);
  } catch (error) {
    console.error('[Admin Email API] Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Ошибка при получении подписок' });
  }
});

// Update user email configuration
router.put('/users/:userId/config', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { emailAccount, emailPassword, smtpHost, smtpPort, imapHost, imapPort } = req.body;

    // Validate required fields
    if (!emailAccount || !emailPassword) {
      return res.status(400).json({ error: 'Email account and password are required' });
    }

    // Encrypt password
    const encryptedPassword = encryptEmailPassword(emailPassword);

    // Update user email configuration
    const success = await storage.updateUserEmailConfig(userId, {
      emailAccount,
      emailPassword: encryptedPassword,
      smtpHost: smtpHost || 'smtp.mail.ru',
      smtpPort: smtpPort || 587,
      imapHost: imapHost || 'imap.mail.ru',
      imapPort: imapPort || 993,
      emailConfigured: true
    });

    if (success) {
      res.json({ success: true, message: 'Email configuration updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update email configuration' });
    }
  } catch (error) {
    console.error('Error updating user email config:', error);
    res.status(500).json({ error: 'Failed to update email configuration' });
  }
});

// Reset user email configuration
router.post('/users/:userId/reset', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Reset email configuration
    const success = await storage.resetUserEmailConfig(userId);

    if (success) {
      res.json({ success: true, message: 'Email configuration reset successfully' });
    } else {
      res.status(500).json({ error: 'Failed to reset email configuration' });
    }
  } catch (error) {
    console.error('Error resetting user email config:', error);
    res.status(500).json({ error: 'Failed to reset email configuration' });
  }
});

export default router;