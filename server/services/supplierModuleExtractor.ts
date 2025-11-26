// server/services/supplierModuleExtractor.ts

export interface SupplierModule {
  id: string;  // like "module_0", "module_1"
  number?: string;  // like "1", "1.1", "2.3"
  title: string;  // module name
  content: string;  // full text
  keywords: string[];  // extracted from title
  type: string;  // like "technical", "equipment", "general"
  start_position: number;
  end_position: number;
  tokens: number;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopwords = ['и', 'в', 'на', 'the', 'a', 'an', 'of', 'to', 'для', 'по', 'с', 'от', 'из'];
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !stopwords.includes(word))
    .slice(0, 10);
  return words;
}

/**
 * Detect module type based on title keywords
 */
function detectModuleType(title: string): string {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('оборудование') || lowerTitle.includes('equipment') || 
      lowerTitle.includes('машина') || lowerTitle.includes('machine') ||
      lowerTitle.includes('агрегат') || lowerTitle.includes('аппарат')) {
    return 'equipment';
  }
  
  if (lowerTitle.includes('технический') || lowerTitle.includes('technical') ||
      lowerTitle.includes('технология') || lowerTitle.includes('technology') ||
      lowerTitle.includes('параметр') || lowerTitle.includes('parameter') ||
      lowerTitle.includes('характеристика') || lowerTitle.includes('characteristic')) {
    return 'technical';
  }
  
  return 'general';
}

/**
 * Estimate tokens for text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.85);
}

/**
 * Extract supplier modules from text
 */
export function extractSupplierModules(supplierText: string): SupplierModule[] {
  const modules: SupplierModule[] = [];
  const lines = supplierText.split('\n');
  
  let currentModule: Partial<SupplierModule> | null = null;
  let moduleId = 0;
  let currentContent: string[] = [];
  let startPosition = 0;
  let currentPosition = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentPosition += line.length + 1; // +1 for newline
    
    // Pattern 1: /^(\d+(?:\.\d+)*)\s+(.+?)$/  (like "1.1 Title")
    const headerMatch1 = line.match(/^(\d+(?:\.\d+)*)\s+(.+?)$/);
    
    // Pattern 2: /^(Раздел|Section)\s+(\d+)\s+(.+)$/i (like "Раздел 1 Title")
    const headerMatch2 = line.match(/^(Раздел|Section)\s+(\d+)\s+(.+)$/i);
    
    if (headerMatch1 || headerMatch2) {
      // Save previous module if exists
      if (currentModule && currentContent.length > 0) {
        const content = currentContent.join('\n').trim();
        const endPosition = currentPosition - line.length - 1;
        
        modules.push({
          id: currentModule.id || `module_${moduleId}`,
          number: currentModule.number,
          title: currentModule.title || '',
          content: content,
          keywords: extractKeywords(currentModule.title || ''),
          type: detectModuleType(currentModule.title || ''),
          start_position: startPosition,
          end_position: endPosition,
          tokens: estimateTokens(content)
        });
        moduleId++;
      }
      
      // Start new module
      if (headerMatch1) {
        currentModule = {
          id: `module_${moduleId}`,
          number: headerMatch1[1],
          title: headerMatch1[2].trim()
        };
      } else if (headerMatch2) {
        currentModule = {
          id: `module_${moduleId}`,
          number: headerMatch2[2],
          title: headerMatch2[3].trim()
        };
      }
      
      startPosition = currentPosition - line.length - 1;
      currentContent = [];
    } else {
      // Add line to current module content
      if (currentModule) {
        currentContent.push(line);
      }
    }
  }
  
  // Save last module if exists
  if (currentModule && currentContent.length > 0) {
    const content = currentContent.join('\n').trim();
    const endPosition = currentPosition;
    
    modules.push({
      id: currentModule.id || `module_${moduleId}`,
      number: currentModule.number,
      title: currentModule.title || '',
      content: content,
      keywords: extractKeywords(currentModule.title || ''),
      type: detectModuleType(currentModule.title || ''),
      start_position: startPosition,
      end_position: endPosition,
      tokens: estimateTokens(content)
    });
  }
  
  console.log(`✓ Extracted ${modules.length} modules`);
  return modules;
}





