import { Router } from 'express';
import multer from 'multer';
import { sendEmail } from '../email';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  }
});

// Helper function to get user info
async function getUserInfo(userId: number) {
  try {
    const [user] = await db.select({
      username: users.username,
      email: users.email,
      businessCard: users.businessCard,
    }).from(users).where(eq(users.id, userId));
    
    return user;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

// Endpoint to send contact form message with attachments
router.post('/send-message', upload.array('attachments', 5), async (req, res) => {
  try {
    const { subject, message, userEmail: providedUserEmail, userName: providedUserName } = req.body;
    const userId = (req.user as any)?.id;
    const files = req.files as Express.Multer.File[];
    
    // Validation
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }
    
    // Always use support@tenderoptima.by as recipient
    const supportEmail = 'support@tenderoptima.by';
    
    // Use provided user info from frontend, or fallback to authenticated user info, or anonymous
    let userEmail = providedUserEmail || 'anonymous@user.com';
    let userName = providedUserName || 'Anonymous User';
    
    // If no provided info but user is authenticated, try to get from session
    if (!providedUserEmail && userId) {
      const userInfo = await getUserInfo(userId);
      userEmail = userInfo?.email || (req.user as any)?.claims?.email || userEmail;
      userName = userInfo?.username || (req.user as any)?.claims?.name || userName;
    }
    
    // Prepare attachments for email sending (handle case when no files)
    const attachments = files ? files.map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    })) : [];
    
    // Prepare email content
    const emailSubject = `Contact Form: ${subject}`;
    const emailText = `
From: ${userName} (${userEmail})
Subject: ${subject}

Message:
${message}

--
This message was sent from the contact form in the application.
    `;
    
    const emailHtml = `
      <h3>Contact Form Message</h3>
      <p><strong>From:</strong> ${userName} (${userEmail})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <h4>Message:</h4>
      <div style="padding: 10px; border-left: 4px solid #ddd; margin-bottom: 15px;">
        ${message.replace(/\n/g, '<br/>')}
      </div>
      <p style="color: #666; font-size: 12px;">This message was sent from the contact form in the application.</p>
    `;
    
    // Send email with attachments to support
    const emailSent = await sendEmail(
      supportEmail, 
      emailSubject, 
      emailText, 
      {
        html: emailHtml,
        attachments,
        replyTo: userEmail,
        userId
      }
    );
    
    if (emailSent) {
      res.status(200).json({ success: true, message: 'Message sent successfully' });
    } else {
      throw new Error('Failed to send email');
    }
  } catch (error) {
    console.error('Error sending contact form message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Endpoint to get manager info - this would be filled with real data in production
router.get('/manager-info', async (req, res) => {
  try {
    // In a real implementation, this would look up the assigned manager
    // for the authenticated user from the database
    
    // Mock response for now
    const managerInfo = {
      name: 'Служба поддержки',
      email: 'support@tenderoptima.by',
      phone: '+375 29 123 45 67',
    };
    
    res.status(200).json(managerInfo);
  } catch (error) {
    console.error('Error fetching manager info:', error);
    res.status(500).json({ error: 'Failed to fetch manager information' });
  }
});

export default router;