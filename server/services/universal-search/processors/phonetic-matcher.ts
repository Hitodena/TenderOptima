export class PhoneticMatcher {
  
  // Основной метод фонетического поиска
  match(query: string, text: string, threshold: number = 0.7): number {
    const queryPhonetic = this.getPhoneticCode(query);
    const textPhonetic = this.getPhoneticCode(text);
    
    if (queryPhonetic === textPhonetic) {
      return 1.0;
    }
    
    // Поиск по словам
    const queryWords = query.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\s+/);
    
    let bestScore = 0;
    
    for (const queryWord of queryWords) {
      const queryWordPhonetic = this.getPhoneticCode(queryWord);
      
      for (const textWord of textWords) {
        const textWordPhonetic = this.getPhoneticCode(textWord);
        const score = this.comparePhoneticCodes(queryWordPhonetic, textWordPhonetic);
        bestScore = Math.max(bestScore, score);
      }
    }
    
    return bestScore >= threshold ? bestScore : 0;
  }

  // Получение фонетического кода (адаптированный Soundex для русского языка)
  private getPhoneticCode(word: string): string {
    if (!word) return '';
    
    const normalized = word.toLowerCase().trim();
    
    // Проверяем язык
    if (/[\u0400-\u04FF]/.test(normalized)) {
      return this.russianPhonetic(normalized);
    } else {
      return this.englishSoundex(normalized);
    }
  }

  // Русский фонетический алгоритм
  private russianPhonetic(word: string): string {
    let code = word;
    
    // Замены похожих звуков
    const phoneticReplacements: { [key: string]: string } = {
      // Парные согласные по глухости/звонкости
      'б': 'п', 'в': 'ф', 'г': 'к', 'д': 'т', 'ж': 'ш', 'з': 'с',
      // Похожие гласные
      'е': 'и', 'я': 'а', 'ё': 'о', 'ю': 'у',
      // Редукция гласных
      'о': 'а', // в безударной позиции
      // Мягкий знак и твердый знак
      'ь': '', 'ъ': '',
      // Йотированные
      'й': 'и'
    };

    // Применяем замены
    for (const [from, to] of Object.entries(phoneticReplacements)) {
      code = code.replace(new RegExp(from, 'g'), to);
    }

    // Удаляем повторяющиеся буквы
    code = code.replace(/(.)\1+/g, '$1');
    
    // Убираем гласные кроме первой буквы
    if (code.length > 1) {
      const firstChar = code[0];
      const rest = code.slice(1).replace(/[аиуэыаоуыэяёюе]/g, '');
      code = firstChar + rest;
    }
    
    return code.substring(0, 6); // Ограничиваем длину
  }

  // Английский Soundex
  private englishSoundex(word: string): string {
    if (!word) return '';
    
    let soundex = word[0].toUpperCase();
    let code = '';
    
    const soundexMap: { [key: string]: string } = {
      'b': '1', 'f': '1', 'p': '1', 'v': '1',
      'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
      'd': '3', 't': '3',
      'l': '4',
      'm': '5', 'n': '5',
      'r': '6'
    };

    for (let i = 1; i < word.length; i++) {
      const char = word[i].toLowerCase();
      const soundexCode = soundexMap[char];
      
      if (soundexCode && soundexCode !== code.slice(-1)) {
        code += soundexCode;
      }
    }

    // Дополняем нулями или обрезаем до 4 символов
    return (soundex + code + '000').substring(0, 4);
  }

  // Сравнение фонетических кодов
  private comparePhoneticCodes(code1: string, code2: string): number {
    if (code1 === code2) return 1.0;
    if (!code1 || !code2) return 0.0;
    
    const maxLength = Math.max(code1.length, code2.length);
    let matches = 0;
    
    for (let i = 0; i < maxLength; i++) {
      if (code1[i] === code2[i]) {
        matches++;
      }
    }
    
    return matches / maxLength;
  }

  // Метафонический алгоритм для более точного фонетического поиска
  private metaphone(word: string): string {
    if (!word) return '';
    
    let metaphone = '';
    const input = word.toUpperCase();
    let current = 0;
    
    // Пропускаем начальные сочетания
    if (input.startsWith('PN') || input.startsWith('KN') || input.startsWith('GN')) {
      current = 1;
    }
    
    if (input.startsWith('WR')) {
      current = 1;
    }
    
    if (input.startsWith('X')) {
      metaphone = 'S';
      current = 1;
    }
    
    while (current < input.length && metaphone.length < 4) {
      const char = input[current];
      
      switch (char) {
        case 'A': case 'E': case 'I': case 'O': case 'U': case 'Y':
          if (current === 0) metaphone += char;
          break;
        case 'B':
          metaphone += 'B';
          if (current + 1 < input.length && input[current + 1] === 'B') current++;
          break;
        case 'C':
          if (current > 0 && input[current - 1] === 'S' && 
              (input[current + 1] === 'I' || input[current + 1] === 'E')) {
            // Skip
          } else if (input[current + 1] === 'H') {
            metaphone += 'X';
            current++;
          } else if (input[current + 1] === 'I' || input[current + 1] === 'E') {
            metaphone += 'S';
          } else {
            metaphone += 'K';
          }
          break;
        case 'D':
          if (input[current + 1] === 'G' && 
              (input[current + 2] === 'E' || input[current + 2] === 'I')) {
            metaphone += 'J';
            current += 2;
          } else {
            metaphone += 'T';
          }
          break;
        case 'G':
          if (input[current + 1] === 'H') {
            if (current === 0 || this.isVowel(input[current - 1])) {
              metaphone += 'G';
            }
            current++;
          } else if (input[current + 1] === 'N') {
            if (current + 1 === input.length - 1 || 
                (current + 2 < input.length && input[current + 2] !== 'E' && input[current + 2] !== 'I')) {
              metaphone += 'K';
            }
            current++;
          } else if (input[current + 1] === 'E' || input[current + 1] === 'I') {
            metaphone += 'J';
          } else {
            metaphone += 'K';
          }
          break;
        case 'H':
          if (this.isVowel(input[current + 1]) && 
              (current === 0 || this.isVowel(input[current - 1]))) {
            metaphone += 'H';
          }
          break;
        case 'F': case 'J': case 'L': case 'M': case 'N': case 'R':
          metaphone += char;
          break;
        case 'K':
          if (current === 0 || input[current - 1] !== 'C') {
            metaphone += 'K';
          }
          break;
        case 'P':
          if (input[current + 1] === 'H') {
            metaphone += 'F';
            current++;
          } else {
            metaphone += 'P';
          }
          break;
        case 'Q':
          metaphone += 'K';
          break;
        case 'S':
          if (input[current + 1] === 'H') {
            metaphone += 'X';
            current++;
          } else if (input[current + 1] === 'I' && 
                     (input[current + 2] === 'O' || input[current + 2] === 'A')) {
            metaphone += 'X';
            current += 2;
          } else {
            metaphone += 'S';
          }
          break;
        case 'T':
          if (input[current + 1] === 'H') {
            metaphone += '0';
            current++;
          } else if (input[current + 1] === 'I' && 
                     (input[current + 2] === 'O' || input[current + 2] === 'A')) {
            metaphone += 'X';
            current += 2;
          } else {
            metaphone += 'T';
          }
          break;
        case 'V':
          metaphone += 'F';
          break;
        case 'W':
          if (this.isVowel(input[current + 1])) {
            metaphone += 'W';
          }
          break;
        case 'X':
          metaphone += 'KS';
          break;
        case 'Z':
          metaphone += 'S';
          break;
      }
      
      current++;
    }
    
    return metaphone;
  }

  private isVowel(char: string): boolean {
    return 'AEIOU'.includes(char);
  }

  // Расширенный фонетический поиск
  phoneticSearch(query: string, candidates: string[], options: {
    threshold?: number;
    limit?: number;
    includeScore?: boolean;
  } = {}): any[] {
    const threshold = options.threshold || 0.7;
    const limit = options.limit || 10;
    const includeScore = options.includeScore || false;

    const results = candidates
      .map(candidate => ({
        text: candidate,
        score: this.match(query, candidate, threshold)
      }))
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return includeScore ? results : results.map(result => result.text);
  }
}