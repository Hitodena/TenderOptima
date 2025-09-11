// Advanced parameter extraction services with multiple response support

import type { SupplierResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

/**
 * Start parameter extraction process for a specific response
 * Теперь принимает параметры как аргумент вместо загрузки их каждый раз
 */
const startParameterExtraction = async (
  responseId: number, 
  requestId: number, 
  parameters: string[] // Принимаем параметры как аргумент
) => {
  try {
    console.log(`Starting parameter extraction for response ${responseId}, request ${requestId}`);
    
    // Проверяем, что у нас есть параметры
    if (!parameters || parameters.length === 0) {
      console.log('No parameters provided, skipping parameter extraction');
      return;
    }
    
    // Check if parameters are already extracted
    console.log('Checking for existing parameters for response', responseId);
    try {
      const existingParams = await apiRequest(`/api/parameters/extracted/${responseId}`, 'GET');
      if (existingParams && Object.keys(existingParams.parameters || {}).length > 0) {
        console.log('Valid parameters found for response:', responseId);
        console.log('Parameters received for display:', existingParams.parameters);
        return { success: true, message: 'Parameters already extracted', parameters: existingParams.parameters };
      }
    } catch (error) {
      // No existing parameters, continue with extraction
    }
    
    // Extract parameters through API
    const extractionResponse = await apiRequest('/api/extract-parameters', 'POST', {
      responseId,
      requestId,
      parameters,
      useAI: true
    });
    
    return { 
      success: true, 
      message: 'Parameter extraction started',
      parameters: extractionResponse?.parameters || []
    };
  } catch (error) {
    console.error('Error starting parameter extraction:', error);
    // Check if it's a "Response not found" error and handle it gracefully
    if (error.message?.includes('Response with ID') && error.message?.includes('not found')) {
      console.log(`Response ${responseId} no longer exists, skipping parameter extraction`);
      return { success: true, message: 'Response not found, skipping extraction' };
    }
    return { success: false, error: 'Failed to start parameter extraction' };
  }
};

/**
 * Check the status of a parameter extraction process
 */
const checkExtractionStatus = async (responseId: number) => {
  try {
    // Check extraction status through API
    console.log(`Checking extraction status for response ${responseId}`);
    
    // Check if parameters exist
    try {
      const existingParams = await apiRequest(`/api/parameters/extracted/${responseId}`, 'GET');
      if (existingParams && Object.keys(existingParams.parameters || {}).length > 0) {
        return { status: 'completed', progress: 100 };
      }
    } catch (error) {
      // No existing parameters, status is likely still processing
      return { status: 'processing', progress: 50 };
    }
    
    return { status: 'pending', progress: 0 };
  } catch (error) {
    console.error('Error checking extraction status:', error);
    return { status: 'error', error: 'Failed to check extraction status' };
  }
};

/**
 * Extract parameters in background for multiple responses
 * Теперь принимает параметры как аргумент
 */
const extractParametersInBackground = async (
  requestId: number, 
  responses: SupplierResponse[],
  parameters: string[], // Принимаем параметры как аргумент
  progressCallback?: (completed: number, total: number) => void
) => {
  console.log(`Starting background parameter extraction for ${responses.length} responses in request ${requestId}`);
  console.log(`Using cached parameters:`, parameters);
  
  let completed = 0;
  const total = responses.length;
  
  // Process responses sequentially to avoid overloading the server
  for (const response of responses) {
    try {
      await startParameterExtraction(response.id, requestId, parameters);
      completed++;
      
      if (progressCallback) {
        progressCallback(completed, total);
      }
    } catch (error) {
      console.error(`Error extracting parameters for response ${response.id}:`, error);
    }
  }
  
  return { success: true, message: `Completed parameter extraction for ${completed}/${total} responses` };
};

// Export all necessary functions
export {
  startParameterExtraction,
  checkExtractionStatus,
  extractParametersInBackground
};

// Default export for ES modules
export default {
  startParameterExtraction,
  checkExtractionStatus,
  extractParametersInBackground
};