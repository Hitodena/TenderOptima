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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// We'll initialize pdfMake later when needed to avoid startup errors

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
  supplierDetails: any[];
  productName?: string;
  requestDetails?: any;
  csv: string;
  aiAnalysis?: string;
  htmlTable?: string;
  suppliers?: string[];
  parameters?: string[];
  filename?: string;
}

// Compare Results Page Component
export default function CompareResultsPage() {
  // Router
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id?: string }>('/compare-results/:id?');
  const requestId = params?.id ? parseInt(params.id, 10) : null;
  
  // State for comparison data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [parameters, setParameters] = useState<{label: string; selected: boolean}[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "analysis">("table");
  const [showHelp, setShowHelp] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  
  // Flag to track if we've already initiated comparison generation
  const hasInitiatedComparison = useRef(false);
  
  // Hook for saving analysis results
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
  // Fix the dependency array - we ONLY want to run this when suppliers/parameters change
  // and NOT when the loading states or results change to prevent infinite loops/reloads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, suppliers, parameters]);

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
      <td>${param.label}</td>`;
            
            parsedData.suppliers.forEach(supplier => {
              const value = parsedData.data[param.key]?.[supplier] || '-';
              tableData += `
      <td>${value}</td>`;
            });
            
            tableData += `
    </tr>`;
          });
          
          tableData += `
  </table>
  <div class="footer">'-' означает, что поставщик не предоставил информацию по данному параметру</div>
  <div class="footer">Сгенерировано системой сравнения поставщиков TenderOptima</div>
