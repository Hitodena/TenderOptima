import { Request, Response } from 'express';
import { extractParameterFromContent, analyzeParameterValues } from '../services/parameter-extraction';
import { storage } from '../storage';
import { generateComparisonAnalysis } from '../services/deepseek-api';
import { analyzeSupplierImprovements } from '../services/deepseek-api';
import type { ExtractionResult, Supplier, SupplierResponse } from '../../shared/types';
import OpenAI from "openai";
import { requireAuth } from '../middleware/requireAuth';

// Initialize OpenAI client for DeepSeek API (only if key is available)
let openai: OpenAI | null = null;
if (process.env.DEEPSEEK_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
  });
} else {
  console.warn('DEEPSEEK_API_KEY not set. DeepSeek functionality will be disabled.');
}

// Helper function to call DeepSeek API
async function callDeepSeekAPI(prompt: string): Promise<string> {
  try {
    console.log(`Calling DeepSeek API with ${prompt.length} chars of text...`);
    
    // Check if OpenAI client is initialized
    if (!openai) {
      throw new Error('DeepSeek API client not initialized. Please set DEEPSEEK_API_KEY environment variable.');
    }
    
    // Call the DeepSeek API
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 4000
    });
    
    console.log('DeepSeek API response received');
    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    return '';
  }
}

// Extract text from attachments of a supplier response
async function enrichSupplierResponseWithExtractedText(response: SupplierResponse): Promise<SupplierResponse> {
  if (!response.attachments || !Array.isArray(response.attachments) || response.attachments.length === 0) {
    return response;
  }

  try {
    // Process each attachment to ensure it has extractedText
    const enrichedAttachments = response.attachments.map(attachment => {
      // If extractedText is already there, no need to process
      if (attachment.extractedText) {
        return attachment;
      }

      // No content to extract text from
      if (!attachment.content) {
        return {
          ...attachment,
          extractedText: ''
        };
      }

      // For PDF files, use the content as extractedText
      // In a real application, you'd use a proper PDF text extraction library
      return {
        ...attachment,
        extractedText: attachment.content
      };
    });

    // Return response with enriched attachments
    return {
      ...response,
      attachments: enrichedAttachments
    };
  } catch (error) {
    console.error('Error enriching supplier response with extracted text:', error);
    return response;
  }
}

// Generate comparison data with supplier responses from the database
// Interface for supplier comparison request format
interface ComparisonSupplier {
  id: number;
  name: string;
  email: string;
  responseIds: number[];
}

