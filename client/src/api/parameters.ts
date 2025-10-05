/**
 * API функции для работы с параметрами из ответов поставщиков
 */
import { apiClient } from "./api-client";

/**
 * Интерфейс параметра из ответа поставщика
 */
export interface ParameterValue {
  id: number;
  responseId: number;
  parameterName: string;
  parameterValue: string;
  isAutoExtracted: boolean;
  confidence?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Интерфейс для опций извлечения параметров
 */
export interface ExtractParametersOptions {
  responseId: number;
  parameters?: string[];
  useAI?: boolean;
}

/**
 * Получение всех параметров для конкретного ответа
 */
export async function getParametersForResponse(responseId: number): Promise<ParameterValue[]> {
  try {
    return await apiClient.get<ParameterValue[]>(`/api/parameters/response/${responseId}`);
  } catch (error) {
    console.error(`Ошибка при получении параметров для ответа ${responseId}:`, error);
    return [];
  }
}

/**
 * Получение всех параметров для запроса
 */
export async function getParametersForRequest(requestId: number): Promise<Record<number, ParameterValue[]>> {
  try {
    return await apiClient.get<Record<number, ParameterValue[]>>(`/api/parameters/request/${requestId}`);
  } catch (error) {
    console.error(`Ошибка при получении параметров для запроса ${requestId}:`, error);
    return {};
  }
}

/**
 * Создание нового параметра для ответа
 */
export async function createParameter(
  responseId: number,
  data: { parameterName: string; parameterValue: string; isAutoExtracted?: boolean }
): Promise<ParameterValue> {
  try {
    return await apiClient.post<ParameterValue>(`/api/parameters/response/${responseId}`, data);
  } catch (error) {
    console.error(`Ошибка при создании параметра для ответа ${responseId}:`, error);
    throw error;
  }
}

/**
 * Обновление параметра
 */
export async function updateParameter(
  parameterId: number,
  data: { parameterName?: string; parameterValue?: string }
): Promise<ParameterValue> {
  try {
    return await apiClient.put<ParameterValue>(`/api/parameters/${parameterId}`, data);
  } catch (error) {
    console.error(`Ошибка при обновлении параметра ${parameterId}:`, error);
    throw error;
  }
}

/**
 * Удаление параметра
 */
export async function deleteParameter(parameterId: number): Promise<void> {
  try {
    await apiClient.delete<void>(`/api/parameters/${parameterId}`);
  } catch (error) {
    console.error(`Ошибка при удалении параметра ${parameterId}:`, error);
    throw error;
  }
}

/**
 * Получение уникального списка имен параметров для запроса
 */
export async function getUniqueParameterNames(requestId: number): Promise<string[]> {
  try {
    return await apiClient.get<string[]>(`/api/parameters/request/${requestId}/names`);
  } catch (error) {
    console.error(`Ошибка при получении уникальных имен параметров для запроса ${requestId}:`, error);
    return [];
  }
}

/**
 * Массовое добавление параметров для ответа
 */
export async function bulkCreateParameters(
  responseId: number,
  parameters: { parameterName: string; parameterValue: string; isAutoExtracted?: boolean }[]
): Promise<ParameterValue[]> {
  try {
    return await apiClient.post<ParameterValue[]>(`/api/parameters/response/${responseId}/bulk`, {
      parameters
    });
  } catch (error) {
    console.error(`Ошибка при массовом создании параметров для ответа ${responseId}:`, error);
    throw error;
  }
}

/**
 * Получение извлеченных параметров для ответа
 */
export async function getExtractedParameters(responseId: number): Promise<{
  parameters: Record<string, string> | Array<{ name: string; value: string; source?: string; confidence?: number }>;
}> {
  try {
    return await apiClient.get<{
      parameters: Record<string, string> | Array<{ name: string; value: string; source?: string; confidence?: number }>;
    }>(`/api/supplier-responses/${responseId}/parameters`);
  } catch (error) {
    console.error(`Ошибка при получении извлеченных параметров для ответа ${responseId}:`, error);
    return { parameters: {} };
  }
}

/**
 * Получение списка параметров для запроса
 */
export async function getRequestParameters(requestId: number): Promise<string[]> {
  try {
    return await apiClient.get<string[]>(`/api/parameters/request/${requestId}/list`);
  } catch (error) {
    console.error(`Ошибка при получении списка параметров для запроса ${requestId}:`, error);
    return [];
  }
}

/**
 * Извлечение параметров для ответа с использованием AI
 */
export async function extractParameters(options: ExtractParametersOptions): Promise<{
  success: boolean;
  parameters: Record<string, string> | Array<{ name: string; value: string; source?: string; confidence?: number }>;
}> {
  try {
    return await apiClient.post<{
      success: boolean;
      parameters: Record<string, string> | Array<{ name: string; value: string; source?: string; confidence?: number }>;
    }>('/api/extract-parameters', options);
  } catch (error) {
    console.error(`Ошибка при извлечении параметров для ответа ${options.responseId}:`, error);
    return { success: false, parameters: {} };
  }
}