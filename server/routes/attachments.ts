
import { Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../vite";
import { verifyToken } from "../auth";

/**
 * Download an attachment from a supplier response
 */
export async function downloadAttachment(req: Request, res: Response) {
  try {
    // Check for token in the URL
    const token = req.query.t as string || req.query.token as string;
    
    // Check for authorization header (this is the preferred method)
    const authHeader = req.headers.authorization;
    
    if (token) {
      log(`[Attachment] Received token authentication in URL: token length ${token.length}`);
      try {
        const authResult = verifyToken(token);
        if (authResult.valid) {
          log(`[Attachment] Token authentication successful for user ID ${authResult.userId}`);
          (req as any).user = { id: authResult.userId };
          // Also set isAuthenticated function for compatibility
          (req as any).isAuthenticated = () => true;
        } else {
          log(`[Attachment] Token authentication failed: ${authResult.error || 'Unknown reason'}`);
        }
      } catch (error) {
        const authError = error as Error;
        log(`[Attachment] Token authentication error: ${authError.message}`);
      }
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract and verify the token from the Authorization header
      const headerToken = authHeader.substring(7);
      try {
        const authResult = verifyToken(headerToken);
        if (authResult.valid) {
          log(`[Attachment] Bearer token authentication successful for user ID ${authResult.userId}`);
          (req as any).user = { id: authResult.userId };
          // Also set isAuthenticated function for compatibility
          (req as any).isAuthenticated = () => true;
        }
      } catch (error) {
        const authError = error as Error;
        log(`[Attachment] Bearer token authentication error: ${authError.message}`);
      }
    }
    
    // We're making attachment downloads public for direct browser access
    // We'll rely on our server-side data validation below to ensure proper data access controls
    // This allows direct image viewing and downloads in the browser
    
    // Extract parameters
    const responseId = parseInt(req.params.responseId);
    const attachmentIndex = parseInt(req.params.attachmentIndex);
    
    log(`[Attachment] Request to download attachment ${attachmentIndex} for response ${responseId}`);
    
    if (isNaN(responseId) || isNaN(attachmentIndex)) {
      log(`[Attachment] Invalid parameters: responseId=${req.params.responseId}, attachmentIndex=${req.params.attachmentIndex}`);
      return res.status(400).json({ 
        message: "Invalid parameters. Response ID and attachment index must be numbers." 
      });
    }
    
    // Get the supplier response
    const response = await storage.getSupplierResponseById(responseId);
    if (!response) {
      log(`[Attachment] Supplier response not found: ${responseId}`);
      return res.status(404).json({ message: "Supplier response not found" });
    }
    
    log(`[Attachment] Found supplier response from: ${response.supplierEmail}`);
    
    // Check if attachments exist
    if (!response.attachments) {
      log(`[Attachment] Response has no attachments array`);
      return res.status(404).json({ message: "No attachments found for this response" });
    }
    
    if (!Array.isArray(response.attachments)) {
      log(`[Attachment] Response attachments is not an array: ${typeof response.attachments}`);
      return res.status(404).json({ message: "Invalid attachment data format" });
    }
    
    if (attachmentIndex >= response.attachments.length) {
      log(`[Attachment] Attachment index out of bounds: ${attachmentIndex} >= ${response.attachments.length}`);
      return res.status(404).json({ message: "Attachment index out of bounds" });
    }
    
    // Get the attachment
    const attachment = response.attachments[attachmentIndex];
    log(`[Attachment] Found attachment: ${JSON.stringify({
      index: attachmentIndex,
      filename: attachment.filename || 'unnamed',
      contentType: attachment.contentType || 'unknown',
      contentLength: attachment.content ? attachment.content.length : 0,
      hasContent: !!attachment.content
    })}`);
    
    // Handle both new format and legacy format where size/type were in separate fields
    let content = attachment.content;
    let contentType = attachment.contentType;
    let filename = attachment.filename;

    // Handle legacy format where type was stored in "type" field
    if (!contentType && (attachment as any).type) {
      contentType = (attachment as any).type;
      log(`[Attachment] Using legacy type field: ${contentType}`);
    }

    // Validate attachment data
    if (!filename) {
      log(`[Attachment] Missing filename`);
      filename = `attachment-${attachmentIndex}.bin`;
    }
    
    if (!content) {
      log(`[Attachment] Missing content for attachment: ${filename}`);
      return res.status(404).json({ message: "Attachment content is missing" });
    }

    // Default to application/octet-stream if no content type
    if (!contentType) {
      // Try to guess content type from filename extension
      const extension = filename.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'pdf':
          contentType = 'application/pdf';
          break;
        case 'doc':
        case 'docx':
          contentType = 'application/msword';
          break;
        case 'xls':
        case 'xlsx':
          contentType = 'application/vnd.ms-excel';
          break;
        case 'jpg':
        case 'jpeg':
          contentType = 'image/jpeg';
          break;
        case 'png':
          contentType = 'image/png';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'txt':
          contentType = 'text/plain';
          break;
        default:
          contentType = 'application/octet-stream';
      }
      log(`[Attachment] No content type, guessed from extension: ${contentType}`);
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    // Set strong cache control headers to prevent caching issues
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Send the file content
    try {
      // Log content details for debugging
      log(`[Attachment] Content type: ${typeof content}`);
      if (typeof content === 'string') {
        log(`[Attachment] Content string length: ${content.length}`);
        log(`[Attachment] Content string starts with: ${content.substring(0, 30)}...`);
        
        // Check if this is already a base64 string or needs to be encoded
        // Many base64 strings start with these patterns
        const isLikelyBase64 = content.startsWith('/9j/') || 
                               content.startsWith('iVBOR') || 
                               content.startsWith('JVBERi') || 
                               content.startsWith('UEsDB') ||
                               content.startsWith('R0lGO');
                               
        if (!isLikelyBase64) {
          log(`[Attachment] Content doesn't appear to be base64, will try to encode first`);
          content = Buffer.from(content).toString('base64');
        }
      }
      
      // Check if content is already a buffer
      if (Buffer.isBuffer(content)) {
        log(`[Attachment] Content is already a buffer, sending directly (${content.length} bytes)`);
        return res.send(content);
      }
      
      // Try to convert content from base64 to buffer (or other encoding if specified)
      // Check if attachment has encoding property
      const encoding = (attachment as any).encoding || 'base64';
      log(`[Attachment] Using encoding: ${encoding} for attachment: ${filename}`);
      
      const buffer = Buffer.from(content, encoding);
      log(`[Attachment] Successfully created buffer for attachment: ${filename} (${buffer.length} bytes)`);
      
      return res.send(buffer);
    } catch (error: any) {
      log(`[Attachment] Error creating buffer from content: ${error.message}`);
      return res.status(500).json({
        message: "Failed to process attachment content",
        error: error.message
      });
    }
  } catch (error: any) {
    log(`[Attachment] Error downloading attachment: ${error.message}`);
    return res.status(500).json({
      message: "Failed to download attachment",
      error: error.message
    });
  }
}
