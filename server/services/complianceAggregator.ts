// server/services/complianceAggregator.ts

import { Pool } from 'pg';
import { ComplianceResult } from './deepseekParallelAnalyzer';

export async function aggregateAndSaveResults(
  projectId: number,
  supplierId: number,
  jobResults: Map<string, ComplianceResult[]>,
  pool: Pool
): Promise<{
  analysis_id: number;
  compliance_percentage: number;
  summary: {
    total: number;
    compliant: number;
    partial: number;
    non_compliant: number;
    missing: number;
  };
}> {

  // Собрать все результаты
  const allResults: ComplianceResult[] = [];
  for (const results of jobResults.values()) {
    allResults.push(...results);
  }

  console.log(`\n📊 Aggregating ${allResults.length} results...`);

  // Дедупликировать (если требование появилось несколько раз)
  const deduped = deduplicateResults(allResults);

  console.log(
    `✓ After dedup: ${deduped.length} unique requirements analyzed`
  );

  // Вычислить статистику
  const stats = {
    total: deduped.length,
    compliant: deduped.filter(r => r.status === 'compliant').length,
    partial: deduped.filter(r => r.status === 'partial').length,
    non_compliant: deduped.filter(
      r => r.status === 'non_compliant'
    ).length,
    missing: deduped.filter(r => r.status === 'missing').length
  };

  const compliancePercentage =
    stats.total > 0 ? (stats.compliant / stats.total) * 100 : 0;

  console.log(`\n📈 Results:`);
  console.log(`   Compliant: ${stats.compliant}/${stats.total} (${compliancePercentage.toFixed(1)}%)`);
  console.log(`   Partial: ${stats.partial}`);
  console.log(`   Non-compliant: ${stats.non_compliant}`);
  console.log(`   Missing: ${stats.missing}`);

  // Извлечь gaps и recommendations из результатов
  const gapsIdentified: string[] = [];
  const recommendations: string[] = [];

  for (const result of deduped) {
    if (result.status === 'missing' || result.status === 'non_compliant') {
      const gap = `${result.tech_spec_number}: ${result.requirement} - ${result.evidence || 'Not found in supplier document'}`;
      if (gap.length < 500) { // Ограничить длину
        gapsIdentified.push(gap);
      }
    }
    
    if (result.status === 'partial' && result.evidence) {
      const recommendation = `${result.tech_spec_number}: ${result.evidence}`;
      if (recommendation.length < 500) {
        recommendations.push(recommendation);
      }
    }
  }

  // Ограничить количество gaps и recommendations
  const limitedGaps = gapsIdentified.slice(0, 50);
  const limitedRecommendations = recommendations.slice(0, 50);

  // Сохранить в БД
  const analysisData = JSON.stringify(deduped);

  const result = await pool.query(
    `INSERT INTO compliance_analysis 
     (project_id, supplier_id, analysis_data, compliance_percentage,
      gaps_identified, recommendations, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id`,
    [
      projectId,
      supplierId,
      analysisData,
      compliancePercentage,
      limitedGaps,
      limitedRecommendations
    ]
  );

  const analysisId = result.rows[0].id;
  console.log(`\n✅ Analysis saved with ID: ${analysisId}`);
  console.log(`   Gaps identified: ${limitedGaps.length}`);
  console.log(`   Recommendations: ${limitedRecommendations.length}`);

  return {
    analysis_id: analysisId,
    compliance_percentage: compliancePercentage,
    summary: stats
  };
}

/**
 * Дедупликировать результаты (если требование выстанавливалось несколько раз)
 */
function deduplicateResults(
  results: ComplianceResult[]
): ComplianceResult[] {

  const grouped = new Map<string, ComplianceResult[]>();

  // Группировать по номеру требования
  for (const result of results) {
    if (!grouped.has(result.tech_spec_number)) {
      grouped.set(result.tech_spec_number, []);
    }
    grouped.get(result.tech_spec_number)!.push(result);
  }

  // Для каждой группы выбрать лучший результат
  const deduped: ComplianceResult[] = [];

  for (const [specNumber, resultGroup] of grouped) {
    // Приоритет: compliant > partial > non_compliant > missing
    const priorities: Record<ComplianceResult['status'], number> = {
      compliant: 4,
      partial: 3,
      non_compliant: 2,
      missing: 1
    };

    const best = resultGroup.reduce((prev, current) => {
      const prevScore = priorities[prev.status] * 100 + prev.confidence;
      const currentScore =
        priorities[current.status] * 100 + current.confidence;

      return currentScore > prevScore ? current : prev;
    });

    deduped.push(best);
  }

  return deduped.sort(
    (a, b) =>
      parseInt(a.tech_spec_number.split('.')[0]) -
      parseInt(b.tech_spec_number.split('.')[0])
  );
}
