import express from 'express';
import { storage } from '../storage';
import { authMiddleware } from '../auth';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';
import { Request, Response } from 'express';

// ES modules workaround for requiring CommonJS modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const apiAttachmentBridge = require('../file-processing/api_bridge.cjs');

const router = express.Router();

// Routes that require authentication will use this middleware
// Note: The downloadSupplierAttachment function doesn't use this middleware since
// it's defined separately and will be accessed directly from the main router

/**
 * Analyze attachments from a supplier response
 */
router.post('/api/supplier-responses/:responseId/analyze-attachments', async (req, res) => {
  try {
    const responseId = parseInt(req.params.responseId);
    const forceAnalysis = req.body?.force === true; // Check if force flag is set
    
    if (isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid response ID' });
    }
    
    console.log(`Analyzing attachments for response ${responseId} (force=${forceAnalysis})`);
    
    // Get full response data with message content and attachments
    const response = await storage.getSupplierResponseWithMessage(responseId);
    
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }
    
    // Check if response has attachments
    if (!response.attachments || response.attachments.length === 0) {
      return res.status(400).json({ 
        error: 'No attachments found',
        message: 'This supplier response does not contain any attachments to analyze.'
      });
    }
    
    // Check if we already have extracted text and force isn't set
    let hasExtractedText = false;
    if (!forceAnalysis) {
      hasExtractedText = response.attachments.some((att: any) => 
        att.extractedText && att.extractedText.length > 100
      );
      
      if (hasExtractedText) {
        console.log(`Response ${responseId} already has extracted text. Use force=true to re-analyze.`);
        return res.json({
          message: 'Attachments already analyzed. Use force=true to re-analyze.',
          already_analyzed: true,
          attachments_count: response.attachments.length,
          has_extracted_text: true
        });
      }
    }
    
    console.log(`Processing ${response.attachments.length} attachments for response ${responseId}`);
    
    // Process attachments with the Python analyzer
    const result = await apiAttachmentBridge.analyzeSupplierResponseAttachments(response);
    
    // Debug the result
    console.log(`Analysis result received for response ${responseId}:`);
    
    // Handle the different result structures from the Python analyzer
    // First check for processed_attachments directly (backwards compatibility)
    // Then check for the newer structure with extracted_content.attachments 
    const processedAttachments = result.processed_attachments || 
                               (result.extracted_content && result.extracted_content.attachments) || 
                               [];
    
    console.log(`- Processed attachments: ${processedAttachments.length}`);
    if (processedAttachments.length > 0) {
      processedAttachments.forEach((att: { 
        filename: string; 
        extracted_text?: string; 
        error?: boolean; 
        error_message?: string; 
      }, i: number) => {
        console.log(`  - Attachment ${i+1}: ${att.filename}`);
        console.log(`    Extracted text: ${att.extracted_text ? `${att.extracted_text.length} chars` : 'None'}`);
        if (att.extracted_text) {
          console.log(`    Text sample: ${att.extracted_text.substring(0, 100)}...`);
        }
        console.log(`    Error: ${att.error ? att.error_message : 'None'}`);
      });
    }
    
    // If processed attachments are available, update the response to store extracted text
    if (processedAttachments.length > 0) {
      console.log(`Found ${processedAttachments.length} processed attachments to update`);
      
      // Create a copy of the attachments array to avoid direct mutation
      const updatedAttachments = JSON.parse(JSON.stringify(response.attachments));
      let attachmentsUpdated = false;
      
      // Update each attachment with extracted text
      for (let i = 0; i < updatedAttachments.length; i++) {
        if (i < processedAttachments.length) {
          const processedAttachment = processedAttachments[i];
          
          // Update the attachment with extracted text (if available and non-empty)
          if (processedAttachment.extracted_text && processedAttachment.extracted_text.trim().length > 0) {
            console.log(`Attachment ${i+1} (${updatedAttachments[i].filename}): Found ${processedAttachment.extracted_text.length} chars of text`);
            updatedAttachments[i].extractedText = processedAttachment.extracted_text;
            attachmentsUpdated = true;
          } else {
            console.log(`Attachment ${i+1} (${updatedAttachments[i].filename}): No text extracted`);
          }
        }
      }
      
      // If attachments were updated, save the changes to the database
      if (attachmentsUpdated) {
        try {
          console.log(`🔄 Updating supplier response ${response.id} with extracted text in attachments`);
          
          // Debug what we're saving
          console.log(`Saving updated attachments: ${updatedAttachments.length} items`);
          updatedAttachments.forEach((att: { 
            filename: string; 
            extractedText?: string; 
          }, i: number) => {
            console.log(`  - Attachment ${i+1}: ${att.filename}`);
            console.log(`    Text extracted: ${att.extractedText ? `${att.extractedText.length} chars` : 'None'}`);
          });
          
          // Update in database
          await storage.updateSupplierResponse(response.id, {
            attachments: updatedAttachments
          });
          
          console.log(`✅ Successfully updated supplier response ${response.id} with extracted text in attachments`);
          
          // Add success information to the result
          result.attachments_updated = true;
          result.attachments_updated_count = updatedAttachments.filter((a: { extractedText?: string }) => a.extractedText).length;
        } catch (dbError: any) {
          console.error(`❌ Error updating supplier response ${response.id} with extracted text:`, dbError);
          console.error(dbError);
          result.error = true;
          result.error_message = dbError.message || 'Error updating attachments in database';
        }
      } else {
        console.log(`No attachments needed updating for response ${responseId}`);
      }
    }
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error analyzing attachments:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze attachments',
      message: error.message || 'Unknown error'
    });
  }
});

