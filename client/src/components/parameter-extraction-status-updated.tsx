import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, Check, RefreshCw, Edit3, Save, X } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { getParametersForResponse } from '../api/parameters';
import { apiRequest } from '../lib/queryClient';

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
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parameters, setParameters] = useState<Record<string, string> | null>(null);
  const [requestParametersList, setRequestParametersList] = useState<string[]>([]);
  const [hasLargeFiles, setHasLargeFiles] = useState(false);
  const [largeFilesInfo, setLargeFilesInfo] = useState<string[]>([]);
  
  // State for inline editing
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Load parameters on mount
  useEffect(() => {
    async function loadParameters() {
      try {
        // First, load the list of parameters for this request
        try {
          const paramList = await apiRequest('GET', `/api/parameters/${requestId}`);
          const paramData = await paramList.json();
          setRequestParametersList(paramData.parameters || []);
        } catch (error) {
          console.warn('Failed to get parameters for request:', error);
          // Don't use fallback parameters - if no parameters were selected, show empty list
          setRequestParametersList([]);
        }
        
        // Then, load any previously extracted parameters
        const response = await apiRequest('GET', `/api/parameters/extracted/${responseId}`);
        const data = await response.json();
        
        if (data.parameters && Object.keys(data.parameters).length > 0) {
          setParameters(data.parameters);
          setStatus('success');
          
          if (onParametersExtracted) {
            onParametersExtracted(data.parameters);
          }
        } else if (forceExtract) {
          // No parameters found but we want to force extraction
          tryExtractParameters();
        } else {
          // No parameters and no forcing - show extraction button
          setStatus(null);
        }
      } catch (error) {
        console.error('Error loading parameters:', error);
        setStatus(null);
      }
    }
    
    loadParameters();
  }, [requestId, responseId, forceExtract]);
  
  // Function to try to extract parameters using the API
  const tryExtractParameters = async () => {
    try {
      setIsRefreshing(true);
      setStatus('loading');
      
      // Step 1: First try to extract parameters from attachments
      let attachmentParameters: Record<string, any> = {};
      let hasAttachmentData = false;
      
      console.log('Analyzing attachments for response', responseId);
      try {
        const attachmentResponse = await apiRequest(
          'POST',
          `/api/supplier-responses/${responseId}/analyze-attachments`,
          { force: true } // Force re-analysis
        );
        const attachmentResult = await attachmentResponse.json();
        
        if (attachmentResult && attachmentResult.parameters && Object.keys(attachmentResult.parameters).length > 0) {
          attachmentParameters = attachmentResult.parameters;
          hasAttachmentData = true;
          console.log('Successfully extracted parameters from attachments:', attachmentParameters);
        } else {
          console.log('No parameters found in attachments, will try email body');
        }
      } catch (error) {
        console.warn('Attachment analysis error:', error);
      }
      
      // Step 2: Extract parameters from email body 
      const response = await apiRequest(
        'POST', 
        '/api/extract-parameters', 
        {
          responseId: responseId,
          parameters: requestParametersList,
          useAI: true
        }
      );
      const result = await response.json();
      console.log('Parameters extracted from email body using AI:', result);
      
      // Step 3: Check for large files and handle accordingly
      if (result && result.parameters) {
        let bodyParameters: Record<string, any> = {};
        let finalParameters: Record<string, string> = {};
        
        // Check if any parameter has source 'manual_required' (indicates large files)
        const hasManualRequired = Array.isArray(result.parameters) 
          ? result.parameters.some((param: any) => param.source === 'manual_required')
          : Object.values(result.parameters).some((param: any) => param.source === 'manual_required');
        
        if (hasManualRequired) {
          // Handle large files case - show manual input fields
          setHasLargeFiles(true);
          setLargeFilesInfo(['Файл превышает допустимый размер (5 МБ)']);
          
          // Create empty parameters for manual input
          requestParametersList.forEach(paramName => {
            finalParameters[paramName] = '-';
          });
          
          setParameters(finalParameters);
          setStatus('success');
          
          if (onParametersExtracted) {
            onParametersExtracted(finalParameters);
          }
          return;
        }
        
        // Process parameters from email body
        if (Array.isArray(result.parameters)) {
          result.parameters.forEach((param: any) => {
            bodyParameters[param.name] = param.value || '-';
          });
          console.log('Body parameters converted from array to object format:', bodyParameters);
        } else {
          bodyParameters = result.parameters;
          console.log('Body parameters already in object format:', bodyParameters);
        }
        
        // Step 4: Apply priority rules: Attachments override email body
        requestParametersList.forEach(paramName => {
          if (hasAttachmentData && attachmentParameters[paramName] && 
              attachmentParameters[paramName] !== '-' && 
              attachmentParameters[paramName] !== '' && 
              attachmentParameters[paramName] !== null) {
            finalParameters[paramName] = String(attachmentParameters[paramName]);
            console.log(`Priority rule: Using attachment value for ${paramName}: ${attachmentParameters[paramName]}`);
          } else if (bodyParameters[paramName] && 
                     bodyParameters[paramName] !== '-' && 
                     bodyParameters[paramName] !== '' && 
                     bodyParameters[paramName] !== null) {
            finalParameters[paramName] = String(bodyParameters[paramName]);
            console.log(`Priority rule: Using body value for ${paramName}: ${bodyParameters[paramName]}`);
          } else {
            finalParameters[paramName] = '-';
            console.log(`Priority rule: No value found for ${paramName}, using default '-'`);
          }
        });
        
        console.log('Final combined parameters with priority rules:', finalParameters);
        
        setParameters(finalParameters);
        setStatus('success');
        
        if (onParametersExtracted) {
          // Make sure we pass parameters in object format to parent components
          if (Array.isArray(finalParameters)) {
            // Convert array to object format for parent components
            const paramObj: Record<string, string> = {};
            Object.entries(finalParameters).forEach(([key, value]) => {
              paramObj[key] = value || '-';
            });
            console.log('Parameters extracted and sent to parent in object format:', paramObj);
            onParametersExtracted(paramObj);
          } else {
            onParametersExtracted(finalParameters);
          }
        }
      } else {
        setErrorMessage('В данном емайле нет параметров для извлечения');
        setStatus('error');
      }
    } catch (error) {
      console.error('Error extracting parameters:', error);
      setErrorMessage('Ошибка при обработке данных');
      setStatus('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to extract parameter values and convert them to a displayable format
  const displayableParameters = () => {
    if (!parameters) return [];
    
    return Object.entries(parameters).map(([key, value]) => ({
      name: key,
      value: String(value || '-')
    }));
  };
  
  // Function to handle refresh/retry
  const handleRefresh = () => {
    tryExtractParameters();
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
    if (!editingParam || !parameters) return;

    setIsSaving(true);
    try {
      // Update parameters locally first
      const updatedParameters = {
        ...parameters,
        [editingParam]: editedValue || '-'
      };

      // Save to backend
      await apiRequest('POST', `/api/parameters/extracted/${responseId}/update`, {
        parameters: updatedParameters
      });

      // Update local state
      setParameters(updatedParameters);
      setEditingParam(null);
      setEditedValue('');

      // Notify parent component
      if (onParametersExtracted) {
        onParametersExtracted(updatedParameters);
      }
      
      console.log(`Parameter ${editingParam} saved with value: ${editedValue}`);
    } catch (error) {
      console.error('Error saving parameter:', error);
      // You could add a toast notification here
    } finally {
      setIsSaving(false);
    }
  };
  
  // Show loading spinner when extracting
  if (status === 'loading' || isExtracting) {
    return (
      <div className="flex flex-col items-center justify-center p-2">
        <div className="animate-spin">
          <RefreshCw size={20} className="text-gray-400" />
        </div>
        <div className="text-sm text-gray-500 mt-2">
          Извлечение параметров...
        </div>
      </div>
    );
  }
  
  // Show success state with extracted parameters
  if (status === 'success' && parameters) {
    return (
      <div className="flex flex-col h-full min-h-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-sm font-medium text-slate-700">Извлеченные параметры</span>
            <div className="relative ml-2 group">
              <Check size={16} className="text-green-500" />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                {hasLargeFiles ? 'Ручное заполнение' : 'Параметры найдены'}
              </div>
            </div>
            
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              tabIndex={0}
              className="ml-2"
            >
              <RefreshCw 
                size={14} 
                className={`text-gray-500 hover:text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </div>
        
        {/* Large files warning */}
        {hasLargeFiles && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-sm">
              <div className="font-medium text-orange-800 mb-1">Файл превышает допустимый размер</div>
              <div className="text-orange-700">
                {largeFilesInfo.map((info, index) => (
                  <div key={index} className="text-xs">{info}</div>
                ))}
                <div className="text-xs mt-1">Пожалуйста, заполните параметры вручную</div>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="bg-muted/30 mt-2 flex-1 min-h-0">
          <CardContent className="p-3 flex flex-col h-full">
            {/* Temporarily hidden supplier name field */}
            {/* {supplierName && (
              <h4 className="text-sm font-medium mb-2">{supplierName}</h4>
            )} */}
            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-2 text-sm">
                {displayableParameters().map((param, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto] gap-2 border-b last:border-0 py-2">
                    <div className="space-y-1">
                      <div className="font-medium text-xs text-muted-foreground">{param.name}</div>
                      {editingParam === param.name ? (
                        <div className="flex gap-1">
                          <Input
                            value={editedValue}
                            onChange={(e) => setEditedValue(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            placeholder={hasLargeFiles ? "Введите значение вручную" : ""}
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
                            <Save size={12} />
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
                            className={`break-words text-sm flex-1 cursor-pointer hover:bg-gray-50 p-1 rounded ${
                              hasLargeFiles && param.value === '-' ? 'text-gray-400 italic' : ''
                            }`}
                            onClick={() => startEditing(param.name, param.value)}
                            title={hasLargeFiles ? "Нажмите для ручного ввода" : "Нажмите для редактирования"}
                          >
                            {hasLargeFiles && param.value === '-' ? 'Нажмите для ввода' : param.value}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(param.name, param.value)}
                            className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity ml-2"
                            title={hasLargeFiles ? "Ввести вручную" : "Редактировать"}
                          >
                            <Edit3 size={10} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {displayableParameters().length === 0 && (
                  <div className="text-muted-foreground text-xs">Нет данных для отображения</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show error state
  if (status === 'error') {
    return (
      <Alert className="border-red-200">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-sm">
          {errorMessage || 'Ошибка при извлечении параметров'}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus(null);
              setErrorMessage(null);
            }}
            className="ml-2 h-6 text-xs"
          >
            Попробовать снова
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Show initial state with extract button
  return (
    <div className="flex flex-col items-center justify-center p-2">
      <Button
        onClick={tryExtractParameters}
        disabled={isExtracting}
        className="text-sm"
      >
        {isExtracting ? 'Извлечение...' : 'Извлечь параметры'}
      </Button>
    </div>
  );
}