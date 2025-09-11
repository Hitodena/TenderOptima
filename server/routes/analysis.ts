import { Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth } from '../middleware/requireAuth';
import { generateComparisonAnalysis } from '../services/deepseek-api';
import type { SupplierResponse } from '../../shared/types';

interface AnalysisRequest {
  suppliers: Array<{
    id: number;
    name: string;
    email: string;
    responseIds?: number[];
  }>;
  parameters: string[];
  requestId?: number;
}

/**
 * Generate detailed supplier analysis using AI
 */
export async function generateSupplierAnalysis(req: Request, res: Response) {
  try {
    const { suppliers, parameters, requestId }: AnalysisRequest = req.body;
    const userId = req.user?.id;

    console.log(`[ANALYSIS] Starting analysis for ${suppliers.length} suppliers with ${parameters.length} parameters`);
    console.log(`[ANALYSIS] Request ID: ${requestId}, User ID: ${userId}`);

    if (!suppliers || suppliers.length === 0) {
      return res.status(400).json({ error: 'No suppliers provided for analysis' });
    }

    if (!parameters || parameters.length === 0) {
      return res.status(400).json({ error: 'No parameters provided for analysis' });
    }

    // Get all supplier responses for the request
    let supplierResponses = await storage.getSupplierResponses(requestId || null, userId);
    
    if (supplierResponses.length === 0 && userId) {
      supplierResponses = await storage.getSupplierResponses(requestId || null);
    }

    if (supplierResponses.length === 0) {
      return res.status(404).json({ error: 'No supplier responses found' });
    }

    console.log(`[ANALYSIS] Found ${supplierResponses.length} total supplier responses`);

    // Extract response IDs from suppliers
    const responseIds = suppliers.flatMap(s => {
      if (s.responseIds && Array.isArray(s.responseIds)) {
        return s.responseIds.map(id => Number(id));
      } else if (s.id) {
        return [Number(s.id)];
      }
      return [];
    });

    console.log(`[ANALYSIS] Looking for response IDs: ${responseIds}`);

    // Filter responses to only include the selected suppliers
    const relevantResponses = supplierResponses.filter(response => 
      response.requestId === requestId && responseIds.includes(response.id)
    );

    console.log(`[ANALYSIS] Found ${relevantResponses.length} relevant responses for analysis`);
    console.log(`[ANALYSIS] Parameters we're looking for:`, parameters);

    if (relevantResponses.length === 0) {
      return res.status(404).json({ error: 'No matching supplier responses found for selected suppliers' });
    }

    // Use EXACT comparison table logic - Group responses by email
    const responsesByEmail = new Map<string, SupplierResponse[]>();
    
    relevantResponses.forEach(response => {
      console.log(`[ANALYSIS] Processing response ${response.id}: email="${response.supplierEmail}", name="${response.supplierName}"`);
      
      if (!response.supplierEmail) {
        console.log(`[ANALYSIS] No email found for response ${response.id}, skipping`);
        return;
      }
      
      const email = response.supplierEmail.toLowerCase().trim();
      if (!email) {
        console.log(`[ANALYSIS] Empty email for response ${response.id}, skipping`);
        return;
      }
      
      console.log(`[ANALYSIS] Using email "${email}" for response ${response.id}`);
      
      if (!responsesByEmail.has(email)) {
        responsesByEmail.set(email, []);
      }
      responsesByEmail.get(email)!.push(response as any);
    });

    console.log(`[ANALYSIS] Grouped into ${responsesByEmail.size} unique email addresses`);

    // Create supplier data with email as name (exact same as comparison table)
    const supplierDetails: any[] = [];
    const parameterValues: Record<string, Record<string, string>> = {};
    
    // Initialize parameter structure
    parameters.forEach(param => {
      parameterValues[param] = {};
    });
    
    // Process each email group and aggregate their parameter data - EXACT SAME LOGIC
    for (const [email, responses] of Array.from(responsesByEmail.entries())) {
      console.log(`[ANALYSIS] Processing email: ${email} with ${responses.length} responses`);
      
      // Sort responses by date (newest first) for latest-value priority
      const sortedResponses = responses.sort((a, b) => {
        const dateA = a.responseDate ? new Date(a.responseDate).getTime() : 0;
        const dateB = b.responseDate ? new Date(b.responseDate).getTime() : 0;
        return dateB - dateA;
      });
      
      // Use the supplier name directly from the most recent email response - EXACT SAME LOGIC
      let supplierName = email; // Fallback to email if no supplier name found
      
      // Find the supplier name from the most recent response first
      for (const response of sortedResponses) {
        if (response.supplierName && response.supplierName.trim() && response.supplierName !== email) {
          supplierName = response.supplierName;
          console.log(`[ANALYSIS] Using supplier name "${supplierName}" from latest email response for ${email}`);
          break;
        }
      }
      
      if (supplierName === email) {
        console.log(`[ANALYSIS] No supplier name found in responses, using email as fallback: ${email}`);
      }
      
      // Count only responses that match the selected supplier IDs
      const selectedResponseCount = responses.filter(response => 
        responseIds.includes(response.id)
      ).length;
      
      const supplierDetail = {
        id: sortedResponses[0].id, // Use most recent response ID
        name: supplierName,
        email: email,
        phone: '',
        website: '',
        contactName: '',
        responseCount: selectedResponseCount || responses.length // Fallback to total if no matches
      };
      
      supplierDetails.push(supplierDetail);
      
      // Aggregate parameter values across all responses for this supplier - EXACT SAME LOGIC
      const aggregatedParams: Record<string, { latest: string; first: string; latestDate: Date; firstDate: Date }> = {};
      
      // Process all responses to find latest and first values for each parameter
      for (const response of sortedResponses) {
        try {
          console.log(`[ANALYSIS] Loading pre-extracted parameters for response ${response.id} (${response.responseDate})`);
          
          const extractedParams = await storage.getExtractedParametersByResponseId(response.id);
          
          if (extractedParams && extractedParams.parameters) {
            let parsedParams = extractedParams.parameters;
            
            // Parse if it's a JSON string
            if (typeof parsedParams === 'string') {
              try {
                parsedParams = JSON.parse(parsedParams);
              } catch (e) {
                console.error(`[ANALYSIS] Error parsing parameters for response ${response.id}:`, e);
                continue;
              }
            }
            
            console.log(`[ANALYSIS] Processing parameters for response ${response.id}:`, parsedParams);
            
            // Aggregate parameters with date tracking for latest-value-with-history - EXACT SAME LOGIC
            for (const [paramName, paramValue] of Object.entries(parsedParams)) {
              // Check if this parameter is one we're looking for
              const isRequestedParam = parameters.some(p => p.trim().toLowerCase() === paramName.trim().toLowerCase());
              
              if (isRequestedParam && paramValue && String(paramValue).trim() !== '-' && String(paramValue).trim() !== '') {
                const value = String(paramValue).trim();
                const responseDate = response.responseDate ? new Date(response.responseDate) : new Date();
                
                console.log(`[ANALYSIS] Found parameter "${paramName}" = "${value}" from response ${response.id} (${responseDate.toISOString()})`);
                
                // Use the exact parameter name from the request list for consistency
                const matchedParamName = parameters.find(p => p.trim().toLowerCase() === paramName.trim().toLowerCase()) || paramName;
                
                if (!aggregatedParams[matchedParamName]) {
                  // First non-empty value found
                  aggregatedParams[matchedParamName] = {
                    latest: value,
                    first: value,
                    latestDate: responseDate,
                    firstDate: responseDate
                  };
                  console.log(`[ANALYSIS] Initial value for ${matchedParamName}: "${value}" (${response.responseDate})`);
                } else {
                  // Update latest if this response is newer
                  if (responseDate > aggregatedParams[matchedParamName].latestDate) {
                    aggregatedParams[matchedParamName].latest = value;
                    aggregatedParams[matchedParamName].latestDate = responseDate;
                    console.log(`[ANALYSIS] Updated latest value for ${matchedParamName}: "${value}" (${response.responseDate})`);
                  }
                  // Update first if this response is older
                  if (responseDate < aggregatedParams[matchedParamName].firstDate) {
                    aggregatedParams[matchedParamName].first = value;
                    aggregatedParams[matchedParamName].firstDate = responseDate;
                    console.log(`[ANALYSIS] Updated first value for ${matchedParamName}: "${value}" (${response.responseDate})`);
                  }
                }
              }
            }
          } else {
            console.log(`[ANALYSIS] No pre-extracted parameters found for response ${response.id}`);
          }
        } catch (error) {
          console.error(`[ANALYSIS] Error processing response ${response.id}:`, error);
        }
      }
      
      // Store final aggregated values for this supplier - USE LATEST VALUE FOR AI (clean)
      for (const paramName of parameters) {
        if (aggregatedParams[paramName]) {
          const { latest } = aggregatedParams[paramName];
          // Store CLEAN VALUE for AI (no HTML)
          parameterValues[paramName][email] = latest;
          console.log(`[ANALYSIS] Final aggregated ${paramName} = "${latest}" for ${email}`);
        } else {
          parameterValues[paramName][email] = '-';
        }
      }
    }
    
    // Generate table data using supplier names - EXACT SAME LOGIC
    const tableData = parameters.map(param => {
      const row: Record<string, string> = { 'Parameter': param };
      
      supplierDetails.forEach(supplier => {
        const value = parameterValues[param][supplier.email] || '-';
        row[supplier.name] = value;
        console.log(`[ANALYSIS] Table row: ${param} -> ${supplier.name} = ${value}`);
      });
      
      return row;
    });

    console.log(`[ANALYSIS] Prepared data for ${supplierDetails.length} suppliers and ${tableData.length} parameters`);

    // Generate AI analysis using DeepSeek
    const analysis = await generateTenderAnalysis(supplierDetails, tableData, parameters, requestId);

    console.log(`[ANALYSIS] Generated analysis with ${analysis.length} characters`);

    res.json({
      success: true,
      analysis: analysis,
      supplierCount: supplierDetails.length,
      parameterCount: parameters.length,
      dataUsed: {
        suppliers: supplierDetails.map(s => ({ name: s.name, email: s.email, responseCount: s.responseCount })),
        parameters: parameters
      }
    });

  } catch (error) {
    console.error('[ANALYSIS] Error generating supplier analysis:', error);
    res.status(500).json({ 
      error: 'Failed to generate analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Generate detailed tender analysis using AI - specifically for tender documentation
 */
async function generateTenderAnalysis(
  supplierDetails: Array<{ id: number; name: string; email?: string; phone?: string; website?: string; contactName?: string; responseCount?: number; }>,
  tableData: Array<Record<string, string>>,
  parameters: string[],
  requestId?: number
): Promise<string> {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  
  if (!DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY is not set for tender analysis');
    return "Не удалось сгенерировать анализ - API ключ не установлен.";
  }
  
  try {
    console.log(`[TENDER ANALYSIS] Generating analysis for ${supplierDetails.length} suppliers with ${parameters.length} parameters`);
    
    // Format supplier names for the table
    const supplierNames = supplierDetails.map(s => s.name);
    
    // Create a formatted table for the prompt
    let formattedTable = "| Параметр | " + supplierNames.join(" | ") + " |\n";
    formattedTable += "|" + Array(supplierNames.length + 1).fill("---").join("|") + "|\n";
    
    tableData.forEach(row => {
      const paramName = row['Parameter'] || 'Неизвестный параметр';
      let rowString = `| ${paramName} |`;
      
      supplierNames.forEach(supplierName => {
        let value = row[supplierName] || '-';
        // Remove ALL HTML tags and spans for clean analysis
        value = value.replace(/<[^>]*>/g, '').trim();
        // Remove any leftover HTML entities
        value = value.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        // Clean up extra whitespace
        value = value.replace(/\s+/g, ' ').trim();
        
        console.log(`[TENDER ANALYSIS] Clean value for ${paramName} - ${supplierName}: "${value}"`);
        rowString += ` ${value} |`;
      });
      
      formattedTable += rowString + "\n";
    });

    // Create supplier context information
    let supplierContext = "";
    supplierDetails.forEach(supplier => {
      supplierContext += `
**${supplier.name}**:
- Email: ${supplier.email || 'не указан'}
- Телефон: ${supplier.phone || 'не указан'}
- Количество предложений: ${supplier.responseCount || 1}
`;
    });

    // Create comprehensive prompt for tender specialist analysis
    const prompt = `
Ты - опытный специалист по тендерам и закупкам с 15-летним стажем работы в госзакупках и коммерческих тендерах.

КОНТЕКСТ ЗАДАЧИ:
Необходимо провести профессиональный анализ коммерческих предложений от поставщиков для подготовки тендерной документации и принятия обоснованного решения о выборе поставщика.

ИНФОРМАЦИЯ О ПОСТАВЩИКАХ:
${supplierContext}

СРАВНИТЕЛЬНАЯ ТАБЛИЦА ПРЕДЛОЖЕНИЙ:
${formattedTable}

ЗАДАЧИ АНАЛИЗА:

1. **СРАВНИТЕЛЬНЫЙ АНАЛИЗ ПО ПАРАМЕТРАМ**
   - Проанализируй каждый параметр отдельно
   - Определи наиболее выгодные условия по каждому критерию
   - Укажи существенные различия между предложениями

2. **ДИНАМИКА ИЗМЕНЕНИЙ** (если поставщик подавал несколько предложений)
   - Как изменились цены и условия
   - Улучшились ли предложения со временем
   - Какие корректировки вносились поставщиками

3. **ОЦЕНКА РИСКОВ**
   - Финансовые риски (цена, условия оплаты)
   - Временные риски (сроки поставки, гарантии)
   - Качественные риски (опыт поставщика, надежность)

4. **РЕКОМЕНДАЦИИ ПО ВЫБОРУ**
   - Какое предложение наиболее выгодно и почему
   - Альтернативные варианты и их обоснование
   - Критические факторы для принятия решения

5. **ВОПРОСЫ ДЛЯ УТОЧНЕНИЯ** (если необходимо)
   - Что нужно дополнительно уточнить у поставщиков
   - Какая информация отсутствует для полного анализа
   - Рекомендации по доработке предложений

6. **ОБОСНОВАНИЕ ДЛЯ ТЕНДЕРНОЙ ДОКУМЕНТАЦИИ**
   - Краткое резюме для включения в протокол оценки
   - Обоснование выбора победителя
   - Соответствие требованиям и критериям оценки

КРИТЕРИИ ОЦЕНКИ:
- Цена (чем ниже, тем лучше)
- Сроки поставки (чем быстрее, тем лучше)
- Условия оплаты (отсрочка лучше предоплаты)
- Гарантийные обязательства (чем дольше, тем лучше)
- Дополнительные услуги (монтаж, доставка, сервис)

Представь анализ в структурированном формате с четкими выводами и рекомендациями.
`;

    console.log('[TENDER ANALYSIS] Calling DeepSeek API for comprehensive tender analysis');
    
    const axios = require('axios');
    
    // Call DeepSeek API
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
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
    console.log('[TENDER ANALYSIS] DeepSeek API analysis response received');
    
    return analysisResponse;
  } catch (error) {
    console.error('[TENDER ANALYSIS] Error generating analysis:', error);
    return "Не удалось сгенерировать анализ из-за технической ошибки. Проверьте подключение к API.";
  }
}