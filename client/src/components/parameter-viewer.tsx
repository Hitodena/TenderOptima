import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Plus, Settings, X, Info } from 'lucide-react';
import { type SupplierResponse } from '@shared/schema';
import { TableCell, TableRow, Table, TableBody, TableHead, TableHeader } from './ui/table';

interface ParameterViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  response: SupplierResponse | null;
}

interface ExtractedParameter {
  name: string;
  value: string;
  source: string;
  confidence: number;
}

// Default parameters to extract (can be toggled by user)
const DEFAULT_PARAMETERS = [
  'общая стоимость без ндс',
  'общая стоимость с ндс', 
  'цена за единицу без ндс',
  'сроки поставки',
  'условия поставки',
  'условия оплаты',
  'гарантия',
  'срок действия предложения'
];

export function ParameterViewer({ open, onOpenChange, response }: ParameterViewerProps) {
  const [loading, setLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [parameters, setParameters] = useState<string[]>(DEFAULT_PARAMETERS);
  const [selectedParameters, setSelectedParameters] = useState<string[]>(DEFAULT_PARAMETERS);
  const [extractedParameters, setExtractedParameters] = useState<ExtractedParameter[]>([]);
  const [newParameter, setNewParameter] = useState('');
  const [settingsMode, setSettingsMode] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [useAI, setUseAI] = useState<boolean>(true); // Whether to use AI for parameter extraction
  
  // Extract parameters when dialog opens and response changes
  useEffect(() => {
    if (open && response && selectedParameters.length > 0) {
      // При открытии диалога сначала выполним анализ вложений,
      // а потом извлечем параметры
      if (response && response.attachments && Array.isArray(response.attachments) && response.attachments.length > 0) {
        // Всегда анализируем вложения для извлечения текста
        setAnalyzeLoading(true);
        forceAnalyzeAttachments().then(() => {
          extractParameters();
          setAnalyzeLoading(false);
        });
      } else {
        extractParameters();
      }
    }
  }, [open, response, selectedParameters]);
  
  // Force analyze attachments
  const forceAnalyzeAttachments = async () => {
    if (!response) return;
    
    setAnalyzeLoading(true);
    setAnalyzeMessage(null);
    
    try {
      // Первый анализ - может не работать если вложения уже проанализированы
      const res = await fetch(`/api/supplier-responses/${response.id}/analyze-attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Attachment analysis result:', data);
      
      // Повторный анализ - принудительный, с force=true
      console.log('Forcing re-analysis of attachments with force=true');
      const forcedRes = await fetch(`/api/supplier-responses/${response.id}/analyze-attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          force: true
        }),
      });
      
      if (!forcedRes.ok) {
        throw new Error(`API returned status ${forcedRes.status}`);
      }
      
      const forcedData = await forcedRes.json();
      console.log('Forced attachment analysis result:', forcedData);
      
      if (forcedData.attachments_updated || data.attachments_updated) {
        const count = forcedData.attachments_updated_count || data.attachments_updated_count || 0;
        setAnalyzeMessage(`✅ Вложения успешно проанализированы. Обновлено ${count} вложений.`);
      } else if (forcedData.error || data.error) {
        setAnalyzeMessage(`❌ Ошибка при анализе вложений: ${forcedData.error_message || data.error_message}`);
      } else {
        setAnalyzeMessage('⚠️ Вложения проанализированы, но новый текст не извлечен.');
      }
      
      // Получаем обновленный response после анализа
      const updatedResponseRes = await fetch(`/api/supplier-responses/${response.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (updatedResponseRes.ok) {
        const updatedResponseData = await updatedResponseRes.json();
        console.log('Updated response after analysis:', updatedResponseData);
      }
      
    } catch (error: any) {
      console.error('Error analyzing attachments:', error);
      setAnalyzeMessage(`❌ Ошибка при анализе вложений: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setAnalyzeLoading(false);
    }
  };
  
  // Function to extract parameters from the response
  const extractParameters = async () => {
    if (!response) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/extract-parameters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseId: response.id,
          parameters: selectedParameters,
          useAI: useAI // Use AI for parameter extraction
        }),
      });
      
      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }
      
      const data = await res.json();
      setExtractedParameters(data.parameters || []);
      console.log(`Parameters extracted using ${data.usedAI ? 'AI' : 'regex patterns'}`);
    } catch (error) {
      console.error('Error extracting parameters:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle a parameter selection
  const toggleParameter = (parameter: string) => {
    setSelectedParameters(prev => 
      prev.includes(parameter)
        ? prev.filter(p => p !== parameter)
        : [...prev, parameter]
    );
  };
  
  // Add a new custom parameter
  const addParameter = () => {
    if (!newParameter.trim()) return;
    
    // Add to both lists if it doesn't already exist
    if (!parameters.includes(newParameter)) {
      setParameters(prev => [...prev, newParameter]);
      setSelectedParameters(prev => [...prev, newParameter]);
    } else if (!selectedParameters.includes(newParameter)) {
      // Just select it if it exists but isn't selected
      setSelectedParameters(prev => [...prev, newParameter]);
    }
    
    setNewParameter('');
  };
  
  // Remove a parameter from the list completely
  const removeParameter = (parameter: string) => {
    // Don't allow removing default parameters
    if (DEFAULT_PARAMETERS.includes(parameter)) {
      // Just deselect it
      setSelectedParameters(prev => prev.filter(p => p !== parameter));
      return;
    }
    
    // Remove custom parameter completely
    setParameters(prev => prev.filter(p => p !== parameter));
    setSelectedParameters(prev => prev.filter(p => p !== parameter));
  };
  
  // Get source badge color based on source
  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'attachment':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Вложение</Badge>;
      case 'content':
        return <Badge className="bg-green-500 hover:bg-green-600">Текст письма</Badge>;
      default:
        return <Badge className="bg-gray-500 hover:bg-gray-600">Неизвестно</Badge>;
    }
  };
  
  // Get confidence indicator
  const getConfidenceIndicator = (confidence: number) => {
    if (confidence >= 0.8) return '✓✓✓';
    if (confidence >= 0.5) return '✓✓';
    if (confidence >= 0.3) return '✓';
    return '?';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>
              {settingsMode 
                ? 'Настройка извлечения параметров' 
                : 'Параметры из ответа поставщика'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsMode(!settingsMode)}
            >
              {settingsMode ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            </Button>
          </div>
          <DialogDescription>
            {settingsMode
              ? 'Выберите параметры для извлечения из ответов поставщиков'
              : `${response?.supplierName || response?.supplierEmail || 'Поставщик'}`}
          </DialogDescription>
        </DialogHeader>
        
        {settingsMode ? (
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Добавить новый параметр..."
                  value={newParameter}
                  onChange={(e) => setNewParameter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addParameter()}
                />
                <Button onClick={addParameter} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Добавить
                </Button>
              </div>
              
              {/* AI extraction toggle */}
              <div className="flex items-center space-x-2 py-2">
                <Switch
                  id="ai-extraction"
                  checked={useAI}
                  onCheckedChange={setUseAI}
                />
                <Label htmlFor="ai-extraction">Использовать ИИ для извлечения параметров</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>ИИ анализирует содержимое документов и извлекает параметры даже если они записаны в нестандартном формате. Это повышает точность, но может занять больше времени.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="border rounded-md p-4 space-y-2">
                <h3 className="font-medium mb-2">Выберите параметры для извлечения:</h3>
                {parameters.map((parameter) => (
                  <div key={parameter} className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`param-${parameter}`}
                        checked={selectedParameters.includes(parameter)}
                        onCheckedChange={() => toggleParameter(parameter)}
                      />
                      <Label htmlFor={`param-${parameter}`}>{parameter}</Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParameter(parameter)}
                      className="h-6 w-6"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => {
                setSettingsMode(false);
                extractParameters();
              }}>
                Применить и извлечь
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Извлечение параметров...</span>
              </div>
            ) : extractedParameters.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Параметр</TableHead>
                    <TableHead>Значение</TableHead>
                    <TableHead>Источник</TableHead>
                    <TableHead>Достоверность</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedParameters.map((param, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{param.name}</TableCell>
                      <TableCell>{param.value}</TableCell>
                      <TableCell>{getSourceBadge(param.source)}</TableCell>
                      <TableCell>{getConfidenceIndicator(param.confidence)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Извлечение параметров...
              </div>
            )}
            
            {analyzeMessage && (
              <div className={`rounded-md p-3 mb-3 ${
                analyzeMessage.startsWith('✅') 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : analyzeMessage.startsWith('⚠️')
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <p>{analyzeMessage}</p>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                onClick={() => extractParameters()} 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Обновление...
                  </>
                ) : (
                  'Обновить параметры'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}