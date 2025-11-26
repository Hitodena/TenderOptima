// server/services/analysisJobGenerator.ts

export interface AnalysisJob {
  job_id: string;
  tz_full_text: string;           // ПОЛНЫЙ ТЗ
  tz_section_content: string;     // Конкретный раздел
  tz_section_number: string;
  supplier_section_content: string;
  supplier_section_id: string;
  requirements: Array<{
    tech_spec_number: string;
    extracted_value: string;
  }>;
  total_tokens: number;
  safe_for_deepseek: boolean;
}

/**
 * Создать jobs для параллельного анализа
 */
export async function generateAnalysisJobs(
  tzText: string,
  supplierText: string,
  requirements: any[]
): Promise<AnalysisJob[]> {

  console.log('🚀 Generating analysis jobs...\n');

  // Шаг 1: Разбить ТЗ на разделы
  const tzSections = await segmentTZ(tzText);
  console.log(`✓ TZ split into ${tzSections.length} sections\n`);

  // Шаг 2: Найти соответствующие части КП
  const supplierSections = await matchSupplierToTZ(
    supplierText,
    tzSections
  );
  console.log(`✓ Matched ${supplierSections.length} supplier sections\n`);

  // Шаг 3: Создать jobs (пара для каждого раздела)
  const jobs: AnalysisJob[] = [];

  for (const tzSection of tzSections) {
    // Найти требования для этого раздела
    const sectionReqs = requirements.filter(r =>
      r.tech_spec_number.startsWith(tzSection.number)
    );

    if (sectionReqs.length === 0) {
      console.log(`⏭️  Skipping ${tzSection.number} (no requirements)`);
      continue;
    }

    // Найти соответствующую часть КП
    const matchingSupplierSections = supplierSections.filter(
      s => s.tz_number === tzSection.number
    );

    if (matchingSupplierSections.length === 0) {
      console.log(
        `⚠️  No supplier section for ${tzSection.number}, creating empty job`
      );

      // Всё равно создаём job (для пустого ответа)
      matchingSupplierSections.push({
        section_id: `${tzSection.number}_missing`,
        tz_number: tzSection.number,
        supplier_keywords: [],
        content: '[NOT FOUND IN SUPPLIER DOCUMENT]',
        tokens: 0,
        confidence: 0,
        exact_match: false
      });
    }

    // Для каждой найденной части КП создать отдельный job
    for (const supplierSec of matchingSupplierSections) {
      const job: AnalysisJob = {
        job_id: `${tzSection.number}_v_${supplierSec.section_id}`,
        tz_full_text: tzText,
        tz_section_content: tzSection.content,
        tz_section_number: tzSection.number,
        supplier_section_content: supplierSec.content,
        supplier_section_id: supplierSec.section_id,
        requirements: sectionReqs,
        total_tokens: 0,
        safe_for_deepseek: false
      };

      // Рассчитать токены
      job.total_tokens = estimateJobTokens(job);
      job.safe_for_deepseek = job.total_tokens < 60000;

      jobs.push(job);
    }
  }

  // Шаг 4: Вывести статистику
  console.log('\n📊 Generated jobs:');
  console.log(
    `Total: ${jobs.length} | ` +
    `Safe: ${jobs.filter(j => j.safe_for_deepseek).length} | ` +
    `Oversized: ${jobs.filter(j => !j.safe_for_deepseek).length}`
  );

  // Вывести детали каждого job
  for (const job of jobs) {
    const status = job.safe_for_deepseek ? '✅' : '⚠️';
    console.log(
      `  ${status} ${job.job_id}: ${job.total_tokens.toLocaleString()} tokens, ` +
      `${job.requirements.length} requirements`
    );
  }

  return jobs;
}

function estimateJobTokens(job: AnalysisJob): number {
  const prompt = `You are a technical compliance analyst...`; // примерный размер
  
  return Math.ceil(
    (job.tz_full_text.length +
      job.supplier_section_content.length +
      prompt.length +
      job.requirements.reduce((sum, r) => sum + r.extracted_value.length, 0)) /
    2.8
  );
}

// Импорты
import { segmentTZ, TZSection } from './tzSegmenter';
import { matchSupplierToTZ, SupplierSection } from './supplierDocumentAnalyzer';