export async function generateRealComparisonData(suppliers: ComparisonSupplier[], parameters: string[], requestId?: number, userId?: number) {
  try {
    console.log(`Generating comparison with real data for request: ${requestId || 'No specific request'}`);
    console.log(`Comparing ${suppliers.length} suppliers with ${parameters.length} parameters}`);
    console.log(`User ID for data isolation: ${userId || 'Not provided'}`);
    
    // Debugging: Check what we received as input
    if (suppliers.length > 0) {
      console.log('First supplier data:', JSON.stringify(suppliers[0]));
    }
    console.log('Parameters list:', JSON.stringify(parameters));

    // Get all supplier responses for the given request if requestId provided
    // or get all supplier responses if no requestId
    // Используем userId для изоляции данных, но с fallback если ничего не найдено
    let supplierResponses = await storage.getSupplierResponses(requestId || null, userId);
    console.log(`Found ${supplierResponses.length} supplier responses for user ${userId}`);

    // Если ответы не найдены для конкретного пользователя, попробуем получить все ответы
    // Это временная мера обратной совместимости для данных, созданных до внедрения аутентификации
    if (supplierResponses.length === 0 && userId) {
      console.log('No responses found with userId filter. Trying without userId as fallback...');
      supplierResponses = await storage.getSupplierResponses(requestId || null);
      console.log(`Found ${supplierResponses.length} supplier responses in total without userId filter`);
    }

    if (supplierResponses.length === 0) {
      console.log('No supplier responses found. Cannot generate comparison.');
      throw new Error('No supplier responses found for the selected request');
    }

    // Extract all response IDs from the suppliers array
    const responseIds = suppliers.flatMap(s => s.responseIds || []).map(id => Number(id));
    console.log('Response IDs selected for comparison:', responseIds);
    
    // Log available response IDs
    console.log('Available response IDs in the system:',
      supplierResponses.map(response => 
        `response.id=${response.id}, response.supplierId=${response.supplierId}, supplierName=${response.supplierName}`
      ).slice(0, 10) // Show only first 10 for brevity
    );
    
    // Find responses matching the selected response IDs
    const relevantResponses = supplierResponses.filter(response => {
      // Check if response ID matches any of the selected response IDs
      const matchById = responseIds.includes(Number(response.id));
      
      // Consider this response relevant if the ID matches
      return matchById;
    });
    
    // CRITICAL: Log that we are ONLY using the exact parameters specified by the user
    console.log(`Using ONLY the requested parameters: ${JSON.stringify(parameters)}`);
    console.log(`STRICTLY using only these exact parameters for comparison results`);

    console.log(`Found ${relevantResponses.length} relevant responses for the selected suppliers`);

    if (relevantResponses.length === 0) {
      console.log('No relevant responses found for the selected suppliers.');
      throw new Error('No responses found for the selected suppliers');
    }

    // Enrich responses with extracted text from attachments (if available)
    console.log('Enriching supplier responses with extracted text from attachments...');
    const enrichedResponses = await Promise.all(
      relevantResponses.map(response => enrichSupplierResponseWithExtractedText(response))
    );
    console.log('Enrichment of supplier responses completed');

    // Group responses by email address to identify the same supplier who sent multiple responses
    const responsesByEmail = new Map<string, {
      responses: typeof enrichedResponses,
      id: number,
      name: string
    }>();
    
    // Создаем структуру для отслеживания email поставщиков
    const supplierEmails = new Map<number, string>();
    
    // Добавляем дополнительное логирование для отладки группировки по email
    console.log("Starting email grouping process...");
    console.log(`Total responses to process: ${enrichedResponses.length}`);
    
    // Сначала проходим и отмечаем email каждого поставщика для корректной группировки
    // и выводим информацию обо всех email для диагностики
    console.log("All supplier emails in responses:");
    enrichedResponses.forEach(response => {
      if (response.supplierEmail) {
        const email = response.supplierEmail.toLowerCase().trim();
        if (email) {
          supplierEmails.set(response.id, email);
          console.log(`Response ID: ${response.id}, Email: ${email}, Supplier: ${response.supplierName}`);
        } else {
          console.log(`Response ID: ${response.id} has empty email after trimming`);
        }
      } else {
        console.log(`Response ID: ${response.id} has no email`);
      }
    });
    
    // Затем группируем ответы по email и применяем строгое сравнение email
    enrichedResponses.forEach(response => {
      if (!response.supplierEmail) {
        console.log(`Response ${response.id} has no supplier email, skipping grouping`);
        return;
      }
      
      const email = response.supplierEmail.toLowerCase().trim();
      
      if (!email) {
        console.log(`Response ${response.id} has empty email after trimming, skipping grouping`);
        return;
      }
      
      if (!responsesByEmail.has(email)) {
        console.log(`Creating new group for email: ${email} (Response ID: ${response.id})`);
        // CRITICAL FIX: Use email as supplier name for consistent display
        const displayName = email; // Use actual email instead of fake names
        responsesByEmail.set(email, {
          responses: [],
          id: response.id,
          name: displayName
        });
      } else {
        console.log(`Adding to existing group for email: ${email} (Response ID: ${response.id})`);
      }
      
      // Добавляем ответ в соответствующую группу
      responsesByEmail.get(email)?.responses.push(response);
    });
    
    // Дополнительная проверка и логирование для отладки группировки
    console.log(`Initial responses count: ${enrichedResponses.length}`);
    console.log(`Unique emails: ${responsesByEmail.size}`);
    responsesByEmail.forEach((group, email) => {
      console.log(`Email: ${email}, Response count: ${group.responses.length}, First response ID: ${group.id}, Name: ${group.name}`);
    });
    
    console.log(`Grouped responses by email: ${responsesByEmail.size} unique suppliers found`);
    
    // Define the type for our suppliers array
    type UniqueSupplier = {
      id: number;
      name: string;
      email: string;
      responses: SupplierResponse[];
      responseCount: number;
      improvements: Record<string, { oldValue: string; newValue: string; description?: string }>;
      firstResponse: SupplierResponse;
      lastResponse: SupplierResponse;
      productName?: string; // Добавляем информацию о товаре
    };
    
    // Create an array to store unique suppliers - ensure we're working with properly mapped emails
    let uniqueSuppliers: UniqueSupplier[] = [];
    
    // Create a list of unique suppliers based on email grouping with promises for async operations
    const uniqueSuppliersPromises = Array.from(responsesByEmail.entries()).map(async ([email, data]) => {
      // CRITICAL FIX: Use email as the primary display name instead of fake supplier names
      let supplierName = email; // Always use email for consistent display
      
      console.log(`Using email "${email}" as supplier name for consistency`);
      
      // Сортируем ответы по дате для анализа изменений (от ранних к поздним)
      const sortedResponses = [...data.responses].sort((a, b) => {
        const dateA = a.responseDate ? new Date(a.responseDate).getTime() : 0;
        const dateB = b.responseDate ? new Date(b.responseDate).getTime() : 0;
        return dateA - dateB;
      });
      
      // Сохраняем первый и последний ответы для анализа улучшений
      const firstResponse = sortedResponses[0];
      const lastResponse = sortedResponses[sortedResponses.length - 1];
      
      // Отслеживаем улучшения параметров (будет заполнено позже в процессе анализа)
      const improvements: Record<string, { oldValue: string; newValue: string; description?: string }> = {};
      
      // Если у поставщика больше одного ответа, пытаемся найти улучшения
      if (sortedResponses.length > 1) {
        console.log(`📈 Анализируем улучшения для ${email} (${sortedResponses.length} ответов)`);
        
        // Берем первый и последний ответ для сравнения улучшений
        const firstText = firstResponse.content || '';
        const lastText = lastResponse.content || '';
        
        // Если есть достаточно текста для анализа, отправляем в DeepSeek
        if (firstText.length > 100 && lastText.length > 100) {
          try {
            // Формируем текст для анализа
            const combinedText = `Первый ответ от поставщика:
${firstText}

Последний ответ от того же поставщика:
${lastText}`;
            
            console.log(`DeepSeek API: Using ${combinedText.length} chars of text for improvement analysis`);
            
            // Отправляем запрос в DeepSeek API для анализа улучшений
            console.log(`DeepSeek API: Calling API for supplier improvement analysis`);
            
            // Формируем промт для DeepSeek API
            const prompt = `Проанализируй два ответа от одного поставщика (первый и последний) и найди все улучшения в условиях.
Ищи изменения в таких параметрах как: цена, сроки, условия оплаты, гарантии, доставка, комплектация и т.д.
Сравни условия и выяви, какие параметры улучшились.

Формат ответа должен быть строго в формате JSON-массива объектов, где каждый объект имеет структуру:
{
  "parameter": "Название параметра, который улучшился",
  "oldValue": "Старое значение из первого ответа",
  "newValue": "Новое улучшенное значение из последнего ответа",
  "description": "Краткое описание улучшения"
}

Перечисли все конкретные улучшения, которые ты нашел. Если улучшений нет, верни пустой массив [].

Вот два ответа от поставщика для сравнения:

${combinedText}`;

            // Получаем ответ от DeepSeek API
            const improvementAnalysisResponse = await callDeepSeekAPI(prompt);
            console.log(`DeepSeek API supplier improvement analysis response received`);
            
            // Парсим ответ
            try {
              // Ищем JSON в ответе, используя регулярное выражение
              const jsonMatch = improvementAnalysisResponse.match(/\[\s*\{.*\}\s*\]/s);
              if (jsonMatch) {
                const parsedImprovements = JSON.parse(jsonMatch[0]);
                console.log(`Parsed AI supplier improvement analysis results`);
                
                // Преобразуем массив улучшений в объект с ключами по названию параметра
                parsedImprovements.forEach(improvement => {
                  if (improvement.parameter && improvement.oldValue && improvement.newValue) {
                    improvements[improvement.parameter] = {
                      oldValue: improvement.oldValue,
                      newValue: improvement.newValue,
                      description: improvement.description
                    };
                  }
                });
              }
            } catch (error) {
              console.error(`Error parsing supplier improvement analysis: ${error}`);
            }
          } catch (error) {
            console.error(`Error analyzing supplier improvements: ${error}`);
          }
        } else {
          console.log(`Insufficient text for improvement analysis from supplier ${email}`);
        }
      }
      
      return {
        id: data.id, // Используем ID первого ответа
        name: supplierName,
        email: email,
        responses: data.responses,
        responseCount: data.responses.length,
        improvements, // Сохраняем информацию об улучшениях
        firstResponse,
        lastResponse
      };
    });
    
    // Wait for all supplier promises to resolve
    uniqueSuppliers = await Promise.all(uniqueSuppliersPromises);
    
    console.log(`Created ${uniqueSuppliers.length} unique supplier entries for comparison`);

    // Create a safe supplier name map
    const supplierNameMap = new Map<number, string>();
    uniqueSuppliers.forEach(supplier => {
      supplierNameMap.set(supplier.id, supplier.name);
    });

    // Map to store parameter values for each supplier
    const parameterValues: Record<string, Record<string, string>> = {};
    
    // CRITICAL FIX: ONLY use exactly the parameters the user requested
    // This prevents the system from creating entries for default parameters that weren't selected
    
    // Log the exact parameters we'll be using (and ONLY these parameters)
    console.log('STRICT PARAMETER SELECTION: Using ONLY these exact parameters:', parameters);
    console.log('This should match exactly what was selected on the parameter selection page');

    // Initialize parameter map ONLY for explicitly requested parameters
    parameters.forEach(param => {
      // Create an entry for this parameter
      parameterValues[param] = {};
      
      // Initialize with email-based keys and name-based keys for each supplier
      uniqueSuppliers.forEach(supplier => {
        // Primary storage - using email as primary key (most reliable)
        if (supplier.email) {
          const emailKey = `email_${supplier.email.toLowerCase().trim()}`;
          parameterValues[param][emailKey] = "-";
        }
        
        // Also store by supplier name for backward compatibility
        parameterValues[param][supplier.name] = "-";
        
        // Add supplier_ID format key
        if (supplier.id) {
          parameterValues[param][`supplier_${supplier.id}`] = "-";
        }
      });
    });
    
    // Store analysis summaries for each supplier
    const supplierAnalysisSummaries: Record<string, string> = {};
    const supplierImprovements: Record<string, Array<{
      parameter: string;
      initial_value: string;
      final_value: string;
      improvement_description: string;
    }>> = {};

    // CRITICAL FIX: Use pre-extracted parameters instead of re-scanning emails
    console.log(`Processing ${uniqueSuppliers.length} unique suppliers using PRE-EXTRACTED parameters`);
    
    for (const supplier of uniqueSuppliers) {
      try {
        console.log(`Loading pre-extracted parameters for supplier: ${supplier.name} (${supplier.email}) with ${supplier.responses.length} responses`);
        
        // Skip suppliers with no email
        if (!supplier.email) {
          console.log(`Supplier ${supplier.name} has no email, skipping`);
          continue;
        }
        
        // Skip suppliers with no responses
        if (!supplier.responses || supplier.responses.length === 0) {
          console.log(`Supplier ${supplier.name} has no responses, skipping`);
          continue;
        }
        
        // For each response from this supplier, get the pre-extracted parameters
        for (const response of supplier.responses) {
          try {
            console.log(`Loading pre-extracted parameters for response ID: ${response.id}`);
            
            // Get pre-extracted parameters from database
            const extractedParams = await storage.getExtractedParametersByResponseId(response.id);
            
            if (extractedParams && extractedParams.parameters) {
              console.log(`Found pre-extracted parameters for response ${response.id}:`, extractedParams.parameters);
              
              // Store each parameter value using email as the key
              const supplierEmail = supplier.email.trim().toLowerCase();
              const emailKey = `email_${supplierEmail}`;
              
              // Parse parameters if it's a JSON string
              let parsedParams = extractedParams.parameters;
              if (typeof parsedParams === 'string') {
                try {
                  parsedParams = JSON.parse(parsedParams);
                } catch (e) {
                  console.error(`Error parsing parameters JSON for response ${response.id}:`, e);
                  continue;
                }
              }
              
              for (const [paramName, paramValue] of Object.entries(parsedParams)) {
                // Only store parameters that were requested by the user
                if (parameters.includes(paramName) && parameterValues[paramName]) {
                  const value = String(paramValue) || '-';
                  parameterValues[paramName][emailKey] = value;
                  parameterValues[paramName][supplier.name] = value; // Backup key
                  
                  console.log(`[PRE-EXTRACTED] Stored parameter "${paramName}" for email ${supplierEmail}: ${value}`);
                }
              }
            } else {
              console.log(`No pre-extracted parameters found for response ${response.id}`);
            }
            
          } catch (responseError) {
            console.error(`Error loading pre-extracted parameters for response ${response.id}:`, responseError);
          }
        }
        
      } catch (supplierError) {
        console.error(`Error processing supplier ${supplier.name}:`, supplierError);
        
        // Fallback to processing individual responses if improvement analysis fails
        console.log(`Falling back to processing individual responses for ${supplier.name}`);
        
        for (const response of supplier.responses) {
          try {
            // Extract values for each parameter from the response content and attachments
            for (const param of parameters) {
              try {
                // Ensure we have a valid attachments array
                const attachments = Array.isArray(response.attachments) ? response.attachments : [];
                
                // Use the extraction function that handles both content and attachments
                const extractionResult = extractParameterFromContent(response.content, attachments, param);

                // Store the value and indicate the source if it's from an attachment
                if (extractionResult.value !== "-") {
                  // Format value with attachment indicator if needed
                  const formattedValue = extractionResult.source === 'attachment' 
                    ? `${extractionResult.value} (из вложения)` 
                    : extractionResult.value;
                  
                  // Primary storage - using email as key for most reliable mapping
                  const supplierEmail = supplier.email?.trim().toLowerCase();
                  if (supplierEmail) {
                    // Store value indexed by email for reliable lookup
                    parameterValues[param][`email_${supplierEmail}`] = formattedValue;
                    console.log(`[EMAIL ISOLATION] Stored parameter "${param}" for email ${supplierEmail}: ${formattedValue}`);
                  }
                  
                  // Also store by supplier name for backward compatibility, but ONLY if the parameter was explicitly requested
                  if (parameters.includes(param)) {
                    parameterValues[param][supplier.name] = formattedValue;
                  } else {
                    console.log(`[STRICT PARAMETER FILTERING] Skipping parameter "${param}" because it was not requested by user`);
                  }
                  
                  // Log the result
                  console.log(`Found value for parameter "${param}": ${extractionResult.value} (source: ${extractionResult.source})`);
                } else {
                  console.log(`No value found for parameter "${param}"`);
                }
              } catch (err) {
                console.log(`Error extracting parameter ${param}:`, err);
              }
            }
          } catch (responseError) {
            console.error('Error processing supplier response:', responseError);
          }
        }
      }
    }

    // Get request details if available
    let requestDetails = null;
    if (requestId) {
      requestDetails = await storage.getSearchRequest(requestId);
    }

    // Get supplier details for all unique suppliers
    // First, make a set of unique email addresses to ensure we don't have duplicates
    const uniqueEmailSet = new Set<string>();
    uniqueSuppliers.forEach(supplier => {
      if (supplier.email) {
        uniqueEmailSet.add(supplier.email.toLowerCase().trim());
      }
    });
    
    console.log(`Found ${uniqueEmailSet.size} unique supplier emails out of ${uniqueSuppliers.length} supplier entries`);
    
    // Create a mapping from email to ALL suppliers with that email (not just the "best" one)
    const emailToSuppliersMap = new Map<string, typeof uniqueSuppliers[]>();
    
    // Process each unique email to group all suppliers with that email
    uniqueEmailSet.forEach(email => {
      // Find all suppliers with this email
      const suppliersWithEmail = uniqueSuppliers.filter(
        s => s.email && s.email.toLowerCase().trim() === email
      );
      
      if (suppliersWithEmail.length === 0) {
        console.log(`No suppliers found for email: ${email}`);
        return;
      }
      
      // Multiple suppliers with same email - add all to our map
      // Sort by name length (assuming longer names have more info, like company name)
      suppliersWithEmail.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameB.length - nameA.length;
      });
      
      console.log(`Found ${suppliersWithEmail.length} suppliers for email: ${email}`);
      emailToSuppliersMap.set(email, suppliersWithEmail);
    });
    
    // Now build a list of unique suppliers with one per unique email address
    // This ensures we include every unique email in the response without duplicates
    const allSuppliers: UniqueSupplier[] = [];
    
    // CRITICAL FIX: We need to ensure we have exactly one supplier per unique email
    // to avoid duplicate columns in the comparison table
    const processedEmails = new Set<string>();
    
    emailToSuppliersMap.forEach((suppliers) => {
      // Skip empty supplier lists
      if (suppliers.length === 0) return;
      
      // Get the first supplier in the list (best name according to our sort)
      const bestSupplier = suppliers[0];
      const email = bestSupplier.email?.toLowerCase().trim();
      
      // Skip suppliers without email
      if (!email) return;
      
      // Skip if we already processed this email
      if (processedEmails.has(email)) {
        console.log(`Skipping duplicate email: ${email} for supplier ${bestSupplier.name}`);
        return;
      }
      
      // Add to processed emails and include this supplier
      processedEmails.add(email);
      allSuppliers.push(bestSupplier);
      console.log(`Added supplier for email ${email}: ${bestSupplier.name}`);
    });
    
    console.log(`Total suppliers to process: ${allSuppliers.length}`);
    // Log each supplier that will be included in the final list
    allSuppliers.forEach((supplier, index) => {
      console.log(`Including supplier ${index + 1}: ${supplier.name} (${supplier.email})`);
    });
    
    const supplierDetails = await Promise.all(
      allSuppliers.map(async (supplier) => {
        // Get supplier details
        const supplierInfo = supplier.email ? await storage.getSupplierByEmail(supplier.email) : null;
        
        // Find the full supplier information from uniqueSuppliers to get improvements
        const originalSupplier = uniqueSuppliers.find(s => s.email === supplier.email);
        
        // Include improvement tracking information
        const supplierDetail = {
          id: supplier.id,
          name: supplier.name,
          email: supplier.email || '',
          phone: supplierInfo?.phone || '',
          website: supplierInfo?.website || '',
          contactName: '', // This field will be implemented in the future
          
          // Улучшения и дополнительная информация для отслеживания прогресса
          responseCount: originalSupplier?.responseCount || 1,
          improvements: originalSupplier?.improvements || {},
          firstResponseDate: originalSupplier?.firstResponse?.responseDate,
          lastResponseDate: originalSupplier?.lastResponse?.responseDate
        };
        
        // Дополнительный дебаг для отслеживания улучшений
      if (supplierDetail.improvements && Object.keys(supplierDetail.improvements).length > 0) {
        console.log(`Added supplier detail: ${supplierDetail.name} (${supplierDetail.email}) with ${Object.keys(supplierDetail.improvements).length} improvements`);
        console.log(`Improvement details:`, JSON.stringify(supplierDetail.improvements, null, 2));
      } else {
        console.log(`Added supplier detail: ${supplierDetail.name} (${supplierDetail.email}) without improvements`);
      }
        return supplierDetail;
      })
    );
    
    console.log(`Generated details for ${supplierDetails.length} unique suppliers`);
    
    // Debug output to show all supplier details being sent to the frontend
    console.log("Supplier details for frontend:");
    supplierDetails.forEach((supplier, index) => {
      console.log(`  [${index}] ID: ${supplier.id}, Name: ${supplier.name}, Email: ${supplier.email}`);
    });

    // Get supplier names for column headers from the email-filtered list
    const supplierNames = supplierDetails.map(supplier => supplier.name);

    // Format CSV for Excel with proper encoding
    function generateCSV(data: any[], columns: string[], requestId?: number) {
      // Add BOM for Excel to recognize UTF-8
      let csv = '\ufeff';
      
      // Add headers
      csv += columns.join(';') + '\n';
      
      // Add data rows
      data.forEach(row => {
        const rowData = columns.map(col => {
          // Replace any semicolons in the value with commas to avoid CSV parsing issues
          const value = row[col] ? String(row[col]).replace(/;/g, ',') : '';
          // Wrap value in quotes if it contains a comma or newline
          return (value.includes(',') || value.includes('\n')) ? `"${value}"` : value;
        });
        csv += rowData.join(';') + '\n';
      });
      
      return csv;
    }

    // Generate HTML table for display
    function generateHTMLTable(data: any[], columns: string[], requestId?: number) {
      let html = '<div class="overflow-x-auto">\n';
      html += '<table class="min-w-full divide-y divide-gray-200">\n';
      
      // Add headers
      html += '<thead>\n<tr class="bg-gray-50">\n';
      columns.forEach(col => {
        html += `<th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col}</th>\n`;
      });
      html += '</tr>\n</thead>\n';
      
      // Add data rows
      html += '<tbody class="bg-white divide-y divide-gray-200">\n';
      data.forEach((row, idx) => {
        html += `<tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">\n`;
        columns.forEach(col => {
          const value = row[col] || '-';
          html += `<td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">${value}</td>\n`;
        });
        html += '</tr>\n';
      });
      html += '</tbody>\n</table>\n</div>';
      
      return html;
    }

    // Define our parameter normalization function for consistent case handling
    const normalizeParameterForComparison = (param: string): string => {
      return param
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')        // Normalize spaces
        .replace(/ндс/i, 'ндс')      // Normalize НДС/Ндс to lowercase
        .replace(/с\s+ндс/i, 'с ндс') // Normalize "с НДС" format
        .replace(/без\s+ндс/i, 'без ндс'); // Normalize "без НДС" format
    };
    
    // Generate data table for the UI with proper email-based grouping and parameter isolation
    // CRITICAL FIX: Ensure we ONLY use the exact parameters requested by the user
    console.log(`[STRICT PARAMETER FILTERING] Using ONLY these exact parameters: ${JSON.stringify(parameters)}`);
    const tableData = parameters.map(param => {
      const row: Record<string, string> = { 'Parameter': param, 'parameter': param };
      
      // Create email-to-parameters mapping to isolate values by unique supplier email
      // This ensures suppliers with the same email share the same values
      const emailToParameterValue = new Map<string, string>();
      
      // First pass: STRICT ISOLATION by email for parameter values
      // This ensures each supplier only gets parameters from its own emails
      allSuppliers.forEach(supplier => {
        const supplierName = supplier.name || `Supplier ${supplier.id}`;
        const supplierEmail = supplier.email?.toLowerCase().trim() || '';
        
        // Only store the first value we find for each email to prevent mixing
        if (supplierEmail && !emailToParameterValue.has(supplierEmail)) {
          // STRICTLY use the email-based key for parameter lookup - NEVER fall back to name
          const emailKey = `email_${supplierEmail}`;
          
          // STRICT PARAMETER MATCHING: ONLY use exact parameter name - no case-insensitive lookup
          // STRICT EMAIL ISOLATION: Only use values from this exact supplier's email
          let value = parameterValues[param]?.[emailKey] || "-";
          
          // Log detailed information about this parameter lookup for debugging
          console.log(`[STRICT EMAIL LOOKUP] Parameter "${param}" for supplier with email "${supplierEmail}" (${supplierName}): ${value}`);
          
          // Set the value in our email-to-parameter map
          if (value === "-") {
            // No value found by email - this is the expected behavior
            // DO NOT try name-based lookup as this causes parameter mixing
            emailToParameterValue.set(supplierEmail, "-");
            console.log(`[STRICT ISOLATION] No value found for ${supplierEmail} - Parameter: ${param}`);
          } else {
            // Found a value by email - use it
            emailToParameterValue.set(supplierEmail, value);
            console.log(`[STRICT ISOLATION] Using value for ${supplierEmail}: ${value}`);
          }
        }
      });
      
      // Second pass: assign values to the rows based on email-isolated parameter values
      // Make sure to include ALL suppliers in the response, not just the "best" one for each email
      allSuppliers.forEach(supplier => {
        const supplierName = supplier.name || `Supplier ${supplier.id}`;
        const supplierId = supplier.id?.toString();
        const supplierEmail = supplier.email?.toLowerCase().trim() || '';
        
        // Get the parameter value for this supplier, using ONLY email-based lookup for isolation
        let paramValue = "-";
        
        if (supplierEmail && emailToParameterValue.has(supplierEmail)) {
          // Use the value we found for this email - strict isolation by email
          paramValue = emailToParameterValue.get(supplierEmail) || "-";
          console.log(`[TABLE ROW] Using email-based value for ${supplierEmail}: ${paramValue}`);
        } else if (supplierEmail) {
          // We have an email but no parameter value - this shouldn't happen after first pass
          console.log(`[WARNING] Missing parameter value for supplier with email ${supplierEmail} - this should not happen!`);
          paramValue = "-";
        } else {
          // No email at all - very rare case, log warning
          console.log(`[SEVERE WARNING] Supplier ${supplierName} has no email address! Using name-based lookup as last resort.`);
          paramValue = parameterValues[param][supplierName] || "-";
        }
        
        // Make data available under multiple keys for compatibility
        // 1. By supplier name (as before)
        row[supplierName] = paramValue;
        
        // 2. By supplier ID (for direct ID access)
        if (supplierId) {
          row[supplierId] = paramValue;
          
          // Add format with supplier_ prefix for reliable identification
          row[`supplier_${supplierId}`] = paramValue;
        }
        
        // 3. By "Supplier X" format for standardized naming
        row[`Supplier ${supplierId}`] = paramValue;
        
        // 4. By email for direct email-based access (most reliable for grouping)
        if (supplierEmail) {
          // Add email-keyed lookup, which is the most reliable for grouping across different responses
          row[`email_${supplierEmail}`] = paramValue;
          
          // Log this mapping for debugging purposes
          if (parameters.indexOf(param) === 0) {
            console.log(`Email-based mapping: email_${supplierEmail} -> ${paramValue}`);
          }
        } else {
          // If no email available, log this for debugging
          if (parameters.indexOf(param) === 0) {
            console.log(`No email found for supplier ${supplierName} (ID: ${supplierId})`);
          }
        }
      });
      
      // Debug for first row
      if (parameters.indexOf(param) === 0) {
        console.log('📊 First row of table data:', row);
        console.log('🔑 All keys in first row:', Object.keys(row));
      }
      
      return row;
    });

    // Prepare tableData with email-based keys for better frontend compatibility
    const enhancedTableData = tableData.map(row => {
      const newRow = { ...row };
      
      // For each supplier, add special email-based keys for frontend use
      supplierDetails.forEach(supplier => {
        const email = supplier.email?.toLowerCase().trim() || '';
        if (email) {
          const emailKey = `email_${email}`;
          // Make sure each supplier has its data accessible by email
          if (row[emailKey] !== undefined) {
            newRow[supplier.name] = row[emailKey];
          }
        }
      });
      
      return newRow;
    });
    
    // Generate CSV for download with clear column headers
    const csvColumns = ['Parameter', ...supplierDetails.map(s => s.name)];
    const csv = generateCSV(enhancedTableData, csvColumns);
    
    // Generate HTML table for the UI
    const htmlTable = generateHTMLTable(enhancedTableData, csvColumns);

    // Generate improvement summaries for each supplier
    const improvementSummariesHTML = Object.entries(supplierAnalysisSummaries)
      .map(([supplierName, summary]) => {
        if (!summary) return '';
        
        // Get improvements for this supplier, if any
        const improvements = supplierImprovements[supplierName] || [];
        const improvementRows = improvements.map(improvement => 
          `<tr>
            <td>${improvement.parameter}</td>
            <td>${improvement.initial_value}</td>
            <td>${improvement.final_value}</td>
            <td>${improvement.improvement_description}</td>
          </tr>`
        ).join('');

        // Create HTML summary section
        return `
          <div class="supplier-improvements mb-6">
            <h3 class="text-lg font-medium">${supplierName} - результаты уточнения предложения</h3>
            <p class="mb-3">${summary}</p>
            ${improvements.length > 0 
              ? `<div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Параметр</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Начальное значение</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Итоговое значение</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Описание улучшения</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      ${improvementRows}
                    </tbody>
                  </table>
                </div>`
              : '<p class="text-sm text-gray-500">Изменений в предложении не обнаружено.</p>'
            }
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    // Generate AI analysis of the comparison
    // Initialize with default analysis - this ensures we always have content
    let aiAnalysis = `# Анализ предложений поставщиков

## Общий обзор
${parameters.length} параметров анализировано для ${supplierDetails.length} поставщиков.

## Сравнение цен
${tableData.find(row => row.parameter?.toLowerCase()?.includes('стоимость') || row.Parameter?.toLowerCase()?.includes('стоимость')) 
  ? 'Сравнение показывает разницу в ценах между поставщиками.' 
  : 'Ценовые параметры не указаны в данных.'}

## Рекомендации
На основе доступных данных, рекомендуем рассмотреть предложения всех поставщиков, учитывая полное соотношение цены и условий.`;

    try {
      // Modified to work with at least one supplier
      if (tableData.length > 0) {
        console.log('Calling DeepSeek API to generate analysis');
        const aiResult = await generateComparisonAnalysis(supplierDetails, tableData, parameters, requestId);
        
        // Only override the default if we got a real result from the API
        if (aiResult && aiResult.length > 100) {
          aiAnalysis = aiResult;
          console.log('Successfully generated AI analysis with DeepSeek API');
        } else {
          console.log('DeepSeek API returned a short or empty result, using default analysis');
        }
      }
        
      // Append improvement summaries to the AI analysis
      if (improvementSummariesHTML) {
        aiAnalysis += `\n\n### Анализ улучшений в предложениях поставщиков\n\n${improvementSummariesHTML}`;
      }
    } catch (analysisError) {
      console.error('Error generating AI analysis:', analysisError);
      
      // If AI analysis fails, at least add the improvement summaries
      if (improvementSummariesHTML) {
        aiAnalysis += `\n\n### Анализ улучшений в предложениях поставщиков\n\n${improvementSummariesHTML}`;
      }
      
      console.log('Using default AI analysis due to API error');
    }

    // Добавляем дополнительное логирование для отладки группировки по email
    console.log("Final supplier details with email grouping:");
    supplierDetails.forEach(supplier => {
      console.log(`ID: ${supplier.id}, Name: ${supplier.name}, Email: ${supplier.email}`);
    });
    
    // Check for duplicate emails in final supplier list
    console.log("===== FINAL EMAIL UNIQUENESS CHECK =====");
    const emailsMap = new Map<string, number>();
    const duplicateEmails: string[] = [];
    
    supplierDetails.forEach(supplier => {
      if (supplier.email) {
        const email = supplier.email.toLowerCase().trim();
        if (emailsMap.has(email)) {
          duplicateEmails.push(email);
          console.error(`⚠️ CRITICAL ERROR: Duplicate email ${email} found for supplier ${supplier.name}`);
        } else {
          emailsMap.set(email, 1);
          console.log(`✅ Unique email confirmed: ${email} for supplier ${supplier.name}`);
        }
      } else {
        console.warn(`⚠️ Warning: Supplier ${supplier.name} has no email address`);
      }
    });
    
    if (duplicateEmails.length > 0) {
      console.warn(`⚠️ CRITICAL WARNING: Found ${duplicateEmails.length} duplicate emails after grouping: ${duplicateEmails.join(', ')}`);
      console.warn(`This will cause table rendering issues in the frontend!`);
    } else {
      console.log("✅ EMAIL UNIQUENESS CHECK PASSED: No duplicate emails found in final supplier details");
    }
    
    // Log all suppliers just before returning
    console.log(`===== FINAL SUPPLIER DETAILS SUMMARY =====`);
    console.log(`Total suppliers being sent to frontend: ${supplierDetails.length}`);
    supplierDetails.forEach((s, i) => {
      console.log(`  Supplier ${i+1}: ID=${s.id}, Name=${s.name}, Email=${s.email}`);
    });
    
    // Handle the case where we have multiple suppliers with the same email address
    if (uniqueSuppliers.length > supplierDetails.length) {
      console.log(`⚠️ Note: uniqueSuppliers (${uniqueSuppliers.length}) > supplierDetails (${supplierDetails.length})`);
      console.log(`This is expected due to email grouping (multiple suppliers with same email merged)`);
    }
    
    // Create final response
    const response = {
      filename: `supplier-comparison-${new Date().toISOString().slice(0, 10)}.csv`,
      htmlTable,
      suppliers: supplierNames,
      parameters,
      csv,
      aiAnalysis,
      supplierDetails, // Add supplier contact details to the response
      tableData, // Add tableData to the response for direct use in the frontend
      productName: requestDetails?.productName // Add product name if available
    };
    
    // Log the important parts of the response before sending
    console.log(`[API RESPONSE] supplierDetails: ${JSON.stringify(supplierDetails)}`);
    console.log(`[API RESPONSE] Number of suppliers: ${supplierDetails.length}`);
    
    // Return the response
    return response;
  } catch (error: any) {
    console.error('Error in generateRealComparisonData:', error);
    throw new Error(error?.message || 'Error generating comparison data');
  }
}

