import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import OpenAI from "openai";
import { requireAuth } from '../middleware/requireAuth';

// @ts-ignore - No types available for API bridge
import * as apiBridge from '../file-processing/api_bridge';
import { extractParametersWithAI } from '../services/deepseek-api';

// Create router
const router = Router();

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

// Schema for parameter extraction request
const ExtractParametersSchema = z.object({
  responseId: z.number(),
  parameters: z.array(z.string()),
  useAI: z.boolean().optional().default(true) // Control whether to use AI or regex-based extraction
});

type ExtractionResult = {
  value: string;
  source: 'content' | 'attachment' | 'unknown';
  confidence: number;
};

interface ExtractedParameter {
  name: string;
  value: string;
  source: string;
  confidence: number;
}

// Function to extract parameters from text, improved version
function extractParameterFromText(text: string, parameter: string): ExtractionResult {
  // Default result with no value found
  const result: ExtractionResult = {
    value: "-",
    source: 'content',
    confidence: 0
  };
  
  if (!text || !parameter) {
    return result;
  }

  try {
    // Debug logging
    console.log(`Extracting parameter: "${parameter}" from text length: ${text.length}`);
    
    // Use direct pattern matching for common parameters - this is most reliable
    // Patterns based on the successful extraction seen in previous runs
    
    // 1. Match for price without VAT (НДС) - с улучшенными шаблонами и валютой
    if (parameter === 'общая стоимость без ндс') {
      // Ищем в разных форматах с учетом возможной валюты
      const patterns = [
        /итого\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€)?\s*,?\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /(?:общая|полная|итоговая)?\s*стоимость\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /сумма\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /всего\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Ищем валюту после числа
          const currencyAfter = text.substring(match.index + match[0].length, match.index + match[0].length + 20).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Ищем валюту перед числом
          const currencyBefore = text.substring(Math.max(0, match.index - 20), match.index).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Очищаем значение от пробелов и возможных разделителей
          let value = match[1].trim().replace(/\s+/g, '').replace(/,/g, '.');
          
          // Добавляем валюту, если она найдена
          if (currencyAfter) {
            value += ' ' + currencyAfter[0];
          } else if (currencyBefore) {
            value += ' ' + currencyBefore[0];
          } else {
            // По умолчанию предполагаем рубли, если нет явного указания валюты
            value += ' руб.';
          }
          
          console.log(`Found direct match for price without VAT: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
    }
    
    // 2. Match for price with VAT (с НДС) - с улучшенными шаблонами и валютой
    if (parameter === 'общая стоимость с ндс') {
      // Ищем в разных форматах с учетом возможной валюты
      const patterns = [
        /итого\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€)?\s*,?\s*(?:с\s*ндс|в\s*т\.ч\.\s*ндс|включая\s*ндс)\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /(?:общая|полная|итоговая)?\s*стоимость\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /сумма\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /всего\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /к\s*оплате\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Ищем валюту после числа
          const currencyAfter = text.substring(match.index + match[0].length, match.index + match[0].length + 20).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Ищем валюту перед числом
          const currencyBefore = text.substring(Math.max(0, match.index - 20), match.index).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Очищаем значение от пробелов и возможных разделителей
          let value = match[1].trim().replace(/\s+/g, '').replace(/,/g, '.');
          
          // Добавляем валюту, если она найдена
          if (currencyAfter) {
            value += ' ' + currencyAfter[0];
          } else if (currencyBefore) {
            value += ' ' + currencyBefore[0];
          } else {
            // По умолчанию предполагаем рубли, если нет явного указания валюты
            value += ' руб.';
          }
          
          console.log(`Found direct match for price with VAT: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
    }
    
    // 3. Цена за единицу без НДС - новый улучшенный шаблон с обязательной валютой
    if (parameter === 'цена за единицу без ндс') {
      const patterns = [
        /цена\s*за\s*(?:шт|ед|единицу|м\.?пог|м2|метр|штуку)\s*,?\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /стоимость\s*за\s*(?:шт|ед|единицу|м\.?пог|м2|метр|штуку)\s*,?\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /цена\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?(?:\s*за\s*(?:шт|ед|единицу|м\.?пог|м2|метр|штуку))?/i,
        /ставка\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?(?:\s*за\s*(?:шт|ед|единицу|м\.?пог|м2|метр|штуку))?/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Ищем валюту после числа
          const currencyAfter = text.substring(match.index + match[0].length, match.index + match[0].length + 20).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Ищем валюту перед числом
          const currencyBefore = text.substring(Math.max(0, match.index - 20), match.index).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Ищем единицу измерения
          const unitMatch = text.substring(match.index, match.index + match[0].length + 30).match(/за\s*(шт|ед|единицу|м\.?пог|м2|метр|штуку)/i);
          let unit = unitMatch ? unitMatch[1] : 'шт';
          
          // Очищаем значение от пробелов и возможных разделителей
          let value = match[1].trim().replace(/\s+/g, '').replace(/,/g, '.');
          
          // Добавляем валюту и единицу измерения
          if (currencyAfter) {
            value += ' ' + currencyAfter[0] + ' за ' + unit;
          } else if (currencyBefore) {
            value += ' ' + currencyBefore[0] + ' за ' + unit;
          } else {
            // По умолчанию предполагаем рубли, если нет явного указания валюты
            value += ' руб. за ' + unit;
          }
          
          console.log(`Found direct match for price per unit: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
      
      // Если не нашли прямого указания на цену за единицу, пытаемся рассчитать её из общей стоимости и количества
      const quantityMatch = text.match(/количество\s*[\:\-]?\s*(\d+)/i) || text.match(/кол-?во\s*[\:\-]?\s*(\d+)/i);
      const priceWithoutVatMatch = text.match(/итого\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)/i);
      
      if (quantityMatch && quantityMatch[1] && priceWithoutVatMatch && priceWithoutVatMatch[1]) {
        const quantity = parseInt(quantityMatch[1]);
        const totalPrice = parseFloat(priceWithoutVatMatch[1].replace(/\s+/g, '').replace(',', '.'));
        
        if (quantity > 0 && !isNaN(totalPrice)) {
          const unitPrice = (totalPrice / quantity).toFixed(2);
          console.log(`Calculated price per unit: ${unitPrice} руб. за шт.`);
          return {
            value: `${unitPrice} руб. за шт.`,
            source: 'content',
            confidence: 0.7  // Меньшая уверенность, т.к. это расчётное значение
          };
        }
      }
    }
    
    // 4. Сроки поставки - улучшенные шаблоны
    if (parameter === 'сроки поставки') {
      const patterns = [
        /срок(?:и)?\s*поставки\s*[\:\-]?\s*([^\.;\n]+?(?:\d+)(?:[^\.;\n]*?(?:рабоч|календарн)?[^\.;\n]*?(?:дн|недел|месяц))[^\.;\n]*)/i,
        /поставка\s*(?:в\s*течение|осуществляется\s*в\s*течение)\s*([^\.;\n]+?(?:\d+)(?:[^\.;\n]*?(?:рабоч|календарн)?[^\.;\n]*?(?:дн|недел|месяц))[^\.;\n]*)/i,
        /доставка\s*(?:в\s*течение)\s*([^\.;\n]+?(?:\d+)(?:[^\.;\n]*?(?:рабоч|календарн)?[^\.;\n]*?(?:дн|недел|месяц))[^\.;\n]*)/i,
        /(?:товар\s*будет\s*доставлен|товар\s*будет\s*поставлен)\s*(?:в\s*течение)?\s*([^\.;\n]+?(?:\d+)(?:[^\.;\n]*?(?:рабоч|календарн)?[^\.;\n]*?(?:дн|недел|месяц))[^\.;\n]*)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          console.log(`Found direct match for delivery terms: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
    }
    
    // 5. Условия поставки - улучшенный шаблон с адресом
    if (parameter === 'условия поставки') {
      const patterns = [
        /услови(?:я|е)\s*поставки\s*[\:\-]?\s*([^\.;\n]*?(?:доставк|самовывоз|франко|транспорт)[^\.;\n]*?(?:адрес|город|ул|улиц)[^\.;\n]*)/i,
        /доставка\s*(?:до|в|на)\s*([^\.;\n]*?(?:адрес|город|ул|улиц)[^\.;\n]*)/i,
        /самовывоз\s*(?:со|из|с)\s*([^\.;\n]*?(?:склад|офис|магазин)[^\.;\n]*?(?:адрес|город|ул|улиц)[^\.;\n]*)/i,
        /франко\s*[\:\-]?\s*([^\.;\n]*)/i,
        /место\s*доставки\s*[\:\-]?\s*([^\.;\n]*?(?:адрес|город|ул|улиц)[^\.;\n]*)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          console.log(`Found direct match for delivery conditions: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
    }
    
    // 6. Условия оплаты - улучшенные шаблоны
    if (parameter === 'условия оплаты') {
      const patterns = [
        /услови(?:я|е)\s*оплаты\s*[\:\-]?\s*([^\.;\n]*?(?:предоплат|аванс|отсрочк|рассрочк|оплат)[^\.;\n]*)/i,
        /(?:предоплата|аванс)\s*[\:\-]?\s*([^\.;\n]*?(?:\d+)[^\.;\n]*?(?:%|процент)[^\.;\n]*)/i,
        /(?:\d+)[^\.;\n]*?(?:%|процент)[^\.;\n]*?(?:предоплат|аванс)[^\.;\n]*/i,
        /оплата\s*(?:производится|осуществляется)\s*([^\.;\n]*)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          console.log(`Found direct match for payment terms: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
    }
    
    // 7. Гарантия - новые шаблоны
    if (parameter === 'гарантия') {
      const patterns = [
        /гаранти(?:я|йный\s*срок)\s*[\:\-]?\s*([^\.;\n]*?(?:\d+)[^\.;\n]*?(?:месяц|год|лет|дн)[^\.;\n]*)/i,
        /срок\s*гарантии\s*[\:\-]?\s*([^\.;\n]*?(?:\d+)[^\.;\n]*?(?:месяц|год|лет|дн)[^\.;\n]*)/i,
        /гарантийные\s*обязательства\s*[\:\-]?\s*([^\.;\n]*?(?:\d+)[^\.;\n]*?(?:месяц|год|лет|дн)[^\.;\n]*)/i,
        /гарантия\s*(?:составляет|действует)\s*([^\.;\n]*?(?:\d+)[^\.;\n]*?(?:месяц|год|лет|дн)[^\.;\n]*)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          console.log(`Found direct match for warranty: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
    }
    
    // 8. Срок действия предложения - новые шаблоны
    if (parameter === 'срок действия предложения') {
      const patterns = [
        /(?:срок|период)\s*действия\s*(?:предложения|оферты|КП|коммерческого\s*предложения)\s*[\:\-]?\s*([^\.;\n]*?(?:\d+)[^\.;\n]*?(?:дн|до|месяц)[^\.;\n]*)/i,
        /предложение\s*действительно\s*(?:в\s*течение)?\s*([^\.;\n]*?(?:\d+)[^\.;\n]*?(?:дн|до|месяц)[^\.;\n]*)/i,
        /КП\s*действительно\s*(?:до|в\s*течение)\s*([^\.;\n]*)/i,
        /действует\s*до\s*([^\.;\n]*?(?:\d+)[^\.;\n]*?(?:года|г|\.20|\.202)[^\.;\n]*)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          console.log(`Found direct match for offer validity: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
    }
    
    // 9. Товар - шаблоны для извлечения информации о товаре
    if (parameter === 'товар') {
      const patterns = [
        /(?:наименование\s*товара|наименование\s*продукции|товар|продукция)\s*[\:\-]?\s*([^\.;\n]{10,})/i,
        /поставляем\s*вам\s*([^\.;\n]{10,})/i,
        /предлагаем\s*вам\s*([^\.;\n]{10,})/i,
        /направляем\s*(?:вам)?\s*(?:коммерческое)?\s*предложение\s*на\s*([^\.;\n]{10,})/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          // Проверяем, что найденный текст действительно описывает товар, а не что-то другое
          if (/(?:изделие|товар|материал|оборудование|деталь)/i.test(value) || 
              value.length > 30) { // Предполагаем, что длинные описания вероятнее всего описывают товар
            console.log(`Found direct match for product: ${value}`);
            return {
              value: value,
              source: 'content',
              confidence: 0.8
            };
          }
        }
      }
    }
    
    // 10. Поставщик - шаблоны для извлечения информации о поставщике
    if (parameter === 'поставщик') {
      const patterns = [
        /(?:поставщик|изготовитель|производитель)\s*[\:\-]?\s*([^\.;\n]*?(?:ООО|ИП|АО|ЗАО|УП|ЧТУП|ОАО)[^\.;\n]*)/i,
        /(?:компания|фирма)\s*(?:поставщик|изготовитель|производитель)\s*[\:\-]?\s*([^\.;\n]*?(?:ООО|ИП|АО|ЗАО|УП|ЧТУП|ОАО)[^\.;\n]*)/i,
        /(?:от|с\s*уважением|директор)\s*[^\n]*?(?:ООО|ИП|АО|ЗАО|УП|ЧТУП|ОАО)[^\n]*/i,
        /(?:контактные\s*данные|реквизиты)\s*\:(?:[^\n]*?(?:ООО|ИП|АО|ЗАО|УП|ЧТУП|ОАО)[^\n]*)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          console.log(`Found direct match for supplier: ${value}`);
          return {
            value: value,
            source: 'content',
            confidence: 0.9
          };
        }
      }
      
      // Ищем упоминание компании в подписи email
      const emailSignatureMatch = text.match(/(?:с\s*уважением|искренне|директор|менеджер)[^\n]*?([^\n]*?(?:ООО|ИП|АО|ЗАО|УП|ЧТУП|ОАО)[^\n]*)/i);
      if (emailSignatureMatch && emailSignatureMatch[1]) {
        const value = emailSignatureMatch[1].trim();
        console.log(`Found supplier from email signature: ${value}`);
        return {
          value: value,
          source: 'content',
          confidence: 0.7
        };
      }
    }
    
    // Special case for emails without attachments that contain price data
    // Many emails include basic price information in the quoted reply without formal formatting
    if (parameter.toLowerCase().includes('цена') || parameter.toLowerCase().includes('стоимость')) {
      // First, try to find explicit price patterns like "цена 454544" in the text
      const explicitPricePatterns = [
        /цена\s+(\d[\d\s.,]+)(?:\s*(?:руб|₽|BYN|USD|\$|EUR|€))?/i,
        /стоимость\s+(\d[\d\s.,]+)(?:\s*(?:руб|₽|BYN|USD|\$|EUR|€))?/i,
        /сумма\s+(\d[\d\s.,]+)(?:\s*(?:руб|₽|BYN|USD|\$|EUR|€))?/i,
        /итого\s+(\d[\d\s.,]+)(?:\s*(?:руб|₽|BYN|USD|\$|EUR|€))?/i,
        /цена:?\s+(\d[\d\s.,]+)(?:\s*(?:руб|₽|BYN|USD|\$|EUR|€))?/i,
        /стоимость:?\s+(\d[\d\s.,]+)(?:\s*(?:руб|₽|BYN|USD|\$|EUR|€))?/i,
      ];
      
      for (const pattern of explicitPricePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          let cleanedPrice = match[1].trim();
          
          // Add currency if not present
          if (!cleanedPrice.match(/руб|₽|BYN|USD|\$|EUR|€/)) {
            // Check if currency follows separately
            const afterMatch = text.substring(match.index + match[0].length, match.index + match[0].length + 20);
            const currencyMatch = afterMatch.match(/(?:руб|₽|BYN|USD|\$|EUR|€)/i);
            
            if (currencyMatch) {
              cleanedPrice += ` ${currencyMatch[0]}`;
            } else {
              cleanedPrice += ' руб.';
            }
          }
          
          console.log(`Found explicit price pattern for ${parameter}: ${cleanedPrice}`);
          return {
            value: cleanedPrice,
            source: 'content',
            confidence: 0.8 // High confidence since this explicitly matches price patterns
          };
        }
      }
      
      // If explicit pattern wasn't found, fall back to looking for any numbers that could be prices
      const simplePricePattern = /(?:\d[\d\s.,]+)(?:\s*(?:руб|₽|BYN|USD|\$|EUR|€))?/g;
      const matches = text.match(simplePricePattern);
      
      if (matches && matches.length > 0) {
        // Get the first match that looks substantial
        const significantMatches = matches.filter(m => {
          const numberPart = m.replace(/[^\d.,]/g, '');
          // Must have at least 2 digits and not be a year (2022, 2023, etc)
          return numberPart.length >= 2 && !(/^20\d\d$/.test(numberPart));
        });
        
        if (significantMatches.length > 0) {
          // Take the first significant price-like value
          const potentialPrice = significantMatches[0].trim();
          let cleanedPrice = potentialPrice;
          
          // Add currency if not present
          if (!cleanedPrice.match(/руб|₽|BYN|USD|\$|EUR|€/)) {
            cleanedPrice += ' руб.';
          }
          
          console.log(`Found simple price pattern for ${parameter}: ${cleanedPrice}`);
          return {
            value: cleanedPrice,
            source: 'content',
            confidence: 0.6 // Medium confidence since this is a simplified extraction
          };
        }
      }
    }
    
    // Default: return the initial result with no value
    return result;
  } catch (error) {
    console.error('Error extracting parameter:', error);
    return result;
  }
}

// Function to extract parameters from response
async function extractParametersFromResponse(
  responseId: number, 
  parameters: string[], 
  useAI: boolean = true
): Promise<ExtractedParameter[]> {
  try {
    // Get the response from storage
    const response = await storage.getSupplierResponseById(responseId);
    
    if (!response) {
      throw new Error(`Response with ID ${responseId} not found`);
    }
    
    // Check if response has attachments
    const hasAttachments = response.attachments && Array.isArray(response.attachments) && response.attachments.length > 0;
    
    // Check for large attachments (>5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    let hasLargeFiles = false;
    let largeFilesInfo: string[] = [];
    
    if (hasAttachments) {
      console.log(`Checking ${response.attachments.length} attachments for size limits...`);
      for (const attachment of response.attachments as any[]) {
        const sizeInMB = (attachment.size / (1024 * 1024)).toFixed(2);
        console.log(`Attachment: ${attachment.filename}, size: ${attachment.size} bytes (${sizeInMB} MB)`);
        
        if (attachment.size && attachment.size > MAX_FILE_SIZE) {
          hasLargeFiles = true;
          largeFilesInfo.push(`${attachment.filename} (${sizeInMB} MB)`);
          console.log(`Large file detected: ${attachment.filename} (${sizeInMB} MB)`);
        }
      }
    }
    
    // If there are large files, return special result indicating manual input needed
    if (hasLargeFiles) {
      console.log(`Large files detected: ${largeFilesInfo.join(', ')}. Manual input required.`);
      return parameters.map(param => ({
        name: param,
        value: "-", // Empty value for manual input
        source: 'manual_required',
        confidence: 0
      }));
    }
    
    // Get text from email content and clean it
    let emailContent = response.content || '';
    
    // Clean email content by removing quoted replies and previous email history
    // This removes text commonly found in email replies like quoted content, previous messages, etc.
    if (emailContent) {
      // Store original length for logging
      const originalLength = emailContent.length;
      
      // 1. Remove sections that start with common reply indicators
      const replyMarkers = [
        // Russian email markers
        /От кого:.*?$/gms,                 // Russian "From:" in replies
        /Кому:.*?$/gms,                    // Russian "To:" in replies
        /Дата:.*?$/gms,                    // Russian "Date:" in replies
        /Тема:.*?$/gms,                    // Russian "Subject:" in replies
        /\s*-{3,}Исходное сообщение-{3,}[\s\S]*$/mi, // "Original message" in Russian
        /\s*-{3,}Пересылаемое сообщение-{3,}[\s\S]*$/mi, // "Forwarded message" in Russian
        /\s*Переадресованное сообщение[\s\S]*$/mi,      // Another "Forwarded message" variant
        /\s*Начало переадресованного сообщения:[\s\S]*$/mi, // Russian "Begin forwarded message"
        /\s*\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}.*?писал\(а\):[\s\S]*$/mi, // Russian date with "wrote:"
        
        // English email markers
        /From:.*?$/gms,                    // English "From:" in replies
        /To:.*?$/gms,                      // English "To:" in replies
        /Date:.*?$/gms,                    // English "Date:" in replies
        /Subject:.*?$/gms,                 // English "Subject:" in replies
        /\s*-{3,}Original Message-{3,}[\s\S]*$/mi,   // "Original message" in English
        /\s*-{3,}Forwarded Message-{3,}[\s\S]*$/mi,  // "Forwarded message" in English
        /\s*Begin forwarded message:[\s\S]*$/mi,     // Another forwarded message marker
        /\s*On.*?wrote:[\s\S]*$/mi,                  // "On [date] [name] wrote:" format
        /\s*\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}.*?wrote:[\s\S]*$/mi, // Date format with "wrote:"
        
        // Universal markers
        /\s*>{2,}[\s\S]*$/m,              // Multiple > quotes (common in many email clients)
        /\s*_{10,}[\s\S]*$/m,              // Underscores used as separators 
        /\s*={10,}[\s\S]*$/m,              // Equal signs used as separators
      ];
      
      for (const marker of replyMarkers) {
        emailContent = emailContent.replace(marker, '');
      }
      
      // 2. Remove ALL quoted lines (starting with > or multiple quotes)
      // Focus only on new email content, not historical quoted content
      emailContent = emailContent.split('\n')
                               .filter(line => {
                                 const trimmedLine = line.trim();
                                 // Remove any line that starts with quote markers
                                 return !trimmedLine.startsWith('>') && 
                                        !trimmedLine.startsWith('>>') && 
                                        !trimmedLine.startsWith('>>>');
                               })
                               .join('\n');
      
      // 3. Additional cleaning for email signatures and other noise
      emailContent = emailContent.replace(/\s*--\s*[\s\S]*$/, '') // Remove signatures
                               .replace(/\s*С уважением,[\s\S]*$/, '') // Remove Russian "Regards,"
                               .replace(/\s*С наилучшими пожеланиями[\s\S]*$/, '') // Another Russian regards
                               .replace(/\s*С уважением и наилучшими пожеланиями[\s\S]*$/, '') // Extended Russian regards
                               .replace(/\s*Best regards,[\s\S]*$/, '') // English "Regards,"
                               .replace(/\s*Regards,[\s\S]*$/, '') // Shorter English "Regards,"
                               .replace(/\s*Kind regards,[\s\S]*$/, '') // Another English regards variant
                               .replace(/\s*Sincerely,[\s\S]*$/, '') // Another formal email closing
                               .trim();
      
      // Log the amount of text removed
      const charsRemoved = originalLength - emailContent.length;
      console.log(`Email cleaning: removed ${charsRemoved} characters of previous message history (${Math.round(charsRemoved/originalLength*100)}% of original)`);
    }
    
    // Debug logging for content
    console.log(`Extracting parameters from response ID ${responseId}`);
    console.log(`Email has ${hasAttachments ? (response.attachments as any[]).length : 0} attachments`);
    console.log(`Using AI extraction: ${useAI ? 'Yes' : 'No'}`);
    console.log(`Email content length after cleaning: ${emailContent.length} chars`);
    
    // Print detailed info about attachments
    if (hasAttachments && Array.isArray(response.attachments)) {
      response.attachments.forEach((attachment: any, index: number) => {
        console.log(`Attachment #${index + 1}: ${attachment.filename}`);
        console.log(`  Content type: ${attachment.contentType}`);
        console.log(`  Has content: ${!!attachment.content}`);
        console.log(`  Has extractedText: ${!!attachment.extractedText}`);
        if (attachment.extractedText) {
          console.log(`  ExtractedText length: ${attachment.extractedText.length} chars`);
          console.log(`  ExtractedText preview: ${attachment.extractedText.substring(0, 100)}...`);
        }
      });
    }

    // If using AI and we have text to analyze, extract all parameters at once using AI
    if (useAI) {
      try {
        // Collect all available text content
        let combinedText = emailContent || '';
        let attachmentTextFound = false;
        
        // Add text from attachments
        if (hasAttachments && Array.isArray(response.attachments)) {
          // Проверяем, есть ли хоть в одном вложении текст
          console.log('Checking if any attachments have extractedText:');
          for (const attachment of response.attachments as any[]) {
            if (attachment.extractedText) {
              console.log(`  - ${attachment.filename}: Yes (${attachment.extractedText.length} chars)`);
              attachmentTextFound = true;
            } else {
              console.log(`  - ${attachment.filename}: No`);
            }
          }
          
          // Если нет текста, выводим предупреждение
          if (!attachmentTextFound) {
            console.warn('WARNING: No extractedText found in any attachments, AI extraction may not work');
          }
          
          // Собираем текст из всех вложений
          for (const attachment of response.attachments as any[]) {
            if (attachment.extractedText) {
              combinedText += '\n\n--- ATTACHMENT: ' + attachment.filename + ' ---\n';
              combinedText += attachment.extractedText;
            }
          }
        }
        
        // If we have text to analyze, use OpenAI compatible DeepSeek API directly (like in compare.ts)
        if (combinedText.trim().length > 0) {
          console.log(`Using DeepSeek API to extract parameters from ${combinedText.length} characters of text`);
          
          try {
            // Limit text length to avoid token limits
            const maxTextLength = 10000;
            const truncatedText = combinedText.length > maxTextLength 
              ? combinedText.substring(0, maxTextLength) + '...(текст сокращен)' 
              : combinedText;
            
            console.log('AI analysis: Calling DeepSeek API to extract parameters...');
            
            // Create prompt for parameter extraction focused only on requested parameters
            const systemPrompt = `
              Ты - эксперт по анализу коммерческих предложений и извлечению ключевых параметров из текста. 
              
              ВАЖНО: Извлекай ТОЛЬКО следующие запрошенные параметры: ${parameters.join(', ')}.
              НЕ извлекай никакие другие параметры, даже если они есть в тексте.
              
              Твоя задача - внимательно изучить текст письма и вложенных документов и найти значения ТОЛЬКО для указанных выше параметров.
              
              ПРАВИЛА ИЗВЛЕЧЕНИЯ:
              1. Ищи информацию в тексте письма и вложенных документах
              2. Для стандартных параметров используй общепринятые правила поиска
              3. Для пользовательских параметров (не входящих в стандартный список) ищи по точному названию или смыслу
              4. Если параметр не найден, верни "-" с confidence: 0
              5. Всегда включай валюту в значения цен и стоимости
              
              ПОИСК СТАНДАРТНЫХ ПАРАМЕТРОВ:
              - "общая стоимость без ндс": ищи "итого" "сумма" "общая стоимость" + "без ндс"/"без налога". Добавляй валюту
              - "общая стоимость с ндс": ищи "итого к оплате" "итого" "с ндс" "с учетом ндс". Добавляй валюту
              - "контактный телефон для связи": ищи номера телефонов в любом формате
              - "цена за единицу без ндс": ищи "цена" "стоимость" + "за шт." "за ед." + числа. Добавляй валюту и единицы
              - "сроки поставки": ищи цифры + "дней" "недель" "рабочих дней"
              - "условия поставки": ищи "доставка" "самовывоз" "франко". Включай адрес если указан
              - "условия оплаты": ищи "предоплата" "аванс" "отсрочка" "% предоплаты"
              - "товар": полное название с характеристиками
              - "поставщик": полное название компании с формой собственности и страной
              
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
              
              Верни JSON-массив ТОЛЬКО для запрошенных параметров:
              [
                {
                  "name": "точное название запрошенного параметра",
                  "value": "извлеченное значение или '-' если не найдено",
                  "confidence": число от 0 до 1 (0 - не найдено, 1 - полная уверенность)
                }
              ]
            `;
            
            console.log('Calling DeepSeek API directly...');
            
            // Check if OpenAI client is initialized
            if (!openai) {
              throw new Error('DeepSeek API client not initialized. Please set DEEPSEEK_API_KEY environment variable.');
            }
            
            // Call the DeepSeek API directly instead of using the service
            const completion = await openai.chat.completions.create({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: systemPrompt
                },
                {
                  role: "user",
                  content: truncatedText
                }
              ],
              temperature: 0.1
            });
            
            // Log the API response
            console.log('DeepSeek API response received');
            
            if (completion.choices && completion.choices.length > 0) {
              const aiResponse = completion.choices[0].message.content;
              console.log('AI response content:', aiResponse?.substring(0, 200) + '...');
              
              try {
                // Extract the JSON from the response
                const jsonMatch = aiResponse?.match(/\[\s*\{[\s\S]*?\}\s*\]/);
                if (jsonMatch) {
                  const extractedJson = jsonMatch[0];
                  const parsedResults = JSON.parse(extractedJson);
                  console.log('AI analysis: Extracted parameters successfully');
                  
                  // Format the results for the API response with better source attribution
                  const results: ExtractedParameter[] = parsedResults.map((result: any) => {
                    // Try to determine if the value came from email content
                    let source: 'content' | 'attachment' | 'unknown' = 'unknown';
                    
                    if (result.value && result.value !== '-' && result.confidence > 0.2) {
                      // Normalize values for comparison
                      const valueNormalized = result.value.replace(/\s+/g, ' ').toLowerCase().trim();
                      const emailContentNormalized = emailContent.replace(/\s+/g, ' ').toLowerCase();
                      
                      // Check if the value is present in email content
                      if (emailContentNormalized.includes(valueNormalized) || 
                          // For numerical values, check with only numbers
                          (valueNormalized.match(/\d/) && 
                           emailContentNormalized.includes(valueNormalized.replace(/[^\d.,]/g, '')))) {
                        source = 'content';
                        console.log(`Parameter ${result.name} appears to come from email content (direct API): "${result.value}"`);
                      } else {
                        source = attachmentTextFound ? 'attachment' : 'content'; 
                        // If no attachments with text, it must be from content even if we can't find exact match
                      }
                    }
                    
                    return {
                      name: result.name,
                      value: result.value || '-',
                      source: source,
                      confidence: typeof result.confidence === 'number' ? result.confidence : 0
                    };
                  });
                  
                  console.log(`AI extraction complete, found ${results.filter(r => r.value !== "-").length} parameters with values`);
                  console.log('AI analysis generated successfully');
                  return results;
                } else {
                  console.error('AI analysis: No valid JSON found in response');
                }
              } catch (parseError) {
                console.error('Error parsing AI response:', parseError);
              }
            }
          } catch (aiCallError) {
            console.error('Error calling DeepSeek API directly:', aiCallError);
          }
          
          // If we get here, fallback to the service method
          try {
            // Call the AI extraction service as fallback
            const aiResults = await extractParametersWithAI(combinedText, parameters);
            console.log('AI extraction results (fallback method):', aiResults);
            
            // Проверяем, что мы получили результаты
            if (aiResults && aiResults.length > 0) {
              // Format the results for the API response
              // Process results to determine likely source
              const results: ExtractedParameter[] = aiResults.map(result => {
                // Try to figure out if value comes from email or attachment
                let source: 'content' | 'attachment' | 'unknown' = 'unknown';
                
                // If confidence is high, we'll try to determine the source more precisely
                if (result.confidence > 0.2) {
                  // Check if exact match or close variant is in the email content
                  // Accounting for small formatting differences (spaces, punctuation)
                  const valueNormalized = result.value.replace(/\s+/g, ' ').toLowerCase().trim();
                  const emailContentNormalized = emailContent.replace(/\s+/g, ' ').toLowerCase();
                  
                  if (emailContentNormalized.includes(valueNormalized) || 
                      // Check with fuzzy matching for price values (allowing for slight differences)
                      (valueNormalized.match(/\d/) && emailContentNormalized.includes(valueNormalized.replace(/[^\d.,]/g, '')))) {
                    source = 'content';
                    console.log(`Parameter ${result.name} appears to come from email content: "${result.value}"`);
                  } else {
                    // If there are no attachments with text, it must be from content even if we can't find exact match
                    source = attachmentTextFound ? 'attachment' : 'content';
                    console.log(`Parameter ${result.name} appears to come from ${source}: "${result.value}"`);
                  }
                }
                
                return {
                  name: result.name,
                  value: result.value,
                  source,
                  confidence: result.confidence
                };
              });
              
              console.log(`AI extraction complete, found ${results.filter(r => r.value !== "-").length} parameters with values`);
              return results;
            } else {
              console.warn('AI extraction returned no results, falling back to regex extraction');
            }
          } catch (fallbackError) {
            console.error('Error in fallback AI extraction method:', fallbackError);
          }
        } else {
          console.warn('No text available for AI extraction, falling back to regex extraction');
        }
      } catch (aiError) {
        console.error('Error using AI extraction, falling back to regex extraction:', aiError);
        // Fall back to regex-based extraction if AI fails
      }
    }
    
    // Regex-based extraction (fallback or if AI is disabled)
    const results: ExtractedParameter[] = [];
    
    // Process each parameter separately using regex patterns
    for (const parameter of parameters) {
      // First try to extract from email content
      const contentResult = extractParameterFromText(emailContent, parameter);
      
      // Log if we found something in the email content
      if (contentResult && contentResult.value !== "-") {
        console.log(`Found parameter "${parameter}" in email body: ${contentResult.value}`);
      }
      
      // Next try to extract from attachments
      let bestResult = contentResult.value !== "-" ? contentResult : {
        value: "-",
        source: 'unknown',
        confidence: 0
      };
      
      // If we have attachments, try to extract from them
      if (hasAttachments && Array.isArray(response.attachments)) {
        for (const attachment of response.attachments as any[]) {
          // If no extractedText, skip this attachment
          if (!attachment.extractedText) {
            console.log(`Attachment ${attachment.filename} has no extractedText, skipping`);
            continue;
          }
          
          // Debug
          console.log(`Checking attachment ${attachment.filename} for parameter: ${parameter}`);
          
          // Try to extract text using pattern matching
          try {
            const attachmentResult = extractParameterFromText(attachment.extractedText, parameter);
            
            // If we got a result and it's better than our current best
            if (attachmentResult && attachmentResult.value !== "-" && 
                (bestResult.value === "-" || attachmentResult.confidence > bestResult.confidence)) {
              
              bestResult = {
                ...attachmentResult,
                source: 'attachment'
              };
              
              // Debug
              console.log(`Found parameter ${parameter} in attachment: ${bestResult.value} (confidence: ${bestResult.confidence})`);
            }
          } catch (extractError) {
            console.error(`Error extracting ${parameter} from attachment:`, extractError);
          }
        }
      }
      
      // Add the best result for this parameter
      results.push({
        name: parameter,
        value: bestResult.value,
        source: bestResult.source,
        confidence: bestResult.confidence
      });
    }
    
    console.log(`Regex extraction complete, found ${results.filter(r => r.value !== "-").length} parameters with values`);
    return results;
  } catch (error) {
    console.error('Error extracting parameters:', error);
    throw error;
  }
}

