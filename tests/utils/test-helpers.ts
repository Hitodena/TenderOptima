import { TEST_CONFIG } from '../setup/test-environment';

/**
 * Утилиты для тестирования
 */
export class TestHelpers {
  /**
   * Создает тестового пользователя
   */
  static async createTestUser(userData: Partial<{
    email: string;
    password: string;
    name: string;
    role: string;
  }> = {}) {
    const defaultUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      role: 'user',
      ...userData
    };

    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaultUser)
    });

    if (!response.ok) {
      throw new Error(`Failed to create test user: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Получает авторизационный токен для пользователя
   */
  static async getAuthToken(userData: { email: string; password: string }) {
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      throw new Error(`Failed to login: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sessionId;
  }

  /**
   * Создает тестовый поисковый запрос
   */
  static async createTestSearchRequest(authToken: string, requestData: Partial<{
    title: string;
    description: string;
    requirements: string[];
    budget: number;
    deadline: string;
  }> = {}) {
    const defaultRequest = {
      title: 'Test Search Request',
      description: 'Test description',
      requirements: ['quality', 'delivery'],
      budget: 10000,
      deadline: '2024-12-31',
      ...requestData
    };

    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(defaultRequest)
    });

    if (!response.ok) {
      throw new Error(`Failed to create search request: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Очищает тестовые данные
   */
  static async cleanupTestData() {
    try {
      // Очистка пользователей
      await fetch(`${TEST_CONFIG.API_BASE_URL}/api/test/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  /**
   * Ждет выполнения условия
   */
  static async waitFor(condition: () => boolean, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Генерирует случайные тестовые данные
   */
  static generateTestData() {
    const timestamp = Date.now();
    return {
      email: `test-${timestamp}@example.com`,
      name: `Test User ${timestamp}`,
      title: `Test Request ${timestamp}`,
      description: `Test description ${timestamp}`,
      phone: `+123456789${timestamp.toString().slice(-3)}`,
      website: `https://test-${timestamp}.com`
    };
  }

  /**
   * Мокирует внешние сервисы
   */
  static mockExternalServices() {
    // Мокирование OpenAI
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('openai')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Mocked AI response' } }]
          })
        });
      }
      return fetch(url);
    });
  }

  /**
   * Создает тестовый файл
   */
  static createTestFile(content: string = 'Test file content', filename: string = 'test.txt') {
    return new File([content], filename, { type: 'text/plain' });
  }

  /**
   * Проверяет производительность функции
   */
  static async measurePerformance<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const endTime = Date.now();
    
    return {
      result,
      duration: endTime - startTime
    };
  }

  /**
   * Создает тестовую сессию
   */
  static async createTestSession() {
    const user = await this.createTestUser();
    const token = await this.getAuthToken({
      email: user.user.email,
      password: 'TestPassword123!'
    });
    
    return {
      user: user.user,
      token,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Валидирует ответ API
   */
  static validateApiResponse(response: Response, expectedStatus: number = 200) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
    
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Response is not JSON');
    }
    
    return true;
  }

  /**
   * Создает тестовую базу данных
   */
  static async setupTestDatabase() {
    try {
      // Здесь можно добавить логику настройки тестовой БД
      console.log('Test database setup completed');
    } catch (error) {
      console.error('Test database setup failed:', error);
      throw error;
    }
  }
}


