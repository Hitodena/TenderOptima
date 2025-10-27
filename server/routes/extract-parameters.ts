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
import * as apiBridge from '../file-processing/api_bridge.cjs';

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

// Alternative cost extraction function for email text
function extractCostFromEmailText(text: string): { value: string; confidence: number } {
  if (!text || typeof text !== 'string') {
    return { value: "-", confidence: 0 };
  }
  
  try {
    // More aggressive patterns for cost extraction
    const patterns = [
      // Pattern for "Общая стоимость без НДС: 50001 BYN"
      /общая\s*стоимость\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:BYN|руб|₽|\$|USD|EUR|€))?/i,
      // Pattern for "стоимость: 50001 BYN"
      /стоимость\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:BYN|руб|₽|\$|USD|EUR|€))?/i,
      // Pattern for "цена: 50001 BYN"
      /цена\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:BYN|руб|₽|\$|USD|EUR|€))?/i,
      // Pattern for "итого: 50001 BYN"
      /итого\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:BYN|руб|₽|\$|USD|EUR|€))?/i,
      // Pattern for "всего: 50001 BYN"
      /всего\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:BYN|руб|₽|\$|USD|EUR|€))?/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let value = match[1].trim().replace(/\s+/g, '');
        
        // Look for currency in the surrounding text
        const currencyMatch = text.substring(match.index || 0 || 0, (match.index || 0 || 0) + match[0].length + 10).match(/(BYN|руб|₽|\$|USD|EUR|€)/i);
        if (currencyMatch) {
          value += ' ' + currencyMatch[0];
        } else {
          value += ' руб.'; // Default currency
        }
        
        console.log(`Alternative cost extraction found: ${value}`);
        return { value, confidence: 0.8 };
      }
    }
    
    return { value: "-", confidence: 0 };
  } catch (error) {
    console.error('Error in alternative cost extraction:', error);
    return { value: "-", confidence: 0 };
  }
}

