import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

if (!DEEPSEEK_API_KEY) {
  console.warn('Warning: DEEPSEEK_API_KEY is not set. DeepSeek API functionality will not work correctly.');
}

interface ParameterExtractionResult {
  name: string;
  value: string;
  confidence: number;
}

interface SupplierImprovementAnalysisResult {
  supplier_email: string;
  supplier_name: string;
  final_parameters: Record<string, string>;
  improvements: Array<{
    parameter: string;
    initial_value: string;
    final_value: string;
    improvement_description: string;
  }>;
  summary: string;
}

export { SupplierImprovementAnalysisResult };

/**
 * Generate analysis of comparison data for multiple suppliers
 * 
 * @param supplierDetails Array of supplier details
 * @param tableData Array of parameter values for each supplier
 * @param parameters Array of parameter names
 * @param requestId Optional request ID
 * @returns Promise with analysis content
 */
export async function generateComparisonAnalysis(
  supplierDetails: Array<{ id: number; name: string; email?: string; phone?: string; website?: string; contactName?: string; }>,
  tableData: Array<Record<string, string>>,
  parameters: string[],
  requestId?: number
): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set for comparison analysis');
    return "Не удалось сгенерировать анализ сравнения - API ключ не установлен.";
  }
  
  try {
    console.log(`Generating comparison analysis for ${supplierDetails.length} suppliers with ${parameters.length} parameters`);
    
    // Format the data for the prompt
    const supplierNames = supplierDetails.map(s => s.name);
    
    // Create a formatted table for the prompt
    let formattedTable = "| Параметр | " + supplierNames.join(" | ") + " |\n";
    formattedTable += "|" + Array(supplierNames.length + 1).fill("---").join("|") + "|\n";
    
    tableData.forEach(row => {
      const paramName = row['Parameter'] || row['parameter'] || 'Неизвестный параметр';
      let rowString = `| ${paramName} |`;
      
      supplierNames.forEach(supplierName => {
        rowString += ` ${row[supplierName] || '-'} |`;
      });
      
      formattedTable += rowString + "\n";
    });
    
    // Create prompt for DeepSeek API with enhanced professional structure from Stage 61
    const prompt = `
Ты - ведущий специалист тендерного отдела, который готовит официальный аналитический отчет о результатах тендерной процедуры для руководства компании.

Твоя задача: провести всесторонний анализ предложений от ${supplierNames.length} поставщиков и подготовить профессиональный деловой отчет с конкретными рекомендациями по выбору поставщика.

ДАННЫЕ ДЛЯ АНАЛИЗА:

${formattedTable}

КРИТИЧЕСКИ ВАЖНО - ПРИНЦИПЫ АНАЛИЗА: 
- Используй ТОЛЬКО реальные данные из таблицы выше
- Если в таблице указано значение для поставщика, то оно ЕСТЬ (не пиши "не указан" или "не предоставлено")
- Внимательно анализируй каждую ячейку таблицы перед выводами
- Значение "-" означает отсутствие данных от поставщика
- Проводи сравнительный анализ только по имеющимся данным

СТРУКТУРА ПРОФЕССИОНАЛЬНОГО ОТЧЕТА:
1. ИСПОЛНИТЕЛЬНОЕ РЕЗЮМЕ
   - Краткий обзор процедуры и участников
   - Основные выводы и рекомендации (2-3 предложения)

2. ДЕТАЛЬНЫЙ СРАВНИТЕЛЬНЫЙ АНАЛИЗ ПО ПАРАМЕТРАМ
   - Анализ каждого параметра отдельно
   - Выявление лидеров по каждому критерию
   - Количественные и качественные оценки

3. АНАЛИЗ КОНКУРЕНТНЫХ ПРЕИМУЩЕСТВ
   - Сильные стороны каждого поставщика
   - Слабые стороны каждого поставщика
   - Уникальные предложения

4. КОМПЛЕКСНАЯ ОЦЕНКА И РЕЙТИНГ
   - Определение наиболее выгодного предложения
   - Обоснование выбора с учетом всех факторов
   - Альтернативные варианты

5. ИТОГОВЫЕ РЕКОМЕНДАЦИИ
   - Конкретные рекомендации по выбору поставщика
   - Предложения по дальнейшим переговорам
   - Условия для заключения договора

КРИТЕРИИ ОЦЕНКИ ПРЕИМУЩЕСТВ:
- Более низкая цена - существенное преимущество
- Более короткие сроки поставки - конкурентное преимущество  
- Более длительная гарантия - дополнительная ценность
- Лучшие условия оплаты (отсрочка лучше предоплаты) - финансовое преимущество
- Лучшие условия доставки (включенная доставка лучше самовывоза) - логистическое преимущество

ТРЕБОВАНИЯ К СТИЛЮ ОТЧЕТА:
- Официальный деловой стиль без markdown символов (без ###, **, ---, \`\`\`)
- Структурированное изложение с четкими разделами
- Конкретные цифры и факты из таблицы
- Профессиональная терминология
- Обоснованные выводы и рекомендации

Подготовь развернутый профессиональный отчет специалиста тендерного отдела в простом текстовом формате без символов разметки.
`;

    console.log('DeepSeek API: Calling API for comparison analysis');
    
    // Call DeepSeek API
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );

    // Extract the result from the API response
    const analysisResponse = response.data.choices[0].message.content;
    console.log('DeepSeek API comparison analysis response received');
    
    return analysisResponse;
  } catch (error) {
    console.error('Error generating comparison analysis:', error);
    return "Не удалось сгенерировать анализ сравнения из-за технической ошибки.";
  }
}

