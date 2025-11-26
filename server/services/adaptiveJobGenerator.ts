// server/services/adaptiveJobGenerator.ts

import { AnalysisStrategy } from './adaptiveAnalysisStrategy';
import { TZSection } from './tzSegmenter';
import { SupplierSection } from './supplierDocumentAnalyzer';

export interface AdaptiveAnalysisJob {
  job_id: string;
  strategy: string;
  tz_content: string;        // Может быть полное или частичное ТЗ
  supplier_content: string;
  requirements: Array<{
    tech_spec_number: string;
    extracted_value: string;
  }>;
  total_tokens: number;
  safe_for_deepseek: boolean;
}

/**
 * Split KP into chunks and create multiple jobs
 */
function createChunkedJobs(
  tzText: string,
  supplierText: string,
  requirements: any[],
  strategyName: string = 'FALLBACK'
): AdaptiveAnalysisJob[] {
  const REAL_TOKEN_RATIO = 0.85;
  const MAX_KP_TOKENS = 60000;  // Not aggressive - allow 60K tokens for KP
  const maxKpChars = Math.floor(MAX_KP_TOKENS / REAL_TOKEN_RATIO);  // ~70 KB
  
  const tzTokens = Math.ceil(tzText.length * REAL_TOKEN_RATIO);
  const promptTokens = 8000;
  const responseTokens = 4096;
  const bufferTokens = 5000;
  
  // Calculate how many KP chars we can fit per job
  const availableKpTokens = MAX_SAFE_TOKENS - tzTokens - promptTokens - responseTokens - bufferTokens;
  const safeKpChars = Math.floor(availableKpTokens / REAL_TOKEN_RATIO);
  const chunkSize = Math.min(maxKpChars, safeKpChars);
  
  console.log(`\n📦 Splitting KP into chunks:`);
  console.log(`   KP size: ${(supplierText.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Chunk size: ${(chunkSize / 1024).toFixed(1)} KB`);
  
  // Split KP into chunks
  const chunks: string[] = [];
  for (let i = 0; i < supplierText.length; i += chunkSize) {
    let chunk = supplierText.substring(i, i + chunkSize);
    
    // Find last paragraph boundary
    if (i + chunkSize < supplierText.length) {
      const lastDoubleNewline = chunk.lastIndexOf('\n\n');
      if (lastDoubleNewline > chunkSize * 0.9) {
        chunk = chunk.substring(0, lastDoubleNewline);
      } else {
        const lastNewline = chunk.lastIndexOf('\n');
        if (lastNewline > chunkSize * 0.9) {
          chunk = chunk.substring(0, lastNewline);
        }
      }
    }
    
    chunks.push(chunk);
  }
  
  console.log(`   Created ${chunks.length} chunks`);
  
  // Split requirements into groups
  const requirementsPerChunk = Math.ceil(requirements.length / chunks.length);
  const jobs: AdaptiveAnalysisJob[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkStart = i * requirementsPerChunk;
    const chunkEnd = Math.min(chunkStart + requirementsPerChunk, requirements.length);
    const chunkRequirements = requirements.slice(chunkStart, chunkEnd);
    
    if (chunkRequirements.length === 0) continue;
    
    const kpTokens = Math.ceil(chunks[i].length * REAL_TOKEN_RATIO);
    const totalTokens = tzTokens + kpTokens + promptTokens + responseTokens + bufferTokens;
    
    jobs.push({
      job_id: `fallback_chunk_${i + 1}_of_${chunks.length}`,
      strategy: strategyName,
      tz_content: tzText,
      supplier_content: chunks[i],
      requirements: chunkRequirements,
      total_tokens: totalTokens,
      safe_for_deepseek: totalTokens < MAX_SAFE_TOKENS
    });
    
    console.log(`   Job ${i + 1}: KP chunk ${i + 1}/${chunks.length} (${(chunks[i].length / 1024).toFixed(1)} KB), ` +
                `requirements ${chunkStart + 1}-${chunkEnd} (${chunkRequirements.length} reqs), ` +
                `${totalTokens.toLocaleString()} tokens`);
  }
  
  console.log(`✓ Generated ${jobs.length} chunked jobs`);
  return jobs;
}

/**
 * Генерировать jobs в зависимости от стратегии
 */
