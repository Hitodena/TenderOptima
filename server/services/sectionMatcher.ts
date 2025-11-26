// server/services/sectionMatcher.ts

import { TZSection } from './tzSegmenter';
import { SupplierModule } from './supplierModuleExtractor';

export interface SectionMatch {
  tz_section: TZSection;
  supplier_module: SupplierModule | null;
  confidence: number;  // 0-1
  reasoning: string;
  match_type: 'exact' | 'partial' | 'fuzzy' | 'none';
}

/**
 * Detect section type by keywords in name
 */
function detectSectionType(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('оборудование') || lowerName.includes('equipment') || 
      lowerName.includes('машина') || lowerName.includes('machine') ||
      lowerName.includes('агрегат') || lowerName.includes('аппарат')) {
    return 'equipment';
  }
  
  if (lowerName.includes('технический') || lowerName.includes('technical') ||
      lowerName.includes('технология') || lowerName.includes('technology') ||
      lowerName.includes('параметр') || lowerName.includes('parameter') ||
      lowerName.includes('характеристика') || lowerName.includes('characteristic')) {
    return 'technical';
  }
  
  return 'general';
}

/**
 * Calculate match score between TZ section and supplier module
 */
function calculateMatchScore(
  tzSection: TZSection,
  supplierModule: SupplierModule
): { total: number; reasons: string[] } {
  let total = 0;
  const reasons: string[] = [];
  
  // Number match (exact)
  if (tzSection.number === supplierModule.number) {
    total += 40;
    reasons.push('exact number match');
  } else if (tzSection.number && supplierModule.number) {
    // Number match (partial) - check if one starts with the other
    if (tzSection.number.startsWith(supplierModule.number) || 
        supplierModule.number.startsWith(tzSection.number)) {
      total += 20;
      reasons.push('partial number match');
    }
  }
  
  // Title match (exact)
  const tzTitleLower = tzSection.name.toLowerCase().trim();
  const supplierTitleLower = supplierModule.title.toLowerCase().trim();
  
  if (tzTitleLower === supplierTitleLower) {
    total += 30;
    reasons.push('exact title match');
  } else if (tzTitleLower.includes(supplierTitleLower) || 
             supplierTitleLower.includes(tzTitleLower)) {
    // Title match (partial)
    total += 20;
    reasons.push('partial title match');
  }
  
  // Keywords match
  const commonKeywords = tzSection.keywords.filter(kw => 
    supplierModule.keywords.includes(kw)
  );
  const keywordScore = Math.min(commonKeywords.length * 5, 20);
  if (keywordScore > 0) {
    total += keywordScore;
    reasons.push(`${commonKeywords.length} common keywords`);
  }
  
  // Type match
  const tzType = detectSectionType(tzSection.name);
  if (tzType === supplierModule.type) {
    total += 10;
    reasons.push('type match');
  }
  
  return { total, reasons };
}

/**
 * Find best matching supplier module for TZ section
 */
function findBestMatch(
  tzSection: TZSection,
  supplierModules: SupplierModule[]
): SectionMatch {
  const scored = supplierModules.map(module => {
    const scoreResult = calculateMatchScore(tzSection, module);
    return {
      module,
      score: scoreResult.total,
      reasons: scoreResult.reasons
    };
  });
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  
  if (!best || best.score === 0) {
    return {
      tz_section: tzSection,
      supplier_module: null,
      confidence: 0,
      reasoning: 'No matching module found',
      match_type: 'none'
    };
  }
  
  // Calculate confidence (0-1)
  const confidence = Math.min(best.score / 100, 1);
  
  // Determine match type
  let match_type: 'exact' | 'partial' | 'fuzzy' | 'none';
  if (confidence >= 0.8) {
    match_type = 'exact';
  } else if (confidence >= 0.5) {
    match_type = 'partial';
  } else if (confidence > 0) {
    match_type = 'fuzzy';
  } else {
    match_type = 'none';
  }
  
  return {
    tz_section: tzSection,
    supplier_module: best.module,
    confidence,
    reasoning: best.reasons.join(', '),
    match_type
  };
}

/**
 * Match TZ sections with supplier modules
 */
export function matchSections(
  tzSections: TZSection[],
  supplierModules: SupplierModule[]
): SectionMatch[] {
  const matches: SectionMatch[] = [];
  
  for (const tzSection of tzSections) {
    const match = findBestMatch(tzSection, supplierModules);
    matches.push(match);
    
    console.log(
      `  TZ [${tzSection.number}] "${tzSection.name}" → ` +
      `KP [${match.supplier_module?.number || 'N/A'}] "${match.supplier_module?.title || 'NOT FOUND'}" ` +
      `(${(match.confidence * 100).toFixed(0)}% confidence, ${match.match_type})`
    );
  }
  
  console.log(`✓ Matched ${tzSections.length} TZ sections with supplier modules`);
  return matches;
}