// Function to extract parameters from text, improved version
export function extractParameterFromText(text: string, parameter: string): ExtractionResult {
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
    
    // SPECIAL HANDLING: Check for structured responses with numbered points
    // This handles cases like:
    // 1. Описание товара: — Поддон плоский деревянный...
    // 2. Общая стоимость без НДС: — 800,00 руб.
    // 3. Цена за единицу без НДС: 8,00 руб
    const structuredPatterns = [
      // Pattern for numbered points with parameter name
      new RegExp(`\\d+\\.\\s*${parameter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[\\:\\-]?\\s*([^\\n]{2,200})`, 'i'),
      // Pattern for numbered points with parameter name and em dash
      new RegExp(`\\d+\\.\\s*${parameter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[\\:\\-]?\\s*[—–-]\\s*([^\\n]{2,200})`, 'i'),
      // Pattern for numbered points with parameter name (case insensitive with common variations)
      new RegExp(`\\d+\\.\\s*${parameter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/и/gi, '[Ии]').replace(/н/gi, '[Нн]').replace(/п/gi, '[Пп]')}\\s*[\\:\\-]?\\s*([^\\n]{2,200})`, 'i'),
    ];
    
    for (const pattern of structuredPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        console.log(`Found structured response for "${parameter}": ${value}`);
        return {
          value: value,
          source: 'content',
          confidence: 0.95 // High confidence for structured responses
        };
      }
    }
    
    // Use direct pattern matching for common parameters - this is most reliable
    // Patterns based on the successful extraction seen in previous runs
    
    // 1. Match for price without VAT (НДС) - с улучшенными шаблонами и валютой
    if (parameter === 'общая стоимость без ндс') {
      // Ищем в разных форматах с учетом возможной валюты
      const patterns = [
        // Простой паттерн для "Общая стоимость без НДС: 50001 BYN"
        /общая\s*стоимость\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /общая\s*цена\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /цена\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /стоимость\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /итого\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€)?\s*,?\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /(?:общая|полная|итоговая)?\s*стоимость\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /(?:общая|полная|итоговая)?\s*цена\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /сумма\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /всего\s*без\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Ищем валюту после числа
          const currencyAfter = text.substring(match.index || 0 + match[0].length, match.index || 0 + match[0].length + 20).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Ищем валюту перед числом
          const currencyBefore = text.substring(Math.max(0, match.index || 0 - 20), match.index || 0).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
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
        /(?:общая|полная|итоговая)?\s*цена\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /цена\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /стоимость\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /сумма\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /всего\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /к\s*оплате\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        // Новые паттерны для таблиц и специфичных форматов
        /цена\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        /стоимость\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        // Паттерн для таблиц с колонкой "Цена с НДС"
        /цена\s*с\s*ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Ищем валюту после числа
          const currencyAfter = text.substring(match.index || 0 + match[0].length, match.index || 0 + match[0].length + 20).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Ищем валюту перед числом
          const currencyBefore = text.substring(Math.max(0, match.index || 0 - 20), match.index || 0).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
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
    
    // 2.5. Match for VAT amount (сам НДС) - специальная обработка для НДС
    if (parameter === 'ндс' || parameter === 'сам ндс' || parameter === 'НДС') {
      const patterns = [
        // Паттерн для "20% НДС: 1,80"
        /(?:20%?\s*)?НДС\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        // Паттерн для "НДС 20%: 1,80"
        /НДС\s*(?:20%?)?\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        // Паттерн для "налог: 1,80"
        /налог\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        // Паттерн для "ндс: 1,80"
        /ндс\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i,
        // Паттерн для таблиц с колонкой "20% НДС"
        /20%?\s*НДС\s*[\:\-]?\s*(\d[\d\s.,]+)(?:\s*(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€))?/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          let value = match[1].trim().replace(/\s+/g, '');
          
          // Ищем валюту после числа
          const currencyMatch = text.substring(match.index || 0 || 0, (match.index || 0 || 0) + match[0].length + 10).match(/(?:бел\.?руб\.|руб\.|₽|BYN|USD|\$|EUR|€)/i);
          if (currencyMatch) {
            value += ' ' + currencyMatch[0];
          } else {
            value += ' руб.'; // Default currency
          }
          
          console.log(`Found VAT amount for ${parameter}: ${value}`);
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
          const currencyAfter = text.substring(match.index || 0 + match[0].length, match.index || 0 + match[0].length + 20).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Ищем валюту перед числом
          const currencyBefore = text.substring(Math.max(0, match.index || 0 - 20), match.index || 0).match(/(руб\.?|бел\.?руб\.?|BYN|USD|\$|EUR|€|₽)/i);
          
          // Ищем единицу измерения
          const unitMatch = text.substring(match.index || 0, match.index || 0 + match[0].length + 30).match(/за\s*(шт|ед|единицу|м\.?пог|м2|метр|штуку)/i);
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
    if (parameter === 'поставщик' || parameter === 'Наименование поставщика' || parameter === 'supplier_name') {
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
      
      // Function to validate if a number looks like a price (not INN, OGRN, etc.)
      const isValidPrice = (value: string): boolean => {
        const cleanValue = value.replace(/[^\d.,]/g, '');
        const numValue = parseFloat(cleanValue.replace(',', '.'));
        
        // Reject very large numbers that look like INN/OGRN (10+ digits)
        if (cleanValue.length >= 10) {
          return false;
        }
        
        // Reject numbers that are too small to be meaningful prices (less than 0.01)
        if (numValue < 0.01) {
          return false;
        }
        
        // Accept reasonable price ranges
        return numValue >= 0.01 && numValue <= 10000000; // Up to 10 million
      };
      
      for (const pattern of explicitPricePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          let cleanedPrice = match[1].trim();
          
          // Validate that this looks like a real price, not INN/OGRN
          if (!isValidPrice(cleanedPrice)) {
            console.log(`Rejected potential price "${cleanedPrice}" - looks like INN/OGRN or invalid value`);
            continue;
          }
          
          // Add currency if not present
          if (!cleanedPrice.match(/руб|₽|BYN|USD|\$|EUR|€/)) {
            // Check if currency follows separately
            const afterMatch = text.substring(match.index || 0 + match[0].length, match.index || 0 + match[0].length + 20);
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
        // Get the first match that looks substantial and valid
        const significantMatches = matches.filter(m => {
          const numberPart = m.replace(/[^\d.,]/g, '');
          // Must have at least 2 digits and not be a year (2022, 2023, etc)
          const hasMinDigits = numberPart.length >= 2 && !(/^20\d\d$/.test(numberPart));
          
          // Also validate that it looks like a real price
          return hasMinDigits && isValidPrice(m);
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
export async function extractParametersFromResponse(
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
      console.log(`Checking ${(response.attachments as any[]).length} attachments for size limits...`);
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
      
      // SPECIAL HANDLING: Extract structured responses enclosed in various delimiters
      // This handles cases where suppliers send structured responses like:
      // >>> 
      // 1. Описание товара: ...
      // 2. Цена: ...
      // >>>
      // OR
      // >---------------------------------------------
      // >1. Описание товара: ...
      // >2. Цена: ...
      // >---------------------------------------------
      let structuredResponse = '';
      
      // Try different delimiter patterns
      const delimiterPatterns = [
        // Pattern 1: >>> delimiters
        />>>\s*([\s\S]*?)\s*>>>/,
        // Pattern 2: > with dashes (like >---------------------------------------------)
        />-{10,}\s*([\s\S]*?)\s*>-{10,}/,
        // Pattern 3: > with equals (like >=============================================)
        />={10,}\s*([\s\S]*?)\s*>={10,}/,
        // Pattern 4: > with underscores (like >________________________________________)
        />_{10,}\s*([\s\S]*?)\s*>_{10,}/,
        // Pattern 5: Multiple > symbols (like >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>)
        />{10,}\s*([\s\S]*?)\s*>{10,}/,
      ];
      
      for (const pattern of delimiterPatterns) {
        const match = emailContent.match(pattern);
        if (match && match[1]) {
          structuredResponse = match[1].trim();
          console.log(`Found structured response enclosed in delimiters (pattern: ${pattern}): ${structuredResponse.length} chars`);
          console.log(`Structured response preview: ${structuredResponse.substring(0, 200)}...`);
          break; // Use the first match found
        }
      }
      
      // 1. Remove sections that start with common reply indicators
      const replyMarkers = [
        // Russian email markers
        /От кого:.*?$/gm,                 // Russian "From:" in replies
        /Кому:.*?$/gm,                    // Russian "To:" in replies
        /Дата:.*?$/gm,                    // Russian "Date:" in replies
        /Тема:.*?$/gm,                    // Russian "Subject:" in replies
        /\s*-{3,}Исходное сообщение-{3,}[\s\S]*$/mi, // "Original message" in Russian
        /\s*-{3,}Пересылаемое сообщение-{3,}[\s\S]*$/mi, // "Forwarded message" in Russian
        /\s*Переадресованное сообщение[\s\S]*$/mi,      // Another "Forwarded message" variant
        /\s*Начало переадресованного сообщения:[\s\S]*$/mi, // Russian "Begin forwarded message"
        /\s*\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}.*?писал\(а\):[\s\S]*$/mi, // Russian date with "wrote:"
        
        // English email markers
        /From:.*?$/gm,                    // English "From:" in replies
        /To:.*?$/gm,                      // English "To:" in replies
        /Date:.*?$/gm,                    // English "Date:" in replies
        /Subject:.*?$/gm,                 // English "Subject:" in replies
        /\s*-{3,}Original Message-{3,}[\s\S]*$/mi,   // "Original message" in English
        /\s*-{3,}Forwarded Message-{3,}[\s\S]*$/mi,  // "Forwarded message" in English
        /\s*Begin forwarded message:[\s\S]*$/mi,     // Another forwarded message marker
        /\s*On.*?wrote:[\s\S]*$/mi,                  // "On [date] [name] wrote:" format
        /\s*\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}.*?wrote:[\s\S]*$/mi, // Date format with "wrote:"
        
        // Universal markers (but NOT the >>> delimiters for structured responses)
        /\s*_{10,}[\s\S]*$/m,              // Underscores used as separators 
        /\s*={10,}[\s\S]*$/m,              // Equal signs used as separators
      ];
      
      for (const marker of replyMarkers) {
        emailContent = emailContent.replace(marker, '');
      }
      
      // 2. Remove quoted lines, but preserve structured responses
      // Focus only on new email content, not historical quoted content
      emailContent = emailContent.split('\n')
                               .filter(line => {
                                 const trimmedLine = line.trim();
                                 // Remove lines that start with quote markers, but preserve structured responses
                                 if (trimmedLine.startsWith('>')) {
                                   // Check if this line is part of a structured response
                                   const isStructuredResponse = 
                                     trimmedLine.startsWith('>>>') ||
                                     /^-{10,}$/.test(trimmedLine.substring(1)) || // > with dashes
                                     /^={10,}$/.test(trimmedLine.substring(1)) || // > with equals
                                     /^_{10,}$/.test(trimmedLine.substring(1)) || // > with underscores
                                     /^>{9,}$/.test(trimmedLine.substring(1)) ||  // multiple >
                                     /^\d+\./.test(trimmedLine.substring(1));     // numbered points
                                   
                                   if (isStructuredResponse) {
                                     return true; // Keep structured response lines
                                   } else {
                                     return false; // Remove regular quoted lines
                                   }
                                 }
                                 return true; // Keep everything else
                               })
                               .join('\n');
      
      // 3. If we found a structured response, use it as the primary content
      if (structuredResponse) {
        console.log(`Using structured response as primary content for parameter extraction`);
        emailContent = structuredResponse;
      }
      
      // 4. Additional cleaning for email signatures and other noise
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
        // PRIORITY: Collect attachment text FIRST, then email content
        let combinedText = '';
        let attachmentTextFound = false;
        
        // Add text from attachments FIRST (PRIORITY)
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
          
          // Если нет текста, выводим предупреждение и пытаемся подождать
          if (!attachmentTextFound) {
            console.warn('WARNING: No extractedText found in any attachments, AI extraction may not work');
            console.log('This might indicate that attachments are still being processed...');
            
            // Дополнительная проверка: возможно, вложения еще обрабатываются
            console.log('Checking if attachments are still being processed...');
            const currentResponse = await storage.getSupplierResponseById(responseId);
            if (currentResponse && currentResponse.attachments && Array.isArray(currentResponse.attachments)) {
              console.log('Current response attachments:');
              currentResponse.attachments.forEach((att: any, index: number) => {
                console.log(`  ${index + 1}. ${att.filename}: ${att.extractedText ? 'Yes' : 'No'} (${att.extractedText ? att.extractedText.length : 0} chars)`);
              });
            }
          }
          
          // Собираем текст из всех вложений ПЕРВЫМИ (ПРИОРИТЕТ)
          for (const attachment of response.attachments as any[]) {
            if (attachment.extractedText) {
              console.log(`[DEBUG] Attachment ${attachment.filename} extractedText: "${attachment.extractedText}"`);
              combinedText += '--- ATTACHMENT: ' + attachment.filename + ' ---\n';
              combinedText += attachment.extractedText;
              combinedText += '\n\n';
            }
          }
        }
        
        // Add email content SECOND (fallback)
        if (emailContent && emailContent.trim().length > 0) {
          combinedText += '--- EMAIL BODY ---\n';
          combinedText += emailContent;
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
                    // Try to determine if the value came from email content or attachment
                    let source: 'content' | 'attachment' | 'unknown' = 'unknown';
                    
                    if (result.value && result.value !== '-' && result.confidence > 0.2) {
                      // Normalize values for comparison
                      const valueNormalized = result.value.replace(/\s+/g, ' ').toLowerCase().trim();
                      const emailContentNormalized = emailContent.replace(/\s+/g, ' ').toLowerCase();
                      
                      // PRIORITY: Check attachments first, then email content
                      let foundInAttachment = false;
                      let foundInEmail = false;
                      
                      // Check if the value is present in email content
                      if (emailContentNormalized.includes(valueNormalized) || 
                          // For numerical values, check with only numbers
                          (valueNormalized.match(/\d/) && 
                           emailContentNormalized.includes(valueNormalized.replace(/[^\d.,]/g, '')))) {
                        foundInEmail = true;
                      }
                      
                      // Check if the value is present in attachments
                      if (hasAttachments && Array.isArray(response.attachments)) {
                        for (const attachment of response.attachments as any[]) {
                          if (attachment.extractedText) {
                            const attachmentNormalized = attachment.extractedText.replace(/\s+/g, ' ').toLowerCase();
                            if (attachmentNormalized.includes(valueNormalized) || 
                                (valueNormalized.match(/\d/) && 
                                 attachmentNormalized.includes(valueNormalized.replace(/[^\d.,]/g, '')))) {
                              foundInAttachment = true;
                              break;
                            }
                          }
                        }
                      }
                      
                      // PRIORITY RULE: Attachments have priority over email content
                      if (foundInAttachment) {
                        source = 'attachment';
                        console.log(`Parameter ${result.name} found in attachment (PRIORITY): "${result.value}"`);
                      } else if (foundInEmail) {
                        source = 'content';
                        console.log(`Parameter ${result.name} found in email content: "${result.value}"`);
                      } else {
                        source = attachmentTextFound ? 'attachment' : 'content';
                        console.log(`Parameter ${result.name} source determined by context: ${source}`);
                      }
                    }
                    
                    return {
                      name: result.name,
                      value: result.value || '-',
                      source: source,
                      confidence: typeof result.confidence === 'number' ? result.confidence : 0
                    };
                  });
                  
                  // Check for duplicate parameters and prioritize attachments
                  const parameterMap = new Map<string, ExtractedParameter>();
                  
                  // Process results with priority: attachments first
                  for (const result of results) {
                    const paramName = result.name;
                    
                    if (!parameterMap.has(paramName)) {
                      parameterMap.set(paramName, result);
                    } else {
                      // If parameter already exists, check if new one is from attachment
                      const existing = parameterMap.get(paramName)!;
                      if (result.source === 'attachment' && existing.source !== 'attachment') {
                        console.log(`Replacing ${paramName} value from content with attachment value: ${existing.value} -> ${result.value}`);
                        parameterMap.set(paramName, result);
                      }
                    }
                  }
                  
                  const finalResults = Array.from(parameterMap.values());
                  
                  console.log(`AI extraction complete, found ${finalResults.filter(r => r.value !== "-").length} parameters with values`);
                  console.log('AI analysis generated successfully');
                  return finalResults;
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
          
          // If we get here, AI extraction failed - fall back to regex extraction
          console.warn('Primary AI extraction failed, falling back to regex extraction');
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
      } else {
        // If no result from email content, try with more aggressive patterns
        console.log(`No result for "${parameter}" in email body, trying alternative extraction...`);
        
        // Try alternative extraction for common parameters
        if (parameter === 'общая стоимость без ндс') {
          const altResult = extractCostFromEmailText(emailContent);
          if (altResult && altResult.value !== "-") {
            contentResult.value = altResult.value;
            contentResult.confidence = altResult.confidence;
            console.log(`Alternative extraction found: ${contentResult.value}`);
          }
        }
      }
      
      // PRIORITY: Check attachments first, then email content
      let bestResult = {
        value: "-",
        source: 'unknown' as 'content' | 'attachment' | 'unknown',
        confidence: 0
      };
      
      // If we have attachments, try to extract from them FIRST (PRIORITY)
      if (hasAttachments && Array.isArray(response.attachments)) {
        let attachmentHasUsefulContent = false;
        
        for (const attachment of response.attachments as any[]) {
          // If no extractedText, skip this attachment
          if (!attachment.extractedText) {
            console.log(`Attachment ${attachment.filename} has no extractedText, skipping`);
            continue;
          }
          
          // Check if attachment has meaningful content (not just errors or empty text)
          const extractedText = attachment.extractedText.trim();
          if (extractedText.length < 10 || 
              extractedText.includes('Error extracting') || 
              extractedText.includes('Ошибка') ||
              extractedText.includes('No text found')) {
            console.log(`Attachment ${attachment.filename} has no meaningful content, skipping`);
            continue;
          }
          
          attachmentHasUsefulContent = true;
          
          // Debug
          console.log(`Checking attachment ${attachment.filename} for parameter: ${parameter}`);
          
          // Try to extract text using pattern matching
          try {
            const attachmentResult = extractParameterFromText(attachment.extractedText, parameter);
            
            // If we got a result from attachment, use it (PRIORITY)
            if (attachmentResult && attachmentResult.value !== "-") {
              bestResult = {
                ...attachmentResult,
                source: 'attachment'
              };
              
              // Debug
              console.log(`Found parameter ${parameter} in attachment (PRIORITY): ${bestResult.value} (confidence: ${bestResult.confidence})`);
              break; // Stop at first attachment result since attachments have priority
            }
          } catch (extractError) {
            console.error(`Error extracting ${parameter} from attachment:`, extractError);
          }
        }
        
        // If no attachments had useful content, mark for email content fallback
        if (!attachmentHasUsefulContent) {
          console.log(`No attachments with useful content found, will use email content if available`);
          bestResult = { value: "-", source: 'unknown', confidence: 0 };
        }
      }
      
      // Use email content if:
      // 1. No attachment result was found (bestResult.value === "-")
      // 2. OR attachment result has very low confidence (< 0.3)
      // 3. OR attachment result is empty/meaningless
      if ((bestResult.value === "-" || bestResult.confidence < 0.3 || bestResult.value.trim() === "") && contentResult.value !== "-") {
        bestResult = contentResult;
        console.log(`Using email content for parameter ${parameter}: ${bestResult.value} (attachment confidence: ${bestResult.confidence})`);
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