export async function generateAdaptiveJobs(
  tzText: string,
  supplierText: string,
  requirements: any[],
  strategy: AnalysisStrategy
): Promise<AdaptiveAnalysisJob[]> {

  console.log(`\n⚙️ [4/5] Generating ${strategy.name} analysis jobs...`);

  // 🟢 СТРАТЕГИЯ 1: FAST (маленькие документы)
  if (strategy.name === 'FAST') {
    console.log(`✓ Using FAST strategy: single full-context job`);

      // ✅ Check if KP needs chunking
      const REAL_TOKEN_RATIO = 0.85;
      const tzTokens = Math.ceil(tzText.length * REAL_TOKEN_RATIO);
      const promptTokens = 8000;
      const responseTokens = 4096;
      const bufferTokens = 5000;
      const availableKpTokens = MAX_SAFE_TOKENS - tzTokens - promptTokens - responseTokens - bufferTokens;
      const safeKpChars = Math.floor(availableKpTokens / REAL_TOKEN_RATIO);
      
      // If KP fits in one job, use it
      if (supplierText.length <= safeKpChars) {
        const kpTokens = Math.ceil(supplierText.length * REAL_TOKEN_RATIO);
        const totalTokens = tzTokens + kpTokens + promptTokens + responseTokens + bufferTokens;
        
        const job: AdaptiveAnalysisJob = {
          job_id: 'full_analysis',
          strategy: 'FAST',
          tz_content: tzText,
          supplier_content: supplierText,
          requirements,
          total_tokens: totalTokens,
          safe_for_deepseek: totalTokens < MAX_SAFE_TOKENS
        };
        
        console.log(`✓ Single job created: ${totalTokens.toLocaleString()} tokens`);
        return [job];
      }
      
      // Otherwise, split into chunks
      console.warn(`⚠️ KP too large for single job, using chunk-based approach`);
      return createChunkedJobs(tzText, supplierText, requirements, 'FAST');
    }
    
    // If we reach here, FAST failed and we should switch to BALANCED
    console.warn(`⚠️ FAST strategy failed, switching to BALANCED strategy`);
    strategy.name = 'BALANCED';
    strategy.parallelJobs = 3;
    strategy.chunkTZ = true;
    strategy.sendFullTZ = true;
  }

  // 🟡 СТРАТЕГИЯ 2: BALANCED (средние документы) или fallback из FAST
  if (strategy.name === 'BALANCED') {
    const { segmentTZ } = await import('./tzSegmenter');
    const { mapSectionsAndCreateJobs } = await import('./structuredComplianceAnalyzer');

    const tzSections = await segmentTZ(tzText);
    
    console.log(`✓ ТЗ segmented into ${tzSections.length} sections`);

    // ✅ NEW LOGIC: If TZ is structured - use section mapping!
    if (tzSections.length > 0) {
      console.log(`\n🏗️ Using STRUCTURED analysis (section-to-section mapping)`);

      try {
        const { mapSectionsAndCreateJobs } = await import('./structuredComplianceAnalyzer');
        
        const structuredJobs = await mapSectionsAndCreateJobs(
          tzText,
          tzSections,
          supplierText,
          requirements
        );

        if (structuredJobs.length > 0) {
          console.log(`✓ Structured analysis generated ${structuredJobs.length} jobs`);
          return structuredJobs as any;
        }

        console.warn(`⚠️ Structured analysis returned 0 jobs, falling back...`);
      } catch (error) {
        console.error(`❌ Structured analysis error: ${(error as Error).message}`);
        console.warn(`   Falling back to fallback strategy...`);
      }
    }

    // ⚠️ FALLBACK: Если разбиение не сработало (0 разделов)
    // → Использовать chunk-based approach для больших КП
    if (tzSections.length === 0) {
      console.warn(`\n⚠️ No sections found in ТЗ, using chunk-based fallback`);
      console.warn(`   This happens when ТЗ is very small or has no structure`);

      // ✅ Use chunk-based approach instead of aggressive truncation
      const REAL_TOKEN_RATIO = 0.85;
      const tzTokens = Math.ceil(tzText.length * REAL_TOKEN_RATIO);
      const promptTokens = 8000;
      const responseTokens = 4096;
      const bufferTokens = 5000;
      
      // Calculate safe KP size per job
      const availableKpTokens = MAX_SAFE_TOKENS - tzTokens - promptTokens - responseTokens - bufferTokens;
      const safeKpChars = Math.floor(availableKpTokens / REAL_TOKEN_RATIO);
      
      // If KP fits in one job, use it
      if (supplierText.length <= safeKpChars) {
        const kpTokens = Math.ceil(supplierText.length * REAL_TOKEN_RATIO);
        const totalTokens = tzTokens + kpTokens + promptTokens + responseTokens + bufferTokens;
        
        return [
          {
            job_id: 'fallback_full_analysis',
            strategy: 'FALLBACK',
            tz_content: tzText,
            supplier_content: supplierText,
            requirements,
            total_tokens: totalTokens,
            safe_for_deepseek: totalTokens < MAX_SAFE_TOKENS
          }
        ];
      }
      
      // Otherwise, split into chunks
      return createChunkedJobs(tzText, supplierText, requirements, 'FALLBACK');
    }

    // ✅ Использовать новую структурированную логику сопоставления
    const structuredJobs = await mapSectionsAndCreateJobs(
      tzText,
      tzSections,
      supplierText,
      requirements
    );

    // Конвертировать в AdaptiveAnalysisJob формат
    const jobs: AdaptiveAnalysisJob[] = structuredJobs.map(job => ({
      job_id: job.job_id,
      strategy: 'BALANCED',
      tz_content: job.tz_full_text,  // Полное ТЗ для контекста
      supplier_content: job.supplier_section_content,
      requirements: job.requirements,
      total_tokens: job.total_tokens,
      safe_for_deepseek: job.safe_for_deepseek
    }));

    // ⚠️ FALLBACK 2: Если jobs = 0 (нет requirements для найденных разделов)
    if (jobs.length === 0) {
      console.warn(`\n⚠️ No jobs generated from sections, using chunk-based fallback`);

      // ✅ Use chunk-based approach instead of aggressive truncation
      return createChunkedJobs(tzText, supplierText, requirements, 'FALLBACK');
    }

    console.log(`✓ Generated ${jobs.length} jobs (${jobs.filter(j => j.safe_for_deepseek).length} safe)`);
    return jobs;
  }

  // 🔴 СТРАТЕГИЯ 3: HEAVY (большие документы)
  if (strategy.name === 'HEAVY') {
    // Для больших ТЗ - использовать структурированное сопоставление
    const { segmentTZ } = await import('./tzSegmenter');
    const { mapSectionsAndCreateJobs } = await import('./structuredComplianceAnalyzer');

    const tzSections = await segmentTZ(tzText);
    
    console.log(`✓ ТЗ segmented into ${tzSections.length} sections`);

    // ✅ NEW LOGIC: If TZ is structured - use section mapping!
    if (tzSections.length > 0) {
      console.log(`\n🏗️ Using STRUCTURED analysis (section-to-section mapping)`);

      try {
        const { mapSectionsAndCreateJobs } = await import('./structuredComplianceAnalyzer');
        
        const structuredJobs = await mapSectionsAndCreateJobs(
          tzText,
          tzSections,
          supplierText,
          requirements
        );

        if (structuredJobs.length > 0) {
          console.log(`✓ Structured analysis generated ${structuredJobs.length} jobs`);
          return structuredJobs as any;
        }

        console.warn(`⚠️ Structured analysis returned 0 jobs, falling back...`);
      } catch (error) {
        console.error(`❌ Structured analysis error: ${(error as Error).message}`);
        console.warn(`   Falling back to fallback strategy...`);
      }
    }

    // ⚠️ FALLBACK: Если разбиение не сработало (0 разделов)
    if (tzSections.length === 0) {
      console.warn(`\n⚠️ No sections found in ТЗ, using chunk-based fallback`);
      console.warn(`   This happens when ТЗ is very small or has no structure`);

      // ✅ Use chunk-based approach instead of aggressive truncation
      const REAL_TOKEN_RATIO = 0.85;
      const tzTokens = Math.ceil(tzText.length * REAL_TOKEN_RATIO);
      const promptTokens = 8000;
      const responseTokens = 4096;
      const bufferTokens = 5000;
      
      // Calculate safe KP size per job
      const availableKpTokens = MAX_SAFE_TOKENS - tzTokens - promptTokens - responseTokens - bufferTokens;
      const safeKpChars = Math.floor(availableKpTokens / REAL_TOKEN_RATIO);
      
      // If KP fits in one job, use it
      if (supplierText.length <= safeKpChars) {
        const kpTokens = Math.ceil(supplierText.length * REAL_TOKEN_RATIO);
        const totalTokens = tzTokens + kpTokens + promptTokens + responseTokens + bufferTokens;
        
        return [
          {
            job_id: 'fallback_full_analysis',
            strategy: 'FALLBACK',
            tz_content: tzText,
            supplier_content: supplierText,
            requirements,
            total_tokens: totalTokens,
            safe_for_deepseek: totalTokens < MAX_SAFE_TOKENS
          }
        ];
      }
      
      // Otherwise, split into chunks
      return createChunkedJobs(tzText, supplierText, requirements, 'FALLBACK');
    }

    // ✅ Использовать новую структурированную логику сопоставления
    const structuredJobs = await mapSectionsAndCreateJobs(
      tzText,
      tzSections,
      supplierText,
      requirements
    );

    // Конвертировать в AdaptiveAnalysisJob формат
    // Для HEAVY стратегии - отправляем только раздел ТЗ (не полный)
    const jobs: AdaptiveAnalysisJob[] = structuredJobs.map(job => {
      // Для больших документов можно отправить только раздел ТЗ
      // Но лучше оставить полный ТЗ для контекста, если размер позволяет
      const useFullTZ = job.total_tokens < 40000; // Если меньше 40K токенов - отправляем полный ТЗ
      
      // ✅ Использовать точный подсчет токенов с промптом
      const jobTokens = estimateTokensWithPrompt(
        useFullTZ ? job.tz_full_text : job.tz_section_content,
        job.supplier_section_content,
        job.requirements.length
      );
      
      return {
        job_id: job.job_id,
        strategy: 'HEAVY',
        tz_content: useFullTZ ? job.tz_full_text : job.tz_section_content,
        supplier_content: job.supplier_section_content,
        requirements: job.requirements,
        total_tokens: jobTokens,
        safe_for_deepseek: false
      };
    });

    // Проверка безопасности для каждого job (токены уже подсчитаны при создании)
    for (const job of jobs) {
      job.safe_for_deepseek = job.total_tokens < MAX_SAFE_TOKENS;
      
      if (!job.safe_for_deepseek) {
        console.warn(`⚠️ Job ${job.job_id} exceeds ${MAX_SAFE_TOKENS.toLocaleString()} tokens (${job.total_tokens.toLocaleString()})`);
      } else {
        console.log(`✓ Job ${job.job_id}: ${job.total_tokens.toLocaleString()} tokens (safe)`);
      }
    }

    // ⚠️ FALLBACK 2: Если jobs = 0 (нет requirements для найденных разделов)
    if (jobs.length === 0) {
      console.warn(`\n⚠️ No jobs generated from sections, using chunk-based fallback`);

      // ✅ Use chunk-based approach instead of aggressive truncation
      return createChunkedJobs(tzText, supplierText, requirements, 'FALLBACK');
    }

    console.log(`✓ Generated ${jobs.length} jobs (${jobs.filter(j => j.safe_for_deepseek).length} safe)`);
    return jobs;
  }

  return [];
}

