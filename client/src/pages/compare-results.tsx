import { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast, toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Download, ArrowLeft, ArrowRight, FileText, Mail, Phone, Globe, ChevronDown, ChevronUp, Save, Send, Brain, Loader2, TrendingUp, TrendingDown, ArrowUpDown, Edit3, Check, X, Trophy, Crown } from 'lucide-react';
import { MainNavigation } from '@/components/main-navigation';
import { apiRequest } from '@/lib/queryClient';
import { SupplierFollowUp } from '@/components/supplier-follow-up';
import { useAuth } from '@/hooks/use-auth';
import { SubscriptionGuard } from '@/components/SubscriptionGuard';
import { useSubscription } from '@/hooks/useSubscription';
import { WinnerEmailModal } from '@/components/winner-email-modal';
import { CancelWinnerModal } from '@/components/cancel-winner-modal';
import type { Supplier, SearchRequest, InsertAnalysisResult, AnalysisResult } from '@shared/schema';
import { useSaveAnalysisResult } from '@/hooks/use-analysis-results';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
// @ts-ignore - add missing imports for PDF generation
import pdfMake from 'pdfmake/build/pdfmake';
import htmlToPdfmake from 'html-to-pdfmake';

// We'll initialize pdfMake later when needed to avoid startup errors

// DataRequestButton component for sending email requests for missing data
interface DataRequestButtonProps {
  supplier: any;
  missingParams: string[];
  requestId: number | null;
}