/**
 * Analyze multiple responses from the same supplier to identify improvements
 * and determine the best final conditions
 * 
 * @param supplierEmail The email of the supplier
 * @param supplierName The name of the supplier
 * @param responses Array of responses from this supplier, ordered by date
 * @param parameters Array of parameter names to extract and compare
 * @returns Promise with analysis of improvements and final best parameters
 */
export async function analyzeSupplierImprovements(
  supplierEmail: string,
  supplierName: string,
  responses: Array<{ content: string; date: Date; attachmentText?: string }>,
  parameters: string[]
): Promise<SupplierImprovementAnalysisResult> {
  if (!DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set for supplier improvement analysis');
    return {
      supplier_email: supplierEmail,
      supplier_name: supplierName,
      final_parameters: {},
      improvements: [],
      summary: "Не удалось проанализировать изменения в предложениях - API ключ не установлен."
    };
  }

  // If there's only one response, no need to analyze improvements
  if (responses.length <= 1) {
    console.log(`Only ${responses.length} response(s) from ${supplierName}, skipping improvement analysis`);
    
    // Just extract parameters from the single response
    let singleResponseText = '';
    if (responses.length === 1) {
      singleResponseText = responses[0].content || '';
      if (responses[0].attachmentText) {
        singleResponseText += '\n\n' + responses[0].attachmentText;
      }
    }
    
    const extractedParams = await extractParametersWithAI(singleResponseText, parameters);
    
    // Convert to the expected result format
    const finalParams: Record<string, string> = {};
    extractedParams.forEach(param => {
      finalParams[param.name] = param.value;
    });
    
    return {
      supplier_email: supplierEmail,
      supplier_name: supplierName,
      final_parameters: finalParams,
      improvements: [],
      summary: "Получено только одно предложение от поставщика."
    };
  }

  console.log(`Analyzing improvements for ${supplierName} (${supplierEmail}) with ${responses.length} responses`);
  
  try {
    // Order responses by date (oldest first)
    const orderedResponses = [...responses].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Combine all response content for analysis
    let combinedContent = '';
    
    orderedResponses.forEach((response, index) => {
      const dateStr = response.date ? new Date(response.date).toLocaleDateString('ru-RU') : `Письмо ${index + 1}`;
      combinedContent += `\n\n=== ПРЕДЛОЖЕНИЕ ${index + 1} (${dateStr}) ===\n\n`;
      combinedContent += response.content || '';
      
      if (response.attachmentText) {
        combinedContent += `\n\n--- ВЛОЖЕНИЕ К ПРЕДЛОЖЕНИЮ ${index + 1} ---\n\n`;
        combinedContent += response.attachmentText;
      }
    });
    
    // Limit text length to avoid token limits
    const maxTextLength = 14000;
    const truncatedContent = combinedContent.length > maxTextLength 
      ? combinedContent.substring(0, maxTextLength) + '...(текст сокращен)' 
      : combinedContent;
    
    console.log(`DeepSeek API: Using ${truncatedContent.length} chars of text for improvement analysis`);
    
    // Enhanced prompt for supplier improvement analysis with professional context from Stage 61
    const prompt = `Ты - ведущий специалист отдела закупок с 12-летним опытом анализа коммерческих предложений, который проводит экспертную оценку динамики улучшений в предложениях поставщика.

Твоя задача: провести профессиональный анализ эволюции коммерческого предложения поставщика ${supplierName} (${supplierEmail}) и определить ключевые улучшения по основным параметрам закупки.

КЛЮЧЕВЫЕ ПАРАМЕТРЫ ДЛЯ АНАЛИЗА: ${parameters.join(', ')}

ХРОНОЛОГИЯ ПРЕДЛОЖЕНИЙ ПОСТАВЩИКА:
${truncatedContent}

МЕТОДОЛОГИЯ ЭКСПЕРТНОГО АНАЛИЗА:
1. ДИНАМИЧЕСКИЙ АНАЛИЗ: Отследи изменения каждого параметра от первого к последнему предложению
2. ВЫЯВЛЕНИЕ УЛУЧШЕНИЙ: Определи конкретные улучшения условий (снижение цен, сокращение сроков, расширение гарантий)
3. ФИНАЛЬНАЯ ОЦЕНКА: Зафиксируй лучшие финальные значения по каждому ключевому параметру
4. СТРАТЕГИЧЕСКИЙ АНАЛИЗ: Проанализируй стратегию поставщика и мотивацию изменений
5. БИЗНЕС-РЕЗЮМЕ: Подготовь краткое заключение о динамике предложений

КРИТЕРИИ ОЦЕНКИ УЛУЧШЕНИЙ:
- Снижение цены - существенное коммерческое улучшение
- Сокращение сроков поставки - повышение конкурентоспособности
- Расширение гарантийных обязательств - дополнительная ценность
- Улучшение условий оплаты (отсрочка лучше предоплаты) - финансовое преимущество
- Расширение объема поставок - масштабирование сделки

ПРИНЦИПЫ ВЫБОРА ФИНАЛЬНЫХ ПАРАМЕТРОВ:
- Отбирай самые выгодные для заказчика условия из всех предложений
- Комбинируй лучшие параметры даже если они из разных предложений
- Приоритизируй последние улучшения как более актуальные

ФОРМАТ ЭКСПЕРТНОГО ЗАКЛЮЧЕНИЯ (только JSON):
{
  "supplier_email": "${supplierEmail}",
  "supplier_name": "${supplierName}",
  "final_parameters": {
    "параметр": "финальное_лучшее_значение_с_обоснованием"
  },
  "improvements": [
    {
      "parameter": "название_параметра",
      "initial_value": "первоначальное_значение", 
      "final_value": "улучшенное_финальное_значение",
      "improvement_description": "детальное_описание_улучшения_с_бизнес_оценкой"
    }
  ],
  "summary": "профессиональное_резюме_динамики_предложений_и_стратегических_изменений"
}`;

    console.log('DeepSeek API: Calling API for supplier improvement analysis');
    
    // Call DeepSeek API
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );

    // Extract the result from the API response
    const aiResponse = response.data.choices[0].message.content;
    console.log('DeepSeek API supplier improvement analysis response received');

    try {
      // Extract the JSON object from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedJson = jsonMatch[0];
        const parsedResults = JSON.parse(extractedJson);
        
        console.log('Parsed AI supplier improvement analysis results');
        return parsedResults;
      } else {
        throw new Error('Invalid JSON format in DeepSeek response for supplier improvement analysis');
      }
    } catch (parseError) {
      console.error('Error parsing DeepSeek API improvement analysis response:', parseError);
      
      // Provide fallback response in case of parsing error
      return {
        supplier_email: supplierEmail,
        supplier_name: supplierName,
        final_parameters: {},
        improvements: [],
        summary: "Ошибка при анализе улучшений в предложениях поставщика."
      };
    }
  } catch (error) {
    console.error('Error calling DeepSeek API for supplier improvement analysis:', error);
    
    // Provide fallback response in case of API error
    return {
      supplier_email: supplierEmail,
      supplier_name: supplierName,
      final_parameters: {},
      improvements: [],
      summary: "Ошибка при анализе улучшений в предложениях поставщика."
    };
  }
}

