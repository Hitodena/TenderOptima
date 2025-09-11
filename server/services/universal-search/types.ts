export interface SearchConfig {
  fuzzyThreshold: number;
  maxResults: number;
  enablePhonetic: boolean;
  enableMorphology: boolean;
  enableSynonyms: boolean;
  languages: Language[];
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  strategies?: string[];
  includeStats?: boolean;
}

export interface SearchResult {
  item: any;
  score: number;
  matchType: MatchType;
  matchedTerm: string;
  strategy: string;
  priority: number;
  details?: SearchResultDetails;
}

export interface SearchResultDetails {
  explanation?: string;
  matchedFields?: string[];
  confidence?: number;
  alternatives?: string[];
}

export interface NormalizedQuery {
  original: string;
  normalized: string;
  entities: Entity[];
  language: Language;
  variations: string[];
}

export interface Entity {
  type: EntityType;
  value: string;
  expanded: string;
  confidence?: number;
}

export interface SearchStrategy {
  name: string;
  priority: number;
  execute: (query: NormalizedQuery, data: any[]) => Promise<SearchResult[]>;
}

export type Language = 'ru' | 'en' | 'de' | 'unknown';

export type EntityType = 'abbreviation' | 'number' | 'unit' | 'category' | 'brand' | 'model';

export type MatchType = 
  | 'exact'
  | 'morphological' 
  | 'synonym'
  | 'fuzzy'
  | 'phonetic'
  | 'semantic'
  | 'partial'
  | 'transliteration';

// Интерфейсы для словарей
export interface SynonymDictionary {
  [term: string]: string[];
}

export interface AbbreviationDictionary {
  [abbr: string]: string;
}

export interface MorphologyRule {
  lemma: string;
  forms: string[];
  pos: PartOfSpeech; // Part of Speech
}

export type PartOfSpeech = 'noun' | 'adjective' | 'verb' | 'adverb' | 'other';

// Конфигурация по умолчанию
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  fuzzyThreshold: 0.6,
  maxResults: 50,
  enablePhonetic: true,
  enableMorphology: true,
  enableSynonyms: true,
  languages: ['ru', 'en', 'de']
};

// Весовые коэффициенты для разных типов поиска
export const MATCH_WEIGHTS: { [key in MatchType]: number } = {
  exact: 1.0,
  morphological: 0.95,
  synonym: 0.9,
  transliteration: 0.85,
  fuzzy: 0.8,
  phonetic: 0.75,
  semantic: 0.7,
  partial: 0.6
};

// Приоритеты стратегий поиска
export const STRATEGY_PRIORITIES: { [strategy: string]: number } = {
  exact_match: 100,
  morphological: 80,
  synonym: 60,
  fuzzy: 40,
  semantic: 20
};