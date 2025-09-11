import { synonyms } from '../dictionaries/synonyms';
import { morphology } from '../dictionaries/morphology';

export class LinguisticProcessor {
  
  // Улучшенная лемматизация с расширенными правилами
  lemmatize(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const lemmas: string[] = [];

    for (const word of words) {
      const cleanWord = word.replace(/[^\wа-яё]/gi, ''); // Убираем знаки препинания
      if (cleanWord.length < 2) continue; // Пропускаем слишком короткие слова
      
      const lemma = this.getLemma(cleanWord);
      if (lemma && lemma.length >= 2) {
        lemmas.push(lemma);
      }
    }

    return [...new Set(lemmas)]; // Убираем дубликаты
  }

  private getLemma(word: string): string {
    // Поиск в морфологическом словаре
    for (const rule of morphology) {
      if (rule.forms.includes(word)) {
        return rule.lemma;
      }
    }

    // Расширенные правила для русского языка
    const russianRules = [
      // Множественное число существительных (порядок важен!)
      { pattern: /ами$/, replacement: 'а' }, // столами -> стол
      { pattern: /ями$/, replacement: 'я' }, // свиньями -> свинья
      { pattern: /ов$/, replacement: '' },    // столов -> стол
      { pattern: /ев$/, replacement: '' },    // ножей -> нож
      { pattern: /ей$/, replacement: '' },    // людей -> люд
      { pattern: /ы$/, replacement: '' },     // столы -> стол
      { pattern: /и$/, replacement: '' },     // ножи -> нож
      
      // Родительный падеж
      { pattern: /ах$/, replacement: 'а' },   // в столах -> стол
      { pattern: /ях$/, replacement: 'я' },   // в тетрадях -> тетрадь
      { pattern: /ом$/, replacement: '' },    // столом -> стол
      { pattern: /ем$/, replacement: '' },    // ножем -> нож
      
      // Прилагательные
      { pattern: /ого$/, replacement: 'ый' }, // красного -> красный
      { pattern: /его$/, replacement: 'ий' }, // синего -> синий
      { pattern: /ой$/, replacement: 'ый' },  // красной -> красный
      { pattern: /ей$/, replacement: 'ий' },  // синей -> синий
      { pattern: /ые$/, replacement: 'ый' },  // красные -> красный
      { pattern: /ие$/, replacement: 'ий' },  // синие -> синий
      { pattern: /ая$/, replacement: 'ый' },  // красная -> красный
      { pattern: /яя$/, replacement: 'ий' },  // синяя -> синий
      { pattern: /ое$/, replacement: 'ый' },  // красное -> красный
      { pattern: /ее$/, replacement: 'ий' },  // синее -> синий
      
      // Уменьшительные и увеличительные суффиксы
      { pattern: /очка$/, replacement: 'а' }, // сумочка -> сума
      { pattern: /ечка$/, replacement: 'а' }, // чашечка -> чаша
      { pattern: /ишка$/, replacement: 'а' }, // домишка -> дом
      { pattern: /ушка$/, replacement: 'а' }, // избушка -> изба
      { pattern: /ик$/, replacement: '' },    // столик -> стол
      { pattern: /ок$/, replacement: '' },    // листок -> лист
      { pattern: /ек$/, replacement: '' },    // человек -> человек
      { pattern: /ка$/, replacement: '' },    // ручка -> руч
      
      // Глагольные формы
      { pattern: /ать$/, replacement: 'ать' }, // делать -> делать
      { pattern: /ить$/, replacement: 'ить' }, // говорить -> говорить
      { pattern: /еть$/, replacement: 'еть' }, // смотреть -> смотреть
      { pattern: /ют$/, replacement: 'ать' },  // делают -> делать
      { pattern: /ят$/, replacement: 'ить' },  // говорят -> говорить
      { pattern: /ет$/, replacement: 'ать' },  // делает -> делать
      { pattern: /ит$/, replacement: 'ить' },  // говорит -> говорить
      
      // Наречия
      { pattern: /но$/, replacement: 'ный' },  // красиво -> красивный
      { pattern: /ло$/, replacement: 'лый' }   // тепло -> теплый
    ];

    // Применяем правила в порядке убывания длины окончания
    const sortedRules = russianRules.sort((a, b) => 
      b.pattern.source.length - a.pattern.source.length
    );

    for (const rule of sortedRules) {
      if (rule.pattern.test(word)) {
        const lemma = word.replace(rule.pattern, rule.replacement);
        if (lemma.length >= 2) { // Минимальная длина корня
          return lemma;
        }
      }
    }

    // Упрощенные правила для английского языка
    const englishRules = [
      { pattern: /ies$/, replacement: 'y' },   // companies -> company
      { pattern: /ves$/, replacement: 'f' },   // knives -> knife
      { pattern: /ses$/, replacement: 's' },   // glasses -> glass
      { pattern: /ches$/, replacement: 'ch' }, // watches -> watch
      { pattern: /shes$/, replacement: 'sh' }, // dishes -> dish
      { pattern: /xes$/, replacement: 'x' },   // boxes -> box
      { pattern: /oes$/, replacement: 'o' },   // heroes -> hero
      { pattern: /s$/, replacement: '' },      // cats -> cat
      { pattern: /ed$/, replacement: '' },     // played -> play
      { pattern: /ing$/, replacement: '' },    // playing -> play
      { pattern: /ly$/, replacement: '' },     // quickly -> quick
      { pattern: /tion$/, replacement: '' },
      { pattern: /sion$/, replacement: '' }
    ];

    if (!/[\u0400-\u04FF]/.test(word)) { // Если не содержит кириллицу
      for (const rule of englishRules) {
        if (rule.pattern.test(word)) {
          const lemma = word.replace(rule.pattern, rule.replacement);
          if (lemma.length >= 3) {
            return lemma;
          }
        }
      }
    }

    return word; // Возвращаем исходное слово если не нашли правило
  }

