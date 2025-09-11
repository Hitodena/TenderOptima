import { Request, Response } from 'express';
import { storage } from '../storage';
import { emailService } from '../email';

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
    const trackingId = Math.random().toString(36).substring(2, 12);
    
    // Format subject with tracking identifiers
    const orderNumber = requestDetails.orderNumber || '0000-00000';
    const requestRef = `REQ-${orderNumber}`;
    const formattedSubject = `${subject} [${requestRef}] [TID:${trackingId}]`;
    
    // Add tracking footer to message
    const referenceFooter = `\n\n!При ответе на наш запрос не меняйте тему письма (Subject), иначе мы не сможем обработать ваш ответ!\n!Request Reference: ${requestRef}\nRequest Tracking ID: ${trackingId}\n`;
    const fullMessage = message + referenceFooter;

    // Send email via Nodemailer with formatted subject and message
    const emailSent = await emailService.sendEmail({
      to: supplierEmail,
      subject: formattedSubject,
      text: fullMessage,
      html: fullMessage.replace(/\n/g, '<br/>'),
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