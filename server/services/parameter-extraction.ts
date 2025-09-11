/**
 * Service for extracting parameters from supplier responses
 */

import type { SupplierResponse } from '../../shared/types';

/**
 * Extract a parameter from content and attachments
 */
export interface ExtractionResult {
  value: string;
  source: 'content' | 'attachment' | 'none';
  confidence: number;
}

/**
 * Extract a parameter from supplier response content and attachments
 * 
 * @param content The message content
 * @param attachments Array of attachments
 * @param parameter The parameter to extract
 * @returns ExtractionResult with value, source and confidence
 */
export function extractParameterFromContent(
  content: string, 
  attachments: any[], 
  parameter: string
): ExtractionResult {
  try {
    // Set default result - not found
    let result: ExtractionResult = {
      value: "-",
      source: 'none',
      confidence: 0
    };
    
    // Try to extract from content first
    const contentResult = extractParameterFromText(content, parameter);
    if (contentResult.value !== "-") {
      result = {
        value: contentResult.value,
        source: 'content',
        confidence: contentResult.confidence
      };
    }
    
    // Then try from attachments if not found or low confidence
    if (result.value === "-" || result.confidence < 0.5) {
      // Process each attachment
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          // Skip if no extracted text
          if (!attachment.extractedText) {
            continue;
          }
          
          const attachmentResult = extractParameterFromText(attachment.extractedText, parameter);
          
          // If we get a valid result with higher confidence, use it
          if (attachmentResult.value !== "-" && 
              (result.value === "-" || attachmentResult.confidence > result.confidence)) {
            result = {
              value: attachmentResult.value,
              source: 'attachment',
              confidence: attachmentResult.confidence
            };
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error extracting parameter ${parameter}:`, error);
    return {
      value: "-",
      source: 'none',
      confidence: 0
    };
  }
}

/**
 * Extract a parameter from text using regular expressions and heuristics
 * 
 * @param text The text to extract from
 * @param parameter The parameter to extract
 * @returns Object with value and confidence
 */
function extractParameterFromText(text: string, parameter: string): { value: string; confidence: number } {
  // Default result - not found
  const defaultResult = { value: "-", confidence: 0 };
  
  // If no text, return default result
  if (!text || typeof text !== 'string') {
    return defaultResult;
  }
  
  try {
    // Convert parameter to lowercase for case-insensitive matching
    const paramLower = parameter.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Define pattern matching based on parameter type
    if (paramLower.includes('цена') || paramLower.includes('стоимость')) {
      // Price patterns
      const priceRegex = new RegExp(
        `(${paramLower}|стоимость|цена|price|cost|итого|сумма)[\\s\\:\\-]+(\\d+[\\s\\d]*(?:[\\.,]\\d+)?)[\\s]*(руб|р|\\$|€|евро|долларов|рублей)?`,
        'i'
      );
      
      const tableRegex = new RegExp(
        `<tr[^>]*>[^<]*<td[^>]*>[^<]*(${paramLower}|стоимость|цена|price|cost|итого|сумма)[^<]*<\\/td>[^<]*<td[^>]*>([^<]+)<\\/td>`,
        'i'
      );
      
      const match = priceRegex.exec(textLower) || tableRegex.exec(textLower);
      if (match && match[2]) {
        // Clean up the value
        let value = match[2].trim().replace(/\s+/g, ' ');
        
        // Add currency if present
        if (match[3]) {
          value += ` ${match[3].trim()}`;
        }
        
        return { 
          value, 
          confidence: 0.8 
        };
      }
    } else if (paramLower.includes('срок') || paramLower.includes('поставк') || paramLower.includes('доставк')) {
      // Delivery patterns
      const deliveryRegex = new RegExp(
        `(${paramLower}|срок|поставка|доставка|delivery|term)[\\s\\:\\-]+(\\d+[\\-\\s]?\\d*)[\\s]*(дн|нед|мес|раб|кал|день|дней|недель|месяцев|рабочих|календарных)?`,
        'i'
      );
      
      const match = deliveryRegex.exec(textLower);
      if (match && match[2]) {
        // Clean up the value
        let value = match[2].trim();
        
        // Add unit if present
        if (match[3]) {
          value += ` ${match[3].trim()}`;
        } else {
          value += ' дней'; // Default unit
        }
        
        return { 
          value, 
          confidence: 0.7 
        };
      }
    } else if (paramLower.includes('оплат') || paramLower.includes('payment')) {
      // Payment terms patterns
      const paymentRegex = new RegExp(
        `(${paramLower}|оплата|payment|условия оплаты)[\\s\\:\\-]+([^\\n\\.]{5,50})`,
        'i'
      );
      
      const match = paymentRegex.exec(text);
      if (match && match[2]) {
        return { 
          value: match[2].trim(), 
          confidence: 0.6 
        };
      }
    } else if (paramLower.includes('наименование') || paramLower.includes('поставщик') || paramLower.includes('supplier_name')) {
      // Supplier name patterns
      const supplierNameRegex = new RegExp(
        `(наименование|название|компания|организация|поставщик|supplier|company|organization)[\\s\\:\\-]+([^\\n\\.]{3,100})`,
        'i'
      );
      
      const match = supplierNameRegex.exec(text);
      if (match && match[2]) {
        return { 
          value: match[2].trim(), 
          confidence: 0.7 
        };
      }
    } else if (paramLower.includes('резидент') || paramLower.includes('страна') || paramLower.includes('residency')) {
      // Supplier residency patterns
      const residencyRegex = new RegExp(
        `(резидент|страна|государство|country|residency|nationality)[\\s\\:\\-]+([^\\n\\.]{2,50})`,
        'i'
      );
      
      const match = residencyRegex.exec(text);
      if (match && match[2]) {
        return { 
          value: match[2].trim(), 
          confidence: 0.7 
        };
      }
    } else if (paramLower.includes('инн') || paramLower.includes('унп') || paramLower.includes('inn_unp')) {
      // Tax ID patterns (ИНН/УНП)
      const taxIdRegex = new RegExp(
        `(инн|унп|налоговый номер|tax id|tin|vat)[\\s\\:\\-]+(\\d{9,15})`,
        'i'
      );
      
      const match = taxIdRegex.exec(text);
      if (match && match[2]) {
        return { 
          value: match[2].trim(), 
          confidence: 0.8 
        };
      }
    } else if (paramLower.includes('гарант')) {
      // Warranty patterns
      const warrantyRegex = new RegExp(
        `(${paramLower}|гарантия|warranty|гарантийный срок)[\\s\\:\\-]+(\\d+[\\-\\s]?\\d*)[\\s]*(год|лет|мес|месяцев|месяца|года)?`,
        'i'
      );
      
      const match = warrantyRegex.exec(textLower);
      if (match && match[2]) {
        // Clean up the value
        let value = match[2].trim();
        
        // Add unit if present
        if (match[3]) {
          value += ` ${match[3].trim()}`;
        } else {
          value += ' мес'; // Default unit
        }
        
        return { 
          value, 
          confidence: 0.7 
        };
      }
    } else {
      // Generic parameter patterns
      const genericRegex = new RegExp(
        `(${paramLower})[\\s\\:\\-]+([^\\n\\.]{2,50})`,
        'i'
      );
      
      const match = genericRegex.exec(text);
      if (match && match[2]) {
        return { 
          value: match[2].trim(), 
          confidence: 0.5 
        };
      }
    }
    
    // No match found
    return defaultResult;
  } catch (error) {
    console.error(`Error in extractParameterFromText for ${parameter}:`, error);
    return defaultResult;
  }
}

/**
 * Analyze parameter values extracted from multiple suppliers
 * 
 * @param parameterName The name of the parameter
 * @param values Record mapping supplier names to their values
 * @returns Analysis information about the parameter
 */
export function analyzeParameterValues(
  parameterName: string,
  values: Record<string, string>
): { 
  bestSupplier: string | null; 
  worstSupplier: string | null;
  comment: string;
} {
  // Default result
  const result = {
    bestSupplier: null as string | null,
    worstSupplier: null as string | null,
    comment: 'Недостаточно данных для анализа'
  };
  
  // Get suppliers with actual values (not "-")
  const suppliersWithValues = Object.entries(values)
    .filter(([_, value]) => value !== "-")
    .map(([supplier, value]) => ({ supplier, value }));
  
  // If not enough data, return default result
  if (suppliersWithValues.length < 2) {
    return result;
  }
  
  try {
    // Analyze based on parameter type
    const paramLower = parameterName.toLowerCase();
    
    if (paramLower.includes('цена') || paramLower.includes('стоимость')) {
      // Price analysis - lower is better
      const priceData = suppliersWithValues.map(entry => {
        // Extract numeric value from price string
        const numericMatch = entry.value.match(/(\d[\d\s]*[\.,]?\d*)/);
        return {
          supplier: entry.supplier,
          rawValue: entry.value,
          numericValue: numericMatch ? parseFloat(numericMatch[1].replace(/\s/g, '').replace(',', '.')) : Infinity
        };
      }).filter(entry => !isNaN(entry.numericValue));
      
      if (priceData.length >= 2) {
        // Sort by price (ascending)
        priceData.sort((a, b) => a.numericValue - b.numericValue);
        
        result.bestSupplier = priceData[0].supplier;
        result.worstSupplier = priceData[priceData.length - 1].supplier;
        
        const priceDiff = priceData[priceData.length - 1].numericValue - priceData[0].numericValue;
        const priceDiffPercent = (priceDiff / priceData[0].numericValue) * 100;
        
        result.comment = `Разница в цене составляет ${priceDiff.toFixed(2)} (${priceDiffPercent.toFixed(2)}%)`;
      }
    } else if (paramLower.includes('срок') || paramLower.includes('поставк')) {
      // Delivery time analysis - shorter is better
      const deliveryData = suppliersWithValues.map(entry => {
        // Extract numeric value from delivery string
        const numericMatch = entry.value.match(/(\d+)/);
        return {
          supplier: entry.supplier,
          rawValue: entry.value,
          numericValue: numericMatch ? parseInt(numericMatch[1]) : Infinity
        };
      }).filter(entry => !isNaN(entry.numericValue));
      
      if (deliveryData.length >= 2) {
        // Sort by delivery time (ascending)
        deliveryData.sort((a, b) => a.numericValue - b.numericValue);
        
        result.bestSupplier = deliveryData[0].supplier;
        result.worstSupplier = deliveryData[deliveryData.length - 1].supplier;
        
        const timeDiff = deliveryData[deliveryData.length - 1].numericValue - deliveryData[0].numericValue;
        
        result.comment = `Разница в сроках составляет ${timeDiff} дней`;
      }
    } else if (paramLower.includes('гарант')) {
      // Warranty analysis - longer is better
      const warrantyData = suppliersWithValues.map(entry => {
        // Extract numeric value from warranty string
        const numericMatch = entry.value.match(/(\d+)/);
        return {
          supplier: entry.supplier,
          rawValue: entry.value,
          numericValue: numericMatch ? parseInt(numericMatch[1]) : 0
        };
      }).filter(entry => !isNaN(entry.numericValue));
      
      if (warrantyData.length >= 2) {
        // Sort by warranty period (descending)
        warrantyData.sort((a, b) => b.numericValue - a.numericValue);
        
        result.bestSupplier = warrantyData[0].supplier;
        result.worstSupplier = warrantyData[warrantyData.length - 1].supplier;
        
        const warrantyDiff = warrantyData[0].numericValue - warrantyData[warrantyData.length - 1].numericValue;
        
        result.comment = `Разница в гарантийном сроке составляет ${warrantyDiff} ед.`;
      }
    } else if (paramLower.includes('оплат')) {
      // Payment terms analysis - more complex, use text comparison
      // For payment terms, we can't easily quantify, so just note the difference
      result.comment = 'Различные условия оплаты, требуется экспертная оценка';
      
      // Check for prepayment vs postpayment
      const prepaymentSuppliers = suppliersWithValues.filter(
        entry => entry.value.toLowerCase().includes('предоплат') || 
                entry.value.toLowerCase().includes('аванс')
      );
      
      const postpaymentSuppliers = suppliersWithValues.filter(
        entry => entry.value.toLowerCase().includes('отсрочк') || 
                entry.value.toLowerCase().includes('постоплат')
      );
      
      if (prepaymentSuppliers.length > 0 && postpaymentSuppliers.length > 0) {
        result.bestSupplier = postpaymentSuppliers[0].supplier;
        result.worstSupplier = prepaymentSuppliers[0].supplier;
        result.comment = 'Отсрочка платежа выгоднее предоплаты';
      }
    } else {
      // For other parameters, we just note that there are differences
      result.comment = 'Имеются различия в условиях, требуется экспертная оценка';
    }
    
    return result;
  } catch (error) {
    console.error(`Error analyzing parameter ${parameterName}:`, error);
    return result;
  }
}