import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';
import { TestHelpers } from '../../utils/test-helpers';

describe('Supplier Search API Tests', () => {
  let authToken: string;
  let userId: number;

  beforeEach(async () => {
    await setupTestEnvironment();
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    userId = session.user.id;
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('POST /api/supplier-search', () => {
    it('should search suppliers with valid query', async () => {
      const searchData = {
        query: 'electronics manufacturer',
        maxResults: 10,
        regions: ['ru'],
        language: 'ru'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.suppliers).toBeDefined();
      expect(Array.isArray(data.suppliers)).toBe(true);
    });

    it('should search suppliers with queries array', async () => {
      const searchData = {
        queries: ['electronics', 'manufacturer', 'supplier'],
        maxResults: 10,
        regions: ['ru'],
        language: 'ru'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.suppliers).toBeDefined();
      expect(Array.isArray(data.suppliers)).toBe(true);
    });

    it('should reject search without authentication', async () => {
      const searchData = {
        query: 'electronics manufacturer'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(401);
    });

    it('should reject search without query', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
    });

    it('should reject search with empty query', async () => {
      const searchData = {
        query: '',
        maxResults: 10
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(400);
    });

    it('should limit maxResults to reasonable value', async () => {
      const searchData = {
        query: 'electronics',
        maxResults: 1000 // Слишком большое значение
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      // Должен либо принять, либо ограничить автоматически
      expect([200, 400]).toContain(response.status);
    });

    it('should validate regions parameter', async () => {
      const searchData = {
        query: 'electronics',
        regions: ['ru', 'us', 'de', 'fr', 'it', 'es'] // Слишком много регионов
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(400);
    });

    it('should handle search with different languages', async () => {
      const searchData = {
        query: 'electronics manufacturer',
        language: 'en',
        regions: ['us']
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(searchData)
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/universal-search', () => {
    it('should perform universal search', async () => {
      const searchData = {
        query: 'electronics supplier',
        options: {
          includeContactInfo: true,
          includeRatings: true
        },
        userType: 'beginner'
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
      const data = await response.json();
      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('should reject universal search without query', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/universal-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
    });

    it('should handle different user types', async () => {
      const userTypes = ['beginner', 'intermediate', 'expert'];
      
      for (const userType of userTypes) {
        const searchData = {
          query: 'electronics supplier',
          userType
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
      }
    });
  });

  describe('GET /api/supplier-responses-batch', () => {
    it('should get batch supplier responses', async () => {
      const requestIds = [1, 2, 3];
      
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-responses-batch?requestIds=${JSON.stringify(requestIds)}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.responses).toBeDefined();
      expect(Array.isArray(data.responses)).toBe(true);
    });

    it('should reject batch request without requestIds', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-responses-batch`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(400);
    });

    it('should reject batch request with invalid requestIds format', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-responses-batch?requestIds=invalid`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(400);
    });
  });
});


