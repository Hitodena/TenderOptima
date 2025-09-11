/**
 * API функции для работы с запросами на поиск поставщиков
 */
import { apiClient } from "./api-client";

/**
 * Интерфейс запроса на поиск
 */
export interface SearchRequest {
  id: number;
  userId: number;
  title: string;
  description: string;
  productName: string;
  quantity: number;
  unit: string;
  budget?: number;
  currency?: string;
  deliveryDate?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  additionalRequirements?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  active: boolean;
  supplierCount?: number;
  responseCount?: number;
  parametersExtracted?: boolean;
  comparisonGenerated?: boolean;
}

/**
 * Интерфейс поставщика в запросе
 */
export interface RequestSupplier {
  id: number;
  requestId: number;
  supplierId: number;
  supplierName: string;
  supplierEmail: string;
  sentEmailIds?: number[];
  sentNotificationCount?: number;
  responded: boolean;
  responseId?: number;
  responseDate?: string;
  contactId?: number;
  hasResponded?: boolean;
}

/**
 * Получение списка запросов
 */
export async function getSearchRequests(
  filter?: { status?: string; active?: boolean }
): Promise<SearchRequest[]> {
  try {
    const query = filter ? new URLSearchParams(filter as any).toString() : '';
    const url = `/api/search-requests${query ? `?${query}` : ''}`;
    return await apiClient.get<SearchRequest[]>(url);
  } catch (error) {
    console.error('Ошибка при получении списка запросов:', error);
    return [];
  }
}

/**
 * Получение информации о запросе по ID
 */
export async function getSearchRequestById(requestId: number): Promise<SearchRequest | null> {
  try {
    return await apiClient.get<SearchRequest>(`/api/search-requests/${requestId}`);
  } catch (error) {
    console.error(`Ошибка при получении информации о запросе ${requestId}:`, error);
    return null;
  }
}

/**
 * Создание нового запроса
 */
export async function createSearchRequest(data: Partial<SearchRequest>): Promise<SearchRequest> {
  try {
    return await apiClient.post<SearchRequest>('/api/search-requests', data);
  } catch (error) {
    console.error('Ошибка при создании запроса:', error);
    throw error;
  }
}

/**
 * Обновление информации о запросе
 */
export async function updateSearchRequest(
  requestId: number,
  data: Partial<SearchRequest>
): Promise<SearchRequest> {
  try {
    return await apiClient.put<SearchRequest>(`/api/search-requests/${requestId}`, data);
  } catch (error) {
    console.error(`Ошибка при обновлении запроса ${requestId}:`, error);
    throw error;
  }
}

/**
 * Удаление запроса
 */
export async function deleteSearchRequest(requestId: number): Promise<void> {
  try {
    await apiClient.delete<void>(`/api/search-requests/${requestId}`);
  } catch (error) {
    console.error(`Ошибка при удалении запроса ${requestId}:`, error);
    throw error;
  }
}

/**
 * Получение списка поставщиков для запроса
 */
export async function getRequestSuppliers(requestId: number): Promise<RequestSupplier[]> {
  try {
    return await apiClient.get<RequestSupplier[]>(`/api/search-requests/${requestId}/suppliers`);
  } catch (error) {
    console.error(`Ошибка при получении поставщиков для запроса ${requestId}:`, error);
    return [];
  }
}

/**
 * Добавление поставщиков к запросу
 */
export async function addSuppliersToRequest(
  requestId: number,
  supplierIds: number[]
): Promise<RequestSupplier[]> {
  try {
    return await apiClient.post<RequestSupplier[]>(
      `/api/search-requests/${requestId}/suppliers`,
      { supplierIds }
    );
  } catch (error) {
    console.error(`Ошибка при добавлении поставщиков к запросу ${requestId}:`, error);
    throw error;
  }
}

/**
 * Удаление поставщика из запроса
 */
export async function removeSupplierFromRequest(
  requestId: number,
  supplierId: number
): Promise<void> {
  try {
    await apiClient.delete<void>(`/api/search-requests/${requestId}/suppliers/${supplierId}`);
  } catch (error) {
    console.error(`Ошибка при удалении поставщика ${supplierId} из запроса ${requestId}:`, error);
    throw error;
  }
}

/**
 * Отправка письма поставщикам запроса
 */
export async function sendEmailToSuppliers(
  requestId: number,
  data: {
    subject: string;
    body: string;
    supplierIds: number[];
  }
): Promise<{ success: boolean; sentCount: number }> {
  try {
    return await apiClient.post<{ success: boolean; sentCount: number }>(
      `/api/search-requests/${requestId}/send-email`,
      data
    );
  } catch (error) {
    console.error(`Ошибка при отправке писем поставщикам запроса ${requestId}:`, error);
    return { success: false, sentCount: 0 };
  }
}

/**
 * Клонирование запроса
 */
export async function cloneSearchRequest(
  requestId: number,
  options?: { includeSuppliers?: boolean; newTitle?: string }
): Promise<SearchRequest> {
  try {
    return await apiClient.post<SearchRequest>(`/api/search-requests/${requestId}/clone`, options);
  } catch (error) {
    console.error(`Ошибка при клонировании запроса ${requestId}:`, error);
    throw error;
  }
}

/**
 * Изменение статуса запроса
 */
export async function updateRequestStatus(
  requestId: number,
  status: string
): Promise<SearchRequest> {
  try {
    return await apiClient.put<SearchRequest>(
      `/api/search-requests/${requestId}/status`,
      { status }
    );
  } catch (error) {
    console.error(`Ошибка при обновлении статуса запроса ${requestId}:`, error);
    throw error;
  }
}