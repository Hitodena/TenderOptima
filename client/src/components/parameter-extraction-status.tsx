import { useEffect, useState, useRef } from "react";
import { getExtractedParameters, getRequestParameters, extractParameters } from "@/api/parameters";
import { extractParametersFromResponse } from "@/api/extract-parameters";
import { apiRequest } from "@/lib/queryClient";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Edit3, Check, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

interface ParameterExtractionStatusProps {
  requestId: number;
  responseId: number;
  supplierEmail: string;
  supplierName?: string;
  onParametersExtracted?: (parameters: any) => void;
  forceExtract?: boolean;
}

/**
 * Component that shows the extraction status of parameters for a response
 * This is used within the response panel to show when a response's parameters
 * are being analyzed or have been extracted
 */
export function ParameterExtractionStatus({
  requestId,
  responseId,
  supplierEmail,
  supplierName,
  onParametersExtracted,
  forceExtract = false
}: ParameterExtractionStatusProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'no-parameters' | 'connection-error' | 'extracting'>('idle');
  const [parameters, setParameters] = useState<any>(null);
  const [requestParametersList, setRequestParametersList] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const responseIdRef = useRef<number | null>(null);
  
  // State for inline editing
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // First, load the parameters that were selected for this request
  useEffect(() => {
    const loadRequestParameters = async () => {
      if (requestId) {
        try {
          const requestParams = await getRequestParameters(requestId);
          console.log('Loaded parameters for request', requestId, ':', requestParams);
          setRequestParametersList(requestParams);
        } catch (error) {
          console.error('Error loading request parameters:', error);
          console.log('Trying to load parameters from related requests for request', requestId);
          
          // Try to load parameters from related requests using the fixed API endpoint
          try {
            const response = await apiRequest(`/api/parameters/request/${requestId}/list`, 'GET');
            const responseData = response as { parameters?: string[] };
            if (responseData && responseData.parameters && responseData.parameters.length > 0) {
              console.log('Found parameters from related requests:', responseData.parameters);
              setRequestParametersList(responseData.parameters);
            } else {
              console.log('No parameters found in related requests either');
              setRequestParametersList([]);
            }
          } catch (relatedError) {
            console.error('Error loading parameters from related requests:', relatedError);
            setRequestParametersList([]);
          }
        }
      }
    };

    loadRequestParameters();
  }, [requestId]);

  // This effect runs when forceExtract changes to true
  useEffect(() => {
    if (forceExtract && responseId) {
      console.log('Force extract parameter triggered for response', responseId);
      handleRefresh();
    }
  }, [forceExtract, responseId]);

  // Check for existing extracted parameters when responseId changes
  // and automatically start extraction if no parameters found
  useEffect(() => {
    // Only run if the responseId changes and we're not already refreshing
    if (responseId === responseIdRef.current || isRefreshing) {
      return;
    }
    
    // Update the ref
    responseIdRef.current = responseId;
    
    // Only check if we have valid IDs
    if (!responseId || !requestId) {
      setParameters(null);
      setStatus('idle');
      return;
    }

    // Check if parameters exist in the database and automatically extract if needed
    const loadParametersFromDatabase = async () => {
      setStatus('loading');
      
      try {
        // Get the request parameters first
        if (requestParametersList.length === 0) {
          console.log('Loading request parameters for request', requestId);
          const requestParams = await getRequestParameters(requestId);
          
          if (requestParams && requestParams.length > 0) {
            setRequestParametersList(requestParams);
            console.log('Loaded parameters for request', requestId, ':', requestParams);
          } else {
            // No parameters were selected for this request
            console.log('No parameters were selected for request', requestId);
            setRequestParametersList([]);
          }
        }
        
        // Check if parameters already exist in the database
        console.log(`Checking for existing parameters for response ${responseId}`);
        const result = await getExtractedParameters(responseId);
        
        // Check if the response has status "no_parameters_found"
        if (result && typeof result === 'object' && 'status' in result && result.status === 'no_parameters_found') {
          console.log(`Response ${responseId} has status "no_parameters_found"`);
          setParameters({});
          setStatus('no-parameters');
          return;
        }
        
        // Only consider it successful if we have actual parameter values (not just "-")
        if (result && result.parameters) {
          const hasValidParameters = 
            Array.isArray(result.parameters) 
              ? result.parameters.some(p => p.value && p.value !== '-')
              : Object.values(result.parameters).some(v => v && v !== '-');
              
          if (hasValidParameters) {
            console.log('Valid parameters found for response:', responseId);
            console.log('Parameters received for display:', result.parameters);
            
            // Handle both object and array format of parameters
            if (Array.isArray(result.parameters)) {
              // Convert array format to object format for UI display
              const paramObj: Record<string, string> = {};
              result.parameters.forEach((param: any) => {
                paramObj[param.name] = param.value || '-';
              });
              setParameters(paramObj);
              console.log('Converted array parameters to object format:', paramObj);
              
              if (onParametersExtracted) {
                onParametersExtracted(paramObj);
              }
            } else {
              setParameters(result.parameters);
              
              if (onParametersExtracted) {
                onParametersExtracted(result.parameters);
              }
            }
            
            setStatus('success');
            return;
          }
        }
        
        // If no parameters found, automatically start extraction
        console.log(`No valid parameters found for response ${responseId}, starting extraction automatically`);
        setStatus('loading');
        tryExtractParameters();
      } catch (error) {
        console.error('Error loading parameters from database:', error);
        // Set status to idle so the user can manually trigger extraction
        setStatus('idle');
      }
    };
    
    loadParametersFromDatabase();
  }, [responseId, requestId, onParametersExtracted, isRefreshing]);

  // Handle case when no parameters were selected for this request
  if (requestParametersList.length === 0) {
    return (
      <div className="space-y-4 pointer-events-auto">
        <div className="flex items-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="mr-2 text-blue-500"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="text-sm text-blue-500 font-medium">Нет выбранных параметров</span>
        </div>
        
        <Card className="bg-blue-50/30 mt-2">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-sm text-center py-4">
              Для этого запроса не были выбраны параметры для сравнения
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Function to try extracting parameters using DeepSeek API
  const tryExtractParameters = async () => {
    if (!responseId || !requestId || requestParametersList.length === 0) {
      console.error('Cannot extract parameters: missing responseId, requestId, or parameters list');
      setErrorMessage('Не указаны параметры для извлечения');
      setStatus('error');
      setIsRefreshing(false);
      return;
    }

    try {
      setStatus('loading');
      console.log(`Extracting parameters for response ${responseId} using DeepSeek API`);
      
      // Step 1: First analyze attachments to extract text
      console.log('Analyzing attachments for response', responseId);
      try {
        // Using apiRequest instead of fetch to include auth token
        const attachmentResult = await apiRequest(
          'POST', 
          `/api/supplier-responses/${responseId}/analyze-attachments`, 
          { force: true }
        );
        console.log('Attachment analysis result:', attachmentResult);
      } catch (error) {
        console.warn('Attachment analysis error:', error);
        // Continue with extraction even if attachment analysis fails
      }
      
      // Step 2: Extract parameters using DeepSeek API
      console.log('Calling DeepSeek API for parameter extraction with:', {
        responseId,
        parameters: requestParametersList,
        useAI: true
      });
      
      // Use the extractParameters function from API
      const result = await extractParameters({
        responseId: responseId,
        parameters: requestParametersList, 
        useAI: true
      });
      
      console.log('Parameters extracted using DeepSeek API:', result);
      
      // Step 3: Process the extracted parameters
      if (result && result.parameters) {
        let extractedParams: Record<string, string> = {};
        
        // Handle array format from API response
        if (Array.isArray(result.parameters)) {
          // Get attachment-based parameters
          const attachmentParams: Record<string, any> = {};
          const messageParams: Record<string, any> = {};
          
          // First pass - separate parameters from attachments and message body
          result.parameters.forEach((param: any) => {
            if (param.source === 'attachment') {
              attachmentParams[param.name] = param;
            } else if (param.source === 'content') {
              messageParams[param.name] = param;
            }
          });
          
          // Second pass - prioritize attachment data, fallback to message body
          result.parameters.forEach((param: any) => {
            const name = param.name;
            
            // If attachment has the parameter, use it (priority 1)
            if (attachmentParams[name] && attachmentParams[name].value && attachmentParams[name].value !== '-') {
              extractedParams[name] = attachmentParams[name].value;
            } 
            // If not in attachment but in message body, use that (priority 2)
            else if (messageParams[name] && messageParams[name].value && messageParams[name].value !== '-') {
              extractedParams[name] = messageParams[name].value;
            }
            // Otherwise use empty placeholder
            else {
              extractedParams[name] = '-';
            }
          });
          
          console.log('Converted parameters from array to object format with priority handling:', extractedParams);
        } else {
          // Handle object format if that's what the API returns
          extractedParams = result.parameters;
        }
        
        // Filter parameters to only show those selected for this request
        const filteredParams: Record<string, string> = {};
        let hasAnyValidParameter = false;
        
        // Use only the parameters that were selected by the user for this request
        const parametersToShow = requestParametersList;
        
        // First ensure all selected parameters are initialized with defaults
        parametersToShow.forEach(key => {
          filteredParams[key] = '-';
        });
        
        // Then fill in any values we have, but only for selected parameters
        for (const [key, value] of Object.entries(extractedParams)) {
          if (parametersToShow.includes(key)) {
            if (value && value !== '-' && value !== 'null' && value !== 'undefined') {
              filteredParams[key] = value;
              hasAnyValidParameter = true;
            } else {
              // Keep the default '-' value
              filteredParams[key] = '-';
            }
          }
        }
        
        // Always set the parameters in the UI, regardless of whether they were found
        setParameters(filteredParams);
        
        if (hasAnyValidParameter) {
          // Parameters are already saved to database by the API endpoint,
          // but we need to update the UI
          setStatus('success');
          setErrorMessage(null);
          
          if (onParametersExtracted) {
            console.log('Parameters extracted in supplier status section:', filteredParams);
            onParametersExtracted(filteredParams);
          }
        } else {
          console.log('No valid parameters were found in extraction, saving empty parameters to database');
          // Still save empty parameters to database so we don't re-extract
          setStatus('no-parameters');
          
          if (onParametersExtracted) {
            console.log('Saving empty parameters in database to avoid re-analysis');
            onParametersExtracted(filteredParams);
          }
        }
      } else {
        console.log('No parameters were extracted by DeepSeek API, saving empty result to database');
        // Create empty parameters for storage using only user-selected parameters
        const emptyParams: Record<string, string> = {};
        
        requestParametersList.forEach(key => {
          emptyParams[key] = '-';
        });
        
        setParameters(emptyParams);
        setStatus('error');
        
        if (onParametersExtracted) {
          console.log('Saving empty parameters in database to avoid re-analysis');
          onParametersExtracted(emptyParams);
        }
      }
    } catch (error) {
      console.error('Error extracting parameters:', error);
      setErrorMessage('Ошибка при обработке данных');
      setStatus('connection-error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to extract parameter values and convert them to a displayable format
  const displayableParameters = () => {
    // If no parameters were selected for this request, return empty array
    if (!requestParametersList || requestParametersList.length === 0) {
      return [];
    }
    
    // Start with user-selected parameters in the exact order from database
    const mergedParameters: Record<string, string> = {};
    
    // Initialize all user-selected parameters with default "-" values
    requestParametersList.forEach(paramName => {
      mergedParameters[paramName] = '-';
    });
    
    // Then overlay the extracted response parameters (if any)
    if (parameters) {
      Object.entries(parameters).forEach(([key, value]) => {
        // Only include parameters that were actually selected by the user
        if (requestParametersList.includes(key)) {
          mergedParameters[key] = String(value || '-');
        }
      });
    }
    
    console.log('Parameters extracted in supplier status section:', mergedParameters);
    
    // Convert to array maintaining the exact database order (from requestParametersList)
    const paramArray = requestParametersList.map(paramName => ({
      name: paramName,
      value: String(mergedParameters[paramName] || '-')
    }));
    
    // Return parameters in the exact order they were stored in database
    return paramArray;
  };
  
  // Function to handle refresh/retry
  const handleRefresh = () => {
    if (isRefreshing) return; // Prevent multiple clicks
    
    setIsRefreshing(true);
    setTimeout(() => {
      tryExtractParameters();
    }, 500); // Add a slight delay to ensure UI shows loading state
  };

  // Functions for inline editing
  const startEditing = (paramName: string, currentValue: string) => {
    setEditingParam(paramName);
    setEditedValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingParam(null);
    setEditedValue('');
  };

  const saveParameter = async () => {
    if (!editingParam || isSaving) return;

    setIsSaving(true);
    try {
      // Create updated parameters object with the new value
      const updatedParameters = {
        ...parameters,
        [editingParam]: editedValue
      };

      await apiRequest('PUT', `/api/extracted-parameters/${responseId}`, {
        parameters: updatedParameters
      });

      // Update local state
      setParameters(updatedParameters);

      // Notify parent component if callback exists
      if (onParametersExtracted) {
        onParametersExtracted(updatedParameters);
      }

      // Show success notification
      console.log('Параметр успешно сохранен');
      
      cancelEditing();
    } catch (error) {
      console.error('Ошибка сохранения параметра:', error);
      // Show error notification
      alert('Ошибка сохранения параметра');
    } finally {
      setIsSaving(false);
    }
  };

  // Return different UI based on status
  if (status === 'loading' || isRefreshing) {
    return (
      <div className="flex flex-col space-y-4 p-4 pointer-events-auto">
        <div className="flex items-center justify-center">
          <Spinner className="h-6 w-6 mr-3 animate-spin" />
          <span className="text-sm font-medium">Анализ параметров...</span>
        </div>
        <p className="text-sm text-center text-muted-foreground">
          Это может занять несколько секунд
        </p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-4 pointer-events-auto w-full max-w-full">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mr-3">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="text-green-600"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <span className="text-sm text-slate-700 font-semibold">Параметры найдены</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-1.5 h-8 w-8 hover:bg-slate-100 rounded-full transition-colors duration-200"
            onClick={handleRefresh}
            disabled={isRefreshing}
            tabIndex={0}
            title="Обновить параметры"
          >
            <RefreshCw 
              size={14} 
              className={`text-slate-500 hover:text-slate-700 transition-colors duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
        
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 mt-3 border-slate-200 shadow-md hover:shadow-lg transition-shadow duration-300">
          <CardContent className="p-4">
            {supplierName && (
              <h4 className="text-sm font-semibold mb-4 text-slate-700 border-b border-slate-200 pb-2">{supplierName}</h4>
            )}
            <div className="h-[240px] pr-2 overflow-y-scroll scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              <div className="space-y-3 text-sm">
                {displayableParameters().length > 0 ? (
                  displayableParameters().map((param, index) => (
                    <div key={index} className="bg-white/50 rounded-lg p-3 border border-slate-200/50 hover:border-slate-300 transition-colors duration-200">
                      <div className="space-y-2">
                        <div className="font-medium text-xs text-slate-600 uppercase tracking-wide">{param.name}</div>
                        {editingParam === param.name ? (
                          <div className="flex gap-1">
                            <Input
                              value={editedValue}
                              onChange={(e) => setEditedValue(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveParameter();
                                } else if (e.key === 'Escape') {
                                  cancelEditing();
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={saveParameter}
                              disabled={isSaving}
                              className="h-8 w-8 p-0"
                            >
                              <Check size={12} className="text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
                              className="h-8 w-8 p-0"
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <div 
                              className="break-words text-sm flex-1 cursor-pointer hover:bg-slate-50 p-2 rounded-md transition-colors duration-150 min-h-[32px] flex items-center"
                              onClick={() => startEditing(param.name, param.value)}
                              title="Нажмите для редактирования"
                            >
                              <span className={`${param.value === '-' ? 'text-slate-400 italic' : 'text-slate-700 font-medium'}`}>
                                {param.value === '-' ? 'Не указано' : param.value}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(param.name, param.value)}
                              className="h-7 w-7 p-0 opacity-40 group-hover:opacity-100 transition-opacity ml-2 hover:bg-slate-100"
                              title="Редактировать"
                            >
                              <Edit3 size={12} className="text-slate-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-sm text-center py-8 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <path d="M9 11H5a2 2 0 0 0-2 2v3c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-4"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <p className="font-medium">Нет параметров для отображения</p>
                    <p className="text-xs text-slate-400 mt-1">В данном письме не найдены параметры для извлечения</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'no-parameters') {
    return (
      <div className="flex flex-col space-y-4 pointer-events-auto">
        <Card className="bg-muted/30 mt-2">
          <CardContent className="p-4">
            <div className="flex flex-col items-center justify-center text-muted-foreground text-sm text-center py-6 bg-gray-50 rounded-md">
              <p className="mb-2">В данном емайле нет параметров для извлечения</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-1"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw 
                  size={16} 
                  className={`${isRefreshing ? 'animate-spin' : ''}`} 
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (status === 'connection-error') {
    return (
      <div className="flex flex-col space-y-4 pointer-events-auto">
        <Card className="bg-muted/30 mt-2">
          <CardContent className="p-4">
            <div className="flex flex-col items-center justify-center text-muted-foreground text-sm text-center py-6 bg-gray-50 rounded-md">
              <p className="mb-2">Наличие данных проверить не удалось из-за ошибки соединения. Нажмите обновить</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-1"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw 
                  size={16} 
                  className={`${isRefreshing ? 'animate-spin' : ''}`} 
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (status === 'error') {
    return (
      <div className="flex flex-col space-y-4 pointer-events-auto">
        <Card className="bg-muted/30 mt-2">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-sm text-center py-6 bg-gray-50 rounded-md">
              Произошла ошибка при обработке данных
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-center mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-sm flex items-center px-4 py-2"
            onClick={handleRefresh}
            disabled={isRefreshing}
            tabIndex={0}
          >
            <RefreshCw 
              size={16} 
              className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} 
            />
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  // Default: idle or waiting
  return (
    <div className="flex flex-col items-center justify-center py-4 pointer-events-auto space-y-4">
      <p className="text-sm text-center text-muted-foreground px-4">
        Нажмите кнопку для анализа параметров из письма и прикрепленных файлов
      </p>
      <Button 
        variant="outline" 
        size="default" 
        className="text-sm flex items-center px-4 py-2"
        onClick={handleRefresh}
        disabled={isRefreshing}
        tabIndex={0}
      >
        <RefreshCw 
          size={16} 
          className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} 
        />
        Извлечь параметры
      </Button>
    </div>
  );
}

export default ParameterExtractionStatus;