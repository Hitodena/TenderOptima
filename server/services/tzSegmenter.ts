// server/services/tzSegmenter.ts

export interface TZSection {
  number: string;
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  keywords: string[];
}

/**
 * Разбить ТЗ на разделы используя множественные паттерны
 */
export async function segmentTZ(tzText: string): Promise<TZSection[]> {
  const lines = tzText.split('\n');
  const sections: TZSection[] = [];

  console.log(`\n📖 Segmenting ТЗ (${lines.length} lines)...`);
  console.log(`    Total lines: ${lines.length}`);

  console.log(`\n  [DEBUG] First 40 lines of ТЗ:`);
  for (let i = 0; i < Math.min(40, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 0) {
      console.log(`  Line ${i + 1}: "${line.substring(0, 80)}"`);
    }
  }

  let currentSection: Partial<TZSection> | null = null;
  let startLine = 0;
  let sectionCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let headerMatch: RegExpMatchArray | null = null;
    let patternType = '';

    // Pattern 1: "1.", "1.1.", "2.3.4." (numeric with dot)
    if (!headerMatch) {
      const match = line.match(/^(\d+(?:\.\d+)*)\s*\.\s*(.+?)$/);
      if (match) {
        headerMatch = match;
        patternType = 'numeric_with_dot';
      }
    }

    // Pattern 2: "1)", "1.1)", "2.3.4)" (numeric with parenthesis)
    if (!headerMatch) {
      const match = line.match(/^(\d+(?:\.\d+)*)\s*\)\s*(.+?)$/);
      if (match) {
        headerMatch = match;
        patternType = 'numeric_with_parenthesis';
      }
    }

    // Pattern 3: "Раздел 1", "Раздел 1.1", "Section 2" (text prefix)
    if (!headerMatch) {
      const match = line.match(/^(Раздел|Section|РАЗДЕЛ|SECTION)\s+(\d+(?:\.\d+)*)\s*[:\-\.]?\s*(.+?)$/i);
      if (match) {
        headerMatch = [match[0], match[2], match[3]]; // Reorder to [full, number, title]
        patternType = 'text_prefix';
      }
    }

    // Pattern 4: UPPERCASE TITLE (all caps, possibly with numbers)
    if (!headerMatch) {
      const match = line.match(/^([А-ЯA-Z0-9\s\-]{3,})$/);
      if (match && line === line.toUpperCase() && line.trim().length > 3) {
        // Check if previous line was empty or section header
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        if (prevLine === '' || prevLine.match(/^\d/) || i === 0) {
          headerMatch = [match[0], `${sectionCounter + 1}`, match[1]];
          patternType = 'uppercase_title';
          sectionCounter++;
        }
      }
    }

    // Pattern 5: "# Title", "## Title" (markdown style)
    if (!headerMatch) {
      const match = line.match(/^#{1,3}\s+(.+?)$/);
      if (match) {
        headerMatch = [match[0], `${sectionCounter + 1}`, match[1]];
        patternType = 'markdown_style';
        sectionCounter++;
      }
    }

    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        const content = lines.slice(startLine, i).join('\n');
        const section: TZSection = {
          number: currentSection.number!,
          name: currentSection.name!,
          content: content.trim(),
          startLine,
          endLine: i,
          keywords: extractKeywords(currentSection.name!)
        };
        sections.push(section);
        console.log(`  ✓ Found section [${section.number}] "${section.name}"`);
      }

      // Start new section
      const sectionNumber = headerMatch[1] || `${sections.length + 1}`;
      const sectionName = headerMatch[2]?.trim() || headerMatch[0].trim();
      
      currentSection = {
        number: sectionNumber,
        name: sectionName
      };
      startLine = i;
      
      console.log(`  📍 Detected header at line ${i + 1}: "${line.trim()}" (pattern: ${patternType})`);
    }
  }

  // Add last section
  if (currentSection) {
    const content = lines.slice(startLine).join('\n');
    const section: TZSection = {
      number: currentSection.number!,
      name: currentSection.name!,
      content: content.trim(),
      startLine,
      endLine: lines.length,
      keywords: extractKeywords(currentSection.name!)
    };
    sections.push(section);
    console.log(`  ✓ Found section [${section.number}] "${section.name}"`);
  }

  if (sections.length === 0) {
    console.warn(`⚠️ No sections found in ТЗ using any pattern`);
    console.warn(`   This may indicate unstructured document`);
    return [];
  }

  console.log(`✓ ТЗ segmented into ${sections.length} sections`);
  return sections;
}

/**
 * Извлечь ключевые слова из названия раздела
 */
function extractKeywords(sectionName: string): string[] {
  const stopwords = ['и', 'в', 'на', 'для', 'по', 'с', 'от', 'из', 'the', 'a', 'an', 'of', 'to', 'and', 'or'];
  const keywords = sectionName
    .toLowerCase()
    .split(/[\s,;:\-()]+/)
    .filter(word => word.length > 2 && !stopwords.includes(word));

  return [...new Set(keywords)]; // Deduplication
}
