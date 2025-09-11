
import { db } from '../db';
import { semanticBlocks } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface VectorizedBlock {
  id: number;
  projectId: number;
  blockTitle: string;
  searchVector: string;
  optimizedRequirements: {
    deduped_requirements: string[];
    technical_keywords: string[];
    categories: string[];
  };
}

export class VectorizationService {
  
  /**
   * Optimize and vectorize semantic blocks for search
   */
  async optimizeSemanticBlocks(projectId: number): Promise<VectorizedBlock[]> {
    console.log(`[Vectorization] Processing semantic blocks for project ${projectId}`);
    
    // Get all semantic blocks for the project
    const blocks = await db
      .select()
      .from(semanticBlocks)
      .where(eq(semanticBlocks.projectId, projectId));
    
    const vectorizedBlocks: VectorizedBlock[] = [];
    
    for (const block of blocks) {
      try {
        const optimized = await this.optimizeBlock(block);
        vectorizedBlocks.push(optimized);
        
        // Update database with vectorized data
        await db
          .update(semanticBlocks)
          .set({
            searchVector: optimized.searchVector,
            optimizedRequirements: optimized.optimizedRequirements
          })
          .where(eq(semanticBlocks.id, block.id));
          
      } catch (error) {
        console.error(`[Vectorization] Error processing block ${block.id}:`, error);
      }
    }
    
    console.log(`[Vectorization] Completed processing ${vectorizedBlocks.length} blocks`);
    return vectorizedBlocks;
  }
  
  /**
   * Get vectorized blocks for a project
   */
  async getVectorizedBlocks(projectId: number): Promise<VectorizedBlock[]> {
    const blocks = await db
      .select()
      .from(semanticBlocks)
      .where(eq(semanticBlocks.projectId, projectId));
    
    return blocks
      .filter(block => block.searchVector && block.optimizedRequirements)
      .map(block => ({
        id: block.id,
        projectId: block.projectId,
        blockTitle: block.blockTitle,
        searchVector: block.searchVector!,
        optimizedRequirements: block.optimizedRequirements!
      }));
  }

  /**
   * Get all semantic blocks for a project
   */
  async getSemanticBlocks(projectId: number): Promise<any[]> {
    const blocks = await db
      .select()
      .from(semanticBlocks)
      .where(eq(semanticBlocks.projectId, projectId));
    
    return blocks.map(block => ({
      id: block.id,
      projectId: block.projectId,
      blockTitle: block.blockTitle,
      semanticEssence: block.semanticEssence,
      searchVector: block.searchVector,
      optimizedRequirements: block.optimizedRequirements,
      createdAt: block.createdAt
    }));
  }
  
  /**
   * Optimize individual semantic block
   */
  private async optimizeBlock(block: any): Promise<VectorizedBlock> {
    const essence = block.semanticEssence;
    
    // 1. Optimize keyRequirements (remove duplicates, normalize)
    const optimizedReqs = this.deduplicateRequirements(essence.key_requirements || []);
    
    // 2. Extract technical keywords from criticalParams and requirements
    const technicalKeywords = this.extractTechnicalKeywords(essence, optimizedReqs);
    
    // 3. Categorize requirements
    const categories = this.categorizeRequirements(optimizedReqs);
    
    // 4. Create search vector from optimized requirements
    const searchVector = this.createSearchVector(optimizedReqs, technicalKeywords);
    
    return {
      id: block.id,
      projectId: block.projectId,
      blockTitle: block.blockTitle,
      searchVector,
      optimizedRequirements: {
        deduped_requirements: optimizedReqs,
        technical_keywords: technicalKeywords,
        categories
      }
    };
  }
  