/**
 * Extract parameters from text using DeepSeek API
 * 
 * @param text The text to extract parameters from
 * @param parameters Array of parameter names to extract
 * @returns Promise with extracted parameters
 */
export async function extractParametersWithAI(
  text: string,
  parameters: string[]
): Promise<ParameterExtractionResult[]> {
  if (!DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set');
    return parameters.map(param => ({
      name: param,
      value: '-',
      confidence: 0
    }));
  }

  console.log(`DeepSeek API: Extracting ${parameters.length} parameters from text (${text.length} chars)`);
  console.log(`DeepSeek API: Text preview: ${text.substring(0, 200)}...`);
  
  if (text.trim().length === 0) {
    console.error('DeepSeek API: Empty text provided, cannot extract parameters');
    return parameters.map(param => ({
      name: param,
      value: '-',
      confidence: 0
    }));
  }

  try {
    // Limit text length to avoid token limits
    const maxTextLength = 150000;
    const truncatedText = text.length > maxTextLength 
      ? text.substring(0, maxTextLength) + '...(текст сокращен)' 
      : text;
    
    console.log(`DeepSeek API: Using ${truncatedText.length} chars of text for analysis`);
    
    const systemPrompt = `Анализируй текст и извлекай параметры СТРОГО из списка ниже.

ПАРАМЕТРЫ ДЛЯ ПОИСКА: ${parameters.join(', ')}

ТЕКСТ:
${truncatedText}

ПРАВИЛА:
1. Ищи ТОЛЬКО указанные параметры
2. Если параметр не найден - оставляй пустым
3. Для цен указывай валюту
4. Сохраняй точные формулировки из текста

JSON формат:
[{"name":"точное_название_параметра","value":"найденное_значение_или_пусто","confidence":0.95}]

Ровно ${parameters.length} параметров. Только JSON без пояснений.`;


    console.log('DeepSeek API: Calling API with prompt length:', prompt.length);
    
    // Call DeepSeek API
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Lower temperature for more deterministic results
        max_tokens: 4096
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );

    // Extract the result from the API response
    const aiResponse = response.data.choices[0].message.content;
    console.log('DeepSeek API response:', aiResponse);

    try {
      // Extract the JSON object from the response
      // Using a dot anything approach that works without 's' flag
      const jsonMatch = aiResponse.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (jsonMatch) {
        const extractedJson = jsonMatch[0];
        const parsedResults = JSON.parse(extractedJson);
        
        console.log('Parsed AI extraction results:', parsedResults);
        
        // Validate and format the results
        // We're improving the function to include a source field that indicates
        // whether the parameter might come from email content
        
        // First 200 chars is likely the email content (before attachments)
        const emailPreview = text.substring(0, 200).toLowerCase();
        
        return parsedResults.map((result: any) => {
          const resultValue = result.value || '-';
          const confidence = typeof result.confidence === 'number' ? result.confidence : 0;
          
          // Try to determine if the parameter comes from email body or attachment
          let source = 'unknown';
          if (resultValue !== '-') {
            // Normalize for comparison (lowercase, remove extra spaces)
            const normalizedValue = resultValue.toLowerCase().replace(/\s+/g, ' ').trim();
            
            // Check if value might be in email preview (email body)
            if (emailPreview.includes(normalizedValue) || 
                // Price values may appear differently, check numbers
                (normalizedValue.match(/\d/) && 
                 emailPreview.includes(normalizedValue.replace(/[^\d.,]/g, '')))) {
              source = 'content';  // Likely from email body
            } else {
              source = 'attachment';  // Likely from attachment
            }
          }
          
          return {
            name: result.name,
            value: resultValue,
            confidence: confidence,
            source: source
          };
        });
      } else {
        throw new Error('Invalid JSON format in DeepSeek response');
      }
    } catch (parseError) {
      console.error('Error parsing DeepSeek API response:', parseError);
      console.error('Raw response:', aiResponse);
      
      // Provide fallback values in case of parsing error
      return parameters.map(param => ({
        name: param,
        value: '-',
        confidence: 0,
        source: 'unknown'
      }));
    }
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    
    // Provide fallback values in case of API error
    return parameters.map(param => ({
      name: param,
      value: '-',
      confidence: 0
    }));
  }
}