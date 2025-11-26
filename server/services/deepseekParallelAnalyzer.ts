// server/services/deepseekParallelAnalyzer.ts

/**
 * ⚠️ КРИТИЧЕСКИ ВАЖНО: Используется ВАША КОНФИГУРАЦИЯ из .env
 * Не создаём новый OpenAI клиент - используем единый экземпляр
 */

import OpenAI from 'openai';  // ✅ Top-level ES Module import
import { AnalysisJob } from './analysisJobGenerator';
import { AdaptiveAnalysisJob } from './adaptiveJobGenerator';

// ✅ ИСПОЛЬЗУЕМ ВАШИ ПЕРЕМЕННЫЕ ИЗ .env
// Убедитесь что в .env есть:
// DEEPSEEK_API_KEY=sk_xxx...
// DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 (опционально)

// Тип для совместимости со старыми и новыми jobs
type CompatibleJob = AnalysisJob | AdaptiveAnalysisJob;

export interface ComplianceResult {
  tech_spec_number: string;
  requirement: string;
  supplier_data: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'missing';
  confidence: number;
  evidence: string;
  source_quote: string;
}

// ✅ Singleton pattern: создаём клиент один раз при импорте модуля
let deepseekClient: OpenAI | null = null;

/**
 * Получить инициализированный OpenAI клиент
 * Используется ВАША конфигурация из .env
 * Singleton pattern - клиент создаётся один раз
 */
function getDeepseekClient(): OpenAI {
  if (!deepseekClient) {
    // Проверить что ключ есть
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error(
        '❌ DEEPSEEK_API_KEY not set in .env\n' +
        'Add to .env: DEEPSEEK_API_KEY=sk_...'
      );
    }

    deepseekClient = new OpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      timeout: 60000, // 60 сек timeout
      maxRetries: 3
    });

    console.log('✓ DeepSeek client initialized');
  }

  return deepseekClient;
}

/**
 * Анализировать все jobs параллельно с rate limiting
 * Поддерживает как AnalysisJob, так и AdaptiveAnalysisJob
 */
