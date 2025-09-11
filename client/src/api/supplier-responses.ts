import { SupplierResponse } from '../../../shared/schema';
import { apiRequest } from "@/lib/queryClient";

/**
 * Переключает статус "избранное" для ответа поставщика
 * @param id ID ответа поставщика
 * @returns Объект с информацией о статусе операции
 */
export async function toggleSupplierResponseFavorite(id: number): Promise<SupplierResponse> {
  try {
    // Используем apiRequest для автоматического добавления токена аутентификации
    const data = await apiRequest<SupplierResponse>(
      `/api/supplier-responses/${id}/toggle-favorite`, 
      'PATCH'
    );
    
    return data;
  } catch (error) {
    console.error('Ошибка при изменении статуса избранного:', error);
    throw error;
  }
}

/**
 * Помечает ответ поставщика как прочитанный
 * @param id ID ответа поставщика
 * @returns Обновленный ответ поставщика
 */
export async function markAsRead(id: number): Promise<SupplierResponse> {
  try {
    // Используем apiRequest для автоматического добавления токена аутентификации
    const data = await apiRequest<SupplierResponse>(
      `/api/supplier-responses/${id}/mark-read`, 
      'PATCH'
    );
    
    return data;
  } catch (error) {
    console.error('Ошибка при пометке ответа как прочитанного:', error);
    throw error;
  }
}