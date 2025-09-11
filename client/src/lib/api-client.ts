/**
 * API client configuration using Stage 65 working implementation
 */

// HTTP Methods type for type safety
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * API Client class for consistent request handling
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, 'GET');
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, 'POST', data);
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, 'PUT', data);
  }

  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, 'DELETE', data);
  }

  private async request<T>(endpoint: string, method: HttpMethod, data?: any): Promise<T> {
    try {
      const url = this.baseUrl + endpoint;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };

      // Session-based authentication - no token needed, just cookies
      console.log(`[Auth] apiRequest: Использую session-based аутентификацию для ${endpoint}`);

      const options: RequestInit = {
        method,
        headers,
        credentials: 'include' // Include cookies for session handling
      };

      // Add body for non-GET requests
      if (data !== undefined && method !== 'GET') {
        options.body = JSON.stringify(data);
        console.log(`[ApiRequest DEBUG] Adding body data:`, {
          url: endpoint,
          method,
          dataType: typeof data,
          dataKeys: typeof data === 'object' && data ? Object.keys(data) : [],
          businessCardLength: data && data.businessCard ? `${data.businessCard.length} chars` : 'no businessCard field',
          hasLogoUrl: data && data.logoUrl ? 'has logoUrl' : 'no logoUrl field'
        });
      }

      console.log(`[Auth] Выполняется запрос ${method} к ${endpoint}`, {
        headers: options.headers,
        hasCredentials: true
      });
      
      const response = await fetch(url, options);

      // Check response status
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: response.statusText 
        }));
        
        console.warn(`[API] Ошибка: ${response.status} - ${response.statusText}:`, JSON.stringify(errorData));
        console.error('[API] Ошибка запроса:', errorData);
        
        // Special handling for 401 errors - redirect to login
        if (response.status === 401) {
          if (!window.location.pathname.includes('/auth')) {
            console.log('[Auth] Перенаправление на страницу входа из-за 401 ошибки');
            setTimeout(() => {
              window.location.href = '/auth';
            }, 100);
          }
        }
        
        throw new Error(`${response.status} - ${response.statusText}`);
      }

      // Handle successful responses
      if (response.status === 204) {
        return {} as T; // No content, return empty object
      }

      // Parse JSON response
      let responseData: T;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        // If not JSON, return text or empty object
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

// Export instance for use across the application
export const apiClient = new ApiClient();

// Legacy apiRequest function for backward compatibility
export async function apiRequest<T>(
  endpoint: string,
  method: string = 'GET',
  data?: any,
  customHeaders: HeadersInit = {}
): Promise<T> {
  const methodUpperCase = method.toUpperCase() as HttpMethod;
  
  switch (methodUpperCase) {
    case 'GET':
      return apiClient.get<T>(endpoint);
    case 'POST':
      return apiClient.post<T>(endpoint, data);
    case 'PUT':
      return apiClient.put<T>(endpoint, data);
    case 'DELETE':
      return apiClient.delete<T>(endpoint, data);
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
}

// API utility functions
export const api = {
  get: <T>(endpoint: string, customHeaders?: HeadersInit) => 
    apiRequest<T>(endpoint, 'GET', undefined, customHeaders),
    
  post: <T>(endpoint: string, data?: any, customHeaders?: HeadersInit) => 
    apiRequest<T>(endpoint, 'POST', data, customHeaders),
    
  put: <T>(endpoint: string, data?: any, customHeaders?: HeadersInit) => 
    apiRequest<T>(endpoint, 'PUT', data, customHeaders),
    
  patch: <T>(endpoint: string, data?: any, customHeaders?: HeadersInit) => 
    apiRequest<T>(endpoint, 'PATCH', data, customHeaders),
    
  delete: <T>(endpoint: string, customHeaders?: HeadersInit) => 
    apiRequest<T>(endpoint, 'DELETE', undefined, customHeaders),
};