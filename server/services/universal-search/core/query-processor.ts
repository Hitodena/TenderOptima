import { NormalizedQuery, Entity, Language } from '../types';
import { Transliteration } from '../processors/transliteration';
import { synonyms } from '../dictionaries/synonyms';
import { abbreviations } from '../dictionaries/abbreviations';

export class QueryProcessor {
  private transliteration: Transliteration;

  constructor() {
    this.transliteration = new Transliteration();
  }

  normalize(query: string): NormalizedQuery {
    const cleaned = this.cleanQuery(query);
    const entities = this.extractEntities(cleaned);
    
    return {
      original: query,
      normalized: cleaned,
      entities,
      language: this.detectLanguage(query),
      variations: this.generateVariations(query)
    };
  }

  private cleanQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ') // Удаляем спецсимволы, сохраняем кириллицу
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractEntities(query: string): Entity[] {
    const entities: Entity[] = [];
    const words = query.split(' ');

    // Поиск аббревиатур
    words.forEach(word => {
      const upperWord = word.toUpperCase();
      if (abbreviations[upperWord]) {
        entities.push({
          type: 'abbreviation',
          value: word,
          expanded: abbreviations[upperWord]
        });
      }
    });

    // Поиск числовых значений
    const numberMatches = query.match(/\d+(\.\d+)?/g);
    if (numberMatches) {
      numberMatches.forEach(match => {
        entities.push({
          type: 'number',
          value: match,
          expanded: match
        });
      });
    }

    // Поиск единиц измерения
    const unitMatches = query.match(/\b(кг|г|м|см|мм|л|мл|шт|упак)\b/g);
    if (unitMatches) {
      unitMatches.forEach(match => {
        entities.push({
          type: 'unit',
          value: match,
          expanded: match
        });
      });
    }

    return entities;
  }

  generateVariations(query: string): string[] {
    const variations = new Set<string>([query]);
    
    // Добавляем транслитерацию
    const transliterated = this.transliteration.toTranslit(query);
    if (transliterated !== query) {
      variations.add(transliterated);
    }

    const fromTranslit = this.transliteration.fromTranslit(query);
    if (fromTranslit !== query) {
      variations.add(fromTranslit);
    }

    // Добавляем вариации с раскрытыми аббревиатурами
    const words = query.split(' ');
    const expandedWords = words.map(word => {
      const upperWord = word.toUpperCase();
      return abbreviations[upperWord] || word;
    });
    
    if (expandedWords.join(' ') !== query) {
      variations.add(expandedWords.join(' '));
    }

    // Добавляем синонимы для ключевых слов
    words.forEach(word => {
      const wordSynonyms = synonyms[word.toLowerCase()] || [];
      wordSynonyms.forEach(synonym => {
        const synonymVariation = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
        if (synonymVariation !== query) {
          variations.add(synonymVariation);
        }
      });
    });

    // Добавляем вариации раскладки клавиатуры
    const layoutVariations = this.generateLayoutVariations(query);
    layoutVariations.forEach(variation => variations.add(variation));

    return Array.from(variations);
  }

  detectLanguage(query: string): Language {
    const cyrillicPattern = /[\u0400-\u04FF]/;
    const latinPattern = /[a-zA-Z]/;
    const germanPattern = /[äöüßÄÖÜ]/;

    if (germanPattern.test(query)) {
      return 'de';
    } else if (cyrillicPattern.test(query)) {
      return 'ru';
    } else if (latinPattern.test(query)) {
      return 'en';
    }

    return 'unknown';
  }

  private generateLayoutVariations(query: string): string[] {
    const variations: string[] = [];
    
    // Карта раскладки клавиатуры RU -> EN
    const ruToEn: { [key: string]: string } = {
      'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p',
      'х': '[', 'ъ': ']', 'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k',
      'д': 'l', 'ж': ';', 'э': "'", 'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm',
      'б': ',', 'ю': '.', '.': '/', ',': '?'
    };

    // Карта раскладки клавиатуры EN -> RU
    const enToRu: { [key: string]: string } = {};
    Object.keys(ruToEn).forEach(key => {
      enToRu[ruToEn[key]] = key;
    });

    // Конвертация RU -> EN
    const ruToEnConverted = query.toLowerCase().split('').map(char => ruToEn[char] || char).join('');
    if (ruToEnConverted !== query.toLowerCase()) {
      variations.push(ruToEnConverted);
    }

    // Конвертация EN -> RU
    const enToRuConverted = query.toLowerCase().split('').map(char => enToRu[char] || char).join('');
    if (enToRuConverted !== query.toLowerCase()) {
      variations.push(enToRuConverted);
    }

    return variations;
  }
}