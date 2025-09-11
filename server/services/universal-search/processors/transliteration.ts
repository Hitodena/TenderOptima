export class Transliteration {
  
  private ruToLat: { [key: string]: string } = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };

  private latToRu: { [key: string]: string } = {
    'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е',
    'yo': 'ё', 'zh': 'ж', 'z': 'з', 'i': 'и', 'y': 'й', 'k': 'к',
    'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п', 'r': 'р',
    's': 'с', 't': 'т', 'u': 'у', 'f': 'ф', 'kh': 'х', 'ts': 'ц',
    'ch': 'ч', 'sh': 'ш', 'sch': 'щ', 'yu': 'ю', 'ya': 'я'
  };

  // Дополнительные варианты транслитерации
  private altLatToRu: { [key: string]: string[] } = {
    'c': ['к', 'ц', 'с'],
    'x': ['кс', 'х'],
    'w': ['в', 'у'],
    'q': ['к', 'кв'],
    'j': ['дж', 'й', 'я'],
    'h': ['х', 'г'],
    'ck': ['к'],
    'ph': ['ф'],
    'th': ['т', 'ф'],
    'gh': ['г', 'х']
  };

  // Транслитерация с русского на латиницу
  toTranslit(text: string): string {
    return text.toLowerCase().split('').map(char => {
      return this.ruToLat[char] || char;
    }).join('');
  }

  // Транслитерация с латиницы на русский
  fromTranslit(text: string): string {
    let result = text.toLowerCase();
    
    // Сначала обрабатываем многосимвольные комбинации
    const multiChar = ['sch', 'zh', 'ch', 'sh', 'kh', 'ts', 'yo', 'yu', 'ya', 'ph', 'th', 'gh', 'ck'];
    multiChar.sort((a, b) => b.length - a.length); // Сортируем по убыванию длины
    
    for (const combo of multiChar) {
      if (this.latToRu[combo]) {
        result = result.replace(new RegExp(combo, 'g'), this.latToRu[combo]);
      }
    }
    
    // Затем обрабатываем отдельные символы
    result = result.split('').map(char => {
      return this.latToRu[char] || char;
    }).join('');
    
    return result;
  }

  // Генерация вариантов транслитерации
  generateVariants(text: string): string[] {
    const variants = new Set<string>([text]);
    
    // Добавляем прямую транслитерацию
    const directTranslit = this.toTranslit(text);
    if (directTranslit !== text) {
      variants.add(directTranslit);
    }
    
    const fromTranslit = this.fromTranslit(text);
    if (fromTranslit !== text) {
      variants.add(fromTranslit);
    }
    
    // Генерируем альтернативные варианты для неоднозначных символов
    const alternativeVariants = this.generateAlternatives(text.toLowerCase());
    alternativeVariants.forEach(variant => variants.add(variant));
    
    return Array.from(variants);
  }

  private generateAlternatives(text: string): string[] {
    const variants: string[] = [];
    
    // Обрабатываем каждый символ который может иметь альтернативы
    for (const [lat, ruVariants] of Object.entries(this.altLatToRu)) {
      if (text.includes(lat)) {
        for (const ruVariant of ruVariants) {
          const variant = text.replace(new RegExp(lat, 'g'), ruVariant);
          if (variant !== text) {
            variants.push(variant);
          }
        }
      }
    }
    
    // Специальные случаи для русского языка
    if (/[\u0400-\u04FF]/.test(text)) {
      // Вариации с 'и' и 'ы'
      if (text.includes('и')) {
        variants.push(text.replace(/и/g, 'ы'));
      }
      if (text.includes('ы')) {
        variants.push(text.replace(/ы/g, 'и'));
      }
      
      // Вариации с 'е' и 'э'
      if (text.includes('е')) {
        variants.push(text.replace(/е/g, 'э'));
      }
      if (text.includes('э')) {
        variants.push(text.replace(/э/g, 'е'));
      }
    }
    
    return variants;
  }

  // Определение языка и предложение транслитерации
  suggestTransliteration(text: string): {
    detectedLanguage: 'ru' | 'lat' | 'mixed';
    suggestions: string[];
  } {
    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
    const totalLetters = cyrillicCount + latinCount;
    
    let detectedLanguage: 'ru' | 'lat' | 'mixed';
    
    if (totalLetters === 0) {
      return { detectedLanguage: 'mixed', suggestions: [text] };
    }
    
    const cyrillicRatio = cyrillicCount / totalLetters;
    
    if (cyrillicRatio > 0.8) {
      detectedLanguage = 'ru';
    } else if (cyrillicRatio < 0.2) {
      detectedLanguage = 'lat';
    } else {
      detectedLanguage = 'mixed';
    }
    
    const suggestions = this.generateVariants(text);
    
    return { detectedLanguage, suggestions };
  }

  // Улучшенная транслитерация с учетом контекста
  contextualTranslit(text: string, direction: 'toLat' | 'toRu' = 'toLat'): string {
    if (direction === 'toLat') {
      return this.contextualToLatin(text);
    } else {
      return this.contextualToRussian(text);
    }
  }

  private contextualToLatin(text: string): string {
    let result = text.toLowerCase();
    
    // Специальные правила для начала слов
    result = result.replace(/^е/g, 'ye');
    result = result.replace(/\sе/g, ' ye');
    
    // Специальные правила для йотированных гласных
    result = result.replace(/([аеёиоуыэюя])я/g, '$1ya');
    result = result.replace(/([аеёиоуыэюя])ю/g, '$1yu');
    result = result.replace(/([аеёиоуыэюя])е/g, '$1ye');
    
    // Обычная транслитерация
    result = result.split('').map(char => {
      return this.ruToLat[char] || char;
    }).join('');
    
    return result;
  }

  private contextualToRussian(text: string): string {
    let result = text.toLowerCase();
    
    // Обрабатываем специальные случаи перед основной транслитерацией
    
    // Двойные согласные в английском часто соответствуют одинарным в русском
    result = result.replace(/([bcdfghjklmnpqrstvwxz])\1/g, '$1');
    
    // Английские окончания
    result = result.replace(/tion$/g, 'ция');
    result = result.replace(/sion$/g, 'сия');
    result = result.replace(/ment$/g, 'мент');
    result = result.replace(/ness$/g, 'несс');
    
    // Основная транслитерация
    const multiChar = ['sch', 'tch', 'zh', 'ch', 'sh', 'kh', 'ts', 'yo', 'yu', 'ya', 'ph', 'th', 'gh', 'ck'];
    multiChar.sort((a, b) => b.length - a.length);
    
    for (const combo of multiChar) {
      if (this.latToRu[combo]) {
        result = result.replace(new RegExp(combo, 'g'), this.latToRu[combo]);
      }
    }
    
    result = result.split('').map(char => {
      return this.latToRu[char] || char;
    }).join('');
    
    return result;
  }

  // Проверка качества транслитерации
  evaluateTransliteration(original: string, transliterated: string): {
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 1.0;
    
    // Проверяем сохранение длины (примерно)
    const lengthRatio = transliterated.length / original.length;
    if (lengthRatio < 0.5 || lengthRatio > 2.0) {
      issues.push('Значительное изменение длины текста');
      score -= 0.2;
    }
    
    // Проверяем наличие непереведенных символов
    const untranslatedCyrillic = (transliterated.match(/[\u0400-\u04FF]/g) || []).length;
    const originalCyrillic = (original.match(/[\u0400-\u04FF]/g) || []).length;
    
    if (untranslatedCyrillic > 0 && originalCyrillic > untranslatedCyrillic) {
      issues.push('Остались непереведенные кириллические символы');
      score -= 0.3;
    }
    
    // Проверяем разумность результата
    if (transliterated === original) {
      issues.push('Транслитерация не выполнена');
      score = 0;
    }
    
    return { score, issues };
  }
}