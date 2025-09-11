import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { storage } from '../storage';
import { tokenAuthMiddleware } from '../auth';

// Custom middleware to ensure a user is authenticated before accessing attachments
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Apply the token auth middleware first
  tokenAuthMiddleware(req, res, () => {
    // After token auth, check if the user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      console.log('[supplier-message-attachments] Authentication required but user not authenticated');
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // User is authenticated, proceed
    console.log('[supplier-message-attachments] User authenticated, proceeding to download');
    next();
  });
}

interface MessageAttachment {
  filename: string;
  contentType: string;
  content: string | Buffer;
  encoding?: string;
  size?: number;
}

interface SupplierMessage {
  id: number;
  requestSupplierId: number;
  content: string;
  subject?: string;
  direction: string;
  sentDate: Date;
  attachments: MessageAttachment[];
}

/**
 * Handler for downloading attachments from supplier messages
 */
export async function downloadSupplierMessageAttachment(req: Request, res: Response) {
  try {
    const messageId = parseInt(req.params.messageId);
    const attachmentIndex = parseInt(req.params.attachmentIndex);

    if (isNaN(messageId) || isNaN(attachmentIndex)) {
      return res.status(400).json({ message: 'Invalid message ID or attachment index' });
    }

    // Get the message from database
    console.log(`[supplier-message-attachments] Retrieving message ID: ${messageId}, attachment index: ${attachmentIndex}`);
    const message = await storage.getSupplierMessageById(messageId);
    
    if (!message) {
      console.log(`[supplier-message-attachments] Message with ID ${messageId} not found`);
      return res.status(404).json({ message: 'Message not found' });
    }

    // Cast to our expected type to help TypeScript
    const typedMessage = message as SupplierMessage;

    console.log(`[supplier-message-attachments] Found message:`, {
      id: typedMessage.id,
      requestSupplierId: typedMessage.requestSupplierId,
      direction: typedMessage.direction,
      sentDate: typedMessage.sentDate,
      hasAttachments: typedMessage.attachments && Array.isArray(typedMessage.attachments),
      attachmentCount: typedMessage.attachments && Array.isArray(typedMessage.attachments) ? typedMessage.attachments.length : 0
    });

    // Check if the message has attachments
    if (!typedMessage.attachments || !Array.isArray(typedMessage.attachments)) {
      console.log(`[supplier-message-attachments] Message has no attachments array`);
      return res.status(404).json({ message: 'Message has no attachments' });
    }
    
    if (attachmentIndex >= typedMessage.attachments.length) {
      console.log(`[supplier-message-attachments] Attachment index ${attachmentIndex} is out of bounds (total: ${typedMessage.attachments.length})`);
      return res.status(404).json({ message: 'Attachment index out of bounds' });
    }

    const attachment = typedMessage.attachments[attachmentIndex];
    
    // Create safe content length display
    let contentLength = 'Unknown';
    if (attachment.content) {
      if (typeof attachment.content === 'string') {
        contentLength = attachment.content.length.toString();
      } else if (Buffer.isBuffer(attachment.content)) {
        contentLength = `${attachment.content.length} bytes (Buffer)`;
      } else {
        contentLength = typeof attachment.content;
      }
    }
    
    console.log(`[supplier-message-attachments] Attachment details:`, {
      filename: attachment.filename,
      contentType: attachment.contentType,
      hasContent: !!attachment.content,
      contentLength: contentLength,
      encoding: attachment.encoding || 'unknown'
    });

    // Set headers for file download
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename || `file-${attachmentIndex}.bin`)}"`);
    
    // Set cache control to prevent caching issues
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // If we have content, process and send it
    if (attachment.content) {
      try {
        // Detect and handle different content formats
        if (Buffer.isBuffer(attachment.content)) {
          // Content is already a buffer, send directly
          console.log(`[supplier-message-attachments] Content is a buffer, sending directly (${attachment.content.length} bytes)`);
          return res.send(attachment.content);
        } 
        
        if (typeof attachment.content === 'string') {
          const encoding = attachment.encoding || 'base64';
          
          // Better detection of base64 content - check if it's a valid base64 string
          // Valid base64 strings have length that is a multiple of 4 and only contain valid chars
          const isValidBase64 = (str: string): boolean => {
            if (str.length % 4 !== 0) return false;
            return /^[A-Za-z0-9+/=]+$/.test(str);
          };
          
          // Special case for text files - if content type is text, send as plain text
          if (attachment.contentType && (
            attachment.contentType.includes('text/') || 
            attachment.contentType.includes('application/json') ||
            attachment.contentType.includes('xml'))) {
            
            // If it's clearly base64 encoded text, decode it first
            if (isValidBase64(attachment.content) && !attachment.content.includes('\n')) {
              try {
                const textContent = Buffer.from(attachment.content, 'base64').toString('utf-8');
                console.log(`[supplier-message-attachments] Decoded base64 text content (${textContent.length} chars)`);
                return res.send(textContent);
              } catch (error) {
                // If decoding fails, send as-is
                console.log(`[supplier-message-attachments] Failed to decode base64 text, sending as-is`);
                return res.send(attachment.content);
              }
            } else {
              // Not base64, send as-is
              console.log(`[supplier-message-attachments] Content is plain text (${attachment.content.length} chars)`);
              return res.send(attachment.content);
            }
          }
          
          // For binary files, always try to decode from base64
          try {
            // Print the first few characters for debugging
            const previewLength = Math.min(50, attachment.content.length);
            console.log(`[supplier-message-attachments] Content preview (first ${previewLength} chars): ${attachment.content.substring(0, previewLength)}`);
            
            // Enhanced base64 handling
            const isValidBase64 = (str: string): boolean => {
              if (str.length % 4 !== 0) return false;
              return /^[A-Za-z0-9+/=]+$/.test(str);
            };
            
            // Try to handle the content based on what we have
            if (isValidBase64(attachment.content)) {
              // Content is valid base64, decode and send
              console.log(`[supplier-message-attachments] Content is valid base64, decoding (${attachment.content.length} chars)`);
              const buffer = Buffer.from(attachment.content, 'base64');
              return res.send(buffer);
            } else if (attachment.content.includes('data:') && attachment.content.includes('base64,')) {
              // Handle data URLs (common in modern browsers)
              console.log(`[supplier-message-attachments] Content appears to be a data URL, extracting base64 portion`);
              const base64Data = attachment.content.split('base64,')[1];
              if (base64Data) {
                const buffer = Buffer.from(base64Data, 'base64');
                return res.send(buffer);
              }
            }
             
            // Try to fix common base64 issues
            console.log(`[supplier-message-attachments] Attempting to fix and decode base64 content`);
            
            // 1. Remove non-base64 characters
            const cleanedContent = attachment.content.replace(/[^A-Za-z0-9+/=]/g, '');
            
            // 2. Fix padding if needed
            const paddedContent = cleanedContent + '='.repeat((4 - cleanedContent.length % 4) % 4);
            
            if (paddedContent !== attachment.content && isValidBase64(paddedContent)) {
              console.log(`[supplier-message-attachments] Fixed base64 content (${paddedContent.length} chars)`);
              const buffer = Buffer.from(paddedContent, 'base64');
              return res.send(buffer);
            } 
              
            // If all base64 decoding attempts fail, try sending as binary
            console.log(`[supplier-message-attachments] Unable to decode as base64, sending as raw binary`);
            return res.send(Buffer.from(attachment.content));
          } catch (encodeError) {
            console.error(`[supplier-message-attachments] Error decoding base64:`, encodeError);
            // If all base64 attempts fail, send as raw buffer
            return res.send(Buffer.from(attachment.content));
          }
        }
        
        // Handle object or other unexpected types by stringifying
        if (typeof attachment.content === 'object' && attachment.content !== null) {
          console.log(`[supplier-message-attachments] Content is an object, stringifying`);
          return res.send(JSON.stringify(attachment.content));
        }
        
        // Default case - try to convert to string and send
        console.log(`[supplier-message-attachments] Content is of unknown type: ${typeof attachment.content}, attempting conversion`);
        return res.send(String(attachment.content));
      } catch (error) {
        console.error(`[supplier-message-attachments] Error processing attachment content:`, error);
        return res.status(500).json({ 
          message: 'Error processing attachment content', 
          error: String(error)
        });
      }
    } else {
      console.log(`[supplier-message-attachments] Attachment content not found`);
      return res.status(404).json({ message: 'Attachment content not found' });
    }
  } catch (error) {
    console.error('Error downloading supplier message attachment:', error);
    return res.status(500).json({ 
      message: 'Failed to download attachment', 
      error: String(error) 
    });
  }
}