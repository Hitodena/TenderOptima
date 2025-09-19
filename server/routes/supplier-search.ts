import { Router } from 'express';
import { spawn } from 'child_process';
import { db } from '../db';
import { suppliers } from '@shared/schema';
import { subscriptionService } from '../subscription';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

interface SearchResult {
  user_id: string;
  query: string;
  domain: string;
  description: string;
  engine: string;
  emails: string[];
  phones: string[];
  dateOfSearch: string;
}

/**
 * POST /api/supplier-search
 * Unified supplier search using a dedicated Python microservice
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { query, queries, sources, maxResults = 50, regions = ["ru"], language = "ru" } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      console.log('[SupplierSearch] No authenticated user found');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Поддерживаем как старый формат (query), так и новый (queries)
    let searchQueries: string[];
    if (queries && Array.isArray(queries)) {
      searchQueries = queries.filter(q => typeof q === 'string' && q.trim());
    } else if (query && typeof query === 'string') {
      // Разбиваем одну строку на отдельные ключевые слова
      searchQueries = query.split(',').map(q => q.trim()).filter(q => q.length > 0);
    } else {
      return res.status(400).json({ error: 'Search queries are required. Provide either "query" string or "queries" array' });
    }
    
    if (searchQueries.length === 0) {
      return res.status(400).json({ error: 'At least one valid search query is required' });
    }
    
    console.log(`[SupplierSearch] Request params:`, { searchQueries, sources, maxResults, regions, language, userId });

    console.log(`[SupplierSearch] Starting parallel search for ${searchQueries.length} queries: [${searchQueries.map(q => `"${q}"`).join(', ')}] with ${maxResults} max results each`);

    // 1. Проверка подписки
    const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(userId);
    if (!subscriptionStatus.isActive) {
      console.log(`[SupplierSearch] User ${userId} subscription is not active: ${subscriptionStatus.message}`);
      return res.status(403).json({ 
        error: 'Subscription not active', 
        message: subscriptionStatus.message 
      });
    }
    console.log(`[SupplierSearch] Subscription active for user ${userId} - performing search`);

    // 2. Параллельный вызов Python парсера для каждого ключевого слова
    try {
      console.log(`[SupplierSearch] Starting parallel searches for ${searchQueries.length} queries`);
      
      // Создаем массив промисов для параллельного выполнения
      const searchPromises = searchQueries.map(async (singleQuery, index) => {
        console.log(`[SupplierSearch] Starting search ${index + 1}/${searchQueries.length} for: "${singleQuery}"`);
        try {
          const results = await callPythonParser(singleQuery, maxResults, userId.toString(), regions, sources);
          console.log(`[SupplierSearch] Query "${singleQuery}" returned ${results.length} results`);
          return results;
        } catch (error) {
          console.error(`[SupplierSearch] Query "${singleQuery}" failed:`, error);
          return []; // Возвращаем пустой массив вместо падения всего процесса
        }
      });
      
      // Ждем завершения всех поисков параллельно
      const allSearchResults = await Promise.all(searchPromises);
      
      // Объединяем все результаты в один массив
      const allSuppliers = allSearchResults.flat().filter(Boolean);
      console.log(`[SupplierSearch] Combined ${allSuppliers.length} total results from all queries`);
      
      // Дедупликация по домену
      const uniqueSuppliersMap = new Map<string, SearchResult>();
      for (const supplier of allSuppliers) {
        if (supplier && supplier.domain && !uniqueSuppliersMap.has(supplier.domain)) {
          uniqueSuppliersMap.set(supplier.domain, supplier);
        }
      }
      const uniqueResults = Array.from(uniqueSuppliersMap.values());
      console.log(`[SupplierSearch] After deduplication: ${uniqueResults.length} unique suppliers`);

      if (uniqueResults.length === 0) {
        console.log(`[SupplierSearch] No unique results found for queries: [${searchQueries.join(', ')}]`);
        return res.json({ 
          suppliers: [], 
          message: 'No suppliers found with authentic contact information',
          queriesProcessed: searchQueries.length,
          totalResultsBeforeDedup: allSuppliers.length
        });
      }
      
      const results = uniqueResults;

      // 3. Сохранение результатов в БД (логика осталась прежней)
      const savedSuppliers = await saveSearchResults(results);

      console.log(`[SupplierSearch] Successfully found and saved ${savedSuppliers.length} suppliers`);

      // Create a mock request object for frontend compatibility
      const combinedQuery = searchQueries.join(', ');
      const mockRequest = {
        id: Date.now(),
        userId: userId,
        orderNumber: `MQL-${Date.now().toString().slice(-6)}`, // MQL = Multiple Query Search
        productName: combinedQuery,
        productDescription: `Parallel search across ${searchQueries.length} keywords`,
        quantity: null,
        budget: null,
        timeline: null,
        additionalRequirements: "",
        status: "pending",
        createdAt: new Date().toISOString(),
        matchedSuppliers: savedSuppliers
      };

      // Return response in same format as database search for frontend compatibility
      res.json({ 
        request: mockRequest,
        suppliers: savedSuppliers,
        total: savedSuppliers.length,
        query: combinedQuery,
        queries: searchQueries,
        queriesProcessed: searchQueries.length,
        searchDate: new Date().toISOString(),
        // For frontend compatibility - mimic database search response  
        matchedSuppliers: savedSuppliers,
        totalFound: savedSuppliers.length,
        showingCount: savedSuppliers.length,
        // Дополнительная статистика по многоключевому поиску
        parallelSearchStats: {
          totalQueriesProcessed: searchQueries.length,
          totalResultsBeforeDedup: allSuppliers.length,
          uniqueResultsAfterDedup: savedSuppliers.length,
          deduplicationReduction: allSuppliers.length - savedSuppliers.length
        }
      });

    } catch (pythonError) {
      // Обработка ошибки Python парсера
      const errorMessage = pythonError instanceof Error ? pythonError.message : 'Unknown error';
      console.error(`[SupplierSearch] Python parser failed:`, errorMessage);
      res.status(500).json({ 
        error: 'Search process failed', 
        details: errorMessage || 'Python parser execution failed.'
      });
    }

  } catch (error) {
    console.error(`[SupplierSearch] Request error:`, error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Функция вызова Python парсера
 */