  // Получение синонимов
  getSynonyms(term: string): string[] {
    const normalizedTerm = term.toLowerCase().trim();
    const allSynonyms = new Set<string>();

    // Прямой поиск
    if (synonyms[normalizedTerm]) {
      synonyms[normalizedTerm].forEach(synonym => allSynonyms.add(synonym));
    }

    // Поиск по словам в термине
    const words = normalizedTerm.split(/\s+/);
    for (const word of words) {
      if (synonyms[word]) {
        synonyms[word].forEach(synonym => allSynonyms.add(synonym));
      }
    }

    // Обратный поиск - если термин является синонимом
    Object.entries(synonyms).forEach(([key, values]) => {
      if (values.includes(normalizedTerm)) {
        allSynonyms.add(key);
        values.forEach(synonym => allSynonyms.add(synonym));
      }
    });

    // Удаляем исходный термин из результатов
    allSynonyms.delete(normalizedTerm);

    return Array.from(allSynonyms);
  }

  // Семантическое сопоставление
  isSemanticMatch(query: string, text: string): boolean {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\s+/);

    // Прямое вхождение
    for (const queryWord of queryWords) {
      if (textWords.some(textWord => textWord.includes(queryWord) || queryWord.includes(textWord))) {
        return true;
      }
    }

    // Поиск через синонимы
    for (const queryWord of queryWords) {
      const synonymsForWord = this.getSynonyms(queryWord);
      for (const synonym of synonymsForWord) {
        if (textWords.some(textWord => textWord.includes(synonym) || synonym.includes(textWord))) {
          return true;
        }
      }
    }

    // Поиск через лемматизацию
    const queryLemmas = this.lemmatize(query);
    const textLemmas = this.lemmatize(text);

    for (const queryLemma of queryLemmas) {
      if (textLemmas.some(textLemma => textLemma.includes(queryLemma) || queryLemma.includes(textLemma))) {
        return true;
      }
    }

    return false;
  }

  // Определение категории товара по тексту
  categorizeProduct(text: string): string[] {
    const categories: string[] = [];
    const normalizedText = text.toLowerCase();

    const categoryKeywords = {
      'безопасность': ['перчатки', 'защита', 'сиз', 'безопасность', 'каска', 'очки', 'респиратор'],
      'одежда': ['рубашка', 'куртка', 'брюки', 'костюм', 'форма', 'униформа'],
      'инструменты': ['молоток', 'отвертка', 'ключ', 'дрель', 'пила', 'инструмент'],
      'электроника': ['компьютер', 'телефон', 'кабель', 'провод', 'электроника', 'техника'],
      'материалы': ['металл', 'пластик', 'дерево', 'стекло', 'бумага', 'картон'],
      'химия': ['краска', 'клей', 'растворитель', 'кислота', 'химикат', 'реагент'],
      'продукты': ['еда', 'продукты', 'мясо', 'молоко', 'хлеб', 'овощи', 'фрукты']
    };

    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      if (keywords.some(keyword => normalizedText.includes(keyword))) {
        categories.push(category);
      }
    });

    return categories.length > 0 ? categories : ['прочее'];
  }

  // Извлечение ключевых терминов
  extractKeyTerms(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const keyTerms: string[] = [];

    // Фильтруем стоп-слова
    const stopWords = ['и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'из', 'или', 'но', 'а', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
    
    words.forEach(word => {
      if (word.length >= 3 && !stopWords.includes(word)) {
        keyTerms.push(word);
      }
    });

    // Удаляем дубликаты и сортируем по длине (длинные слова важнее)
    return [...new Set(keyTerms)].sort((a, b) => b.length - a.length);
  }

  // Нормализация текста для поиска
  normalizeForSearch(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ') // Удаляем спецсимволы, оставляем кириллицу
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Оценка релевантности текста запросу
  calculateRelevance(query: string, text: string): number {
    const queryTerms = this.extractKeyTerms(query);
    const textTerms = this.extractKeyTerms(text);
    
    if (queryTerms.length === 0) return 0;

    let matches = 0;
    let totalWeight = 0;

    queryTerms.forEach((queryTerm, index) => {
      const weight = 1 / (index + 1); // Первые термины важнее
      totalWeight += weight;

      // Прямое совпадение
      if (textTerms.includes(queryTerm)) {
        matches += weight;
        return;
      }

      // Частичное совпадение
      if (textTerms.some(textTerm => textTerm.includes(queryTerm) || queryTerm.includes(textTerm))) {
        matches += weight * 0.8;
        return;
      }

      // Совпадение через синонимы
      const synonymsForTerm = this.getSynonyms(queryTerm);
      if (synonymsForTerm.some(synonym => textTerms.includes(synonym))) {
        matches += weight * 0.6;
        return;
      }

      // Совпадение через лемматизацию
      const queryLemma = this.getLemma(queryTerm);
      if (textTerms.some(textTerm => this.getLemma(textTerm) === queryLemma)) {
        matches += weight * 0.7;
      }
    });

    return totalWeight > 0 ? matches / totalWeight : 0;
  }
}