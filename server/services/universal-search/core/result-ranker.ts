import { SearchResult, NormalizedQuery, SearchOptions } from '../types';

export class ResultRanker {
  
  rank(results: SearchResult[], query: NormalizedQuery, options?: SearchOptions): SearchResult[] {
    // Дедупликация по ID элемента
    const uniqueResults = this.deduplicateResults(results);
    
    // Сортировка по комбинированному скору
    const sortedResults = uniqueResults.sort((a, b) => {
      const scoreA = this.calculateFinalScore(a, query);
      const scoreB = this.calculateFinalScore(b, query);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // По убыванию скора
      }
      
      // При равном скоре - по приоритету стратегии
      return b.priority - a.priority;
    });

    // Применяем лимиты если указаны
    const limit = options?.limit || 50;
    return sortedResults.slice(0, limit);
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Map<any, SearchResult>();
    
    for (const result of results) {
      const itemId = this.getItemId(result.item);
      const existing = seen.get(itemId);
      
      if (!existing || this.calculateFinalScore(result, {} as NormalizedQuery) > 
          this.calculateFinalScore(existing, {} as NormalizedQuery)) {
        seen.set(itemId, result);
      }
    }
    
    return Array.from(seen.values());
  }

  private getItemId(item: any): any {
    // Пытаемся найти уникальный идентификатор
    return item.id || item._id || item.email || item.name || JSON.stringify(item);
  }

  private calculateFinalScore(result: SearchResult, query: NormalizedQuery): number {
    let score = result.score;
    
    // Бонус за стратегию поиска
    const strategyBonus = this.getStrategyBonus(result.strategy);
    score *= strategyBonus;
    
    // Бонус за тип совпадения
    const matchTypeBonus = this.getMatchTypeBonus(result.matchType);
    score *= matchTypeBonus;
    
    // Бонус за длину совпадения
    if (result.matchedTerm && query.original) {
      const lengthBonus = this.getLengthBonus(result.matchedTerm, query.original);
      score *= lengthBonus;
    }
    
    // Приоритет стратегии (нормализован к 0-1)
    const priorityWeight = result.priority / 100;
    score *= (0.8 + 0.2 * priorityWeight); // 80% базовый вес + 20% от приоритета
    
    return Math.min(score, 1.0); // Ограничиваем максимальным скором
  }

  private getStrategyBonus(strategy: string): number {
    const bonuses: { [key: string]: number } = {
      'exact_match': 1.0,
      'morphological': 0.95,
      'synonym': 0.9,
      'fuzzy': 0.8,
      'semantic': 0.7
    };
    
    return bonuses[strategy] || 0.5;
  }

  private getMatchTypeBonus(matchType: string): number {
    const bonuses: { [key: string]: number } = {
      'exact': 1.0,
      'morphological': 0.95,
      'synonym': 0.9,
      'fuzzy': 0.8,
      'phonetic': 0.75,
      'semantic': 0.7,
      'partial': 0.6
    };
    
    return bonuses[matchType] || 0.5;
  }

  private getLengthBonus(matchedTerm: string, originalQuery: string): number {
    if (!matchedTerm || !originalQuery) return 1.0;
    
    const matchLength = matchedTerm.length;
    const queryLength = originalQuery.length;
    
    // Бонус за совпадение длины (предпочитаем полные совпадения)
    const lengthRatio = Math.min(matchLength, queryLength) / Math.max(matchLength, queryLength);
    return 0.8 + 0.2 * lengthRatio;
  }

  // Группировка результатов по категориям для лучшего представления
  groupByCategory(results: SearchResult[]): { [category: string]: SearchResult[] } {
    const grouped: { [category: string]: SearchResult[] } = {};
    
    for (const result of results) {
      const category = this.getResultCategory(result);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(result);
    }
    
    return grouped;
  }

  private getResultCategory(result: SearchResult): string {
    if (result.item.categories && Array.isArray(result.item.categories) && result.item.categories.length > 0) {
      return result.item.categories[0];
    }
    
    return result.strategy || 'other';
  }

  // Статистика поиска
  getSearchStats(results: SearchResult[]): {
    totalResults: number;
    strategiesUsed: { [strategy: string]: number };
    averageScore: number;
    matchTypes: { [type: string]: number };
  } {
    const stats = {
      totalResults: results.length,
      strategiesUsed: {} as { [strategy: string]: number },
      averageScore: 0,
      matchTypes: {} as { [type: string]: number }
    };

    let totalScore = 0;

    for (const result of results) {
      // Подсчет стратегий
      if (result.strategy) {
        stats.strategiesUsed[result.strategy] = (stats.strategiesUsed[result.strategy] || 0) + 1;
      }

      // Подсчет типов совпадений
      if (result.matchType) {
        stats.matchTypes[result.matchType] = (stats.matchTypes[result.matchType] || 0) + 1;
      }

      totalScore += result.score;
    }

    stats.averageScore = results.length > 0 ? totalScore / results.length : 0;

    return stats;
  }
}