async function callPythonParser(query: string, elements: number, userId: string, regions: any[] = ["ru"], sources: any = {}): Promise<SearchResult[]> {
  return new Promise(async (resolve, reject) => {
    console.log(`[PythonParser] Calling Python parser with query: "${query}"`);
    
    // Извлекаем регион для передачи в Python
    let region = null;
    if (regions && regions.length > 0) {
      const firstRegion = regions[0];
      if (typeof firstRegion === 'string') {
        region = firstRegion; // Frontend передает массив googleCode
      } else if (firstRegion && typeof firstRegion === 'object' && firstRegion.googleCode) {
        region = firstRegion.googleCode; // Объект с googleCode
      }
    }
    
    if (!region) {
      console.error(`[SupplierSearch] No valid region provided:`, regions);
      throw new Error('Region is required for search');
    }
    
    console.log(`[SupplierSearch] Using region code: ${region} for regions:`, regions);
    
    console.log(`[PythonParser] Making HTTP request to FastAPI microservice on port 8080`);
    
    try {
      const requestBody = {
        query,
        elements,
        user_id: userId,
        region,
        sources
      };
      console.log(`[PythonParser] Sending to Python server:`, requestBody);
      
      const response = await fetch('http://localhost:8080/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      const results = data.results || [];
      console.log(`[PythonParser] Successfully received ${results.length} results from FastAPI microservice`);
      resolve(results);
      
    } catch (error) {
      console.error(`[PythonParser] HTTP request failed:`, error);
      reject(new Error(`Failed to communicate with Python FastAPI microservice: ${error.message}`));
    }

  });
}

/**
 * Функция сохранения результатов (остается без изменений)
 */
async function saveSearchResults(results: SearchResult[]): Promise<any[]> {
    const savedSuppliers = [];
    for (const result of results) {
        try {
            const domain = result.domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
            const supplierName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

            const [saved] = await db.insert(suppliers).values({
                name: supplierName,
                email: result.emails && result.emails[0] ? result.emails[0] : '',
                phone: result.phones && result.phones.length > 0 ? result.phones[0] : '',
                website: result.domain,
                description: result.description || '',
                categories: [result.engine],
                userId: parseInt(result.user_id) || null,
            }).returning();

            if (saved) {
                savedSuppliers.push({
                    ...saved,
                    searchEngine: result.engine,
                    allEmails: result.emails,
                    allPhones: result.phones,
                    searchDate: result.dateOfSearch,
                });
            }
        } catch (saveError: any) {
            if (saveError.code === '23505') {
                // Duplicate key error - supplier already exists, return data anyway
                console.log(`[SupplierSearch] Supplier ${result.domain} already exists in database`);
                const domain = result.domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
                const supplierName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
                savedSuppliers.push({
                    name: supplierName,
                    email: result.emails && result.emails[0] ? result.emails[0] : '',
                    phone: result.phones && result.phones.length > 0 ? result.phones[0] : '',
                    website: result.domain,
                    description: result.description || '',
                    categories: [result.engine],
                    searchEngine: result.engine,
                    allEmails: Array.isArray(result.emails) ? result.emails : [],
                    allPhones: Array.isArray(result.phones) ? result.phones : [],
                    searchDate: result.dateOfSearch,
                });
            } else {
                console.error(`[SupplierSearch] Failed to save supplier ${result.domain}:`, saveError);
            }
        }
    }
    return savedSuppliers;
}

export default router;