import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';
import { TestHelpers } from '../../utils/test-helpers';

// Моки для внешних API
const mockYandexSearch = vi.fn();
const mockGoogleSearch = vi.fn();

vi.mock('../../../server/services/yandex-search', () => ({
  searchYandex: mockYandexSearch
}));

vi.mock('../../../server/services/google-search', () => ({
  searchGoogle: mockGoogleSearch
}));

describe('External API Integration Tests', () => {
  let authToken: string;
  let userId: number;

  beforeEach(async () => {
    await setupTestEnvironment();
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    userId = session.user.id;
    
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Yandex Search Integration', () => {
    it('should search suppliers via Yandex', async () => {
      mockYandexSearch.mockResolvedValue({
        results: [
          {
            title: 'ElectroTech Solutions',
            url: 'https://electrotech.com',
            description: 'Leading electronics manufacturer',
            snippet: 'High-quality electronics with ISO certification'
          },
          {
            title: 'Digital Components Ltd',
            url: 'https://digitalcomponents.com',
            description: 'Specialized in digital components',
            snippet: 'Digital components and circuit boards'
          }
        ],
        totalResults: 2,
        searchTime: 0.5
      });

      const searchData = {
        query: 'electronics manufacturer',
        maxResults: 10,
        regions: ['ru'],
        language: 'ru'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should handle Yandex search errors', async () => {
      mockYandexSearch.mockRejectedValue(new Error('Yandex API error'));

      const searchData = {
        query: 'electronics manufacturer',
        maxResults: 10
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(500);
    });

    it('should handle empty search results', async () => {
      mockYandexSearch.mockResolvedValue({
        results: [],
        totalResults: 0,
        searchTime: 0.1
      });

      const searchData = {
        query: 'nonexistent supplier',
        maxResults: 10
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.results).toEqual([]);
      expect(result.totalResults).toBe(0);
    });

    it('should validate search parameters', async () => {
      const invalidSearchData = {
        query: '', // Пустой запрос
        maxResults: 1000 // Слишком много результатов
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(invalidSearchData)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Google Search Integration', () => {
    it('should search suppliers via Google', async () => {
      mockGoogleSearch.mockResolvedValue({
        results: [
          {
            title: 'Global Electronics Inc',
            url: 'https://globalelectronics.com',
            description: 'International electronics supplier',
            snippet: 'Worldwide electronics distribution'
          }
        ],
        totalResults: 1,
        searchTime: 0.3
      });

      const searchData = {
        query: 'electronics supplier',
        maxResults: 10,
        regions: ['us'],
        language: 'en'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/google-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle Google search rate limits', async () => {
      mockGoogleSearch.mockRejectedValue(new Error('Rate limit exceeded'));

      const searchData = {
        query: 'electronics supplier',
        maxResults: 10
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/google-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(429);
    });
  });

  describe('Unified Search Integration', () => {
    it('should combine results from multiple sources', async () => {
      mockYandexSearch.mockResolvedValue({
        results: [
          {
            title: 'Russian Electronics',
            url: 'https://russian-electronics.ru',
            description: 'Russian electronics manufacturer',
            source: 'yandex'
          }
        ],
        totalResults: 1
      });

      mockGoogleSearch.mockResolvedValue({
        results: [
          {
            title: 'Global Electronics',
            url: 'https://global-electronics.com',
            description: 'International electronics supplier',
            source: 'google'
          }
        ],
        totalResults: 1
      });

      const searchData = {
        query: 'electronics manufacturer',
        sources: ['yandex', 'google'],
        maxResults: 20
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/universal-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should handle partial failures in unified search', async () => {
      mockYandexSearch.mockResolvedValue({
        results: [
          {
            title: 'Russian Electronics',
            url: 'https://russian-electronics.ru',
            description: 'Russian electronics manufacturer',
            source: 'yandex'
          }
        ],
        totalResults: 1
      });

      mockGoogleSearch.mockRejectedValue(new Error('Google API error'));

      const searchData = {
        query: 'electronics manufacturer',
        sources: ['yandex', 'google'],
        maxResults: 20
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/universal-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Search Performance', () => {
    it('should handle concurrent search requests', async () => {
      mockYandexSearch.mockResolvedValue({
        results: [
          {
            title: 'Test Supplier',
            url: 'https://test-supplier.com',
            description: 'Test supplier description'
          }
        ],
        totalResults: 1
      });

      const searchQueries = [
        'electronics manufacturer',
        'automotive supplier',
        'textile manufacturer',
        'food supplier',
        'chemical supplier'
      ];

      const promises = searchQueries.map(query =>
        fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ query, maxResults: 10 })
        })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle search timeout', async () => {
      mockYandexSearch.mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 30000);
        })
      );

      const searchData = {
        query: 'electronics manufacturer',
        maxResults: 10
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(408);
    });
  });

  describe('Search Caching', () => {
    it('should cache search results', async () => {
      mockYandexSearch.mockResolvedValue({
        results: [
          {
            title: 'Cached Supplier',
            url: 'https://cached-supplier.com',
            description: 'Cached supplier description'
          }
        ],
        totalResults: 1,
        cached: true
      });

      const searchData = {
        query: 'cached search',
        maxResults: 10
      };

      // Первый запрос
      const response1 = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      // Второй запрос (должен использовать кэш)
      const response2 = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      const result1 = await response1.json();
      const result2 = await response2.json();
      
      expect(result1.results).toEqual(result2.results);
    });

    it('should handle cache invalidation', async () => {
      const searchData = {
        query: 'cache invalidation test',
        maxResults: 10
      };

      // Очищаем кэш
      const clearResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/cache/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(clearResponse.status).toBe(200);

      // Проверяем, что кэш очищен
      const searchResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(searchResponse.status).toBe(200);
    });
  });

  describe('Search Analytics', () => {
    it('should track search metrics', async () => {
      mockYandexSearch.mockResolvedValue({
        results: [
          {
            title: 'Analytics Supplier',
            url: 'https://analytics-supplier.com',
            description: 'Supplier for analytics'
          }
        ],
        totalResults: 1,
        searchTime: 0.5,
        resultsCount: 1
      });

      const searchData = {
        query: 'analytics supplier',
        maxResults: 10
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/yandex-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.searchTime).toBeDefined();
      expect(result.resultsCount).toBeDefined();
    });
  });
});


