/**
 * API функции для работы с визитной карточкой пользователя
 */
import { apiClient } from "./api-client";

/**
 * Интерфейс данных визитной карточки
 */
export interface BusinessCardData {
  companyName?: string;
  contactName?: string;
  position?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  logo?: string; // base64 encoded logo
  additionalInfo?: string;
}

/**
 * Получение визитной карточки текущего пользователя
 */
export async function getBusinessCard(): Promise<BusinessCardData> {
  try {
    return await apiClient.get<BusinessCardData>('/api/business-card');
  } catch (error) {
    console.error('Ошибка при получении визитной карточки:', error);
    return {};
  }
}

/**
 * Обновление визитной карточки пользователя
 */
export async function updateBusinessCard(data: BusinessCardData): Promise<BusinessCardData> {
  try {
    return await apiClient.put<BusinessCardData>('/api/business-card', data);
  } catch (error) {
    console.error('Ошибка при обновлении визитной карточки:', error);
    throw error;
  }
}

/**
 * Загрузка логотипа для визитной карточки
 */
export async function uploadBusinessCardLogo(file: File): Promise<{ logoUrl: string }> {
  try {
    const formData = new FormData();
    formData.append('logo', file);
    
    // Используем метод из apiClient, т.к. он корректно обрабатывает FormData
    return await apiClient.post<{ logoUrl: string }>('/api/business-card/logo', formData);
  } catch (error) {
    console.error('Ошибка при загрузке логотипа:', error);
    throw error;
  }
}

/**
 * Проверка статуса заполнения онбординга (визитная карточка + др. параметры)
 */
export async function getOnboardingStatus(): Promise<{ completed: boolean }> {
  try {
    return await apiClient.get<{ completed: boolean }>('/api/auth/onboarding');
  } catch (error) {
    console.error('Ошибка при получении статуса онбординга:', error);
    return { completed: false };
  }
}

/**
 * Отметка об успешном завершении онбординга
 */
export async function completeOnboarding(): Promise<{ success: boolean }> {
  try {
    return await apiClient.post<{ success: boolean }>('/api/auth/onboarding/complete', {});
  } catch (error) {
    console.error('Ошибка при завершении онбординга:', error);
    return { success: false };
  }
}