// server/services/adaptiveAnalysisStrategy.ts

export interface AnalysisStrategy {
  name: string;
  description: string;
  sendFullTZ: boolean;
  chunkTZ: boolean;
  parallelJobs: number;
  estimatedTime: string;
}

/**
 * Определить оптимальную стратегию на основе размера документов
 */
export function selectAnalysisStrategy(
  tzSize: number,
  kpSize: number
): AnalysisStrategy {

  console.log(`\n📊 Analyzing document sizes...`);
  console.log(`   ТЗ: ${(tzSize / 1024).toFixed(1)} KB`);
  console.log(`   КП: ${(kpSize / 1024).toFixed(1)} KB`);

  // 🟢 СТРАТЕГИЯ 1: Маленькие документы (ТЗ < 50KB)
  if (tzSize < 50000 && kpSize < 100000) {
    console.log(`\n✅ Strategy 1: FAST (Small documents)`);
    return {
      name: 'FAST',
      description: 'Full context, no segmentation',
      sendFullTZ: true,
      chunkTZ: false,
      parallelJobs: 1,  // Один запрос
      estimatedTime: '5-10 сек'
    };
  }

  // 🟡 СТРАТЕГИЯ 2: Средние документы (ТЗ 50KB-200KB)
  if (tzSize < 200000 && kpSize < 500000) {
    console.log(`\n✅ Strategy 2: BALANCED (Medium documents)`);
    return {
      name: 'BALANCED',
      description: 'Segment by structure, parallel processing',
      sendFullTZ: true,
      chunkTZ: true,  // Разбить на разделы
      parallelJobs: 3,  // 3 параллельных
      estimatedTime: '10-15 сек'
    };
  }

  // 🔴 СТРАТЕГИЯ 3: Большие документы (ТЗ > 200KB)
  console.log(`\n✅ Strategy 3: HEAVY (Large documents)`);
  return {
    name: 'HEAVY',
    description: 'Intelligent chunking with context preservation',
    sendFullTZ: false,  // Отправить только релевантные части
    chunkTZ: true,
    parallelJobs: 5,  // 5 параллельных
    estimatedTime: '15-25 сек'
  };
}





