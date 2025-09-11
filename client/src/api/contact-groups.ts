/**
 * API функции для работы с группами контактов
 */
import { apiRequest } from "@/lib/queryClient";

export interface ContactGroup {
  id: number;
  name: string;
  description?: string;
  contactCount?: number;
  lastUpdated?: string;
  createdAt?: string;
}

export interface ContactInGroup {
  id: number;
  name: string;
  email: string;
  phone?: string;
  contactName?: string;
  contactGroupId: number;
}

export type ContactItem = {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  userId?: number | null;
};

/**
 * Получение списка всех групп контактов пользователя
 */
export async function getContactGroups(): Promise<ContactGroup[]> {
  try {
    return await apiRequest<ContactGroup[]>('/api/contact-groups', 'GET');
  } catch (error) {
    console.error('Ошибка при получении списка групп контактов:', error);
    return [];
  }
}

/**
 * Получение информации о конкретной группе контактов
 */
export async function getContactGroup(groupId: number): Promise<ContactGroup> {
  try {
    return await apiRequest<ContactGroup>(`/api/contact-groups/${groupId}`, 'GET');
  } catch (error) {
    console.error(`Ошибка при получении информации о группе ${groupId}:`, error);
    throw error;
  }
}

/**
 * Создание новой группы контактов
 */
export async function createContactGroup(data: Partial<ContactGroup>): Promise<ContactGroup> {
  try {
    // Делаем явный POST запрос на создание группы
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Получаем сохраненный токен доступа
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    };
    
    const response = await fetch('/api/contact-groups', options);
    
    if (!response.ok) {
      throw new Error(`Ошибка при создании группы: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка при создании группы контактов:', error);
    throw error;
  }
}

/**
 * Обновление информации о группе контактов
 */
export async function updateContactGroup(groupId: number, data: Partial<ContactGroup>): Promise<ContactGroup> {
  try {
    return await apiRequest<ContactGroup>(`/api/contact-groups/${groupId}`, 'PUT', data);
  } catch (error) {
    console.error(`Ошибка при обновлении группы ${groupId}:`, error);
    throw error;
  }
}

/**
 * Удаление группы контактов
 */
export async function deleteContactGroup(groupId: number): Promise<void> {
  try {
    // Используем правильный путь для удаления группы (POST на /api/contact-groups/:id/delete)
    await apiRequest<void>(`/api/contact-groups/${groupId}/delete`, 'POST');
  } catch (error) {
    console.error(`Ошибка при удалении группы ${groupId}:`, error);
    throw error;
  }
}

/**
 * Получение списка контактов в группе
 */
export async function getContactsInGroup(groupId: number): Promise<ContactInGroup[]> {
  try {
    const result = await apiRequest<ContactInGroup[]>(`/api/contact-groups/${groupId}/contacts`, 'GET');
    // Проверка, что response - это массив
    if (Array.isArray(result)) {
      return result;
    } else {
      console.error(`Неожиданный ответ от сервера для группы ${groupId}:`, result);
      return [];
    }
  } catch (error) {
    console.error(`Ошибка при получении контактов для группы ${groupId}:`, error);
    return [];
  }
}

/**
 * Добавление контактов в группу
 */
export async function addContactsToGroup(groupId: number, contacts: Partial<ContactItem>[]): Promise<void> {
  try {
    // Проверка валидности данных перед отправкой
    if (!Array.isArray(contacts) || contacts.length === 0) {
      console.error('Нет контактов для добавления в группу');
      return;
    }
    
    // Убедимся, что контакты содержат как минимум имя и email
    const validContacts = contacts.filter(c => c.name && c.email);
    if (validContacts.length === 0) {
      console.error('Нет валидных контактов для добавления (требуется имя и email)');
      return;
    }
    
    // Делаем явный POST запрос на добавление контактов
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Получаем сохраненный токен доступа
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({ contacts: validContacts })
    };
    
    const response = await fetch(`/api/contact-groups/${groupId}/add-contacts`, options);
    
    if (!response.ok) {
      throw new Error(`Ошибка при добавлении контактов: ${response.status} ${response.statusText}`);
    }
    
    console.log(`Успешно добавлено ${validContacts.length} контактов в группу ${groupId}`);
  } catch (error) {
    console.error(`Ошибка при добавлении контактов в группу ${groupId}:`, error);
    // Не пробрасываем ошибку, чтобы не блокировать UI
  }
}

/**
 * Удаление контакта из группы
 */
export async function removeContactFromGroup(groupId: number, contactId: number): Promise<void> {
  try {
    // Используем правильный эндпоинт для удаления контакта
    await apiRequest<void>(`/api/contact-items/${contactId}`, 'DELETE');
  } catch (error) {
    console.error(`Ошибка при удалении контакта ${contactId} из группы ${groupId}:`, error);
    throw error;
  }
}