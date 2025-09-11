import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { 
  requestParameters, 
  insertRequestParameterSchema, 
  extractedParameters, 
  InsertExtractedParameter 
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';

export const parameterRoutes = Router();

// Get parameters for a specific request
parameterRoutes.get('/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Get existing parameters for this request using storage method
    let params = await storage.getParametersForRequest(requestId);
    
    // If no parameters found for this request, look for parameters in related requests with same order number
    if (!params) {
      try {
        console.log(`[Parameters API] No parameters found for request ${requestId}, searching related requests`);
        
        // Get the order number for this request
        const currentRequest = await storage.getSearchRequest(requestId);
        if (currentRequest && currentRequest.orderNumber) {
          console.log(`[Parameters API] Found order number ${currentRequest.orderNumber}, searching for related requests with parameters`);
          
          // Find all requests with the same order number
          const allRequests = await storage.getAllSearchRequests();
          const relatedRequests = allRequests.filter(req => 
            req.orderNumber === currentRequest.orderNumber && req.id !== requestId
          );
          
          // Look for parameters in related requests
          for (const relatedRequest of relatedRequests) {
            const relatedParams = await storage.getParametersForRequest(relatedRequest.id);
            if (relatedParams && relatedParams.parameters && relatedParams.parameters.length > 0) {
              console.log(`[Parameters API] Found parameters in related request ${relatedRequest.id}:`, relatedParams.parameters);
              params = relatedParams;
              break;
            }
          }
        }
      } catch (error) {
        console.warn(`[Parameters API] Error searching for related request parameters:`, error);
      }
    }
    
    if (!params) {
      return res.status(404).json({ 
        error: 'No parameters found for this request',
        parameters: []
      });
    }
    
    return res.status(200).json({
      parameters: params.parameters,
      requestId: params.requestId
    });
  } catch (error) {
    console.error('Error getting parameters:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Save parameters for a request
parameterRoutes.post('/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Get parameters from request body
    const { parameters } = req.body;
    
    if (!parameters || !Array.isArray(parameters)) {
      return res.status(400).json({ error: 'Parameters must be an array' });
    }
    
    // Get the user ID from the authenticated request
    const userId = req.user && (req.user as any).id ? (req.user as any).id : null;
    
    console.log(`Saving request parameters with userId=${userId} for request ID ${requestId}`);
    
    // Save parameters using storage method - pass userId for proper multi-tenant isolation
    const savedParams = await storage.saveParametersForRequest(requestId, parameters, userId);
    
    return res.status(200).json({
      success: true,
      message: 'Parameters saved successfully',
      data: {
        id: savedParams.id,
        requestId: savedParams.requestId,
        parameters: savedParams.parameters,
        createdAt: savedParams.createdAt,
        updatedAt: savedParams.updatedAt
      }
    });
  } catch (error) {
    console.error('Error saving parameters:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete parameters for a request
parameterRoutes.delete('/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Use the new deleteParametersForRequest method in storage
    const deleted = await storage.deleteParametersForRequest(requestId);
    
    if (!deleted) {
      console.log(`No parameters found to delete for request ID ${requestId}`);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Parameters deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting parameters:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get analyzed parameters by response ID (with multi-tenant isolation)
parameterRoutes.get('/extracted/:responseId', requireAuth, async (req: Request, res: Response) => {
  try {
    const responseId = parseInt(req.params.responseId);
    
    if (isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid response ID' });
    }
    
    // Get the user ID from the authenticated request for multi-tenant isolation
    const userId = req.user && (req.user as any).id ? (req.user as any).id : null;
    
    console.log(`Getting extracted parameters for responseId=${responseId}, userId=${userId}`);
    
    // Pass userId to ensure proper multi-tenant isolation
    const params = await storage.getExtractedParametersByResponseId(responseId, userId);
    
    if (!params) {
      return res.status(404).json({ 
        error: 'No extracted parameters found for this response',
        message: 'Parameters have not been extracted yet'
      });
    }
    
    return res.status(200).json({
      parameters: params.parameters,
      responseId: params.responseId,
      requestId: params.requestId,
      supplierEmail: params.supplierEmail,
      extractionDate: params.extractionDate,
      status: params.status
    });
  } catch (error) {
    console.error('Error getting extracted parameters:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get parameter list for a request (returns array of parameter names)
parameterRoutes.get('/request/:requestId/list', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Get existing parameters for this request using storage method
    let params = await storage.getParametersForRequest(requestId);
    
    // If no parameters found for this request, look for parameters in related requests with same order number
    if (!params) {
      try {
        console.log(`[Parameters List API] No parameters found for request ${requestId}, searching related requests`);
        
        // Get the order number for this request
        const currentRequest = await storage.getSearchRequest(requestId);
        if (currentRequest && currentRequest.orderNumber) {
          console.log(`[Parameters List API] Found order number ${currentRequest.orderNumber}, searching for related requests with parameters`);
          
          // Find all requests with the same order number
          const allRequests = await storage.getAllSearchRequests();
          const relatedRequests = allRequests.filter(req => 
            req.orderNumber === currentRequest.orderNumber && req.id !== requestId
          );
          
          // Look for parameters in related requests
          for (const relatedRequest of relatedRequests) {
            const relatedParams = await storage.getParametersForRequest(relatedRequest.id);
            if (relatedParams && relatedParams.parameters && relatedParams.parameters.length > 0) {
              console.log(`[Parameters List API] Found parameters in related request ${relatedRequest.id}:`, relatedParams.parameters);
              params = relatedParams;
              break;
            }
          }
        }
      } catch (error) {
        console.warn(`[Parameters List API] Error searching for related request parameters:`, error);
      }
    }
    
    if (!params || !params.parameters || !Array.isArray(params.parameters)) {
      return res.status(200).json([]); // Return empty array if no parameters
    }
    
    // Return just the parameter names as an array
    return res.status(200).json(params.parameters);
  } catch (error) {
    console.error('Error getting parameter list:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all extracted parameters for a request (with multi-tenant isolation)
parameterRoutes.get('/request-extracted/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Get the user ID from the authenticated request for multi-tenant isolation
    const userId = req.user && (req.user as any).id ? (req.user as any).id : null;
    
    console.log(`Getting extracted parameters for requestId=${requestId}, userId=${userId}`);
    
    // Pass userId to ensure proper multi-tenant isolation
    const params = await storage.getExtractedParametersByRequestId(requestId, userId);
    
    if (params.length === 0) {
      return res.status(404).json({ 
        error: 'No extracted parameters found for this request',
        message: 'No parameters have been extracted yet'
      });
    }
    
    return res.status(200).json({
      count: params.length,
      parameters: params
    });
  } catch (error) {
    console.error('Error getting extracted parameters:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get extracted parameters by supplier email for a request
parameterRoutes.get('/extracted-by-email/:requestId/:email', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const email = req.params.email;
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get the user ID from the authenticated request
    const userId = req.user && (req.user as any).id ? (req.user as any).id : null;
    
    console.log(`Getting extracted parameters for requestId=${requestId}, email=${email}, userId=${userId}`);
    
    // Pass userId to ensure proper multi-tenant isolation
    const params = await storage.getExtractedParametersByEmail(requestId, email, userId);
    
    if (!params) {
      return res.status(404).json({ 
        error: 'No extracted parameters found for this supplier',
        message: 'Parameters have not been extracted for this supplier'
      });
    }
    
    return res.status(200).json({
      parameters: params.parameters,
      responseId: params.responseId,
      requestId: params.requestId,
      supplierEmail: params.supplierEmail,
      extractionDate: params.extractionDate,
      status: params.status
    });
  } catch (error) {
    console.error('Error getting extracted parameters:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Save extracted parameters for a response
parameterRoutes.post('/extract/:responseId/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const responseId = parseInt(req.params.responseId);
    const requestId = parseInt(req.params.requestId);
    
    if (isNaN(responseId) || isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid ID values' });
    }
    
    const { parameters, supplierEmail, status, errorMessage } = req.body;
    
    if (!parameters || typeof parameters !== 'object') {
      return res.status(400).json({ error: 'Parameters must be a valid object' });
    }
    
    if (!supplierEmail) {
      return res.status(400).json({ error: 'Supplier email is required' });
    }
    
    // Get the user ID from the authenticated request for multi-tenant isolation
    const userId = req.user && (req.user as any).id ? (req.user as any).id : null;
    
    console.log(`Saving extracted parameters for responseId=${responseId}, requestId=${requestId}, supplierEmail=${supplierEmail}, userId=${userId}`);
    
    const parameterData: InsertExtractedParameter = {
      responseId,
      requestId,
      supplierEmail,
      parameters,
      status: status || 'completed',
      errorMessage,
      userId // Add user ID to ensure proper multi-tenant isolation
    };
    
    const savedParams = await storage.saveExtractedParameters(parameterData);
    
    return res.status(200).json({
      success: true,
      message: 'Parameters extracted and saved successfully',
      data: savedParams
    });
  } catch (error) {
    console.error('Error saving extracted parameters:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update extracted parameters for inline editing
parameterRoutes.post('/extracted/:responseId/update', requireAuth, async (req: Request, res: Response) => {
  try {
    const responseId = parseInt(req.params.responseId);
    const { parameters } = req.body;
    
    if (isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid response ID' });
    }
    
    if (!parameters || typeof parameters !== 'object') {
      return res.status(400).json({ error: 'Parameters object is required' });
    }
    
    // Get the user ID from the authenticated request for multi-tenant isolation
    const userId = req.user && (req.user as any).id ? (req.user as any).id : null;
    
    console.log(`Updating extracted parameters for responseId=${responseId}, userId=${userId}`);
    
    // First, get the existing parameters to ensure they exist
    const existingParams = await storage.getExtractedParametersByResponseId(responseId, userId);
    
    if (!existingParams) {
      return res.status(404).json({ 
        error: 'No extracted parameters found for this response',
        message: 'Cannot update parameters that do not exist'
      });
    }
    
    // Update the parameters using storage method
    const success = await storage.updateExtractedParameters(responseId, userId, parameters);
    
    if (!success) {
      return res.status(500).json({ 
        error: 'Failed to update parameters',
        message: 'Database update failed'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Parameters updated successfully',
      parameters: parameters,
      responseId: responseId
    });
    
  } catch (error) {
    console.error('Error updating extracted parameters:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});