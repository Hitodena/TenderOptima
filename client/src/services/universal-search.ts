// Universal Search Service for Frontend Integration
interface UniversalSearchOptions {
  limit?: number;
  threshold?: number;
  strategies?: string[];
  includeStats?: boolean;
  userType?: 'beginner' | 'expert' | 'trial' | 'premium';
}

interface SearchResult {
  id: number;
  name: string;
  email: string;
  description?: string;
  categories?: string[];
  matchScore: number;
  matchDetails: {
    matchType: string;
    matchedTerm: string;
    strategy: string;
    priority: number;
    explanation: string;
  };
}

interface SearchResponse {
  results: SearchResult[];
  stats: {
    totalResults: number;
    processingTime: number;
    strategiesUsed: { [strategy: string]: number };
    averageScore: number;
    query: string;
  };
  message: string;
}

interface SearchSuggestion {
  suggestions: string[];
}

interface QueryAnalysis {
  original: string;
  normalized: any;
  entities: any[];
  variations: string[];
  transliteration: any;
  analysis: {
    language: string;
    wordCount: number;
    hasSpecialChars: boolean;
    hasCyrillic: boolean;
    hasLatin: boolean;
    hasNumbers: boolean;
  };
}

class UniversalSearchService {
  private baseURL = '/api/universal-search';

  async search(query: string, options: UniversalSearchOptions = {}): Promise<SearchResponse> {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ query, options })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Universal Search] Error:', error);
      throw error;
    }
  }

  async getSuggestions(query: string, limit: number = 5): Promise<SearchSuggestion> {
    try {
      const response = await fetch(`${this.baseURL}/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ query, limit })
      });

      if (!response.ok) {
        return { suggestions: [] };
      }

      return await response.json();
    } catch (error) {
      console.error('[Universal Search Suggestions] Error:', error);
      return { suggestions: [] };
    }
  }

  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    try {
      const response = await fetch(`${this.baseURL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Universal Search Analysis] Error:', error);
      throw error;
    }
  }

  async getConfig(userType: string = 'beginner', industry?: string) {
    try {
      const params = new URLSearchParams({ userType });
      if (industry) params.set('industry', industry);

      const response = await fetch(`${this.baseURL}/config?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Universal Search Config] Error:', error);
      throw error;
    }
  }

  // Интеграция с существующей системой поиска
  async searchWithFallback(query: string, options: UniversalSearchOptions = {}): Promise<SearchResult[]> {
    try {
      // Сначала пробуем универсальный поиск
      const universalResults = await this.search(query, options);
      if (universalResults.results.length > 0) {
        console.log('[Universal Search] Found results via universal search:', universalResults.results.length);
        return universalResults.results;
      }

      // Если не найдено, возвращаем пустой массив
      console.log('[Universal Search] No results found');
      return [];
    } catch (error) {
      console.error('[Universal Search] Fallback error:', error);
      // В случае ошибки возвращаем пустой массив
      return [];
    }
  }

  // Форматирование результатов для совместимости с существующим интерфейсом
  formatForExistingUI(results: SearchResult[]): any[] {
    return results.map(result => ({
      id: result.id,
      name: result.name,
      email: result.email,
      description: result.description || '',
      categories: result.categories || [],
      // Дополнительные поля для совместимости
      website: '',
      phone: '',
      address: '',
      // Информация о поиске
      _searchScore: result.matchScore,
      _searchExplanation: result.matchDetails.explanation,
      _searchStrategy: result.matchDetails.strategy
    }));
  }

  // Получение объяснения результатов поиска
  getSearchExplanation(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'Поставщики не найдены';
    }

    const strategies = new Set(results.map(r => r.matchDetails.strategy));
    const strategyNames: { [key: string]: string } = {
      'exact_match': 'точному совпадению',
      'morphological': 'морфологическому анализу',
      'synonym': 'поиску по синонимам',
      'fuzzy': 'нечеткому поиску',
      'phonetic': 'фонетическому поиску',
      'semantic': 'семантическому поиску'
    };

    const usedStrategies = Array.from(strategies)
      .map(s => strategyNames[s] || s)
      .join(', ');

    return `Найдено ${results.length} поставщиков по ${usedStrategies}`;
  }

  // Дебаунс для поиска в реальном времени
  private searchTimeout: NodeJS.Timeout | null = null;

  searchWithDebounce(
    query: string, 
    callback: (results: SearchResult[]) => void, 
    delay: number = 300,
    options: UniversalSearchOptions = {}
  ): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(async () => {
      try {
        const results = await this.searchWithFallback(query, options);
        callback(results);
      } catch (error) {
        console.error('[Universal Search Debounce] Error:', error);
        callback([]);
      }
    }, delay);
  }
}

// Экспорт singleton instance
export const universalSearchService = new UniversalSearchService();
export type { SearchResult, UniversalSearchOptions, SearchResponse, QueryAnalysis };