export async function analyzeJobsInParallel(
  jobs: CompatibleJob[],
  maxConcurrent: number = 3
): Promise<Map<string, ComplianceResult[]>> {

  const results = new Map<string, ComplianceResult[]>();
  const queue = [...jobs];
  const activeRequests = new Set<Promise<any>>();

  console.log(
    `\n🔄 Starting parallel analysis (${maxConcurrent} concurrent)...\n`
  );

  const startTime = Date.now();

  while (queue.length > 0 || activeRequests.size > 0) {
    // Запустить новые запросы
    while (
      activeRequests.size < maxConcurrent &&
      queue.length > 0
    ) {
      const job = queue.shift()!;

      const analysisPromise = analyzeJobWithRetry(job, results);
      activeRequests.add(analysisPromise);
      analysisPromise.finally(() => activeRequests.delete(analysisPromise));
    }

    // Ждать завершения одного запроса
    if (activeRequests.size > 0) {
      await Promise.race(activeRequests);
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ All jobs completed in ${elapsedTime}s`);

  return results;
}

/**
 * Анализировать job с retry logic
 */
async function analyzeJobWithRetry(
  job: CompatibleJob,
  results: Map<string, ComplianceResult[]>,
  retries: number = 3
): Promise<void> {

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Job ${job.job_id}] Attempt ${attempt}/${retries}...`);

      const result = await analyzeJob(job);
      results.set(job.job_id, result);

      console.log(
        `✅ [Job ${job.job_id}] Completed: ${result.length} requirements analyzed`
      );
      return;

    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error(`❌ [Job ${job.job_id}] Error:`, errorMsg);

      if (attempt === retries) {
        console.error(`   Max retries reached, skipping`);
        results.set(job.job_id, []);
        return;
      }

      // Exponential backoff
      const delayMs = Math.pow(2, attempt) * 1000;
      console.log(`   Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Анализировать один job в DeepSeek
 * ✅ Используется ВАША конфигурация
 * Поддерживает как AnalysisJob, так и AdaptiveAnalysisJob
 */
async function analyzeJob(job: CompatibleJob): Promise<ComplianceResult[]> {

  const openai = getDeepseekClient();

  const requirementsList = job.requirements
    .map((r, i) => `${i + 1}. [${r.tech_spec_number}] ${r.extracted_value}`)
    .join('\n');

  // Определить тип job и создать соответствующий промпт
  const isAdaptive = 'strategy' in job && 'tz_content' in job;
  
  let prompt: string;

  if (isAdaptive) {
    // AdaptiveAnalysisJob - используем tz_content и supplier_content
    const adaptiveJob = job as AdaptiveAnalysisJob;
    const sectionContext = adaptiveJob.strategy === 'FAST' 
      ? 'FULL DOCUMENT ANALYSIS (all sections)'
      : `Section ${adaptiveJob.job_id.replace('section_', '')}`;

    prompt = `You are a technical compliance analyst specializing in dairy equipment procurement.

📋 TECHNICAL SPECIFICATION (${adaptiveJob.strategy} strategy):
<tz_content>
${adaptiveJob.tz_content}
</tz_content>

📄 SUPPLIER'S OFFER:
<supplier_content>
${adaptiveJob.supplier_content}
</supplier_content>

🔍 REQUIREMENTS TO ANALYZE (${sectionContext}):
${requirementsList}

TASK:
1. Review the ТЗ content provided above
2. Compare supplier offer with ТЗ requirements
3. For EACH requirement listed above:
   - Determine if supplier addresses it: compliant | partial | non_compliant | missing
   - Extract exact quote from supplier text as evidence
   - Rate confidence 0-1
   - Provide brief explanation

Return ONLY valid JSON array, no other text:
[
  {
    "tech_spec_number": "1.1",
    "requirement": "Requirement text",
    "supplier_data": "Quote from supplier or 'Not found'",
    "status": "compliant",
    "confidence": 0.95,
    "evidence": "Why this status",
    "source_quote": "Direct quote"
  }
]`;
  } else {
    // AnalysisJob - используем старый формат
    const standardJob = job as AnalysisJob;
    prompt = `You are a technical compliance analyst specializing in dairy equipment procurement.

📋 FULL TECHNICAL SPECIFICATION (for reference and context):
<tz_full>
${standardJob.tz_full_text}
</tz_full>

🎯 FOCUS ON THIS SECTION (${standardJob.tz_section_number}):
<tz_section>
${standardJob.tz_section_content}
</tz_section>

📄 SUPPLIER'S OFFER FOR THIS SECTION:
<supplier_section>
${standardJob.supplier_section_content}
</supplier_section>

🔍 REQUIREMENTS TO ANALYZE (section ${standardJob.tz_section_number}):
${requirementsList}

TASK:
1. Review the full ТЗ for context (but focus on section ${standardJob.tz_section_number})
2. Compare supplier section with ТЗ requirements
3. For EACH requirement listed above:
   - Determine if supplier addresses it: compliant | partial | non_compliant | missing
   - Extract exact quote from supplier text as evidence
   - Rate confidence 0-1
   - Provide brief explanation

Return ONLY valid JSON array, no other text:
[
  {
    "tech_spec_number": "1.1",
    "requirement": "Requirement text",
    "supplier_data": "Quote from supplier or 'Not found'",
    "status": "compliant",
    "confidence": 0.95,
    "evidence": "Why this status",
    "source_quote": "Direct quote"
  }
]`;
  }

  try {
    console.log(`  📤 Sending to DeepSeek API...`);

    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4096,
      top_p: 0.9
    });

    const content = response.choices[0]?.message?.content || '';

    console.log(`  📥 Received response from DeepSeek`);

    // Парсить JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(
        `No JSON found in response. Response: ${content.substring(0, 200)}`
      );
    }

    const results = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(results)) {
      throw new Error('Response is not an array');
    }

    // Валидировать результаты
    return results.map((r: any) => ({
      tech_spec_number: r.tech_spec_number || 'UNKNOWN',
      requirement: r.requirement || '',
      supplier_data: r.supplier_data || 'Not found',
      status: validateStatus(r.status),
      confidence: Math.min(Math.max(r.confidence || 0.5, 0), 1),
      evidence: r.evidence || '',
      source_quote: r.source_quote || ''
    }));

  } catch (error) {
    const errorMsg = (error as Error).message;

    // Специфичные ошибки
    if (errorMsg.includes('401')) {
      throw new Error('🔑 Authentication error: Invalid DEEPSEEK_API_KEY in .env');
    }
    if (errorMsg.includes('429')) {
      throw new Error('⚠️ Rate limit exceeded. Waiting...');
    }
    if (errorMsg.includes('timeout')) {
      throw new Error('⏱️ Request timeout');
    }

    throw error;
  }
}

function validateStatus(status: any): ComplianceResult['status'] {
  const valid = [
    'compliant',
    'partial',
    'non_compliant',
    'missing'
  ];

  return valid.includes(status) ? status : 'missing';
}
