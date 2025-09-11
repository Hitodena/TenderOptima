/**
 * Централизованный клиент для выполнения API запросов с обработкой аутентификации.
 * Используется всеми API модулями для единообразной обработки запросов с токенами авторизации.
 */

// Типы HTTP-методов, поддерживаемых API клиентом
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * API клиент для взаимодействия с сервером
 */
class ApiClient {
  /**
   * Базовый URL для API запросов
   * @private
   */
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Выполнение GET-запроса
   * @param endpoint - Конечная точка API
   * @returns Результат запроса, преобразованный из JSON
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, 'GET');
  }

  /**
   * Выполнение POST-запроса
   * @param endpoint - Конечная точка API
   * @param data - Данные для отправки в теле запроса
   * @returns Результат запроса, преобразованный из JSON
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, 'POST', data);
  }

  /**
   * Выполнение PUT-запроса
   * @param endpoint - Конечная точка API
   * @param data - Данные для отправки в теле запроса
   * @returns Результат запроса, преобразованный из JSON
   */
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, 'PUT', data);
  }

  /**
   * Выполнение DELETE-запроса
   * @param endpoint - Конечная точка API
   * @param data - Данные для отправки в теле запроса (опционально)
   * @returns Результат запроса, преобразованный из JSON
   */
  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, 'DELETE', data);
  }

  /**
   * Выполнение HTTP-запроса с добавлением токена авторизации
   * @param endpoint - Конечная точка API
   * @param method - HTTP-метод (GET, POST, PUT, DELETE)
   * @param data - Данные для отправки в теле запроса (для POST, PUT, DELETE)
   * @returns Результат запроса, преобразованный из JSON
   * @private
   */
  private async request<T>(endpoint: string, method: HttpMethod, data?: any): Promise<T> {
    try {
      const url = this.baseUrl + endpoint;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };

      // Добавляем токен авторизации из localStorage если он есть
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        console.log(`[Auth] apiRequest: Добавляем токен авторизации для ${endpoint}`);
      }

      const options: RequestInit = {
        method,
        headers,
        credentials: 'include' // Включаем отправку куки для работы сессий
      };

      // Добавляем тело запроса для методов отличных от GET
      if (data !== undefined && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      console.log(`[Auth] Выполняется запрос ${method} к ${endpoint}`, options);
      
      const response = await fetch(url, options);

      // Проверяем статус ответа
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: response.statusText 
        }));
        
        console.warn(`[API] Ошибка: ${response.status} - ${response.statusText}:`, JSON.stringify(errorData));
        console.error('[API] Ошибка запроса:', errorData);
        
        // Особая обработка 401 ошибки - перенаправление на страницу входа
        if (response.status === 401) {
          // Проверяем, находимся ли мы уже на странице входа или регистрации
          if (!window.location.pathname.includes('/auth')) {
            console.log('[Auth] Перенаправление на страницу входа из-за 401 ошибки');
            setTimeout(() => {
              window.location.href = '/auth';
            }, 100);
          }
        }
        
        throw new Error(`${response.status} - ${response.statusText}`);
      }

      // Для успешных ответов, проверяем, есть ли тело ответа
      if (response.status === 204) {
        return {} as T; // Если нет контента, возвращаем пустой объект
      }

      // Парсим JSON
      let responseData: T;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        // Если не JSON, возвращаем текст или пустой объект
        const text = await response.text();
        responseData = (text ? { data: text } : {}) as T;
      }

      return responseData;
    } catch (error) {
      console.error('Fetch operation failed:', error);
      console.error('API Request failed:', error);
      throw error;
    }
  }
}

// Экспортируем экземпляр API клиента для использования всеми модулями
export const apiClient = new ApiClient();