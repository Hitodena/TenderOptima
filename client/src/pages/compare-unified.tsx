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
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, ArrowLeft, FileText, Mail, Phone, Globe, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { MainNavigation } from '@/components/main-navigation';
import { apiRequest } from '@/lib/queryClient';
import { SupplierFollowUp } from '@/components/supplier-follow-up';
import type { Supplier, SearchRequest, InsertAnalysisResult, AnalysisResult } from '@shared/schema';
import { useSaveAnalysisResult } from '@/hooks/use-analysis-results';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
// @ts-ignore - add missing imports for PDF generation
import pdfMake from 'pdfmake/build/pdfmake';
import htmlToPdfmake from 'html-to-pdfmake';

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
      data[param.label] = {};
      suppliers.forEach(supplier => {
        data[param.label][supplier] = '';
      });
    });

    // Try to extract parameter values from AI analysis
    parameters.forEach(param => {
      const paramPattern = new RegExp(`${param.label}\\s*:\\s*([^\\n]+)`, 'gi');
      let paramMatch;
      
      while ((paramMatch = paramPattern.exec(cleanText)) !== null) {
        const value = paramMatch[1].trim();
        const supplierPattern = /^(\w+):\s*(.+)$/;
        const supplierMatch = value.match(supplierPattern);
        
        if (supplierMatch) {
          // Format is "SupplierName: value"
          const supplier = supplierMatch[1];
          const paramValue = supplierMatch[2];
          if (suppliers.includes(supplier)) {
            data[param.label][supplier] = paramValue;
          }
        } else {
          // Just assign to first supplier as fallback
          if (suppliers.length > 0) {
            data[param.label][suppliers[0]] = value;
          }
        }
      }
    });

    // Extract recommendation
    const recommendationPattern = /(?:рекомендуем|рекомендуется|оптимальный выбор|лучший выбор)[^\n.]*[\n.]([^#]*)/i;
    const recommendationMatch = cleanText.match(recommendationPattern);
    if (recommendationMatch && recommendationMatch[1]) {
      recommendation = recommendationMatch[1].trim();
    }

    // Extract advantages and disadvantages for each supplier
    const sectionMatches = cleanText.match(/###\s+[^#]+/g) || [];
    const recommendationsSection = sectionMatches.find(s => /преимущества|недостатки|рекомендации/i.test(s)) || '';

    if (recommendationsSection) {
      suppliers.forEach(supplier => {
        const advantagePattern = new RegExp(`преимущества\\s+${supplier}[^:]*:\\s*([^\\n]+)`, 'i');
        const advantageMatch = recommendationsSection.match(advantagePattern);
        if (advantageMatch && advantageMatch[1]) {
          advantages[supplier] = advantageMatch[1].trim();
        }
        
        const disadvantagePattern = new RegExp(`недостатки\\s+${supplier}[^:]*:\\s*([^\\n]+)`, 'i');
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
      // Additional section
      const additionalSection = textSections[2];
      formattedAnalysis += `<div class="mt-6">
        <h3 class="text-xl font-bold mb-2">Дополнительно</h3>
        <p>${additionalSection}</p>
      </div>`;
    }

    return {
      suppliers,
      data,
      formattedAnalysis,
      advantages,
      disadvantages,
      recommendation
    };
  } catch (error) {
    console.error('Error parsing AI analysis:', error);
    return {
      suppliers: [],
      data: {},
      formattedAnalysis: '',
      advantages: {},
      disadvantages: {},
      recommendation: ''
    };
  }
};

// Define the interface for the comparison data returned from the API
interface ComparisonData {
  filename: string;
  csv: string;
  htmlTable: string;
  suppliers: string[];
  parameters: string[];
  aiAnalysis: string | null;
  tableData: any[]; // array of objects with Parameter as key and supplier names as other keys
  supplierDetails: Supplier[];
}

// CompareResults component
export default function CompareUnified() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ requestId?: string }>('/compare-results/:requestId?');
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [parameters, setParameters] = useState<any[]>([]);
  const hasInitiatedComparison = useRef(false);

  // Get requestId from URL or localStorage
  const requestId = params?.requestId 
    ? parseInt(params.requestId, 10) 
    : localStorage.getItem('compareRequestId')
      ? parseInt(localStorage.getItem('compareRequestId')!, 10)
      : undefined;
      
  // Save analysis mutation
  const saveAnalysisMutation = useSaveAnalysisResult();
      
  // Initialize on component mount
  useEffect(() => {
    const loadInitialData = () => {
      try {
        // Find cached comparison data in localStorage
        const storedSuppliers = localStorage.getItem('compareSuppliers');
        const storedParameters = localStorage.getItem('compareParameters');
  
        if (!storedSuppliers || !storedParameters) {
          throw new Error("Missing required comparison data");
        }
  
        const parsedSuppliers = JSON.parse(storedSuppliers);
        const parsedParameters = JSON.parse(storedParameters);
  
        if (!Array.isArray(parsedSuppliers) || parsedSuppliers.length === 0 ||
            !Array.isArray(parsedParameters) || parsedParameters.length === 0) {
          throw new Error("Invalid comparison data format");
        }
  
        setSuppliers(parsedSuppliers);
        setParameters(parsedParameters);
        
        console.log("Loaded comparison data:", {
          suppliers: parsedSuppliers.length, 
          parameters: parsedParameters.length
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

          // Получаем выбранные параметры
          const selectedParameters = parameters
            .filter(p => p.selected)
            .map(p => p.label);

          if (selectedParameters.length === 0) {
            throw new Error("No parameters selected for comparison");
          }
          
          // Для отладки
          console.log("Suppliers data:", {
            count: suppliers.length,
            data: suppliers.slice(0, 2) // Показываем только первые два для краткости
          });

          console.log(`Generating comparison for ${suppliers.length} suppliers with ${selectedParameters.length} parameters`);
          console.log("Request ID:", requestId);

          // Вызываем API для генерации сравнения
          const response = await apiRequest<ComparisonData>(
            '/api/generate-comparison',
            'POST',
            {
              suppliers,
              parameters: selectedParameters,
              requestId
            }
          );

          if (!response) {
            throw new Error("Failed to generate comparison data");
          }

          console.log("Received comparison data:", response);
          console.log("Table data available:", !!response.tableData);
          
          if (!response.tableData) {
            console.warn("Missing tableData in response. Server didn't include table information.");
            // Try to initialize empty table data as fallback
            response.tableData = [];
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

          // Сбрасываем флаг, чтобы пользователь мог попробовать еще раз
          hasInitiatedComparison.current = false;
        } finally {
          setIsLoading(false);
        }
      };

      generateComparison();
    }
  // Используем все необходимые зависимости, чтобы эффект перезапускался корректно
  }, [requestId, suppliers, parameters, isLoading, comparisonData, error]);

  // Download Excel file
  const downloadExcel = () => {
    if (!comparisonData) return;

    // Get parsed analysis data if available
    let tableData = '';
    
    if (comparisonData.aiAnalysis) {
      try {
        const parsedData = parseAnalysisContent(comparisonData.aiAnalysis);
        if (parsedData && parsedData.suppliers.length > 0) {
          // Create a proper Excel HTML table with the parsed data
          tableData = `
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="content-type" content="text/html; charset=utf-8">
<title>Supplier Comparison Report</title>
<style>
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #000; padding: 8px; text-align: left; }
  th { background-color: #f2f2f2; font-weight: bold; }
  tr:nth-child(even) { background-color: #f9f9f9; }
  .header { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
  .subheader { font-size: 12px; margin-bottom: 5px; }
  .footer { font-size: 12px; margin-top: 10px; }
</style>
</head>
<body>
  <div class="header">Отчет сравнения поставщиков</div>
  <div class="subheader">Сгенерирован: ${new Date().toLocaleString('ru')}</div>
  <div class="subheader">Запрос №: ${requestId || 'Не указан'}</div>
  <table>
    <tr>
      <th>Параметр</th>
      ${parsedData.suppliers.map(supplier => `<th>${supplier}</th>`).join('')}
    </tr>`;
          
          // Add parameters we know
          const tableParams = [
            { key: 'costWithoutVAT', label: 'Общая стоимость без НДС' },
            { key: 'costWithVAT', label: 'Общая стоимость с НДС' },
            { key: 'unitCostWithoutVAT', label: 'Цена за единицу без НДС' },
            { key: 'unitCostWithVAT', label: 'Цена за единицу с НДС' },
            { key: 'deliveryTime', label: 'Сроки поставки' },
            { key: 'deliveryTerms', label: 'Условия поставки' },
            { key: 'paymentTerms', label: 'Условия оплаты' },
            { key: 'warranty', label: 'Гарантия' },
            { key: 'service', label: 'Сервис' },
            { key: 'resident', label: 'Резидент РБ' },
            { key: 'offerValidity', label: 'Срок действия предложения' }
          ];
          
          tableParams.forEach(param => {
            tableData += `
    <tr>
      <td>${param.label}</td>
      ${parsedData.suppliers.map(supplier => `<td>${parsedData.data[param.label]?.[supplier] || '-'}</td>`).join('')}
    </tr>`;
          });
          
          // Add a section for the analysis
          tableData += `
  </table>
  
  <div style="margin-top: 20px;">
    <div class="header">Анализ и рекомендации</div>
    <p>${parsedData.recommendation || 'Нет рекомендаций'}</p>
  </div>
</body>
</html>`;
        }
      } catch (error) {
        console.error("Error generating Excel from AI analysis:", error);
      }
    }

    // Use either the AI-enhanced table or the original htmlTable
    const htmlContent = tableData || comparisonData.htmlTable;
    
    // Create a blob with the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link and trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = comparisonData.filename || `supplier-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Download PDF
  const downloadPdf = () => {
    try {
      if (!comparisonData) return;
      
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Сравнение предложений поставщиков', 20, 20);
      
      // Add date and request ID
      doc.setFontSize(12);
      doc.text(`Дата: ${format(new Date(), 'dd.MM.yyyy')}`, 20, 30);
      
      if (requestId) {
        doc.text(`Запрос №: ${requestId}`, 20, 36);
      }
      
      // If we have AI analysis, use that for a more structured PDF
      if (comparisonData.aiAnalysis) {
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

      // Save the PDF file
      doc.save(`supplier-comparison-${requestId || new Date().toISOString().slice(0, 10)}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Save analysis result to database
  const saveAnalysis = async (showSuccess = true) => {
    if (!comparisonData || !requestId) return;
    
    try {
      // Подготовка данных для анализа
      // Обходим проблему с типами путем преобразования объекта в соответствующий тип
      // Это обеспечивает правильную структуру, соответствующую схеме базы данных
      type SafeAnalysisData = {
        requestId: number;
        parameters: string[];
        title: string;
        analysisContent: string;
        comparedSuppliers: number[];
        recommendedSupplier: string | null;
        recommendationReason: string | null;
        pdfUrl: string | null;
        userId: number | null;
      };
      
      // Создаем правильно типизированный объект
      const safeData: SafeAnalysisData = {
        requestId: requestId,
        parameters: parameters.filter(p => p.selected).map(p => p.label),
        title: `Сравнение поставщиков - ${new Date().toLocaleDateString()}`,
        analysisContent: comparisonData.aiAnalysis || '',
        comparedSuppliers: suppliers.map(s => Number(s.id)),
        recommendedSupplier: null,
        recommendationReason: null,
        pdfUrl: null,
        userId: null
      };
      
      // Приводим типы для API
      const analysisData = safeData as unknown as InsertAnalysisResult;
      
      // Save analysis
      await saveAnalysisMutation.mutateAsync(analysisData);
      
      // Show success message only when explicitly asked to
      if (showSuccess) {
        toast({
          title: "Анализ сохранен",
          description: "Результаты сравнения успешно сохранены в системе"
        });
      }
    } catch (error) {
      console.error("Error saving analysis:", error);
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Не удалось сохранить анализ",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="w-full">
      <MainNavigation />
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Результаты сравнения поставщиков</h1>
            <div className="flex gap-2">
              {/* Add any top-level actions here */}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <div className="flex flex-col items-center gap-4">
                <Spinner className="h-10 w-10" />
                <p className="text-lg text-muted-foreground">
                  Генерация сравнения...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <div className="flex flex-col items-center gap-4 max-w-md text-center">
                <div className="rounded-full bg-red-100 p-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22ZM11 15V17H13V15H11ZM11 7V13H13V7H11Z" fill="#EF4444"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Ошибка генерации сравнения</h3>
                <p className="text-gray-600">{error}</p>
                <Button 
                  variant="outline" 
                  className="mt-2"
                  onClick={() => setLocation('/compare-parameters')}
                >
                  Вернуться к выбору параметров
                </Button>
              </div>
            </div>
          ) : comparisonData ? (
            /* Единый вид со всеми данными на одной странице */
            <Card>
              <CardHeader>
                <CardTitle>Сравнение предложений поставщиков</CardTitle>
                <CardDescription>
                  Комплексный анализ предложений поставщиков для принятия решения
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Сравнительная таблица параметров */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4">Сравнительная таблица параметров</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Параметр
                          </th>
                          {comparisonData && comparisonData.supplierDetails && comparisonData.supplierDetails.map((supplier, index) => (
                            <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {supplier.name || `Поставщик ${index + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {comparisonData && comparisonData.tableData && comparisonData.tableData.map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {row.Parameter}
                            </td>
                            {comparisonData.supplierDetails && comparisonData.supplierDetails.map((supplier, supplierIndex) => {
                              // Пробуем разные варианты ключей для получения значения ячейки
                              let cellValue = '-';
                              const supplierName = supplier.name || `Поставщик ${supplierIndex + 1}`;
                              
                              // Пробуем найти значение по имени поставщика
                              if (row[supplierName]) {
                                cellValue = row[supplierName];
                              } 
                              // Пробуем найти по индексу, если имя не работает
                              else if (comparisonData.suppliers && comparisonData.suppliers[supplierIndex]) {
                                const altName = comparisonData.suppliers[supplierIndex];
                                if (row[altName]) {
                                  cellValue = row[altName];
                                }
                              }
                              
                              return (
                                <td key={supplierIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cellValue}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI анализ */}
                {comparisonData && comparisonData.aiAnalysis && (
                  <div className="ai-analysis prose prose-lg max-w-none mt-8">
                    {(() => {
                      try {
                        const parsedAnalysis = parseAnalysisContent(comparisonData.aiAnalysis);
                        return (
                          <div>
                            <h3 className="text-xl font-bold mb-4">Результаты интеллектуального анализа</h3>

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

                            {/* Full analysis text */}
                            <div className="mt-6">
                              <h4 className="text-lg font-semibold mb-2">Полный текст анализа</h4>
                              <div 
                                className="prose max-w-none bg-slate-50 p-4 rounded-md"
                                dangerouslySetInnerHTML={{ __html: comparisonData.aiAnalysis }}
                              />
                            </div>
                          </div>
                        );
                      } catch (error) {
                        console.error("Error parsing analysis:", error);
                        return (
                          <div className="text-muted-foreground">
                            {comparisonData.aiAnalysis || "No analysis available"}
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="gap-1"
                    onClick={() => setLocation('/compare-parameters')}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Изменить параметры
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="gap-1"
                    onClick={() => saveAnalysis(true)}
                    disabled={saveAnalysisMutation.isPending}
                  >
                    {saveAnalysisMutation.isPending ? (
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
                </div>
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
          ) : (
            // No comparison data yet but no error either (should not happen, but added for completeness)
            <div className="text-center my-12 text-muted-foreground">
              <p>Нет данных для сравнения. Пожалуйста, выберите поставщиков и параметры.</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setLocation('/compare-parameters')}
              >
                Выбрать параметры сравнения
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}