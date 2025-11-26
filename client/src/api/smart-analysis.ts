import axios from 'axios';

export interface SmartAnalysisResponse {
  success: boolean;
  analysis_id: number;
  compliance_percentage: number;
  summary: {
    total: number;
    compliant: number;
    partial: number;
    non_compliant: number;
    missing: number;
  };
  metadata: {
    jobs_created: number;
    jobs_analyzed: number;
    jobs_oversized?: number;
    analysis_duration_seconds: number;
    requirements_total: number;
    processing_completed_at: string;
  };
}

/**
 * Запустить Smart Analysis (новый быстрый метод)
 */
export async function startSmartAnalysis(
  projectId: number,
  supplierId: number
): Promise<SmartAnalysisResponse> {
  const response = await axios.post(
    `/api/analysis-projects/${projectId}/smart-compliance-analysis`,
    { supplierId },
    { withCredentials: true }
  );

  return response.data;
}

/**
 * Получить результаты анализа (если нужно загрузить позже)
 */
export async function getAnalysisResults(analysisId: number) {
  const response = await axios.get(
    `/api/compliance-analysis/${analysisId}`,
    { withCredentials: true }
  );
  return response.data;
}





