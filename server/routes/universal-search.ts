import { Router } from 'express';
import { UniversalSearchEngine } from '../services/universal-search/core/search-engine';
import { defaultConfig, getConfigForUserType, getAdaptiveConfig } from '../services/universal-search/config/search-config';
import { storage } from '../storage';
import { requireAuth } from '../middleware/requireAuth';
import { subscriptionService } from '../subscription';

const router = Router();

// Инициализация поискового движка
const searchEngine = new UniversalSearchEngine(defaultConfig);

// POST /api/universal-search - Универсальный поиск поставщиков
router.post('/', requireAuth, async (req, res) => {
  try {
    const { query, options = {}, userType = 'beginner' } = req.body;
    const userId = req.user?.id;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Отсутствует поисковый запрос',
        message: 'Параметр query обязателен'
      });
    }

    // Check subscription status (no counter increment for search)
    if (userId) {
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(userId);
      if (!subscriptionStatus.isActive) {
        console.log(`[Universal Search] User ${userId} subscription is not active: ${subscriptionStatus.message}`);
        return res.status(403).json({ 
          error: 'Подписка неактивна', 
          message: subscriptionStatus.message 
        });
      }

      console.log(`[Universal Search] Subscription active for user ${userId} - performing search`);
    }

    console.log('[Universal Search] Processing query:', query);
    console.log('[Universal Search] Options:', options);

    // Получаем всех поставщиков из базы данных
    const allSuppliers = await storage.getAllSuppliers();
    console.log('[Universal Search] Found suppliers in database:', allSuppliers.length);

    if (allSuppliers.length === 0) {
      return res.json({
        results: [],
        stats: {
          totalResults: 0,
          processingTime: 0,
          strategiesUsed: {},
          query: query
        },
        message: 'База данных поставщиков пуста'
      });
    }

    // Выбираем конфигурацию поиска
    const searchConfig = getConfigForUserType(userType);
    const adaptiveConfig = getAdaptiveConfig(allSuppliers.length);
    const finalConfig = { ...searchConfig, ...adaptiveConfig, ...options };
    
    searchEngine.configure(finalConfig);

    // Выполняем поиск
    const startTime = Date.now();
    const searchResults = await searchEngine.search(query, allSuppliers, {
      limit: finalConfig.maxResults,
      threshold: finalConfig.fuzzyThreshold,
      includeStats: true
    });
    const processingTime = Date.now() - startTime;

    console.log('[Universal Search] Found results:', searchResults.length);
    console.log('[Universal Search] Processing time:', processingTime, 'ms');

    // Преобразуем результаты в формат, совместимый с существующей системой
    const formattedResults = searchResults.map(result => ({
      ...result.item,
      matchScore: result.score,
      matchDetails: {
        matchType: result.matchType,
        matchedTerm: result.matchedTerm,
        strategy: result.strategy,
        priority: result.priority,
        explanation: `Найдено через ${getStrategyName(result.strategy)} (совпадение: ${Math.round(result.score * 100)}%)`
      }
    }));

    // Статистика поиска
    const stats = {
      totalResults: searchResults.length,
      processingTime,
      strategiesUsed: getStrategyStats(searchResults),
      averageScore: searchResults.length > 0 
        ? searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length 
        : 0,
      query: query,
      config: finalConfig
    };

    res.json({
      results: formattedResults,
      stats,
      message: searchResults.length > 0 
        ? `Найдено ${searchResults.length} поставщиков` 
        : 'Поставщики не найдены'
    });

  } catch (error) {
    console.error('[Universal Search] Error:', error);
    res.status(500).json({
      error: 'Ошибка универсального поиска',
      message: error.message,
      results: []
    });
  }
});

// GET /api/universal-search/config - Получение конфигурации поиска
router.get('/config', requireAuth, async (req, res) => {
  try {
    const { userType = 'beginner', industry } = req.query;
    
    let config = getConfigForUserType(userType as string);
    
    if (industry) {
      const { getConfigForIndustry } = await import('../services/universal-search/config/search-config');
      config = getConfigForIndustry(industry as string);
    }

    res.json({
      config,
      availableUserTypes: ['beginner', 'expert', 'trial', 'premium'],
      availableIndustries: ['industrial', 'medical', 'it', 'construction', 'food']
    });
  } catch (error) {
    console.error('[Universal Search Config] Error:', error);
    res.status(500).json({
      error: 'Ошибка получения конфигурации',
      message: error.message
    });
  }
});

