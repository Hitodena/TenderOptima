import type { Supplier, SearchRequest, SupplierSearchKeyword } from "@shared/schema";
import OpenAI from "openai";
import { db } from "./db";
import { supplierSearchKeywords } from "../shared/schema";
import { eq } from "drizzle-orm";

// Simpler but more effective matching service with morphological analysis
export class MatchingService {
  
  // Функция для нормализации русских слов (приведение к основе)
  private normalizeRussianWord(word: string): string[] {
    const normalizedWord = word.toLowerCase().trim();
    
    // Если слово короче 3 символов, возвращаем как есть
    if (normalizedWord.length < 3) {
      return [normalizedWord];
    }
    
    // Словарь частых морфологических преобразований для русского языка
    const morphologyMap: Record<string, string[]> = {
      // Перчатки - различные формы + опечатки
      'перчатка': ['перчатка', 'перчатки', 'перчаток', 'перчатке', 'перчатку', 'перчаткой', 'перчаткам', 'перчатками', 'перчатках', 'перчаки'],
      'перчатки': ['перчатка', 'перчатки', 'перчаток', 'перчатке', 'перчатку', 'перчаткой', 'перчаткам', 'перчатками', 'перчатках', 'перчаки'],
      'перчаки': ['перчатка', 'перчатки', 'перчаток', 'перчатке', 'перчатку', 'перчаткой', 'перчаткам', 'перчатками', 'перчатках', 'перчаки'],
      
      // Защита - различные формы
      'защита': ['защита', 'защиты', 'защите', 'защиту', 'защитой', 'защитам', 'защитами', 'защитах'],
      'защиты': ['защита', 'защиты', 'защите', 'защиту', 'защитой', 'защитам', 'защитами', 'защитах'],
      
      // Картон - различные формы
      'картон': ['картон', 'картона', 'картону', 'картоном', 'картоне', 'картоны', 'картонов', 'картонам', 'картонами', 'картонах'],
      'картона': ['картон', 'картона', 'картону', 'картоном', 'картоне', 'картоны', 'картонов', 'картонам', 'картонами', 'картонах'],
      
      // Оборудование - различные формы
      'оборудование': ['оборудование', 'оборудования', 'оборудованию', 'оборудованием', 'оборудовании'],
      'оборудования': ['оборудование', 'оборудования', 'оборудованию', 'оборудованием', 'оборудовании'],
      
      // Материал - различные формы
      'материал': ['материал', 'материала', 'материалу', 'материалом', 'материале', 'материалы', 'материалов', 'материалам', 'материалами', 'материалах'],
      'материалы': ['материал', 'материала', 'материалу', 'материалом', 'материале', 'материалы', 'материалов', 'материалам', 'материалами', 'материалах'],
      
      // Коробка - различные формы  
      'коробка': ['коробка', 'коробки', 'коробке', 'коробку', 'коробкой', 'коробкам', 'коробками', 'коробках'],
      'коробки': ['коробка', 'коробки', 'коробке', 'коробку', 'коробкой', 'коробкам', 'коробками', 'коробках'],
      
      // Упаковка - различные формы
      'упаковка': ['упаковка', 'упаковки', 'упаковке', 'упаковку', 'упаковкой', 'упаковкам', 'упаковками', 'упаковках'],
      'упаковки': ['упаковка', 'упаковки', 'упаковке', 'упаковку', 'упаковкой', 'упаковкам', 'упаковками', 'упаковках']
    };
    
    // Если есть точное соответствие в словаре, возвращаем все формы
    console.log(`DEBUG: Checking morphologyMap for "${normalizedWord}"`);
    console.log(`DEBUG: morphologyMap has key "${normalizedWord}": ${morphologyMap.hasOwnProperty(normalizedWord)}`);
    
    if (morphologyMap[normalizedWord]) {
      console.log(`DEBUG: Found exact match for "${normalizedWord}":`, morphologyMap[normalizedWord]);
      return morphologyMap[normalizedWord];
    } else {
      console.log(`DEBUG: No exact match found for "${normalizedWord}"`);
    }
    
    // Если нет точного соответствия, попробуем найти по основе
    for (const [baseForm, forms] of Object.entries(morphologyMap)) {
      if (forms.includes(normalizedWord)) {
        console.log(`DEBUG: Found "${normalizedWord}" in forms of "${baseForm}":`, forms);
        return forms;
      }
    }
    
    // Общие правила для русского языка (упрощенные) + исправление опечаток
    const variations = [normalizedWord];
    
    // Функция исправления простых опечаток
    const fixTypos = (word: string): string[] => {
      const typoFixes: string[] = [];
      
      // Проверяем все слова из морфологического словаря
      for (const baseWord of Object.keys(morphologyMap)) {
        if (levenshteinDistance(word, baseWord) === 1) {
          typoFixes.push(baseWord);
        }
        
        // Также проверяем все формы этого слова
        for (const form of morphologyMap[baseWord]) {
          if (levenshteinDistance(word, form) === 1) {
            typoFixes.push(form);
          }
        }
      }
      
      return typoFixes;
    };
    
    // Функция вычисления расстояния Левенштейна
    const levenshteinDistance = (str1: string, str2: string): number => {
      const matrix = [];
      
      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
      }
      
      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1,     // insertion
              matrix[i - 1][j] + 1      // deletion
            );
          }
        }
      }
      
      return matrix[str2.length][str1.length];
    };
    
    // Добавляем варианты исправления опечаток и для каждого варианта ищем морфологические формы
    const typoFixes = fixTypos(normalizedWord);
    
    // Для каждого исправленного варианта добавляем морфологические формы
    for (const fixedWord of typoFixes) {
      if (morphologyMap[fixedWord]) {
        variations.push(...morphologyMap[fixedWord]);
      } else {
        variations.push(fixedWord);
      }
    }
    
    // Убираем типичные окончания и добавляем варианты
    const commonEndings = ['а', 'ы', 'и', 'ов', 'ам', 'ами', 'ах', 'е', 'у', 'ой', 'ем', 'ий', 'ая', 'ое', 'ые'];
    
    for (const ending of commonEndings) {
      if (normalizedWord.endsWith(ending) && normalizedWord.length > ending.length + 2) {
        const stem = normalizedWord.slice(0, -ending.length);
        
        // Добавляем варианты с другими окончаниями
        commonEndings.forEach(newEnding => {
          const variant = stem + newEnding;
          if (variant !== normalizedWord && variant.length >= 3) {
            variations.push(variant);
          }
        });
        
        // Добавляем основу без окончания
        if (stem.length >= 3) {
          variations.push(stem);
        }
        
        break;
      }
    }
    
    // Если ничего не изменилось, попробуем добавить/убрать окончания
    if (variations.length === 1) {
      // Попробуем добавить типичные окончания
      ['а', 'ы', 'и', 'ов'].forEach(ending => {
        variations.push(normalizedWord + ending);
      });
      
      // Попробуем убрать последний символ (возможное окончание)
      if (normalizedWord.length > 3) {
        variations.push(normalizedWord.slice(0, -1));
      }
    }
    
    return Array.from(new Set(variations)); // Убираем дубликаты и конвертируем в массив
  }

  /**
   * Получает все ключевые слова для поставщика из таблицы supplier_search_keywords
   * @param supplierId ID поставщика
   * @returns Массив ключевых слов
   */
  private async getKeywordsForSupplier(supplierId: number): Promise<string[]> {
    try {
      const keywords = await db
        .select({ keyword: supplierSearchKeywords.keyword })
        .from(supplierSearchKeywords)
        .where(eq(supplierSearchKeywords.supplierId, supplierId));
      
      return keywords.map(kw => kw.keyword);
    } catch (error) {
      console.error(`Error fetching keywords for supplier ${supplierId}:`, error);
      return [];
    }
  }

  async matchSuppliers(suppliers: Supplier[], searchRequest: SearchRequest) {
    // Базовая валидация входных данных
    if (!suppliers || !Array.isArray(suppliers) || !searchRequest) {
      console.log('Invalid suppliers or search request');
      return [];
    }

    // Проверка на наличие ключевых полей
    if (!searchRequest.productName) {
      console.log('Missing product name in search request');
      return [];
    }

    console.log('Matching suppliers for search request:', {
      productName: searchRequest.productName,
      productDescription: searchRequest.productDescription,
      useApiSearch: searchRequest.useApiSearch,
      supplierCount: suppliers.length
    });

    // First get matches from DeepSeek API if API search is enabled
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (apiKey && searchRequest.useApiSearch === true) {
      try {
        const openai = new OpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: apiKey
        });

        const completion = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            {
              role: "system", 
              content: "You are a B2B supplier sourcing expert focused on Belarus. Your task is to identify ONLY actual Belarusian manufacturing companies or B2B suppliers or wholesellers (not marketplaces) that produce or distribute the requested products. For each supplier, you MUST provide complete and verified contact information including company name, description, website URL, business email, and phone number. Do not generate fictional data. use this sourse to search: https://factories.by/"
            },
            {
              role: "user",
              content: `Find Belarusian manufacturing suppliers for the following product:
                Product: ${searchRequest.productName}
                Description: ${searchRequest.productDescription}
                Quantity needed: ${searchRequest.quantity}
                Budget: ${searchRequest.budget}
                Timeline: ${searchRequest.timeline}
                Additional requirements: ${searchRequest.additionalRequirements}

                IMPORTANT: I need ONLY actual manufacturing companies or B2B suppliers, NOT retail stores like Amazon, Best Buy, or Walmart.

                For each supplier provide ALL of the following details:
                - Company Name: [full company name]
                - Description: [what they manufacture and their specialties]
                - Website: [complete URL starting with http or https]
                - Email: [business contact email]
                - Phone: [international format with country code]
                - Categories: [product categories they specialize in]

                Format each supplier as a numbered list with clear headings for each field.`
            }
          ],
          temperature: 0.2,
          max_tokens: 4096
        });

        const response = completion.choices[0].message.content;
        console.log('DeepSeek API Response:', response);

        //  Add logic here to parse the response and extract supplier information.  
        //  This will depend on the format of the response from the DeepSeek API.
        //  For now, we'll assume a simple array of supplier objects.

        // Parse the response from DeepSeek to extract suppliers
        try {
          // Try to extract supplier information from the response
          // This is a simple pattern-matching approach - adjust based on actual response format
          const textResponse = response || '';

          // Look for patterns like "Name: Company Name", "Email: email@example.com", etc.
          const apiSuppliers: Supplier[] = [];

          // Try different approaches to extract suppliers from the API response

          // First, try to extract sections that look like supplier information
          // Split by numbers at the beginning of the line or double newlines
          const supplierSections = textResponse.split(/\n\d+\.\s+|\n\n+/);

          console.log(`Found ${supplierSections?.length || 0} potential supplier sections`);

          // Always include Tenderoptima as a test supplier
          apiSuppliers.push({
            id: -999,
            userId: searchRequest.userId,
            name: "Tenderoptima",
            description: "Belarusian procurement and supplier management company",
            website: "https://tenderoptima.by",
            email: "request@tenderoptima.by",
            phone: "+375 17 123 4567",
            categories: [searchRequest.productName, "procurement", "Belarus"],
            responseRate: 95,
            totalRequests: 100,
            successfulMatches: 95,
            keywordStrength: null,
            lastResponseTime: null
          });

          // If we can't extract specific suppliers, create a general supplier with useful info
          if (!supplierSections || supplierSections.length === 0) {
            // Create a single "API Results" supplier with the full response
            const apiSupplier = {
              id: -1000, // Use negative ID to avoid conflicts with database IDs
              userId: searchRequest.userId,
              name: `${searchRequest.productName} Supplier Options`,
              description: textResponse.substring(0, 500) + (textResponse.length > 500 ? '...' : ''),
              website: "https://supplier-finder.example.com",
              email: "contact@supplier-finder.example.com",
              phone: "+1-555-FIND-SUPPLIER",
              categories: [searchRequest.productName, ...searchRequest.productName.split(' ')],
              responseRate: 100,
              totalRequests: 10,
              successfulMatches: 10,
              keywordStrength: null,
              lastResponseTime: null
            };

            apiSuppliers.push(apiSupplier);
          } else {
            // Process each section to extract supplier information
            supplierSections.forEach((section, index) => {
              // Skip if section is too short
              if (!section || section.length < 30) return;

              // Extract titles and headers - combine various patterns that might indicate supplier names
              const titleMatch = section.match(/\*\*([^*]+)\*\*/);
              const titleMatch2 = section.match(/^([A-Z][^.,\n]*?)(?:\s*[-–—]\s*|\s*:\s*|\n)/m);
              const headerMatch = section.match(/^#{1,3}\s*([^\n]+)/m);

              const name = (titleMatch?.[1] || titleMatch2?.[1] || headerMatch?.[1] || `Supplier Option ${index + 1}`).trim();
              const description = section.replace(/\*\*([^*]+)\*\*/g, '$1').trim().substring(0, 300);

              // Extract contact info when available, otherwise use placeholders
              const websiteMatch = 
                section.match(/(?:Website|URL|Web):\s*(https?:\/\/[^\s,\n]+)/i) || 
                section.match(/(?:Website|URL|Web):\s*([^\n]+)/i) ||
                section.match(/(https?:\/\/[^\s,\n]+)/);

              const emailMatch = 
                section.match(/(?:Email|E-mail|Contact):\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i) || 
                section.match(/(?:Email|E-mail|Contact):\s*([^\n]+)/i) ||
                section.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/);

              const phoneMatch = 
                section.match(/(?:Phone|Tel|Telephone):\s*(\+\d[\d\s-]{7,})/i) ||
                section.match(/(?:Phone|Tel|Telephone):\s*([^\n]+)/i) ||
                section.match(/(\+\d[\d\s-]{7,})/);

              const website = websiteMatch?.[1]?.trim() || 'https://supplier-finder.example.com';
              const email = emailMatch?.[1]?.trim() || 'contact@supplier-finder.example.com';
              const phone = phoneMatch?.[1]?.trim() || '+1-555-SUPPLIER';

              // Extract or generate relevant categories
              const knownCategories = ['electronics', 'headphones', 'audio', 'manufacturing'];
              const productKeywords = searchRequest.productName.split(/\s+/);
              const descKeywords = searchRequest.productDescription.split(/\s+/);

              // Extract categories using various patterns
              const extractedCategories = [
                ...(section.match(/(?:categor(?:y|ies)|products|specialt(?:y|ies)):\s*([^\n]+)/i)?.[1]?.split(/[,;]/) || []),
                ...(section.match(/(?:offers|provides|specializes in):\s*([^\n]+)/i)?.[1]?.split(/[,;]/) || []),
                ...productKeywords,
                ...descKeywords
              ].map(cat => cat?.trim()).filter(Boolean);

              // Deduplicate and clean categories
              const categories = Array.from(new Set([
                ...extractedCategories,
                ...knownCategories
              ])).filter(cat => cat.length > 2).slice(0, 10);

              // Create a supplier object
              apiSuppliers.push({
                id: -1000 - index, // Use negative IDs to avoid conflicts with database IDs
                userId: searchRequest.userId,
                name,
                description,
                website,
                email,
                phone,
                categories,
                responseRate: Math.floor(Math.random() * 30) + 70, // Generate random high response rate
                totalRequests: Math.floor(Math.random() * 20) + 5,
                successfulMatches: Math.floor(Math.random() * 10) + 2,
                keywordStrength: null,
                lastResponseTime: null
              });
            });
          }

          console.log('Extracted API suppliers:', apiSuppliers.length);

          // Add extracted suppliers to our list
          if (apiSuppliers.length > 0) {
            suppliers = [...suppliers, ...apiSuppliers];
          }
        } catch (parseError) {
          console.error('Error parsing DeepSeek response:', parseError);
        }


      } catch (error) {
        console.error('DeepSeek API error:', error);
      }
    }

    // Normalize search terms
    const searchTerms = [
      searchRequest.productName,
      searchRequest.productDescription,
      searchRequest.additionalRequirements || ''
    ]
      .filter(Boolean)
      .map(term => term.toLowerCase())
      .join(' ');

    console.log('Search terms:', searchTerms);

    // Create array of individual words for matching (filter out short words)
    const searchWords = searchTerms
      .split(/\s+/)
      .filter(word => word.length > 2);

    console.log('Search words:', searchWords);

    // Generate morphological variations for each search word
    const expandedSearchWords: Set<string> = new Set();
    searchWords.forEach(word => {
      const variations = this.normalizeRussianWord(word);
      variations.forEach(variation => expandedSearchWords.add(variation));
    });

    const expandedSearchArray = Array.from(expandedSearchWords);
    console.log('Expanded search words with morphology:', expandedSearchArray);

    // Match each supplier by looking for search words in their data
    const matches = await Promise.all(suppliers.map(async (supplier) => {
      // Combine all supplier text data for searching
      const supplierText = [
        supplier.name,
        supplier.description,
        ...supplier.categories
      ]
        .join(' ')
        .toLowerCase();

      let score = 0;
      const matchedTerms: string[] = [];
      const matchDetails: Record<string, any> = {};

      // Check each expanded search word (including morphological variations)
      expandedSearchArray.forEach(word => {
        if (supplierText.includes(word)) {
          // Higher score for longer words (more specific)
          const wordScore = 0.2 + (word.length > 5 ? 0.1 : 0);
          score += wordScore;
          matchedTerms.push(word);
          
          // Add debug info for morphological matches
          if (!searchWords.includes(word)) {
            matchDetails.morphologicalMatch = true;
            console.log(`Morphological match found: "${word}" in supplier "${supplier.name}"`);
          }
        }
      });

      // Extra points for exact category matches (with morphological analysis)
      supplier.categories.forEach(category => {
        const lowerCategory = category.toLowerCase();

        // Check for exact match in search terms
        if (searchTerms.includes(lowerCategory)) {
          score += 0.5;
          matchedTerms.push(category);
          matchDetails.exactCategoryMatch = true;
        }
        // Check for morphological matches in categories
        else if (expandedSearchArray.some(word => lowerCategory.includes(word))) {
          score += 0.4; // High score for morphological category match
          matchedTerms.push(category);
          matchDetails.morphologicalCategoryMatch = true;
          console.log(`Morphological category match: "${lowerCategory}" contains search variations`);
        }
        // Check for partial match in original search terms
        else if (searchWords.some(word => lowerCategory.includes(word))) {
          score += 0.3;
          matchedTerms.push(category);
          matchDetails.partialCategoryMatch = true;
        }
      });

      // НОВОЕ ПРАВИЛО: Проверка ключевых слов из одобренных поисковых запросов
      try {
        const supplierKeywords = await this.getKeywordsForSupplier(supplier.id);
        const originalQuery = searchRequest.productName.toLowerCase().trim();
        
        if (supplierKeywords.length > 0) {
          console.log(`Supplier "${supplier.name}" has ${supplierKeywords.length} keywords:`, supplierKeywords);
          
          // Проверяем точное совпадение с исходным запросом
          if (supplierKeywords.some(kw => kw.toLowerCase().trim() === originalQuery)) {
            score += 2.0; // Значительный бонус за прямое совпадение с одобренным запросом
            matchedTerms.push(`keyword:${originalQuery}`);
            matchDetails.keywordMatch = true;
            matchDetails.matchedKeyword = originalQuery;
            console.log(`🎯 KEYWORD MATCH: "${originalQuery}" found in approved keywords for supplier "${supplier.name}" (+2.0 bonus)`);
          }
          
          // Проверяем частичное совпадение с ключевыми словами
          else if (supplierKeywords.some(kw => {
            const lowerKw = kw.toLowerCase().trim();
            return lowerKw.includes(originalQuery) || originalQuery.includes(lowerKw);
          })) {
            score += 1.0; // Бонус за частичное совпадение
            matchedTerms.push(`partial-keyword:${originalQuery}`);
            matchDetails.partialKeywordMatch = true;
            console.log(`🔍 PARTIAL KEYWORD MATCH: "${originalQuery}" partially matches approved keywords for supplier "${supplier.name}" (+1.0 bonus)`);
          }
        }
      } catch (error) {
        console.error(`Error checking keywords for supplier ${supplier.id}:`, error);
      }

      // Bonus points for suppliers with good response rates
      if (supplier.responseRate) {
        const responseBonus = supplier.responseRate > 80 ? 0.3 : 
                             supplier.responseRate > 60 ? 0.2 : 
                             supplier.responseRate > 40 ? 0.1 : 0;
        score += responseBonus;

        if (responseBonus > 0) {
          matchDetails.highResponseRate = true;
          matchDetails.responseRate = supplier.responseRate;
        }
      }

      // Prefer suppliers with successful matches history
      if (supplier.successfulMatches && supplier.totalRequests) {
        const successRate = supplier.successfulMatches / supplier.totalRequests;
        const successBonus = successRate > 0.8 ? 0.2 : 
                           successRate > 0.6 ? 0.1 : 0;
        score += successBonus;

        if (successBonus > 0) {
          matchDetails.highSuccessRate = true;
          matchDetails.successRate = Math.round(successRate * 100) + '%';
        }
      }

      // Results logging
      console.log(`Supplier "${supplier.name}": score ${score.toFixed(2)}, matched terms: ${matchedTerms.join(', ')}`);

      return {
        ...supplier,
        matchScore: parseFloat(score.toFixed(2)),
        matchDetails: { 
          matchedTerms,
          ...matchDetails
        }
      };
    }));

    // Filter non-matching suppliers and sort by score
    const filteredMatches = matches
      .filter(match => match.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    console.log(`Found ${filteredMatches.length} matches out of ${suppliers.length} suppliers`);

    return filteredMatches;
  }
}

export const matchingService = new MatchingService();

const validateSupplier = (supplier: any) => {
  return supplier && supplier.name && typeof supplier.name === 'string';
};