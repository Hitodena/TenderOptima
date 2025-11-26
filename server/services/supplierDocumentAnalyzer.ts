// server/services/supplierDocumentAnalyzer.ts

import { TZSection } from './tzSegmenter';

export interface SupplierSection {
  section_id: string;
  tz_number: string;           // Соответствующий раздел ТЗ
  supplier_keywords: string[];
  content: string;
  tokens: number;
  confidence: number;          // 0-1
  source_page?: number;
  exact_match: boolean;        // Найдено ли точное совпадение
}

/**
 * Анализировать структуру КП и соотнести с ТЗ
 */
export async function matchSupplierToTZ(
  supplierText: string,
  tzSections: TZSection[]
): Promise<SupplierSection[]> {

  const supplierSections: SupplierSection[] = [];

  // Шаг 1: Извлечь оглавление/Summary из КП
  const toc = extractTableOfContents(supplierText);
  console.log(`📋 TOC entries found: ${toc.length}`);

  // Шаг 2: Для каждого раздела ТЗ найти соответствие в КП
  for (const tzSection of tzSections) {
    console.log(
      `🔍 Matching ТЗ [${tzSection.number}] "${tzSection.name}"`
    );

    // Вариант 1: Поиск по оглавлению
    const tocMatches = matchInTableOfContents(toc, tzSection.keywords);

    if (tocMatches.length > 0) {
      console.log(
        `  ✓ Found in TOC: ${tocMatches.map(m => m.title).join('; ')}`
      );

      for (const match of tocMatches) {
        const section = extractSectionFromSupplier(
          supplierText,
          match,
          tzSection.number
        );

        if (section) {
          supplierSections.push(section);
        }
      }
    }
    // Вариант 2: Семантический поиск если не нашли в оглавлении
    else {
      console.log(`  ⚠️ Not in TOC, trying semantic search...`);

      const semanticMatch = semanticSearchInSupplier(
        supplierText,
        tzSection.name,
        tzSection.keywords
      );

      if (semanticMatch && semanticMatch.confidence > 0.6) {
        console.log(`  ✓ Semantic match (confidence: ${semanticMatch.confidence})`);
        supplierSections.push(semanticMatch);
      } else {
        console.log(`  ✗ No match found`);

        // Создать пустой раздел (для отслеживания пропусков)
        supplierSections.push({
          section_id: `${tzSection.number}_missing`,
          tz_number: tzSection.number,
          supplier_keywords: [],
          content: '',
          tokens: 0,
          confidence: 0,
          exact_match: false
        });
      }
    }
  }

  return supplierSections;
}

/**
 * Извлечь оглавление из документа
 */
function extractTableOfContents(
  text: string
): Array<{ title: string; page?: number; level: number }> {

  const toc: Array<{ title: string; page?: number; level: number }> = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Ищем паттерны типа "1.2 Equipment ... 25"
    const tocMatch = line.match(
      /^(\d+(?:\.\d+)*)\s+(.+?)\s*(?:\.{2,}|\s+)(\d+)?$/
    );

    if (tocMatch) {
      toc.push({
        title: tocMatch[2].trim(),
        page: tocMatch[3] ? parseInt(tocMatch[3]) : undefined,
        level: (tocMatch[1].match(/\./g) || []).length + 1
      });
    }
  }

  return toc;
}

/**
 * Сопоставить требования ТЗ с оглавлением КП
 */
function matchInTableOfContents(
  toc: Array<{ title: string; page?: number; level: number }>,
  tzKeywords: string[]
): Array<{ title: string; page?: number; score: number }> {

  const matches: Array<{ title: string; page?: number; score: number }> = [];

  for (const tocEntry of toc) {
    const entryLower = tocEntry.title.toLowerCase();
    
    let matchScore = 0;

    for (const keyword of tzKeywords) {
      if (entryLower.includes(keyword.toLowerCase())) {
        matchScore += 1;
      }
    }

    if (matchScore > 0) {
      matches.push({
        title: tocEntry.title,
        page: tocEntry.page,
        score: matchScore / tzKeywords.length
      });
    }
  }

  // Отсортировать по score (с большего)
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Извлечь содержимое раздела из КП
 */
function extractSectionFromSupplier(
  supplierText: string,
  tocMatch: { title: string; page?: number; score: number },
  tzNumber: string
): SupplierSection | null {

  // Поиск раздела в тексте по названию
  const sectionRegex = new RegExp(
    `${escapeRegex(tocMatch.title)}([\\s\\S]*?)(?=^\\d+\\.|$)`,
    'mi'
  );

  const match = supplierText.match(sectionRegex);

  if (!match) {
    return null;
  }

  const content = match[1].trim();
  const tokens = estimateTokens(content);

  return {
    section_id: `${tzNumber}_from_${tocMatch.score.toFixed(2)}`,
    tz_number: tzNumber,
    supplier_keywords: tocMatch.title.toLowerCase().split(/\s+/),
    content,
    tokens,
    confidence: tocMatch.score,
    exact_match: tocMatch.score === 1.0
  };
}

/**
 * Семантический поиск в тексте (fallback)
 */
function semanticSearchInSupplier(
  supplierText: string,
  tzName: string,
  tzKeywords: string[]
): SupplierSection | null {

  // Упрощенный поиск: ищем последовательно все ключевые слова
  let bestMatch: SupplierSection | null = null;
  let bestScore = 0;

  const paragraphs = supplierText.split(/\n\n+/);

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const paraLower = para.toLowerCase();

    let score = 0;
    let matches = 0;

    for (const keyword of tzKeywords) {
      if (paraLower.includes(keyword.toLowerCase())) {
        score += 1;
        matches++;
      }
    }

    // Нужно совпадение минимум 50% ключевых слов
    if (matches / tzKeywords.length > 0.5 && score > bestScore) {
      bestScore = score;
      bestMatch = {
        section_id: `semantic_match_para_${i}`,
        tz_number: 'unknown',
        supplier_keywords: tzKeywords,
        content: para.substring(0, 5000), // Ограничить размер
        tokens: estimateTokens(para),
        confidence: matches / tzKeywords.length,
        exact_match: false
      };
    }
  }

  return bestMatch;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function estimateTokens(text: string): number {
  // 1 токен ≈ 2.8 символам для русского текста
  return Math.ceil(text.length / 2.8);
}