/**
 * Get previously analyzed attachment data for a response
 */
router.get('/api/supplier-responses/:responseId/attachment-analysis', async (req, res) => {
  try {
    const responseId = parseInt(req.params.responseId);
    
    if (isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid response ID' });
    }
    
    // Get analysis results
    const analysisResult = await apiAttachmentBridge.getAnalysisResult(responseId);
    
    if (!analysisResult) {
      return res.status(404).json({ 
        error: 'Analysis not found',
        message: 'No attachment analysis found for this response. Try analyzing attachments first.'
      });
    }
    
    return res.json(analysisResult);
  } catch (error: any) {
    console.error('Error retrieving attachment analysis:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve attachment analysis',
      message: error.message || 'Unknown error'
    });
  }
});

/**
 * Analyze attachments from multiple supplier responses in a batch
 */
router.post('/api/search-requests/:requestId/analyze-attachments', async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Optionally filter by specific response IDs if provided
    const responseIds = req.body.responseIds as number[] || [];
    
    // Get all supplier responses for this request with full message content
    let responses = await storage.getSupplierResponsesWithMessages(requestId);
    
    // Filter responses if specific IDs were provided
    if (responseIds.length > 0) {
      responses = responses.filter((response: any) => responseIds.includes(response.id));
    }
    
    // Filter out responses without attachments
    const responsesWithAttachments = responses.filter(
      (response: any) => response.attachments && response.attachments.length > 0
    );
    
    if (responsesWithAttachments.length === 0) {
      return res.status(400).json({ 
        error: 'No attachments found',
        message: 'None of the selected responses contain attachments to analyze.' 
      });
    }
    
    // Process all attachments in batch
    const result = await apiAttachmentBridge.analyzeBatchResponses(responsesWithAttachments);
    
    // Process and save individual response updates if available
    if (result.responses && Array.isArray(result.responses)) {
      const updatedResponses = [];
      
      // Process each response
      for (const processedResponse of result.responses) {
        // Extract attachments from either direct processed_attachments field
        // or from the new structure with extracted_content.attachments
        const processedAttachments = processedResponse.processed_attachments || 
                                   (processedResponse.extracted_content && processedResponse.extracted_content.attachments);
        
        if (!processedResponse.id || !processedAttachments || !Array.isArray(processedAttachments)) {
          console.log(`Skipping response ${processedResponse.id}: No processed attachments found`);
          continue;
        }
        
        // Find the original response
        const originalResponse = responsesWithAttachments.find(r => r.id === processedResponse.id);
        if (!originalResponse || !originalResponse.attachments) {
          console.log(`Skipping response ${processedResponse.id}: Original response not found or has no attachments`);
          continue;
        }
        
        // Create copy of attachments for update
        const updatedAttachments = [...originalResponse.attachments];
        let attachmentsUpdated = false;
        
        // Update each attachment with extracted text
        processedAttachments.forEach((processedAttachment: any, index: number) => {
          if (index < updatedAttachments.length && processedAttachment.extracted_text) {
            console.log(`Response ${processedResponse.id}, Attachment ${index+1}: Found ${processedAttachment.extracted_text.length} chars of text`);
            updatedAttachments[index].extractedText = processedAttachment.extracted_text;
            attachmentsUpdated = true;
          }
        });
        
        // Save updates to database if needed
        if (attachmentsUpdated) {
          try {
            await storage.updateSupplierResponse(originalResponse.id, {
              attachments: updatedAttachments
            });
            
            console.log(`✅ Updated attachments for response ${originalResponse.id}`);
            updatedResponses.push(originalResponse.id);
          } catch (error) {
            console.error(`Error updating attachments for response ${originalResponse.id}:`, error);
          }
        }
      }
      
      // Add update info to result
      result.updated_responses = updatedResponses;
    }
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error analyzing batch of attachments:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze attachments',
      message: error.message || 'Unknown error'
    });
  }
});

// Handle download of supplier attachments
export async function downloadSupplierAttachment(req: Request, res: Response) {
  try {
    // Skip authentication for attachment downloads to allow direct access
    const { requestId, responseId, filename } = req.params;
    
    // First try to get attachment from the database
    const response = await storage.getSupplierResponseById(parseInt(responseId));
    if (!response) {
      return res.status(404).send('Supplier response not found');
    }
    
    // Find the attachment in the response
    const attachment = Array.isArray(response.attachments) 
      ? response.attachments.find((a: any) => a.filename === filename)
      : null;
      
    if (attachment && attachment.content) {
      // Set content disposition and type
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
      
      // If content is base64 encoded, decode it
      const buffer = Buffer.from(attachment.content, 'base64');
      return res.send(buffer);
    }
    
    // If not found in the database, try the filesystem as fallback
    const filePath = path.join(__dirname, '../../attachments', filename);
    
    // Check if file exists in filesystem
    if (fs.existsSync(filePath)) {
      return res.download(filePath);
    }
    
    // Attachment not found in database or filesystem
    res.status(404).send('Attachment not found');
  } catch (error: any) {
    console.error('Error downloading attachment:', error);
    res.status(500).send('Error downloading attachment: ' + (error.message || 'Unknown error'));
  }
}

export default router;