</body>
</html>`;
        }
      } catch (error) {
        console.error("Error generating Excel data from AI analysis:", error);
      }
    }
    
    // Use the generated table data or fall back to the server-generated CSV
    const htmlContent = tableData || comparisonData.csv;

    // Create blob with UTF-16 BOM for better Excel compatibility
    const bom = "\ufeff"; // UTF-16 BOM
    const blob = new Blob([bom + htmlContent], { 
      type: 'application/vnd.ms-excel;charset=utf-8;' 
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `supplier-comparison-${requestId || new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download PDF file
  const downloadPDF = () => {
    if (!comparisonData) return;

    try {
      // Use simple pdf generation with jsPDF
      const doc = new jsPDF();

      // Title
      doc.setFontSize(16);
      doc.text('Отчет сравнения поставщиков', 20, 20);

      // Metadata
      doc.setFontSize(10);
      doc.text(`Создан: ${new Date().toLocaleString('ru-RU')}`, 20, 30);
      doc.text(`Номер запроса: ${requestId || 'Не указан'}`, 20, 35);
      doc.text(`Товар/Услуга: ${comparisonData.productName || 'Не указан'}`, 20, 40);

      let yPos = 50;
      const xPos = 20;
      const lineHeight = 7;

      // Get data from parsed analysis if available
      if (comparisonData.aiAnalysis) {
        const parsedData = parseAnalysisContent(comparisonData.aiAnalysis);

        if (parsedData && parsedData.suppliers && parsedData.suppliers.length > 0) {
          // Add supplier information
          doc.setFontSize(14);
          doc.text('Сравнительные данные', 20, yPos);
          yPos += 10;

          // Create table headers
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text("Параметр", xPos, yPos);
          
          // Position supplier names in columns
          const supplierWidth = 40;
          const startX = xPos + 60;
          
          parsedData.suppliers.forEach((supplier, index) => {
            doc.text(supplier, startX + (index * supplierWidth), yPos);
          });
          
          yPos += 5;
          // Horizontal line
          doc.setDrawColor(200, 200, 200);
          doc.line(xPos, yPos, xPos + 60 + (parsedData.suppliers.length * supplierWidth), yPos);
          yPos += 5;
          
          // Reset text color
          doc.setTextColor(0, 0, 0);

          // Add all parameters as a table
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

          // Only display parameters we have data for
          const paramsWithData = tableParams.filter(param => {
            return parsedData.suppliers.some(supplier => 
              parsedData.data[param.key]?.[supplier] && 
              parsedData.data[param.key][supplier] !== '-'
            );
          });

          // Make sure we display at least some parameters even if no data
          const displayParams = paramsWithData.length > 0 ? paramsWithData : tableParams.slice(0, 5);

          displayParams.forEach((param) => {
            // Parameter name
            doc.setFontSize(10);
            doc.text(param.label, xPos, yPos);

            // Parameter values for each supplier
            parsedData.suppliers.forEach((supplier, index) => {
              const value = parsedData.data[param.key]?.[supplier] || '-';
              doc.text(value, startX + (index * supplierWidth), yPos);
            });

            yPos += lineHeight;
            
            // Don't allow text to go off the bottom of the page
            if (yPos > 280) {
              doc.addPage();
              yPos = 20;
            }
          });

          // Add recommendation
          yPos += 10;
          doc.setFontSize(14);
          doc.text('Рекомендации', 20, yPos);
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
      
      if (showSuccess) {
        toast({
          title: "Success",
          description: "Analysis saved successfully",
        });
      }
    } catch (error) {
      console.error('Error saving analysis:', error);
      
      toast({
        title: "Error",
        description: "Failed to save analysis. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Toggle supplier detail accordion
  const toggleSupplier = (id: string) => {
    setExpandedSuppliers(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <MainNavigation />
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
          <Spinner className="h-10 w-10 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Генерация сравнения...</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Обрабатываем данные поставщиков и извлекаем параметры для сравнения. Это может занять до 30 секунд.
          </p>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Система использует искусственный интеллект DeepSeek для обработки данных из вложений и генерации сводной таблицы сравнения.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <MainNavigation />
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
          <div className="bg-destructive/10 p-4 rounded-lg mb-4">
            <p className="text-destructive font-medium">{error}</p>
          </div>
          <Button 
            variant="outline" 
            className="gap-1"
            onClick={() => setLocation('/compare-parameters')}
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться к выбору параметров
          </Button>
        </div>
      </div>
    );
  }

  // Render comparison results
  return (
    <div className="container mx-auto p-4">
      <MainNavigation />
     
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Сравнение предложений поставщиков</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-1"
              onClick={downloadExcel}
              disabled={!comparisonData}
            >
              <FileText className="h-4 w-4" />
              Экспорт Excel
            </Button>
            
          </div>
        </div>

        {comparisonData && (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "table" | "analysis")}>
            <TabsList className="mb-4">
              <TabsTrigger value="table">Таблица сравнения</TabsTrigger>
              {comparisonData && comparisonData.aiAnalysis && (
                <TabsTrigger value="analysis">AI-анализ</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="table">
              <Card>
                <CardHeader>
                  <CardTitle>Сравнительная таблица параметров</CardTitle>
                  <CardDescription>
                    Сравнение ключевых параметров поставщиков для принятия решения
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
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
                </CardFooter>
              </Card>
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
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {Object.entries(parsedAnalysis.data).slice(0, 6).map(([key, values], rowIndex) => (
                                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {key === 'costWithoutVAT' ? 'Цена без НДС' : 
                                             key === 'costWithVAT' ? 'Цена с НДС' :
                                             key === 'deliveryTime' ? 'Срок поставки' :
                                             key === 'paymentTerms' ? 'Условия оплаты' :
                                             key === 'warranty' ? 'Гарантия' :
                                             key === 'service' ? 'Сервис' : key}
                                          </td>
                                          {parsedAnalysis.suppliers.map((supplier, supplierIndex) => (
                                            <td key={supplierIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {values[supplier] || '-'}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Display advantages and disadvantages */}
                              {(parsedAnalysis.advantages && Object.keys(parsedAnalysis.advantages).length > 0) && (
                                <div className="grid md:grid-cols-2 gap-6 mb-8">
                                  {parsedAnalysis.suppliers.map((supplier, index) => (
                                    <div key={index} className="rounded-lg border p-4">
                                      <h4 className="text-lg font-semibold mb-2">{supplier}</h4>
                                      {parsedAnalysis.advantages[supplier] && (
                                        <div className="mb-3">
                                          <h5 className="text-sm font-medium text-green-600 mb-1">Преимущества:</h5>
                                          <p className="text-sm">{parsedAnalysis.advantages[supplier]}</p>
                                        </div>
                                      )}
                                      {parsedAnalysis.disadvantages[supplier] && (
                                        <div>
                                          <h5 className="text-sm font-medium text-red-600 mb-1">Недостатки:</h5>
                                          <p className="text-sm">{parsedAnalysis.disadvantages[supplier]}</p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Display recommendations */}
                              {parsedAnalysis.recommendation && (
                                <div className="bg-blue-50 rounded-lg p-5 border border-blue-100 mb-6">
                                  <h3 className="text-xl font-semibold mb-3">Рекомендации</h3>
                                  <div>
                                    <p className="text-gray-600">{parsedAnalysis.recommendation}</p>
                                  </div>
                                </div>
                              )}

                              {/* Raw AI analysis */}
                              <div>
                                <h3 className="text-xl font-semibold mb-4">Полный текст анализа</h3>
                                <ScrollArea className="h-[400px] rounded-md border p-4">
                                  <div 
                                    className="whitespace-pre-wrap" 
                                    dangerouslySetInnerHTML={{ __html: parsedAnalysis.formattedAnalysis }}
                                  />
                                </ScrollArea>
                              </div>
                            </div>
                          );
                        } catch (error) {
                          console.error("Error parsing AI analysis:", error);
                          // Fallback to raw display
                          return (
                            <div 
                              className="whitespace-pre-wrap rounded-md border p-4" 
                              dangerouslySetInnerHTML={{ __html: comparisonData.aiAnalysis }}
                            />
                          );
                        }
                      })()}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      variant="secondary" 
                      className="gap-1"
                      onClick={() => saveAnalysis()}
                      disabled={saveAnalysisMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {saveAnalysisMutation.isPending ? 'Сохранение...' : 'Сохранить анализ'}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* Contact info and proposal section - shown only if comparison data is available */}
        {comparisonData && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-2xl">Связаться с поставщиками</CardTitle>
              <CardDescription>
                Отправьте уточняющие запросы выбранным поставщикам
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Suppliers with contact cards and email forms */}
                {(comparisonData.supplierDetails || suppliers).map((supplier, index) => (
                  <div key={index} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold">{supplier.name || 'Неизвестный поставщик'}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-2">
                            {supplier.email && (
                              <div className="flex items-center text-sm">
                                <Mail className="h-4 w-4 mr-2 text-gray-500" />
                                <span>{supplier.email}</span>
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center text-sm">
                                <Phone className="h-4 w-4 mr-2 text-gray-500" />
                                <span>{supplier.phone}</span>
                              </div>
                            )}
                            {supplier.website && (
                              <div className="flex items-center text-sm">
                                <Globe className="h-4 w-4 mr-2 text-gray-500" />
                                <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {supplier.website.replace(/^https?:\/\//, '')}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSupplier(supplier.id.toString())}
                          aria-expanded={expandedSuppliers[supplier.id.toString()]}
                          aria-label="Toggle supplier details"
                          className="p-1 h-auto"
                        >
                          {expandedSuppliers[supplier.id.toString()] ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded supplier follow-up section */}
                    {expandedSuppliers[supplier.id.toString()] && (
                      <div className="p-4 border-t">
                        <SupplierFollowUp 
                          supplier={{
                            id: Number(supplier.id),
                            name: supplier.name,
                            email: supplier.email,
                            description: '',
                            website: supplier.website || '',
                            phone: supplier.phone || '',
                            categories: [],
                            responseRate: 0,
                            totalRequests: 0,
                            successfulMatches: 0,
                            keywordStrength: []
                          }}
                          requestId={requestId || 0} // Преобразуем null в 0, чтобы соответствовать типу
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}