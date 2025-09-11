export class FuzzyMatcher {
  
  // Основной метод нечеткого поиска
  match(query: string, text: string, threshold: number = 0.6): number {
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedText = text.toLowerCase();

    // Прямое включение
    if (normalizedText.includes(normalizedQuery)) {
      return 1.0;
    }

    // Расстояние Левенштейна для коротких строк
    if (normalizedQuery.length <= 20) {
      const distance = this.levenshteinDistance(normalizedQuery, normalizedText);
      const maxLength = Math.max(normalizedQuery.length, normalizedText.length);
      const similarity = 1 - distance / maxLength;
      
      if (similarity >= threshold) {
        return similarity;
      }
    }

    // Поиск по словам
    const queryWords = normalizedQuery.split(/\s+/);
    const textWords = normalizedText.split(/\s+/);
    
    let bestScore = 0;
    
    for (const queryWord of queryWords) {
      let wordBestScore = 0;
      
      for (const textWord of textWords) {
        const score = this.wordSimilarity(queryWord, textWord);
        wordBestScore = Math.max(wordBestScore, score);
      }
      
      bestScore = Math.max(bestScore, wordBestScore);
    }

    return bestScore >= threshold ? bestScore : 0;
  }

  // Расстояние Левенштейна
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Сходство Жаро-Винклера
  private jaroWinklerSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0.0;

    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    if (matchWindow < 0) return 0.0;

    const str1Matches = new Array(len1).fill(false);
    const str2Matches = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Identify matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);

      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    // Identify transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

    // Winkler bonus
    if (jaro < 0.7) return jaro;

    let prefix = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (str1[i] === str2[i]) prefix++;
      else break;
    }

    return jaro + (0.1 * prefix * (1 - jaro));
  }

  // Сходство отдельных слов
  private wordSimilarity(word1: string, word2: string): number {
    if (word1 === word2) return 1.0;
    if (word1.length === 0 || word2.length === 0) return 0.0;

    // Прямое включение
    if (word1.includes(word2) || word2.includes(word1)) {
      const minLength = Math.min(word1.length, word2.length);
      const maxLength = Math.max(word1.length, word2.length);
      return minLength / maxLength;
    }

    // Жаро-Винклер для коротких слов
    if (word1.length <= 10 && word2.length <= 10) {
      return this.jaroWinklerSimilarity(word1, word2);
    }

    // N-граммы для длинных слов
    return this.nGramSimilarity(word1, word2, 2);
  }

  // Сходство по N-граммам
  private nGramSimilarity(str1: string, str2: string, n: number = 2): number {
    const ngrams1 = this.getNGrams(str1, n);
    const ngrams2 = this.getNGrams(str2, n);

    if (ngrams1.size === 0 && ngrams2.size === 0) return 1.0;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0.0;

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return intersection.size / union.size;
  }

  // Генерация N-грамм
  private getNGrams(str: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    
    if (str.length < n) {
      ngrams.add(str);
      return ngrams;
    }

    for (let i = 0; i <= str.length - n; i++) {
      ngrams.add(str.substring(i, i + n));
    }

    return ngrams;
  }

  // Поиск с учетом опечаток в клавиатуре
  keyboardTypoSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (Math.abs(str1.length - str2.length) > 2) return 0.0;

    // Карта соседних клавиш
    const keyboardMap: { [key: string]: string[] } = {
      'q': ['w', 'a'], 'w': ['q', 'e', 's'], 'e': ['w', 'r', 'd'],
      'r': ['e', 't', 'f'], 't': ['r', 'y', 'g'], 'y': ['t', 'u', 'h'],
      'u': ['y', 'i', 'j'], 'i': ['u', 'o', 'k'], 'o': ['i', 'p', 'l'],
      'p': ['o', 'l'], 'a': ['q', 's', 'z'], 's': ['a', 'w', 'd', 'x'],
      'd': ['s', 'e', 'f', 'c'], 'f': ['d', 'r', 'g', 'v'], 'g': ['f', 't', 'h', 'b'],
      'h': ['g', 'y', 'j', 'n'], 'j': ['h', 'u', 'k', 'm'], 'k': ['j', 'i', 'l'],
      'l': ['k', 'o', 'p'], 'z': ['a', 's', 'x'], 'x': ['z', 's', 'd', 'c'],
      'c': ['x', 'd', 'f', 'v'], 'v': ['c', 'f', 'g', 'b'], 'b': ['v', 'g', 'h', 'n'],
      'n': ['b', 'h', 'j', 'm'], 'm': ['n', 'j', 'k']
    };

    let typoScore = 0;
    const maxLength = Math.max(str1.length, str2.length);

    for (let i = 0; i < maxLength; i++) {
      const char1 = str1[i] || '';
      const char2 = str2[i] || '';

      if (char1 === char2) {
        typoScore += 1;
      } else if (keyboardMap[char1] && keyboardMap[char1].includes(char2)) {
        typoScore += 0.8; // Соседние клавиши
      } else if (char1 && char2) {
        typoScore += 0.3; // Разные клавиши
      }
    }

    return typoScore / maxLength;
  }

  // Комбинированный нечеткий поиск
  fuzzySearch(query: string, candidates: string[], options: {
    threshold?: number;
    limit?: number;
    includeScore?: boolean;
  } = {}): any[] {
    const threshold = options.threshold || 0.6;
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