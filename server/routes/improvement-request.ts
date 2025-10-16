import { Request, Response } from 'express';
import { storage } from '../storage';
import { emailService } from '../email';
import { nanoid } from 'nanoid';

export async function sendImprovementRequest(req: Request, res: Response) {
  try {
    const { requestId, supplierEmail, supplierName, subject, message } = req.body;

    if (!requestId || !supplierEmail || !supplierName || !subject || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: requestId, supplierEmail, supplierName, subject, message' 
      });
    }

    // Get request details for context
    const requestDetails = await storage.getSearchRequest(requestId);
    if (!requestDetails) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Generate tracking ID for this improvement request
    const trackingId = storage.generateTrackingId();
    
    // Format subject with tracking identifiers
    // REQ must be the same for ALL emails in the same request (use orderNumber from DB)
    const requestRef = requestDetails.orderNumber;
    const formattedSubject = `${subject} [${requestRef}] [TID:${trackingId}]`;
    
    // Add tracking footer to message BEFORE business card
    // The footer should appear after the main content but before the business card
    const referenceFooter = `\n**!При ответе на наш запрос не меняйте тему письма (Subject), иначе мы не сможем обработать ваш ответ!**\n`;
    
    // Insert the footer before the business card if it exists in content
    let fullMessage = message;
    
    // Search for business card patterns (case insensitive)
    const businessCardPatterns = [
      'С уважением,',
      'С Уважением,',
      'с уважением,',
      'с Уважением,'
    ];
    
    let businessCardStart = -1;
    let foundPattern = '';
    
    for (const pattern of businessCardPatterns) {
      const index = message.lastIndexOf(pattern);
      if (index > businessCardStart) {
        businessCardStart = index;
        foundPattern = pattern;
      }
    }
    
    if (businessCardStart !== -1) {
      const beforeBusinessCard = message.substring(0, businessCardStart);
      const businessCard = message.substring(businessCardStart);
      // Add footer before business card
      fullMessage = beforeBusinessCard + referenceFooter + '\n' + businessCard;
    } else {
      fullMessage = message + referenceFooter;
    }

    // Send email via Nodemailer with formatted subject and message
    const emailSent = await emailService.sendEmail({
      to: supplierEmail,
      subject: formattedSubject,
      text: fullMessage,
      html: fullMessage.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
      userId: req.user?.id,
      hideBusinessCard: true, // Hide business card for improvement requests
    });

    if (!emailSent) {
      console.error(`Failed to send improvement request email to ${supplierEmail}`);
      return res.status(500).json({ 
        error: 'Failed to send improvement request email',
        details: 'Email service error'
      });
    }

    console.log(`Improvement request sent to ${supplierEmail} for request ${requestId}`);

    // Log the improvement request in the database with tracking ID
    // This ensures we only count actual improvement requests from the "Улучшить" button
    await storage.logImprovementRequest({
      requestId,
      supplierEmail,
      supplierName,
      subject: formattedSubject,
      message: fullMessage,
      sentAt: new Date(),
      userId: req.user?.id,
      trackingId: trackingId,
      requestType: "improvement"
    });

    res.json({ 
      success: true, 
      message: `Improvement request sent to ${supplierName}` 
    });

  } catch (error) {
    console.error('Error sending improvement request:', error);
    res.status(500).json({ 
      error: 'Failed to send improvement request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}