const DataRequestButton: React.FC<DataRequestButtonProps> = ({ supplier, missingParams, requestId }) => {
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  // Function to add business card to email if available
  const getBusinessCardSignature = () => {
    if (user?.businessCard) {
      console.log("Adding business card to email:", user.businessCard);
      return `\n\n${user.businessCard}`;
    }
    return '';
  };

  // Initialize email content when dialog opens
  const openEmailDialog = () => {
    const defaultSubject = `Уточнение предложения по заказу`;
    const defaultMessage = `Уважаемый ${supplier.name}.

Ваше предложение в процессе рассмотрения.
Просим вас предоставить недостающую информацию:

${missingParams.map(param => `• ${param}`).join('\n')}

В ожидании вашего ответа. 
${getBusinessCardSignature()}`;

    setSubject(defaultSubject);
    setMessage(defaultMessage);
    setShowEmailDialog(true);
  };

  const sendDataRequest = async () => {
    setIsLoading(true);
    
    try {
      // Use the existing supplier follow-up API endpoint with correct apiRequest format
      const response = await apiRequest(
        '/api/supplier-follow-up',
        'POST',
        {
          supplierId: String(supplier.id),
          requestId: requestId,
          subject: subject,
          message: message
        }
      );

      // apiRequest handles the response parsing, so we just check if we got a response
      if (response) {
        setIsEmailSent(true);
        setShowEmailDialog(false);
        toast({
          title: "Сообщение отправлено",
          description: `Запрос направлен на ${supplier.email}`,
          variant: "default"
        });
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending data request:', error);
      toast({
        title: "Ошибка отправки",
        description: "Не удалось отправить запрос. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="text-center">
        <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded text-xs font-medium">
          Запрос направлен
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <Button
          size="sm"
          variant="outline"
          onClick={openEmailDialog}
          className="text-xs px-3 py-1 h-auto"
          title="Отправить запрос по недостающим данным"
        >
          <div className="flex items-center gap-1">
            <Send className="w-3 h-3" />
            <span>Запросить</span>
          </div>
        </Button>
      </div>

      {/* Email Composition Dialog - Pinned Style */}
      {showEmailDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Отправить уточнение поставщику {supplier.name}
                </h3>
                <button
                  onClick={() => setShowEmailDialog(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email:
                  </label>
                  <div className="text-sm text-gray-600">
                    {supplier.email}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Тема
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сообщение
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    onClick={() => setShowEmailDialog(false)}
                    variant="outline"
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={sendDataRequest}
                    disabled={isLoading}
                    className="bg-gray-800 hover:bg-gray-900 text-white"
                  >
                    {isLoading ? "Отправка..." : "Отправить"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ImprovementRequestButton component for sending improvement requests to suppliers
interface ImprovementRequestButtonProps {
  supplier: any;
  requestId: number | null;
  improvementCount?: number;
}

const ImprovementRequestButton: React.FC<ImprovementRequestButtonProps> = ({ supplier, requestId, improvementCount = 0 }) => {
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  // Function to add business card to email if available
  const getBusinessCardSignature = () => {
    if (user?.businessCard) {
      console.log("Adding business card to email:", user.businessCard);
      return `\n\n${user.businessCard}`;
    }
    return '';
  };

  // Initialize email content when dialog opens
  const openEmailDialog = () => {
    const defaultSubject = `Предложение об улучшении условий`;
    const defaultMessage = `Уважаемый ${supplier.name},

Благодарим за предоставленное коммерческое предложение.

В рамках тендерной процедуры предлагаем вам возможность улучшить условия вашего предложения по следующим параметрам:

• Цена - возможность предложить более конкурентные условия
• Сроки поставки - сокращение времени выполнения заказа
• Условия оплаты - более гибкие варианты расчетов
• Гарантийные обязательства - расширение гарантийного покрытия
• Дополнительные услуги - предложение сопутствующих сервисов

Просим предоставить улучшенное предложение в течение 3 рабочих дней.

${getBusinessCardSignature()}`;

    
    setSubject(defaultSubject);
    setMessage(defaultMessage);
    setShowEmailDialog(true);
  };

  const sendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните тему и сообщение",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Use the improvement request API endpoint to properly log this as an improvement request
      const response = await apiRequest(
        '/api/improvement-request',
        'POST',
        {
          requestId: requestId,
          supplierEmail: supplier.email,
          supplierName: supplier.name,
          subject: subject,
          message: message
        }
      );

      // apiRequest handles the response parsing, so we just check if we got a response
      if (response) {
        setIsEmailSent(true);
        setShowEmailDialog(false);
        toast({
          title: "Запрос отправлен",
          description: `Запрос на улучшение условий отправлен поставщику ${supplier.name}`,
          variant: "default"
        });
        
        // Trigger improvement counts refresh after successful send
        if (window.refreshImprovementCounts) {
          console.log('📤 Triggering improvement counts refresh after successful send');
          window.refreshImprovementCounts();
        } else {
          console.warn('⚠️ refreshImprovementCounts function not available');
        }
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending improvement request:', error);
      toast({
        title: "Ошибка отправки",
        description: "Не удалось отправить запрос. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <div className="relative inline-block">
          <Button
            variant={isEmailSent ? "secondary" : "outline"}
            size="sm"
            disabled={isLoading || isEmailSent}
            onClick={openEmailDialog}
            className="text-xs px-3 py-1 h-auto"
            title="Отправить запрос на улучшение условий"
          >
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{isEmailSent ? "Отправлено" : "Улучшить"}</span>
            </div>
          </Button>
          
          {/* Circle indicator with improvement count - only show when > 0 */}
          {improvementCount > 0 && (
            <div 
              className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold shadow-sm cursor-help"
              title={`Количество ранее отправленных запросов на улучшение условий данному поставщику: ${improvementCount}`}
            >
              {improvementCount}
            </div>
          )}
        </div>
      </div>

      {/* Email Composition Dialog for Improvement Request */}
      {showEmailDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Запрос на улучшение условий - {supplier.name}
                </h3>
                <button
                  onClick={() => setShowEmailDialog(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email:
                  </label>
                  <div className="text-sm text-gray-600">
                    {supplier.email}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Тема
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сообщение
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={14}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowEmailDialog(false)}
                    disabled={isLoading}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={sendEmail}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Отправить запрос
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Определим тип для результата анализа
interface ParsedAnalysisResult {
  suppliers: string[];
  data: Record<string, Record<string, string>>;
  formattedAnalysis: string;
  advantages: Record<string, string>;
  disadvantages: Record<string, string>;
  recommendation: string;
  productName?: string;
}

// Function to parse AI analysis content and extract structured data
const parseAnalysisContent = (aiAnalysis: string | null): ParsedAnalysisResult => {
  if (!aiAnalysis) {
    return { 
      suppliers: [], 
      data: {}, 
      formattedAnalysis: '',
      advantages: {},
      disadvantages: {},
      recommendation: ''
    };
  }

  try {
    // Basic structure to hold data
    const data: Record<string, Record<string, string>> = {};
    const suppliers: string[] = [];
    const advantages: Record<string, string> = {};
    const disadvantages: Record<string, string> = {};
    let recommendation = '';

    // Clean up the analysis text
    const cleanText = aiAnalysis
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/###\s+/g, '### ') // Normalize section headers
      .replace(/\*\*/g, '') // Remove bold markers
      .trim();

    // Extract supplier names from the text content
    const supplierPattern = /(\w+)\s*(?:\(.*?\))?\s*:\s*[\d,]+/g;
    let match;
    const foundSuppliers = [];
    while ((match = supplierPattern.exec(cleanText)) !== null) {
      if (match[1]) foundSuppliers.push(match[1]);
    }

    if (foundSuppliers.length > 0) {
      suppliers.push(...foundSuppliers);
    } else {
      // Default suppliers if none found in text
      suppliers.push("Поставщик 1", "Поставщик 2");
    }

    // Identify key parameters and extract values
    const parameters = [
      { key: 'costWithoutVAT', label: 'Общая стоимость без НДС', pattern: /Общая стоимость без НДС[^|]*\|\s*([^|]+)/i },
      { key: 'costWithVAT', label: 'Общая стоимость с НДС', pattern: /Общая стоимость с НДС[^|]*\|\s*([^|]+)/i },
      { key: 'unitCostWithoutVAT', label: 'Цена за единицу без НДС', pattern: /Цена за единицу[^|]*\|\s*([^|]+)/i },
      { key: 'unitCostWithVAT', label: 'Цена за единицу с НДС', pattern: /Цена за единицу с НДС[^|]*\|\s*([^|]+)/i },
      { key: 'deliveryTime', label: 'Сроки поставки', pattern: /Сроки поставки[^|]*\|\s*([^|]+)/i },
      { key: 'deliveryTerms', label: 'Условия поставки', pattern: /Условия поставки[^|]*\|\s*([^|]+)/i },
      { key: 'paymentTerms', label: 'Условия оплаты', pattern: /Условия оплаты[^|]*\|\s*([^|]+)/i },
      { key: 'warranty', label: 'Гарантия', pattern: /Гарантия[^|]*\|\s*([^|]+)/i },
      { key: 'service', label: 'Сервис', pattern: /Сервис[^|]*\|\s*([^|]+)/i },
      { key: 'resident', label: 'Резидент РБ', pattern: /Резидент РБ[^|]*\|\s*([^|]+)/i },
      { key: 'offerValidity', label: 'Срок действия предложения', pattern: /Срок действия предложения[^|]*\|\s*([^|]+)/i }
    ];

    // Initialize data structure
    parameters.forEach(param => {
      data[param.key] = {};
      suppliers.forEach(supplier => {
        data[param.key][supplier] = '-';
      });
    });

    // Extract parameter values
    parameters.forEach(param => {
      const match = cleanText.match(param.pattern);
      if (match && match[1]) {
        // Get the raw values string
        const values = match[1].trim();

        // Try to parse values for each supplier
        suppliers.forEach((supplier, index) => {
          // Look for supplier-specific values in the format "500 | 500 | 300"
          const segments = values.split('|').map(s => s.trim());

          if (index < segments.length) {
            // Check if we have a specific mention of this supplier with a value
            if (segments[index].includes(supplier)) {
              const supplierValue = segments[index].split(' ').pop();
              data[param.key][supplier] = supplierValue || '-';
            } else {
              data[param.key][supplier] = segments[index] || '-';
            }
          }
        });
      }
    });

    // Extract advantages and disadvantages
    const sections = cleanText.split(/###\s+/);
    if (sections.length >= 2) {
      // Look for advantages and disadvantages in the recommendations section
      const recommendationsSection = sections[1];
      recommendation = recommendationsSection;

      // Try to extract by supplier
      suppliers.forEach(supplier => {
        // Look for advantages
        const advantagePattern = new RegExp(`${supplier}[^:]*(?:преимущества|плюсы)[^:]*:\\s*([^\\n]+)`, 'i');
        const advantageMatch = recommendationsSection.match(advantagePattern);
        if (advantageMatch && advantageMatch[1]) {
          advantages[supplier] = advantageMatch[1].trim();
        }

        // Look for disadvantages
        const disadvantagePattern = new RegExp(`${supplier}[^:]*(?:недостатки|минусы)[^:]*:\\s*([^\\n]+)`, 'i');
        const disadvantageMatch = recommendationsSection.match(disadvantagePattern);
        if (disadvantageMatch && disadvantageMatch[1]) {
          disadvantages[supplier] = disadvantageMatch[1].trim();
        }
      });
    }

    // Format the analysis for nicer display
    let formattedAnalysis = '';
    
    // Split the text into sections
    const textSections = cleanText.split(/###\s+/);
    
    if (textSections.length >= 1) {
      // Analysis section
      const analysisSection = textSections[0];
      formattedAnalysis += `<div class="mb-6">
        <h3 class="text-xl font-bold mb-2">Сравнение предложений</h3>
        <p>${analysisSection}</p>
      </div>`;
    }

    if (textSections.length >= 2) {
      // Recommendations section
      const recommendationsSection = textSections[1];
      formattedAnalysis += `<div class="mb-6 bg-blue-50 p-4 rounded-lg">
        <h3 class="text-xl font-bold mb-2 text-blue-800">Рекомендации</h3>`;
      
      // Try to find a specific recommended supplier
      const recommendedPattern = /рекомендуем(?:\s+выбрать)?[^а-яА-Я]*([а-яА-Я\s"]+)/i;
      const recommendedMatch = recommendationsSection.match(recommendedPattern);
      
      if (recommendedMatch && recommendedMatch[1]) {
        formattedAnalysis += `<p class="font-medium text-blue-700 mb-2">Рекомендуемый поставщик: ${recommendedMatch[1].trim()}</p>`;
      }

      // Add any critical notes
      if (recommendationsSection.includes('не соответствует запросу')) {
        const criticalMatches = recommendationsSection.match(/([^\.]+не соответствует запросу[^\.]+)/i);
        if (criticalMatches && criticalMatches[1]) {
          formattedAnalysis += `<p class="text-red-600 font-medium">${criticalMatches[1].trim()}</p>`;
        }
      }

      formattedAnalysis += `</div>`;

      // Add the rest of the section
      formattedAnalysis += `<p>${recommendationsSection}</p>`;
    }

    if (textSections.length >= 3) {
      // Additional information section
      const additionalSection = textSections[2];
      formattedAnalysis += `<h3 class="text-xl font-semibold mb-4">3. Дополнительно</h3>`;
      
      // Process supplier-specific info
      if (Array.isArray(suppliers) && suppliers.length > 0) {
        for (const supplier of suppliers) {
          if (additionalSection.includes(supplier)) {
            const supplierInfoPattern = new RegExp(`${supplier}[^\\n]+((?:[^\\n]+\\n)+)`, 'i');
            const supplierInfoMatch = additionalSection.match(supplierInfoPattern);
            
            if (supplierInfoMatch && supplierInfoMatch[1]) {
              formattedAnalysis += `<div class="border-l-4 border-gray-200 pl-4 mb-4">
                <h4 class="font-medium mb-2">${supplier}</h4>
                <p class="text-sm">${supplierInfoMatch[1].trim().replace(/\n/g, '<br>')}</p>
              </div>`;
            }
          }
        }
      }
      
      formattedAnalysis += `<p>${additionalSection}</p>`;
    }
    
    // Extract product name if available
    let productName = '';
    const productPattern = /(Товар|Услуга|Продукт)[^:]*:\s*([^\n]+)/i;
    const productMatch = cleanText.match(productPattern);
    if (productMatch && productMatch[2]) {
      productName = productMatch[2].trim();
    }
    
    // Return formatted data
    return { 
      suppliers, 
      data, 
      formattedAnalysis,
      advantages,
      disadvantages,
      recommendation,
      productName
    };
  } catch (error) {
    console.error("Error parsing AI analysis:", error);
    return { 
      suppliers: [], 
      data: {}, 
      formattedAnalysis: aiAnalysis || '',
      advantages: {},
      disadvantages: {},
      recommendation: ''
    };
  }
};

// Interface for comparison data response from the API
interface ComparisonData {
  tableData: Record<string, any>[];
  // Обновленное определение supplierDetails с более конкретной типизацией
  supplierDetails: Array<{
    id: number;
    name: string;
    email: string;  // Добавлено поле email для отображения и группировки
    phone?: string;
    website?: string;
    contactName?: string;
    
    // Поля для отслеживания улучшений
    responseCount?: number;
    improvements?: Record<string, { 
      oldValue: string; 
      newValue: string; 
      description?: string;
    }>;
    firstResponseDate?: string | Date;
    lastResponseDate?: string | Date;
  }>;
  productName?: string;
  requestDetails?: any;
  csv: string;
  aiAnalysis?: string;
  htmlTable?: string;
  suppliers?: string[];
  parameters?: string[];
  filename?: string;
  requestId?: number;  // Добавляем requestId для использования при сохранении анализа
}

// Compare Results Page Component
export default function CompareResultsPage() {
  // Initialize toast hook at the component level
  const { toast } = useToast();
  // Router
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id?: string }>('/compare-results/:id?');
  const [requestId, setRequestId] = useState<number | null>(params?.id ? parseInt(params.id, 10) : null);
  
  // Subscription hook
  const { isActiveOrLoading } = useSubscription();
  
  // State for comparison data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [parameters, setParameters] = useState<string[]>([]);
  const [originalRequestParameters, setOriginalRequestParameters] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "analysis">("table");
  const [showHelp, setShowHelp] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  
  // AI Analysis state
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Flag to track if we've already initiated comparison generation
  const hasInitiatedComparison = useRef(false);
  
  // Hook for saving analysis results
  const saveAnalysisMutation = useSaveAnalysisResult();
  
  // State for improvement counts
  const [improvementCounts, setImprovementCounts] = useState<Record<string, number>>({});
  
  // Winner selection state
  const [selectedWinner, setSelectedWinner] = useState<{
    email: string;
    name: string;
  } | null>(null);
  const [winnerEmailSent, setWinnerEmailSent] = useState<boolean>(false);
  const [showWinnerEmailModal, setShowWinnerEmailModal] = useState<boolean>(false);
  const [showCancelWinnerModal, setShowCancelWinnerModal] = useState<boolean>(false);
  const [winnerModalLoading, setWinnerModalLoading] = useState<boolean>(false);
  const [supplierToSelectAsWinner, setSupplierToSelectAsWinner] = useState<any>(null);
  
  // State for supplier sorting
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // State for table cell editing
  const [editingCell, setEditingCell] = useState<{parameter: string, supplierId: number} | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [isSavingCell, setIsSavingCell] = useState(false);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showSortDropdown && !target.closest('.sort-dropdown-container')) {
        setShowSortDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortDropdown]);
  
  // Auto-sort by unit cost without VAT when coming from compare button
  useEffect(() => {
    const storedSortBy = localStorage.getItem('compareSortBy');
    const storedSortOrder = localStorage.getItem('compareSortOrder');
    
    if (storedSortBy && storedSortOrder) {
      console.log('🔄 Applying stored sort settings:', { sortBy: storedSortBy, sortOrder: storedSortOrder });
      setSortBy(storedSortBy);
      setSortOrder(storedSortOrder as 'asc' | 'desc');
      
      // Clear the stored settings after applying them
      localStorage.removeItem('compareSortBy');
      localStorage.removeItem('compareSortOrder');
    }
  }, []);
  
  // Function to sort suppliers based on selected parameter
  const sortSuppliers = (suppliers: any[], sortBy: string, sortOrder: 'asc' | 'desc') => {
    console.log('🔍 sortSuppliers called:', { suppliersCount: suppliers.length, sortBy, sortOrder });
    console.log('🔍 Suppliers to sort:', suppliers.map(s => ({ id: s.id, name: s.name, email: s.email })));
    
    if (comparisonData?.tableData && sortBy !== 'name' && sortBy !== 'email' && sortBy !== 'responseCount') {
      console.log('📊 Available table data:', comparisonData.tableData.length, 'rows');
      console.log('📊 Sample table row keys:', comparisonData.tableData[0] ? Object.keys(comparisonData.tableData[0]) : 'no rows');
      
      const parameterRow = comparisonData.tableData.find(row => 
        (row.parameter || row.Parameter) === sortBy
      );
      console.log(`📊 Found parameter row for "${sortBy}":`, parameterRow ? 'YES' : 'NO');
      if (parameterRow) {
        console.log('📊 Parameter row data:', parameterRow);
      }
    }
    
    const sorted = [...suppliers].sort((a, b) => {
      let aValue = '';
      let bValue = '';
      
      if (sortBy === 'name') {
        aValue = a.name || '';
        bValue = b.name || '';
      } else if (sortBy === 'email') {
        aValue = a.email || '';
        bValue = b.email || '';
      } else if (sortBy === 'responseCount') {
        aValue = (improvementCounts[a.name] || 0).toString();
        bValue = (improvementCounts[b.name] || 0).toString();
        return sortOrder === 'asc' ? 
          (improvementCounts[a.name] || 0) - (improvementCounts[b.name] || 0) :
          (improvementCounts[b.name] || 0) - (improvementCounts[a.name] || 0);
      } else {
        // Sort by parameter value from comparison data
        if (comparisonData?.tableData) {
          const parameterRow = comparisonData.tableData.find(row => 
            (row.parameter || row.Parameter) === sortBy
          );
          
          if (parameterRow) {
            // Improved parameter value extraction with multiple fallback methods
            const getParameterValue = (supplier: any) => {
              const supplierId = supplier.id?.toString();
              const supplierName = supplier.name || '';
              const supplierEmail = supplier.email ? supplier.email.toLowerCase().trim() : '';
              
              // Try multiple ways to access the parameter value
              let value = '';
              
              // Method 1: Try by email directly
              if (supplierEmail && parameterRow[supplierEmail] !== undefined) {
                value = parameterRow[supplierEmail];
              }
              // Method 2: Try by supplier name
              else if (supplierName && parameterRow[supplierName] !== undefined) {
                value = parameterRow[supplierName];
              }
              // Method 3: Try email-based key
              else if (supplierEmail && parameterRow[`email_${supplierEmail}`] !== undefined) {
                value = parameterRow[`email_${supplierEmail}`];
              }
              // Method 4: Try supplier ID-based key
              else if (supplierId && parameterRow[`supplier_${supplierId}`] !== undefined) {
                const cellData = parameterRow[`supplier_${supplierId}`];
                // Handle object format
                if (typeof cellData === 'object' && cellData !== null) {
                  value = cellData.value || cellData.displayValue || '';
                } else {
                  value = cellData;
                }
              }
              // Method 5: Try by index-based keys
              else {
                // Try to find by position in suppliers array
                const supplierIndex = comparisonData?.supplierDetails?.findIndex(s => s.id === supplier.id);
                if (supplierIndex !== undefined && supplierIndex >= 0) {
                  value = parameterRow[`${supplierIndex + 1}`] || parameterRow[`Поставщик ${supplierIndex + 1}`] || '';
                }
              }
              
              // Clean up the value - remove HTML tags and extract current value from improvement patterns
              if (typeof value === 'string') {
                // Handle improvement pattern: "new value (ранее: old value)"
                const improvementMatch = value.match(/^(.+?)\s*\(ранее:\s*(.+?)\)$/);
                if (improvementMatch) {
                  value = improvementMatch[1].trim();
                }
                // Handle HTML span pattern
                const htmlMatch = value.match(/^(.+?)\s*<span[^>]*>/);
                if (htmlMatch) {
                  value = htmlMatch[1].trim();
                }
              }
              
              return value || '';
            };
            
            aValue = getParameterValue(a);
            bValue = getParameterValue(b);
            
            console.log(`Sorting by ${sortBy}: ${a.name}="${aValue}" vs ${b.name}="${bValue}"`);
            
            // Parse numeric values for proper sorting
            const aNum = parseFloat(String(aValue).replace(/[^\d.,]/g, '').replace(',', '.'));
            const bNum = parseFloat(String(bValue).replace(/[^\d.,]/g, '').replace(',', '.'));
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
              const result = sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
              console.log(`Numeric sort: ${aNum} vs ${bNum} = ${result}`);
              return result;
            }
          }
        }
      }
      
      // Default string comparison
      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue, 'ru');
      } else {
        return bValue.localeCompare(aValue, 'ru');
      }
    });
    
    return sorted;
  };

  // Function to fetch improvement counts for all suppliers
  const fetchImprovementCounts = async (supplierDetails: any[]) => {
    console.log('🔍 fetchImprovementCounts called with:', { requestId, supplierDetailsLength: supplierDetails?.length });
    
    if (!requestId || !supplierDetails?.length) {
      console.log('❌ Skipping improvement counts fetch - missing requestId or suppliers');
      return;
    }
    
    try {
      const supplierNames = supplierDetails.map(supplier => supplier.name);
      console.log('📤 Fetching improvement counts for suppliers:', supplierNames);
      
      const response = await apiRequest(
        `/api/improvement-requests/counts?requestId=${requestId}`,
        'GET'
      );
      
      console.log('📥 Improvement counts API response:', response);
      
      if (response && response.success && response.counts) {
        setImprovementCounts(response.counts);
        console.log('✅ Loaded improvement counts:', response.counts);
      } else {
        console.log('⚠️ Invalid improvement counts response:', response);
      }
    } catch (error) {
      console.error('❌ Error fetching improvement counts:', error);
    }
  };

  // Winner selection functions
  const handleSelectWinner = async (data: {
    subject: string;
    content: string;
    attachments: File[];
  }) => {
    if (!supplierToSelectAsWinner || !requestId) {
      toast({
        title: "Ошибка",
        description: "Не выбран поставщик для отправки уведомления",
        variant: "destructive"
      });
      return;
    }

    setWinnerModalLoading(true);
    
    try {
      // Convert file attachments to base64
      const attachments = await Promise.all(
        data.attachments.map(async (file) => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]); // Remove data:mime;base64, prefix
            };
            reader.readAsDataURL(file);
          });
          
          return {
            filename: file.name,
            content: base64,
            contentType: file.type
          };
        })
      );

      const response = await apiRequest('/api/winner-notification', 'POST', {
        requestId: requestId,
        winnerEmail: supplierToSelectAsWinner.email,
        winnerName: supplierToSelectAsWinner.name,
        subject: data.subject,
        content: data.content,
        attachments: attachments
      });

      if (response && response.success) {
        setSelectedWinner({
          email: supplierToSelectAsWinner.email,
          name: supplierToSelectAsWinner.name
        });
        setWinnerEmailSent(true);
        setShowWinnerEmailModal(false);
        setSupplierToSelectAsWinner(null);

        toast({
          title: "Уведомление отправлено",
          description: `Поставщик ${supplierToSelectAsWinner.name} выбран победителем и уведомлен`,
          variant: "default"
        });
      } else {
        throw new Error(response?.error || 'Failed to send winner notification');
      }
    } catch (error) {
      console.error('Error sending winner notification:', error);
      toast({
        title: "Ошибка отправки",
        description: "Не удалось отправить уведомление победителю. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setWinnerModalLoading(false);
    }
  };

  const handleCancelWinnerSelection = async () => {
    if (!requestId) return;

    setWinnerModalLoading(true);
    
    try {
      const response = await apiRequest(`/api/winner-selection/${requestId}`, 'DELETE');

      if (response && response.success) {
        setSelectedWinner(null);
        setWinnerEmailSent(false);
        setShowCancelWinnerModal(false);

        toast({
          title: "Выбор отменен",
          description: "Выбор победителя успешно отменен",
          variant: "default"
        });
      } else {
        throw new Error(response?.error || 'Failed to cancel winner selection');
      }
    } catch (error) {
      console.error('Error cancelling winner selection:', error);
      toast({
        title: "Ошибка отмены",
        description: "Не удалось отменить выбор победителя. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setWinnerModalLoading(false);
    }
  };

  // Load winner info when component mounts or requestId changes
  useEffect(() => {
    if (requestId) {
      const loadWinnerInfo = async () => {
        try {
          const response = await apiRequest(`/api/winner-info/${requestId}`);
          if (response && response.success && response.winner) {
            setSelectedWinner({
              email: response.winner.winnerEmail,
              name: response.winner.winnerName
            });
            setWinnerEmailSent(response.winner.notificationSent);
          }
        } catch (error) {
          // Winner not found - this is normal, just continue without setting winner
          console.log('No winner found for this request - this is normal');
        }
      };
      
      loadWinnerInfo();
    }
  }, [requestId]);

  // Functions for table cell editing
  const startEditingCell = (parameter: string, supplierId: number, currentValue: string) => {
    console.log(`Starting edit for parameter: ${parameter}, supplier: ${supplierId}, value: ${currentValue}`);
    setEditingCell({ parameter, supplierId });
    setEditedValue(currentValue === '-' ? '' : currentValue);
  };

  const cancelEditingCell = () => {
    setEditingCell(null);
    setEditedValue('');
  };

  const saveCellValue = async () => {
    if (!editingCell || isSavingCell) return;

    setIsSavingCell(true);
    try {
      // Find the supplier and the source response ID for this specific parameter
      const supplier = comparisonData?.supplierDetails?.find(s => s.id === editingCell.supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Get the source response ID for this specific parameter from the table data
      const parameterRow = comparisonData?.tableData?.find(row => 
        (row.parameter || row.Parameter) === editingCell.parameter
      );
      
      if (!parameterRow) {
        throw new Error('Parameter row not found in table data');
      }

      // Get the source response ID for this supplier's email
      const supplierEmail = supplier.email?.toLowerCase().trim() || '';
      const sourceResponseId = parameterRow[`${supplierEmail}_sourceResponseId`] || supplier.id;
      
      console.log(`Updating parameter "${editingCell.parameter}" for supplier "${supplier.name}" (email: ${supplierEmail})`);
      console.log(`Source response ID: ${sourceResponseId}`);

      // Get existing parameters for the source response, then update the specific one
      let existingParams = {};
      try {
        const existingResponse = await apiRequest(`/api/supplier-responses/${sourceResponseId}/parameters`);
        if (existingResponse && existingResponse.parameters) {
          existingParams = existingResponse.parameters;
        }
      } catch (error) {
        console.log('No existing parameters found, will create new ones');
      }

      // Update the specific parameter
      const updatedParams = {
        ...existingParams,
        [editingCell.parameter]: editedValue || '-'
      };

      // Update the extracted parameters for the CORRECT response ID
      const response = await apiRequest(`/api/extracted-parameters/${sourceResponseId}`, 'PUT', {
        parameters: updatedParams
      });

      // Update the comparison data locally to reflect changes immediately
      if (comparisonData?.tableData) {
        const updatedTableData = comparisonData.tableData.map(row => {
          if ((row.parameter || row.Parameter) === editingCell.parameter) {
            // Update the value for this supplier
            const supplierEmail = supplier.email?.toLowerCase().trim() || '';
            const newRow = { ...row };
            
            // Update the displayed value using the same key structure as the backend
            if (supplierEmail && newRow[supplierEmail] !== undefined) {
              newRow[supplierEmail] = editedValue || '-';
            } else if (newRow[supplier.name] !== undefined) {
              newRow[supplier.name] = editedValue || '-';
            }
            
            console.log(`Local update: ${editingCell.parameter} -> ${supplierEmail} = ${editedValue || '-'}`);
            
            return newRow;
          }
          return row;
        });
        
        // Update the comparison data state to trigger re-render
        setComparisonData({
          ...comparisonData,
          tableData: updatedTableData
        });
        
        console.log('Comparison data updated locally');
      }

      toast({
        title: "Параметр обновлен",
        description: `Значение "${editingCell.parameter}" успешно сохранено`,
      });

      cancelEditingCell();
    } catch (error) {
      console.error('Error saving cell value:', error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить изменения. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setIsSavingCell(false);
    }
  };

  // Initialize on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Get request ID from params or localStorage
        let requestId: number | null = null;
        
        if (params?.id) {
          requestId = parseInt(params.id);
        } else {
          const storedRequestId = localStorage.getItem('compareRequestId');
          if (storedRequestId) {
            requestId = parseInt(storedRequestId);
          }
        }
        
        if (requestId) {
          setRequestId(requestId);
          
          // Check if we have response IDs in URL params (from navigation)
          const urlParams = new URLSearchParams(window.location.search);
          const responseIdsParam = urlParams.get('responses');
          
          if (responseIdsParam) {
            // We're coming from the request page with specific response IDs
            console.log("Loading comparison data from URL parameters");
            const responseIds = responseIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            
            if (responseIds.length >= 2) {
              try {
                // Fetch the supplier responses for these specific IDs
                const responses = await apiRequest(`/api/supplier-responses?requestId=${requestId}&responseIds=${responseIds.join(',')}`);
                
                if (responses && Array.isArray(responses) && responses.length > 0) {
                  // FIXED: Group responses by supplier email to handle multiple emails from same supplier
                  const supplierGroups = new Map<string, any[]>();
                  
                  responses.forEach(response => {
                    const email = response.supplierEmail?.toLowerCase().trim() || `no-email-${response.id}`;
                    
                    if (!supplierGroups.has(email)) {
                      supplierGroups.set(email, []);
                    }
                    supplierGroups.get(email)!.push(response);
                  });
                  
                  // Convert grouped responses to supplier format with all response IDs
                  const suppliersFromResponses = Array.from(supplierGroups.entries()).map(([email, responseGroup]) => {
                    // Sort responses by date to get latest information
                    const sortedResponses = responseGroup.sort((a, b) => {
                      const dateA = a.responseDate ? new Date(a.responseDate).getTime() : 0;
                      const dateB = b.responseDate ? new Date(b.responseDate).getTime() : 0;
                      return dateB - dateA; // Latest first
                    });
                    
                    const latestResponse = sortedResponses[0];
                    const allResponseIds = responseGroup.map(r => r.id);
                    
                    console.log(`📧 Supplier ${latestResponse.supplierName} (${email}): ${responseGroup.length} emails, IDs: ${allResponseIds.join(', ')}`);
                    
                    return {
                      id: latestResponse.id,
                      name: latestResponse.supplierName,
                      email: latestResponse.supplierEmail,
                      phone: latestResponse.phone || '',
                      website: latestResponse.website || '',
                      responseIds: allResponseIds, // Include ALL response IDs for this supplier
                      allResponseIds: allResponseIds, // Also add this property for compatibility
                      responseCount: responseGroup.length,
                      // Add properties for tracking changes
                      hasMultipleResponses: responseGroup.length > 1,
                      sortedResponses: sortedResponses // Keep all responses for parameter analysis
                    };
                  });
                  
                  setSuppliers(suppliersFromResponses);
                  console.log("✅ Loaded and grouped suppliers from URL parameters:", suppliersFromResponses);
                }
              } catch (error) {
                console.error("Error fetching supplier responses:", error);
              }
            }
          } else {
            // Fallback to localStorage for backward compatibility
            const storedSuppliers = localStorage.getItem('compareSuppliers');
            if (storedSuppliers) {
              const parsedSuppliers = JSON.parse(storedSuppliers);
              if (Array.isArray(parsedSuppliers) && parsedSuppliers.length > 0) {
                setSuppliers(parsedSuppliers);
                console.log("Using suppliers from localStorage:", parsedSuppliers);
              }
            }
          }
          
          // Try to fetch parameters - first the original request parameters, then try extracted parameters if needed
          try {
            // First try to get original request parameters - using apiRequest for authentication
            try {
              console.log(`Fetching original parameters for request ID: ${requestId}`);
              const data = await apiRequest(`/api/parameters/${requestId}`);
              
              if (data && data.parameters && Array.isArray(data.parameters) && data.parameters.length > 0) {
                // Use original request parameters - these have priority
                console.log("✅ Using parameters from original request:", data.parameters);
                
                // Save original request parameters to use for comparing with extracted parameters
                setOriginalRequestParameters(data.parameters);
                setParameters(data.parameters);
              } else {
                // NO FALLBACK: If no parameters found for this specific request, don't use parameters from other requests
                console.log("❌ No parameters found for request", requestId, "- will not use parameters from other requests");
                setParameters([]);
              }
            } catch (error) {
              // NO FALLBACK: If API error, don't try to get parameters from other requests
              console.log("❌ Error fetching parameters for request", requestId, "- will not use parameters from other requests:", error);
              setParameters([]);
            }
          } catch (error) {
            console.error("❌ Error fetching request parameters for", requestId, "- will not use parameters from other requests:", error);
            setParameters([]);
          }

        }
        
        console.log("Loaded comparison data:", {
          suppliers: suppliers.length, 
          parameters: parameters.length
        });
  
      } catch (error) {
        console.error("Error loading comparison data:", error);
        setError("Failed to load comparison data. Please try again.");
  
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load comparison data",
          variant: "destructive"
        });
  
        // Redirect back to dashboard
        setTimeout(() => {
          setLocation('/dashboard');
        }, 2000);
      }
    };

    // Выполняем эту функцию только один раз при монтировании компонента
    loadInitialData();
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch improvement counts whenever comparison data is loaded
  useEffect(() => {
    if (comparisonData?.supplierDetails && requestId) {
      console.log('🔄 Comparison data loaded, fetching improvement counts');
      fetchImprovementCounts(comparisonData.supplierDetails);
    }
  }, [comparisonData, requestId]);

  // Set up global refresh function for improvement counts
  useEffect(() => {
    window.refreshImprovementCounts = () => {
      if (comparisonData?.supplierDetails && requestId) {
        console.log('🔄 Refreshing improvement counts on demand');
        fetchImprovementCounts(comparisonData.supplierDetails);
      }
    };
    
    // Cleanup function
    return () => {
      delete window.refreshImprovementCounts;
    };
  }, [comparisonData, requestId]);

  // Generate comparison when data is loaded and only once
  useEffect(() => {
    // Защита от вызова при первом рендере, когда данные еще не загружены
    if (suppliers.length === 0 || parameters.length === 0) {
      console.log("Skipping comparison generation - suppliers or parameters not loaded yet");
      return;
    }
    
    console.log("Checking if can generate comparison:", {
      requestId,
      suppliersLoaded: suppliers.length > 0,
      parametersLoaded: parameters.length > 0,
      hasInitiatedComparison: hasInitiatedComparison.current,
      isLoading,
      hasComparisonData: !!comparisonData,
      hasError: !!error
    });
    
    // Проверяем, что можно генерировать сравнение
    const canGenerateComparison = 
      !hasInitiatedComparison.current && 
      !isLoading && 
      !comparisonData && 
      !error;

    if (canGenerateComparison) {
      console.log("Initiating comparison generation");
      // Устанавливаем флаг, чтобы предотвратить повторные вызовы
      hasInitiatedComparison.current = true;

      // Генерируем сравнение
      const generateComparison = async () => {
        try {
          setIsLoading(true);

          // Prioritize original request parameters if available
          let selectedParameters: string[] = [];
          
          if (originalRequestParameters.length > 0) {
            // Use original request parameters if available
            console.log("⭐ Using original request parameters for comparison:", originalRequestParameters);
            selectedParameters = originalRequestParameters;
          } else if (parameters.length > 0) {
            // Fall back to parameters selected in UI
            console.log("Using parameters selected in UI:", parameters);
            selectedParameters = Array.isArray(parameters) ? 
              parameters.map(p => typeof p === 'string' ? p : (p.label || p.toString())) : 
              [];
          } else {
            // No parameters available - cannot proceed with comparison
            throw new Error("No parameters were selected for this request. Please return to the request details page and select parameters before comparing suppliers.");
          }

          if (selectedParameters.length === 0) {
            throw new Error("No parameters available for comparison");
          }
          
          console.log("Final selected parameters for comparison:", selectedParameters);
          
          // Для отладки
          console.log("Suppliers data:", {
            count: suppliers.length,
            data: suppliers.slice(0, 2) // Показываем только первые два для краткости
          });

          console.log(`Generating comparison for ${suppliers.length} suppliers with ${selectedParameters.length} parameters`);
          console.log("Request ID:", requestId);

          console.log("🚀 Using fixed comparison endpoint for proper supplier consolidation");
          
          // Use the fixed comparison endpoint that properly groups suppliers by email
          console.log("📤 Sending comparison request:", {
            suppliersCount: suppliers.length,
            parametersCount: selectedParameters.length,
            requestId
          });
          
          const comparisonResponse = await apiRequest('/api/compare-fixed', 'POST', {
            suppliers: suppliers,
            parameters: selectedParameters,
            requestId: requestId || null
          });
          
          console.log("📥 Received comparison response:", {
            hasTableData: !!comparisonResponse?.tableData,
            hasSupplierDetails: !!comparisonResponse?.supplierDetails,
            tableRowsCount: comparisonResponse?.tableData?.length || 0,
            supplierDetailsCount: comparisonResponse?.supplierDetails?.length || 0
          });
          
          if (comparisonResponse && (comparisonResponse.tableData || comparisonResponse.supplierDetails)) {
            console.log("✅ Using data from fixed comparison endpoint");
            setComparisonData(comparisonResponse);
            return;
          }
          
          console.log("⚠️ Fixed endpoint returned empty data, falling back to manual processing");
          
          // FALLBACK: Manual processing (should rarely be needed now)
          // Функция для извлечения параметров одного поставщика с помощью API
          async function extractParametersForSupplier(responseId: number, parameters: string[]): Promise<any> {
            try {
              // 1. Сначала анализируем вложения - используем apiRequest для аутентификации
              await apiRequest(
                `/api/supplier-responses/${responseId}/analyze-attachments`,
                'POST',
                {
                  force: true // Принудительный анализ для обновления данных
                }
              );
              
              console.log(`Analyzed attachments for supplier response ID: ${responseId}`);
              
              // 2. Извлекаем параметры с помощью AI - используем apiRequest для аутентификации
              const extractionResponse = await apiRequest(
                '/api/extract-parameters',
                'POST',
                {
                  responseId: responseId,
                  parameters: parameters,
                  useAI: true // Всегда используем AI для лучших результатов
                }
              );
              
              // apiRequest already handles JSON response and error checking
              const data = extractionResponse;
              console.log(`Extracted ${data.parameters?.length || 0} parameters for supplier ${responseId}`);
              return data.parameters || [];
            } catch (error) {
              console.error(`Failed to extract parameters for supplier ${responseId}:`, error);
              return [];
            }
          }
          
          // Fetch supplier emails from server for each supplier response ID
          console.log("Suppliers data:", {
            count: suppliers.length,
            data: suppliers.slice(0, 3) // Show first 3 supplier objects for debugging
          });

          // Instead of fetching emails separately which may fail, use the emails we already have
          console.log("📨 Using supplier email information from initial data...");
          
          // Map to verify and normalize supplier email addresses
          const suppliersWithEmails = suppliers.map(supplier => {
            // Print supplier details for debugging
            console.log(`Supplier details from initial load:`, {
              id: supplier.id,
              name: supplier.name || supplier.supplierName,
              email: supplier.email || supplier.supplierEmail
            });
            
            return {
              ...supplier,
              // Prioritize supplier.email if available, then supplierEmail, fall back to empty string
              email: supplier.email || supplier.supplierEmail || '',
              // We trust the data we have
              emailVerified: !!(supplier.email || supplier.supplierEmail)
            };
          });
          
          // ЭТАП 1: Группировка поставщиков по email
          console.log("📧 Grouping suppliers by email...");
          
          // Создаем Map для группировки поставщиков по email
          const suppliersByEmail = new Map<string, typeof suppliersWithEmails[0][]>();
          
          // Функция для получения нормализованного email
          const normalizeEmail = (email: string | undefined): string => {
            const normalized = (email || '').toLowerCase().trim();
            // Если email пустой или явно недействительный (некоторые входящие почты имеют адрес undefined@undefined)
            if (!normalized || normalized.includes('undefined@') || normalized === '@') {
              return '';
            }
            return normalized;
          };
          
          // Группируем поставщиков по email
          suppliersWithEmails.forEach(supplier => {
            const email = normalizeEmail(supplier.email);
            
            // Создаем уникальный ключ: если нет email, используем ID
            const key = email || `no-email-${supplier.id}`;
            
            if (!suppliersByEmail.has(key)) {
              suppliersByEmail.set(key, []);
            }
            
            suppliersByEmail.get(key)!.push(supplier);
          });
          
          console.log(`💼 Found ${suppliersByEmail.size} unique supplier email groups from ${suppliersWithEmails.length} suppliers`);
          
          // FIXED: Use backend comparison instead of frontend grouping to get real emails
          console.log("🔄 Using backend comparison to consolidate authentic supplier emails");
          
          try {
            const comparisonResult = await apiRequest('/api/compare-fixed', {
              method: 'POST',
              body: JSON.stringify({
                suppliers: suppliers.map(s => ({ id: s.id })),
                parameters: parameters,
                requestId: requestId
              })
            });
            
            if (comparisonResult && comparisonResult.supplierDetails) {
              console.log("✅ Backend comparison successful - using real supplier emails:");
              comparisonResult.supplierDetails.forEach((supplier: any) => {
                console.log(`📧 ${supplier.name}: ${supplier.email}`);
              });
              
              setComparisonData(comparisonResult);
              setHasInitiatedComparison(true);
              
              // Fetch improvement counts for all suppliers after comparison data is loaded
              fetchImprovementCounts(comparisonResult.supplierDetails);
              
              return; // Exit here - no need for frontend processing
            } else {
              console.warn("⚠️ Backend returned no supplier details");
            }
          } catch (error) {
            console.error("❌ Backend comparison failed:", error);
          }
          
          // FALLBACK: Continue with frontend processing only if backend fails
          console.log("⚠️ Falling back to frontend comparison logic");
          
          // Используем существующую группировку по email
          suppliersByEmail.clear();
          
          // Fallback: Group by supplier emails with placeholders if backend fails
          suppliers.forEach(supplier => {
            const email = supplier.email ? supplier.email.toLowerCase().trim() : `no-email-${supplier.id}`;
            
            if (!suppliersByEmail.has(email)) {
              suppliersByEmail.set(email, []);
            }
            
            suppliersByEmail.get(email)!.push(supplier);
          });
          
          console.log(`📧 Найдено ${suppliersByEmail.size} уникальных email адресов из ${suppliers.length} поставщиков`);
          
          // Теперь создаем ОДИН уникальный объект поставщика на каждый email
          // Собираем все ID ответов для каждого email и анализируем историю изменений
          const uniqueSuppliers = Array.from(suppliersByEmail.entries()).map(([email, suppliersGroup]) => {
            // Сортируем ответы по дате (от старых к новым)
            const sortedResponses = [...suppliersGroup].sort((a, b) => {
              const dateA = a.responseDate instanceof Date ? a.responseDate.getTime() : 0;
              const dateB = b.responseDate instanceof Date ? b.responseDate.getTime() : 0;
              return dateA - dateB;
            });
            
            // Выбираем лучшее имя из группы (самое длинное или первое)
            const bestName = sortedResponses
              .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))[0].name;
            
            // Формируем более понятное имя с улучшенным форматированием
            const displayName = bestName || (email !== 'no-email' ? email : 'Неуказан');
              
            // Собираем ВСЕ ID ответов этого поставщика для анализа в одной группе
            const allResponseIds = sortedResponses.map(s => s.id).filter(Boolean);
            
            // Отслеживаем улучшения условий для этого поставщика
            const improvements: Record<string, {oldValue: string, newValue: string}> = {};
            
            // Если у нас более одного ответа от поставщика, анализируем изменения
            if (sortedResponses.length > 1) {
              console.log(`📈 Анализируем историю изменений для ${email} (${sortedResponses.length} ответов)`);
              
              // TODO: Полная реализация анализа улучшений будет доработана позже
              // Это пример того, как будет выглядеть логика
            }
            
            console.log(`📬 Email ${email}: ${suppliersGroup.length} ответов, ID: ${allResponseIds.join(', ')}`);
            
            // Создаем обновленный объект поставщика с улучшенным отображением имени
            
            return {
              id: sortedResponses[0].id, // Используем ID первого поставщика из группы
              name: displayName,
              email: email,
              allResponseIds: allResponseIds,
              responseCount: suppliersGroup.length,
              improvements: improvements, // Храним историю улучшений для отображения
              firstResponse: sortedResponses[0],
              lastResponse: sortedResponses[sortedResponses.length - 1]
            };
          });
          
          console.log(`✅ Сгруппировано в ${uniqueSuppliers.length} уникальных поставщиков по email`);
          
          console.log(`👥 Consolidated to ${uniqueSuppliers.length} unique suppliers`);
          uniqueSuppliers.forEach(s => {
            console.log(`  - ${s.name} (${s.email || 'no email'}): ${s.responseCount} responses, IDs: ${s.allResponseIds.join(', ')}`);
          });
          
          // ЭТАП 3: ИЗМЕНЕНО - Извлекаем параметры для КАЖДОГО поставщика индивидуально
          console.log("🔄 Processing each supplier individually for parameter extraction...");
          
          const supplierGroupResponses = await Promise.all(
            uniqueSuppliers.map(async (supplier) => {
              // Для каждого поставщика извлекаем параметры только из его собственного ответа
              const allExtractedParams: Record<string, any> = {};
              
              // Инициализируем все параметры значением по умолчанию
              selectedParameters.forEach(param => {
                allExtractedParams[param] = {
                  name: param,
                  value: '-'
                };
              });
              
              // FIXED: Process ALL responses from this supplier and merge their data
              if (supplier.allResponseIds && supplier.allResponseIds.length > 0) {
                console.log(`📊 Extracting parameters for supplier ${supplier.name} from ${supplier.allResponseIds.length} emails (IDs: ${supplier.allResponseIds.join(', ')})`);
                
                // Process each response from this supplier
                for (const responseId of supplier.allResponseIds) {
                  try {
                    console.log(`  📧 Processing email ${responseId} for ${supplier.name}`);
                    const extractedParams = await extractParametersForSupplier(responseId, selectedParameters);
                    
                    // Merge parameters from this response, tracking value changes
                    extractedParams.forEach((param: any) => {
                      const paramName = param.name;
                      const paramValue = param.value;
                      
                      // Skip empty or default values
                      if (!paramValue || paramValue === '-' || paramValue.trim() === '') {
                        return;
                      }
                      
                      // If we don't have this parameter yet, or current value is empty, use this one
                      if (!allExtractedParams[paramName] || 
                          !allExtractedParams[paramName].value || 
                          allExtractedParams[paramName].value === '-') {
                        allExtractedParams[paramName] = {
                          ...param,
                          previousValue: null, // No previous value
                          isUpdated: false
                        };
                        console.log(`    ✓ New parameter "${paramName}" = "${paramValue}" from email ${responseId}`);
                      } else {
                        // We already have a value - compare and potentially update
                        const existingValue = allExtractedParams[paramName].value;
                        
                        // Check if this is a different value (indicating an update)
                        if (paramValue !== existingValue) {
                          console.log(`    🔄 Parameter "${paramName}" updated: "${existingValue}" → "${paramValue}" from email ${responseId}`);
                          
                          // Store both values to show change in UI
                          allExtractedParams[paramName] = {
                            ...param,
                            previousValue: existingValue, // Keep the old value
                            isUpdated: true, // Mark as updated
                            updateSource: responseId // Track which email provided the update
                          };
                        } else {
                          // Same value, keep existing (no change needed)
                          console.log(`    ℹ️ Parameter "${paramName}" unchanged: "${existingValue}" from email ${responseId}`);
                        }
                      }
                    });
                  } catch (error) {
                    console.error(`Error extracting parameters from email ${responseId} for supplier ${supplier.name}:`, error);
                  }
                }
              } else {
                console.warn(`⚠️ No response IDs found for supplier ${supplier.name} (ID: ${supplier.id})`);
              }
              
              // Преобразуем обратно в массив для совместимости
              const finalParams = Object.values(allExtractedParams);
              
              return {
                id: supplier.id,
                name: supplier.name,
                email: supplier.email,
                parameters: finalParams,
                responseIds: supplier.allResponseIds,
                responseCount: 1 // Всегда 1, так как каждый поставщик отображается отдельно
              };
            })
          );
          
          console.log(`💼 Extracted parameters for ${supplierGroupResponses.length} individual suppliers`);
          
          console.log("✅ Processed all supplier groups:", supplierGroupResponses);
          
          // ЭТАП 4: Преобразуем в формат таблицы для отображения с отслеживанием изменений
          const tableData = selectedParameters.map(paramName => {
            const row: Record<string, any> = { parameter: paramName };
            
            // Для каждого уникального поставщика добавляем значения параметров в строку
            supplierGroupResponses.forEach((supplier, index) => {
              const param = supplier.parameters.find((p: any) => p.name === paramName);
              const paramValue = param?.value || '-';
              
              // Enhanced value display with previous values
              let displayValue = paramValue;
              
              // If parameter has been updated, show previous value in parentheses
              if (param && param.isUpdated && param.previousValue) {
                displayValue = `${paramValue} (ранее: ${param.previousValue})`;
                console.log(`📝 Parameter "${paramName}" for ${supplier.name}: ${param.previousValue} → ${paramValue}`);
              }
              
              // Store both raw value and display value for different use cases
              const cellData = {
                value: paramValue,
                displayValue: displayValue,
                isUpdated: param?.isUpdated || false,
                previousValue: param?.previousValue || null
              };
              
              // Различные способы доступа к данным для надежного отображения
              // 1. По ID поставщика с префиксом (надежнее всего) - используем объект с метаданными
              row[`supplier_${supplier.id}`] = cellData;
              
              // 2. По имени поставщика - используем строку для обратной совместимости
              row[supplier.name] = displayValue;
              
              // 3. По индексу в списке (Поставщик 1, Поставщик 2, etc.)
              row[`${index + 1}`] = displayValue;
              row[`Поставщик ${index + 1}`] = displayValue;
              
              // 4. По email для удобства отладки
              if (supplier.email) {
                row[`email_${supplier.email}`] = displayValue;
              }
            });
            
            return row;
          });
          
          if (tableData.length > 0) {
            console.log('📊 Sample of first table row:', tableData[0]);
            console.log('👤 Supplier details:', supplierGroupResponses.map(s => ({
              id: s.id,
              email: s.email,
              phone: '',
              website: '',
              contactName: ''
            })));
          }
          
          // Формируем ответ с каждым поставщиком в отдельном столбце
          const response: ComparisonData = {
            tableData: tableData,
            supplierDetails: supplierGroupResponses.map((s, index) => {
              // Упрощенный подход - используем имя и email напрямую
              const supplierName = s.name || `Поставщик ${index + 1}`;
              const supplierEmail = s.email || '';
              
              console.log(`Processed supplier ${index + 1}:`, {
                id: s.id, 
                name: supplierName,
                email: supplierEmail
              });
              
              // Создаем объект поставщика с необходимыми полями
              return {
                id: s.id, 
                name: supplierName,
                email: supplierEmail,
                phone: '', // Пустые значения для необязательных полей
                website: '',
                contactName: ''
              };
            }),
            parameters: selectedParameters,
            requestId: requestId || 0,
            aiAnalysis: "Анализ поставщиков будет сгенерирован на следующем шаге...",
            csv: '', // Пустая строка для CSV
            filename: `comparison_${new Date().toISOString().split('T')[0]}.csv` // Имя файла для скачивания
          };
          
          // Расширенное логирование для отладки
          console.log("🔍 Generated comparison data:", response);
          console.log("📊 Table data available:", !!response.tableData);
          
          // Дополнительная проверка данных
          if (response.tableData && response.tableData.length > 0) {
            console.log("📊 First row of table data:", response.tableData[0]);
            console.log("🔑 All keys in first row:", Object.keys(response.tableData[0]));
          } else {
            console.warn("⚠️ No table data was found in response!");
          }
          
          // Проверим данные поставщиков
          if (response.supplierDetails && response.supplierDetails.length > 0) {
            console.log("👤 Supplier details:", response.supplierDetails);
          } else {
            console.warn("⚠️ No supplier details in response!");
          }
          
          if (!response.tableData) {
            console.warn("Missing tableData in response. Server didn't include table information.");
          }
          
          // Expand all suppliers by default
          if (response.supplierDetails && response.supplierDetails.length > 0) {
            const initialExpandState: Record<string, boolean> = {};
            response.supplierDetails.forEach(supplier => {
              initialExpandState[supplier.id] = true;
            });
            setExpandedSuppliers(initialExpandState);
          }

          setComparisonData(response);

        } catch (error) {
          console.error("Error generating comparison:", error);
          setError("Failed to generate comparison. Please try again.");

          toast({
            title: "Error generating comparison",
            description: error instanceof Error ? error.message : "An unexpected error occurred",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };

      generateComparison();
    }
  }, [suppliers, parameters, comparisonData, error, isLoading, requestId]);
  
  // Function to download comparison data as Excel
  const downloadExcel = () => {
    if (!comparisonData) {
      toast({
        title: "Ошибка экспорта",
        description: "Данные для сравнения недоступны",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // If original CSV data is available, use it first
      if (comparisonData.csv) {
        // Create a CSV blob with UTF-8 BOM for Excel
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, comparisonData.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `supplier-comparison-${requestId || new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      
      // Fallback: Generate CSV from tableData if csv isn't available
      if (comparisonData.tableData && comparisonData.tableData.length > 0) {
        // Get supplier names for column headers
        const supplierNames = comparisonData.supplierDetails?.map(s => s.name) || [];
        
        // Generate CSV content
        let csvContent = '\ufeff'; // UTF-8 BOM for Excel
        
        // Add header row
        csvContent += ['Параметр', ...supplierNames].join(';') + '\n';
        
        // Add data rows
        comparisonData.tableData.forEach(row => {
          // First column is always the parameter name
          let rowContent = row.parameter + ';';
          
          // Add value for each supplier
          supplierNames.forEach(supplierName => {
            const value = row[supplierName] || '-';
            // Escape semicolons and wrap in quotes if needed
            const formattedValue = value.includes(';') ? `"${value}"` : value;
            rowContent += formattedValue + ';';
          });
          
          csvContent += rowContent.slice(0, -1) + '\n'; // Remove trailing semicolon
        });
        
        // Create and download the CSV blob
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `supplier-comparison-${requestId || new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      
      // If we get here, no data is available
      throw new Error("Не удалось сформировать данные для экспорта");
      
    } catch (error) {
      console.error("Excel export error:", error);
      toast({
        title: "Ошибка экспорта",
        description: error instanceof Error ? error.message : "Не удалось экспортировать данные",
        variant: "destructive"
      });
    }
  };
  
  // Function to generate AI analysis
  const generateAnalysis = async () => {
    if (!comparisonData || !comparisonData.supplierDetails || !parameters.length) {
      toast({
        title: "Ошибка",
        description: "Нет данных для анализа",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingAnalysis(true);
    setAnalysisError(null);

    try {
      // Prepare suppliers data for analysis
      const suppliersForAnalysis = comparisonData.supplierDetails.map(supplier => ({
        id: supplier.id,
        name: supplier.name,
        email: supplier.email
      }));

      const analysisRequest = {
        suppliers: suppliersForAnalysis,
        parameters: parameters,
        requestId: requestId
      };

      console.log('Sending analysis request:', analysisRequest);

      // Use direct fetch to avoid authentication interference
      const response = await fetch('/api/generate-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(analysisRequest),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result && result.analysis) {
        setAiAnalysisResult(result.analysis);
        toast({
          title: "Анализ завершен",
          description: "AI анализ успешно сформирован",
          variant: "default"
        });
      } else {
        throw new Error('Получен некорректный ответ от сервера');
      }
    } catch (error) {
      console.error('Error generating analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setAnalysisError(errorMessage);
      toast({
        title: "Ошибка анализа",
        description: `Не удалось сформировать анализ: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  // Function to download comparison data as PDF
  const downloadPdf = () => {
    try {
      // Create PDF document
      const doc = new jsPDF();
      
      // Set title
      doc.setFontSize(20);
      doc.text('Сравнение предложений поставщиков', 20, 20);
      
      doc.setFontSize(12);
      const today = new Date();
      doc.text(`Создано: ${format(today, 'dd.MM.yyyy HH:mm')}`, 20, 30);
      
      if (requestId) {
        doc.text(`Запрос №: ${requestId}`, 20, 36);
      }
      
      // If we have AI analysis, use that for a more structured PDF
      if (comparisonData && comparisonData.aiAnalysis) {
        try {
          const parsedData = parseAnalysisContent(comparisonData.aiAnalysis);
          
          // Add suppliers table
          doc.setFontSize(16);
          doc.text('Сравнительная таблица', 20, 46);
          
          let yPos = 56;
          const xPos = 20;
          
          // Create table header
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text('Параметр', xPos, yPos);
          
          let supplierXPos = 80;
          parsedData.suppliers.forEach(supplier => {
            doc.text(supplier, supplierXPos, yPos);
            supplierXPos += 40;
          });
          
          yPos += 6;
          doc.line(xPos, yPos, supplierXPos - 10, yPos);
          yPos += 6;
          
          // Draw table rows
          doc.setTextColor(0, 0, 0);
          Object.entries(parsedData.data).forEach(([param, values]) => {
            doc.text(param, xPos, yPos);
            
            supplierXPos = 80;
            parsedData.suppliers.forEach(supplier => {
              doc.text(values[supplier] || '-', supplierXPos, yPos);
              supplierXPos += 40;
            });
            
            yPos += 6;
            
            if (yPos > 270) {
              // Add new page if we're reaching the bottom
              doc.addPage();
              yPos = 20;
            }
          });
          
          // Add recommendation section
          yPos += 10;
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFontSize(16);
          doc.text('Рекомендации', xPos, yPos);
          yPos += 10;
          
          if (parsedData.recommendation) {
            // Split recommendation into lines that fit on the page
            const lines = doc.splitTextToSize(parsedData.recommendation, 180);
            
            doc.setFontSize(10);
            lines.forEach((line: string) => {
              doc.text(line, xPos, yPos);
              yPos += 6;
              
              if (yPos > 280) {
                doc.addPage();
                yPos = 20;
              }
            });
          }
        } catch (error) {
          console.error('Error formatting PDF content with AI analysis:', error);
        }
      }
      // Otherwise, just include the basic table
      else if (comparisonData && comparisonData.tableData) {
        // Convert HTML table to PDF
        if (comparisonData.htmlTable) {
          const tableContent = htmlToPdfmake(comparisonData.htmlTable);
          
          // This positioning and styling is simplified
          doc.text('Сравнительная таблица', 20, 46);
          
          // Render the table content (simplified)
          const tableStartY = 56;
          doc.html(comparisonData.htmlTable, {
            x: 20,
            y: tableStartY,
            width: 170
          });
        }
      }
      
      // Save the PDF file
      doc.save(`supplier-comparison-${requestId || new Date().toISOString().slice(0, 10)}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "PDF Generation Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Toggle supplier details
  const toggleSupplier = (supplierId: number) => {
    setExpandedSuppliers(prev => ({
      ...prev,
      [supplierId]: !prev[supplierId]
    }));
  };
  
  // Function to save analysis results to database
  const saveAnalysis = async (showConfirmation: boolean = false) => {
    try {
      if (!comparisonData) {
        throw new Error("Данные для сравнения недоступны");
      }
      
      // Extract recommended supplier from analysis content
      let recommendedSupplier: string | null = null;
      let recommendationReason: string | null = null;
      
      try {
        if (comparisonData.aiAnalysis) {
          const parsedData = parseAnalysisContent(comparisonData.aiAnalysis);
          
          // Look for explicit recommendation pattern
          const recommendationMatch = parsedData.recommendation.match(/recommend(?:ed)?\s+(?:to\s+)?(?:choose|select|go\s+with)\s+([^\.]+)/i);
          if (recommendationMatch && recommendationMatch[1]) {
            recommendedSupplier = recommendationMatch[1].trim();
            
            // Try to find reason
            const reasonMatch = parsedData.recommendation.match(/because\s+([^\.]+)/i);
            if (reasonMatch && reasonMatch[1]) {
              recommendationReason = reasonMatch[1].trim();
            }
          }
        }
      } catch (error) {
        console.error("Error parsing analysis for recommendation:", error);
      }
      
      // Generate HTML representation of the comparison table
      let tableHtml = '<table border="1" style="border-collapse: collapse; width: 100%;">';
      
      // Add table header
      tableHtml += '<thead><tr style="background-color: #f1f5f9;"><th style="padding: 8px; text-align: left;">Параметр</th>';
      
      // Add supplier names to header
      comparisonData.supplierDetails?.forEach((supplier, index) => {
        // Format the supplier display name properly
        const supplierName = supplier.name && supplier.name !== supplier.email 
          ? supplier.name 
          : `Поставщик ${index + 1}`;
        
        // Add email if available
        const emailDisplay = supplier.email ? ` (${supplier.email})` : '';
        
        tableHtml += `<th style="padding: 8px; text-align: left;">${supplierName}${emailDisplay}</th>`;
      });
      
      tableHtml += '</tr></thead><tbody>';
      
      // Add table rows from comparisonData.tableData
      if (comparisonData.tableData && comparisonData.tableData.length > 0) {
        comparisonData.tableData.forEach((row, index) => {
          // Alternate row background for better readability
          const rowStyle = index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;';
          tableHtml += `<tr style="${rowStyle}">`;
          
          // Add parameter name
          tableHtml += `<td style="padding: 8px; border: 1px solid #e2e8f0;">${row.parameter}</td>`;
          
          // Add values for each supplier
          comparisonData.supplierDetails?.forEach(supplier => {
            const email = supplier.email?.toLowerCase().trim() || '';
            const emailKey = email ? `email_${email}` : null;
            
            // Try to find the value using the email key first, then fall back to supplier name
            let cellValue = '-';
            if (emailKey && row[emailKey] !== undefined) {
              cellValue = row[emailKey];
            } else if (row[supplier.name] !== undefined) {
              cellValue = row[supplier.name];
            }
            
            // Check if there are improvements for this parameter
            let cellClass = '';
            if (supplier.improvements && supplier.improvements[row.parameter]) {
              const improvement = supplier.improvements[row.parameter];
              cellClass = 'has-improvement';
              // Format the cell to show improvement
              cellValue = `${improvement.newValue} <span style="color: #10b981; font-size: 0.9em;">(снижение от ${improvement.oldValue})</span>`;
            }
            
            tableHtml += `<td style="padding: 8px; border: 1px solid #e2e8f0;" class="${cellClass}">${cellValue}</td>`;
          });
          
          tableHtml += '</tr>';
        });
      }
      
      tableHtml += '</tbody></table>';
      
      // Add improvements section if available
      let improvementsHtml = '';
      let hasImprovements = false;
      
      comparisonData.supplierDetails?.forEach(supplier => {
        if (supplier.improvements && Object.keys(supplier.improvements).length > 0) {
          hasImprovements = true;
          improvementsHtml += `
            <div style="margin-top: 20px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px;">
              <h3 style="margin-top: 0;">Улучшения от ${supplier.name}</h3>
              <ul style="padding-left: 20px;">
          `;
          
          Object.entries(supplier.improvements).forEach(([param, improvement]) => {
            improvementsHtml += `
              <li>
                <strong>${param}:</strong> ${improvement.oldValue} → ${improvement.newValue}
                ${improvement.description ? `<br/><em>${improvement.description}</em>` : ''}
              </li>
            `;
          });
          
          improvementsHtml += '</ul></div>';
        }
      });
      
      // Combine table, improvements, and AI analysis
      const completeAnalysisContent = `
        <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
          <h2 style="color: #334155;">Сравнение поставщиков</h2>
          <p>Сравнение ${comparisonData.supplierDetails?.length || 0} поставщиков по ${comparisonData.parameters?.length || 0} параметрам.</p>
          
          <div style="margin: 20px 0;">
            ${tableHtml}
          </div>
          
          ${hasImprovements ? `
            <h2 style="color: #334155; margin-top: 30px;">История улучшений</h2>
            <p>Улучшения условий, которые были получены в процессе переговоров:</p>
            ${improvementsHtml}
          ` : ''}
          
          ${comparisonData.aiAnalysis ? `
            <h2 style="color: #334155; margin-top: 30px;">Анализ</h2>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; line-height: 1.5;">
              ${comparisonData.aiAnalysis.replace(/\n/g, '<br>')}
            </div>
          ` : ''}
        </div>
      `;
      
      // Prepare data for saving
      const analysisData: Omit<InsertAnalysisResult, "id" | "dateCreated"> = {
        requestId: requestId || Math.floor(Math.random() * 100000),
        parameters: comparisonData.parameters || originalRequestParameters || parameters.map(p => typeof p === 'string' ? p : String(p)), 
        title: `Сравнение ${comparisonData.supplierDetails?.length || 0} поставщиков`,
        userId: null,
        comparedSuppliers: comparisonData.supplierDetails?.map(s => s.id) || [],
        recommendedSupplier,
        recommendationReason,
        analysisContent: completeAnalysisContent,
        pdfUrl: null
      };
      
      console.log("Saving enhanced analysis with table and improvements");
      
      // Save to database
      await saveAnalysisMutation.mutate(analysisData);
      
      if (showConfirmation) {
        toast({
          title: "Анализ сохранен",
          description: "Результат сохранен карточке запроса в разделе Анализ результатов",
        });
      }
      
    } catch (error) {
      console.error("Error saving analysis:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось сохранить анализ",
        variant: "destructive"
      });
    }
  };

  // Export to Excel function
  const exportToExcel = () => {
    if (!comparisonData) return;

    // Get the HTML content which is properly formatted for Excel
    const htmlContent = comparisonData.csv;

    // Create blob with UTF-16 BOM for better Excel compatibility
    const bom = "\ufeff"; // UTF-16 BOM
    const blob = new Blob([bom + htmlContent], { 
      type: 'application/vnd.ms-excel;charset=utf-8;' 
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `supplier-comparison-${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Excel файл загружен",
      description: "Сравнение поставщиков сохранено в Excel формате",
    });
  };

  // Render component
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      
      <SubscriptionGuard isActive={isActiveOrLoading}>
        <main className="container mx-auto py-6 px-4 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Сравнение предложений поставщиков</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Автоматическое сравнение предложений от поставщиков по выбранным параметрам
            </p>
          </div>
          
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button 
              variant="outline" 
              className="gap-1"
              onClick={() => setLocation(`/requests/${requestId}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
            
            {comparisonData && (
              <>
                <Button 
                  variant="outline" 
                  className="gap-1"
                  onClick={() => saveAnalysis(true)}
                  disabled={saveAnalysisMutation.isLoading}
                >
                  <Save className="h-4 w-4" />
                  {saveAnalysisMutation.isLoading ? 'Сохранение...' : 'Сохранить анализ'}
                </Button>
                
                <Button 
                  variant="outline" 
                  className="gap-1"
                  onClick={exportToExcel}
                >
                  <Download className="h-4 w-4" />
                  Скачать Excel
                </Button>
              </>
            )}
          </div>
        </div>
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Spinner className="h-12 w-12 mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium">Выполняем сравнение...</p>
              <p className="text-sm text-gray-500 mt-2">
                Пожалуйста, подождите, мы анализируем предложения поставщиков 
                и формируем сравнительный отчет
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
            <p className="text-red-800 font-medium">{error}</p>
            <Button 
              variant="outline" 
              className="mt-2"
              onClick={() => setLocation('/compare-parameters')}
            >
              Вернуться к выбору параметров
            </Button>
          </div>
        )}
        {comparisonData && (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "table" | "analysis")}>
            
            <TabsContent value="table">
              <Card>
                
                <CardContent>
                  {/* Unified Scrollable Container for all three sections */}
                  <div className="overflow-x-auto relative">
                    {/* Sort Dropdown - positioned outside table structure */}
                    {showSortDropdown && (
                      <div className="fixed inset-0 z-40" onClick={() => setShowSortDropdown(false)}>
                        <div 
                          className="absolute top-32 left-72 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2">
                            <div className="text-xs font-medium text-gray-700 mb-2">Сортировать по:</div>
                            
                            {/* Default sorting options */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔄 Name sort clicked');
                                const newSortOrder = sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc';
                                setSortBy('name');
                                setSortOrder(newSortOrder);
                                setShowSortDropdown(false);
                              }}
                              className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded flex items-center justify-between"
                            >
                              <span>Название</span>
                              {sortBy === 'name' && (
                                <span className="text-blue-600">
                                  {sortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔄 Email sort clicked');
                                const newSortOrder = sortBy === 'email' && sortOrder === 'asc' ? 'desc' : 'asc';
                                setSortBy('email');
                                setSortOrder(newSortOrder);
                                setShowSortDropdown(false);
                              }}
                              className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded flex items-center justify-between"
                            >
                              <span>Email</span>
                              {sortBy === 'email' && (
                                <span className="text-blue-600">
                                  {sortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔄 ResponseCount sort clicked');
                                const newSortOrder = sortBy === 'responseCount' && sortOrder === 'asc' ? 'desc' : 'asc';
                                setSortBy('responseCount');
                                setSortOrder(newSortOrder);
                                setShowSortDropdown(false);
                              }}
                              className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded flex items-center justify-between"
                            >
                              <span>Количество улучшений</span>
                              {sortBy === 'responseCount' && (
                                <span className="text-blue-600">
                                  {sortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </button>
                            
                            {/* Parameters from comparison data */}
                            {comparisonData?.tableData && comparisonData.tableData.length > 0 && (
                              <>
                                <div className="border-t border-gray-200 my-2"></div>
                                <div className="text-xs font-medium text-gray-700 mb-2">По параметрам:</div>
                                {comparisonData.tableData.map((row, index) => {
                                  const param = row.parameter || row.Parameter;
                                  return param ? (
                                    <button
                                      key={index}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log(`🔄 Parameter sort clicked: "${param}"`);
                                        console.log('🔄 Current sortBy:', sortBy, 'Current sortOrder:', sortOrder);
                                        
                                        const newSortOrder = sortBy === param && sortOrder === 'asc' ? 'desc' : 'asc';
                                        console.log(`🔄 Setting: sortBy="${param}", sortOrder="${newSortOrder}"`);
                                        
                                        setSortBy(param);
                                        setSortOrder(newSortOrder);
                                        setShowSortDropdown(false);
                                      }}
                                      className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded flex items-center justify-between"
                                    >
                                      <span className="truncate">{param}</span>
                                      {sortBy === param && (
                                        <span className="text-blue-600 ml-2">
                                          {sortOrder === 'asc' ? '↑' : '↓'}
                                        </span>
                                      )}
                                    </button>
                                  ) : null;
                                })}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {(() => {
                      // Sort suppliers using the custom sorting function
                      const sortedSuppliers = sortSuppliers(
                        comparisonData?.supplierDetails || [], 
                        sortBy, 
                        sortOrder
                      );

                      return (
                        <div className="min-w-max">
                          {/* Comparison Table */}
                          <table className="w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider w-48 sticky left-0 bg-gray-50 z-10">
                                  <div className="flex items-center justify-between">
                                    <span>Поставщик</span>
                                    <div className="relative sort-dropdown-container">
                                      <button
                                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                                        title="Сортировать поставщиков"
                                      >
                                        <ArrowUpDown className="h-4 w-4 text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                </th>
                                {sortedSuppliers.map((supplier, index) => {
                                  // Format the supplier display name properly
                                  const supplierName = supplier.name && supplier.name !== supplier.email
                                    ? supplier.name
                                    : `Поставщик ${index + 1}`;
                                  
                                  // Create unique display name for suppliers with same name but different emails
                                  const displayName = (() => {
                                    const sameNameSuppliers = sortedSuppliers.filter(s => s.name === supplier.name);
                                    if (sameNameSuppliers.length > 1) {
                                      // For duplicates, show shortened name + domain
                                      const emailDomain = supplier.email ? supplier.email.split('@')[1] : '';
                                      const shortName = supplier.name.length > 25 
                                        ? supplier.name.substring(0, 25) + '...' 
                                        : supplier.name;
                                      return `${shortName} (${emailDomain})`;
                                    }
                                    // For unique names, truncate if too long
                                    return supplier.name.length > 35 
                                      ? supplier.name.substring(0, 35) + '...' 
                                      : supplier.name;
                                  })();
                                  
                                  return (
                                    <th key={index} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[240px] max-w-[240px] w-[240px]">
                                      <div className="font-bold truncate" title={displayName}>
                                        {displayName}
                                      </div>
                                      {supplier.email && (
                                        <div className="text-xs font-medium text-blue-600 normal-case mt-1">
                                          <span className="inline-flex items-center">
                                            <Mail className="h-3 w-3 mr-1" />
                                            <span className="truncate" title={supplier.email}>{supplier.email}</span>
                                          </span>
                                        </div>
                                      )}
                                      {supplier.responseCount && supplier.responseCount > 1 && (
                                        <div className="text-xs font-normal text-green-600 normal-case mt-1" style={{ display: 'none' }}>
                                          {supplier.responseCount} ответа
                                        </div>
                                      )}
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {comparisonData?.tableData?.map((row, rowIndex) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-48 sticky left-0 bg-inherit z-10">
                                    {row.parameter || row.Parameter}
                                  </td>
                                  {sortedSuppliers.map((supplier, supplierIndex) => {
                                    // Simplified and strict cell value lookup
                                    let cellValue = '-';
                                    const supplierId = supplier.id?.toString();
                                    const supplierName = supplier.name || `Поставщик ${supplierIndex + 1}`;
                                    const supplierEmail = supplier.email ? supplier.email.toLowerCase().trim() : '';
                                    const emailKey = supplierEmail ? `email_${supplierEmail}` : null;
                                    
                                    // CRITICAL FIX: Use email as primary key to prevent data collision
                                    if (supplierEmail && row[supplierEmail] !== undefined) {
                                      cellValue = row[supplierEmail];
                                    }
                                    // FALLBACK: Try supplier name for backward compatibility
                                    else if (row[supplierName] !== undefined) {
                                      cellValue = row[supplierName];
                                    }
                                    // FALLBACK: Try email-based lookup for compatibility
                                    else if (emailKey && row[emailKey] !== undefined) {
                                      cellValue = row[emailKey];
                                    } 
                                    // ID-based fallback
                                    else if (supplierId && row[`supplier_${supplierId}`] !== undefined) {
                                      cellValue = row[`supplier_${supplierId}`];
                                    }
                                    // Default case
                                    else {
                                      cellValue = "-";
                                    }
                                    
                                    // Enhanced parsing for both old and new improvement patterns
                                    const parseImprovement = (value: any) => {
                                      // Handle object format from enhanced data
                                      if (typeof value === 'object' && value !== null) {
                                        if (value.displayValue || value.value) {
                                          return {
                                            current: value.value || value.displayValue,
                                            previous: value.previousValue,
                                            isUpdated: value.isUpdated || false
                                          };
                                        }
                                      }
                                      
                                      if (typeof value !== 'string') return { current: value, previous: null, isUpdated: false };
                                      
                                      // Check for our new pattern: "50000 рублей (ранее: 45000 рублей)"
                                      const newPatternMatch = value.match(/^(.+?)\s*\(ранее:\s*(.+?)\)$/);
                                      if (newPatternMatch) {
                                        return {
                                          current: newPatternMatch[1].trim(),
                                          previous: newPatternMatch[2].trim(),
                                          isUpdated: true
                                        };
                                      }
                                      
                                      // Check for old HTML span pattern: "2 дня <span...>(было: 3 дня)</span>"
                                      const htmlMatch = value.match(/^(.+?)\s*<span[^>]*>\(было:\s*(.+?)\)<\/span>$/);
                                      if (htmlMatch) {
                                        return {
                                          current: htmlMatch[1].trim(),
                                          previous: htmlMatch[2].trim(),
                                          isUpdated: true
                                        };
                                      }
                                      
                                      return { current: value, previous: null, isUpdated: false };
                                    };
                                    
                                    const { current, previous, isUpdated } = parseImprovement(cellValue);
                                    
                                    // Determine arrow direction and color based on parameter type and improvement
                                    const getArrowDisplay = (paramName: string, currentVal: string, previousVal: string) => {
                                      if (!currentVal || !previousVal || currentVal === previousVal) return null;
                                      
                                      const param = paramName.toLowerCase();
                                      let isImprovement = false;
                                      let arrowDirection = '↑';
                                      let colorClass = 'text-blue-600'; // neutral
                                      
                                      // Parse numeric values for comparison
                                      const parseNumeric = (val: string) => {
                                        const numStr = val.replace(/[^\d.,]/g, '').replace(',', '.');
                                        return parseFloat(numStr) || 0;
                                      };
                                      
                                      // Cost/Price parameters (lower is better)
                                      if (param.includes('стоимость') || param.includes('цена')) {
                                        const currentNum = parseNumeric(currentVal);
                                        const previousNum = parseNumeric(previousVal);
                                        if (currentNum < previousNum) {
                                          isImprovement = true;
                                          arrowDirection = '↓';
                                          colorClass = 'text-green-600';
                                        } else if (currentNum > previousNum) {
                                          arrowDirection = '↑';
                                          colorClass = 'text-red-600';
                                        }
                                      }
                                      // Delivery time parameters (faster/shorter is better)
                                      else if (param.includes('срок')) {
                                        // For delivery times, shorter is better
                                        const currentNum = parseNumeric(currentVal);
                                        const previousNum = parseNumeric(previousVal);
                                        if (currentNum < previousNum) {
                                          isImprovement = true;
                                          arrowDirection = '↓';
                                          colorClass = 'text-green-600';
                                        } else if (currentNum > previousNum) {
                                          arrowDirection = '↑';
                                          colorClass = 'text-red-600';
                                        }
                                      }
                                      // Warranty/Guarantee parameters (longer is better)
                                      else if (param.includes('гарантия')) {
                                        const currentNum = parseNumeric(currentVal);
                                        const previousNum = parseNumeric(previousVal);
                                        if (currentNum > previousNum) {
                                          isImprovement = true;
                                          arrowDirection = '↑';
                                          colorClass = 'text-green-600';
                                        } else if (currentNum < previousNum) {
                                          arrowDirection = '↓';
                                          colorClass = 'text-red-600';
                                        }
                                      }
                                      
                                      return (
                                        <div className={`flex-shrink-0 mt-1 font-bold text-base ${colorClass}`}>
                                          {arrowDirection}
                                        </div>
                                      );
                                    };

                                    // Check if this cell is being edited
                                    const isEditing = editingCell?.parameter === (row.parameter || row.Parameter) && editingCell?.supplierId === supplier.id;
                                    
                                    return (
                                      <td key={supplierIndex} className="px-3 py-4 text-sm text-gray-500 min-w-[240px] max-w-[240px] w-[240px]">
                                        <div className="flex items-start gap-2">
                                          {previous && isUpdated && getArrowDisplay(row.parameter || row.Parameter || '', current, previous)}
                                          <div className="min-w-0 flex-1">
                                            {isEditing ? (
                                              <div className="flex flex-col gap-2">
                                                <input
                                                  type="text"
                                                  value={editedValue}
                                                  onChange={(e) => setEditedValue(e.target.value)}
                                                  className="w-full p-2 border border-gray-300 rounded text-sm"
                                                  autoFocus
                                                  onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                      saveCellValue();
                                                    } else if (e.key === 'Escape') {
                                                      cancelEditingCell();
                                                    }
                                                  }}
                                                />
                                                <div className="flex gap-2 mt-2">
                                                  <button
                                                    onClick={saveCellValue}
                                                    disabled={isSavingCell}
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                                    title="Сохранить"
                                                  >
                                                    {isSavingCell ? (
                                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                      </svg>
                                                    )}
                                                  </button>
                                                  <button
                                                    onClick={cancelEditingCell}
                                                    disabled={isSavingCell}
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                                    title="Отмена"
                                                  >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div 
                                                className="font-normal text-gray-900 text-sm break-words cursor-pointer hover:bg-gray-50 p-1 rounded"
                                                onClick={() => startEditingCell(row.parameter || row.Parameter || '', supplier.id, current)}
                                                title="Нажмите для редактирования"
                                              >
                                                {current}
                                              </div>
                                            )}
                                            {previous && isUpdated && !isEditing && (
                                              <div className="text-xs text-gray-500 mt-1 break-words">
                                                (было: {previous})
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                              
                              {/* Compliance Check Row - Hide when winner is selected */}
                              {!selectedWinner && (
                                <tr className="bg-blue-50 border-t-2 border-blue-200">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-48 sticky left-0 bg-blue-50 z-10">
                                    Проверка соответствия
                                  </td>
                                {sortedSuppliers.map((supplier, supplierIndex) => {
                                  // Check if all parameters have data for this supplier
                                  const missingParams: string[] = [];
                                  const providedParams: string[] = [];
                                  
                                  comparisonData.tableData?.forEach(row => {
                                    const paramName = row['Parameter'];
                                    if (paramName) {
                                      let cellValue = '-';
                                      
                                      // CRITICAL FIX: Use email-based lookup to match main table logic
                                      const supplierEmail = supplier.email ? supplier.email.toLowerCase().trim() : '';
                                      if (supplierEmail && row[supplierEmail] !== undefined) {
                                        cellValue = row[supplierEmail];
                                      }
                                      // FALLBACK: Try supplier name for backward compatibility
                                      else if (row[supplier.name] !== undefined) {
                                        cellValue = row[supplier.name];
                                      }
                                      
                                      // Parse the cell value to get the actual content
                                      const parseValue = (value: string) => {
                                        if (typeof value !== 'string') return value;
                                        const htmlMatch = value.match(/^(.+?)\s*<span[^>]*>/);
                                        return htmlMatch ? htmlMatch[1].trim() : value;
                                      };
                                      
                                      const actualValue = parseValue(cellValue);
                                      
                                      if (actualValue === '-' || actualValue === '' || !actualValue) {
                                        missingParams.push(paramName);
                                      } else {
                                        providedParams.push(paramName);
                                      }
                                    }
                                  });
                                  
                                  const isComplete = missingParams.length === 0;
                                  
                                  return (
                                    <td key={supplierIndex} className="px-3 py-4 text-center min-w-[240px] max-w-[240px] w-[240px]">
                                      {isComplete ? (
                                        <div 
                                          className="flex items-center justify-center cursor-help"
                                          title="Все запрашиваемые данные предоставлены"
                                        >
                                          <div className="bg-green-100 text-green-800 p-2 rounded-full">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center space-y-2">
                                          <div className="text-xs text-gray-600 text-center">
                                            Не все данные предоставлены
                                          </div>
                                          <DataRequestButton
                                            supplier={supplier}
                                            missingParams={missingParams}
                                            requestId={requestId}
                                          />
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                                </tr>
                              )}
                              
                              {/* Process Improvement Row - Hide when winner is selected */}
                              {!selectedWinner && (
                                <tr className="bg-orange-50 border-t-2 border-orange-200">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-48 sticky left-0 bg-orange-50 z-10">
                                    Процесс улучшения условий
                                  </td>
                                {sortedSuppliers.map((supplier, supplierIndex) => {
                                  return (
                                    <td key={supplierIndex} className="px-3 py-4 text-center min-w-[240px] max-w-[240px] w-[240px]">
                                      <div className="flex flex-col items-center space-y-2">
                                        <div className="text-xs text-gray-600 text-center">
                                          Запросить улучшение предложения
                                        </div>
                                        <ImprovementRequestButton
                                          supplier={supplier}
                                          requestId={requestId}
                                          improvementCount={improvementCounts[supplier.name] || 0}
                                        />
                                      </div>
                                    </td>
                                  );
                                })}
                                </tr>
                              )}
                              
                              {/* Winner Selection Row */}
                              <tr className={`border-t-2 ${selectedWinner ? 'bg-green-10 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-48 sticky left-0 z-10 ${selectedWinner ? 'bg-green-50' : 'bg-yellow-50'}`}>
                                  <div className="flex items-center space-x-2">
                                    
                                    <span>Определение победителя</span>
                                  </div>
                                </td>
                                {sortedSuppliers.map((supplier, supplierIndex) => {
                                  const isWinner = selectedWinner?.email === supplier.email;
                                  const isWinnerColumn = selectedWinner && selectedWinner.email === supplier.email;
                                  
                                  return (
                                    <td 
                                      key={supplierIndex} 
                                      className={`px-3 py-3 text-center min-w-[240px] max-w-[240px] w-[240px] ${
                                        isWinnerColumn ? 'bg-green-20 border-0 border-green-400 rounded-lg' : 
                                        selectedWinner ? 'opacity-50' : ''
                                      }`}
                                    >
                                      <div className="flex flex-col items-center space-y-2">
                                        {isWinner ? (
                                          <div className="text-center">
                                            <Button
                                              size="sm"
                                              variant="default"
                                              className="text-xs px-3 py-1 h-auto bg-green-600 hover:bg-green-700 text-white mb-2"
                                              disabled
                                            >
                                              <div className="flex items-center gap-1">
                                                <Crown className="w-3 h-3" />
                                                <span>Победитель определен</span>
                                              </div>
                                            </Button>
                                            <div>
                                              <button
                                                onClick={() => setShowCancelWinnerModal(true)}
                                                className="text-xs text-gray-400 hover:text-gray-700 underline"
                                              >
                                                отменить
                                              </button>
                                            </div>
                                          </div>
                                        ) : selectedWinner ? (
                                          <div className="text-xs text-gray-400 text-center">
                                            
                                          </div>
                                        ) : (
                                          <div className="text-center">
                                            <div className="text-xs text-gray-600 text-center mb-2">
                                              Выбрать поставщика победителем
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="default"
                                              onClick={() => {
                                                setSupplierToSelectAsWinner(supplier);
                                                setShowWinnerEmailModal(true);
                                              }}
                                              className="text-xs px-3 py-1 h-auto bg-blue-600 hover:bg-blue-700 text-white"
                                            >
                                              <div className="flex items-center gap-1">
                                                <Crown className="w-3 h-3" />
                                                <span>Выбрать победителем</span>
                                              </div>
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                  
                  
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="flex gap-2">
                    <Button 
                      variant="default" 
                      className="gap-1 bg-blue-500 hover:bg-blue-700"
                      onClick={generateAnalysis}
                      disabled={isGeneratingAnalysis || !comparisonData?.supplierDetails?.length}
                    >
                      
                      Сформировать выводы и рекомендации
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    {/* These buttons are intentionally hidden in this section to focus on improvement requests */}
                  </div>
                </CardFooter>
              </Card>
              
              {/* Analysis Loading Status Section */}
              {isGeneratingAnalysis && (
                <Card className="mt-6 border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center space-x-3">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <div className="text-blue-800 font-medium">
                        Идет анализ и формирование выводов. Ориентировочное время ожидания - менее 1 минуты
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* AI Analysis Results Section */}
              {aiAnalysisResult && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-blue-600" />
                      Выводы и рекомендации AI
                    </CardTitle>
                    <CardDescription>
                      Анализ предложений поставщиков с рекомендациями для принятия решения
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-lg max-w-none">
                      <div 
                        className="ai-analysis-content bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200"
                        dangerouslySetInnerHTML={{ 
                          __html: aiAnalysisResult.replace(/\n/g, '<br>') 
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Analysis Error Display */}
              {analysisError && (
                <Card className="mt-6 border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-700">Ошибка анализа</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-600">{analysisError}</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => {
                        setAnalysisError(null);
                        generateAnalysis();
                      }}
                    >
                      Попробовать снова
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {comparisonData && comparisonData.aiAnalysis && (
              <TabsContent value="analysis">
                <Card>
                  <CardHeader>
                    <CardTitle>AI-анализ предложений</CardTitle>
                    <CardDescription>
                      Интеллектуальный анализ на основе ответов поставщиков и сравнительных данных
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="ai-analysis prose prose-lg max-w-none">
                      {/* Parse and display the AI analysis with better formatting */}
                      {(() => {
                        try {
                          const parsedAnalysis = parseAnalysisContent(comparisonData.aiAnalysis);
                          return (
                            <div className="mb-8">
                              <div className="mb-6">
                                <h3 className="text-2xl font-bold mb-4">Анализ предложений поставщиков</h3>
                                <p className="text-muted-foreground mb-4">
                                  Интеллектуальный анализ сравнил предложения поставщиков по ключевым параметрам
                                </p>

                                {/* Enhanced table display for key parameters */}
                                <div className="rounded-lg overflow-hidden border border-gray-200 bg-white mb-6">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Параметр
                                        </th>
                                        {parsedAnalysis.suppliers.map((supplier, index) => (
                                          <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {supplier}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {Object.entries(parsedAnalysis.data).map(([param, values], index) => (
                                        <tr key={index} className={index % 2 ? 'bg-gray-50' : 'bg-white'}>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {param}
                                          </td>
                                          {parsedAnalysis.suppliers.map((supplier, idx) => (
                                            <td key={idx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {values[supplier] || '-'}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Recommendation section */}
                                <div className="p-4 rounded-md bg-blue-50 border border-blue-100 mb-6">
                                  <h4 className="text-lg font-semibold text-blue-800 mb-2">Рекомендации</h4>
                                  <p dangerouslySetInnerHTML={{ __html: parsedAnalysis.recommendation || 'Нет рекомендаций' }} />
                                </div>

                                {/* Compare advantages and disadvantages */}
                                {parsedAnalysis.suppliers.length > 0 && 
                                  (Object.keys(parsedAnalysis.advantages).length > 0 || 
                                   Object.keys(parsedAnalysis.disadvantages).length > 0) && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 rounded-md bg-green-50 border border-green-100">
                                      <h4 className="text-lg font-semibold text-green-800 mb-2">Преимущества</h4>
                                      <ul className="list-disc pl-5 text-gray-600">
                                        {parsedAnalysis.suppliers.map((supplier, index) => (
                                          <li key={index} className="mb-2">
                                            <span className="font-semibold">{supplier}:</span>{' '}
                                            {parsedAnalysis.advantages[supplier] || 'Нет выявленных преимуществ'}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div className="p-4 rounded-md bg-red-50 border border-red-100">
                                      <h4 className="text-lg font-semibold text-red-800 mb-2">Недостатки</h4>
                                      <ul className="list-disc pl-5 text-gray-600">
                                        {parsedAnalysis.suppliers.map((supplier, index) => (
                                          <li key={index} className="mb-2">
                                            <span className="font-semibold">{supplier}:</span>{' '}
                                            {parsedAnalysis.disadvantages[supplier] || 'Нет выявленных недостатков'}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Professional Business Report */}
                              <div className="mt-8">
                                <h3 className="text-xl font-bold mb-4 text-gray-800 border-b-2 border-blue-500 pb-2">
                                  Отчет о результатах тендерной процедуры
                                </h3>
                                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                                  <div 
                                    className="text-gray-700 leading-relaxed space-y-4"
                                    dangerouslySetInnerHTML={{ 
                                      __html: comparisonData.aiAnalysis 
                                        ? comparisonData.aiAnalysis
                                            // Remove all markdown symbols
                                            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
                                            .replace(/#{1,6}\s*/g, '') // Remove heading markers
                                            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold text
                                            .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic text
                                            .replace(/---+/g, '') // Remove horizontal rules
                                            .replace(/^\s*[-\*\+]\s+/gm, '• ') // Convert bullet points
                                            .replace(/\n\n+/g, '</p><p>') // Paragraph breaks
                                            .replace(/\n/g, '<br/>') // Line breaks
                                            .replace(/^(.*)$/, '<p>$1</p>') // Wrap in paragraph
                                            .replace(/<p><\/p>/g, '') // Remove empty paragraphs
                                        : '<p>Анализ недоступен</p>'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        } catch (error) {
                          console.error("Error parsing analysis:", error);
                          return (
                            <div className="text-muted-foreground">
                              {comparisonData.aiAnalysis 
                                ? <div className="prose max-w-none bg-slate-50 p-4 rounded-md"
                                     dangerouslySetInnerHTML={{
                                       __html: comparisonData.aiAnalysis
                                         .replace(/\n\n/g, '<br/><br/>')
                                         .replace(/\n/g, '<br/>')
                                     }}
                                   />
                                : <div className="p-4 bg-gray-50 rounded border">
                                    <h3 className="text-lg font-medium mb-2">Анализ поставщиков</h3>
                                    <p>Сравнение показывает следующие параметры поставщиков. Для более подробного анализа включите AI-анализ в настройках.</p>
                                  </div>
                              }
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button 
                      variant="secondary" 
                      className="gap-1"
                      onClick={() => saveAnalysis(true)}
                      disabled={saveAnalysisMutation.isLoading}
                    >
                      {saveAnalysisMutation.isLoading ? (
                        <>
                          <Spinner className="h-4 w-4" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Сохранить анализ
                        </>
                      )}
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="gap-1"
                        onClick={downloadExcel}
                      >
                        <Download className="h-4 w-4" />
                        Скачать Excel
                      </Button>
                      <Button 
                        variant="outline" 
                        className="gap-1"
                        onClick={downloadPdf}
                      >
                        <FileText className="h-4 w-4" />
                        Скачать PDF
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}
        
        {/* Winner Email Modal */}
        <WinnerEmailModal
          isOpen={showWinnerEmailModal}
          onClose={() => {
            setShowWinnerEmailModal(false);
            setSupplierToSelectAsWinner(null);
          }}
          onSubmit={handleSelectWinner}
          supplier={supplierToSelectAsWinner || { name: '', email: '' }}
          isLoading={winnerModalLoading}
        />

        {/* Cancel Winner Modal */}
        <CancelWinnerModal
          isOpen={showCancelWinnerModal}
          onClose={() => setShowCancelWinnerModal(false)}
          onConfirm={handleCancelWinnerSelection}
          winnerName={selectedWinner?.name || ''}
          isLoading={winnerModalLoading}
        />
        
        </main>
      </SubscriptionGuard>
    </div>
  );
}