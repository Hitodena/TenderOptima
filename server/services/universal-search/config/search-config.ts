import { SearchConfig, DEFAULT_SEARCH_CONFIG } from '../types';

// Конфигурация по умолчанию
export const defaultConfig: SearchConfig = {
  ...DEFAULT_SEARCH_CONFIG,
  fuzzyThreshold: 0.6,        // Минимальный порог для нечеткого поиска
  maxResults: 50,             // Максимальное количество результатов
  enablePhonetic: true,       // Включить фонетический поиск
  enableMorphology: true,     // Включить морфологическую обработку
  enableSynonyms: true,       // Включить поиск по синонимам
  languages: ['ru', 'en', 'de'] // Поддерживаемые языки
};

// Конфигурация для быстрого поиска (меньше точности, больше скорости)
export const fastSearchConfig: SearchConfig = {
  fuzzyThreshold: 0.7,
  maxResults: 20,
  enablePhonetic: false,
  enableMorphology: true,
  enableSynonyms: true,
  languages: ['ru', 'en']
};

// Конфигурация для точного поиска (больше точности, меньше скорости)
export const preciseSearchConfig: SearchConfig = {
  fuzzyThreshold: 0.5,
  maxResults: 100,
  enablePhonetic: true,
  enableMorphology: true,
  enableSynonyms: true,
  languages: ['ru', 'en', 'de']
};

// Конфигурация для многоязычного поиска
export const multilingualConfig: SearchConfig = {
  fuzzyThreshold: 0.6,
  maxResults: 75,
  enablePhonetic: true,
  enableMorphology: true,
  enableSynonyms: true,
  languages: ['ru', 'en', 'de']
};

// Пороговые значения для различных типов поиска
export const searchThresholds = {
  exact: 1.0,           // Точное совпадение
  morphological: 0.9,   // Морфологическое совпадение
  synonym: 0.8,         // Совпадение по синонимам
  transliteration: 0.85, // Транслитерация
  fuzzy: 0.6,           // Нечеткое совпадение
  phonetic: 0.7,        // Фонетическое совпадение
  semantic: 0.5         // Семантическое совпадение
};

// Веса для различных полей при поиске
export const fieldWeights = {
  name: 1.0,            // Название компании - максимальный вес
  description: 0.8,     // Описание
  categories: 0.9,      // Категории
  email: 0.6,           // Email
  phone: 0.4,           // Телефон
  website: 0.5,         // Веб-сайт
  address: 0.3          // Адрес
};

// Конфигурация для различных индустрий
export const industryConfigs = {
  // Промышленность - акцент на технические термины
  industrial: {
    ...defaultConfig,
    fuzzyThreshold: 0.7,
    enablePhonetic: true,
    maxResults: 30
  },
  
  // Медицина - точный поиск, важна терминология
  medical: {
    ...defaultConfig,
    fuzzyThreshold: 0.8,
    enableMorphology: true,
    enableSynonyms: true,
    maxResults: 25
  },
  
  // IT - много англицизмов и аббревиатур
  it: {
    ...defaultConfig,
    fuzzyThreshold: 0.6,
    enablePhonetic: false,
    languages: ['en', 'ru'],
    maxResults: 40
  },
  
  // Строительство - много материалов и стандартов
  construction: {
    ...defaultConfig,
    fuzzyThreshold: 0.65,
    enableSynonyms: true,
    maxResults: 35
  },
  
  // Продукты питания - важны стандарты качества
  food: {
    ...defaultConfig,
    fuzzyThreshold: 0.75,
    enableMorphology: true,
    maxResults: 30
  }
};

// Конфигурация для различных типов пользователей
export const userTypeConfigs = {
  // Новый пользователь - простой поиск
  beginner: {
    ...fastSearchConfig,
    maxResults: 15
  },
  
  // Опытный пользователь - полный функционал
  expert: {
    ...preciseSearchConfig,
    maxResults: 100
  },
  
  // Пробная версия - ограниченный функционал
  trial: {
    ...fastSearchConfig,
    maxResults: 10,
    enablePhonetic: false
  },
  
  // Премиум пользователь - максимальный функционал
  premium: {
    ...preciseSearchConfig,
    maxResults: 200,
    fuzzyThreshold: 0.4
  }
};

// Адаптивная конфигурация на основе размера базы данных
export function getAdaptiveConfig(databaseSize: number): SearchConfig {
  if (databaseSize < 1000) {
    // Маленькая база - можем позволить более точный поиск
    return {
      ...preciseSearchConfig,
      fuzzyThreshold: 0.4,
      maxResults: Math.min(databaseSize, 100)
    };
  } else if (databaseSize < 10000) {
    // Средняя база - сбалансированный подход
    return {
      ...defaultConfig,
      maxResults: Math.min(databaseSize / 10, 50)
    };
  } else {
    // Большая база - приоритет скорости
    return {
      ...fastSearchConfig,
      maxResults: 25
    };
  }
}

// Настройка тайм-аутов для различных операций
export const timeouts = {
  exact: 100,           // мс - точный поиск
  morphological: 300,   // мс - морфологический анализ
  synonym: 200,         // мс - поиск синонимов
  fuzzy: 500,           // мс - нечеткий поиск
  phonetic: 400,        // мс - фонетический поиск
  semantic: 600,        // мс - семантический анализ
  total: 2000          // мс - общий тайм-аут поиска
};

// Кэширование результатов
export const cacheConfig = {
  enabled: true,
  maxSize: 1000,        // Максимальное количество кэшированных запросов
  ttl: 300000,          // Время жизни кэша в миллисекундах (5 минут)
  cleanupInterval: 60000 // Интервал очистки устаревших записей (1 минута)
};

// Логирование и отладка
export const debugConfig = {
  enabled: process.env.NODE_ENV === 'development',
  logLevel: 'info',     // 'debug', 'info', 'warn', 'error'
  logQueries: true,     // Логировать все поисковые запросы
  logResults: false,    // Логировать результаты поиска
  logPerformance: true, // Логировать метрики производительности
  maxLogEntries: 1000   // Максимальное количество записей в логе
};

// Экспорт функций для получения конфигураций
export function getConfigForIndustry(industry: string): SearchConfig {
  return industryConfigs[industry] || defaultConfig;
}

export function getConfigForUserType(userType: string): SearchConfig {
  return userTypeConfigs[userType] || defaultConfig;
}

export function createCustomConfig(overrides: Partial<SearchConfig>): SearchConfig {
  return { ...defaultConfig, ...overrides };
}