/**
 * Базовый подсчет токенов для текста (СТАРЫЙ метод - оставлен для обратной совместимости)
 */
function estimateTokens(text: string): number {
  // 1 токен ≈ 2.8 символам для русского текста (НЕПРАВИЛЬНО!)
  return Math.ceil(text.length / 2.8);
}

/**
 * РЕАЛЬНЫЙ подсчет токенов на основе ошибок DeepSeek
 * Реальный коэффициент: 133,861 tokens / 160,200 chars = 0.835
 * Используем 0.85 для безопасности
 */
function estimateTokensReal(text: string): number {
  const REAL_TOKEN_RATIO = 0.85;  // Реальный коэффициент из ошибок DeepSeek
  return Math.ceil(text.length * REAL_TOKEN_RATIO);
}

/**
 * Точный подсчет токенов с учетом промпта, ответа и буфера (использует РЕАЛЬНЫЙ коэффициент)
 */
function estimateTokensWithPrompt(
  tzText: string,
  supplierText: string,
  requirementsCount: number
): number {
  // Документы: ТЗ + КП (используем РЕАЛЬНЫЙ коэффициент)
  const tzTokens = estimateTokensReal(tzText);
  const kpTokens = estimateTokensReal(supplierText);
  const documentsTokens = tzTokens + kpTokens;
  
  // Промпт: системное сообщение, инструкции, примеры (~8K токенов)
  const promptTokens = 8000;
  
  // Ответ: max_tokens для completion (4K)
  const responseTokens = 4096;
  
  // Буфер безопасности (большой запас)
  const bufferTokens = 5000;
  
  const total = documentsTokens + promptTokens + responseTokens + bufferTokens;
  
  return total;
}

// Максимальное безопасное количество токенов (131K лимит DeepSeek - 11K буфер)
const MAX_SAFE_TOKENS = 120000;

