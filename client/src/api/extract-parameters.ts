/**
 * API функции для работы с извлечением параметров из ответов поставщиков
 */
import { apiClient } from "./api-client";

/**
 * Интерфейс для результатов анализа
 */
export interface AnalysisResult {
  id: number;
  requestId: number;
  completedAt: string;
  data: any; // Структура данных может быть сложной и зависит от типа анализа
  parameters: string[];
  suppliers: {
    id: number;
    name: string;
    email: string;
    responseIds: number[];
  }[];
}

/**
 * Статус извлечения параметров
 */
export interface ExtractionStatus {
  requestId: number;
  total: number;
  completed: number;
  inProgress: boolean;
  completedAt?: string;
}

/**
 * Извлечение параметров из сообщения/ответа поставщика
 */
export async function extractParametersFromResponse(
  responseId: number,
  parameters: string[] = []
): Promise<Record<string, string>> {
  try {
    const response = await apiClient.post<{ parameters: Record<string, string> }>(
      `/api/extract-parameters/response/${responseId}`,
      { parameters }
    );
    return response.parameters;
  } catch (error) {
    console.error(`Ошибка при извлечении параметров из ответа ${responseId}:`, error);
    return {};
  }
}

/**
 * Запуск извлечения параметров для всех ответов в запросе
 */
export async function extractParametersForRequest(requestId: number): Promise<boolean> {
  try {
    await apiClient.post<void>(`/api/extract-parameters/request/${requestId}`, {});
    return true;
  } catch (error) {
    console.error(`Ошибка при запуске извлечения параметров для запроса ${requestId}:`, error);
    return false;
  }
}

/**
 * Получение статуса извлечения параметров для запроса
 */
export async function getParameterExtractionStatus(requestId: number): Promise<ExtractionStatus> {
  try {
    return await apiClient.get<ExtractionStatus>(`/api/extract-parameters/status/${requestId}`);
  } catch (error) {
    console.error(`Ошибка при получении статуса извлечения параметров для запроса ${requestId}:`, error);
    return {
      requestId,
      total: 0,
      completed: 0,
      inProgress: false
    };
  }
}

/**
 * Генерация сравнительной таблицы параметров для запроса
 */
export async function generateComparisonTable(
  requestId: number,
  parameters: string[] = []
): Promise<{ success: boolean; analysisId?: number }> {
  try {
    const response = await apiClient.post<{ success: boolean; analysisId: number }>(
      `/api/generate-comparison`,
      {
        requestId,
        parameters
      }
    );
    return {
      success: response.success,
      analysisId: response.analysisId
    };
  } catch (error) {
    console.error(`Ошибка при генерации сравнительной таблицы для запроса ${requestId}:`, error);
    return { success: false };
  }
}

/**
 * Получение результатов сравнительного анализа для запроса
 */
export async function getAnalysisResults(requestId: number): Promise<AnalysisResult | null> {
  try {
    return await apiClient.get<AnalysisResult>(`/api/analysis-results/${requestId}`);
  } catch (error) {
    console.error(`Ошибка при получении результатов анализа для запроса ${requestId}:`, error);
    return null;
  }
}