// Express route handler for comparison data
// Request body type for the comparison API
interface ComparisonRequest {
  suppliers: ComparisonSupplier[];
  parameters: string[];
  requestId?: number;
}

export async function generateComparisonHandler(req: Request, res: Response) {
  try {
    console.log('Received comparison request:', JSON.stringify({
      supplierCount: req.body.suppliers?.length || 0,
      parameters: req.body.parameters,
      requestId: req.body.requestId
    }));
    
    // Получаем userId из req.user для изоляции данных
    const userId = req.user?.id;
    
    // Log authentication information for debugging
    console.log('[Auth] generateComparisonHandler authentication check:', {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      hasUser: !!req.user,
      userId: userId
    });
    
    // If we have suppliers, log the first two to check structure
    if (req.body.suppliers && req.body.suppliers.length > 0) {
      console.log('Sample supplier data:', JSON.stringify(req.body.suppliers.slice(0, 2)));
    }
    
    // Проверяем, что у нас есть userId для изоляции данных
    if (!userId) {
      console.error('No userId found for comparison request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Extract suppliers, parameters, and requestId from request body
    const { suppliers, parameters: requestedParameters, requestId } = req.body as ComparisonRequest;
    
    // Validate input
    if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({ error: 'No suppliers provided' });
    }
    
    if (!requestedParameters || !Array.isArray(requestedParameters) || requestedParameters.length === 0) {
      return res.status(400).json({ error: 'No parameters provided' });
    }
    
    // We will fetch the exact parameters from the database for the given request ID
    // This ensures we use only the exact parameters without any case variations
    let parameters: string[] = [];
    
    // Define parameter normalization function (only used as fallback if no exact parameters found)
    const normalizeParameterForComparison = (param: string): string => {
      return param
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')        // Normalize spaces
        .replace(/ндс/i, 'ндс')      // Normalize НДС/Ндс to lowercase
        .replace(/с\s+ндс/i, 'с ндс') // Normalize "с НДС" format
        .replace(/без\s+ндс/i, 'без ндс'); // Normalize "без НДС" format
    };
    
    // If we have a request ID, fetch the extracted parameters from the database
    if (requestId) {
      try {
        console.log(`Fetching EXACT parameters for request ID ${requestId}`);
        
        // First, check if we have specific requested parameters from the request body
        // If we do, we'll ONLY use these exact parameters
        if (requestedParameters && requestedParameters.length > 0) {
          // Use only the parameters that were explicitly requested in this API call
          console.log(`Using ONLY the ${requestedParameters.length} parameters explicitly requested in the API call`);
          
          // Use ONLY the explicitly requested parameters, exactly as requested
          parameters = [...requestedParameters];
          console.log(`STRICTLY using only requested parameters: ${parameters.join(', ')}`);
        } else {
          // If no specific parameters requested, get them from the database
          const extractedParams = await storage.getExtractedParametersByRequestId(requestId);
          console.log(`Found ${extractedParams.length} extracted parameter records for request ID ${requestId}`);
          
          // Track all unique parameters we find with their exact case and format
          const exactParameters = new Set<string>();
          
          // Process all extracted parameters
          for (const param of extractedParams) {
            if (param && param.parameters) {
              // If parameters is an object, add each key (parameter name) to our set
              if (typeof param.parameters === 'object' && !Array.isArray(param.parameters)) {
                Object.keys(param.parameters).forEach((paramName: string) => {
                  exactParameters.add(paramName); // Keep exact case and format
                });
              }
              // If parameters is an array of objects with 'name' property
              else if (Array.isArray(param.parameters)) {
                param.parameters.forEach((p: any) => {
                  if (p && typeof p === 'object' && 'name' in p) {
                    exactParameters.add(p.name); // Keep exact case and format
                  }
                });
              }
            }
          }
          
          // Convert the set to an array, maintaining exact case and format
          parameters = Array.from(exactParameters);
          console.log(`Using ${parameters.length} EXACT parameters from database: ${parameters.join(', ')}`);
        }
      
      } catch (error) {
        console.error(`Error fetching parameters for request ID ${requestId}:`, error);
        console.log('Falling back to requested parameters');
        parameters = requestedParameters;
      }
    } else {
      // If no requestId, use the parameters from the request body
      parameters = requestedParameters;
      console.log('No request ID provided, using parameters from request body');
    }
    
    // Sort parameters to ensure consistent order
    const standardParameterOrder = [
      "Товар", "Поставщик", 
      "Общая стоимость без НДС", "Общая стоимость с НДС", 
      "Цена за единицу без НДС", "Цена за единицу с НДС", 
      "Сроки поставки", "Условия поставки", "Условия оплаты", 
      "Гарантия", "Срок действия предложения"
    ];
    
    // Sort parameters by the standard order if possible, otherwise alphabetically
    parameters.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      // Get indexes of parameters in standard order
      const aIndex = standardParameterOrder.findIndex(p => p.toLowerCase() === aLower);
      const bIndex = standardParameterOrder.findIndex(p => p.toLowerCase() === bLower);
      
      // If both parameters are in standard order, sort by that order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one parameter is in standard order, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // Otherwise sort alphabetically
      return aLower.localeCompare(bLower);
    });
    
    // Log the deduplicated parameters list
    console.log(`Using ${parameters.length} parameters for comparison in standard order: ${parameters.join(', ')}`);
    
    // Generate comparison data, передаем userId для изоляции данных
    const comparisonData = await generateRealComparisonData(suppliers, parameters, requestId, userId);
    
    // Return comparison data
    return res.json(comparisonData);
  } catch (error: any) {
    console.error('Error in generateComparisonHandler:', error);
    return res.status(500).json({ error: error.message || 'Error generating comparison data' });
  }
}