// POST /api/universal-search/suggestions - Получение предложений для автодополнения
router.post('/suggestions', requireAuth, async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    // Получаем все уникальные термины из базы поставщиков
    const allSuppliers = await storage.getAllSuppliers();
    const terms = new Set<string>();
    
    allSuppliers.forEach(supplier => {
      // Добавляем названия компаний
      if (supplier.name) {
        const words = supplier.name.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length >= 3 && word.includes(query.toLowerCase())) {
            terms.add(word);
          }
        });
      }
      
      // Добавляем категории
      if (supplier.categories && Array.isArray(supplier.categories)) {
        supplier.categories.forEach(category => {
          if (category.toLowerCase().includes(query.toLowerCase())) {
            terms.add(category);
          }
        });
      }
      
      // Добавляем ключевые слова из описания
      if (supplier.description) {
        const words = supplier.description.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length >= 3 && word.includes(query.toLowerCase())) {
            terms.add(word.replace(/[^\w\u0400-\u04FF]/g, ''));
          }
        });
      }
    });

    const suggestions = Array.from(terms)
      .filter(term => term.length >= 3)
      .sort((a, b) => {
        // Приоритет: начинающиеся с запроса
        const aStarts = a.startsWith(query.toLowerCase()) ? 0 : 1;
        const bStarts = b.startsWith(query.toLowerCase()) ? 0 : 1;
        
        if (aStarts !== bStarts) return aStarts - bStarts;
        
        // Затем по длине
        return a.length - b.length;
      })
      .slice(0, limit);

    res.json({ suggestions });
  } catch (error) {
    console.error('[Universal Search Suggestions] Error:', error);
    res.status(500).json({
      error: 'Ошибка получения предложений',
      message: error.message,
      suggestions: []
    });
  }
});

// POST /api/universal-search/analyze - Анализ поискового запроса
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Отсутствует поисковый запрос'
      });
    }

    const { QueryProcessor } = await import('../services/universal-search/core/query-processor');
    const { Transliteration } = await import('../services/universal-search/processors/transliteration');
    
    const queryProcessor = new QueryProcessor();
    const transliteration = new Transliteration();
    
    const normalizedQuery = queryProcessor.normalize(query);
    const entities = queryProcessor.extractEntities(query);
    const variations = queryProcessor.generateVariations(query);
    const translitSuggestions = transliteration.suggestTransliteration(query);

    res.json({
      original: query,
      normalized: normalizedQuery,
      entities,
      variations,
      transliteration: translitSuggestions,
      analysis: {
        language: normalizedQuery.language,
        wordCount: query.split(/\s+/).length,
        hasSpecialChars: /[^\w\s\u0400-\u04FF]/.test(query),
        hasCyrillic: /[\u0400-\u04FF]/.test(query),
        hasLatin: /[a-zA-Z]/.test(query),
        hasNumbers: /\d/.test(query)
      }
    });
  } catch (error) {
    console.error('[Universal Search Analyze] Error:', error);
    res.status(500).json({
      error: 'Ошибка анализа запроса',
      message: error.message
    });
  }
});

// Вспомогательные функции
function getStrategyName(strategy: string): string {
  const names: { [key: string]: string } = {
    'exact_match': 'точное совпадение',
    'morphological': 'морфологический анализ',
    'synonym': 'поиск по синонимам',
    'fuzzy': 'нечеткий поиск',
    'phonetic': 'фонетический поиск',
    'semantic': 'семантический поиск'
  };
  return names[strategy] || strategy;
}

function getStrategyStats(results: any[]): { [strategy: string]: number } {
  const stats: { [strategy: string]: number } = {};
  results.forEach(result => {
    const strategy = result.strategy || 'unknown';
    stats[strategy] = (stats[strategy] || 0) + 1;
  });
  return stats;
}

export default router;