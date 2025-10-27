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
    
    // Just extract parameters from the single response using the same good prompt
    let singleResponseText = '';
    if (responses.length === 1) {
      singleResponseText = responses[0].content || '';
      if (responses[0].attachmentText) {
        singleResponseText += '\n\n' + responses[0].attachmentText;
      }
    }
    
    // Use the same good prompt as in extract-parameters.ts
    const systemPrompt = `
      Ты - эксперт по анализу коммерческих предложений и извлечению ключевых параметров из текста. 
      
      ВАЖНО: Извлекай ТОЛЬКО следующие запрошенные параметры: ${parameters.join(', ')}.
      НЕ извлекай никакие другие параметры, даже если они есть в тексте.
      
      Твоя задача - внимательно изучить текст письма и вложенных документов и найти значения ТОЛЬКО для указанных выше параметров.
      
      КРИТИЧЕСКИ ВАЖНО - ПРИОРИТЕТ ИСТОЧНИКОВ:
      1. ВЛОЖЕНИЯ ИМЕЮТ ПРИОРИТЕТ НАД ТЕЛОМ ПИСЬМА
      2. Если параметр найден И во вложении И в теле письма - используй значение ИЗ ВЛОЖЕНИЯ
      3. Если параметр найден только в теле письма - используй его
      4. Если параметр найден только во вложении - используй его
      
      ВАЖНО: НЕ РАЗДЕЛЯЙ ОДИНАКОВЫЕ ПАРАМЕТРЫ ПО РАЗНЫМ КОЛОНКАМ!
      Если видишь "цена за единицу" и во вложении и в теле письма - используй ТОЛЬКО значение из вложения.
      НЕ создавай отдельные колонки для одного и того же параметра!
      
      ПРАВИЛА ИЗВЛЕЧЕНИЯ:
      1. СНАЧАЛА ищи информацию во вложенных документах (ПРИОРИТЕТ)
      2. ТОЛЬКО ЕСЛИ не найдено во вложении - ищи в теле письма
      3. Для стандартных параметров используй общепринятые правила поиска
      4. Для пользовательских параметров (не входящих в стандартный список) ищи по точному названию или смыслу
      5. Если параметр не найден, верни "-" с confidence: 0
      6. Всегда включай валюту в значения цен и стоимости
      
      ПОИСК СТАНДАРТНЫХ ПАРАМЕТРОВ:
      - "общая стоимость без ндс": ищи "итого" "сумма" "общая стоимость" "общая цена" "цена без ндс" + "без ндс"/"без налога". Добавляй валюту. НЕ ИСПОЛЬЗУЙ ИНН или другие номера!
      - "общая стоимость с ндс": ищи "итого к оплате" "итого" "с ндс" "с учетом ндс" "цена с ндс" "стоимость с ндс". Добавляй валюту. НЕ ИСПОЛЬЗУЙ ИНН или другие номера!
      - "ндс" или "сам ндс": ищи "НДС" "ндс" "налог" "20% НДС" "НДС 20%" "налог на добавленную стоимость" + числа. Добавляй валюту
      - "контактный телефон для связи": ищи номера телефонов в любом формате
      - "цена за единицу без ндс": ищи "цена" "стоимость" + "за шт." "за ед." + числа. Добавляй валюту и единицы. НЕ ИСПОЛЬЗУЙ ИНН или другие номера!
      - "сроки поставки": ищи цифры + "дней" "недель" "рабочих дней"
      - "условия поставки": ищи "доставка" "самовывоз" "франко". Включай адрес если указан
      - "условия оплаты": ищи "предоплата" "аванс" "отсрочка" "% предоплаты"
      - "товар": полное название с характеристиками
      
      КРИТИЧЕСКИ ВАЖНО - РАЗЛИЧЕНИЕ ЦЕН И НОМЕРОВ:
      - НЕ ИСПОЛЬЗУЙ ИНН, ОГРН, КПП, номера телефонов как цены!
      - ИНН обычно 10-12 цифр подряд (например: 7713471291)
      - ОГРН обычно 13-15 цифр подряд
      - КПП обычно 9 цифр подряд
      - Цены обычно меньше и содержат запятые или точки (например: 128000, 0,16, 320)
      - Цены часто сопровождаются словами "руб", "рублей", "₽"
      
      КРИТИЧЕСКИ ВАЖНО - РЕКВИЗИТЫ ПОСТАВЩИКА:
      Для параметров "наименование поставщика" и "ИНН / УНП" ВНИМАТЕЛЬНО ищи реквизиты ОТПРАВИТЕЛЯ письма:
      1. СНАЧАЛА проверь ШАПКУ письма/документа - там обычно указаны реквизиты отправителя
      2. ЗАТЕМ проверь ПОДВАЛ письма/документа - там могут быть дополнительные реквизиты
      3. НЕ ПУТАЙ отправителя с получателем! Ищи реквизиты того, кто ОТПРАВЛЯЕТ предложение
      4. "наименование поставщика": ищи полное название компании отправителя (ООО, ИП, ЧУП и т.д.)
      5. "ИНН / УНП": ищи налоговые номера отправителя (УНП, ИНН, ОГРН и т.д.)
      6. ВАЖНО: получатель письма НЕ является поставщиком! Поставщик - это отправитель коммерческого предложения
      
      ВАЖНО - СИНОНИМЫ ДЛЯ ЦЕН И СТОИМОСТИ:
      Слова "цена" и "стоимость" являются СИНОНИМАМИ и означают одно и то же!
      - "цена без ндс" = "стоимость без ндс" = "общая стоимость без ндс"
      - "цена с ндс" = "стоимость с ндс" = "общая стоимость с ндс"
      - "цена за единицу" = "стоимость за единицу" = "цена за шт" = "стоимость за шт"
      При поиске параметров учитывай ВСЕ эти варианты как равнозначные!
      
      ПОИСК ПОЛЬЗОВАТЕЛЬСКИХ ПАРАМЕТРОВ:
      - Для параметров, не входящих в стандартный список выше, ищи ТОЛЬКО по точному названию параметра
      - НЕ СМЕШИВАЙ похожие параметры: например, "монтаж" НЕ является "сроками поставки"
      - "монтаж" - ищи слова "монтаж", "установка", "подключение" и связанные сроки или стоимость
      - "сроки поставки" - ищи только доставку товара, НЕ монтаж или установку
      - Для каждого пользовательского параметра ищи его точное упоминание или прямые синонимы
      - Если точное совпадение не найдено - верни "-" с confidence: 0
      
      ПРИМЕРЫ ПРАВИЛЬНОГО ИЗВЛЕЧЕНИЯ:
      - "общая стоимость с ндс": "76716 руб." (с валютой)
      - "контактный телефон для связи": "+7(846)250-00-16, +791602910909"
      - "сервис": "-" (если не найден в тексте)
      
      ПРИМЕР ПРАВИЛЬНОГО ПРИОРИТЕТА:
      Если во вложении: "цена за 1 шт 1500 рублей"
      И в теле письма: "цена за 1 шт 22500 рублей"
      ТО используй: "цена за единицу без ндс": "1500 рублей" (из вложения)
      НЕ создавай отдельную колонку "общая стоимость" для значения из вложения!
      
      Верни JSON-массив ТОЛЬКО для запрошенных параметров:
      [
        {
          "name": "точное название запрошенного параметра",
          "value": "извлеченное значение или '-' если не найдено",
          "confidence": число от 0 до 1 (0 - не найдено, 1 - полная уверенность)
        }
      ]
    `;
    
    try {
      // Call DeepSeek API with the same good prompt
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: singleResponseText
            }
          ],
          temperature: 0.1
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
          }
        }
      );
      
      if (response.data.choices && response.data.choices.length > 0) {
        const aiResponse = response.data.choices[0].message.content;
        
        try {
          // Extract the JSON from the response
          const jsonMatch = aiResponse.match(/\[\s*\{[\s\S]*?\}\s*\]/);
          if (jsonMatch) {
            const extractedJson = jsonMatch[0];
            const parsedResults = JSON.parse(extractedJson);
            
            // Convert to the expected result format
            const finalParams: Record<string, string> = {};
            parsedResults.forEach((param: any) => {
              finalParams[param.name] = param.value || '-';
            });
            
            return {
              supplier_email: supplierEmail,
              supplier_name: supplierName,
              final_parameters: finalParams,
              improvements: [],
              summary: "Получено только одно предложение от поставщика."
            };
          }
        } catch (parseError) {
          console.error('Error parsing AI response for single response:', parseError);
        }
      }
    } catch (error) {
      console.error('Error calling DeepSeek API for single response:', error);
    }
    
    // Fallback: return empty parameters
    const finalParams: Record<string, string> = {};
    parameters.forEach(param => {
      finalParams[param] = '-';
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
