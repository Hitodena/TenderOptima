/**
 * Semantic Block Processing Service
 * Implements adaptive block processing strategy for enhanced equipment analysis
 */

import crypto from 'crypto';
import { db } from '../db';
import { semanticBlocks } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { VectorizationService } from './vectorizationService';

interface SemanticEssence {
  core_function: string;
  semantic_description: string;
  key_processes: string[];
  critical_params: Record<string, string>;
  dependencies: string[];
  exclusions: string[];
  key_requirements: string[];
}

interface ProcessedBlock {
  block_title: string;
  content_hash: string;
  semantic_essence: SemanticEssence;
  token_count: number;
  processing_method: 'direct' | 'compressed' | 'recursive';
  order_index: number;
}

export class SemanticBlockProcessor {
  private readonly MAX_SMALL_BLOCK = 5000;
  private readonly MAX_MEDIUM_BLOCK = 20000;

  /**
   * Main entry point for processing technical requirements into semantic blocks
   */
  async processRequirementsToSemanticBlocks(
    projectId: number,
    requirementsText: string,
    sections: Array<{ sectionNumber: string; sectionTitle: string; content: string }>
  ): Promise<ProcessedBlock[]> {
    console.log(`[SemanticProcessor] Processing ${sections.length} sections for project ${projectId}`);
    
    const processedBlocks: ProcessedBlock[] = [];
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const tokenCount = this.estimateTokenCount(section.content);
      
      try {
        const blocks = await this.adaptiveBlockProcessing(
          section.content,
          `${section.sectionNumber}. ${section.sectionTitle}`,
          i
        );
        
        processedBlocks.push(...blocks);
      } catch (error) {
        console.error(`[SemanticProcessor] Error processing section ${section.sectionNumber}:`, error);
        // Continue processing other sections
      }
    }

    // Save to database
    await this.saveSemanticBlocks(projectId, processedBlocks);
    
    // Vectorize semantic blocks for search optimization
    const vectorizationService = new VectorizationService();
    await vectorizationService.optimizeSemanticBlocks(projectId);
    
