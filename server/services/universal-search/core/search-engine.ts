import { QueryProcessor } from './query-processor';
import { ResultRanker } from './result-ranker';
import { LinguisticProcessor } from '../processors/linguistic-processor';
import { FuzzyMatcher } from '../processors/fuzzy-matcher';
import { PhoneticMatcher } from '../processors/phonetic-matcher';
import { Transliteration } from '../processors/transliteration';
import { SearchConfig, SearchOptions, SearchResult, SearchStrategy, NormalizedQuery } from '../types';

export class UniversalSearchEngine {
  private queryProcessor: QueryProcessor;
  private resultRanker: ResultRanker;
  private linguisticProcessor: LinguisticProcessor;
  private fuzzyMatcher: FuzzyMatcher;
  private phoneticMatcher: PhoneticMatcher;
  private transliteration: Transliteration;
  private strategies: SearchStrategy[] = [];
  private config: SearchConfig;

  constructor(config: SearchConfig) {
    this.config = config;
    this.queryProcessor = new QueryProcessor();
    this.resultRanker = new ResultRanker();
    this.linguisticProcessor = new LinguisticProcessor();
    this.fuzzyMatcher = new FuzzyMatcher();
    this.phoneticMatcher = new PhoneticMatcher();
    this.transliteration = new Transliteration();
    
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies(): void {
    // Уровень 1: Точное совпадение
    this.addSearchStrategy({
      name: 'exact_match',
      priority: 100,
      execute: async (query: NormalizedQuery, data: any[]) => {
        return this.exactMatch(query, data);
      }
    });

    // Уровень 2: Морфологический поиск
    this.addSearchStrategy({
      name: 'morphological',
      priority: 80,
      execute: async (query: NormalizedQuery, data: any[]) => {
        return this.morphologicalSearch(query, data);
      }
    });

    // Уровень 3: Синонимический поиск
    this.addSearchStrategy({
      name: 'synonym',
      priority: 60,
      execute: async (query: NormalizedQuery, data: any[]) => {
        return this.synonymSearch(query, data);
      }
    });

    // Уровень 4: Нечеткий поиск
    this.addSearchStrategy({
      name: 'fuzzy',
      priority: 40,
      execute: async (query: NormalizedQuery, data: any[]) => {
        return this.fuzzySearch(query, data);
      }
    });

    // Уровень 5: Семантический поиск
    this.addSearchStrategy({
      name: 'semantic',
      priority: 20,
      execute: async (query: NormalizedQuery, data: any[]) => {
        return this.semanticSearch(query, data);
      }
    });
  }

  async search(query: string, data: any[], options?: SearchOptions): Promise<SearchResult[]> {
    try {
      // Нормализация запроса
      const normalizedQuery = this.queryProcessor.normalize(query);
      
      // Определение языка
      const detectedLanguage = this.queryProcessor.detectLanguage(query);
      normalizedQuery.language = detectedLanguage;

      // Генерация вариаций запроса
      const variations = this.queryProcessor.generateVariations(query);
      normalizedQuery.variations = variations;

      // Выполнение поиска по всем стратегиям
      const results: SearchResult[] = [];
      
      for (const strategy of this.strategies.sort((a, b) => b.priority - a.priority)) {
        try {
          const strategyResults = await strategy.execute(normalizedQuery, data);
          
          // Добавляем информацию о стратегии к результатам
          strategyResults.forEach(result => {
            result.strategy = strategy.name;
            result.priority = strategy.priority;
          });
          
          results.push(...strategyResults);
        } catch (error) {
          console.warn(`Search strategy ${strategy.name} failed:`, error);
        }
      }

      // Ранжирование и дедупликация результатов
      const rankedResults = this.resultRanker.rank(results, normalizedQuery, options);
      
      return rankedResults;
    } catch (error) {
      console.error('Universal search failed:', error);
      return [];
    }
  }

  addSearchStrategy(strategy: SearchStrategy): void {
    this.strategies.push(strategy);
  }

  configure(config: SearchConfig): void {
    this.config = { ...this.config, ...config };
  }

  private async exactMatch(query: NormalizedQuery, data: any[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const searchTerms = [query.original, query.normalized, ...query.variations];

    for (const item of data) {
      const searchableText = this.getSearchableText(item).toLowerCase();
      let bestScore = 0;
      let bestTerm = '';
      
      for (const term of searchTerms) {
        const lowerTerm = term.toLowerCase();
        
        // Точное совпадение слова
        const wordBoundaryMatch = new RegExp(`\\b${lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(searchableText);
        if (wordBoundaryMatch) {
          bestScore = 1.0;
          bestTerm = term;
          break;
        }
        
        // Совпадение подстроки
        if (searchableText.includes(lowerTerm)) {
          const score = lowerTerm.length / searchableText.length + 0.5; // Бонус за точное включение
          if (score > bestScore) {
            bestScore = score;
            bestTerm = term;
          }
        }
      }

      if (bestScore > 0) {
        results.push({
          item,
          score: bestScore,
          matchType: 'exact',
          matchedTerm: bestTerm,
          strategy: 'exact_match',
          priority: 100
        });
      }
    }

    return results;
  }

  private async morphologicalSearch(query: NormalizedQuery, data: any[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const lemmatizedTerms = this.linguisticProcessor.lemmatize(query.normalized);

    if (lemmatizedTerms.length === 0) return results;

    for (const item of data) {
      const searchableText = this.getSearchableText(item);
      const itemLemmas = this.linguisticProcessor.lemmatize(searchableText);
      
      let totalMatches = 0;
      const matchedLemmas: string[] = [];
      
      for (const queryLemma of lemmatizedTerms) {
        for (const itemLemma of itemLemmas) {
          // Точное совпадение лемм
          if (queryLemma === itemLemma) {
            totalMatches += 1.0;
            matchedLemmas.push(queryLemma);
            break;
          }
          // Частичное совпадение (один содержит другой)
          else if (queryLemma.length >= 3 && itemLemma.length >= 3) {
            if (queryLemma.includes(itemLemma) || itemLemma.includes(queryLemma)) {
              totalMatches += 0.7; // Частичное совпадение
              matchedLemmas.push(`${queryLemma}~${itemLemma}`);
              break;
            }
          }
        }
      }

      if (totalMatches > 0) {
        const score = Math.min(totalMatches / lemmatizedTerms.length, 1.0);
        results.push({
          item,
          score,
          matchType: 'morphological',
          matchedTerm: matchedLemmas.join(', '),
          strategy: 'morphological',
          priority: 80
        });
      }
    }

    return results;
  }

  private async synonymSearch(query: NormalizedQuery, data: any[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryWords = query.normalized.toLowerCase().split(/\s+/);
    
    for (const item of data) {
      const searchableText = this.getSearchableText(item).toLowerCase();
      let totalScore = 0;
      const matchedSynonyms: string[] = [];
      
      for (const word of queryWords) {
        const synonyms = this.linguisticProcessor.getSynonyms(word);
        
        for (const synonym of synonyms) {
          const synonymLower = synonym.toLowerCase();
          
          // Проверяем точное совпадение слова
          const wordMatch = new RegExp(`\\b${synonymLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(searchableText);
          if (wordMatch) {
            totalScore += 0.9; // Высокий балл за точное совпадение синонима
            matchedSynonyms.push(synonym);
            break;
          }
          // Проверяем частичное совпадение
          else if (searchableText.includes(synonymLower)) {
            totalScore += 0.6; // Средний балл за частичное совпадение
            matchedSynonyms.push(synonym);
            break;
          }
        }
      }

      if (totalScore > 0) {
        const finalScore = Math.min(totalScore / queryWords.length, 1.0);
        results.push({
          item,
          score: finalScore,
          matchType: 'synonym',
          matchedTerm: matchedSynonyms.join(', '),
          strategy: 'synonym',
          priority: 60
        });
      }
    }

    return results;
  }

  private async fuzzySearch(query: NormalizedQuery, data: any[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const item of data) {
      const searchableText = this.getSearchableText(item);
      const fuzzyScore = this.fuzzyMatcher.match(query.normalized, searchableText);

      if (fuzzyScore >= this.config.fuzzyThreshold) {
        results.push({
          item,
          score: fuzzyScore,
          matchType: 'fuzzy',
          matchedTerm: query.normalized,
          strategy: 'fuzzy',
          priority: 40
        });
      }
    }

    return results;
  }

  private async semanticSearch(query: NormalizedQuery, data: any[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    // Упрощенный семантический поиск по категориям
    
    for (const item of data) {
      if (item.categories && Array.isArray(item.categories)) {
        const categoryMatch = item.categories.some((category: string) =>
          this.linguisticProcessor.isSemanticMatch(query.normalized, category)
        );

        if (categoryMatch) {
          results.push({
            item,
            score: 0.6,
            matchType: 'semantic',
            matchedTerm: query.normalized,
            strategy: 'semantic',
            priority: 20
          });
        }
      }
    }

    return results;
  }

  private getSearchableText(item: any): string {
    const texts: string[] = [];
    
    // Основные поля поставщика
    if (item.name) texts.push(item.name);
    if (item.description) texts.push(item.description);
    if (item.website) texts.push(item.website);
    if (item.email) texts.push(item.email);
    
    // Категории товаров
    if (item.categories && Array.isArray(item.categories)) {
      texts.push(...item.categories);
    }
    
    // Дополнительные поля для поиска
    if (item.phone) texts.push(item.phone);
    if (item.address) texts.push(item.address);
    if (item.services) texts.push(item.services);
    if (item.products) texts.push(item.products);
    
    return texts.join(' ').toLowerCase();
  }
}