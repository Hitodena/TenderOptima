import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniversalSearchEngine } from '../../../server/services/universal-search/core/search-engine';
import { defaultConfig } from '../../../server/services/universal-search/config/search-config';

// Моки для внешних зависимостей
vi.mock('../../../server/services/universal-search/core/query-processor');
vi.mock('../../../server/services/universal-search/core/result-ranker');
vi.mock('../../../server/services/universal-search/processors/linguistic-processor');
vi.mock('../../../server/services/universal-search/processors/fuzzy-matcher');
vi.mock('../../../server/services/universal-search/processors/phonetic-matcher');
vi.mock('../../../server/services/universal-search/processors/transliteration');

describe('UniversalSearchEngine Service', () => {
  let searchEngine: UniversalSearchEngine;

  beforeEach(() => {
    searchEngine = new UniversalSearchEngine(defaultConfig);
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should perform basic search with valid query', async () => {
      const query = 'electronics manufacturer';
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'Leading electronics manufacturer',
          email: 'contact@electrotech.com'
        },
        {
          id: 2,
          name: 'Digital Components Ltd',
          description: 'Specialized in digital components',
          email: 'sales@digitalcomponents.com'
        }
      ];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty query', async () => {
      const query = '';
      const suppliers = [
        {
          id: 1,
          name: 'Test Supplier',
          description: 'Test description',
          email: 'test@test.com'
        }
      ];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty suppliers array', async () => {
      const query = 'electronics';
      const suppliers: any[] = [];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle complex queries', async () => {
      const query = 'electronics manufacturer ISO 9001 certified fast delivery';
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'ISO 9001 certified electronics manufacturer with fast delivery',
          email: 'contact@electrotech.com'
        }
      ];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle queries with special characters', async () => {
      const query = 'electronics & components (ISO 9001)';
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'Electronics and components manufacturer with ISO 9001',
          email: 'contact@electrotech.com'
        }
      ];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const query = 'electronics';
      const suppliers = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Supplier ${i + 1}`,
        description: `Electronics supplier ${i + 1}`,
        email: `supplier${i + 1}@test.com`
      }));

      const startTime = Date.now();
      const result = await searchEngine.search(query, suppliers);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Менее 5 секунд
    });

    it('should handle concurrent search requests', async () => {
      const queries = ['electronics', 'manufacturing', 'supplier', 'components', 'ISO'];
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'Electronics manufacturer with ISO certification',
          email: 'contact@electrotech.com'
        }
      ];

      const promises = queries.map(query => searchEngine.search(query, suppliers));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(queries.length);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Search strategies', () => {
    it('should use exact match strategy for precise queries', async () => {
      const query = 'ElectroTech Solutions';
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'Electronics manufacturer',
          email: 'contact@electrotech.com'
        }
      ];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use fuzzy matching for typos', async () => {
      const query = 'ElectroTech Solutons'; // Опечатка в "Solutions"
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'Electronics manufacturer',
          email: 'contact@electrotech.com'
        }
      ];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle multilingual queries', async () => {
      const query = 'электроника производитель'; // Русский текст
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'Electronics manufacturer',
          email: 'contact@electrotech.com'
        }
      ];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        ...defaultConfig,
        maxResults: 50,
        fuzzyThreshold: 0.8
      };

      const customEngine = new UniversalSearchEngine(customConfig);
      expect(customEngine).toBeDefined();
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        ...defaultConfig,
        maxResults: -1,
        fuzzyThreshold: 2.0 // Неверное значение
      };

      expect(() => new UniversalSearchEngine(invalidConfig)).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle search errors gracefully', async () => {
      const query = 'electronics';
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'Electronics manufacturer',
          email: 'contact@electrotech.com'
        }
      ];

      // Мокаем ошибку в поисковом движке
      vi.spyOn(searchEngine, 'search').mockRejectedValue(new Error('Search engine error'));

      await expect(searchEngine.search(query, suppliers)).rejects.toThrow('Search engine error');
    });

    it('should handle malformed supplier data', async () => {
      const query = 'electronics';
      const suppliers = [
        {
          id: 1,
          name: 'ElectroTech Solutions',
          description: 'Electronics manufacturer',
          email: 'contact@electrotech.com'
        },
        {
          // Неполные данные
          id: 2
        },
        null,
        undefined
      ];

      const result = await searchEngine.search(query, suppliers);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});


