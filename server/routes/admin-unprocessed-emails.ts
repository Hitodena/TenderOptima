import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireAdmin } from '../auth';
import { sendEmail } from '../email';

const router = Router();

// Get all unprocessed emails
router.get('/unprocessed-emails', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, userId } = req.query;
    const emails = await storage.getUnprocessedEmails(
      userId ? parseInt(userId as string) : undefined,
      status as string
    );
    
    res.json(emails);
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error fetching unprocessed emails:', error);
    res.status(500).json({ error: 'Failed to fetch unprocessed emails' });
  }
});

// Get unprocessed email by ID
router.get('/unprocessed-emails/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const email = await storage.getUnprocessedEmailById(parseInt(id));
    
    if (!email) {
      return res.status(404).json({ error: 'Unprocessed email not found' });
    }
    
    res.json(email);
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error fetching unprocessed email:', error);
    res.status(500).json({ error: 'Failed to fetch unprocessed email' });
  }
});

// Update unprocessed email status
router.patch('/unprocessed-emails/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const processedBy = req.session.userId;
    
    const success = await storage.updateUnprocessedEmailStatus(
      parseInt(id),
      status,
      processedBy
    );
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to update email status' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error updating email status:', error);
    res.status(500).json({ error: 'Failed to update email status' });
  }
});

// Delete unprocessed email
router.delete('/unprocessed-emails/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteUnprocessedEmail(parseInt(id));
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to delete email' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error deleting email:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

// Reply to unprocessed email
router.post('/unprocessed-emails/:id/reply', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Get the unprocessed email with user info
    const email = await storage.getUnprocessedEmailById(parseInt(id));
    if (!email) {
      return res.status(404).json({ error: 'Unprocessed email not found' });
    }
    
    // Get user email configuration - use the user who received the email
    const user = await storage.getUserById(email.userId!);
    console.log(`[Admin Unprocessed Emails] Using user ${email.userId} (who received the email) for sending replies:`, {
      hasUser: !!user,
      userId: user?.id,
      username: user?.username,
      hasAccount: !!user?.emailAccount,
      hasPassword: !!user?.emailPassword,
      emailConfigured: user?.emailConfigured,
      smtpHost: user?.smtpHost,
      smtpPort: user?.smtpPort
    });
    
    if (!user || !user.emailAccount || !user.emailPassword) {
      return res.status(400).json({ error: `User ${email.userId} email not configured` });
    }
    
    // Send the reply email using user's SMTP
    const emailSent = await sendEmail(
      email.senderEmail,
      `Re: ${email.subject}`,
      content,
      {
        html: content.replace(/\n/g, '<br>'),
        userId: email.userId, // Use the user who received the email
        hideBusinessCard: true // Hide business card for admin replies
      }
    );
    
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send email' });
    }
    
    // Mark email as replied only after successful sending
    await storage.markEmailAsReplied(parseInt(id), content);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error replying to email:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Get email reply templates
router.get('/email-reply-templates', requireAuth, requireAdmin, async (req, res) => {
  try {
    const templates = await storage.getEmailReplyTemplates();
    res.json(templates);
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create email reply template
router.post('/email-reply-templates', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, subject, content, isDefault } = req.body;
    const userId = req.session.userId;
    
    const template = await storage.createEmailReplyTemplate({
      userId: userId!,
      name,
      subject,
      content,
      isDefault: isDefault || false
    });
    
    res.json(template);
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update email reply template
router.patch('/email-reply-templates/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, content, isDefault } = req.body;
    
    const success = await storage.updateEmailReplyTemplate(parseInt(id), {
      name,
      subject,
      content,
      isDefault
    });
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to update template' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete email reply template
router.delete('/email-reply-templates/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteEmailReplyTemplate(parseInt(id));
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to delete template' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin Unprocessed Emails] Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});


export default router;