    return processedBlocks;
  }

  /**
   * Adaptive block processing based on content size
   */
  private async adaptiveBlockProcessing(
    content: string,
    title: string,
    orderIndex: number
  ): Promise<ProcessedBlock[]> {
    const tokenCount = this.estimateTokenCount(content);
    
    if (tokenCount <= this.MAX_SMALL_BLOCK) {
      // Small blocks - process entirely
      const essence = await this.generateSemanticEssence(title, content);
      return [{
        block_title: title,
        content_hash: this.generateContentHash(content),
        semantic_essence: essence,
        token_count: tokenCount,
        processing_method: 'direct',
        order_index: orderIndex
      }];
      
    } else if (tokenCount <= this.MAX_MEDIUM_BLOCK) {
      // Medium blocks - compress while keeping key aspects
      const compressedContent = await this.compressContent(content);
      const essence = await this.generateSemanticEssence(title, compressedContent);
      return [{
        block_title: title,
        content_hash: this.generateContentHash(content),
        semantic_essence: essence,
        token_count: tokenCount,
        processing_method: 'compressed',
        order_index: orderIndex
      }];
      
    } else {
      // Large blocks - recursive subdivision
      const subBlocks = await this.splitLargeBlock(content, title);
      const results: ProcessedBlock[] = [];
      
      for (let i = 0; i < subBlocks.length; i++) {
        const subBlock = subBlocks[i];
        const subResults = await this.adaptiveBlockProcessing(
          subBlock.content,
          subBlock.title,
          orderIndex * 100 + i // Maintain hierarchy in ordering
        );
        results.push(...subResults);
      }
      
      return results;
    }
  }

  /**
   * AI-powered large block splitting
   */
  private async splitLargeBlock(content: string, title: string): Promise<Array<{title: string, content: string}>> {
    const prompt = `
Разбей техническое описание оборудования на логические подблоки. Критерии:
1. Каждый подблок = законченная смысловая единица оборудования
2. Сохрани технологическую последовательность
3. Сгенерируй краткий заголовок для каждого подблока
4. Выдели отдельные виды оборудования, если есть

Формат вывода - строгий JSON: [{"title": "Заголовок", "content": "Текст"}]

Исходный заголовок: ${title}

Текст для разбиения:
${content.substring(0, 15000)}${content.length > 15000 ? '...' : ''}
    `.trim();

    try {
      // This would integrate with OpenAI/Anthropic API
      // For now, return a simple split by equipment types
      const equipmentSections = this.extractEquipmentSections(content, title);
      return equipmentSections;
    } catch (error) {
      console.error('[SemanticProcessor] Error splitting large block:', error);
      // Fallback: split by paragraphs
      return this.fallbackSplit(content, title);
    }
  }

  /**
   * Extract equipment sections using pattern matching
   */
  private extractEquipmentSections(content: string, title: string): Array<{title: string, content: string}> {
    const sections: Array<{title: string, content: string}> = [];
    
    // Look for equipment subsections (e.g., "2.1. Сыроизготовители")
    const sectionPattern = /(\d+\.\d+\.?\s*[А-Яа-я\s\(\)]+(?:\(\d+\s*ед\.\))?)/g;
    const matches = content.match(sectionPattern);
    
    if (matches && matches.length > 1) {
      const parts = content.split(sectionPattern);
      
      for (let i = 1; i < parts.length; i += 2) {
        const sectionTitle = parts[i].trim();
        const sectionContent = parts[i + 1] || '';
        
        if (sectionContent.trim().length > 50) {
          sections.push({
            title: sectionTitle,
            content: sectionContent.trim()
          });
        }
      }
    }
    
    // If no subsections found, return original content
    if (sections.length === 0) {
      sections.push({ title, content });
    }
    
    return sections;
  }

  /**
   * Fallback splitting method
   */
  private fallbackSplit(content: string, title: string): Array<{title: string, content: string}> {
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 100);
    const chunkSize = Math.ceil(paragraphs.length / 3);
    
    const sections: Array<{title: string, content: string}> = [];
    
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const chunk = paragraphs.slice(i, i + chunkSize).join('\n\n');
      sections.push({
        title: `${title} - Часть ${Math.floor(i / chunkSize) + 1}`,
        content: chunk
      });
    }
    
    return sections;
  }

  /**
   * Compress content while preserving key information
   */
  private async compressContent(content: string): Promise<string> {
    const prompt = `
Сократи техническое описание оборудования, сохранив ВСЕ:
- Критические параметры (числовые значения, размеры, мощности)
- Функциональные требования
- Ограничения и исключения
- Уникальные характеристики оборудования
- Технологические требования

Удали: примеры, исторические справки, маркетинговые формулировки, повторения.

Целевой объём: ~4000 токенов.

Исходный текст:
${content}
    `.trim();

    try {
      // This would integrate with AI API
      // For now, return a simplified version
      return this.simpleCompress(content);
    } catch (error) {
      console.error('[SemanticProcessor] Error compressing content:', error);
      return content.substring(0, 8000); // Simple truncation fallback
    }
  }

  /**
   * Simple content compression fallback
   */
  private simpleCompress(content: string): string {
    // Remove excessive whitespace and redundant phrases
    let compressed = content
      .replace(/\s+/g, ' ')
      .replace(/\b(например|к примеру|в частности)\b[^.]*\./gi, '')
      .replace(/\b(следует отметить|необходимо учитывать|важно понимать)\b/gi, '')
      .trim();
    
    // Keep only essential parts if still too long
    if (compressed.length > 8000) {
      const sentences = compressed.split('.');
      const important = sentences.filter(s => 
        /\d/.test(s) || // Contains numbers
        /(требован|необходим|обязательн|долж)/i.test(s) || // Requirements
        /(характеристик|параметр|функци)/i.test(s) // Technical specs
      );
      compressed = important.join('.') + '.';
    }
    
    return compressed;
  }

  /**
   * Generate semantic essence for equipment block matching user samples
   */
  private async generateSemanticEssence(title: string, content: string): Promise<SemanticEssence> {
    const prompt = `
Создай детализированную семантику оборудования в формате пользователя: [${title}]

ПРИМЕР ТРЕБУЕМОГО ФОРМАТА (как в образцах пользователя):

Семантика: Вертикальные закрытые сыроизготовители для коагуляции молока, резки сгустка и отделения сыворотки.

Ключевые требования:
• Объем ≥ 8000 л.
• Система «двойной ноль» (полное опорожнение).
• Рубашка подогрева (рабочее давление ≥ 2.0 бар).
• Ножи-лиры без нижних подшипников (для гигиенической мойки).
• Автоматическое регулирование скорости мешалки (2–15 об/мин).
• Плавающий короб для отвода сыворотки с датчиком положения.
• Отдельный узел подготовки воды на каждый сыроизготовитель (теплообменник, бак, насосы).
• Автономный шкаф управления на базе ПЛК для каждого.

ОБЯЗАТЕЛЬНЫЕ ТРЕБОВАНИЯ:
1. semantic_description = краткое функциональное описание оборудования (1 предложение)
2. key_requirements = детальный список технических требований с ТОЧНЫМИ значениями
3. Каждое требование начинается с bullet point (•)
4. Сохраняй ВСЕ числовые параметры и единицы измерения
5. Включай материалы, стандарты, технические характеристики
6. Укажи системы управления, датчики, автоматизацию

ФОРМАТ JSON:
{
  "core_function": "Краткая функция (до 5 слов)",
  "semantic_description": "Функциональное описание для поиска у поставщиков",
  "key_processes": ["Основной процесс 1", "Основной процесс 2"],
  "critical_params": {"ключевой_параметр": "точное_значение"},
  "dependencies": ["Технологическая зависимость"],
  "exclusions": ["Технологическое ограничение"],
  "key_requirements": ["• Требование 1 с точными параметрами", "• Требование 2 с характеристиками", "• Требование 3 с материалами/стандартами"]
}

Техническое описание:
${content}
    `.trim();

    try {
      // This would integrate with AI API
      // For now, return a structured analysis based on content patterns
      return this.extractSemanticEssence(title, content);
    } catch (error) {
      console.error('[SemanticProcessor] Error generating semantic essence:', error);
      return this.fallbackSemanticEssence(title, content);
    }
  }

  /**
   * Extract semantic essence using pattern matching
   */
  private extractSemanticEssence(title: string, content: string): SemanticEssence {
    // Extract core function from title
    const coreFunction = this.extractCoreFunction(title);
    
    // Extract numeric parameters
    const criticalParams = this.extractCriticalParams(content);
    
    // Extract requirements
    const keyRequirements = this.extractKeyRequirements(content);
    
    // Extract processes
    const keyProcesses = this.extractKeyProcesses(content);
    
    // Extract dependencies and exclusions
    const dependencies = this.extractDependencies(content);
    const exclusions = this.extractExclusions(content);
    
    // Generate semantic description
    const semanticDescription = this.generateSemanticDescription(title, content);
    
    return {
      core_function: coreFunction,
      semantic_description: semanticDescription,
      key_processes: keyProcesses,
      critical_params: criticalParams,
      dependencies: dependencies,
      exclusions: exclusions,
      key_requirements: keyRequirements
    };
  }

  private extractCoreFunction(title: string): string {
    // Extract equipment type from title
    const equipmentTypes = {
      'сыроизготовител': 'Изготовление сыра и обработка молока',
      'плавител': 'Плавление и растяжка сырной массы',
      'транспортер': 'Транспортировка продукта по линии',
      'дренаж': 'Обезвоживание и асидификация зерна',
      'мойк': 'Мойка и санитарная обработка',
      'резервуар': 'Хранение и подготовка жидкостей',
      'теплообменник': 'Нагрев и охлаждение продукта',
      'насос': 'Перекачка жидких сред'
    };
    
    const titleLower = title.toLowerCase();
    for (const [key, func] of Object.entries(equipmentTypes)) {
      if (titleLower.includes(key)) {
        return func;
      }
    }
    
    return 'Технологическое оборудование для производства';
  }

  private extractCriticalParams(content: string): Record<string, string> {
    const params: Record<string, string> = {};
    
    // Extract numeric parameters with units
    const paramPatterns = [
      /объем[^\d]*≥?\s*(\d+(?:,\d+)?)\s*(л|м³|мл)/gi,
      /производительность[^\d]*≥?\s*(\d+(?:,\d+)?)\s*(кг\/ч|т\/ч|л\/ч)/gi,
      /давление[^\d]*≥?\s*(\d+(?:,\d+)?)\s*(бар|МПа|кПа)/gi,
      /температура[^\d]*≥?\s*(\d+(?:,\d+)?)\s*(°C|К)/gi,
      /скорость[^\d]*(\d+(?:,\d+)?)\s*[-–]\s*(\d+(?:,\d+)?)\s*(об\/мин|м\/с)/gi,
      /размер[^\d]*(\d+(?:,\d+)?)\s*[×x]\s*(\d+(?:,\d+)?)\s*[×x]?\s*(\d+(?:,\d+)?)?\s*(мм|см|м)/gi
    ];
    
    paramPatterns.forEach(pattern => {
      const matches = Array.from(content.matchAll(pattern));
      for (const match of matches) {
        const paramName = match[0].split(/\d/)[0].trim().replace(/[^\w\s]/g, '');
        const value = match.slice(1).filter((v: string) => v).join(' ');
        if (paramName && value) {
          params[paramName] = value;
        }
      }
    });
    
    return params;
  }

  private extractKeyRequirements(content: string): string[] {
    const requirements: string[] = [];
    
    // Look for requirement patterns
    const reqPatterns = [
      /обязан[^.]*\./gi,
      /необходим[^.]*\./gi,
      /требуется[^.]*\./gi,
      /должен[^.]*\./gi,
      /система\s+[«"][^»"]*[»"][^.]*\./gi
    ];
    
    reqPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.trim().replace(/^\w+\s+/, '').replace(/\.$/, '');
          if (cleaned.length > 10 && cleaned.length < 200) {
            requirements.push(cleaned);
          }
        });
      }
    });
    
    return requirements.slice(0, 10); // Limit to most important
  }

  private extractKeyProcesses(content: string): string[] {
    const processes: string[] = [];
    
    const processTerms = [
      'коагуляция', 'резка', 'отделение', 'обезвоживание', 'асидификация',
      'плавление', 'растяжка', 'транспортировка', 'формирование',
      'нагрев', 'охлаждение', 'мойка', 'стерилизация', 'фильтрация'
    ];
    
    processTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        processes.push(term);
      }
    });
    
    return processes;
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    const depPatterns = [
      /синхронизация\s+с[^.]*\./gi,
      /подключение\s+к[^.]*\./gi,
      /совместно\s+с[^.]*\./gi,
      /в\s+составе[^.]*\./gi
    ];
    
    depPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.trim().replace(/\.$/, '');
          if (cleaned.length > 10 && cleaned.length < 150) {
            dependencies.push(cleaned);
          }
        });
      }
    });
    
    return dependencies;
  }

  private extractExclusions(content: string): string[] {
    const exclusions: string[] = [];
    
    const exclPatterns = [
      /не\s+допускается[^.]*\./gi,
      /запрещ[^.]*\./gi,
      /исключ[^.]*\./gi,
      /без[^.]*подшипник[^.]*\./gi,
      /отсутств[^.]*\./gi
    ];
    
    exclPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.trim().replace(/\.$/, '');
          if (cleaned.length > 10 && cleaned.length < 150) {
            exclusions.push(cleaned);
          }
        });
      }
    });
    
    return exclusions;
  }

  private generateSemanticDescription(title: string, content: string): string {
    const coreFunction = this.extractCoreFunction(title);
    const keyTerms = this.extractKeyTerms(content);
    
    return `${coreFunction}. ${keyTerms.join(', ')}.`;
  }

  private extractKeyTerms(content: string): string[] {
    const terms: string[] = [];
    
    const keyTermPatterns = [
      /закрытый|открытый|вертикальн|горизонтальн/gi,
      /автоматическ|ручн|полуавтомат/gi,
      /нержавеющ|AISI\s*\d+/gi,
      /двойн[^.]*ноль/gi,
      /CIP|мойк/gi
    ];
    
    keyTermPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        terms.push(...matches.slice(0, 2));
      }
    });
    
    return terms.slice(0, 5);
  }

  private fallbackSemanticEssence(title: string, content: string): SemanticEssence {
    return {
      core_function: this.extractCoreFunction(title),
      semantic_description: `Технологическое оборудование: ${title}`,
      key_processes: ['обработка', 'технологический процесс'],
      critical_params: {},
      dependencies: [],
      exclusions: [],
      key_requirements: [content.substring(0, 100) + '...']
    };
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for Russian text
    return Math.ceil(text.length / 4);
  }

  private generateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Save processed semantic blocks to database
   */
  private async saveSemanticBlocks(projectId: number, blocks: ProcessedBlock[]): Promise<void> {
    try {
      // Clear existing semantic blocks for this project to avoid duplicates
      await db.delete(semanticBlocks).where(eq(semanticBlocks.projectId, projectId));
      console.log(`[SemanticProcessor] Cleared existing semantic blocks for project ${projectId}`);
      
      for (const block of blocks) {
        await db.insert(semanticBlocks).values({
          projectId: projectId,
          blockTitle: block.block_title,
          contentHash: block.content_hash,
          coreFunction: block.semantic_essence.core_function,
          semanticDescription: block.semantic_essence.semantic_description,
          keyProcesses: block.semantic_essence.key_processes,
          criticalParams: block.semantic_essence.critical_params,
          dependencies: block.semantic_essence.dependencies,
          exclusions: block.semantic_essence.exclusions,
          keyRequirements: block.semantic_essence.key_requirements,
          orderIndex: block.order_index,
          tokenCount: block.token_count,
          processingMethod: block.processing_method
        });
      }
      
      console.log(`[SemanticProcessor] Saved ${blocks.length} semantic blocks for project ${projectId}`);
    } catch (error) {
      console.error('[SemanticProcessor] Error saving semantic blocks:', error);
      throw error;
    }
  }

  /**
   * Retrieve semantic blocks for a project
   */
  async getSemanticBlocks(projectId: number) {
    try {
      const blocks = await db
        .select()
        .from(semanticBlocks)
        .where(eq(semanticBlocks.projectId, projectId))
        .orderBy(semanticBlocks.orderIndex);
      
      return blocks;
    } catch (error) {
      console.error('[SemanticProcessor] Error retrieving semantic blocks:', error);
      throw error;
    }
  }
}