// API endpoint for parameter extraction
router.post('/', requireAuth, async (req, res) => {
  try {
    const validatedData = ExtractParametersSchema.parse(req.body);
    const { responseId, parameters, useAI } = validatedData;
    
    console.log(`Parameter extraction request received: responseId=${responseId}, useAI=${useAI}, parameters=${parameters.join(', ')}`);
    
    // Extract parameters from response
    const extractedParameters = await extractParametersFromResponse(responseId, parameters, useAI);
    
    try {
      // Get the supplier response to get requestId and supplierEmail
      const response = await storage.getSupplierResponseById(responseId);
      
      if (!response) {
        throw new Error(`Response not found for ID ${responseId}`);
      }
      
      // Convert extracted parameters array to object format for storage
      const extractedParamObject: Record<string, string> = {};
      extractedParameters.forEach(param => {
        extractedParamObject[param.name] = param.value;
      });
      
      // Get the user ID from the authenticated request
      const userId = req.user && (req.user as any).id ? (req.user as any).id : null;
      
      console.log(`Extracting parameters with userId=${userId} for response ID ${responseId}`);
      
      // Get the original request parameters to preserve custom parameters like "Монтаж"
      let originalRequestParams: string[] = [];
      try {
        const requestParamRecord = await storage.getParametersForRequest(response.requestId);
        if (requestParamRecord && requestParamRecord.parameters) {
          // Check if parameters is already an array (JSONB) or needs parsing (string)
          if (Array.isArray(requestParamRecord.parameters)) {
            originalRequestParams = requestParamRecord.parameters;
          } else {
            // Parse the JSON string to get the array of parameter names
            originalRequestParams = JSON.parse(requestParamRecord.parameters as string);
          }
          console.log(`Found original request parameters for request ${response.requestId}:`, originalRequestParams);
        } else {
          console.log(`No parameters found for request ${response.requestId}`);
          originalRequestParams = [];
        }
      } catch (error) {
        console.warn(`Could not load original request parameters for request ${response.requestId}:`, error);
        // If no specific parameters found, don't use default parameters - this maintains the strict selection
        originalRequestParams = [];
      }
      
      // Create final parameter object that includes ALL request parameters
      // This ensures custom parameters like "Монтаж" are preserved even if not extracted from document
      const finalParamObject: Record<string, string> = {};
      
      // If we have original request parameters, use only those
      if (originalRequestParams && originalRequestParams.length > 0) {
        // First, add all original request parameters with default "-" value
        originalRequestParams.forEach(paramName => {
          finalParamObject[paramName] = '-';
        });
        
        // Then, overwrite with extracted values where available
        Object.keys(extractedParamObject).forEach(paramName => {
          finalParamObject[paramName] = extractedParamObject[paramName];
        });
      } else {
        // If no original parameters found, use only what was extracted (this maintains compatibility)
        Object.keys(extractedParamObject).forEach(paramName => {
          finalParamObject[paramName] = extractedParamObject[paramName];
        });
      }
      
      // Check if we have any real parameter values
      const hasValidParameters = Object.values(finalParamObject).some(val => val && val !== '-');
      
      // Save extracted parameters to database even if no valid parameters found
      // This prevents repeated extraction attempts on emails with no extractable data
      // IMPORTANT: We are now preserving ALL request parameters including custom ones
      console.log(`PRESERVING ALL REQUEST PARAMETERS: Saving these parameters: ${JSON.stringify(Object.keys(finalParamObject))}`);
      
      await storage.saveExtractedParameters({
        responseId: responseId,
        requestId: response.requestId,
        supplierEmail: response.supplierEmail,
        parameters: finalParamObject, // This contains ALL request parameters, with extracted values where available
        status: hasValidParameters ? 'completed' : 'no_parameters_found',
        userId: userId // Include the user ID for proper multi-tenant isolation
      });
      
      console.log(`[storage] ${hasValidParameters ? 'Saving extracted parameters' : 'Saving empty parameters'} for response ID ${responseId} with userId=${userId}`);
      
      console.log(`Successfully saved extracted parameters to database for responseId=${responseId}`);
    } catch (saveError) {
      console.error('Error saving extracted parameters to database:', saveError);
      // Continue and return the extracted parameters even if save fails
    }
    
    res.json({ 
      parameters: extractedParameters,
      usedAI: useAI
    });
  } catch (error) {
    console.error('Error in extract-parameters route:', error);
    res.status(500).json({ error: 'Error extracting parameters' });
  }
});

export default router;