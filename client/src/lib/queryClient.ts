import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = Response>(
  urlOrMethod: string,
  methodOrData?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' | string | any,
  data?: unknown | undefined,
  options?: { headers?: Record<string, string> }
): Promise<T> {
  let method: string = 'GET';  // Default method
  let url: string = '';  
  
  // Determine if we're using the new or old parameter order
  if (urlOrMethod.startsWith('/') || urlOrMethod.startsWith('http')) {
    // New order: apiRequest(url, method, data)
    url = urlOrMethod;
    
    // If the second parameter is a valid HTTP method
    if (typeof methodOrData === 'string' && ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'].includes(methodOrData.toUpperCase())) {
      method = methodOrData.toUpperCase();
      // data is the third parameter in this case
    } else {
      // If method wasn't specified or wasn't a valid method string
      method = 'GET'; // Default to GET for URLs with no method
      data = methodOrData; // Use second param as data
    }
  } else if (['GET', 'POST', 'PATCH', 'DELETE', 'PUT'].includes(urlOrMethod.toUpperCase())) {
    // Old order: apiRequest(method, url, data)
    method = urlOrMethod.toUpperCase();
    url = methodOrData as string;
  } else {
    // Unrecognized parameter format
    console.error('[API] Unrecognized apiRequest parameter format');
    return {} as unknown as T;
  }
  try {
    // Add error handling for empty URLs
    if (!url) {
      console.error('API Request called with empty URL');
      
      // Return appropriate empty response based on request context
      return {} as unknown as T;
    }
    
    // Safe default parameters extraction for error handling
    const urlParts = url.split('/');
    const isParametersRequest = url && url.includes('/parameters/');
    const requestId = isParametersRequest ? parseInt(urlParts[urlParts.length - 1]) : null;
    
    try {
      // Получаем сохраненный токен доступа
      const accessToken = localStorage.getItem('accessToken');
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      
      console.log(`=== ПРОВЕРКА ТОКЕНА ДЛЯ ${url} ===`);
      console.log(`[Auth] apiRequest: Проверяем токен для ${url}:`, {
        hasAccessToken: !!accessToken,
        accessToken: accessToken ? accessToken.substring(0, 20) + '...' : 'НЕТ',
        hasTokenExpiry: !!tokenExpiry,
        tokenExpiry: tokenExpiry
      });
      console.log('localStorage содержимое:', {
        accessToken: localStorage.getItem('accessToken'),
        tokenExpiry: localStorage.getItem('tokenExpiry'),
        allKeys: Object.keys(localStorage)
      });
      
      // Проверяем, не истек ли срок действия токена
      let headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest", // Некоторые серверы используют этот заголовок для проверки CORS
      };
      
      // Добавляем дополнительные заголовки если они переданы
      if (options && options.headers) {
        Object.assign(headers, options.headers);
        console.log(`[Auth] apiRequest: Добавлены дополнительные заголовки для ${url}:`, options.headers);
      }
      
      // Всегда добавляем токен, если он есть (пусть сервер проверяет его валидность)
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
        console.log(`[Auth] apiRequest: Добавляем токен авторизации для ${url}`);
      } else {
        console.log(`[Auth] apiRequest: Токен отсутствует для ${url}`);
      }
      
      // Форматируем URL правильно (добавляем базовый URL API если нужно)
      let formattedUrl = url.startsWith('http') || url.startsWith('/') 
        ? url 
        : `/${url}`; // Убедимся, что URL имеет ведущий слэш если нет абсолютного URL
      
      // GET и HEAD запросы не могут иметь body по спецификации
      const requestOptions: RequestInit = {
        method: method,
        headers,
        credentials: "include", // Важно для передачи куки
        mode: 'cors', // Явно указываем, что нужен CORS
        cache: 'no-cache', // Отключаем кэширование для запросов авторизации
      };
      
      // Добавляем body только если это не GET или HEAD запрос
      if (data && method !== 'GET' && method !== 'HEAD') {
        console.log('[ApiRequest DEBUG] Adding body data:', {
          url: formattedUrl,
          method,
          dataType: typeof data,
          dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'not object',
          businessCardLength: data && typeof data === 'object' && 'businessCard' in data ? (data as any).businessCard?.length || 0 : 'no businessCard field',
          hasLogoUrl: data && typeof data === 'object' && 'logoUrl' in data ? !!(data as any).logoUrl : 'no logoUrl field',
          businessCardPreview: data && typeof data === 'object' && 'businessCard' in data ? (data as any).businessCard?.substring(0, 100) + '...' : 'no businessCard field',
          hasNewlines: data && typeof data === 'object' && 'businessCard' in data ? (data as any).businessCard?.includes('\n') || false : 'no businessCard field',
          newlineCount: data && typeof data === 'object' && 'businessCard' in data ? ((data as any).businessCard?.match(/\n/g) || []).length : 'no businessCard field'
        });
        const jsonBody = JSON.stringify(data);
        console.log('[ApiRequest DEBUG] JSON body:', {
          jsonLength: jsonBody.length,
          hasNewlines: jsonBody.includes('\\n'),
          newlineCount: (jsonBody.match(/\\n/g) || []).length,
          jsonPreview: jsonBody.substring(0, 200) + '...'
        });
        requestOptions.body = jsonBody;
      } else if (data && (method === 'GET' || method === 'HEAD')) {
        // Для GET запросов с данными, конвертируем в query параметры
        const params = new URLSearchParams();
        const dataObj = data as Record<string, any>;
        Object.keys(dataObj).forEach(key => {
          if (dataObj[key] !== undefined && dataObj[key] !== null) {
            params.append(key, String(dataObj[key]));
          }
        });
        
        // Добавляем параметры к URL
        const separator = formattedUrl.includes('?') ? '&' : '?';
        const paramString = params.toString();
        if (paramString) {
          formattedUrl = `${formattedUrl}${separator}${paramString}`;
        }
      }
      
      console.log(`[Auth] Выполняется запрос ${method} к ${formattedUrl}`, { headers, hasToken: !!headers["Authorization"] });
      
      const res = await fetch(formattedUrl, requestOptions);
      
      // Check for token expiration headers and handle token refresh
      const tokenExpired = res.headers.get('X-Token-Expired');
      const newToken = res.headers.get('X-New-Token');
      
      if (tokenExpired === 'true' && newToken) {
        console.log('[Auth] Сервер сообщил об истекшем токене и предоставил новый токен');
        
        // Сохраняем новый токен в localStorage
        localStorage.setItem('accessToken', newToken);
        localStorage.setItem('tokenExpiry', String(Date.now() + 30*24*60*60*1000)); // 30 days
        
        console.log('[Auth] Токен обновлен автоматически');
      }
  
      // Handle specific error cases gracefully
      if (!res.ok) {
        console.warn(`API request error: ${res.status} - ${res.statusText} for URL: ${url}`);
        
        // Special handling for connection recovery and authentication errors
        if (res.status === 401 || res.status === 403) {
          // Only for GET requests, try to silently recover with fallback data
          if (method === 'GET') {
            console.log(`Authentication error for ${url}, providing fallback data`);
            
            if (isParametersRequest) {
              console.log(`Returning empty parameters for request ID: ${requestId}`);
              return { parameters: [] } as any as T;
            }
            
            if (url.includes('/contacts')) {
              console.log(`Returning empty array for contacts URL: ${url}`);
              return [] as any as T;
            }
            
            return {} as any as T;
          } else {
            // For non-GET requests with auth errors, provide a specific error
            throw new Error('Ошибка аутентификации. Пожалуйста, войдите в систему снова.');
          }
        }
        
        // Handle server errors (500 range) more gracefully 
        if (res.status >= 500) {
          console.log(`Server error ${res.status} for ${url}, attempting recovery`);
          
          // For GET requests, provide fallback data to prevent UI crashes
          if (method === 'GET') {
            if (isParametersRequest) {
              return { parameters: [] } as any as T;
            }
            
            if (url.includes('/contacts')) {
              return [] as any as T;
            }
            
            return {} as any as T;
          } else {
            // For non-GET requests with server errors, provide a friendly error
            throw new Error('Проблема с сервером. Пожалуйста, попробуйте позже или обновите страницу.');
          }
        }
        
        // For other non-successful responses, extract detailed error message if available
        try {
          const errorData = await res.json();
          if (errorData && errorData.error) {
            throw new Error(errorData.error);
          }
        } catch (jsonError) {
          // If can't parse JSON or no error message, fall back to status text
          throw new Error(`API request failed: ${res.status} ${res.statusText}`);
        }
      }
  
      // Handle successful responses
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonData = await res.json();
        console.log(`[apiRequest] JSON ответ для ${formattedUrl}:`, jsonData);
        return jsonData as T;
      }
      
      // For non-JSON responses, return the response object
      return res as unknown as T;
    } catch (fetchError) {
      console.error('Fetch operation failed:', fetchError);
      
      // Provide fallback responses for specific request types
      if (method === 'GET') {
        if (isParametersRequest) {
          console.log(`Network error - returning empty parameters array for request ID: ${requestId}`);
          return { parameters: [] } as any as T;
        }
        return {} as any as T;
      }
      
      // Re-throw for other types of requests
      throw fetchError;
    }
  } catch (error) {
    console.error('API Request failed:', error);
    
    // Last resort fallback - return empty object for GET requests
    if (method === 'GET') {
      if (url.includes('/parameters/')) {
        return { parameters: [] } as any as T;
      }
      return {} as any as T;
    }
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      // Safeguard against invalid or empty queryKey
      if (!queryKey || !queryKey[0] || typeof queryKey[0] !== 'string') {
        console.error('Invalid query key for fetch operation:', queryKey);
        return null;
      }
      
      const url = queryKey[0] as string;
      const isParametersRequest = url && url.includes('/parameters/');
      
      try {
        // Получаем сохраненный токен доступа
        const accessToken = localStorage.getItem('accessToken');
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        
        // Настраиваем заголовки запроса
        let headers: HeadersInit = {
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "application/json",
          "Content-Type": "application/json",
        };
        
        // Всегда добавляем токен, если он есть (пусть сервер проверяет его валидность)
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
          console.log(`[Auth] Query: Добавляем токен авторизации для ${url}`);
        } else {
          console.log(`[Auth] Query: Токен отсутствует для ${url}`);
        }
        
        // Форматируем URL правильно (добавляем базовый URL API если нужно)
        const fullUrl = url.startsWith('http') || url.startsWith('/') 
          ? url 
          : `/${url}`; // Убедимся, что URL имеет ведущий слэш если нет абсолютного URL
        
        console.log(`[Auth] Query: Выполняется запрос GET к ${fullUrl}`, { 
          hasToken: !!headers["Authorization"],
          headers 
        });
        
        const res = await fetch(fullUrl, {
          credentials: "include", // Оставляем для совместимости с сессионной аутентификацией
          headers,
          mode: 'cors',
          cache: 'no-cache',
        });
        
        // Check for token expiration headers and handle token refresh
        const tokenExpired = res.headers.get('X-Token-Expired');
        const newToken = res.headers.get('X-New-Token');
        
        if (tokenExpired === 'true' && newToken) {
          console.log('[Auth] Query: Сервер сообщил об истекшем токене и предоставил новый токен');
          
          // Сохраняем новый токен в localStorage
          localStorage.setItem('accessToken', newToken);
          localStorage.setItem('tokenExpiry', String(Date.now() + 30*24*60*60*1000)); // 30 days
          
          console.log('[Auth] Query: Токен обновлен автоматически');
        }
  
        // Handle 401 unauthorized according to behavior setting
        if (unauthorizedBehavior === "returnNull" && res.status === 401) {
          return null;
        }
        
        // For server errors, optimize for UI continuity
        if (res.status >= 500) {
          console.log(`[Auth] Query: Server error ${res.status} for ${url}, providing fallback response`);
          
          if (isParametersRequest) {
            return { parameters: [] } as any;
          }
          
          if (url.includes('/contacts')) {
            return [] as any;
          }
          
          if (unauthorizedBehavior === "returnNull") {
            return null;
          }
          
          // For non-critical paths, return empty object
          return {} as any;
        }
        
        // For parameters requests, if 404 or other error, return empty parameters
        if (!res.ok) {
          if (isParametersRequest) {
            console.log(`Query function returning empty parameters for URL: ${url}`);
            return { parameters: [] } as any;
          }
          
          // For contact group data
          if (url.includes('/contacts')) {
            return [] as any;
          }
          
          // For other types of failed requests
          if (unauthorizedBehavior === "returnNull") {
            return null;
          }
          
          // Otherwise follow normal error handling
          await throwIfResNotOk(res);
        }
        
        // For successful responses
        return await res.json();
      } catch (error) {
        console.error(`Query function error for URL: ${queryKey[0]}:`, error);
        
        // Provide fallback for parameters
        if (isParametersRequest) {
          return { parameters: [] } as any;
        }
        
        // For other errors, respect the unauthorizedBehavior setting
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
        
        throw error;
      }
    } catch (error) {
      console.error('getQueryFn caught a top-level error:', error);
      
      // Return null for optional queries
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});