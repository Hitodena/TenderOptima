import { Request, Response } from 'express';
import { storage } from '../storage';
import { emailService } from '../email';
import { z } from 'zod';

const winnerNotificationSchema = z.object({
  requestId: z.number(),
  winnerEmail: z.string().email(),
  winnerName: z.string(),
  subject: z.string().min(1),
  content: z.string().min(1),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // Base64 encoded
    contentType: z.string().optional()
  })).optional()
});

const getWinnerInfoSchema = z.object({
  requestId: z.string().transform((val) => parseInt(val, 10))
});

const deleteWinnerSelectionSchema = z.object({
  requestId: z.string().transform((val) => parseInt(val, 10))
});

// POST /api/winner-notification
export const sendWinnerNotification = async (req: Request, res: Response) => {
  try {
    console.log('[Winner Notification] Processing winner notification request');
    
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const validatedData = winnerNotificationSchema.parse(req.body);
    const { requestId, winnerEmail, winnerName, subject, content, attachments = [] } = validatedData;

    // Check if winner is already selected for this request
    const existingWinner = await storage.getWinnerByRequestId(requestId);
    if (existingWinner) {
      return res.status(400).json({ 
        success: false, 
        error: 'Winner already selected for this request' 
      });
    }

    // Prepare email attachments
    const emailAttachments = attachments.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType || 'application/octet-stream'
    }));

    // Send email notification
    const emailSent = await emailService.sendEmail({
      to: winnerEmail,
      subject: subject,
      text: content,
      html: content.replace(/\n/g, '<br>'),
      attachments: emailAttachments,
      userId: req.user.id
    });

    if (!emailSent) {
      console.error('[Winner Notification] Failed to send email notification');
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send email notification' 
      });
    }

    // Save winner selection to database
    const winnerSelection = await storage.createWinnerSelection({
      requestId,
      winnerEmail,
      winnerName,
      selectedDate: new Date(),
      notificationSent: true,
      userId: req.user.id,
      notificationSubject: subject,
      notificationContent: content,
      attachments: attachments
    });

    console.log('[Winner Notification] Winner selection saved successfully:', winnerSelection.id);

    res.status(200).json({
      success: true,
      message: 'Winner notification sent successfully',
      winnerId: winnerSelection.id
    });

  } catch (error) {
    console.error('[Winner Notification] Error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// GET /api/winner-info/:requestId
export const getWinnerInfo = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { requestId } = getWinnerInfoSchema.parse(req.params);
    
    const winnerInfo = await storage.getWinnerByRequestId(requestId);
    
    if (!winnerInfo) {
      return res.status(404).json({ 
        success: false, 
        error: 'No winner selected for this request' 
      });
    }

    // Only return winner info if user owns the request
    const request = await storage.getSearchRequest(requestId);
    if (!request || request.userId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    res.status(200).json({
      success: true,
      winner: {
        id: winnerInfo.id,
        winnerEmail: winnerInfo.winnerEmail,
        winnerName: winnerInfo.winnerName,
        selectedDate: winnerInfo.selectedDate,
        notificationSent: winnerInfo.notificationSent
      }
    });

  } catch (error) {
    console.error('[Winner Info] Error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// DELETE /api/winner-selection/:requestId
export const cancelWinnerSelection = async (req: Request, res: Response) => {
  try {
    console.log('[Cancel Winner] Processing winner cancellation request');
    
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { requestId } = deleteWinnerSelectionSchema.parse(req.params);
    
    // Check if winner exists and user owns the request
    const request = await storage.getSearchRequest(requestId);
    if (!request || request.userId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const winnerInfo = await storage.getWinnerByRequestId(requestId);
    if (!winnerInfo) {
      return res.status(404).json({ 
        success: false, 
        error: 'No winner selected for this request' 
      });
    }

    // Delete winner selection
    const deleted = await storage.deleteWinnerSelection(requestId);
    
    if (!deleted) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to cancel winner selection' 
      });
    }

    console.log('[Cancel Winner] Winner selection cancelled successfully for request:', requestId);

    res.status(200).json({
      success: true,
      message: 'Winner selection cancelled successfully'
    });

  } catch (error) {
    console.error('[Cancel Winner] Error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};