  /**
   * Remove duplicate and similar requirements
   */
  private deduplicateRequirements(requirements: string[]): string[] {
    if (!requirements || requirements.length === 0) return [];
    
    const normalized = requirements.map(req => 
      req.toLowerCase()
        .replace(/[•\-\*]/g, '')
        .trim()
    );
    
    const unique = [];
    const seen = new Set();
    
    for (let i = 0; i < normalized.length; i++) {
      const norm = normalized[i];
      if (norm.length < 10) continue; // Skip too short requirements
      
      let isDuplicate = false;
      for (const existing of seen) {
        // Check similarity (simple approach)
        if (this.calculateSimilarity(norm, existing) > 0.8) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        seen.add(norm);
        unique.push(requirements[i]);
      }
    }
    
    return unique;
  }
  
  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Extract technical keywords from essence and requirements
   */
  private extractTechnicalKeywords(essence: any, requirements: string[]): string[] {
    const keywords = new Set<string>();
    
    // Equipment types
    const equipmentTypes = [
      'сыроизготовитель', 'танк', 'емкость', 'насос', 'теплообменник',
      'автоклав', 'пастеризатор', 'сепаратор', 'гомогенизатор',
      'охладитель', 'нагреватель', 'мешалка', 'конвейер'
    ];
    
    // Materials
    const materials = [
      'нержавеющая сталь', 'сталь', 'пищевая сталь', 'AISI 304', 'AISI 316',
      'полипропилен', 'тефлон', 'силикон', 'резина'
    ];
    
    // Technical parameters
    const technicalParams = [
      'объем', 'производительность', 'мощность', 'давление', 'температура',
      'скорость', 'частота', 'диаметр', 'высота', 'ширина', 'длина'
    ];
    
    const allText = [
      essence.semantic_description || '',
      essence.core_function || '',
      ...(essence.key_processes || []),
      ...requirements
    ].join(' ').toLowerCase();
    
    // Extract equipment types
    equipmentTypes.forEach(type => {
      if (allText.includes(type)) {
        keywords.add(type);
      }
    });
    
    // Extract materials
    materials.forEach(material => {
      if (allText.includes(material)) {
        keywords.add(material);
      }
    });
    
    // Extract technical parameters
    technicalParams.forEach(param => {
      if (allText.includes(param)) {
        keywords.add(param);
      }
    });
    
    // Extract numeric values with units
    const numericPattern = /(\d+(?:[.,]\d+)?)\s*(л|литр|кг|м³|м²|м|см|мм|бар|°C|об\/мин|кВт|В)/g;
    let match;
    while ((match = numericPattern.exec(allText)) !== null) {
      keywords.add(`${match[1]} ${match[2]}`);
    }
    
    return Array.from(keywords);
  }
  
  /**
   * Categorize requirements by type
   */
  private categorizeRequirements(requirements: string[]): string[] {
    const categories = new Set<string>();
    
    const categoryKeywords = {
      'размеры': ['объем', 'размер', 'диаметр', 'высота', 'ширина', 'длина'],
      'материалы': ['сталь', 'материал', 'покрытие', 'нержавеющ'],
      'управление': ['автоматич', 'управлен', 'контрол', 'ПЛК', 'датчик'],
      'безопасность': ['безопасн', 'защит', 'аварийн', 'блокировк'],
      'гигиена': ['мойка', 'очистк', 'дезинфекц', 'санитар', 'гигиен'],
      'производительность': ['производительн', 'мощность', 'скорость', 'частота']
    };
    
    const allText = requirements.join(' ').toLowerCase();
    
    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      if (keywords.some(keyword => allText.includes(keyword))) {
        categories.add(category);
      }
    });
    
    return Array.from(categories);
  }
  
  /**
   * Create search vector from requirements and keywords
   */
  private createSearchVector(requirements: string[], keywords: string[]): string {
    const searchTerms = [
      ...requirements.map(req => req.toLowerCase()),
      ...keywords
    ];
    
    // Remove duplicates and create searchable text
    const uniqueTerms = Array.from(new Set(searchTerms));
    
    return uniqueTerms
      .filter(term => term.length > 2)
      .join(' ')
      .replace(/[^\w\sа-яё]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
